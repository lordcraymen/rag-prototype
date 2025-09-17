import { Document } from '@/types/index.js';

export interface EmbeddingBatchHelper {
    /**
     * Hook that allows the helper to run initialization logic when the connector connects.
     */
    onConnect?(): Promise<void>;

    /**
     * Optionally override the default batch size used during bulk imports.
     */
    getBatchSize?(defaultSize: number): number;

    /**
     * Generate embeddings for the provided documents.
     * The helper should return an embedding vector for each document in the same order.
     */
    generateEmbeddings(documents: Document[], context: { batchNumber: number }): Promise<number[][]>;
}
