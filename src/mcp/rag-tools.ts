// RAG Tools mit Zod Schema Validation
import { createTool, CommonSchemas } from '@/mcp/tool-builder.js';
import { PostgreSQLXenovaConnector } from '@/connectors/postgresql/PostgreSQLXenovaConnector.js';
import { z } from 'zod';

/**
 * RAG Tools Factory
 * Erstellt alle RAG Tools mit Zod Schema Validation
 */
export class RAGTools {
    private connector: PostgreSQLXenovaConnector;

    constructor(connector: PostgreSQLXenovaConnector) {
        this.connector = connector;
    }

    /**
     * Add Document Tool
     */
    createAddDocumentTool() {
        return createTool()
            .withName('add_document')
            .withDescription('Add a new document to the RAG knowledge base')
            .withInputSchema(CommonSchemas.documentContent)
            .withHandler(async (args) => {
                const id = await this.connector.addDocument({
                    content: args.content,
                    title: args.title,
                    metadata: args.metadata
                });

                return {
                    success: true,
                    id,
                    message: `Document added successfully with ID: ${id}`
                };
            })
            .build();
    }

    /**
     * Query Documents Tool
     */
    createQueryDocumentsTool() {
        return createTool()
            .withName('query_documents')
            .withDescription('Search for documents in the RAG knowledge base using hybrid search')
            .withInputSchema(CommonSchemas.querySchema)
            .withHandler(async (args) => {
                const results = await this.connector.search({
                    query: args.query,
                    limit: args.limit,
                    threshold: args.threshold,
                    useHybrid: args.useHybrid,
                    bm25Weight: args.bm25Weight,
                    vectorWeight: args.vectorWeight
                });

                return {
                    success: true,
                    query: args.query,
                    resultsCount: results.length,
                    results: results.map((doc: any) => ({
                        id: doc.id,
                        title: doc.title,
                        content: doc.content.substring(0, 500) + (doc.content.length > 500 ? '...' : ''),
                        score: doc.score,
                        metadata: doc.metadata
                    }))
                };
            })
            .build();
    }

    /**
     * Add Document from URL Tool
     */
    createAddDocumentFromUrlTool() {
        return createTool()
            .withName('add_document_from_url')
            .withDescription('Fetch content from a URL and add it to the RAG knowledge base')
            .withInputSchema(CommonSchemas.urlImportSchema)
            .withHandler(async (args) => {
                // Diese Funktionalität muss noch implementiert werden
                throw new Error('add_document_from_url not yet implemented');
            })
            .build();
    }

    /**
     * Import from CSV Tool
     */
    createImportFromCSVTool() {
        return createTool()
            .withName('import_from_csv')
            .withDescription('Import multiple documents from a CSV file')
            .withInputSchema(CommonSchemas.csvImportSchema)
            .withHandler(async (args) => {
                const result = await this.connector.importFromCSV(args.filePath, {
                    delimiter: args.delimiter,
                    encoding: args.encoding as BufferEncoding,
                    validateText: args.validateText,
                    skipEmptyLines: true
                });

                return {
                    success: result.success,
                    imported: result.imported,
                    failed: result.failed,
                    errors: result.errors?.slice(0, 5), // Nur erste 5 Fehler anzeigen
                    message: `CSV import completed: ${result.imported} documents imported, ${result.failed} failed`
                };
            })
            .build();
    }

    /**
     * Get RAG Status Tool
     */
    createGetRagStatusTool() {
        return createTool()
            .withName('get_rag_status')
            .withDescription('Get the current status of the RAG service including document count and database info')
            .withInputSchema(CommonSchemas.empty)
            .withHandler(async () => {
                const status = await this.connector.getStatus();
                const documentCount = await this.connector.getDocumentCount();

                return {
                    ...status,
                    documentCount,
                    architecture: 'typescript',
                    runtime: 'tsx-inline',
                    embedding: 'xenova-local'
                };
            })
            .build();
    }

    /**
     * List Documents Tool
     */
    createListDocumentsTool() {
        return createTool()
            .withName('list_documents')
            .withDescription('List all documents in the RAG knowledge base with pagination')
            .withInputSchema(z.object({
                limit: z.number().min(1).max(100).default(20).describe('Maximum number of documents to return'),
                offset: z.number().min(0).default(0).describe('Number of documents to skip'),
                includeContent: z.boolean().default(false).describe('Include document content in response')
            }))
            .withHandler(async (args) => {
                // Für jetzt eine einfache Implementierung - kann später erweitert werden
                const documentCount = await this.connector.getDocumentCount();

                return {
                    success: true,
                    total: documentCount,
                    offset: args.offset || 0,
                    limit: args.limit || 20,
                    count: 0, // Temporär, bis getAllDocuments implementiert ist
                    documents: [],
                    message: `Total documents in database: ${documentCount}. Full listing not yet implemented.`
                };
            })
            .build();
    }

    /**
     * Remove Document Tool
     */
    createRemoveDocumentTool() {
        return createTool()
            .withName('remove_document')
            .withDescription('Remove a document from the RAG knowledge base')
            .withInputSchema(CommonSchemas.documentIdSchema)
            .withHandler(async (args) => {
                await this.connector.deleteDocument(args.id);

                return {
                    success: true,
                    id: args.id,
                    message: `Document ${args.id} removed successfully`
                };
            })
            .build();
    }

    /**
     * Alle RAG Tools erstellen
     */
    createAllTools() {
        return [
            this.createAddDocumentTool(),
            this.createQueryDocumentsTool(),
            this.createAddDocumentFromUrlTool(),
            this.createImportFromCSVTool(),
            this.createGetRagStatusTool(),
            this.createListDocumentsTool(),
            this.createRemoveDocumentTool()
        ];
    }
}