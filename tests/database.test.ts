import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostgreSQLXenovaConnector } from '../src/connectors/postgresql/PostgreSQLXenovaConnector';
import { SearchOptions } from '../src/types/index';

// Mock the database connection
const mockConnection = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  isConnected: vi.fn(() => true),
  query: vi.fn(),
  transaction: vi.fn(),
  getClient: vi.fn(),
  getPoolStats: vi.fn(() => ({ totalCount: 1, idleCount: 1, waitingCount: 0 }))
};

// Mock the embedding service
const mockEmbeddingService = {
  generateEmbedding: vi.fn().mockResolvedValue([0.1, 0.2, 0.3, 0.4]),
  generateEmbeddings: vi.fn().mockResolvedValue([[0.1, 0.2, 0.3, 0.4]]),
  getDimensions: vi.fn(() => 384),
  initializePipeline: vi.fn(),
  getModelInfo: vi.fn(() => ({
    model: 'Xenova/all-MiniLM-L6-v2',
    dimensions: 384,
    provider: 'Xenova/Transformers.js',
    local: true,
    apiKeyRequired: false
  }))
};

// Mock the search service
const mockSearchService = {
  vectorSearch: vi.fn().mockResolvedValue([
    {
      id: 'doc1',
      title: 'Test Document',
      content: 'Test content',
      metadata: {},
      score: 0.85,
      rank: 1
    }
  ]),
  bm25Search: vi.fn().mockResolvedValue([]),
  hybridSearch: vi.fn().mockResolvedValue([])
};

describe('Database Connector Business Logic', () => {
  let connector: PostgreSQLXenovaConnector;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Create connector with mocked dependencies
    connector = new PostgreSQLXenovaConnector({
      host: 'localhost',
      port: 5432,
      database: 'rag',
      user: 'postgres',
      password: 'postgres'
    });
    
    // Mock the postgresConnection to return stats
    const mockPostgresConnection = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      isConnected: vi.fn(() => true),
      getPoolStats: vi.fn(() => ({ totalCount: 1, idleCount: 1, waitingCount: 0 })),
      query: vi.fn()
    };
    
    // Inject mocks
    (connector as any).connection = mockConnection;
    (connector as any).postgresConnection = mockPostgresConnection;
    (connector as any).embeddingService = mockEmbeddingService;
    (connector as any).searchService = mockSearchService;
  });

  describe('Search Operations', () => {
    it('should generate embedding and perform vector search', async () => {
      const searchOptions: SearchOptions = {
        query: 'test query',
        limit: 5,
        threshold: 0.7,
        useHybrid: false
      };

      const results = await connector.search(searchOptions);

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('test query');
      expect(mockSearchService.vectorSearch).toHaveBeenCalledWith([0.1, 0.2, 0.3, 0.4], 5, 0.7);
      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('Test Document');
    });

    it('should use hybrid search when enabled', async () => {
      const searchOptions: SearchOptions = {
        query: 'test query',
        limit: 3,
        useHybrid: true
      };

      await connector.search(searchOptions);

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('test query');
      expect(mockSearchService.vectorSearch).toHaveBeenCalledWith([0.1, 0.2, 0.3, 0.4], 3, undefined);
    });
  });

  describe('Status and Information', () => {
    it('should return correct status information', async () => {
      const status = await connector.getStatus();

      expect(status).toMatchObject({
        connected: true,
        database: 'rag',
        host: 'localhost',
        embedding: {
          model: 'Xenova/all-MiniLM-L6-v2',
          dimensions: 384,
          provider: 'Xenova/Transformers.js',
          local: true,
          apiKeyRequired: false
        }
      });
      
      // Pool stats should be present from mock
      expect(status.totalCount).toBe(1);
      expect(status.idleCount).toBe(1);
      expect(status.waitingCount).toBe(0);
    });

    it('should check connection status correctly', () => {
      expect(connector.isConnected()).toBe(true);
      
      mockConnection.isConnected.mockReturnValue(false);
      expect(connector.isConnected()).toBe(false);
    });
  });

  describe('Embedding Generation', () => {
    it('should generate embeddings with correct dimensions', async () => {
      const result = await connector.generateEmbedding('test text');

      expect(mockEmbeddingService.generateEmbedding).toHaveBeenCalledWith('test text');
      expect(result).toEqual({
        vector: [0.1, 0.2, 0.3, 0.4],
        dimensions: 384
      });
    });
  });
});