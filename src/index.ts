// Main exports for the refactored RAG system

// Types
export * from './types/index.js';
export * from './types/database.js';

// Base classes
export { DatabaseConnector } from './connectors/DatabaseConnector.js';

// PostgreSQL implementation
export { PostgreSQLConnection } from './connectors/postgresql/PostgreSQLConnection.js';
export { PostgreSQLConnector, PostgreSQLConnectorOptions } from './connectors/postgresql/PostgreSQLConnector.js';
export { createOpenAIConnector, createXenovaConnector } from './connectors/postgresql/factories.js';

// Services
export { OpenAIEmbeddingService } from './services/OpenAIEmbeddingService.js';
export { XenovaEmbeddingService } from './services/XenovaEmbeddingService.js';
export { PostgreSQLSearchService } from './services/PostgreSQLSearchService.js';

// Transport-neutral operation registry
export { createRagRegistry } from './endpoints/registry.js';
export { convertVocabulary } from './ontology/import.js';
export { OntologyStore } from './ontology/store.js';
export { OntologySearch, traverse } from './ontology/search.js';
export { registerOntologyEndpoints } from './ontology/endpoints.js';
export type { VocabularyArtifact, ResourceRef, SearchInput, RankedCandidate } from './ontology/types.js';
