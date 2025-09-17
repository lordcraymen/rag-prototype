// Main exports for the refactored RAG system

// Types
export * from './types/index.js';
export * from './types/database.js';

// Base classes
export { DatabaseConnector } from './connectors/DatabaseConnector.js';

// PostgreSQL implementation
export { PostgreSQLConnection } from './connectors/postgresql/PostgreSQLConnection.js';
export { PostgreSQLConnector } from './connectors/postgresql/PostgreSQLConnector.js';
export { PostgreSQLXenovaConnector } from './connectors/postgresql/PostgreSQLXenovaConnector.js';

// Services
export { OpenAIEmbeddingService } from './services/OpenAIEmbeddingService.js';
export { XenovaEmbeddingService } from './services/XenovaEmbeddingService.js';
export { PostgreSQLSearchService } from './services/PostgreSQLSearchService.js';