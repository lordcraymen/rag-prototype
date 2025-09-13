import { FastMCP } from 'fastmcp';

/**
 * MCP Server Factory
 * Abstracts the underlying MCP framework and provides a unified interface
 */
export class MCPServerFactory {
  
  /**
   * Create a new MCP server instance
   * @param {Object} config - Server configuration
   * @param {string} config.name - Server name
   * @param {string} config.version - Server version  
   * @param {string} config.description - Server description
   * @param {string} config.framework - Framework to use ('fastmcp' for now, extensible)
   * @returns {MCPServer} Server instance
   */
  static createServer(config = {}) {
    const {
      name = 'MCP Server',
      version = '1.0.0',
      description = 'A Model Context Protocol server',
      framework = 'fastmcp'
    } = config;

    switch (framework.toLowerCase()) {
      case 'fastmcp':
        return new FastMCPServerWrapper({ name, version, description });
      default:
        throw new Error(`Unknown MCP framework: ${framework}`);
    }
  }
}

/**
 * FastMCP Server Wrapper
 * Wraps FastMCP with a common interface
 */
class FastMCPServerWrapper {
  constructor(config) {
    this.server = new FastMCP(config);
    this.tools = new Map();
  }

  /**
   * Add a tool to the server
   * @param {Object} toolConfig - Tool configuration
   * @param {string} toolConfig.name - Tool name
   * @param {string} toolConfig.description - Tool description
   * @param {Object} toolConfig.parameters - Zod schema for parameters
   * @param {Function} toolConfig.execute - Tool execution function
   */
  addTool(toolConfig) {
    const { name, description, parameters, execute } = toolConfig;
    
    this.tools.set(name, toolConfig);
    
    this.server.addTool({
      name,
      description,
      parameters,
      execute
    });
  }

  /**
   * Start the server
   * @param {Object} options - Start options
   * @param {string} options.transportType - Transport type ('stdio', 'sse', 'http')
   * @param {number} options.port - Port for network transports
   * @param {string} options.host - Host for network transports
   */
  async start(options = {}) {
    const { transportType = 'stdio', port, host } = options;
    
    console.error(`Starting MCP server with ${transportType} transport...`);
    
    try {
      await this.server.start({
        transportType,
        port,
        host
      });
      console.error(`MCP server started successfully on ${transportType}`);
    } catch (error) {
      console.error(`Failed to start MCP server: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get all registered tools
   */
  getTools() {
    return Array.from(this.tools.values());
  }

  /**
   * Get a specific tool by name
   */
  getTool(name) {
    return this.tools.get(name);
  }

  /**
   * Remove a tool
   */
  removeTool(name) {
    this.tools.delete(name);
    // Note: FastMCP doesn't provide a removeTool method, 
    // this is for completeness of the interface
  }

  /**
   * Get server stats
   */
  getStats() {
    return {
      framework: 'fastmcp',
      toolCount: this.tools.size,
      tools: Array.from(this.tools.keys())
    };
  }
}
