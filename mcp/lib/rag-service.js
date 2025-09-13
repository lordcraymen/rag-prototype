/**
 * RAG Service
 * Encapsulates the RAG system initialization and management
 */
export class RAGService {
  constructor(config = {}) {
    this.config = {
      host: config.host || 'localhost',
      port: config.port || 5432,
      database: config.database || 'rag',
      user: config.user || 'raguser',
      password: config.password || 'ragpassword',
      modelName: config.modelName || 'Xenova/all-MiniLM-L6-v2',
      generatorConfig: config.generatorConfig || {
        maxResponseLength: 2000,
        includeSourceInfo: true
      }
    };
    
    this.retriever = null;
    this.generator = null;
    this.initializationPromise = null;
  }

  /**
   * Initialize the RAG components
   */
  async initialize() {
    if (!this.initializationPromise) {
      this.initializationPromise = this._doInitialize();
    }
    return this.initializationPromise;
  }

  async _doInitialize() {
    console.error('Initializing PostgreSQL RAG components...');
    
    // Dynamic imports to avoid issues with module resolution
    const { default: PostgreSQLRetriever } = await import('../../retriever/postgresql-retriever.js');
    const { default: SimpleGenerator } = await import('../../generator/index.js');
    
    this.retriever = new PostgreSQLRetriever({
      host: this.config.host,
      port: this.config.port,
      database: this.config.database,
      user: this.config.user,
      password: this.config.password,
      modelName: this.config.modelName
    });

    this.generator = new SimpleGenerator(this.config.generatorConfig);
    
    await this.retriever.initialize();
    
    console.error('RAG components initialized successfully');
  }

  /**
   * Ensure the service is initialized
   */
  async ensureInitialized() {
    await this.initialize();
  }

  /**
   * Add a document to the knowledge base
   */
  async addDocument(content, metadata = {}) {
    await this.ensureInitialized();
    
    const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const document = await this.retriever.addDocument(docId, content, metadata);
    
    console.error('\n=== DOCUMENT ADDED ===');
    console.error(`ID: ${docId}`);
    console.error(`Title: ${metadata.title || 'Untitled'}`);
    console.error(`Content: ${content.substring(0, 100)}...`);
    console.error(`Metadata: ${JSON.stringify(metadata)}`);
    console.error(`Timestamp: ${new Date().toISOString()}`);
    console.error('===================\n');
    
    return { docId, document };
  }

  /**
   * Search/query documents
   */
  async queryDocuments(query, options = {}) {
    await this.ensureInitialized();
    
    const {
      limit = 5,
      threshold = 0.05,
      useHybrid = true,
      bm25Weight = 0.3,
      vectorWeight = 0.7
    } = options;
    
    let documents;
    if (useHybrid) {
      documents = await this.retriever.hybridSearch(query, limit, threshold, bm25Weight, vectorWeight);
    } else {
      documents = await this.retriever.search(query, limit, threshold);
    }
    
    console.error('\n=== RAG QUERY ===');
    console.error(`Query: ${query}`);
    console.error(`Search type: ${useHybrid ? 'Hybrid (BM25+Vector)' : 'Vector only'}`);
    console.error(`Documents found: ${documents.length}`);
    console.error(`Threshold: ${threshold}`);
    if (documents.length > 0) {
      const bestDoc = documents[0];
      if (useHybrid) {
        console.error(`Best match: Hybrid=${(bestDoc.hybridScore * 100).toFixed(1)}% (Vector=${(bestDoc.similarity * 100).toFixed(1)}%, BM25=${bestDoc.bm25Score.toFixed(2)})`);
      } else {
        console.error(`Best match: ${(bestDoc.similarity * 100).toFixed(1)}%`);
      }
      console.error(`Worst match: ${useHybrid ? (documents[documents.length-1].hybridScore * 100).toFixed(1) : (documents[documents.length-1].similarity * 100).toFixed(1)}%`);
    }
    console.error('=================\n');

    return documents;
  }

  /**
   * Generate response from query and documents
   */
  async generateResponse(query, documents) {
    await this.ensureInitialized();
    return await this.generator.generate(query, documents);
  }

  /**
   * Get service statistics
   */
  async getStats() {
    await this.ensureInitialized();
    return await this.retriever.getStats();
  }

  /**
   * List all documents
   */
  async getAllDocuments() {
    await this.ensureInitialized();
    return await this.retriever.getAllDocuments();
  }

  /**
   * Get a specific document
   */
  async getDocument(id) {
    await this.ensureInitialized();
    return await this.retriever.getDocument(id);
  }

  /**
   * Remove a document
   */
  async removeDocument(id) {
    await this.ensureInitialized();
    return await this.retriever.removeDocument(id);
  }

  /**
   * Get the model name
   */
  get modelName() {
    return this.config.modelName;
  }
}
