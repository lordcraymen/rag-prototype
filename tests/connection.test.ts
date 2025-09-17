import { describe, it, expect } from 'vitest';
import { PostgreSQLXenovaConnector } from '../src/connectors/postgresql/PostgreSQLXenovaConnector';

const config = { host: 'localhost', port: 5432, database: 'rag', user: 'postgres', password: 'postgres' };

describe('Database Connection', () => {
  it('should connect and disconnect to PostgreSQL', async () => {
    const db = new PostgreSQLXenovaConnector(config);
    await db.connect();
    expect(db.isConnected()).toBe(true);
    await db.disconnect();
    expect(db.isConnected()).toBe(false);
  });
});