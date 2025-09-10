/**
 * Simple Document Retriever for RAG
 * Handles document storage and similarity search using basic embeddings
 */

export class SimpleRetriever {
  constructor() {
    this.documents = new Map();
    this.embeddings = new Map();
  }

  /**
   * Add a document to the retriever
   * @param {string} id - Document ID
   * @param {string} content - Document content
   * @param {object} metadata - Optional metadata
   */
  async addDocument(id, content, metadata = {}) {
    const document = {
      id,
      content,
      metadata: {
        ...metadata,
        addedAt: new Date().toISOString(),
        length: content.length
      }
    };

    // Store document
    this.documents.set(id, document);
    
    // Generate simple embedding (word frequency based)
    const embedding = this.generateEmbedding(content);
    this.embeddings.set(id, embedding);

    console.error(`[Retriever] Added document: ${id} (${content.length} chars)`);
    return document;
  }

  /**
   * Search for similar documents
   * @param {string} query - Search query
   * @param {number} limit - Maximum results to return
   * @param {number} threshold - Similarity threshold (0-1)
   */
  async search(query, limit = 5, threshold = 0.1) {
    if (this.documents.size === 0) {
      return [];
    }

    const queryEmbedding = this.generateEmbedding(query);
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

    // Sort by similarity (descending) and limit results
    results.sort((a, b) => b.similarity - a.similarity);
    return results.slice(0, limit);
  }

  /**
   * Generate simple word-frequency based embedding
   * @param {string} text - Input text
   * @returns {Map} Word frequency map as embedding
   */
  generateEmbedding(text) {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2); // Filter out short words

    const embedding = new Map();
    
    words.forEach(word => {
      embedding.set(word, (embedding.get(word) || 0) + 1);
    });

    // Normalize by text length
    const totalWords = words.length;
    if (totalWords > 0) {
      for (const [word, count] of embedding.entries()) {
        embedding.set(word, count / totalWords);
      }
    }

    return embedding;
  }

  /**
   * Calculate cosine similarity between two embeddings
   * @param {Map} embA - First embedding
   * @param {Map} embB - Second embedding
   * @returns {number} Similarity score (0-1)
   */
  cosineSimilarity(embA, embB) {
    const allWords = new Set([...embA.keys(), ...embB.keys()]);
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (const word of allWords) {
      const a = embA.get(word) || 0;
      const b = embB.get(word) || 0;
      
      dotProduct += a * b;
      normA += a * a;
      normB += b * b;
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  /**
   * Get document by ID
   * @param {string} id - Document ID
   */
  getDocument(id) {
    return this.documents.get(id);
  }

  /**
   * Get all documents
   */
  getAllDocuments() {
    return Array.from(this.documents.values());
  }

  /**
   * Remove document
   * @param {string} id - Document ID
   */
  removeDocument(id) {
    const removed = this.documents.delete(id) && this.embeddings.delete(id);
    if (removed) {
      console.error(`[Retriever] Removed document: ${id}`);
    }
    return removed;
  }

  /**
   * Get retriever statistics
   */
  getStats() {
    return {
      totalDocuments: this.documents.size,
      totalEmbeddings: this.embeddings.size,
      averageDocumentLength: this.documents.size > 0 
        ? Array.from(this.documents.values()).reduce((sum, doc) => sum + doc.content.length, 0) / this.documents.size
        : 0
    };
  }
}

export default SimpleRetriever;
