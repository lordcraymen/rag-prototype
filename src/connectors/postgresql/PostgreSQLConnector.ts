// PostgreSQL database connector implementation

import { DatabaseConnector } from '../DatabaseConnector.js';
import { PostgreSQLConnection } from './PostgreSQLConnection.js';
import { OpenAIEmbeddingService } from '../../services/OpenAIEmbeddingService.js';
import { PostgreSQLSearchService } from '../../services/PostgreSQLSearchService.js';
import { Document, SearchResult, ConnectionStatus, ImportResult, BatchImportOptions, DatabaseConfig } from '@/types/index.js';
import { createReadStream } from 'fs';
import { parse } from 'csv-parse';
import { PoolClient } from 'pg';

export class PostgreSQLConnector extends DatabaseConnector {
    private postgresConnection: PostgreSQLConnection;
    private config: DatabaseConfig;

    constructor(config: DatabaseConfig, openaiApiKey: string) {
        const connection = new PostgreSQLConnection(config);
        const embeddingService = new OpenAIEmbeddingService(openaiApiKey);
        const searchService = new PostgreSQLSearchService(connection);
        
        super(connection, embeddingService, searchService);
        
        this.postgresConnection = connection;
        this.config = config;
    }

    async connect(): Promise<void> {
        await this.postgresConnection.connect();
    }

    async disconnect(): Promise<void> {
        await this.postgresConnection.disconnect();
    }

    async getStatus(): Promise<ConnectionStatus> {
        const baseStatus = await super.getStatus();
        const stats = this.postgresConnection.getPoolStats();
        
        return {
            ...baseStatus,
            database: this.config.database,
            host: this.config.host,
            ...stats
        };
    }

    async addDocument(document: Document): Promise<string> {
        this.validateDocument(document);

        // Generate embedding if not provided
        let embedding = document.embedding;
        if (!embedding) {
            const embeddingResult = await this.generateEmbedding(document.content);
            embedding = embeddingResult.vector;
        }

        const query = `
            INSERT INTO documents (title, content, metadata, embedding, created_at, updated_at)
            VALUES ($1, $2, $3, $4, NOW(), NOW())
            RETURNING id
        `;

        const rows = await this.postgresConnection.query(query, [
            document.title || null,
            document.content,
            JSON.stringify(document.metadata || {}),
            JSON.stringify(embedding)
        ]);

        return rows[0].id;
    }

