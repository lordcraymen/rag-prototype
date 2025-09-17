# RAG Prototype with FastMCP

A powerful Retrieval-Augmented Generation (RAG) system built with FastMCP, PostgreSQL + pgvector, and local embeddings. Provides a Model Context Protocol server for AI assistants and development environments.

## ✨ Features

- **🧠 Local Embeddings**: Uses Xenova/all-MiniLM-L6-v2 (no API keys required) with TypeScript
- **🗄️ Vector Database**: PostgreSQL + pgvector for efficient similarity search
- **📡 Multiple Transports**: Support for stdio, HTTP streaming, and SSE
- **🔍 Hybrid Search**: BM25 + vector similarity search
- **🌐 Web Extraction**: Smart HTML content extraction with sitemap batch consumption support
- **🔧 Modular Architecture**: Clean TypeScript codebase with inline compilation
- **⚡ No Build Step**: Direct TypeScript execution with tsx for development

## � Development Setup

The project is fully TypeScript-based with no build step required:

- **tsx**: Direct TypeScript execution
- **Vitest**: Modern testing framework with TypeScript support
- **Path aliases**: Configured via `tsconfig.json` for clean imports (`@/` points to `src/`)
- **ESM modules**: Full ES module support with `.js` extensions for TypeScript imports

## �🚀 Quick Start

### 1. Start Database

```bash
npm run docker:up
```

### 2. Start MCP Server

```bash
# For VS Code / stdio transport (recommended) - TypeScript with local embeddings
npm start

# For development with auto-reload
npm run dev

# For HTTP streaming server with verbose logging
npm run mcp:dev

# For CSV import
npm run csv:import path/to/your/file.csv
```

## 📋 Available Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start with stdio transport (VS Code) |
| `npm run dev` | Start with auto-reload (development) |
| `npm run mcp:dev` | Start HTTP streaming server with verbose logging |
| `npm run mcp:http` | Start HTTP streaming server on port 3000 |
| `npm run mcp:stdio` | Start with stdio transport explicitly |
| `npm run docker:up` | Start PostgreSQL database |
| `npm run docker:down` | Stop database |
| `npm run docker:reset` | Reset database (down + up) |
| `npm run docker:logs` | View database logs |
| `npm run test` | Run tests with Vitest |
| `npm run test:ui` | Run tests with Vitest UI |
| `npm run test:coverage` | Run tests with coverage |
| `npm run csv:import` | Import documents from CSV file |

## 🛠️ Transport Types

- **stdio**: Standard input/output (for VS Code and other MCP clients)
- **httpStream**: HTTP streaming (for web-based integrations)
- **http**: Legacy HTTP (deprecated, maps to httpStream)

## 📚 Available Tools

1. **add_document**: Add documents to knowledge base
2. **add_document_from_url**: Fetch and add web content
3. **add_documents_from_sitemap**: Batch-add from sitemaps
4. **query_documents**: Search with hybrid BM25+vector search
5. **get_rag_status**: Get system status and statistics
6. **list_documents**: List all stored documents
7. **remove_document**: Remove documents by ID

## ⚙️ Configuration

Configuration is managed through environment variables and optional config files. The application uses a TypeScript-based configuration system located in `src/utils/config.ts`.

Set environment variables to customize the setup:

```bash
DB_HOST=localhost                    # Database host
DB_PORT=5432                        # Database port
DB_NAME=rag                         # Database name
DB_USER=postgres                    # Database user (default: postgres)
DB_PASSWORD=postgres                # Database password (default: postgres)
DB_SSL=false                        # Enable SSL (default: false)
EMBEDDING_MODEL=Xenova/all-MiniLM-L6-v2  # Embedding model
SERVER_NAME=rag-knowledge-base      # Server name
SERVER_VERSION=1.0.0                # Server version
SERVER_PORT=3000                    # Server port (for HTTP transport)
```

Alternative: Create a `config.json` file in the project root:

```json
{
  "database": {
    "host": "localhost",
    "port": 5432,
    "database": "rag",
    "user": "postgres", 
    "password": "postgres",
    "ssl": false
  },
  "embedding": {
    "model": "Xenova/all-MiniLM-L6-v2"
  }
}
```

## 🏗️ Architecture

