import { Document } from '@/types/index.js';
import { XenovaEmbeddingService } from '@/services/XenovaEmbeddingService.js';
import { EmbeddingBatchHelper } from './EmbeddingBatchHelper.js';

interface XenovaBatchHelperOptions {
    batchSize?: number;
}

export class XenovaBatchEmbeddingHelper implements EmbeddingBatchHelper {
    private embeddingService: XenovaEmbeddingService;
    private options: XenovaBatchHelperOptions;

    constructor(embeddingService: XenovaEmbeddingService, options: XenovaBatchHelperOptions = {}) {
        this.embeddingService = embeddingService;
        this.options = options;
    }

    getBatchSize(_defaultSize: number): number {
        return this.options.batchSize ?? 50;
    }

    async onConnect(): Promise<void> {
        await this.embeddingService.initializePipeline();
    }

    async generateEmbeddings(documents: Document[], context: { batchNumber: number }): Promise<number[][]> {
        if (documents.length === 0) {
            return [];
        }

        const texts = documents.map(document => document.content);
        console.error(`🧠 Generating ${texts.length} embeddings for batch ${context.batchNumber}...`);
        const embeddings = await this.embeddingService.generateEmbeddings(texts);

        if (embeddings.length !== documents.length) {
            throw new Error(`Expected ${documents.length} embeddings, received ${embeddings.length}`);
        }

        return embeddings;
    }
}
