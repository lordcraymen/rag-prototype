import { describe, it, expect } from 'vitest';
import { getDefaultConfig, readConfig } from '../src/utils/config';

describe('Configuration', () => {
  it('should load default config with required properties', () => {
    const config = getDefaultConfig();
    
    expect(config).toBeDefined();
    expect(config.database).toBeDefined();
    expect(config.database.host).toBeTypeOf('string');
    expect(config.database.port).toBeTypeOf('number');
    expect(config.database.database).toBeTypeOf('string');
    expect(config.database.user).toBeTypeOf('string');
    expect(config.database.password).toBeTypeOf('string');
    
    expect(config.server).toBeDefined();
    expect(config.server.name).toBeTypeOf('string');
    expect(config.server.version).toBeTypeOf('string');
  });

  it('should read config using environment variables', () => {
    const config = readConfig();
    
    expect(config).toBeDefined();
    expect(config.database.host).toBe('localhost'); // default value
    expect(config.database.port).toBe(5432); // default value
    expect(config.database.database).toBe('rag'); // default value
  });

  it('should have reasonable default values', () => {
    const config = getDefaultConfig();
    
    expect(config.database.host).toBe('localhost');
    expect(config.database.port).toBe(5432);
    expect(config.database.database).toBe('rag');
    expect(config.server.name).toBe('rag-knowledge-base');
    expect(config.server.version).toBe('1.0.0');
  });
});