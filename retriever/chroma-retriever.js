/**
 * ChromaDB-based Document Retriever for RAG
 * Provides persistent vector storage with automatic embeddings
 */

import { ChromaApi, OpenAIEmbeddingFunction } from 'chromadb';

export class ChromaRetriever {
  constructor(options = {}) {
    this.dbPath = options.dbPath || './chroma_db';
    this.collectionName = options.collectionName || 'rag_documents';
    this.client = null;
    this.collection = null;
    
    // Use a simple embedding function or OpenAI if available
    this.embeddingFunction = new OpenAIEmbeddingFunction({
      openai_api_key: options.openaiApiKey || "dummy-key", // We'll use a local fallback
      openai_model: "text-embedding-ada-002"
    });
  }

  /**
   * Initialize ChromaDB connection
   */
  async initialize() {
    try {
      // Create ChromaDB client with persistent storage
      this.client = new ChromaApi({
        path: this.dbPath
      });

      console.error(`[ChromaRetriever] Connecting to ChromaDB at ${this.dbPath}`);
      
      // Get or create collection
      try {
        this.collection = await this.client.getCollection({
          name: this.collectionName,
          embeddingFunction: this.embeddingFunction
        });
        console.error(`[ChromaRetriever] Connected to existing collection: ${this.collectionName}`);
      } catch (error) {
        // Collection doesn't exist, create it
        this.collection = await this.client.createCollection({
          name: this.collectionName,
          embeddingFunction: this.embeddingFunction
        });
        console.error(`[ChromaRetriever] Created new collection: ${this.collectionName}`);
      }

      const count = await this.collection.count();
      console.error(`[ChromaRetriever] Collection contains ${count} documents`);
      
      return true;
    } catch (error) {
      console.error(`[ChromaRetriever] Failed to initialize:`, error.message);
      throw error;
    }
  }

  /**
   * Add a document to the vector store
   * @param {string} id - Document ID
   * @param {string} content - Document content
   * @param {object} metadata - Optional metadata
   */
  async addDocument(id, content, metadata = {}) {
    if (!this.collection) {
      throw new Error('ChromaRetriever not initialized. Call initialize() first.');
    }

    try {
      const document = {
        ids: [id],
        documents: [content],
        metadatas: [{
          ...metadata,
          addedAt: new Date().toISOString(),
          length: content.length
        }]
      };

      await this.collection.add(document);
      
      console.error(`[ChromaRetriever] Added document: ${id} (${content.length} chars)`);
      
      return {
        id,
        content,
        metadata: document.metadatas[0]
      };
    } catch (error) {
      console.error(`[ChromaRetriever] Error adding document ${id}:`, error.message);
      throw error;
    }
  }

  /**
   * Search for similar documents
   * @param {string} query - Search query
   * @param {number} limit - Maximum results to return
   * @param {number} threshold - Not used in ChromaDB (uses nResults instead)
   */
  async search(query, limit = 5, threshold = 0.1) {
    if (!this.collection) {
      throw new Error('ChromaRetriever not initialized. Call initialize() first.');
    }

    try {
      const results = await this.collection.query({
        queryTexts: [query],
        nResults: limit
      });

      if (!results.documents || results.documents.length === 0) {
        return [];
      }

      // Transform ChromaDB results to our format
      const documents = [];
      const docs = results.documents[0];
      const metadatas = results.metadatas[0];
      const distances = results.distances[0];
      const ids = results.ids[0];

      for (let i = 0; i < docs.length; i++) {
        // Convert distance to similarity (ChromaDB returns distances, lower = more similar)
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

      console.error(`[ChromaRetriever] Found ${documents.length} documents for query: "${query}"`);
      return documents.sort((a, b) => b.similarity - a.similarity);
    } catch (error) {
      console.error(`[ChromaRetriever] Error searching:`, error.message);
      throw error;
    }
  }

  /**
   * Get document by ID
   * @param {string} id - Document ID
   */
  async getDocument(id) {
    if (!this.collection) {
      throw new Error('ChromaRetriever not initialized. Call initialize() first.');
    }

    try {
      const results = await this.collection.get({
        ids: [id]
      });

      if (results.documents.length === 0) {
        return null;
      }

      return {
        id: results.ids[0],
        content: results.documents[0],
        metadata: results.metadatas[0] || {}
      };
    } catch (error) {
      console.error(`[ChromaRetriever] Error getting document ${id}:`, error.message);
      return null;
    }
  }

  /**
   * Get all documents
   */
  async getAllDocuments() {
    if (!this.collection) {
      throw new Error('ChromaRetriever not initialized. Call initialize() first.');
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
      console.error(`[ChromaRetriever] Error getting all documents:`, error.message);
      return [];
    }
  }

  /**
   * Remove document
   * @param {string} id - Document ID
   */
  async removeDocument(id) {
    if (!this.collection) {
      throw new Error('ChromaRetriever not initialized. Call initialize() first.');
    }

    try {
      await this.collection.delete({
        ids: [id]
      });
      
      console.error(`[ChromaRetriever] Removed document: ${id}`);
      return true;
    } catch (error) {
      console.error(`[ChromaRetriever] Error removing document ${id}:`, error.message);
      return false;
    }
  }

  /**
   * Get retriever statistics
   */
  async getStats() {
    if (!this.collection) {
      return {
        totalDocuments: 0,
        totalEmbeddings: 0,
        averageDocumentLength: 0
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
        dbPath: this.dbPath,
        collectionName: this.collectionName
      };
    } catch (error) {
      console.error(`[ChromaRetriever] Error getting stats:`, error.message);
      return {
        totalDocuments: 0,
        totalEmbeddings: 0,
        averageDocumentLength: 0
      };
    }
  }

  /**
   * Close connection (cleanup)
   */
  async close() {
    // ChromaDB client doesn't need explicit closing in most cases
    console.error(`[ChromaRetriever] Connection closed`);
  }
}

export default ChromaRetriever;
