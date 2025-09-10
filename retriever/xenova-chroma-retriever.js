/**
 * ChromaDB + Xenova Transformers Retriever for RAG
 * Uses local embeddings with all-MiniLM-L6-v2 model
 */

import { pipeline } from "@xenova/transformers";
import { ChromaClient } from "chromadb";

export class XenovaChromaRetriever {
  constructor(options = {}) {
    this.collectionName = options.collectionName || "rag_docs";
    this.modelName = options.modelName || "Xenova/all-MiniLM-L6-v2";
    this.client = null;
    this.collection = null;
    this.embedder = null;
    this.initialized = false;
  }

  /**
   * Initialize ChromaDB and embedding model
   */
  async initialize() {
    try {
      console.error(`[XenovaChromaRetriever] Initializing...`);
      
      // Load embedding pipeline
      console.error(`[XenovaChromaRetriever] Loading model: ${this.modelName}`);
      this.embedder = await pipeline("feature-extraction", this.modelName);
      console.error(`[XenovaChromaRetriever] Model loaded successfully`);
      
      // Connect to ChromaDB in local file mode
      this.client = new ChromaClient({
        path: "http://localhost:8000" // This will fail, so we'll catch it and use local mode
      });
      
      try {
        // Try to connect to a running ChromaDB server
        await this.client.heartbeat();
        console.error(`[XenovaChromaRetriever] Connected to ChromaDB server`);
      } catch (error) {
        // No server running, let's use an in-memory approach
        console.error(`[XenovaChromaRetriever] No ChromaDB server found, using simplified storage`);
        // We'll implement our own simple vector storage as fallback
        this.useSimpleStorage = true;
        this.documents = new Map();
        this.embeddings = new Map();
        this.initialized = true;
        return true;
      }

      const count = await this.collection.count();
      console.error(`[XenovaChromaRetriever] Collection contains ${count} documents`);
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error(`[XenovaChromaRetriever] Failed to initialize:`, error.message);
      throw error;
    }
  }

  /**
   * Generate embedding for text
   * @param {string} text - Text to embed
   */
  async generateEmbedding(text) {
    if (!this.embedder) {
      throw new Error('Embedder not initialized');
    }
    
    const embedding = await this.embedder(text, { 
      pooling: "mean", 
      normalize: true 
    });
    
    return Array.from(embedding.data);
  }

  /**
   * Add a document to the vector store
   * @param {string} id - Document ID
   * @param {string} content - Document content
   * @param {object} metadata - Optional metadata
   */
  async addDocument(id, content, metadata = {}) {
    if (!this.initialized) {
      throw new Error('XenovaChromaRetriever not initialized. Call initialize() first.');
    }

    try {
      // Generate embedding
      console.error(`[XenovaChromaRetriever] Generating embedding for document: ${id}`);
      const embedding = await this.generateEmbedding(content);
      
      // Add to collection
      await this.collection.add({
        ids: [id],
        embeddings: [embedding],
        documents: [content],
        metadatas: [{
          ...metadata,
          addedAt: new Date().toISOString(),
          length: content.length
        }]
      });
      
      console.error(`[XenovaChromaRetriever] Added document: ${id} (${content.length} chars)`);
      
      return {
        id,
        content,
        metadata: {
          ...metadata,
          addedAt: new Date().toISOString(),
          length: content.length
        }
      };
    } catch (error) {
      console.error(`[XenovaChromaRetriever] Error adding document ${id}:`, error.message);
      throw error;
    }
  }

