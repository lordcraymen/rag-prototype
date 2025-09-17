#!/usr/bin/env tsx
// TypeScript MCP Server - Direkte Ausführung mit lokalen Xenova Embeddings (kein API Key!)

import { PostgreSQLXenovaConnector } from '@/connectors/postgresql/PostgreSQLXenovaConnector.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createReadStream } from 'fs';
import fetch from 'node-fetch';

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

// Global connector instance
let connector: PostgreSQLXenovaConnector | null = null;

async function initializeConnector(): Promise<PostgreSQLXenovaConnector> {
    if (connector) {
        return connector;
    }

    const config = loadConfig();
    
    // No API key needed for local Xenova embeddings! 🎉
    connector = new PostgreSQLXenovaConnector(config.database, config.embedding.model);
    await connector.connect();
    await connector.initializeDatabase();
    
    console.error('✅ TypeScript RAG connector with local embeddings initialized (no API key required!)');
    return connector;
}

// MCP Tool Definitions mit TypeScript Types
interface AddDocumentArgs {
    content: string;
    title?: string;
    metadata?: Record<string, any>;
}

interface QueryDocumentsArgs {
    query: string;
    limit?: number;
    threshold?: number;
    useHybrid?: boolean;
    bm25Weight?: number;
    vectorWeight?: number;
}

interface ImportFromCSVArgs {
    filePath: string;
    delimiter?: string;
    encoding?: string;
    validateText?: boolean;
}

interface AddDocumentFromUrlArgs {
    url: string;
    title?: string;
    metadata?: Record<string, any>;
}

interface RemoveDocumentArgs {
    id: string;
}

// Tool Handlers mit Type Safety
async function handleAddDocument(args: AddDocumentArgs) {
    const conn = await initializeConnector();
    
    const document = {
        content: args.content,
        title: args.title,
        metadata: args.metadata
    };
    
    const id = await conn.addDocument(document);
    
    return {
        success: true,
        message: `Document added successfully with ID: ${id}`,
        id: id
    };
}

async function handleQueryDocuments(args: QueryDocumentsArgs) {
    const conn = await initializeConnector();
    
    const results = await conn.search({
        query: args.query,
        limit: args.limit || 5,
        threshold: args.threshold || 0.05,
        useHybrid: args.useHybrid !== false,
        bm25Weight: args.bm25Weight || 0.3,
        vectorWeight: args.vectorWeight || 0.7
    });
    
    return {
        success: true,
        results: results,
        count: results.length,
        query: args.query,
        searchType: args.useHybrid !== false ? 'hybrid' : 'vector'
    };
}

async function handleImportFromCSV(args: ImportFromCSVArgs) {
    const conn = await initializeConnector();
    
    const result = await conn.importFromCSV(args.filePath, {
        delimiter: args.delimiter || ',',
        encoding: args.encoding || 'utf8',
        validateText: args.validateText !== false,
        skipEmptyLines: true
    });
    
    return result;
}

async function handleAddDocumentFromUrl(args: AddDocumentFromUrlArgs) {
    const conn = await initializeConnector();
    
    try {
        console.error(`Fetching content from: ${args.url}`);
        const response = await fetch(args.url);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const content = await response.text();
        
        const document = {
            content: content,
            title: args.title || `Content from ${args.url}`,
            metadata: {
                ...args.metadata,
                source_url: args.url,
                fetched_at: new Date().toISOString(),
                content_type: response.headers.get('content-type') || 'unknown'
            }
        };
        
        const id = await conn.addDocument(document);
        
        return {
            success: true,
            message: `Document from URL added successfully with ID: ${id}`,
            id: id,
            url: args.url,
            contentLength: content.length
        };
        
    } catch (error) {
        return {
            success: false,
            error: `Failed to fetch URL: ${error instanceof Error ? error.message : 'Unknown error'}`,
            url: args.url
        };
    }
}

async function handleGetRagStatus() {
    try {
        const conn = await initializeConnector();
        const status = await conn.getStatus();
        const count = await conn.getDocumentCount();
        
        return {
            success: true,
            status: 'connected',
            connected: status.connected,
            database: status.database,
            host: status.host,
            documentCount: count,
            architecture: 'typescript',
            runtime: 'tsx-inline',
            embedding: 'xenova-local'
        };
    } catch (error) {
        return {
            success: false,
            status: 'error',
            connected: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            architecture: 'typescript',
            runtime: 'tsx-inline',
            embedding: 'xenova-local'
        };
    }
}

async function handleListDocuments() {
    const conn = await initializeConnector();
    
    // Get basic document list (ohne full content für Performance)
    const rows = await conn.rawQuery(`
        SELECT id, title, 
               LEFT(content, 100) as content_preview,
               metadata,
               created_at, updated_at
        FROM documents 
        ORDER BY created_at DESC
        LIMIT 100
    `);
    
    return {
        success: true,
        documents: rows.map((row: any) => ({
            id: row.id,
            title: row.title,
            contentPreview: row.content_preview + (row.content_preview.length >= 100 ? '...' : ''),
            metadata: row.metadata || {},
            createdAt: row.created_at,
            updatedAt: row.updated_at
        })),
        count: rows.length
    };
}

