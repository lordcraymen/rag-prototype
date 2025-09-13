# RAG MCP Server - Refactored Architecture

## Overview

This is a completely refactored version of the RAG MCP server with a clean, modular architecture. The original monolithic `server.js` has been broken down into focused, reusable components.

## Architecture

### Core Components

#### 1. **MCPServerFactory** (`lib/mcp-server-factory.js`)
- Abstracts FastMCP framework
- Provides unified interface for different MCP implementations
- Factory pattern for creating different server types
- Extensible for future MCP frameworks

#### 2. **RAGService** (`lib/rag-service.js`)
- Encapsulates all RAG operations
- Manages PostgreSQL retriever and generator
- Handles initialization and configuration
- Provides clean API for document operations

#### 3. **RAGToolRegistry** (`lib/rag-tool-registry.js`)
- Registers all MCP tools
- Separates tool logic from server setup
- Modular tool registration system
- Easy to add/remove specific tools

#### 4. **HTMLContentExtractor** (`lib/html-content-extractor.js`)
- Standalone HTML processing utility
- Extracts clean content from web pages
- Reusable across different contexts

## Usage Examples

### Basic Server (stdio)
```bash
npm start
# or
npm run mcp:stdio
```

### HTTP Server (for ChatGPT Developer Mode)
```bash
npm run mcp:http
# Starts on http://localhost:3000
```

### SSE Server (for streaming)
```bash
npm run mcp:sse
# Starts on http://localhost:3001
```

### Development Mode (verbose logging)
```bash
npm run mcp:dev
```

### CLI Usage
```bash
# Custom port and host
node mcp/cli.js --transport http --port 8080 --host 0.0.0.0

# Verbose mode
node mcp/cli.js --transport http --verbose

# Help
node mcp/cli.js --help
```

## Programmatic Usage

### Create Custom Server
```javascript
import { MCPServerFactory, RAGService, RAGToolRegistry } from './mcp/server-new.js';

// Create server with custom configuration
const server = MCPServerFactory.createServer({
  name: 'My Custom RAG Server',
  version: '2.0.0',
  framework: 'fastmcp'
});

// Initialize RAG service with custom config
const ragService = new RAGService({
  host: 'my-db-host',
  modelName: 'different-model'
});

// Register tools
const toolRegistry = new RAGToolRegistry(ragService);
toolRegistry.registerAllTools(server);

// Start server
await server.start({ transportType: 'http', port: 3000 });
```

### Use Server Examples
```javascript
import { createHTTPRAGServer, createBasicRAGServer } from './mcp/server-examples.js';

// Quick HTTP server
const httpServer = createHTTPRAGServer();
await httpServer.start(3000);

// Custom configuration
const customServer = createBasicRAGServer({
  server: { name: 'My RAG' },
  rag: { modelName: 'custom-model' }
});
```

## Environment Variables

- `RAG_DB_HOST` - Database host (default: localhost)
- `RAG_DB_PORT` - Database port (default: 5432)
- `RAG_DB_NAME` - Database name (default: rag)
- `RAG_DB_USER` - Database user (default: raguser)
- `RAG_DB_PASSWORD` - Database password (default: ragpassword)
- `RAG_MODEL_NAME` - Embedding model (default: Xenova/all-MiniLM-L6-v2)

## Available NPM Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start server (default: stdio) |
| `npm run mcp:stdio` | Start with stdio transport |
| `npm run mcp:http` | Start HTTP server on port 3000 |
| `npm run mcp:sse` | Start SSE server on port 3001 |
| `npm run mcp:dev` | Start HTTP server with verbose logging |
| `npm run mcp:legacy` | Run old monolithic server.js |

## Benefits of New Architecture

### 1. **Separation of Concerns**
- Server setup vs. RAG logic vs. Tool registration
- Each component has a single responsibility
- Easy to test individual components

### 2. **Extensibility**
- Easy to add new MCP frameworks
- Simple to create custom tool combinations
- Flexible configuration system

### 3. **Reusability**
- Components can be used independently
- Factory pattern for different server types
- Modular tool registration

### 4. **Maintainability**
- Small, focused files
- Clear dependencies
- Easy to understand and modify

### 5. **Flexibility**
- Multiple transport types (stdio, HTTP, SSE)
- Environment-based configuration
- Command-line interface

## Migration from Old Server

The old `server.js` is preserved as `mcp:legacy` script. To migrate:

1. Use the new CLI: `node mcp/cli.js`
2. Or use NPM scripts: `npm run mcp:http`
3. For programmatic use, import from `server-new.js`

## File Structure

```
mcp/
├── lib/
│   ├── mcp-server-factory.js     # Server factory (abstracts FastMCP)
│   ├── rag-service.js            # RAG operations service
│   ├── rag-tool-registry.js      # Tool registration
│   └── html-content-extractor.js # HTML processing utility
├── cli.js                        # Command-line interface
├── server-new.js                 # New clean server
├── server-examples.js            # Usage examples
└── server.js                     # Legacy monolithic server
```

## Future Extensions

The factory pattern makes it easy to:

1. **Add new MCP frameworks**:
   ```javascript
   // In mcp-server-factory.js
   case 'custom-framework':
     return new CustomFrameworkWrapper(config);
   ```

2. **Create specialized servers**:
   ```javascript
   export function createMinimalRAGServer() {
     // Only basic query/add tools
   }
   ```

3. **Add middleware/plugins**:
   ```javascript
   server.addMiddleware(authPlugin);
   server.addMiddleware(loggingPlugin);
   ```

This architecture provides a solid foundation for future development while maintaining compatibility with existing functionality.