    async addDocuments(documents: Document[]): Promise<ImportResult> {
        if (!documents || documents.length === 0) {
            return { success: true, imported: 0, failed: 0 };
        }

        let imported = 0;
        let failed = 0;
        const errors: string[] = [];

        // Process in batches using transaction
        const batchSize = 100;
        
        for (let i = 0; i < documents.length; i += batchSize) {
            const batch = documents.slice(i, i + batchSize);
            
            try {
                await this.postgresConnection.transaction(async (client: PoolClient) => {
                    for (const document of batch) {
                        try {
                            this.validateDocument(document);
                            
                            // Generate embedding if not provided
                            let embedding = document.embedding;
                            if (!embedding) {
                                const embeddingResult = await this.generateEmbedding(document.content);
                                embedding = embeddingResult.vector;
                            }

                            await client.query(`
                                INSERT INTO documents (title, content, metadata, embedding, created_at, updated_at)
                                VALUES ($1, $2, $3, $4, NOW(), NOW())
                            `, [
                                document.title || null,
                                document.content,
                                JSON.stringify(document.metadata || {}),
                                JSON.stringify(embedding)
                            ]);
                            
                            imported++;
                        } catch (error) {
                            failed++;
                            errors.push(`Document ${i + imported + failed}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        }
                    }
                });
            } catch (error) {
                // If whole batch fails, count all as failed
                failed += batch.length;
                errors.push(`Batch ${Math.floor(i / batchSize)}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        return {
            success: failed === 0,
            imported,
            failed,
            errors: errors.length > 0 ? errors : undefined
        };
    }

    async updateDocument(id: string, document: Partial<Document>): Promise<void> {
        const updates: string[] = [];
        const values: any[] = [];
        let paramIndex = 1;

        if (document.title !== undefined) {
            updates.push(`title = $${paramIndex++}`);
            values.push(document.title);
        }

        if (document.content !== undefined) {
            if (!document.content || document.content.trim().length === 0) {
                throw new Error('Document content cannot be empty');
            }
            updates.push(`content = $${paramIndex++}`);
            values.push(document.content);
            
            // Regenerate embedding if content changed
            const embeddingResult = await this.generateEmbedding(document.content);
            updates.push(`embedding = $${paramIndex++}`);
            values.push(JSON.stringify(embeddingResult.vector));
        } else if (document.embedding) {
            updates.push(`embedding = $${paramIndex++}`);
            values.push(JSON.stringify(document.embedding));
        }

        if (document.metadata !== undefined) {
            updates.push(`metadata = $${paramIndex++}`);
            values.push(JSON.stringify(document.metadata));
        }

        if (updates.length === 0) {
            return; // Nothing to update
        }

        updates.push(`updated_at = NOW()`);
        values.push(id);

        const query = `
            UPDATE documents 
            SET ${updates.join(', ')}
            WHERE id = $${paramIndex}
        `;

        await this.postgresConnection.query(query, values);
    }

    async deleteDocument(id: string): Promise<void> {
        await this.postgresConnection.query('DELETE FROM documents WHERE id = $1', [id]);
    }

    async getDocument(id: string): Promise<Document | null> {
        const rows = await this.postgresConnection.query(
            'SELECT * FROM documents WHERE id = $1',
            [id]
        );

        if (rows.length === 0) {
            return null;
        }

        const row = rows[0];
        return {
            id: row.id,
            title: row.title,
            content: row.content,
            metadata: row.metadata || {},
            embedding: row.embedding ? JSON.parse(row.embedding) : undefined,
            created_at: row.created_at,
            updated_at: row.updated_at
        };
    }

    async getDocumentCount(): Promise<number> {
        const rows = await this.postgresConnection.query('SELECT COUNT(*) as count FROM documents');
        return parseInt(rows[0].count);
    }

    async clearAllDocuments(): Promise<void> {
        await this.postgresConnection.query('DELETE FROM documents');
    }

    async initializeDatabase(): Promise<void> {
        // Create extension and tables if they don't exist
        await this.postgresConnection.query('CREATE EXTENSION IF NOT EXISTS vector');
        
        // This assumes the database schema is already created via init.sql
        // In a production environment, you might want to check and create tables here
        const tableExists = await this.postgresConnection.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'documents'
            )
        `);

        if (!tableExists[0].exists) {
            throw new Error('Documents table does not exist. Please run the database initialization script.');
        }
    }

    async resetDatabase(): Promise<void> {
        await this.clearAllDocuments();
    }

    // CSV import implementation
    async importFromCSV(filePath: string, options?: BatchImportOptions): Promise<ImportResult> {
        const {
            delimiter = ',',
            encoding = 'utf8',
            skipEmptyLines = true,
            validateText = true
        } = options || {};

        return new Promise((resolve, reject) => {
            const documents: Document[] = [];
            const errors: string[] = [];
            let lineNumber = 0;

            const parser = parse({
                delimiter,
                columns: true,
                skip_empty_lines: skipEmptyLines,
                encoding: encoding as BufferEncoding
            });

            parser.on('data', (row: any) => {
                lineNumber++;
                try {
                    // Transform CSV row to document
                    const document = this.transformCSVRow(row, validateText);
                    if (document) {
                        documents.push(document);
                    }
                } catch (error) {
                    errors.push(`Line ${lineNumber}: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            });

            parser.on('error', (error: Error) => {
                reject(new Error(`CSV parsing error: ${error.message}`));
            });

            parser.on('end', async () => {
                try {
                    const result = await this.addDocuments(documents);
                    
                    // Combine CSV parsing errors with import errors
                    const allErrors = [...errors, ...(result.errors || [])];
                    
                    resolve({
                        success: result.success && errors.length === 0,
                        imported: result.imported,
                        failed: result.failed + errors.length,
                        errors: allErrors.length > 0 ? allErrors : undefined
                    });
                } catch (error) {
                    reject(error);
                }
            });

            // Start reading the file
            createReadStream(filePath, { encoding: encoding as BufferEncoding })
                .pipe(parser);
        });
    }

    private transformCSVRow(row: any, validateText: boolean = true): Document | null {
        // Flexible column mapping
        let content = row.content || row.text || row.description || row.body;
        let title = row.title || row.name || row.subject;
        
        // Handle German CSV format (semicolon-separated)
        if (!content) {
            // Try to find content in any column that looks like content
            const contentKeys = Object.keys(row).find(key => 
                key.toLowerCase().includes('content') || 
                key.toLowerCase().includes('text') ||
                key.toLowerCase().includes('beschreibung') ||
                key.toLowerCase().includes('inhalt')
            );
            if (contentKeys) {
                content = row[contentKeys];
            }
        }

        if (!title) {
            const titleKeys = Object.keys(row).find(key => 
                key.toLowerCase().includes('title') || 
                key.toLowerCase().includes('name') ||
                key.toLowerCase().includes('titel') ||
                key.toLowerCase().includes('bezeichnung')
            );
            if (titleKeys) {
                title = row[titleKeys];
            }
        }

        // Validate content
        if (!content) {
            if (validateText) {
                throw new Error('Content field is required but missing or empty');
            }
            return null;
        }

        if (typeof content !== 'string') {
            content = String(content);
        }

        if (validateText && content.trim().length === 0) {
            throw new Error('Content cannot be empty');
        }

        // Create metadata from remaining fields
        const metadata: Record<string, any> = {};
        for (const [key, value] of Object.entries(row)) {
            if (key !== 'content' && key !== 'text' && key !== 'title' && key !== 'name') {
                metadata[key] = value;
            }
        }

        return {
            title: title ? String(title).trim() : undefined,
            content: content.trim(),
            metadata: Object.keys(metadata).length > 0 ? metadata : undefined
        };
    }
}