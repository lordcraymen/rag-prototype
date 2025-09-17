import { PostgreSQLConnector } from './PostgreSQLConnector.js';
import { DatabaseConfig } from '@/types/index.js';
import { OpenAIEmbeddingService } from '@/services/OpenAIEmbeddingService.js';
import { XenovaEmbeddingService } from '@/services/XenovaEmbeddingService.js';
import { XenovaBatchEmbeddingHelper } from './helpers/XenovaBatchEmbeddingHelper.js';

interface OpenAIConnectorOptions {
    apiKey: string;
    model?: string;
}

interface XenovaConnectorOptions {
    model?: string;
    batchSize?: number;
}

export function createOpenAIConnector(config: DatabaseConfig, options: OpenAIConnectorOptions): PostgreSQLConnector {
    const embeddingService = new OpenAIEmbeddingService(options.apiKey, options.model);
    return new PostgreSQLConnector(config, { embeddingService });
}

export function createXenovaConnector(config: DatabaseConfig, options: XenovaConnectorOptions = {}): PostgreSQLConnector {
    const embeddingService = new XenovaEmbeddingService(options.model);
    const batchHelper = new XenovaBatchEmbeddingHelper(embeddingService, { batchSize: options.batchSize });

    console.error(`🧠 Using local embeddings: ${options.model ?? 'Xenova/all-MiniLM-L6-v2'} (no API key required)`);

    return new PostgreSQLConnector(config, {
        embeddingService,
        batchHelper
    });
}
