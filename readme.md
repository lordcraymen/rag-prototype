# RAG Prototype

A document retrieval experiment using PostgreSQL, pgvector and local Xenova embeddings. The active server uses the published `@lordcraymen/rivetbench` package to expose one validated operation registry over REST and MCP.

## Ontology graph search

The prototype now stores versioned RDF graphs and derives lexical and semantic indexes from their definitions. It supports Turtle, TriG, N-Triples and inline-context JSON-LD, preserves source predicates, and exposes explainable ontology search plus explicit mapping decisions. See [the ontology guide](docs/ontology-search.md) for imports, graph constraints and API examples.

## Run locally

```bash
npm install
npm run docker:up
npm run dev:rest
```

The HTTP server binds to `127.0.0.1:3000` by default:

- REST calls: `POST /rpc/<operation>`
- MCP Streamable HTTP: `/mcp`
- Operation discovery: `/tools`
- OpenAPI: `/openapi.json`
- Swagger UI: `/docs`

```bash
curl http://127.0.0.1:3000/rpc/query_documents \
  -H 'Content-Type: application/json' \
  -d '{"query":"a human individual","limit":5,"useHybrid":false,"threshold":0.05}'
```

`npm start` and `npm run mcp:stdio` start MCP over stdio. `npm run mcp:http` starts the combined HTTP server. Existing `--transport httpStream`, `--port` and `--verbose` flags remain accepted; use `LOG_LEVEL` to set HTTP logging verbosity. Diagnostics go to stderr.

## Operations

| Name | Purpose |
| --- | --- |
| `add_document` | Embed and store a document |
| `query_documents` | Retrieve documents with vector or hybrid search |
| `import_from_csv` | Import a local CSV through the connector |
| `get_rag_status` | Report connector status and document count |
| `remove_document` | Delete a document by ID |

Each operation has an input and output schema shared by both transports. MCP responses include structured content. The original URL-ingestion and listing handlers are placeholders, so they are not advertised by the new registry.

## Configuration

The active server reads environment variables once at startup. It does not read `config.json`.

| Variable | Default |
| --- | --- |
| `DB_HOST` | `localhost` |
| `DB_PORT` | `5432` |
| `DB_NAME` | `rag` |
| `DB_USER` | `raguser` |
| `DB_PASSWORD` | `ragpassword` |
| `DB_SSL` | `false` |
| `EMBEDDING_MODEL` | `Xenova/all-MiniLM-L6-v2` |
| `SERVER_HOST` | `127.0.0.1` |
| `SERVER_PORT` | `3000` |
| `SERVER_NAME` | `rag-knowledge-base` |
| `SERVER_VERSION` | `1.0.1` |

Default database credentials match the development Compose file. The embedding model is downloaded on first connector initialization.

## Verification

```bash
npm run type-check
npm run test:unit
```

The RivetBench tests check REST invocation and validation, OpenAPI, SDK MCP discovery and structured results, MCP Streamable HTTP, and configuration. They use injected connectors and need neither PostgreSQL nor model downloads.

The original database integration tests still require a running database and the embedding model:

```bash
npm run test:integration
```

## Migration boundaries

The transport refactor retains the existing connector, embedding and search implementations. `src/endpoints/registry.ts` wraps the existing RAG handlers; `src/server/main.ts` is the composition root. The previous adapters under `src/mcp/` and JavaScript files under `mcp/` remain for compatibility and legacy tests, but package startup scripts use the new server.

The new ontology importer uses separate graph tables and has been verified against PostgreSQL. Before using legacy document ingestion, repair its known storage issues: inserts currently omit the required document ID, the CSV CLI's dry-run still imports, and lexical indexing/search have inconsistent language settings and BM25 signatures. The transport tests do not establish that these storage paths work against a real database.

The ontology importer produces reusable conversion artifacts with canonical URIs and source statements. Retrieval remains advisory; accepting classifications into Grapheon is a separate workflow.

## License

ISC
