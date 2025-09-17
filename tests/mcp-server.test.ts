import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DefaultMCPServerFactory, StdioMCPServerFactory } from '../src/mcp/server-factory';
import { MCPServerConfig } from '../src/types/mcp-interfaces';

// Mock the implementations
vi.mock('../src/mcp/implementations/FastMCPServer', () => ({
  FastMCPServer: vi.fn().mockImplementation((config) => ({
    config: config,
    tools: new Map(),
    isRunning: false,
    initialize: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    addTool: vi.fn(),
    callTool: vi.fn().mockResolvedValue({ success: true }),
    getTools: vi.fn().mockReturnValue([])
  }))
}));

vi.mock('../src/mcp/implementations/StdioMCPServer', () => ({
  StdioMCPServer: vi.fn().mockImplementation((config) => ({
    config: config,
    tools: new Map(),
    isRunning: false,
    initialize: vi.fn().mockResolvedValue(undefined),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn().mockResolvedValue(undefined),
    addTool: vi.fn(),
    callTool: vi.fn().mockResolvedValue({ success: true }),
    getTools: vi.fn().mockReturnValue([])
  }))
}));

describe('MCP Server Factory Unit Tests', () => {
  let defaultFactory: DefaultMCPServerFactory;
  let stdioFactory: StdioMCPServerFactory;

  beforeEach(() => {
    vi.clearAllMocks();
    defaultFactory = new DefaultMCPServerFactory();
    stdioFactory = new StdioMCPServerFactory();
  });

  describe('DefaultMCPServerFactory', () => {
    it('should create FastMCP server for stdio transport', () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        version: '1.0.0',
        transport: 'stdio',
        verbose: false
      };

      const server = defaultFactory.createServer(config);
      expect(server).toBeDefined();
      expect(server.config).toEqual(config);
    });

    it('should create FastMCP server for http transport', () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        version: '1.0.0',
        transport: 'http',
        port: 3000,
        host: 'localhost'
      };

      const server = defaultFactory.createServer(config);
      expect(server).toBeDefined();
    });

    it('should throw error for unsupported transports', () => {
      const config: MCPServerConfig = {
        name: 'test-server',
        version: '1.0.0',
        transport: 'websocket' as any
      };

      expect(() => defaultFactory.createServer(config))
        .toThrow('WebSocket transport not yet implemented');
    });

    it('should return correct supported transports', () => {
      const transports = defaultFactory.getSupportedTransports();
      expect(transports).toEqual(['stdio', 'http']);
    });
  });

  describe('StdioMCPServerFactory', () => {
    it('should create StdioMCP server for stdio transport', () => {
      const config: MCPServerConfig = {
        name: 'stdio-server',
        version: '1.0.0',
        transport: 'stdio'
      };

      const server = stdioFactory.createServer(config);
      expect(server).toBeDefined();
    });

    it('should throw error for non-stdio transports', () => {
      const config: MCPServerConfig = {
        name: 'http-server',
        version: '1.0.0',
        transport: 'http'
      };

      expect(() => stdioFactory.createServer(config))
        .toThrow('StdioMCPServerFactory only supports stdio transport');
    });

    it('should return correct supported transports', () => {
      const transports = stdioFactory.getSupportedTransports();
      expect(transports).toEqual(['stdio']);
    });
  });

  describe('Server Lifecycle', () => {
    it('should initialize server correctly', async () => {
      const config: MCPServerConfig = {
        name: 'lifecycle-test',
        version: '1.0.0',
        transport: 'stdio'
      };

      const server = defaultFactory.createServer(config);
      await server.initialize();

      expect(server.initialize).toHaveBeenCalled();
    });

    it('should start and stop server', async () => {
      const config: MCPServerConfig = {
        name: 'start-stop-test',
        version: '1.0.0',
        transport: 'stdio'
      };

      const server = defaultFactory.createServer(config);
      
      await server.start();
      expect(server.start).toHaveBeenCalled();
      
      await server.stop();
      expect(server.stop).toHaveBeenCalled();
    });
  });

  describe('Tool Management', () => {
    it('should add tools to server', () => {
      const config: MCPServerConfig = {
        name: 'tool-test',
        version: '1.0.0',
        transport: 'stdio'
      };

      const server = defaultFactory.createServer(config);
      const mockTool = {
        name: 'test_tool',
        description: 'Test tool',
        inputSchema: {},
        handler: vi.fn()
      };

      server.addTool(mockTool);
      expect(server.addTool).toHaveBeenCalledWith(mockTool);
    });

    it('should call tools correctly', async () => {
      const config: MCPServerConfig = {
        name: 'call-test',
        version: '1.0.0',
        transport: 'stdio'
      };

      const server = defaultFactory.createServer(config);
      const result = await server.callTool('test_tool', { param: 'value' });

      expect(server.callTool).toHaveBeenCalledWith('test_tool', { param: 'value' });
      expect(result).toEqual({ success: true });
    });
  });
});