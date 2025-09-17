// Database connector interface definitions

import { Document, SearchResult, SearchOptions, EmbeddingVector, ConnectionStatus, ImportResult, BatchImportOptions, DatabaseConfig } from './index.js';

export { DatabaseConfig };

export interface IDatabaseConnector {
    // Connection management
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    getStatus(): Promise<ConnectionStatus>;

    // Document operations
    addDocument(document: Document): Promise<string>;
    addDocuments(documents: Document[]): Promise<ImportResult>;
    updateDocument(id: string, document: Partial<Document>): Promise<void>;
    deleteDocument(id: string): Promise<void>;
    getDocument(id: string): Promise<Document | null>;

    // Search operations
    search(options: SearchOptions): Promise<SearchResult[]>;
    vectorSearch(embedding: number[], limit?: number, threshold?: number): Promise<SearchResult[]>;
    hybridSearch(query: string, options?: Partial<SearchOptions>): Promise<SearchResult[]>;

    // Embedding operations
    generateEmbedding(text: string): Promise<EmbeddingVector>;
    
    // Batch operations
    importFromCSV(filePath: string, options?: BatchImportOptions): Promise<ImportResult>;
    clearAllDocuments(): Promise<void>;
    
    // Database management
    initializeDatabase(): Promise<void>;
    resetDatabase(): Promise<void>;
    getDocumentCount(): Promise<number>;
}

export interface IEmbeddingService {
    generateEmbedding(text: string): Promise<number[]>;
    getDimensions(): number;
    isAvailable(): Promise<boolean>;
}

export interface ISearchService {
    vectorSearch(embedding: number[], limit?: number, threshold?: number): Promise<SearchResult[]>;
    hybridSearch(query: string, options?: Partial<SearchOptions>): Promise<SearchResult[]>;
    bm25Search(query: string, limit?: number): Promise<SearchResult[]>;
}

export interface IDatabaseConnection {
    connect(): Promise<void>;
    disconnect(): Promise<void>;
    isConnected(): boolean;
    query(sql: string, params?: any[]): Promise<any>;
    transaction<T>(callback: (client: any) => Promise<T>): Promise<T>;
}