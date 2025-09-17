// MCP Server Factory - Austauschbare Implementierungen
import { MCPServer, type MCPServerConfig, type MCPServerFactory, type MCPTransport } from '@/types/mcp-interfaces.js';
import { StdioMCPServer } from './implementations/StdioMCPServer.js';
import { FastMCPServer } from './implementations/FastMCPServer.js';

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
                // Standardmäßig FastMCP für stdio verwenden
                return new FastMCPServer(config);
            
            case 'http':
                return new FastMCPServer(config);
            
            case 'sse':
                throw new Error('SSE transport not supported. Use http transport with FastMCP.');
            
            case 'websocket':
                throw new Error('WebSocket transport not yet implemented. Use stdio or http transport.');
            
            default:
                throw new Error(`Unsupported transport type: ${config.transport}`);
        }
    }

    /**
     * Unterstützte Transports abrufen
     */
    getSupportedTransports(): MCPTransport[] {
        return ['stdio', 'http']; // FastMCP unterstützt stdio und httpStream
    }
}

/**
 * Alternative Factory für stdio-only mit StdioMCPServer
 */
export class StdioMCPServerFactory implements MCPServerFactory {
    
    createServer(config: MCPServerConfig): MCPServer {
        if (config.transport !== 'stdio') {
            throw new Error('StdioMCPServerFactory only supports stdio transport');
        }
        return new StdioMCPServer(config);
    }

    getSupportedTransports(): MCPTransport[] {
        return ['stdio'];
    }
}

/**
 * Globale Factory Instance (jetzt mit FastMCP als Standard)
 */
export const mcpServerFactory = new DefaultMCPServerFactory();

/**
 * Convenience Function für Server-Erstellung
 */
export function createMCPServer(config: MCPServerConfig): MCPServer {
    return mcpServerFactory.createServer(config);
}

/**
 * Server mit Standard-Konfiguration erstellen (jetzt mit FastMCP)
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
 * Server mit stdio-only StdioMCPServer erstellen
 */
export function createStdioOnlyMCPServer(name: string, version = '1.0.0'): MCPServer {
    const factory = new StdioMCPServerFactory();
    return factory.createServer({
        name,
        version,
        transport: 'stdio',
        verbose: process.env.DEBUG === 'true'
    });
}

/**
 * Server mit HTTP-Konfiguration erstellen (FastMCP)
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