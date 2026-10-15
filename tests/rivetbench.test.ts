import { afterEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createLogger, createRestServer, createTransportPort, loadConfig, type LoggerPort } from '@lordcraymen/rivetbench';
import { createRagRegistry } from '../src/endpoints/registry.js';
import { createStdioServer } from '../src/server/stdio.js';
import { readServerConfig } from '../src/server/config.js';
import type { IDatabaseConnector } from '../src/types/database.js';

const logger: LoggerPort = {
  info: vi.fn(), warn: vi.fn(), error: vi.fn(), child: () => logger,
};

function fixture() {
  const connector = {
    addDocument: vi.fn().mockResolvedValue('person'),
    search: vi.fn().mockResolvedValue([{ id: 'person', content: 'A person', score: 0.9, metadata: { uri: 'https://schema.org/Person' } }]),
    getStatus: vi.fn().mockResolvedValue({ connected: true }),
    getDocumentCount: vi.fn().mockResolvedValue(1),
    deleteDocument: vi.fn().mockResolvedValue(undefined),
    importFromCSV: vi.fn().mockResolvedValue({ success: true, imported: 2, failed: 0 }),
  };
  const registry = createRagRegistry(connector as unknown as IDatabaseConnector);
  return { connector, registry, transport: createTransportPort(registry, logger) };
}

const cleanup: Array<() => Promise<unknown>> = [];
afterEach(async () => { for (const close of cleanup.splice(0).reverse()) await close(); });

describe('RivetBench RAG registry', () => {
  it('exposes working operations with output contracts', () => {
    expect(fixture().registry.list().map(endpoint => endpoint.name)).toEqual([
      'add_document', 'query_documents', 'import_from_csv', 'get_rag_status', 'remove_document',
    ]);
  });

  it('applies query defaults before invoking the connector', async () => {
    const { connector, transport } = fixture();
    await transport.invoke('query_documents', { query: 'human' });
    expect(connector.search).toHaveBeenCalledWith({ query: 'human', limit: 10, threshold: 0.7, useHybrid: true, bm25Weight: 0.3, vectorWeight: 0.7 });
  });

  it('rejects invalid input before accessing storage', async () => {
    const { connector, transport } = fixture();
    await expect(transport.invoke('add_document', {})).rejects.toThrow('Invalid endpoint input');
    expect(connector.addDocument).not.toHaveBeenCalled();
  });

  it('rejects malformed operation output', async () => {
    const { connector, transport } = fixture();
    connector.addDocument.mockResolvedValueOnce(undefined);
    await expect(transport.invoke('add_document', { content: 'Person' })).rejects.toThrow();
  });

  it('retains document identity and metadata in retrieval', async () => {
    const { transport } = fixture();
    const { output } = await transport.invoke('query_documents', { query: 'human' });
    expect(output).toMatchObject({ resultsCount: 1, results: [{ id: 'person', metadata: { uri: 'https://schema.org/Person' } }] });
  });

  it('dispatches CSV import and removal through the shared pipeline', async () => {
    const { connector, transport } = fixture();
    expect((await transport.invoke('import_from_csv', { filePath: 'types.csv' })).output).toMatchObject({ imported: 2, failed: 0 });
    await transport.invoke('remove_document', { id: 'person' });
    expect(connector.deleteDocument).toHaveBeenCalledWith('person');
  });

  it('serves REST calls and OpenAPI from the registry', async () => {
    const { registry, transport } = fixture();
    const config = loadConfig({ environment: 'test', logging: { level: 'fatal', pretty: false } });
    const server = await createRestServer({ registry, transport, loggerPort: logger, config, logger: createLogger(config) });
    cleanup.push(() => server.fastify.close());
    const response = await server.fastify.inject({ method: 'POST', url: '/rpc/query_documents', payload: { query: 'human' } });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ resultsCount: 1 });
    const invalid = await server.fastify.inject({ method: 'POST', url: '/rpc/query_documents', payload: { query: 'human', limit: -1 } });
    expect(invalid.statusCode).toBe(400);
    const openapi = await server.fastify.inject({ method: 'GET', url: '/openapi.json' });
    expect(openapi.json().paths).toHaveProperty('/rpc/query_documents');
  });

  it('discovers and invokes structured MCP tools using the SDK', async () => {
    const { registry, transport } = fixture();
    const server = createStdioServer(registry, transport, logger);
    const client = new Client({ name: 'test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    cleanup.push(() => server.close(), () => client.close());
    await server.connect(serverTransport);
    await client.connect(clientTransport);
    const { tools } = await client.listTools();
    expect(tools.find(tool => tool.name === 'query_documents')).toMatchObject({ inputSchema: { type: 'object' }, outputSchema: { type: 'object' } });
    const result = await client.callTool({ name: 'query_documents', arguments: { query: 'human' } });
    expect(result.structuredContent).toMatchObject({ resultsCount: 1 });
    const invalid = await client.callTool({ name: 'query_documents', arguments: { query: 'human', limit: -1 } });
    expect(invalid.isError).toBe(true);
  });

  it('exposes the same operations over MCP Streamable HTTP', async () => {
    const { registry, transport } = fixture();
    const config = loadConfig({ environment: 'test', logging: { level: 'fatal', pretty: false } });
    const server = await createRestServer({ registry, transport, loggerPort: logger, config, logger: createLogger(config) });
    cleanup.push(() => server.fastify.close());
    const headers = { accept: 'application/json, text/event-stream', 'content-type': 'application/json' };
    const initialize = await server.fastify.inject({ method: 'POST', url: '/mcp', headers,
      payload: { jsonrpc: '2.0', id: 1, method: 'initialize', params: {
        protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'test', version: '1.0.0' },
      } },
    });
    expect(initialize.statusCode).toBe(200);
    const session = initialize.headers['mcp-session-id'] as string;
    expect(session).toBeTruthy();
    const sessionHeaders = { ...headers, 'mcp-session-id': session };
    await server.fastify.inject({ method: 'POST', url: '/mcp', headers: sessionHeaders,
      payload: { jsonrpc: '2.0', method: 'notifications/initialized' },
    });
    const call = await server.fastify.inject({ method: 'POST', url: '/mcp', headers: sessionHeaders,
      payload: { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'query_documents', arguments: { query: 'human' } } },
    });
    expect(call.statusCode).toBe(200);
    const data = call.body.split('\n').find(line => line.startsWith('data: '));
    expect(JSON.parse(data!.slice(6)).result.structuredContent).toMatchObject({ resultsCount: 1 });
  });
});

describe('Server configuration', () => {
  it('maps the existing HTTP flag and validates ports', () => {
    expect(readServerConfig(['--transport', 'httpStream', '--port', '3100'], {})).toMatchObject({ transport: 'http', host: '127.0.0.1', port: 3100 });
    expect(() => readServerConfig(['--port', 'invalid'], {})).toThrow();
  });

  it('rejects unknown transports and arguments', () => {
    expect(() => readServerConfig(['--transport', 'sse'], {})).toThrow();
    expect(() => readServerConfig(['--unknown'], {})).toThrow();
  });
});