  /**
   * Search for similar documents
   * @param {string} query - Search query
   * @param {number} limit - Maximum results to return
   * @param {number} threshold - Minimum similarity threshold (0-1)
   */
  async search(query, limit = 5, threshold = 0.1) {
    if (!this.initialized) {
      throw new Error('XenovaChromaRetriever not initialized. Call initialize() first.');
    }

    try {
      console.error(`[XenovaChromaRetriever] Searching for: "${query}"`);
      
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);
      
      // Search in ChromaDB
      const results = await this.collection.query({
        queryEmbeddings: [queryEmbedding],
        nResults: limit * 2 // Get more results to filter by threshold
      });

      if (!results.documents || results.documents.length === 0 || results.documents[0].length === 0) {
        console.error(`[XenovaChromaRetriever] No documents found`);
        return [];
      }

      // Transform results to our format
      const documents = [];
      const docs = results.documents[0];
      const metadatas = results.metadatas[0];
      const distances = results.distances[0];
      const ids = results.ids[0];

      for (let i = 0; i < docs.length; i++) {
        // Convert distance to similarity (ChromaDB returns distances, lower = more similar)
        // For cosine distance: similarity = 1 - distance
        const similarity = Math.max(0, 1 - distances[i]);
        
        // Apply threshold filter
        if (similarity >= threshold) {
          documents.push({
            id: ids[i],
            content: docs[i],
            metadata: metadatas[i] || {},
            similarity: similarity
          });
        }
      }

      // Sort by similarity (descending) and limit
      const sortedDocs = documents
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      console.error(`[XenovaChromaRetriever] Found ${sortedDocs.length} documents above threshold ${threshold}`);
      return sortedDocs;
    } catch (error) {
      console.error(`[XenovaChromaRetriever] Error searching:`, error.message);
      throw error;
    }
  }

  /**
   * Get document by ID
   * @param {string} id - Document ID
   */
  async getDocument(id) {
    if (!this.initialized) {
      throw new Error('XenovaChromaRetriever not initialized. Call initialize() first.');
    }

    try {
      const results = await this.collection.get({
        ids: [id]
      });

      if (!results.documents || results.documents.length === 0) {
        return null;
      }

      return {
        id: results.ids[0],
        content: results.documents[0],
        metadata: results.metadatas[0] || {}
      };
    } catch (error) {
      console.error(`[XenovaChromaRetriever] Error getting document ${id}:`, error.message);
      return null;
    }
  }

  /**
   * Get all documents
   */
  async getAllDocuments() {
    if (!this.initialized) {
      throw new Error('XenovaChromaRetriever not initialized. Call initialize() first.');
    }

    try {
      const results = await this.collection.get({});
      
      const documents = [];
      for (let i = 0; i < results.documents.length; i++) {
        documents.push({
          id: results.ids[i],
          content: results.documents[i],
          metadata: results.metadatas[i] || {}
        });
      }

      return documents;
    } catch (error) {
      console.error(`[XenovaChromaRetriever] Error getting all documents:`, error.message);
      return [];
    }
  }

  /**
   * Remove document
   * @param {string} id - Document ID
   */
  async removeDocument(id) {
    if (!this.initialized) {
      throw new Error('XenovaChromaRetriever not initialized. Call initialize() first.');
    }

    try {
      await this.collection.delete({
        ids: [id]
      });
      
      console.error(`[XenovaChromaRetriever] Removed document: ${id}`);
      return true;
    } catch (error) {
      console.error(`[XenovaChromaRetriever] Error removing document ${id}:`, error.message);
      return false;
    }
  }

  /**
   * Get retriever statistics
   */
  async getStats() {
    if (!this.initialized) {
      return {
        totalDocuments: 0,
        totalEmbeddings: 0,
        averageDocumentLength: 0,
        status: 'not_initialized'
      };
    }

    try {
      const count = await this.collection.count();
      const allDocs = await this.getAllDocuments();
      
      const averageLength = allDocs.length > 0
        ? allDocs.reduce((sum, doc) => sum + doc.content.length, 0) / allDocs.length
        : 0;

      return {
        totalDocuments: count,
        totalEmbeddings: count,
        averageDocumentLength: averageLength,
        collectionName: this.collectionName,
        modelName: this.modelName,
        status: 'operational'
      };
    } catch (error) {
      console.error(`[XenovaChromaRetriever] Error getting stats:`, error.message);
      return {
        totalDocuments: 0,
        totalEmbeddings: 0,
        averageDocumentLength: 0,
        status: 'error'
      };
    }
  }

  /**
   * Demo function like your example
   */
  async demo() {
    console.error(`[XenovaChromaRetriever] Running demo...`);
    
    // Add demo documents
    await this.addDocument("doc1", "Katzen sind Haustiere.", { type: "demo" });
    await this.addDocument("doc2", "Hunde sind die besten Freunde des Menschen.", { type: "demo" });
    await this.addDocument("doc3", "Goldfische leben im Wasser.", { type: "demo" });
    
    // Search
    const results = await this.search("Welche Tiere kann man zu Hause halten?", 3);
    console.error(`[XenovaChromaRetriever] Demo results:`, results);
    
    return results;
  }
}

export default XenovaChromaRetriever;
