#!/usr/bin/env node

/**
 * HTTP/SSE MCP Server für ChatGPT Developer Mode
 * Echte HTTP-Implementierung ohne FastMCP's stdio auto-detection
 */

import http from 'http';
import PostgreSQLRetriever from './retriever/postgresql-retriever.js';
import SimpleGenerator from './generator/index.js';

// Initialize RAG components
console.error('🚀 Initializing HTTP MCP Server...');
const retriever = new PostgreSQLRetriever({
  host: 'localhost',
  port: 5432,
  database: 'rag',
  user: 'raguser',
  password: 'ragpassword',
  modelName: 'Xenova/all-MiniLM-L6-v2'
});

const generator = new SimpleGenerator({
  maxResponseLength: 2000,
  includeSourceInfo: true
});

let initialized = false;

async function initializeRAG() {
  if (!initialized) {
    await retriever.initialize();
    initialized = true;
    console.error('✅ RAG components initialized');
  }
}

// MCP Tool implementations
const tools = {
  async add_document(params) {
    await initializeRAG();
    
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const document = await retriever.addDocument(docId, params.content, {
      title: params.title,
      ...params.metadata
    });

    const stats = await retriever.getStats();
    
    return {
      content: [{
        type: 'text',
        text: `✅ Document successfully added to RAG knowledge base!\n\nDetails:\n- Document ID: ${docId}\n- Title: ${params.title || 'Untitled'}\n- Content length: ${params.content.length} characters\n- Added with Xenova embeddings (${retriever.modelName})\n- Timestamp: ${document.metadata.addedAt}\n- Storage: PostgreSQL + pgvector\n\n📊 Knowledge Base Stats:\n- Total documents: ${stats.totalDocuments}\n- Average document length: ${Math.round(stats.averageDocumentLength)} characters\n- Database: ${stats.database}@${stats.host}\n- Embedding model: ${stats.modelName}`
      }]
    };
  },

  async query_documents(params) {
    await initializeRAG();
    
    const limit = params.limit || 5;
    const threshold = params.threshold || 0.05;
    const useHybrid = params.useHybrid !== false;
    const bm25Weight = params.bm25Weight || 0.3;
    const vectorWeight = params.vectorWeight || 0.7;
    
    let documents;
    if (useHybrid) {
      documents = await retriever.hybridSearch(params.query, limit, threshold, bm25Weight, vectorWeight);
    } else {
      documents = await retriever.search(params.query, limit, threshold);
    }

    if (documents.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `🔍 No documents found matching "${params.query}" in the knowledge base.\n\nThe system searched through all documents using ${useHybrid ? 'hybrid BM25+vector' : 'vector'} search with Xenova embeddings but found no relevant content.`
        }]
      };
    }

    const result = await generator.generate(params.query, documents);
    
    let responseText = `🔍 **Query:** "${params.query}"\n`;
    responseText += `🔬 **Search Type:** ${useHybrid ? `Hybrid Search (BM25: ${Math.round(bm25Weight*100)}%, Vector: ${Math.round(vectorWeight*100)}%)` : 'Vector Search Only'}\n\n`;
    responseText += `**Generated Response:**\n${result.response}\n\n`;
    
    if (result.sources && result.sources.length > 0) {
      responseText += `**Sources Used:**\n`;
      result.sources.forEach((source, idx) => {
        responseText += `${idx + 1}. **${source.title}** (${(source.similarity * 100).toFixed(1)}% relevance)\n`;
        responseText += `   ${source.excerpt}\n\n`;
      });
    }

    return {
      content: [{
        type: 'text',
        text: responseText
      }]
    };
  },

  async get_rag_status() {
    await initializeRAG();
    
    const stats = await retriever.getStats();
    const allDocs = await retriever.getAllDocuments();
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          status: 'operational',
          service: 'RAG HTTP MCP Server',
          version: '1.0.0',
          transport: 'http',
          components: {
            embeddings: `Xenova Transformers (${stats.modelName})`,
            vectordb: `PostgreSQL + pgvector (${stats.host}:${stats.database})`,
            retriever: 'PostgreSQLRetriever - ready',
            generator: 'SimpleGenerator - ready'
          },
          statistics: {
            ...stats,
            documents: allDocs.length > 0 ? allDocs.map(doc => ({
              id: doc.id,
              title: doc.metadata?.title || 'Untitled',
              contentLength: doc.content.length,
              addedAt: doc.metadata.addedAt
            })) : []
          }
        }, null, 2)
      }]
    };
  },

  async list_documents() {
    await initializeRAG();
    
    const documents = await retriever.getAllDocuments();
    const stats = await retriever.getStats();
    
    if (documents.length === 0) {
      return {
        content: [{
          type: 'text',
          text: '📚 No documents in the knowledge base yet.\n\nUse the add_document tool to add some content!'
        }]
      };
    }

    let response = `📚 **Knowledge Base Contents** (${documents.length} documents)\n\n`;
    
    documents.forEach((doc, index) => {
      response += `**${index + 1}. ${doc.metadata?.title || doc.id}**\n`;
      response += `   - ID: ${doc.id}\n`;
      response += `   - Length: ${doc.content.length} characters\n`;
      response += `   - Added: ${doc.metadata.addedAt}\n`;
      response += `   - Preview: ${doc.content.substring(0, 100)}${doc.content.length > 100 ? '...' : ''}\n\n`;
    });

    response += `**Statistics:**\n- Total documents: ${stats.totalDocuments}\n- Average length: ${Math.round(stats.averageDocumentLength)} characters\n- Embedding model: ${stats.modelName}`;

    return {
      content: [{
        type: 'text',
        text: response
      }]
    };
  }
};

