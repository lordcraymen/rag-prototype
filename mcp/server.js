/**
 * RAG MCP Server
 * Clean, modular MCP server for RAG operations
 */
import { MCPServerFactory } from './lib/mcp-server-factory.js';
import { RAGService } from './lib/rag-service.js';
import { RAGToolRegistry } from './lib/rag-tool-registry.js';
import { ConfigManager } from './lib/config.js';

/**
 * Main server initialization
 */
async function main() {
  try {
    console.error('🚀 Starting RAG MCP Server...');

    // Load consolidated configuration
    const { server: serverConfig, rag: ragConfig } = ConfigManager.getConfig();

    // Create server instance using factory
    const server = MCPServerFactory.createServer(serverConfig);

    // Initialize RAG service
    const ragService = new RAGService(ragConfig);
    
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
