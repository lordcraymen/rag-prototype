/**
 * Simple Persistent Retriever with Xenova Embeddings
 * Uses local file storage and Xenova transformers for embeddings
 */

import { pipeline } from "@xenova/transformers";
import fs from 'fs/promises';
import path from 'path';

export class SimplePersistentRetriever {
  constructor(options = {}) {
    this.modelName = options.modelName || "Xenova/all-MiniLM-L6-v2";
    this.storagePath = options.storagePath || './rag_storage';
    this.documentsFile = path.join(this.storagePath, 'documents.json');
    this.embeddingsFile = path.join(this.storagePath, 'embeddings.json');
    this.embedder = null;
    this.documents = new Map();
    this.embeddings = new Map();
    this.initialized = false;
  }

  /**
   * Initialize embedding model and load existing data
   */
  async initialize() {
    try {
      console.error(`[SimplePersistentRetriever] Initializing...`);
      
      // Create storage directory if it doesn't exist
      try {
        await fs.mkdir(this.storagePath, { recursive: true });
      } catch (error) {
        // Directory might already exist
      }
      
      // Load embedding pipeline
      console.error(`[SimplePersistentRetriever] Loading model: ${this.modelName}`);
      this.embedder = await pipeline("feature-extraction", this.modelName);
      console.error(`[SimplePersistentRetriever] Model loaded successfully`);
      
      // Load existing documents and embeddings
      await this.loadFromDisk();
      
      console.error(`[SimplePersistentRetriever] Loaded ${this.documents.size} documents from storage`);
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error(`[SimplePersistentRetriever] Failed to initialize:`, error.message);
      throw error;
    }
  }

  /**
   * Load documents and embeddings from disk
   */
  async loadFromDisk() {
    try {
      // Load documents
      try {
        const documentsData = await fs.readFile(this.documentsFile, 'utf8');
        const documentsArray = JSON.parse(documentsData);
        this.documents = new Map(documentsArray);
      } catch (error) {
        // File doesn't exist or is invalid, start with empty map
        this.documents = new Map();
      }

      // Load embeddings
      try {
        const embeddingsData = await fs.readFile(this.embeddingsFile, 'utf8');
        const embeddingsArray = JSON.parse(embeddingsData);
        this.embeddings = new Map(embeddingsArray);
      } catch (error) {
        // File doesn't exist or is invalid, start with empty map
        this.embeddings = new Map();
      }
    } catch (error) {
      console.error(`[SimplePersistentRetriever] Error loading from disk:`, error.message);
    }
  }

  /**
   * Save documents and embeddings to disk
   */
  async saveToDisk() {
    try {
      // Save documents
      const documentsArray = Array.from(this.documents.entries());
      await fs.writeFile(this.documentsFile, JSON.stringify(documentsArray, null, 2));

      // Save embeddings
      const embeddingsArray = Array.from(this.embeddings.entries());
      await fs.writeFile(this.embeddingsFile, JSON.stringify(embeddingsArray, null, 2));
    } catch (error) {
      console.error(`[SimplePersistentRetriever] Error saving to disk:`, error.message);
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
   * Calculate cosine similarity between two embeddings
   */
  cosineSimilarity(embA, embB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < embA.length; i++) {
      dotProduct += embA[i] * embB[i];
      normA += embA[i] * embA[i];
      normB += embB[i] * embB[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Add a document to the vector store
   * @param {string} id - Document ID
   * @param {string} content - Document content
   * @param {object} metadata - Optional metadata
   */
  async addDocument(id, content, metadata = {}) {
    if (!this.initialized) {
      throw new Error('SimplePersistentRetriever not initialized. Call initialize() first.');
    }

    try {
      console.error(`[SimplePersistentRetriever] Generating embedding for document: ${id}`);
      
      // Generate embedding
      const embedding = await this.generateEmbedding(content);
      
      // Store document and embedding
      const document = {
        id,
        content,
        metadata: {
          ...metadata,
          addedAt: new Date().toISOString(),
          length: content.length
        }
      };
      
      this.documents.set(id, document);
      this.embeddings.set(id, embedding);
      
      // Save to disk
      await this.saveToDisk();
      
      console.error(`[SimplePersistentRetriever] Added document: ${id} (${content.length} chars)`);
      
      return document;
    } catch (error) {
      console.error(`[SimplePersistentRetriever] Error adding document ${id}:`, error.message);
      throw error;
    }
  }

  /**
   * Search for similar documents
   * @param {string} query - Search query
   * @param {number} limit - Maximum results to return
   * @param {number} threshold - Minimum similarity threshold (0-1)
   */
  async search(query, limit = 5, threshold = 0.3) {
    if (!this.initialized) {
      throw new Error('SimplePersistentRetriever not initialized. Call initialize() first.');
    }

    try {
      console.error(`[SimplePersistentRetriever] Searching for: "${query}"`);
      
      if (this.documents.size === 0) {
        return [];
      }
      
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);
      
      const results = [];
      
      // Calculate similarity for each document
      for (const [docId, embedding] of this.embeddings.entries()) {
        const similarity = this.cosineSimilarity(queryEmbedding, embedding);
        
        if (similarity >= threshold) {
          const document = this.documents.get(docId);
          results.push({
            ...document,
            similarity
          });
        }
      }

      // Sort by similarity (descending) and limit
      const sortedResults = results
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, limit);

      console.error(`[SimplePersistentRetriever] Found ${sortedResults.length} documents above threshold ${threshold}`);
      return sortedResults;
    } catch (error) {
      console.error(`[SimplePersistentRetriever] Error searching:`, error.message);
      throw error;
    }
  }

  /**
   * Get document by ID
   * @param {string} id - Document ID
   */
  async getDocument(id) {
    return this.documents.get(id) || null;
  }

  /**
   * Get all documents
   */
  async getAllDocuments() {
    return Array.from(this.documents.values());
  }

  /**
   * Remove document
   * @param {string} id - Document ID
   */
  async removeDocument(id) {
    try {
      const removed = this.documents.delete(id) && this.embeddings.delete(id);
      
      if (removed) {
        await this.saveToDisk();
        console.error(`[SimplePersistentRetriever] Removed document: ${id}`);
      }
      
      return removed;
    } catch (error) {
      console.error(`[SimplePersistentRetriever] Error removing document ${id}:`, error.message);
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

    const documents = Array.from(this.documents.values());
    const averageLength = documents.length > 0
      ? documents.reduce((sum, doc) => sum + doc.content.length, 0) / documents.length
      : 0;

    return {
      totalDocuments: this.documents.size,
      totalEmbeddings: this.embeddings.size,
      averageDocumentLength: averageLength,
      modelName: this.modelName,
      storagePath: this.storagePath,
      status: 'operational'
    };
  }
}

export default SimplePersistentRetriever;
