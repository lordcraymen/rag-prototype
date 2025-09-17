// Configuration utilities
import { DatabaseConfig } from '@/types/database.js';

export interface AppConfig {
  database: DatabaseConfig;
  server: {
    name: string;
    version: string;
    port?: number;
  };
}

export function getDefaultConfig(): AppConfig {
  return {
    database: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'rag',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      ssl: process.env.DB_SSL === 'true'
    },
    server: {
      name: process.env.SERVER_NAME || 'rag-knowledge-base',
      version: process.env.SERVER_VERSION || '1.0.0',
      port: parseInt(process.env.SERVER_PORT || '3000')
    }
  };
}

export function readConfig(): AppConfig {
  try {
    // Try to read from config.json first
    const configPath = './config.json';
    const fs = require('fs');
    if (fs.existsSync(configPath)) {
      const configData = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      return { ...getDefaultConfig(), ...configData };
    }
  } catch (error) {
    console.warn('Failed to read config.json, using environment variables');
  }
  
  return getDefaultConfig();
}