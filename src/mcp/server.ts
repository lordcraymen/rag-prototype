#!/usr/bin/env tsx
// TypeScript MCP Server with modern abstracted architecture

import { createStdioMCPServer } from '@/mcp/server-factory.js';
import { RAGTools } from '@/mcp/rag-tools.js';
import { createXenovaConnector } from '@/connectors/postgresql/factories.js';
import { PostgreSQLConnector } from '@/connectors/postgresql/PostgreSQLConnector.js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration laden
function loadConfig() {
    try {
        const configPath = join(__dirname, '..', '..', 'config.json');
        const configData = readFileSync(configPath, 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        console.error('Failed to load config.json, using environment variables');
        return {
            database: {
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '5432'),
                database: process.env.DB_NAME || 'rag',
                user: process.env.DB_USER || 'raguser',
                password: process.env.DB_PASSWORD || 'ragpassword',
                ssl: false
            },
            embedding: {
                model: process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2'
            }
        };
    }
}

// Global instances
let server: any = null;
let connector: PostgreSQLConnector | null = null;

async function initializeRagServer(): Promise<void> {
    try {
        console.error('🚀 Initializing TypeScript RAG MCP Server with abstracted architecture...');
        
        const config = loadConfig();
        
        // Create PostgreSQL Connector with local embeddings
        connector = createXenovaConnector(config.database, { model: config.embedding?.model });
        await connector.connect();
        await connector.initializeDatabase();
        
        // Create MCP Server using factory
        server = createStdioMCPServer('rag-knowledge-base', '2.0.0');
        
        // Create RAG Tools with connector
        const ragTools = new RAGTools(connector);
        const tools = ragTools.createAllTools();
        
        // Register tools with server
        server.addTools(tools);
        
        console.error(`📋 Registered ${tools.length} RAG tools:`);
        tools.forEach(tool => {
            console.error(`  - ${tool.name}: ${tool.description}`);
        });
        
        // Initialize and start server
        await server.initialize();
        await server.start();
        
        // Show status
        const status = await connector.getStatus();
        console.error('📊 RAG Server Status:', JSON.stringify(status, null, 2));
        
    } catch (error) {
        console.error('❌ Failed to initialize RAG server:', error);
        throw error;
    }
}

// Parse command line arguments
function parseArgs(): { transport: string; port?: number; verbose: boolean } {
    const args = process.argv.slice(2);
    
    let transport = 'stdio';
    let port: number | undefined;
    let verbose = false;
    
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        
        if (arg === '--transport' && args[i + 1]) {
            transport = args[i + 1];
            i++;
        } else if (arg === '--port' && args[i + 1]) {
            port = parseInt(args[i + 1]);
            i++;
        } else if (arg === '--verbose') {
            verbose = true;
        }
    }
    
    return { transport, port, verbose };
}

// Graceful shutdown
async function shutdown(): Promise<void> {
    console.error('🛑 Shutting down RAG MCP Server...');
    
    try {
        if (server) {
            await server.stop();
        }
        
        if (connector) {
            await connector.disconnect();
        }
        
        console.error('✅ RAG MCP Server shutdown complete');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
        process.exit(1);
    }
}

// Signal handlers
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
process.on('uncaughtException', (error) => {
    console.error('💥 Uncaught exception:', error);
    shutdown();
});
process.on('unhandledRejection', (reason, promise) => {
    console.error('💥 Unhandled rejection at:', promise, 'reason:', reason);
    shutdown();
});

// Main execution
async function main(): Promise<void> {
    const { transport, port, verbose } = parseArgs();
    
    if (transport !== 'stdio') {
        console.error(`⚠️ Only stdio transport is currently supported, got: ${transport}`);
        process.exit(1);
    }
    
    console.error('🚀 Starting TypeScript RAG MCP Server...');
    console.error(`📋 Transport: ${transport}`);
    console.error(`🔧 Verbose: ${verbose}`);
    
    await initializeRagServer();
}

// Run if executed directly
if (process.argv[1] && (process.argv[1].includes('server') || process.argv[1].endsWith('server.ts'))) {
    main().catch(error => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
}

export {
    initializeRagServer,
    shutdown
};