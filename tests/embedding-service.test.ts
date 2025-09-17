import { describe, it, expect, vi, beforeEach } from 'vitest';
import { XenovaEmbeddingService } from '../src/services/XenovaEmbeddingService';

// Mock @xenova/transformers
const mockPipeline = vi.fn().mockImplementation(async (text: string | string[]) => {
  // Return proper tensor-like structure with data property
  return {
    data: new Array(384).fill(0).map(() => Math.random())
  };
});

vi.mock('@xenova/transformers', () => ({
  pipeline: vi.fn().mockResolvedValue(mockPipeline),
  env: {
    allowLocalModels: true,
    allowRemoteModels: false
  }
}));

describe('XenovaEmbeddingService Unit Tests', () => {
  let embeddingService: XenovaEmbeddingService;

  beforeEach(() => {
    vi.clearAllMocks();
    embeddingService = new XenovaEmbeddingService('Xenova/all-MiniLM-L6-v2');
  });

  describe('Model Information', () => {
    it('should return correct model info', () => {
      const modelInfo = embeddingService.getModelInfo();
      
      expect(modelInfo).toEqual({
        model: 'Xenova/all-MiniLM-L6-v2',
        dimensions: 384,
        provider: 'Xenova/Transformers.js',
        local: true,
        apiKeyRequired: false
      });
    });

    it('should return correct dimensions', () => {
      expect(embeddingService.getDimensions()).toBe(384);
    });
  });

  describe('Embedding Generation', () => {
    it('should generate single embedding with correct dimensions', async () => {
      await embeddingService.initializePipeline();
      const embedding = await embeddingService.generateEmbedding('test text');
      
      expect(embedding).toHaveLength(384);
      expect(embedding.every(num => typeof num === 'number')).toBe(true);
    });

    it('should generate multiple embeddings', async () => {
      await embeddingService.initializePipeline();
      const texts = ['first text', 'second text', 'third text'];
      const embeddings = await embeddingService.generateEmbeddings(texts);
      
      expect(embeddings).toHaveLength(3);
      embeddings.forEach(embedding => {
        expect(embedding).toHaveLength(384);
        expect(embedding.every(num => typeof num === 'number')).toBe(true);
      });
    });

    it('should handle empty input gracefully', async () => {
      await embeddingService.initializePipeline();
      const embeddings = await embeddingService.generateEmbeddings([]);
      
      expect(embeddings).toEqual([]);
    });

    it('should validate input text is not empty', async () => {
      await embeddingService.initializePipeline();
      
      await expect(embeddingService.generateEmbedding('')).rejects.toThrow();
      await expect(embeddingService.generateEmbedding('   ')).rejects.toThrow();
    });
  });

  describe('Pipeline Initialization', () => {
    it('should initialize pipeline successfully', async () => {
      await expect(embeddingService.initializePipeline()).resolves.not.toThrow();
    });

    it('should handle multiple initialization calls', async () => {
      await embeddingService.initializePipeline();
      await embeddingService.initializePipeline(); // Should not fail
      
      const embedding = await embeddingService.generateEmbedding('test');
      expect(embedding).toHaveLength(384);
    });
  });
});