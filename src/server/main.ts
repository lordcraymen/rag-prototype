import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  createRestServer, createTransportPort, createLogger, loadConfig,
  type LoggerPort,
} from '@lordcraymen/rivetbench';
import { createRagRegistry } from '../endpoints/registry.js';
import { createXenovaConnector } from '../connectors/postgresql/factories.js';
import { readServerConfig } from './config.js';
import { createStdioServer } from './stdio.js';
import { OntologyStore } from '../ontology/store.js';
import { OntologySearch } from '../ontology/search.js';
import { registerOntologyEndpoints } from '../ontology/endpoints.js';
import { XenovaEmbeddingService } from '../services/XenovaEmbeddingService.js';

// Stderr keeps diagnostics separate from the stdio JSON-RPC stream.
const logger: LoggerPort = {
  info: (message, context) => console.error(message, context ?? ''),
  warn: (message, context) => console.error(message, context ?? ''),
  error: (message, context) => console.error(message, context ?? ''),
  child: () => logger,
};

async function main(): Promise<void> {
  const config = readServerConfig(process.argv.slice(2));
  const connector = createXenovaConnector(config.database, { model: config.model, lazyEmbeddings: true });
  const ontologyStore = new OntologyStore(config.database);
  let closeTransport: (() => Promise<void>) | undefined;
  const shutdown = async () => {
    await closeTransport?.();
    await connector.disconnect();
    await ontologyStore.close();
  };
  try {
    await connector.connect();
    await connector.initializeDatabase();
    const registry = createRagRegistry(connector);
    registerOntologyEndpoints(registry,ontologyStore,new OntologySearch(ontologyStore,new XenovaEmbeddingService(config.model),config.model));
    const transport = createTransportPort(registry, logger);
    if (config.transport === 'stdio') {
      const server = createStdioServer(registry, transport, logger, config.application);
      closeTransport = () => server.close();
      await server.connect(new StdioServerTransport());
    } else {
      const serverConfig = loadConfig({
        rest: { host: config.host, port: config.port },
        application: config.application,
        logging: { pretty: false },
      });
      const server = await createRestServer({ registry, transport, loggerPort: logger,
        logger: createLogger(serverConfig), config: serverConfig });
      closeTransport = () => server.fastify.close();
      await server.start();
    }
    let stopping = false;
    const stop = () => {
      if (stopping) return;
      stopping = true;
      void shutdown().then(() => process.exit(0), error => {
        console.error(error); process.exit(1);
      });
    };
    process.once('SIGINT', stop);
    process.once('SIGTERM', stop);
  } catch (error) {
    await shutdown();
    throw error;
  }
}

void main().catch(error => { console.error(error); process.exitCode = 1; });
