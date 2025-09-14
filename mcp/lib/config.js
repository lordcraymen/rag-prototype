/**
 * Configuration management for RAG MCP Server
 */

export class ConfigManager {
  /**
   * Parse command line arguments
   */
  static parseArgs(args) {
    const config = {
      transport: 'stdio',
      port: 3000,
      host: 'localhost',
      endpoint: null, // Will be set based on transport type
      help: false,
      verbose: false
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const nextArg = args[i + 1];

      switch (arg) {
        case '--transport':
        case '-t':
          if (nextArg && ['stdio', 'http', 'httpStream', 'sse'].includes(nextArg)) {
            config.transport = nextArg;
            i++; // Skip next argument
          } else {
            console.error('❌ Invalid transport type. Use: stdio, http, httpStream, or sse');
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

    // Set default endpoint based on transport type
    if (!config.endpoint) {
      switch (config.transport) {
        case 'sse':
          config.endpoint = '/sse';
          break;
        case 'httpStream':
        case 'http':
          config.endpoint = '/mcp';
          break;
        default:
          config.endpoint = '/mcp'; // fallback
      }
    }

    return config;
  }

  /**
   * Get RAG configuration from environment variables
   */
  static getRagConfig() {
    return {
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
  }

  /**
   * Get server configuration
   */
  static getServerConfig() {
    return {
      name: 'RAG Service',
      version: '1.0.0',
      description: 'A RAG service with local embeddings and vector search',
      framework: 'fastmcp'
    };
  }
}
