// MCP Server Factory - Austauschbare Implementierungen
import { MCPServer, type MCPServerConfig, type MCPServerFactory, type MCPTransport } from '@/types/mcp-interfaces.js';
import { StdioMCPServer } from './implementations/StdioMCPServer.js';

/**
 * Standard MCP Server Factory
 * Erstellt MCP Server Implementierungen basierend auf Transport-Typ
 */
export class DefaultMCPServerFactory implements MCPServerFactory {
    
    /**
     * MCP Server basierend auf Konfiguration erstellen
     */
    createServer(config: MCPServerConfig): MCPServer {
        switch (config.transport) {
            case 'stdio':
                return new StdioMCPServer(config);
            
            case 'http':
                throw new Error('HTTP transport not yet implemented. Use stdio transport.');
            
            case 'sse':
                throw new Error('SSE transport not yet implemented. Use stdio transport.');
            
            case 'websocket':
                throw new Error('WebSocket transport not yet implemented. Use stdio transport.');
            
            default:
                throw new Error(`Unsupported transport type: ${config.transport}`);
        }
    }

    /**
     * Unterstützte Transports abrufen
     */
    getSupportedTransports(): MCPTransport[] {
        return ['stdio']; // Erweitert sich mit mehr Implementierungen
    }
}

/**
 * Globale Factory Instance
 */
export const mcpServerFactory = new DefaultMCPServerFactory();

/**
 * Convenience Function für Server-Erstellung
 */
export function createMCPServer(config: MCPServerConfig): MCPServer {
    return mcpServerFactory.createServer(config);
}

/**
 * Server mit Standard-Konfiguration erstellen
 */
export function createStdioMCPServer(name: string, version = '1.0.0'): MCPServer {
    return createMCPServer({
        name,
        version,
        transport: 'stdio',
        verbose: process.env.DEBUG === 'true'
    });
}

/**
 * Server mit HTTP-Konfiguration erstellen
 */
export function createHttpMCPServer(
    name: string, 
    port = 3000, 
    host = 'localhost',
    version = '1.0.0'
): MCPServer {
    return createMCPServer({
        name,
        version,
        transport: 'http',
        port,
        host,
        verbose: process.env.DEBUG === 'true'
    });
}