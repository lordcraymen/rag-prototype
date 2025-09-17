// Abstract base class for database connectors

import { IDatabaseConnector, IEmbeddingService, ISearchService, IDatabaseConnection } from '@/types/database.js';
import { Document, SearchResult, SearchOptions, EmbeddingVector, ConnectionStatus, ImportResult, BatchImportOptions } from '@/types/index.js';

export abstract class DatabaseConnector implements IDatabaseConnector {
    protected connection: IDatabaseConnection;
    protected embeddingService: IEmbeddingService;
    protected searchService: ISearchService;
    
    constructor(
        connection: IDatabaseConnection,
        embeddingService: IEmbeddingService,
        searchService: ISearchService
    ) {
        this.connection = connection;
        this.embeddingService = embeddingService;
        this.searchService = searchService;
    }

    // Abstract methods that must be implemented by subclasses
    abstract connect(): Promise<void>;
    abstract disconnect(): Promise<void>;
    abstract addDocument(document: Document): Promise<string>;
    abstract addDocuments(documents: Document[]): Promise<ImportResult>;
    abstract updateDocument(id: string, document: Partial<Document>): Promise<void>;
    abstract deleteDocument(id: string): Promise<void>;
    abstract getDocument(id: string): Promise<Document | null>;
    abstract initializeDatabase(): Promise<void>;
    abstract resetDatabase(): Promise<void>;
    abstract getDocumentCount(): Promise<number>;
    abstract clearAllDocuments(): Promise<void>;

    // Common implementations that can be shared
    isConnected(): boolean {
        return this.connection.isConnected();
    }

    async getStatus(): Promise<ConnectionStatus> {
        return {
            connected: this.isConnected()
        };
    }

    async generateEmbedding(text: string): Promise<EmbeddingVector> {
        const vector = await this.embeddingService.generateEmbedding(text);
        return {
            vector,
            dimensions: this.embeddingService.getDimensions()
        };
    }

    async search(options: SearchOptions): Promise<SearchResult[]> {
        if (options.useHybrid !== false) {
            return this.hybridSearch(options.query, options);
        } else {
            const embedding = await this.embeddingService.generateEmbedding(options.query);
            return this.vectorSearch(embedding, options.limit, options.threshold);
        }
    }

    async vectorSearch(embedding: number[], limit?: number, threshold?: number): Promise<SearchResult[]> {
        return this.searchService.vectorSearch(embedding, limit, threshold);
    }

    async hybridSearch(query: string, options?: Partial<SearchOptions>): Promise<SearchResult[]> {
        return this.searchService.hybridSearch(query, options);
    }

    // Utility methods for document validation
    protected validateDocument(document: Document): void {
        if (!document.content || typeof document.content !== 'string') {
            throw new Error('Document content is required and must be a string');
        }

        if (document.content.trim().length === 0) {
            throw new Error('Document content cannot be empty');
        }

        if (document.title && typeof document.title !== 'string') {
            throw new Error('Document title must be a string');
        }

        if (document.metadata && typeof document.metadata !== 'object') {
            throw new Error('Document metadata must be an object');
        }
    }

    // Utility method for batch processing
    protected async processBatch<T, R>(
        items: T[],
        processor: (item: T) => Promise<R>,
        batchSize: number = 100
    ): Promise<R[]> {
        const results: R[] = [];
        
        for (let i = 0; i < items.length; i += batchSize) {
            const batch = items.slice(i, i + batchSize);
            const batchResults = await Promise.all(
                batch.map(item => processor(item))
            );
            results.push(...batchResults);
        }
        
        return results;
    }

    // Default CSV import implementation (can be overridden)
    async importFromCSV(filePath: string, options?: BatchImportOptions): Promise<ImportResult> {
        throw new Error('CSV import not implemented for this connector');
    }
}