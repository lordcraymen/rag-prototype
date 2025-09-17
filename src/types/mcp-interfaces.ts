// MCP Server Abstraction Layer - Austauschbare Implementierungen
import { z } from 'zod';

/**
 * MCP Tool Configuration mit Zod Schema
 */
export interface MCPTool<TInput = any, TOutput = any> {
    name: string;
    description: string;
    inputSchema: z.ZodSchema<TInput>;
    handler: (args: TInput) => Promise<TOutput>;
}

/**
 * MCP Server Transport Types
 */
export type MCPTransport = 'stdio' | 'http' | 'sse' | 'websocket';

/**
 * MCP Server Configuration
 */
export interface MCPServerConfig {
    name: string;
    version: string;
    transport: MCPTransport;
    port?: number;
    host?: string;
    verbose?: boolean;
}

/**
 * MCP Server Status
 */
export interface MCPServerStatus {
    running: boolean;
    transport: MCPTransport;
    toolCount: number;
    startTime?: Date;
    errors?: string[];
}

/**
 * Abstract MCP Server Interface
 * Ermöglicht verschiedene Implementierungen (FastMCP, native MCP, etc.)
 */
export abstract class MCPServer {
    protected config: MCPServerConfig;
    protected tools: Map<string, MCPTool> = new Map();
    protected isRunning = false;
    protected startTime?: Date;

    constructor(config: MCPServerConfig) {
        this.config = config;
    }

    /**
     * Tool mit Zod Schema registrieren
     */
    addTool<TInput, TOutput>(tool: MCPTool<TInput, TOutput>): void {
        this.tools.set(tool.name, tool);
        this.onToolAdded(tool);
    }

    /**
     * Mehrere Tools auf einmal registrieren
     */
    addTools(tools: MCPTool[]): void {
        tools.forEach(tool => this.addTool(tool));
    }

    /**
     * Tool entfernen
     */
    removeTool(name: string): boolean {
        const removed = this.tools.delete(name);
        if (removed) {
            this.onToolRemoved(name);
        }
        return removed;
    }

    /**
     * Tool abrufen
     */
    getTool(name: string): MCPTool | undefined {
        return this.tools.get(name);
    }

    /**
     * Alle Tools abrufen
     */
    getTools(): MCPTool[] {
        return Array.from(this.tools.values());
    }

    /**
     * Tool aufrufen mit automatischer Validierung
     */
    async callTool(name: string, args: any): Promise<any> {
        const tool = this.tools.get(name);
        if (!tool) {
            throw new Error(`Tool '${name}' not found`);
        }

        try {
            // Zod Schema Validierung
            const validatedArgs = tool.inputSchema.parse(args);
            
            // Tool Handler aufrufen
            const result = await tool.handler(validatedArgs);
            
            return {
                success: true,
                result,
                tool: name
            };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                tool: name
            };
        }
    }

    /**
     * Server Status abrufen
     */
    getStatus(): MCPServerStatus {
        return {
            running: this.isRunning,
            transport: this.config.transport,
            toolCount: this.tools.size,
            startTime: this.startTime
        };
    }

    // Abstract methods - müssen von Implementierungen überschrieben werden
    abstract start(): Promise<void>;
    abstract stop(): Promise<void>;
    abstract initialize(): Promise<void>;

    // Hook methods - können von Implementierungen überschrieben werden
    protected onToolAdded(tool: MCPTool): void {
        // Override in implementation
    }

    protected onToolRemoved(name: string): void {
        // Override in implementation
    }

    protected onServerStarted(): void {
        this.isRunning = true;
        this.startTime = new Date();
    }

    protected onServerStopped(): void {
        this.isRunning = false;
        this.startTime = undefined;
    }
}

/**
 * MCP Server Factory Interface
 */
export interface MCPServerFactory {
    createServer(config: MCPServerConfig): MCPServer;
    getSupportedTransports(): MCPTransport[];
}