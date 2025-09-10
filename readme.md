# RAG Prototype with MCP Interface

This project is a **Retrieval-Augmented Generation (RAG) prototype** featuring an MCP (Model Context Protocol) interface. It uses local embeddings and in-memory vector storage for a lightweight, self-contained RAG system.

## Features

- 🔍 **Document Storage & Retrieval**: Add documents and search using word-frequency based embeddings
- 🤖 **Response Generation**: Intelligent response synthesis from retrieved documents
- 🔌 **MCP Interface**: Integrates seamlessly with MCP-compatible tools and clients
- 📊 **Real-time Statistics**: Track document count, similarities, and system status
- 🚀 **Zero External Dependencies**: No external APIs or databases required

## Technologies

- **FastMCP**: Provides the MCP interface for tool communication
- **Local Embeddings**: Word-frequency based similarity matching
- **In-Memory Storage**: Fast document storage and retrieval
- **ES Modules**: Modern JavaScript module system

## Getting Started

1. **Install dependencies:**
    ```bash
    npm install
    ```

2. **Run the MCP server:**
    ```bash
    npm start        # Start the MCP server
    npm run dev      # Start with file watching
    npm run mcp      # Direct MCP server execution
    ```

## Project Structure

```
├── index.js          # Main entry point
├── mcp/
│   └── server.js     # MCP server with RAG tools
├── retriever/
│   └── index.js      # Document retrieval and embedding logic
├── generator/
│   └── index.js      # Response generation and synthesis
└── package.json      # Project configuration
```

## MCP Tools Available

### `add_document`
Add documents to the RAG knowledge base.
- **Parameters**: `content`, `title` (optional), `metadata` (optional)
- **Returns**: Document ID and storage confirmation

### `query_documents` 
Search and retrieve relevant documents with AI-generated responses.
- **Parameters**: `query`, `limit` (optional), `threshold` (optional)
- **Returns**: Generated response with sources and metadata

### `list_documents`
View all stored documents with statistics.
- **Returns**: Complete document list with previews

### `remove_document`
Remove documents from the knowledge base.
- **Parameters**: `id`
- **Returns**: Removal confirmation

### `get_rag_status`
Get system status and statistics.
- **Returns**: Component status, document count, and performance metrics

## Usage Example

1. **Add some documents:**
   ```
   Use add_document tool with content like:
   - "Artificial Intelligence is a branch of computer science..."
   - "Machine Learning algorithms learn patterns from data..."
   ```

2. **Query the knowledge base:**
   ```
   Use query_documents with queries like:
   - "What is artificial intelligence?"
   - "How do machine learning algorithms work?"
   ```

3. **Monitor the system:**
   ```
   Use get_rag_status to see document counts and system health
   ```

## Architecture

The RAG system consists of three main components:

- **Retriever**: Handles document storage and similarity search using word-frequency embeddings
- **Generator**: Creates intelligent responses by synthesizing information from retrieved documents  
- **MCP Server**: Exposes RAG functionality through standardized MCP tools

## Development

- **File watching**: `npm run dev` automatically restarts on file changes
- **Logging**: Error messages are logged to stderr to avoid MCP protocol interference
- **Extensible**: Easy to swap embedding models or add new tools

## License

MIT
