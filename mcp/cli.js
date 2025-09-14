#!/usr/bin/env node

/**
 * RAG MCP Server CLI
 * Command-line interface for starting the server in different modes
 */

// Parse command line arguments early to check for help
const args = process.argv.slice(2);
const hasHelp = args.includes('--help') || args.includes('-h');

// Show help immediately if requested, before importing anything
if (hasHelp) {
  showHelp();
  process.exit(0);
}

function showHelp() {
  console.log(`
🤖 RAG MCP Server CLI

Usage: node mcp/cli.js [options]

Options:
  --transport, -t <type>    Transport type: stdio, httpStream, sse, http (default: stdio)
  --port, -p <port>         Port for network transports (default: 3000)
  --host, -h <host>         Host for network transports (default: localhost)
  --verbose, -v             Verbose logging
  --help                    Show this help message

Examples:
  node mcp/cli.js                           # Start with stdio (default)
  node mcp/cli.js -t httpStream -p 3000     # Start HTTP streaming server on port 3000
  node mcp/cli.js -t sse -p 3001            # Start SSE server on port 3001
  node mcp/cli.js -t httpStream -h 0.0.0.0  # HTTP streaming server accessible from any IP

Transport Types:
  stdio      - Standard input/output (for MCP clients like Claude Desktop)
  httpStream - HTTP streaming (recommended for ChatGPT Developer Mode)
  sse        - Server-Sent Events (for streaming applications)
  http       - Legacy HTTP (deprecated, maps to httpStream)

Environment Variables:
  RAG_DB_HOST       - Database host (default: localhost)
  RAG_DB_PORT       - Database port (default: 5432)
  RAG_DB_NAME       - Database name (default: rag)
  RAG_DB_USER       - Database user (default: raguser)
  RAG_DB_PASSWORD   - Database password (default: ragpassword)
  RAG_MODEL_NAME    - Embedding model (default: Xenova/all-MiniLM-L6-v2)
`);
}

// Import modules only if not showing help
import { MCPServerFactory, RAGService, RAGToolRegistry } from './server-new.js';
import { ConfigManager } from './lib/config.js';
import { ServerUtils } from './lib/server-utils.js';

async function main() {
  const config = ConfigManager.parseArgs(args);

  if (config.help) {
    showHelp();
    process.exit(0);
  }

  ServerUtils.setupTransport(config);

  try {
    ServerUtils.showStartupBanner(config);

    // Get configurations
    const serverConfig = ConfigManager.getServerConfig();
    const ragConfig = ConfigManager.getRagConfig();

    // Create and setup server
    const server = MCPServerFactory.createServer(serverConfig);
    const ragService = new RAGService(ragConfig);
    const toolRegistry = new RAGToolRegistry(ragService);
    
    toolRegistry.registerAllTools(server);
    
    if (config.verbose) {
      ServerUtils.showVerboseInfo(config, ragConfig, server);
    }
    
    // Start server
    await server.start({
      transportType: config.transport,
      port: config.port,
      host: config.host,
      endpoint: config.endpoint
    });
    
    ServerUtils.showSuccessMessage(config);
    
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    if (config.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
