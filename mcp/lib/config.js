/**
 * Configuration management for RAG MCP Server
 * Provides a single entry point for both server and RAG settings.
 */

// Default configuration values for the entire system
const DEFAULT_CONFIG = {
  server: {
    name: 'RAG Service',
    version: '1.0.0',
    description: 'A RAG service with local embeddings and vector search',
    framework: 'fastmcp'
  },
  rag: {
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
  }
};

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
   * Return consolidated configuration with environment overrides.
   * Environment variables take precedence over defaults.
   */
  static getConfig() {
    const server = {
      ...DEFAULT_CONFIG.server,
      name: process.env.MCP_SERVER_NAME || DEFAULT_CONFIG.server.name,
      version: process.env.MCP_SERVER_VERSION || DEFAULT_CONFIG.server.version,
      description:
        process.env.MCP_SERVER_DESCRIPTION || DEFAULT_CONFIG.server.description,
      framework: process.env.MCP_SERVER_FRAMEWORK || DEFAULT_CONFIG.server.framework
    };

    const rag = {
      ...DEFAULT_CONFIG.rag,
      host: process.env.RAG_DB_HOST || DEFAULT_CONFIG.rag.host,
      port: parseInt(process.env.RAG_DB_PORT) || DEFAULT_CONFIG.rag.port,
      database: process.env.RAG_DB_NAME || DEFAULT_CONFIG.rag.database,
      user: process.env.RAG_DB_USER || DEFAULT_CONFIG.rag.user,
      password: process.env.RAG_DB_PASSWORD || DEFAULT_CONFIG.rag.password,
      modelName: process.env.RAG_MODEL_NAME || DEFAULT_CONFIG.rag.modelName,
      generatorConfig: { ...DEFAULT_CONFIG.rag.generatorConfig }
    };

    return { server, rag };
  }

  /**
   * Convenience helper for obtaining only the server configuration
   */
  static getServerConfig() {
    return this.getConfig().server;
  }

  /**
   * Convenience helper for obtaining only the RAG configuration
   */
  static getRagConfig() {
    return this.getConfig().rag;
  }
}
