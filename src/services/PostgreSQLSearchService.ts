// PostgreSQL search service implementation

import { PoolClient } from 'pg';
import { ISearchService } from '@/types/database.js';
import { SearchResult, SearchOptions } from '@/types/index.js';
import { PostgreSQLConnection } from '../connectors/postgresql/PostgreSQLConnection.js';

export class PostgreSQLSearchService implements ISearchService {
    private connection: PostgreSQLConnection;

    constructor(connection: PostgreSQLConnection) {
        this.connection = connection;
    }

    async vectorSearch(embedding: number[], limit: number = 5, threshold: number = 0.05): Promise<SearchResult[]> {
        const query = `
            SELECT 
                id,
                title,
                content,
                metadata,
                1 - (embedding <=> $1::vector) as score
            FROM documents 
            WHERE 1 - (embedding <=> $1::vector) > $2
            ORDER BY embedding <=> $1::vector
            LIMIT $3
        `;

        const rows = await this.connection.query(query, [
            JSON.stringify(embedding),
            threshold,
            limit
        ]);

        return rows.map((row: any, index: number) => ({
            id: row.id,
            title: row.title,
            content: row.content,
            metadata: row.metadata || {},
            score: parseFloat(row.score),
            rank: index + 1
        }));
    }

    async bm25Search(query: string, limit: number = 5): Promise<SearchResult[]> {
        const sql = `
            SELECT 
                id,
                title,
                content,
                metadata,
                bm25_score(content, $1) as score
            FROM documents 
            WHERE to_tsvector('english', content) @@ plainto_tsquery('english', $1)
            ORDER BY score DESC
            LIMIT $2
        `;

        const rows = await this.connection.query(sql, [query, limit]);

        return rows.map((row: any, index: number) => ({
            id: row.id,
            title: row.title,
            content: row.content,
            metadata: row.metadata || {},
            score: parseFloat(row.score),
            bm25_score: parseFloat(row.score),
            rank: index + 1
        }));
    }

    async hybridSearch(query: string, options?: Partial<SearchOptions>): Promise<SearchResult[]> {
        const {
            limit = 5,
            threshold = 0.05,
            bm25Weight = 0.3,
            vectorWeight = 0.7
        } = options || {};

        // For now, fall back to BM25 search since we need embeddings from the service layer
        // The proper fix would be to inject the embedding service or get embeddings from the caller
        console.warn('⚠️ hybridSearch falling back to BM25 search - embedding generation needed at service layer');
        return this.bm25Search(query, limit);
    }

    // Helper method for raw SQL queries
    async rawQuery(sql: string, params?: any[]): Promise<any[]> {
        return this.connection.query(sql, params);
    }

    // Get search statistics
    async getSearchStats(): Promise<{
        totalDocuments: number;
        avgContentLength: number;
        embeddingDimensions: number;
    }> {
        const stats = await this.connection.query(`
            SELECT 
                COUNT(*) as total_documents,
                AVG(LENGTH(content)) as avg_content_length,
                array_length(embedding, 1) as embedding_dimensions
            FROM documents
            WHERE embedding IS NOT NULL
            LIMIT 1
        `);

        const row = stats[0] || {};
        return {
            totalDocuments: parseInt(row.total_documents) || 0,
            avgContentLength: parseFloat(row.avg_content_length) || 0,
            embeddingDimensions: parseInt(row.embedding_dimensions) || 0
        };
    }
}