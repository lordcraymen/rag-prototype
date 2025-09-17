/**
 * Server utilities and logging helpers
 */

export class ServerUtils {
  /**
   * Show success message based on transport type
   */
  static showSuccessMessage(config) {
    const endpointUrl = `http://${config.host}:${config.port}${config.endpoint}`;
    
    if (config.transport === 'httpStream') {
      console.error(`✅ HTTP Streaming MCP server ready at ${endpointUrl}`);
      console.error('📚 Use this endpoint for ChatGPT Developer Mode integration');
      console.error('💡 For external access, use: ngrok http 3000');
    } else if (config.transport === 'http') {
      console.error(`✅ HTTP MCP server ready at ${endpointUrl} (using httpStream)`);
      console.error('📚 Use this endpoint for ChatGPT Developer Mode integration');
      console.error('💡 For external access, use: ngrok http 3000');
    } else if (config.transport === 'sse') {
      console.error(`✅ SSE MCP server ready at ${endpointUrl}`);
      console.error('🔄 Server-Sent Events endpoint available for streaming');
    } else {
      console.error('✅ STDIO MCP server ready');
      console.error('💬 Server ready for MCP client connections (Claude Desktop, etc.)');
    }
  }

  /**
   * Show verbose configuration information
   */
  static showVerboseInfo(config, ragConfig, server) {
    console.error('🔧 Configuration:', config);
    console.error('🗄️  Database:', `${ragConfig.database}@${ragConfig.host}:${ragConfig.port}`);
    console.error('🧠 Model:', ragConfig.modelName);
    console.error(`📦 Registered ${server.getTools().length} tools:`);
    server.getTools().forEach(tool => {
      console.error(`   - ${tool.name}: ${tool.description}`);
    });
  }

  /**
   * Setup server transport optimizations
   */
  static setupTransport(config) {
    // Prevent FastMCP from reading stdin when in HTTP/SSE mode
    if (config.transport !== 'stdio') {
      process.stdin.pause();
    }
  }

  /**
   * Show startup banner
   */
  static showStartupBanner(config) {
    console.error('🚀 Starting RAG MCP Server...');
    console.error(`📡 Transport: ${config.transport.toUpperCase()}`);
    
    if (config.transport !== 'stdio') {
      console.error(`🌐 Address: ${config.host}:${config.port}`);
    }
  }
}
