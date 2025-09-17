// Core type definitions for the RAG system

export interface Document {
    id?: string;
    title?: string;
    content: string;
    metadata?: Record<string, any>;
    embedding?: number[];
    created_at?: Date;
    updated_at?: Date;
}

export interface SearchResult {
    id: string;
    title?: string;
    content: string;
    metadata?: Record<string, any>;
    score: number;
    bm25_score?: number;
    vector_score?: number;
    rank?: number;
}

export interface SearchOptions {
    query: string;
    limit?: number;
    threshold?: number;
    useHybrid?: boolean;
    bm25Weight?: number;
    vectorWeight?: number;
    /**
     * Optional precomputed embedding for the query. When provided the search
     * services can reuse it instead of generating a fresh embedding.
     */
    queryEmbedding?: number[];
}

export interface EmbeddingVector {
    vector: number[];
    dimensions: number;
}

export interface DatabaseConfig {
    host: string;
    port: number;
    database: string;
    user: string;
    password: string;
    ssl?: boolean;
}

export interface ConnectionStatus {
    connected: boolean;
    database?: string;
    host?: string;
    error?: string;
    embedding?: any; // Model info for embedding service
}

export interface ImportResult {
    success: boolean;
    imported: number;
    failed: number;
    errors?: string[];
}

export interface BatchImportOptions {
    delimiter?: string;
    encoding?: string;
    skipEmptyLines?: boolean;
    validateText?: boolean;
}