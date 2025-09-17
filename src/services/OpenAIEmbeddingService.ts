// OpenAI embedding service implementation

import OpenAI from 'openai';
import { IEmbeddingService } from '@/types/database.js';

export class OpenAIEmbeddingService implements IEmbeddingService {
    private openai: OpenAI;
    private model: string;
    private dimensions: number;

    constructor(apiKey: string, model: string = 'text-embedding-3-small') {
        this.openai = new OpenAI({ apiKey });
        this.model = model;
        
        // Set dimensions based on model
        switch (model) {
            case 'text-embedding-3-small':
                this.dimensions = 1536;
                break;
            case 'text-embedding-3-large':
                this.dimensions = 3072;
                break;
            case 'text-embedding-ada-002':
                this.dimensions = 1536;
                break;
            default:
                this.dimensions = 1536;
        }
    }

    async generateEmbedding(text: string): Promise<number[]> {
        if (!text || text.trim().length === 0) {
            throw new Error('Text cannot be empty');
        }

        try {
            const response = await this.openai.embeddings.create({
                model: this.model,
                input: text.trim(),
                encoding_format: 'float'
            });

            if (!response.data || response.data.length === 0) {
                throw new Error('No embedding data received from OpenAI');
            }

            return response.data[0].embedding;
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to generate embedding: ${error.message}`);
            }
            throw new Error('Failed to generate embedding: Unknown error');
        }
    }

    getDimensions(): number {
        return this.dimensions;
    }

    async isAvailable(): Promise<boolean> {
        try {
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
            const response = await this.openai.embeddings.create({
                model: this.model,
                input: validTexts.map(text => text.trim()),
                encoding_format: 'float'
            });

            if (!response.data || response.data.length !== validTexts.length) {
                throw new Error('Mismatch in embedding data received from OpenAI');
            }

            return response.data.map((item: any) => item.embedding);
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`Failed to generate embeddings: ${error.message}`);
            }
            throw new Error('Failed to generate embeddings: Unknown error');
        }
    }
}