async function handleRemoveDocument(args: RemoveDocumentArgs) {
    const conn = await initializeConnector();
    
    await conn.deleteDocument(args.id);
    
    return {
        success: true,
        message: `Document ${args.id} removed successfully`
    };
}

// MCP Tools Definition
const tools = [
    {
        name: "add_document",
        description: "Add a document to the RAG knowledge base",
        inputSchema: {
            type: "object",
            properties: {
                content: {
                    type: "string",
                    description: "The document content to add"
                },
                title: {
                    type: "string",
                    description: "Optional document title"
                },
                metadata: {
                    type: "object",
                    description: "Optional metadata for the document"
                }
            },
            required: ["content"]
        }
    },
    {
        name: "query_documents",
        description: "Search and retrieve relevant documents from the RAG knowledge base using hybrid BM25 + embedding search",
        inputSchema: {
            type: "object",
            properties: {
                query: {
                    type: "string",
                    description: "The search query"
                },
                limit: {
                    type: "number",
                    description: "Maximum number of results to return (default: 5)"
                },
                threshold: {
                    type: "number",
                    description: "Similarity threshold (0-1, default: 0.05)"
                },
                useHybrid: {
                    type: "boolean",
                    description: "Use hybrid BM25+vector search (default: true)"
                },
                bm25Weight: {
                    type: "number",
                    description: "Weight for BM25 score (0-1, default: 0.3)"
                },
                vectorWeight: {
                    type: "number",
                    description: "Weight for vector similarity (0-1, default: 0.7)"
                }
            },
            required: ["query"]
        }
    },
    {
        name: "add_document_from_url",
        description: "Fetch content from URLs and add to knowledge base",
        inputSchema: {
            type: "object",
            properties: {
                url: {
                    type: "string",
                    description: "URL to fetch content from"
                },
                title: {
                    type: "string",
                    description: "Optional title override"
                },
                metadata: {
                    type: "object",
                    description: "Optional additional metadata"
                }
            },
            required: ["url"]
        }
    },
    {
        name: "import_from_csv",
        description: "Import documents from CSV file",
        inputSchema: {
            type: "object",
            properties: {
                filePath: {
                    type: "string",
                    description: "Path to the CSV file"
                },
                delimiter: {
                    type: "string",
                    description: "CSV delimiter (default: ',')"
                },
                encoding: {
                    type: "string",
                    description: "File encoding (default: 'utf8')"
                },
                validateText: {
                    type: "boolean",
                    description: "Validate text fields (default: true)"
                }
            },
            required: ["filePath"]
        }
    },
    {
        name: "get_rag_status",
        description: "Get the current status of the RAG service",
        inputSchema: {
            type: "object",
            properties: {},
            required: []
        }
    },
    {
        name: "list_documents",
        description: "List all documents in the RAG knowledge base",
        inputSchema: {
            type: "object",
            properties: {},
            required: []
        }
    },
    {
        name: "remove_document",
        description: "Remove a document from the RAG knowledge base",
        inputSchema: {
            type: "object",
            properties: {
                id: {
                    type: "string",
                    description: "The document ID to remove"
                }
            },
            required: ["id"]
        }
    }
];

// Main tool handler mit Type Safety
async function handleTool(name: string, args: any) {
    try {
        switch (name) {
            case 'add_document':
                return await handleAddDocument(args as AddDocumentArgs);
            case 'query_documents':
                return await handleQueryDocuments(args as QueryDocumentsArgs);
            case 'add_document_from_url':
                return await handleAddDocumentFromUrl(args as AddDocumentFromUrlArgs);
            case 'import_from_csv':
                return await handleImportFromCSV(args as ImportFromCSVArgs);
            case 'get_rag_status':
                return await handleGetRagStatus();
            case 'list_documents':
                return await handleListDocuments();
            case 'remove_document':
                return await handleRemoveDocument(args as RemoveDocumentArgs);
            default:
                throw new Error(`Unknown tool: ${name}`);
        }
    } catch (error) {
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            tool: name
        };
    }
}

// Export für MCP server integration
export {
    tools,
    handleTool,
    initializeConnector
};

// CLI Support für direkte Ausführung

    console.error('🚀 TypeScript RAG MCP Server starting...');
    console.error('📋 Available tools:', tools.map(t => t.name).join(', '));

    // Hier könnte die eigentliche MCP Server Logic stehen
    // Für jetzt zeigen wir nur den Status
    handleGetRagStatus().then(status => {
        console.error('📊 RAG Status:', status);
    }).catch(error => {
        console.error('❌ Error:', error);
    });
