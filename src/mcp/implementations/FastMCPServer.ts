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
        
        this.fastMCP = new FastMCP(config.name, {
            version: config.version
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
                    await this.startStdio();
                    break;
                case 'http':
                    await this.startHttp();
                    break;
                case 'sse':
                    await this.startSSE();
                    break;
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
            
            // FastMCP hat keine explizite stop() Methode
            // Der Server wird durch Prozess-Exit beendet
            
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
            // Zod Schema zu JSON Schema konvertieren
            const jsonSchema = zodToJsonSchema(tool.inputSchema);
            
            console.error(`📝 Registering tool: ${tool.name}`);
            
            // Tool bei FastMCP registrieren
            this.fastMCP.addTool({
                name: tool.name,
                description: tool.description,
                inputSchema: jsonSchema,
                handler: async (args: any) => {
                    return await this.callTool(tool.name, args);
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
     * Stdio Transport starten
     */
    private async startStdio(): Promise<void> {
        const transport = this.config.verbose ? 'stdio-verbose' : 'stdio';
        await this.fastMCP.connect({ transport });
    }

    /**
     * HTTP Transport starten
     */
    private async startHttp(): Promise<void> {
        const port = this.config.port || 3000;
        const host = this.config.host || 'localhost';
        
        await this.fastMCP.connect({ 
            transport: 'httpStream',
            httpStreamConfig: {
                port,
                host
            }
        });
    }

    /**
     * SSE Transport starten
     */
    private async startSSE(): Promise<void> {
        const port = this.config.port || 3001;
        const host = this.config.host || 'localhost';
        
        await this.fastMCP.connect({ 
            transport: 'sse',
            sseConfig: {
                port,
                host
            }
        });
    }

    /**
     * FastMCP Instance abrufen (für erweiterte Nutzung)
     */
    getFastMCP(): FastMCP {
        return this.fastMCP;
    }
}