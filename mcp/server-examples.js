/**
 * Server Configuration Examples
 * Shows how to create different types of MCP servers
 */
import { MCPServerFactory, RAGService, RAGToolRegistry } from './server-new.js';

/**
 * Create a basic RAG server
 */
export function createBasicRAGServer(config = {}) {
  const serverConfig = {
    name: 'Basic RAG Server',
    version: '1.0.0',
    description: 'Basic RAG service',
    framework: 'fastmcp',
    ...config.server
  };

  const ragConfig = {
    host: 'localhost',
    port: 5432,
    database: 'rag',
    user: 'raguser',
    password: 'ragpassword',
    modelName: 'Xenova/all-MiniLM-L6-v2',
    ...config.rag
  };

  const server = MCPServerFactory.createServer(serverConfig);
  const ragService = new RAGService(ragConfig);
  const toolRegistry = new RAGToolRegistry(ragService);
  
  toolRegistry.registerAllTools(server);
  
  return { server, ragService, toolRegistry };
}

/**
 * Create a custom server with specific tools only
 */
export function createCustomRAGServer(config = {}) {
  const { server, ragService, toolRegistry } = createBasicRAGServer(config);
  
  // You could register only specific tools here
  // Example: only query and add document tools
  
  return { server, ragService, toolRegistry };
}

/**
 * Create an HTTP RAG server
 */
export function createHTTPRAGServer(config = {}) {
  const { server, ragService, toolRegistry } = createBasicRAGServer(config);
  
  // HTTP-specific configuration could be added here
  
  return {
    server,
    ragService,
    toolRegistry,
    async start(port = 3000, host = 'localhost') {
      return await server.start({
        transportType: 'http',
        port,
        host
      });
    }
  };
}

/**
 * Create an SSE RAG server
 */
export function createSSERAGServer(config = {}) {
  const { server, ragService, toolRegistry } = createBasicRAGServer(config);
  
  return {
    server,
    ragService,
    toolRegistry,
    async start(port = 3001, host = 'localhost') {
      return await server.start({
        transportType: 'sse',
        port,
        host
      });
    }
  };
}

// Example usage:
/*
// Basic server
const { server } = createBasicRAGServer();
await server.start({ transportType: 'stdio' });

// HTTP server
const httpServer = createHTTPRAGServer();
await httpServer.start(3000);

// Custom configuration
const customServer = createBasicRAGServer({
  server: { name: 'My Custom RAG' },
  rag: { modelName: 'different-model' }
});
*/
