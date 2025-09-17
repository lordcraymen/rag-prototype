// FastMCP Server Implementation
import { FastMCP } from 'fastmcp';
import { MCPServer, type MCPServerConfig, type MCPTool } from '@/types/mcp-interfaces.js';
import { zodToJsonSchema } from '@/mcp/tool-builder.js';

/**
 * FastMCP Server Implementation
 * Konkrete Implementierung des abstrakten MCP Servers mit FastMCP
 */
export class FastMCPServer extends MCPServer {
    private fastMCP: FastMCP;
    private initialized = false;

    constructor(config: MCPServerConfig) {
        super(config);
        
        // FastMCP constructor mit korrektem ServerOptions
        this.fastMCP = new FastMCP({
            name: config.name,
            version: config.version as `${number}.${number}.${number}`
        });
    }

    /**
     * Server initialisieren
     */
    async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            console.error(`🚀 Initializing FastMCP Server: ${this.config.name}`);
            console.error(`📋 Transport: ${this.config.transport}`);
            
            this.initialized = true;
            console.error('✅ FastMCP Server initialized');
        } catch (error) {
            console.error('❌ FastMCP initialization failed:', error);
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

        try {
            console.error(`🚀 Starting FastMCP Server on ${this.config.transport}...`);

            // Transport-spezifische Konfiguration
            switch (this.config.transport) {
                case 'stdio':
                    await this.fastMCP.start({
                        transportType: 'stdio'
                    });
                    break;
                case 'http':
                    await this.fastMCP.start({
                        transportType: 'httpStream',
                        httpStream: {
                            port: this.config.port || 3000,
                            host: this.config.host || 'localhost'
                        }
                    });
                    break;
                case 'sse':
                    throw new Error('SSE transport not supported by FastMCP. Use httpStream instead.');
                case 'websocket':
                    throw new Error('WebSocket transport not supported by FastMCP. Use httpStream instead.');
                default:
                    throw new Error(`Unsupported transport: ${this.config.transport}`);
            }

            this.onServerStarted();
            console.error(`✅ FastMCP Server running on ${this.config.transport}`);
            
        } catch (error) {
            console.error('❌ Failed to start FastMCP Server:', error);
            throw error;
        }
    }

    /**
     * Server stoppen
     */
    async stop(): Promise<void> {
        try {
            console.error('🛑 Stopping FastMCP Server...');
            
            await this.fastMCP.stop();
            
            this.onServerStopped();
            console.error('✅ FastMCP Server stopped');
        } catch (error) {
            console.error('❌ Error stopping FastMCP Server:', error);
            throw error;
        }
    }

    /**
     * Tool zum FastMCP Server hinzufügen
     */
    protected onToolAdded(tool: MCPTool): void {
        try {
            console.error(`📝 Registering tool: ${tool.name}`);
            
            // Tool bei FastMCP registrieren mit korrekter API
            this.fastMCP.addTool({
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema, // Zod Schema direkt verwenden
                execute: async (args: any, context: any) => {
                    const result = await this.callTool(tool.name, args);
                    
                    // FastMCP erwartet spezielle Content-Typen
                    if (typeof result === 'string') {
                        return result;
                    }
                    
                    // JSON Objekt als String zurückgeben
                    return JSON.stringify(result, null, 2);
                }
            });

            console.error(`✅ Tool registered: ${tool.name}`);
        } catch (error) {
            console.error(`❌ Failed to register tool ${tool.name}:`, error);
            throw error;
        }
    }

    /**
     * Tool vom FastMCP Server entfernen
     */
    protected onToolRemoved(name: string): void {
        // FastMCP hat keine removeTool Methode
        // Tools können nur beim Start registriert werden
        console.error(`⚠️ Tool removal not supported in FastMCP: ${name}`);
    }

    /**
     * FastMCP Instance abrufen (für erweiterte Nutzung)
     */
    getFastMCP(): FastMCP {
        return this.fastMCP;
    }
}