/**
 * PostgreSQL + pgvector Retriever for RAG
 * Uses PostgreSQL with pgvector extension for persistent vector storage
 */

import pkg from 'pg';
import { pipeline } from "@xenova/transformers";

const { Client } = pkg;

export class PostgreSQLRetriever {
  constructor(options = {}) {
    this.modelName = options.modelName || "Xenova/all-MiniLM-L6-v2";
    this.connectionConfig = {
      host: options.host || 'localhost',
      port: options.port || 5432,
      database: options.database || 'rag',
      user: options.user || 'raguser',
      password: options.password || 'ragpassword',
      ...options.connectionConfig
    };
    this.embedder = null;
    this.client = null;
    this.initialized = false;
  }

  /**
   * Initialize embedding model and database connection
   */
  async initialize() {
    try {
      console.error(`[PostgreSQLRetriever] Initializing...`);
      
      // Load embedding pipeline
      console.error(`[PostgreSQLRetriever] Loading model: ${this.modelName}`);
      this.embedder = await pipeline("feature-extraction", this.modelName);
      console.error(`[PostgreSQLRetriever] Model loaded successfully`);
      
      // Connect to PostgreSQL
      this.client = new Client(this.connectionConfig);
      await this.client.connect();
      console.error(`[PostgreSQLRetriever] Connected to PostgreSQL at ${this.connectionConfig.host}:${this.connectionConfig.port}`);
      
      // Test pgvector extension
      await this.testVectorExtension();
      
      this.initialized = true;
      return true;
    } catch (error) {
      console.error(`[PostgreSQLRetriever] Failed to initialize:`, error.message);
      throw error;
    }
  }

  /**
   * Test if pgvector extension is available
   */
  async testVectorExtension() {
    try {
      const result = await this.client.query("SELECT extname FROM pg_extension WHERE extname = 'vector'");
      if (result.rows.length === 0) {
        throw new Error('pgvector extension not installed. Please run: CREATE EXTENSION vector;');
      }
      console.error(`[PostgreSQLRetriever] pgvector extension confirmed`);
    } catch (error) {
      console.error(`[PostgreSQLRetriever] Vector extension test failed:`, error.message);
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
      throw new Error('PostgreSQLRetriever not initialized. Call initialize() first.');
    }

    try {
      console.error(`[PostgreSQLRetriever] Generating embedding for document: ${id}`);
      
      // Generate embedding
      const embedding = await this.generateEmbedding(content);
      
      // Insert into database
      const query = `
        INSERT INTO documents (
          id, title, content, embedding, metadata, 
          source_url, source_type, fetched_at
        ) 
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO UPDATE SET
          title = EXCLUDED.title,
          content = EXCLUDED.content,
          embedding = EXCLUDED.embedding,
          metadata = EXCLUDED.metadata,
          source_url = EXCLUDED.source_url,
          source_type = EXCLUDED.source_type,
          fetched_at = EXCLUDED.fetched_at,
          updated_at = NOW()
        RETURNING id, title, content, metadata, created_at, updated_at, source_url, source_type, fetched_at
      `;
      
      const values = [
        id,
        metadata.title || null,
        content,
        `[${embedding.join(',')}]`, // Convert array to PostgreSQL array format
        JSON.stringify({
          ...metadata,
          addedAt: new Date().toISOString(),
          length: content.length
        }),
        metadata.sourceUrl || metadata.url || null,
        metadata.sourceType || metadata.source || 'manual',
        metadata.fetchedAt ? new Date(metadata.fetchedAt) : null
      ];
      
      const result = await this.client.query(query, values);
      const document = result.rows[0];
      
      console.error(`[PostgreSQLRetriever] Added document: ${id} (${content.length} chars)`);
      
      return {
        id: document.id,
        content: document.content,
        metadata: document.metadata
      };
    } catch (error) {
      console.error(`[PostgreSQLRetriever] Error adding document ${id}:`, error.message);
      throw error;
    }
  }

