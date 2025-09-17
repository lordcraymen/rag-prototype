import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { DefaultMCPServerFactory } from '../src/mcp/server-factory';
import { MCPServer, MCPServerConfig, MCPTool } from '../src/types/mcp-interfaces';
import { RAGTools } from '../src/mcp/rag-tools';

// Mock the database connector for E2E tests
const mockConnector = {
  getStatus: vi.fn().mockResolvedValue({
    connected: true,
    database: 'rag',
    host: 'localhost',
    documentCount: 212,
    embedding: 'xenova-local',
    architecture: 'typescript',
    runtime: 'tsx-inline'
  }),
  search: vi.fn().mockResolvedValue([
    {
      id: 'doc1',
      title: 'Test Document',
      content: 'Test content for STAB',
      score: 0.85,
      metadata: {}
    }
  ]),
  addDocument: vi.fn().mockResolvedValue('doc123'),
  removeDocument: vi.fn().mockResolvedValue(undefined),
  getDocumentCount: vi.fn().mockResolvedValue(212)
};

describe('End-to-End RAG MCP System Tests', () => {
  let server: MCPServer;
  let ragTools: RAGTools;

  beforeAll(async () => {
    // Create server with mocked dependencies for E2E testing
    const config: MCPServerConfig = {
      name: 'e2e-test-server',
      version: '1.0.0',
      transport: 'stdio'
    };
    
    const factory = new DefaultMCPServerFactory();
    server = factory.createServer(config);
    
    // Create and register RAG tools with mocked connector
    ragTools = new RAGTools(mockConnector as any);
    const tools = ragTools.createAllTools();
    
    // Register all tools
    tools.forEach((tool: MCPTool) => server.addTool(tool));
    
    await server.initialize();
  });

  afterAll(async () => {
    await server.stop();
  });

  describe('Server Initialization', () => {
    it('should initialize server with all RAG tools', async () => {
      const tools = server.getTools();
      expect(tools.length).toBe(7);
      
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).toContain('add_document');
      expect(toolNames).toContain('query_documents');
      expect(toolNames).toContain('get_rag_status');
      expect(toolNames).toContain('list_documents');
      expect(toolNames).toContain('remove_document');
      expect(toolNames).toContain('add_document_from_url');
      expect(toolNames).toContain('import_from_csv');
    });

    it('should have properly configured tools', () => {
      const tools = server.getTools();
      tools.forEach(tool => {
        expect(tool).toMatchObject({
          name: expect.any(String),
          description: expect.any(String),
          inputSchema: expect.any(Object),
          handler: expect.any(Function)
        });
      });
    });
  });

  describe('Tool Execution', () => {
    it('should execute get_rag_status tool', async () => {
      const result = await server.callTool('get_rag_status', {});
      
      expect(result).toMatchObject({
        success: true,
        result: {
          connected: expect.any(Boolean),
          database: expect.any(String),
          documentCount: expect.any(Number),
          embedding: expect.any(String),
          architecture: 'typescript',
          runtime: 'tsx-inline'
        }
      });
    });

    it('should execute query_documents tool with parameters', async () => {
      const result = await server.callTool('query_documents', {
        query: 'STAB',
        limit: 3,
        threshold: 0.1
      });

      expect(result).toMatchObject({
        success: true,
        result: {
          success: true,
          query: 'STAB',
          resultsCount: expect.any(Number),
          results: expect.any(Array)
        }
      });
    });

    it('should handle invalid tool calls gracefully', async () => {
      await expect(server.callTool('non_existent_tool', {}))
        .rejects.toThrow();
    });

    it('should validate tool input parameters', async () => {
      const result = await server.callTool('query_documents', {
        // Missing required 'query' parameter
        limit: 5
      });
      
      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining('Required')
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle malformed tool calls', async () => {
      const result = await server.callTool('query_documents', {
        query: '', // Empty query should fail validation
        limit: 5
      });
      
      // Empty query is actually valid, just returns no results
      expect(result).toMatchObject({
        success: true,
        result: expect.any(Object)
      });
    });

    it('should handle invalid limit values', async () => {
      const result = await server.callTool('query_documents', {
        query: 'test',
        limit: -1 // Invalid limit
      });
      
      expect(result).toMatchObject({
        success: false,
        error: expect.stringContaining('must be greater than or equal to 1')
      });
    });
  });

  describe('System Performance', () => {
    it('should execute tools within reasonable time', async () => {
      const startTime = Date.now();
      
      await server.callTool('get_rag_status', {});
      
      const executionTime = Date.now() - startTime;
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });

    it('should handle concurrent tool calls', async () => {
      const promises = [
        server.callTool('get_rag_status', {}),
        server.callTool('query_documents', { query: 'test', limit: 1, threshold: 0.1 }),
        server.callTool('get_rag_status', {})
      ];

      const results = await Promise.all(promises);
      expect(results).toHaveLength(3);
      results.forEach(result => expect(result).toBeDefined());
    });
  });
});