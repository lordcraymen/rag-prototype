# RAG Prototype with FastMCP

A powerful Retrieval-Augmented Generation (RAG) system built with FastMCP, PostgreSQL + pgvector, and local embeddings. Provides a Model Context Protocol server for AI assistants like Claude and ChatGPT.

## ✨ Features

- **🧠 Local Embeddings**: Uses Xenova/all-MiniLM-L6-v2 (no API keys required)
- **🗄️ Vector Database**: PostgreSQL + pgvector for efficient similarity search
- **📡 Multiple Transports**: Support for stdio, HTTP streaming, and SSE
- **🔍 Hybrid Search**: BM25 + vector similarity search
- **🌐 Web Extraction**: Smart HTML content extraction with sitemap batch consumption support
- **🔧 Modular Architecture**: Clean, extensible codebase

## 🚀 Quick Start

### 1. Start Database

```bash
npm run docker:up
```

### 2. Start MCP Server

```bash
# For Claude Desktop (stdio)
npm start

# For ChatGPT Developer Mode (HTTP streaming)
npm run mcp:dev

# For custom configurations
node mcp/cli.js --transport httpStream --port 3000 --verbose
```

### 3. For ChatGPT Developer Mode

Use ngrok to expose your local server:

```bash
ngrok http 3000
```

Then configure ChatGPT with: `https://your-ngrok-url.ngrok.io/mcp`

## 📋 Available Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start with stdio transport (Claude Desktop) |
| `npm run mcp:dev` | Start HTTP streaming server with verbose logging |
| `npm run mcp:http` | Start HTTP streaming server on port 3000 |
| `npm run mcp:sse` | Start SSE server on port 3001 |
| `npm run docker:up` | Start PostgreSQL database |
| `npm run docker:down` | Stop database |

## 🛠️ Transport Types

- **stdio**: Standard input/output (for Claude Desktop)
- **httpStream**: HTTP streaming (recommended for ChatGPT Developer Mode)
- **sse**: Server-Sent Events (for streaming applications)
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

Set environment variables to customize the setup:

```bash
RAG_DB_HOST=localhost          # Database host
RAG_DB_PORT=5432              # Database port
RAG_DB_NAME=rag               # Database name
RAG_DB_USER=raguser           # Database user
RAG_DB_PASSWORD=ragpassword   # Database password
RAG_MODEL_NAME=Xenova/all-MiniLM-L6-v2  # Embedding model
```

## 🏗️ Architecture

```
mcp/
├── cli.js                    # Command-line interface
├── server.js                # Main server entry point
└── lib/
    ├── config.js           # Configuration management
    ├── server-utils.js     # Server utilities and logging
    ├── mcp-server-factory.js  # Server factory with transport abstraction
    ├── rag-service.js      # RAG business logic
    ├── rag-tool-registry.js   # MCP tool registration
    └── html-content-extractor.js  # HTML processing utilities

tests/
├── test-config.js          # Configuration tests
├── test-connection.js      # Database connection tests
├── test-database.js        # Database functionality tests
├── test-system.js          # End-to-end system tests
├── run-all-tests.js        # Test runner
└── README.md              # Test documentation
```

## 🧪 Testing

The project includes a comprehensive test suite in the `tests/` directory:

```bash
# Run all tests
npm test
# or
npm run test:all

# Run individual tests
npm run test:config      # Test configuration loading
npm run test:connection  # Test PostgreSQL connection  
npm run test:db         # Test database functionality
npm run test:system     # Test complete RAG system
```

### Test Structure
- **`tests/test-config.js`** - Configuration validation
- **`tests/test-connection.js`** - Database connectivity
- **`tests/test-database.js`** - SQL functionality  
- **`tests/test-system.js`** - End-to-end RAG system
- **`tests/run-all-tests.js`** - Test runner with summary

### Manual API Testing
```bash
# Manual tool testing via curl (with server running)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -H "Accept: application/json, text/event-stream" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-client","version":"1.0.0"}}}'
```

## 🔌 Integration Examples

### Claude Desktop

Add to your Claude Desktop config:

```json
{
  "mcpServers": {
    "rag-service": {
      "command": "node",
      "args": ["path/to/mcp/cli.js"],
      "env": {
        "RAG_DB_HOST": "localhost"
      }
    }
  }
}
```

### ChatGPT Developer Mode

1. Start server: `npm run mcp:dev`
2. Expose with ngrok: `ngrok http 3000`
3. Add to ChatGPT: `https://your-url.ngrok.io/mcp`

## 📄 License

ISC
