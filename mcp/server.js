import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import PostgreSQLRetriever from '../retriever/postgresql-retriever.js';
import SimpleGenerator from '../generator/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname); // Go one level up from mcp/ to project root

// Initialize RAG components
console.error('Initializing PostgreSQL RAG components...');
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

// Initialize retriever (async)
let initializationPromise = null;
const initializeRetriever = async () => {
  if (!initializationPromise) {
    initializationPromise = retriever.initialize();
  }
  return initializationPromise;
};

const server = new FastMCP({
  name: 'RAG Service',
  version: '1.0.0',
  description: 'A RAG service with local embeddings and vector search'
});

// Add a tool to add documents to the RAG system
server.addTool({
  name: 'add_document',
  description: 'Add a document to the RAG knowledge base',
  parameters: z.object({
    content: z.string().describe('The document content to add'),
    title: z.string().optional().describe('Optional document title'),
    metadata: z.record(z.any()).optional().describe('Optional metadata for the document')
  }),
  execute: async (params) => {
    try {
      // Ensure retriever is initialized
      await initializeRetriever();
      
      // Generate unique document ID
      const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Add document to retriever
      const document = await retriever.addDocument(docId, params.content, {
        title: params.title,
        ...params.metadata
      });

      console.error('\n=== DOCUMENT ADDED ===');
      console.error(`ID: ${docId}`);
      console.error(`Title: ${params.title || 'Untitled'}`);
      console.error(`Content: ${params.content.substring(0, 100)}...`);
      console.error(`Metadata: ${JSON.stringify(params.metadata || {})}`);
      console.error(`Timestamp: ${new Date().toISOString()}`);
      console.error('===================\n');
      
      const stats = await retriever.getStats();
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ Document successfully added to RAG knowledge base!\n\nDetails:\n- Document ID: ${docId}\n- Title: ${params.title || 'Untitled'}\n- Content length: ${params.content.length} characters\n- Added with Xenova embeddings (${retriever.modelName})\n- Timestamp: ${document.metadata.addedAt}\n- Storage: PostgreSQL + pgvector\n\n📊 Knowledge Base Stats:\n- Total documents: ${stats.totalDocuments}\n- Average document length: ${Math.round(stats.averageDocumentLength)} characters\n- Database: ${stats.database}@${stats.host}\n- Embedding model: ${stats.modelName}\n- Storage: PostgreSQL + pgvector extension`
          }
        ]
      };
    } catch (error) {
      console.error('Error adding document:', error);
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error adding document: ${error.message}`
          }
        ]
      };
    }
  }
});

// Add a tool to search/query the RAG system
server.addTool({
  name: 'query_documents',
  description: 'Search and retrieve relevant documents from the RAG knowledge base',
  parameters: z.object({
    query: z.string().describe('The search query'),
    limit: z.number().optional().describe('Maximum number of results to return (default: 5)'),
    threshold: z.number().optional().describe('Similarity threshold (0-1, default: 0.7)')
  }),
  execute: async (params) => {
    try {
      // Ensure retriever is initialized
      await initializeRetriever();
      
      const limit = params.limit || 5;
      const threshold = params.threshold || 0.05; // Very low threshold to get top-k results
      
      // Search for relevant documents with low threshold to get more results
      const documents = await retriever.search(params.query, limit, threshold);
      
      console.error('\n=== RAG QUERY ===');
      console.error(`Query: ${params.query}`);
      console.error(`Documents found: ${documents.length}`);
      console.error(`Threshold: ${threshold}`);
      if (documents.length > 0) {
        console.error(`Best match: ${(documents[0].similarity * 100).toFixed(1)}%`);
        console.error(`Worst match: ${(documents[documents.length-1].similarity * 100).toFixed(1)}%`);
      }
      console.error('=================\n');

      if (documents.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `🔍 No documents found matching "${params.query}" in the knowledge base.\n\nThe system searched through all documents using Xenova embeddings (${retriever.modelName}) but found no relevant content.\n\nTry:\n- Using different keywords or synonyms\n- Adding more relevant documents to the knowledge base\n- Checking if the content you're looking for exists`
            }
          ]
        };
      }

      // Generate response using the generator with ALL found documents
      const result = await generator.generate(params.query, documents);
      
      // Format response with detailed source information including scores
      let responseText = `🔍 **Query:** "${params.query}"\n\n`;
      responseText += `**Generated Response:**\n${result.response}\n\n`;
      
      if (result.sources && result.sources.length > 0) {
        responseText += `**Sources Used (with Relevance Scores):**\n`;
        result.sources.forEach((source, idx) => {
          const relevanceLevel = source.similarity > 0.5 ? "High" : 
                                source.similarity > 0.3 ? "Medium" : 
                                source.similarity > 0.15 ? "Low" : "Very Low";
          responseText += `${idx + 1}. **${source.title}** (${(source.similarity * 100).toFixed(1)}% - ${relevanceLevel} Relevance)\n`;
          responseText += `   ${source.excerpt}\n\n`;
        });
      }
      
      // Add all found documents with scores for transparency
      if (documents.length > (result.sources?.length || 0)) {
        responseText += `**Additional Documents Found (Lower Relevance):**\n`;
        documents.slice(result.sources?.length || 0).forEach((doc, idx) => {
          const relevanceLevel = doc.similarity > 0.3 ? "Medium" : 
                                doc.similarity > 0.15 ? "Low" : "Very Low";
          responseText += `${idx + (result.sources?.length || 0) + 1}. **${doc.metadata?.title || doc.id}** (${(doc.similarity * 100).toFixed(1)}% - ${relevanceLevel})\n`;
          responseText += `   ${doc.content.substring(0, 80)}...\n\n`;
        });
      }
      
      responseText += `**Search Metadata:**\n- Total documents found: ${documents.length}\n- Documents processed: ${result.metadata.documentsUsed}\n- Average similarity: ${(result.metadata.averageSimilarity * 100).toFixed(1)}%\n- Best match: ${documents.length > 0 ? (documents[0].similarity * 100).toFixed(1) + '%' : 'N/A'}\n- Embedding model: ${retriever.modelName}\n- Generated at: ${result.metadata.generatedAt}`;

      return {
        content: [
          {
            type: 'text',
            text: responseText
          }
        ]
      };
    } catch (error) {
      console.error('Error querying documents:', error);
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error searching documents: ${error.message}`
          }
        ]
      };
    }
  }
});

// Add a tool to get RAG service status
server.addTool({
  name: 'get_rag_status',
  description: 'Get the current status of the RAG service',
  parameters: z.object({}),
  execute: async () => {
    try {
      // Ensure retriever is initialized
      await initializeRetriever();
      
      const stats = await retriever.getStats();
      const allDocs = await retriever.getAllDocuments();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'operational',
              service: 'RAG Service',
              uptime: process.uptime(),
              version: '1.0.0',
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
              },
              message: 'RAG service is operational with PostgreSQL + pgvector storage + Xenova embeddings'
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      console.error('Error getting RAG status:', error);
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error getting status: ${error.message}`
          }
        ]
      };
    }
  }
});

