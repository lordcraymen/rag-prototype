// Local Xenova embedding service implementation - no API key required

import { IEmbeddingService } from '@/types/database.js';

export class XenovaEmbeddingService implements IEmbeddingService {
    private pipeline: any = null;
    private model: string;
    private dimensions: number;

    constructor(model: string = 'Xenova/all-MiniLM-L6-v2') {
        this.model = model;
        this.dimensions = 384; // all-MiniLM-L6-v2 has 384 dimensions
    }

    async initializePipeline() {
        if (this.pipeline) {
            return this.pipeline;
        }

        try {
            // Dynamic import of @xenova/transformers
            const { pipeline } = await import('@xenova/transformers');
            
            console.error(`🧠 Loading embedding model: ${this.model}...`);
            this.pipeline = await pipeline('feature-extraction', this.model);
            console.error('✅ Embedding model loaded successfully');
            
            return this.pipeline;
        } catch (error) {
            throw new Error(`Failed to initialize Xenova pipeline: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        if (!text || text.trim().length === 0) {
            throw new Error('Text cannot be empty');
        }

        try {
            const pipeline = await this.initializePipeline();
            
            // Generate embedding
            const output = await pipeline(text.trim(), {
                pooling: 'mean',
                normalize: true
            });

            // Convert tensor to array
            const embedding = Array.from(output.data) as number[];
            
            if (!embedding || embedding.length !== this.dimensions) {
                throw new Error(`Expected ${this.dimensions} dimensions, got ${embedding.length}`);
            }

            return embedding;
            
        } catch (error) {
            throw new Error(`Failed to generate embedding: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    getDimensions(): number {
        return this.dimensions;
    }

    async isAvailable(): Promise<boolean> {
        try {
            await this.initializePipeline();
            // Test with a simple text
            await this.generateEmbedding('test');
            return true;
        } catch {
            return false;
        }
    }

    // Batch embedding generation for efficiency
    async generateEmbeddings(texts: string[]): Promise<number[][]> {
        if (!texts || texts.length === 0) {
            return [];
        }

        // Filter out empty texts
        const validTexts = texts.filter(text => text && text.trim().length > 0);
        if (validTexts.length === 0) {
            throw new Error('No valid texts provided');
        }

        try {
            const pipeline = await this.initializePipeline();
            
            // Process all texts in batch
            const embeddings: number[][] = [];
            
            for (const text of validTexts) {
                const output = await pipeline(text.trim(), {
                    pooling: 'mean',
                    normalize: true
                });
                embeddings.push(Array.from(output.data) as number[]);
            }

            return embeddings;
            
        } catch (error) {
            throw new Error(`Failed to generate embeddings: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    // Get model information
    getModelInfo() {
        return {
            model: this.model,
            dimensions: this.dimensions,
            provider: 'Xenova/Transformers.js',
            local: true,
            apiKeyRequired: false
        };
    }
}