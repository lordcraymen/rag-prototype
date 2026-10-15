import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { toRivetBenchError } from '@lordcraymen/rivetbench';
import type { EndpointRegistry, LoggerPort, TransportPort } from '@lordcraymen/rivetbench';
import { z } from 'zod';

/**
 * Bind an SDK MCP server to RivetBench's validated invocation pipeline.
 * All RAG endpoints use object schemas; no transport-specific operation handlers exist.
 * @example await createStdioServer(registry, transport, logger).connect(new StdioServerTransport());
 */
export function createStdioServer(
  registry: EndpointRegistry, transport: TransportPort, logger: LoggerPort,
  application = { name: 'rag-knowledge-base', version: '1.0.1' },
): McpServer {
  const server = new McpServer(application);
  for (const endpoint of registry.list()) {
    if (!(endpoint.input instanceof z.ZodObject) || !(endpoint.output instanceof z.ZodObject)) {
      throw new Error(`Stdio endpoint '${endpoint.name}' requires object schemas`);
    }
    server.registerTool(endpoint.name, {
      description: endpoint.description ?? endpoint.summary,
      inputSchema: endpoint.input.shape, outputSchema: endpoint.output.shape,
    }, async (args: Record<string, unknown>) => {
      try {
        const { output } = await transport.invoke(endpoint.name, args);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(output) }],
          structuredContent: output as Record<string, unknown>,
        };
      } catch (error) {
        const failure = toRivetBenchError(error);
        logger.error('MCP tool execution failed', { tool: endpoint.name, code: failure.code });
        return { content: [{ type: 'text' as const, text: JSON.stringify(failure.toJSON()) }], isError: true };
      }
    });
  }
  return server;
}
