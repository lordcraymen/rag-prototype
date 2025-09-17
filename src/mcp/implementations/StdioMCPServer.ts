// Stdio MCP Server Implementation
import { MCPServer, type MCPServerConfig, type MCPTool } from '@/types/mcp-interfaces.js';
import { zodToJsonSchema } from '@/mcp/tool-builder.js';

/**
 * Stdio MCP Server Implementation
 * Einfache Implementierung für stdio Transport ohne externe Dependencies
 */
export class StdioMCPServer extends MCPServer {
    private initialized = false;
    private messageId = 1;

    constructor(config: MCPServerConfig) {
        super(config);
    }

    /**
     * Server initialisieren
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            console.error(`🚀 Initializing Stdio MCP Server: ${this.config.name}`);
            console.error(`📋 Version: ${this.config.version}`);
            
            // Setup stdio message handlers
            this.setupStdioHandlers();
            
            this.initialized = true;
            console.error('✅ Stdio MCP Server initialized');
        } catch (error) {
            console.error('❌ Stdio MCP initialization failed:', error);
            throw error;
        }
    }

    /**
     * Server starten
     */
    async start(): Promise<void> {
        if (!this.initialized) {
            await this.initialize();
        }

        if (this.config.transport !== 'stdio') {
            throw new Error(`StdioMCPServer only supports stdio transport, got: ${this.config.transport}`);
        }

        try {
            console.error(`🚀 Starting Stdio MCP Server...`);
            console.error(`📋 Tools available: ${this.tools.size}`);
            
            this.onServerStarted();
            
            // Server läuft und wartet auf stdio input
            console.error('✅ Stdio MCP Server running - waiting for requests');
            
        } catch (error) {
            console.error('❌ Failed to start Stdio MCP Server:', error);
            throw error;
        }
    }

    /**
     * Server stoppen
     */
    async stop(): Promise<void> {
        try {
            console.error('🛑 Stopping Stdio MCP Server...');
            this.onServerStopped();
            console.error('✅ Stdio MCP Server stopped');
        } catch (error) {
            console.error('❌ Error stopping Stdio MCP Server:', error);
            throw error;
        }
    }

    /**
     * Tool hinzugefügt
     */
    protected onToolAdded(tool: MCPTool): void {
        console.error(`📝 Tool registered: ${tool.name}`);
    }

    /**
     * Tool entfernt
     */
    protected onToolRemoved(name: string): void {
        console.error(`🗑️ Tool removed: ${name}`);
    }

    /**
     * Stdio message handlers setup
     */
    private setupStdioHandlers(): void {
        // Handle stdin für MCP requests
        process.stdin.setEncoding('utf8');
        process.stdin.on('data', (data: string) => {
            this.handleMCPMessage(data.trim());
        });

        // Handle process signals
        process.on('SIGINT', () => this.handleShutdown());
        process.on('SIGTERM', () => this.handleShutdown());
    }

    /**
     * MCP Message verarbeiten
     */
    private async handleMCPMessage(message: string): Promise<void> {
        try {
            if (!message) return;

            const request = JSON.parse(message);
            console.error(`📨 Received MCP request: ${request.method}`);

            let response: any;

            switch (request.method) {
                case 'initialize':
                    response = this.handleInitialize(request);
                    break;
                
                case 'notifications/initialized':
                    // No response needed for notification
                    return;
                
                case 'tools/list':
                    response = this.handleToolsList(request);
                    break;
                
                case 'tools/call':
                    response = await this.handleToolCall(request);
                    break;
                
                default:
                    response = this.createErrorResponse(request, -32601, `Method not found: ${request.method}`);
            }

            if (response) {
                this.sendResponse(response);
            }

        } catch (error) {
            console.error('❌ Error handling MCP message:', error);
            const errorResponse = {
                jsonrpc: '2.0',
                id: null,
                error: {
                    code: -32700,
                    message: 'Parse error'
                }
            };
            this.sendResponse(errorResponse);
        }
    }

    /**
     * Initialize Request verarbeiten
     */
    private handleInitialize(request: any): any {
        return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
                protocolVersion: '2024-11-05',
                capabilities: {
                    tools: {}
                },
                serverInfo: {
                    name: this.config.name,
                    version: this.config.version
                }
            }
        };
    }

    /**
     * Tools List Request verarbeiten
     */
    private handleToolsList(request: any): any {
        const tools = this.getTools().map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: zodToJsonSchema(tool.inputSchema)
        }));

        return {
            jsonrpc: '2.0',
            id: request.id,
            result: {
                tools
            }
        };
    }

    /**
     * Tool Call Request verarbeiten
     */
    private async handleToolCall(request: any): Promise<any> {
        try {
            const { name, arguments: args } = request.params;
            const result = await this.callTool(name, args);

            return {
                jsonrpc: '2.0',
                id: request.id,
                result: {
                    content: [
                        {
                            type: 'text',
                            text: JSON.stringify(result, null, 2)
                        }
                    ]
                }
            };
        } catch (error) {
            return this.createErrorResponse(request, -32000, error instanceof Error ? error.message : 'Tool call failed');
        }
    }

    /**
     * Error Response erstellen
     */
    private createErrorResponse(request: any, code: number, message: string): any {
        return {
            jsonrpc: '2.0',
            id: request.id,
            error: {
                code,
                message
            }
        };
    }

    /**
     * Response senden
     */
    private sendResponse(response: any): void {
        const responseString = JSON.stringify(response);
        process.stdout.write(responseString + '\n');
        
        if (this.config.verbose) {
            console.error(`📤 Sent response: ${response.method || 'response'}`);
        }
    }

    /**
     * Graceful shutdown
     */
    private async handleShutdown(): Promise<void> {
        console.error('🛑 Received shutdown signal');
        await this.stop();
        process.exit(0);
    }
}