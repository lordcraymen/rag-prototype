/**
 * RAG MCP Server
 * Clean, modular MCP server for RAG operations
 */
import { MCPServerFactory } from './lib/mcp-server-factory.js';
import { RAGService } from './lib/rag-service.js';
import { RAGToolRegistry } from './lib/rag-tool-registry.js';

// Configuration
const SERVER_CONFIG = {
  name: 'RAG Service',
  version: '1.0.0',
  description: 'A RAG service with local embeddings and vector search',
  framework: 'fastmcp' // Currently supports 'fastmcp', extensible for other frameworks
};

const RAG_CONFIG = {
  host: 'localhost',
  port: 5432,
  database: 'rag',
  user: 'raguser',
  password: 'ragpassword',
  modelName: 'Xenova/all-MiniLM-L6-v2',
  generatorConfig: {
    maxResponseLength: 2000,
    includeSourceInfo: true
  }
};

/**
 * Main server initialization
 */
async function main() {
  try {
    console.error('🚀 Starting RAG MCP Server...');
    
    // Create server instance using factory
    const server = MCPServerFactory.createServer(SERVER_CONFIG);
    
    // Initialize RAG service
    const ragService = new RAGService(RAG_CONFIG);
    
    // Register all RAG tools
    const toolRegistry = new RAGToolRegistry(ragService);
    toolRegistry.registerAllTools(server);
    
    console.error(`📦 Registered ${server.getTools().length} tools:`);
    server.getTools().forEach(tool => {
      console.error(`   - ${tool.name}: ${tool.description}`);
    });
    
    // Start server
    await server.start({
      transportType: 'stdio'
    });
    
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    process.exit(1);
  }
}

// Export server factory for programmatic use
export { MCPServerFactory, RAGService, RAGToolRegistry };

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
