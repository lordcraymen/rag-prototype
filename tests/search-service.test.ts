import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PostgreSQLSearchService } from '../src/services/PostgreSQLSearchService';

// Mock the PostgreSQL connection
const mockConnection = {
  query: vi.fn()
};

describe('PostgreSQLSearchService Unit Tests', () => {
  let searchService: PostgreSQLSearchService;

  beforeEach(() => {
    vi.clearAllMocks();
    searchService = new PostgreSQLSearchService(mockConnection as any);
  });

  describe('Vector Search', () => {
    it('should perform vector search with correct parameters', async () => {
      const mockResults = [
        {
          id: 'doc1',
          title: 'Document 1',
          content: 'Content 1',
          metadata: { source: 'test' },
          score: 0.85
        },
        {
          id: 'doc2',
          title: 'Document 2',
          content: 'Content 2',
          metadata: {},
          score: 0.75
        }
      ];

      mockConnection.query.mockResolvedValue(mockResults);

      const embedding = [0.1, 0.2, 0.3, 0.4];
      const results = await searchService.vectorSearch(embedding, 5, 0.7);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('embedding <=> $1::vector'),
        [JSON.stringify(embedding), 0.7, 5]
      );

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        id: 'doc1',
        title: 'Document 1',
        content: 'Content 1',
        metadata: { source: 'test' },
        score: 0.85,
        rank: 1
      });
      expect(results[1].rank).toBe(2);
    });

    it('should use default parameters when not provided', async () => {
      mockConnection.query.mockResolvedValue([]);
      
      const embedding = [0.1, 0.2, 0.3];
      await searchService.vectorSearch(embedding);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.any(String),
        [JSON.stringify(embedding), 0.05, 5] // default threshold and limit
      );
    });
  });

  describe('BM25 Search', () => {
    it('should perform BM25 text search', async () => {
      const mockResults = [
        {
          id: 'doc3',
          title: 'BM25 Document',
          content: 'Content with search terms',
          metadata: {},
          score: 2.5
        }
      ];

      mockConnection.query.mockResolvedValue(mockResults);

      const results = await searchService.bm25Search('search terms', 3);

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('bm25_score'),
        ['search terms', 3]
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: 'doc3',
        title: 'BM25 Document',
        content: 'Content with search terms',
        metadata: {},
        score: 2.5,
        bm25_score: 2.5,
        rank: 1
      });
    });
  });

  describe('Hybrid Search', () => {
    it('should perform hybrid search when embedding is provided', async () => {
      const embedding = [0.1, 0.2, 0.3, 0.4];
      const mockResults = [
        {
          id: 'doc4',
          title: 'Hybrid Document',
          content: 'Hybrid content',
          metadata: {},
          vector_similarity: 0.82,
          bm25_score: 1.6,
          hybrid_score: 0.91
        }
      ];

      mockConnection.query.mockResolvedValue(mockResults);

      const results = await searchService.hybridSearch('test query', {
        limit: 2,
        bm25Weight: 0.4,
        vectorWeight: 0.6,
        queryEmbedding: embedding
      });

      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('hybrid_search_documents'),
        ['test query', JSON.stringify(embedding), 0.05, 0.4, 0.6, 2]
      );

      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({
        id: 'doc4',
        title: 'Hybrid Document',
        content: 'Hybrid content',
        metadata: {},
        score: 0.91,
        bm25_score: 1.6,
        vector_score: 0.82,
        rank: 1
      });
    });

    it('should fall back to BM25 search with warning when embedding missing', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const mockResults = [
        {
          id: 'doc4',
          title: 'Hybrid Document',
          content: 'Hybrid content',
          metadata: {},
          score: 1.8
        }
      ];

      mockConnection.query.mockResolvedValue(mockResults);

      const results = await searchService.hybridSearch('test query', { limit: 2 });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('hybridSearch called without queryEmbedding')
      );
      expect(mockConnection.query).toHaveBeenCalledWith(
        expect.stringContaining('bm25_score'),
        ['test query', 2]
      );
      expect(results).toEqual([
        {
          id: 'doc4',
          title: 'Hybrid Document',
          content: 'Hybrid content',
          metadata: {},
          score: 1.8,
          bm25_score: 1.8,
          rank: 1
        }
      ]);

      consoleSpy.mockRestore();
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockConnection.query.mockRejectedValue(new Error('Database connection failed'));

      await expect(searchService.vectorSearch([0.1, 0.2, 0.3]))
        .rejects.toThrow('Database connection failed');
    });

    it('should handle empty results', async () => {
      mockConnection.query.mockResolvedValue([]);

      const results = await searchService.vectorSearch([0.1, 0.2, 0.3]);
      expect(results).toEqual([]);
    });
  });

  describe('Raw Query', () => {
    it('should execute raw SQL queries', async () => {
      const mockData = [{ count: 212 }];
      mockConnection.query.mockResolvedValue(mockData);

      const result = await searchService.rawQuery('SELECT COUNT(*) as count FROM documents');

      expect(mockConnection.query).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM documents',
        undefined
      );
      expect(result).toEqual(mockData);
    });

    it('should execute raw SQL queries with parameters', async () => {
      const mockData = [{ id: 'doc1', title: 'Test' }];
      mockConnection.query.mockResolvedValue(mockData);

      const result = await searchService.rawQuery(
        'SELECT * FROM documents WHERE id = $1',
        ['doc1']
      );

      expect(mockConnection.query).toHaveBeenCalledWith(
        'SELECT * FROM documents WHERE id = $1',
        ['doc1']
      );
      expect(result).toEqual(mockData);
    });
  });
});