  /**
   * Search for similar documents using vector similarity
   * @param {string} query - Search query
   * @param {number} limit - Maximum results to return
   * @param {number} threshold - Minimum similarity threshold (0-1)
   */
  async search(query, limit = 5, threshold = 0.3) {
    if (!this.initialized) {
      throw new Error('PostgreSQLRetriever not initialized. Call initialize() first.');
    }

    try {
      console.error(`[PostgreSQLRetriever] Searching for: "${query}"`);
      
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);
      const embeddingVector = `[${queryEmbedding.join(',')}]`;
      
      // Use the search function we created
      const searchQuery = `
        SELECT * FROM search_documents($1::vector, $2, $3)
      `;
      
      const result = await this.client.query(searchQuery, [embeddingVector, threshold, limit]);
      
      const documents = result.rows.map(row => ({
        id: row.id,
        content: row.content,
        metadata: row.metadata || {},
        similarity: parseFloat(row.similarity)
      }));

      console.error(`[PostgreSQLRetriever] Found ${documents.length} documents above threshold ${threshold}`);
      return documents;
    } catch (error) {
      console.error(`[PostgreSQLRetriever] Error searching:`, error.message);
      throw error;
    }
  }

  /**
   * Hybrid search combining BM25 + Vector similarity
   * @param {string} query - Search query
   * @param {number} limit - Maximum results to return
   * @param {number} threshold - Minimum similarity threshold (0-1)
   * @param {number} bm25Weight - Weight for BM25 score (0-1)
   * @param {number} vectorWeight - Weight for vector similarity (0-1)
   */
  async hybridSearch(query, limit = 5, threshold = 0.05, bm25Weight = 0.3, vectorWeight = 0.7) {
    if (!this.initialized) {
      throw new Error('PostgreSQLRetriever not initialized. Call initialize() first.');
    }

    try {
      console.error(`[PostgreSQLRetriever] Hybrid search for: "${query}"`);
      console.error(`[PostgreSQLRetriever] Weights - BM25: ${bm25Weight}, Vector: ${vectorWeight}`);
      
      // Generate query embedding
      const queryEmbedding = await this.generateEmbedding(query);
      const embeddingVector = `[${queryEmbedding.join(',')}]`;
      
      // Simplified hybrid search implementation
      const searchQuery = `
        SELECT 
          d.id,
          d.title,
          d.content,
          d.metadata,
          d.created_at,
          (1 - (d.embedding <=> $2::vector)) AS vector_similarity,
          COALESCE(ts_rank_cd(d.tsvector_content, plainto_tsquery($1)) * 5.0, 0) AS bm25_score,
          ($5::real * (1 - (d.embedding <=> $2::vector)) + $4::real * LEAST(COALESCE(ts_rank_cd(d.tsvector_content, plainto_tsquery($1)) * 5.0, 0) / 5.0, 1.0)) AS hybrid_score
        FROM documents d
        WHERE d.embedding <=> $2::vector < (1 - $3::real)
        ORDER BY hybrid_score DESC
        LIMIT $6
      `;
      
      const result = await this.client.query(searchQuery, [
        query,
        embeddingVector, 
        threshold,
        bm25Weight,
        vectorWeight,
        limit
      ]);
      
      const documents = result.rows.map(row => ({
        id: row.id,
        content: row.content,
        metadata: row.metadata || {},
        similarity: parseFloat(row.vector_similarity),
        bm25Score: parseFloat(row.bm25_score || 0),
        hybridScore: parseFloat(row.hybrid_score)
      }));

      console.error(`[PostgreSQLRetriever] Hybrid search found ${documents.length} documents`);
      if (documents.length > 0) {
        console.error(`[PostgreSQLRetriever] Best hybrid score: ${documents[0].hybridScore.toFixed(3)} (Vector: ${(documents[0].similarity * 100).toFixed(1)}%, BM25: ${documents[0].bm25Score.toFixed(2)})`);
      }
      
      return documents;
    } catch (error) {
      console.error(`[PostgreSQLRetriever] Error in hybrid search:`, error.message);
      throw error;
    }
  }

  /**
   * Get document by ID
   * @param {string} id - Document ID
   */
  async getDocument(id) {
    if (!this.initialized) {
      throw new Error('PostgreSQLRetriever not initialized. Call initialize() first.');
    }

    try {
      const result = await this.client.query(
        'SELECT id, title, content, metadata, created_at FROM documents WHERE id = $1',
        [id]
      );

      if (result.rows.length === 0) {
        return null;
      }

      const row = result.rows[0];
      return {
        id: row.id,
        content: row.content,
        metadata: row.metadata || {}
      };
    } catch (error) {
      console.error(`[PostgreSQLRetriever] Error getting document ${id}:`, error.message);
      return null;
    }
  }

  /**
   * Get all documents
   */
  async getAllDocuments() {
    if (!this.initialized) {
      throw new Error('PostgreSQLRetriever not initialized. Call initialize() first.');
    }

    try {
      const result = await this.client.query(
        'SELECT id, title, content, metadata, created_at FROM documents ORDER BY created_at DESC'
      );

      return result.rows.map(row => ({
        id: row.id,
        content: row.content,
        metadata: row.metadata || {}
      }));
    } catch (error) {
      console.error(`[PostgreSQLRetriever] Error getting all documents:`, error.message);
      return [];
    }
  }

  /**
   * Remove document
   * @param {string} id - Document ID
   */
  async removeDocument(id) {
    if (!this.initialized) {
      throw new Error('PostgreSQLRetriever not initialized. Call initialize() first.');
    }

    try {
      const result = await this.client.query('DELETE FROM documents WHERE id = $1', [id]);
      const removed = result.rowCount > 0;
      
      if (removed) {
        console.error(`[PostgreSQLRetriever] Removed document: ${id}`);
      }
      
      return removed;
    } catch (error) {
      console.error(`[PostgreSQLRetriever] Error removing document ${id}:`, error.message);
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
      const countResult = await this.client.query('SELECT COUNT(*) as count FROM documents');
      const avgResult = await this.client.query('SELECT AVG(LENGTH(content)) as avg_length FROM documents');
      
      const totalDocuments = parseInt(countResult.rows[0].count);
      const averageDocumentLength = parseFloat(avgResult.rows[0].avg_length) || 0;

      return {
        totalDocuments,
        totalEmbeddings: totalDocuments,
        averageDocumentLength,
        modelName: this.modelName,
        database: this.connectionConfig.database,
        host: this.connectionConfig.host,
        status: 'operational'
      };
    } catch (error) {
      console.error(`[PostgreSQLRetriever] Error getting stats:`, error.message);
      return {
        totalDocuments: 0,
        totalEmbeddings: 0,
        averageDocumentLength: 0,
        status: 'error'
      };
    }
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.client) {
      await this.client.end();
      console.error(`[PostgreSQLRetriever] Database connection closed`);
    }
  }
}

export default PostgreSQLRetriever;
