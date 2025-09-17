import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PostgreSQLConnector } from '../src/connectors/postgresql/PostgreSQLConnector';
import { createXenovaConnector } from '../src/connectors/postgresql/factories';

const testConfig = {
  host: 'localhost',
  port: 5432,
  database: 'rag',
  user: 'postgres',
  password: 'postgres'
};

describe('RAG System Integration Tests', () => {
  let connector: PostgreSQLConnector;

  beforeAll(async () => {
    connector = createXenovaConnector(testConfig);
    await connector.connect();
  });

  afterAll(async () => {
    await connector.disconnect();
  });

  describe('System Status', () => {
    it('should return comprehensive system status', async () => {
      const status = await connector.getStatus();
      
      expect(status).toMatchObject({
        connected: true,
        database: 'rag',
        host: 'localhost',
        embedding: expect.objectContaining({
          model: 'Xenova/all-MiniLM-L6-v2',
          dimensions: 384,
          provider: 'Xenova/Transformers.js',
          local: true,
          apiKeyRequired: false
        })
      });
    });

    it('should have proper database connection pool', async () => {
      const status = await connector.getStatus();
      
      expect(status.totalCount).toBeGreaterThanOrEqual(0);
      expect(status.idleCount).toBeGreaterThanOrEqual(0);
      expect(status.waitingCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Document Operations (Read-Only)', () => {
    it('should get document count', async () => {
      const count = await connector.getDocumentCount();
      expect(count).toBeGreaterThan(0);
      expect(typeof count).toBe('number');
    });

    it('should perform search operations', async () => {
      const results = await connector.search({
        query: 'Steuer',
        limit: 3,
        threshold: 0.1
      });

      expect(Array.isArray(results)).toBe(true);
      if (results.length > 0) {
        expect(results[0]).toMatchObject({
          id: expect.any(String),
          title: expect.any(String),
          content: expect.any(String),
          score: expect.any(Number)
        });
      }
    });
  });

  describe('Embedding Generation', () => {
    it('should generate embeddings with correct format', async () => {
      const embedding = await connector.generateEmbedding('Test text for embedding');
      
      expect(embedding).toMatchObject({
        vector: expect.any(Array),
        dimensions: 384
      });
      
      expect(embedding.vector).toHaveLength(384);
      expect(embedding.vector.every((num: number) => typeof num === 'number')).toBe(true);
    });
  });
});