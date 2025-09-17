/**
 * Simple Response Generator for RAG
 * Generates responses based on retrieved documents and queries
 */

export class SimpleGenerator {
  constructor(options = {}) {
    this.maxResponseLength = options.maxResponseLength || 1000;
    this.includeSourceInfo = options.includeSourceInfo !== false;
  }

  /**
   * Generate a response based on query and retrieved documents
   * @param {string} query - Original user query
   * @param {Array} documents - Retrieved documents with similarity scores
   * @param {object} options - Generation options
   */
  async generate(query, documents, options = {}) {
    if (!documents || documents.length === 0) {
      return this.generateNoResultsResponse(query);
    }

    // Sort documents by similarity if not already sorted
    const sortedDocs = [...documents].sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
    
    // Generate response based on retrieved content
    const response = this.synthesizeResponse(query, sortedDocs, options);
    
    console.error(`[Generator] Generated response for query: "${query}" using ${sortedDocs.length} documents`);
    
    return {
      response,
      sources: this.includeSourceInfo ? this.extractSourceInfo(sortedDocs) : undefined,
      metadata: {
        query,
        documentsUsed: sortedDocs.length,
        averageSimilarity: sortedDocs.reduce((sum, doc) => sum + (doc.similarity || 0), 0) / sortedDocs.length,
        generatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Synthesize a response from multiple documents
   * @param {string} query - Original query
   * @param {Array} documents - Sorted documents
   * @param {object} options - Generation options
   */
  synthesizeResponse(query, documents, options = {}) {
    const maxDocs = options.maxDocuments || 5; // Increased to show more results
    const relevantDocs = documents.slice(0, maxDocs);
    
    // Analyze overall quality of matches
    const avgSimilarity = relevantDocs.reduce((sum, doc) => sum + (doc.similarity || 0), 0) / relevantDocs.length;
    const bestMatch = relevantDocs[0]?.similarity || 0;
    
    // Create adaptive response based on match quality
    let response = '';
    
    if (bestMatch >= 0.5) {
      response = `Based on the available information, here's what I found regarding "${query}":\n\n`;
    } else if (bestMatch >= 0.2) {
      response = `I found some potentially relevant information about "${query}", though the matches are not perfect:\n\n`;
    } else if (bestMatch >= 0.05) {
      response = `I found only limited information that might be related to "${query}". The matches are quite weak, but here's what I discovered:\n\n`;
    } else {
      response = `I couldn't find specific information about "${query}". Here are the closest matches from the knowledge base, though they may not be directly relevant:\n\n`;
    }
    
    // Add information from each relevant document
    relevantDocs.forEach((doc, index) => {
      const docSummary = this.extractRelevantContent(doc.content, query);
      const confidenceLevel = this.getConfidenceLevel(doc.similarity);
      
      response += `**${index + 1}.** ${doc.metadata?.title || `Document ${doc.id}`} (${confidenceLevel} match - ${(doc.similarity * 100).toFixed(1)}%):\n`;
      response += `${docSummary}\n\n`;
    });

    // Add adaptive conclusion based on match quality
    if (relevantDocs.length > 1) {
      response += `**Summary:**\n`;
      if (avgSimilarity >= 0.4) {
        response += this.createSynthesis(query, relevantDocs);
      } else if (avgSimilarity >= 0.15) {
        response += `While the matches aren't perfect, there might be some connections to "${query}" in the available content. Consider refining your search terms or adding more specific documents to the knowledge base.`;
      } else {
        response += `The available information doesn't appear to directly address "${query}". You might want to try different search terms or add more relevant content to improve future searches.`;
      }
    }

    // Ensure response doesn't exceed max length
    if (response.length > this.maxResponseLength) {
      response = response.substring(0, this.maxResponseLength - 3) + '...';
    }

    return response.trim();
  }

  /**
   * Extract relevant content from a document based on the query
   * @param {string} content - Full document content
   * @param {string} query - Search query
   */
  extractRelevantContent(content, query) {
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 10);
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);
    
    // Score sentences based on query term presence
    const scoredSentences = sentences.map(sentence => {
      const lowerSentence = sentence.toLowerCase();
      const matches = queryWords.filter(word => lowerSentence.includes(word)).length;
      return {
        sentence: sentence.trim(),
        score: matches / queryWords.length,
        matches
      };
    });

    // Sort by score and take the most relevant sentences
    scoredSentences.sort((a, b) => b.score - a.score);
    const relevantSentences = scoredSentences
      .slice(0, 3) // Take top 3 sentences
      .filter(s => s.score > 0) // Only sentences with matches
      .map(s => s.sentence);

    if (relevantSentences.length === 0) {
      // Fallback: return first part of content
      return content.substring(0, 200) + (content.length > 200 ? '...' : '');
    }

    return relevantSentences.join('. ') + (relevantSentences[relevantSentences.length - 1].endsWith('.') ? '' : '.');
  }

  /**
   * Create a synthesis from multiple documents
   * @param {string} query - Original query
   * @param {Array} documents - Retrieved documents
   */
  createSynthesis(query, documents) {
    const themes = this.identifyCommonThemes(documents);
    
    let synthesis = `The information across multiple sources suggests that `;
    
    if (themes.length > 0) {
      synthesis += `the key aspects of "${query}" include: ${themes.join(', ')}.`;
    } else {
      synthesis += `there are multiple perspectives on "${query}" worth considering.`;
    }

    return synthesis;
  }

  /**
   * Identify common themes across documents
   * @param {Array} documents - Documents to analyze
   */
  identifyCommonThemes(documents) {
    const allWords = [];
    
    documents.forEach(doc => {
      const words = doc.content.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(word => word.length > 4); // Only longer, more meaningful words
      allWords.push(...words);
    });

    // Count word frequency
    const wordCount = {};
    allWords.forEach(word => {
      wordCount[word] = (wordCount[word] || 0) + 1;
    });

    // Find words that appear in multiple documents
    const themes = Object.entries(wordCount)
      .filter(([word, count]) => count >= 2) // Must appear at least twice
      .sort((a, b) => b[1] - a[1]) // Sort by frequency
      .slice(0, 5) // Top 5 themes
      .map(([word]) => word);

    return themes;
  }

  /**
   * Generate response when no relevant documents are found
   * @param {string} query - Original query
   */
  generateNoResultsResponse(query) {
    return {
      response: `I couldn't find specific information about "${query}" in the current knowledge base. You might want to:\n\n• Add more relevant documents to the system\n• Try rephrasing your query with different keywords\n• Check if the information exists under different terms`,
      sources: [],
      metadata: {
        query,
        documentsUsed: 0,
        averageSimilarity: 0,
        generatedAt: new Date().toISOString(),
        noResultsReason: 'No documents found above similarity threshold'
      }
    };
  }

  /**
   * Get confidence level description based on similarity score
   * @param {number} similarity - Similarity score (0-1)
   */
  getConfidenceLevel(similarity) {
    if (similarity >= 0.7) return 'Excellent';
    if (similarity >= 0.5) return 'Good';
    if (similarity >= 0.3) return 'Moderate';
    if (similarity >= 0.15) return 'Low';
    if (similarity >= 0.05) return 'Very low';
    return 'Minimal';
  }

  /**
   * Extract source information for citations
   * @param {Array} documents - Documents used in generation
   */
  extractSourceInfo(documents) {
    return documents.map((doc, index) => ({
      id: doc.id,
      title: doc.metadata?.title || `Document ${doc.id}`,
      similarity: doc.similarity,
      addedAt: doc.metadata?.addedAt,
      excerpt: doc.content.substring(0, 100) + (doc.content.length > 100 ? '...' : '')
    }));
  }

  /**
   * Configure generator settings
   * @param {object} options - Configuration options
   */
  configure(options) {
    if (options.maxResponseLength !== undefined) {
      this.maxResponseLength = options.maxResponseLength;
    }
    if (options.includeSourceInfo !== undefined) {
      this.includeSourceInfo = options.includeSourceInfo;
    }
    
    console.error(`[Generator] Configuration updated:`, options);
  }
}

export default SimpleGenerator;