// Add a tool to list all documents
server.addTool({
  name: 'list_documents',
  description: 'List all documents in the RAG knowledge base',
  parameters: z.object({}),
  execute: async () => {
    try {
      // Ensure retriever is initialized
      await initializeRetriever();
      
      const documents = await retriever.getAllDocuments();
      const stats = await retriever.getStats();
      
      if (documents.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: '📚 No documents in the knowledge base yet.\n\nUse the `add_document` tool to add some content!\n\nThe system uses PostgreSQL + pgvector with Xenova embeddings.'
            }
          ]
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

      response += `**Statistics:**\n`;
      response += `- Total documents: ${stats.totalDocuments}\n`;
      response += `- Average length: ${Math.round(stats.averageDocumentLength)} characters\n`;
      response += `- Embedding model: ${stats.modelName}\n`;
      response += `- Database: ${stats.database}@${stats.host}\n`;
      response += `- Storage: PostgreSQL + pgvector extension`;

      return {
        content: [
          {
            type: 'text',
            text: response
          }
        ]
      };
    } catch (error) {
      console.error('Error listing documents:', error);
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error listing documents: ${error.message}`
          }
        ]
      };
    }
  }
});

// Add a tool to remove documents
server.addTool({
  name: 'remove_document',
  description: 'Remove a document from the RAG knowledge base',
  parameters: z.object({
    id: z.string().describe('The document ID to remove')
  }),
  execute: async (params) => {
    try {
      // Ensure retriever is initialized
      await initializeRetriever();
      
      const document = await retriever.getDocument(params.id);
      
      if (!document) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Document with ID "${params.id}" not found in the knowledge base.`
            }
          ]
        };
      }
      
      const removed = await retriever.removeDocument(params.id);
      const stats = await retriever.getStats();
      
      if (removed) {
        return {
          content: [
            {
              type: 'text',
              text: `✅ Document successfully removed from PostgreSQL database!\n\n**Removed Document:**\n- ID: ${params.id}\n- Title: ${document.metadata?.title || 'Untitled'}\n- Length: ${document.content.length} characters\n\n**Updated Stats:**\n- Remaining documents: ${stats.totalDocuments}\n- Database: ${stats.database}@${stats.host}\n- Storage: PostgreSQL + pgvector extension`
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Failed to remove document "${params.id}" from PostgreSQL database.`
            }
          ]
        };
      }
    } catch (error) {
      console.error('Error removing document:', error);
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error removing document: ${error.message}`
          }
        ]
      };
    }
  }
});

// Start the server
async function main() {
  try {
    await server.start({
      transportType: 'stdio'
    });
  } catch (error) {
    process.exit(1);
  }
}

main();


export default server;
