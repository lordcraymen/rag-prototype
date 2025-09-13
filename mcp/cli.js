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
  console.log(`
🤖 RAG MCP Server CLI

Usage: node mcp/cli.js [options]

Options:
  --transport, -t <type>    Transport type: stdio, http, sse (default: stdio)
  --port, -p <port>         Port for network transports (default: 3000)
  --host, -h <host>         Host for network transports (default: localhost)
  --verbose, -v             Verbose logging
  --help                    Show this help message

Examples:
  node mcp/cli.js                           # Start with stdio (default)
  node mcp/cli.js -t http -p 3000          # Start HTTP server on port 3000
  node mcp/cli.js -t sse -p 3001           # Start SSE server on port 3001
  node mcp/cli.js -t http -h 0.0.0.0       # HTTP server accessible from any IP

Transport Types:
  stdio    - Standard input/output (for MCP clients like Claude Desktop)
  http     - HTTP server (for ChatGPT Developer Mode)
  sse      - Server-Sent Events (for streaming applications)

Environment Variables:
  RAG_DB_HOST       - Database host (default: localhost)
  RAG_DB_PORT       - Database port (default: 5432)
  RAG_DB_NAME       - Database name (default: rag)
  RAG_DB_USER       - Database user (default: raguser)
  RAG_DB_PASSWORD   - Database password (default: ragpassword)
  RAG_MODEL_NAME    - Embedding model (default: Xenova/all-MiniLM-L6-v2)
`);
  process.exit(0);
}

// Import modules only if not showing help
import { MCPServerFactory, RAGService, RAGToolRegistry } from './server-new.js';

function parseArgs(args) {
  const config = {
    transport: 'stdio',
    port: 3000,
    host: 'localhost',
    help: false,
    verbose: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--transport':
      case '-t':
        if (nextArg && ['stdio', 'http', 'sse'].includes(nextArg)) {
          config.transport = nextArg;
          i++; // Skip next argument
        } else {
          console.error('❌ Invalid transport type. Use: stdio, http, or sse');
          process.exit(1);
        }
        break;
      
      case '--port':
      case '-p':
        if (nextArg && !isNaN(parseInt(nextArg))) {
          config.port = parseInt(nextArg);
          i++; // Skip next argument
        } else {
          console.error('❌ Invalid port number');
          process.exit(1);
        }
        break;
      
      case '--host':
      case '-h':
        if (nextArg) {
          config.host = nextArg;
          i++; // Skip next argument
        } else {
          console.error('❌ Host required');
          process.exit(1);
        }
        break;
      
      case '--verbose':
      case '-v':
        config.verbose = true;
        break;
      
      case '--help':
        config.help = true;
        break;
      
      default:
        console.error(`❌ Unknown argument: ${arg}`);
        process.exit(1);
    }
  }

  return config;
}

function showHelp() {
  console.log(`
🤖 RAG MCP Server CLI

Usage: node mcp/cli.js [options]

Options:
  --transport, -t <type>    Transport type: stdio, http, sse (default: stdio)
  --port, -p <port>         Port for network transports (default: 3000)
  --host, -h <host>         Host for network transports (default: localhost)
  --verbose, -v             Verbose logging
  --help                    Show this help message

Examples:
  node mcp/cli.js                           # Start with stdio (default)
  node mcp/cli.js -t http -p 3000          # Start HTTP server on port 3000
  node mcp/cli.js -t sse -p 3001           # Start SSE server on port 3001
  node mcp/cli.js -t http -h 0.0.0.0       # HTTP server accessible from any IP

Transport Types:
  stdio    - Standard input/output (for MCP clients like Claude Desktop)
  http     - HTTP server (for ChatGPT Developer Mode)
  sse      - Server-Sent Events (for streaming applications)

Environment Variables:
  RAG_DB_HOST       - Database host (default: localhost)
  RAG_DB_PORT       - Database port (default: 5432)
  RAG_DB_NAME       - Database name (default: rag)
  RAG_DB_USER       - Database user (default: raguser)
  RAG_DB_PASSWORD   - Database password (default: ragpassword)
  RAG_MODEL_NAME    - Embedding model (default: Xenova/all-MiniLM-L6-v2)
`);
}

async function main() {
  const config = parseArgs(args);

  if (config.help) {
    showHelp();
    process.exit(0);
  }

  // Prevent FastMCP from reading stdin when showing help or in HTTP/SSE mode
  if (config.transport !== 'stdio') {
    // Close stdin to prevent FastMCP from trying to read it
    process.stdin.pause();
  }

  try {
    if (config.verbose) {
      console.error('🔧 Configuration:', config);
    }

    console.error('🚀 Starting RAG MCP Server...');
    console.error(`📡 Transport: ${config.transport.toUpperCase()}`);
    
    if (config.transport !== 'stdio') {
      console.error(`🌐 Address: ${config.host}:${config.port}`);
    }

    // Server configuration
    const SERVER_CONFIG = {
      name: 'RAG Service',
      version: '1.0.0',
      description: 'A RAG service with local embeddings and vector search',
      framework: 'fastmcp'
    };

    // RAG configuration from environment variables or defaults
    const RAG_CONFIG = {
      host: process.env.RAG_DB_HOST || 'localhost',
      port: parseInt(process.env.RAG_DB_PORT) || 5432,
      database: process.env.RAG_DB_NAME || 'rag',
      user: process.env.RAG_DB_USER || 'raguser',
      password: process.env.RAG_DB_PASSWORD || 'ragpassword',
      modelName: process.env.RAG_MODEL_NAME || 'Xenova/all-MiniLM-L6-v2',
      generatorConfig: {
        maxResponseLength: 2000,
        includeSourceInfo: true
      }
    };

    if (config.verbose) {
      console.error('🗄️  Database:', `${RAG_CONFIG.database}@${RAG_CONFIG.host}:${RAG_CONFIG.port}`);
      console.error('🧠 Model:', RAG_CONFIG.modelName);
    }

    // Create server instance using factory
    const server = MCPServerFactory.createServer(SERVER_CONFIG);
    
    // Initialize RAG service
    const ragService = new RAGService(RAG_CONFIG);
    
    // Register all RAG tools
    const toolRegistry = new RAGToolRegistry(ragService);
    toolRegistry.registerAllTools(server);
    
    if (config.verbose) {
      console.error(`📦 Registered ${server.getTools().length} tools:`);
      server.getTools().forEach(tool => {
        console.error(`   - ${tool.name}: ${tool.description}`);
      });
    }
    
    // Start server with appropriate transport
    await server.start({
      transportType: config.transport,
      port: config.port,
      host: config.host
    });
    
    if (config.transport === 'http') {
      console.error(`✅ HTTP MCP server ready at http://${config.host}:${config.port}`);
      console.error('📚 Use this endpoint for ChatGPT Developer Mode integration');
    } else if (config.transport === 'sse') {
      console.error(`✅ SSE MCP server ready at http://${config.host}:${config.port}`);
      console.error('🔄 Server-Sent Events endpoint available for streaming');
    } else {
      console.error('✅ STDIO MCP server ready');
      console.error('💬 Server ready for MCP client connections (Claude Desktop, etc.)');
    }
    
  } catch (error) {
    console.error('❌ Failed to start server:', error.message);
    if (config.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();
