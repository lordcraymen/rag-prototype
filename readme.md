# RAG Prototype with FastMCP

A powerful Retrieval-Augmented Generation (RAG) system built with FastMCP, PostgreSQL + pgvector, and local embeddings. Provides a Model Context Protocol server for AI assistants and development environments.

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
# For VS Code / stdio transport (recommended)
npm start

# For HTTP streaming server with verbose logging
npm run mcp:dev

# For custom configurations
node mcp/cli.js --transport httpStream --port 3000 --verbose
```

## 📋 Available Commands

| Command | Description |
|---------|-------------|
| `npm start` | Start with stdio transport (VS Code) |
| `npm run mcp:dev` | Start HTTP streaming server with verbose logging |
| `npm run mcp:http` | Start HTTP streaming server on port 3000 |
| `npm run mcp:sse` | Start SSE server on port 3001 |
| `npm run docker:up` | Start PostgreSQL database |
| `npm run docker:down` | Stop database |

## 🛠️ Transport Types

- **stdio**: Standard input/output (for VS Code and other MCP clients)
- **httpStream**: HTTP streaming (for web-based integrations)
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
         "command": "node",
         "args": ["path/to/your/rag-protoype/mcp/cli.js"],
         "env": {
           "RAG_DB_HOST": "localhost",
           "RAG_DB_PORT": "5432"
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
      "command": "node",
      "args": ["path/to/mcp/cli.js"],
      "env": {
        "RAG_DB_HOST": "localhost"
      }
    }
  }
}
```

## 📄 License

ISC
