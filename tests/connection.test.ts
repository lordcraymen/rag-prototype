import { describe, it, expect } from 'vitest';
import { PostgreSQLConnector } from '../src/connectors/postgresql/PostgreSQLConnector';
import { createXenovaConnector } from '../src/connectors/postgresql/factories';

const config = { host: 'localhost', port: 5432, database: 'rag', user: 'postgres', password: 'postgres' };

describe('Database Connection', () => {
  it('should connect and disconnect to PostgreSQL', async () => {
    const db: PostgreSQLConnector = createXenovaConnector(config);
    await db.connect();
    expect(db.isConnected()).toBe(true);
    await db.disconnect();
    expect(db.isConnected()).toBe(false);
  });
});