```
src/
├── index.ts                  # Main entry point
├── mcp/                      # MCP Server implementations
│   ├── server.ts             # Main TypeScript MCP server
│   ├── server-factory.ts     # Server factory with transport abstraction
│   ├── rag-tools.ts          # RAG MCP tools registration
│   ├── tool-builder.ts       # Tool building utilities
│   └── implementations/      # Server transport implementations
│       ├── FastMCPServer.ts  # FastMCP implementation
│       └── StdioMCPServer.ts # Stdio transport implementation
├── connectors/               # Database connectors
│   └── postgresql/           # PostgreSQL specific connectors
│       ├── PostgreSQLConnection.ts      # Basic connection
│       ├── PostgreSQLConnector.ts       # Unified connector
│       ├── factories.ts                # Connector factory helpers
│       └── helpers/                    # Embedding helper strategies (e.g., XenovaBatchEmbeddingHelper)
├── services/                 # Service layer
│   ├── OpenAIEmbeddingService.ts        # OpenAI embeddings (optional)
│   ├── XenovaEmbeddingService.ts        # Local Xenova embeddings
│   └── PostgreSQLSearchService.ts       # Search service
├── scripts/                  # Utility scripts
│   ├── csv-importer.ts       # CSV import functionality
│   ├── rag-status-check.ts   # System status checker
│   └── fastmcp-research.ts   # FastMCP research tools
├── types/                    # TypeScript type definitions
│   ├── database.ts           # Database types
│   ├── index.ts              # Main type exports
│   └── mcp-interfaces.ts     # MCP interface definitions
└── utils/                    # Utility functions
    └── config.ts             # Configuration management

tests/                        # Vitest test suite
├── config.test.ts            # Configuration tests
├── connection.test.ts        # Database connection tests
├── database.test.ts          # Database functionality tests
├── embedding-service.test.ts # Embedding service tests
├── search-service.test.ts    # Search service tests
├── mcp-server.test.ts        # MCP server tests
├── e2e.test.ts              # End-to-end tests
├── system.test.ts           # System integration tests
└── README.md                # Test documentation
```

## 🧪 Testing

The project uses **Vitest** as the testing framework with comprehensive TypeScript test suite:

```bash
# Run all tests
npm test
# or 
npm run test:run

# Run tests with UI
npm run test:ui

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

### Test Structure
- **`tests/config.test.ts`** - Configuration validation and loading
- **`tests/connection.test.ts`** - Database connectivity tests
- **`tests/database.test.ts`** - Database functionality and SQL operations
- **`tests/embedding-service.test.ts`** - Embedding service functionality
- **`tests/search-service.test.ts`** - Search and retrieval operations
- **`tests/mcp-server.test.ts`** - MCP server functionality
- **`tests/e2e.test.ts`** - End-to-end integration tests
- **`tests/system.test.ts`** - Complete system integration tests

### Development Testing Tools
```bash
# Check embeddings functionality
node tests/check-embeddings.mjs

# Query documents directly (requires running database)
node query-docs.mjs

### Manual API Testing
```bash
# Manual tool testing via curl (with server running)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}}}'
```

## 🔌 Integration

### VS Code with GitHub Copilot

This RAG server integrates seamlessly with VS Code through the Model Context Protocol (MCP). Follow the [official VS Code MCP documentation](https://code.visualstudio.com/docs/copilot/customization/mcp-servers) for detailed setup instructions.

#### Quick Setup for VS Code

1. **Start the RAG server** in stdio mode:
   ```bash
   npm start
   ```

2. **Add to VS Code settings** (`settings.json`):
   ```json
   {
     "github.copilot.chat.mcp.servers": {
       "rag-prototype": {
         "command": "npx",
         "args": ["tsx", "src/mcp/server.ts"],
         "cwd": "path/to/your/rag-protoype",
         "env": {
           "DB_HOST": "localhost",
           "DB_PORT": "5432",
           "DB_NAME": "rag",
           "DB_USER": "postgres",
           "DB_PASSWORD": "postgres"
         }
       }
     }
   }
   ```

3. **Use the RAG tools** in GitHub Copilot Chat:
   - Query your knowledge base: Ask questions about your stored documents
   - Add new documents: Upload content from URLs or text
   - Manage your knowledge base: List, search, and remove documents

#### Available MCP Tools

- `query_documents` - Search and retrieve relevant information
- `add_document` - Add new content to the knowledge base
- `add_document_from_url` - Import content from web pages
- `add_documents_from_sitemap` - Batch import from sitemaps
- `list_documents` - View all stored documents
- `remove_document` - Delete specific documents
- `get_rag_status` - Check system status

### Other MCP Clients

The server works with any MCP-compatible client using stdio transport:

```json
{
  "mcpServers": {
    "rag-service": {
      "command": "npx",
      "args": ["tsx", "src/mcp/server.ts"],
      "cwd": "path/to/your/rag-protoype",
      "env": {
        "DB_HOST": "localhost",
        "DB_PORT": "5432",
        "DB_NAME": "rag"
      }
    }
  }
}
```

## 📄 License

ISC