// Handle MCP requests
async function handleMCPRequest(body) {
  try {
    const request = JSON.parse(body);
    
    if (request.method === 'tools/call') {
      const toolName = request.params?.name;
      const toolArgs = request.params?.arguments || {};
      
      if (tools[toolName]) {
        const result = await tools[toolName](toolArgs);
        
        return {
          jsonrpc: "2.0",
          id: request.id,
          result
        };
      } else {
        return {
          jsonrpc: "2.0",
          id: request.id,
          error: {
            code: -32601,
            message: `Unknown tool: ${toolName}`,
            data: { available_tools: Object.keys(tools) }
          }
        };
      }
    }
    
    if (request.method === 'tools/list') {
      return {
        jsonrpc: "2.0",
        id: request.id,
        result: {
          tools: Object.keys(tools).map(name => ({
            name,
            description: `RAG tool: ${name}`,
            inputSchema: {
              type: "object",
              properties: {},
              required: []
            }
          }))
        }
      };
    }
    
    return {
      jsonrpc: "2.0",
      id: request.id,
      error: {
        code: -32601,
        message: "Method not found",
        data: { method: request.method }
      }
    };
    
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id: null,
      error: {
        code: -32700,
        message: "Parse error",
        data: { error: error.message }
      }
    };
  }
}

// Create HTTP server
const port = process.argv[2] || 3000;
const server = http.createServer(async (req, res) => {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  if (req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      service: 'RAG MCP Server',
      version: '1.0.0',
      transport: 'http',
      port: port,
      status: 'operational',
      available_tools: Object.keys(tools),
      endpoints: {
        tools: 'POST / (JSON-RPC 2.0)',
        status: 'GET /'
      },
      description: 'HTTP-based MCP server for ChatGPT Developer Mode with RAG capabilities'
    }, null, 2));
    return;
  }
  
  if (req.method === 'POST') {
    let body = '';
    
    req.on('data', chunk => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        const response = await handleMCPRequest(body);
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(response, null, 2));
      } catch (error) {
        console.error('Error handling request:', error);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          jsonrpc: "2.0",
          id: null,
          error: {
            code: -32603,
            message: "Internal error",
            data: { error: error.message }
          }
        }));
      }
    });
    
    return;
  }
  
  res.writeHead(405, { 'Content-Type': 'text/plain' });
  res.end('Method Not Allowed');
});

server.listen(port, () => {
  console.error(`✅ RAG MCP HTTP Server running on http://localhost:${port}`);
  console.error(`📋 Available tools: ${Object.keys(tools).join(', ')}`);
  console.error(`🔗 For ChatGPT Developer Mode: http://localhost:${port}`);
  console.error('');
  console.error(`💡 Test with: curl http://localhost:${port}`);
  console.error(`📡 Server ready for ChatGPT Developer Mode integration!`);
});

process.on('SIGINT', () => {
  console.error('\n🛑 Shutting down server...');
  server.close();
  process.exit(0);
});
