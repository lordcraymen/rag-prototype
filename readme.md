# RAG Prototype with PostgreSQL + pgvector# RAG Prototype with MCP Interface



A clean RAG (Retrieval-Augmented Generation) prototype using PostgreSQL with pgvector extension and FastMCP for VS Code integration.This project is a **Retrieval-Augmented Generation (RAG) prototype** featuring an MCP (Model Context Protocol) interface. It uses local embeddings and in-memory vector storage for a lightweight, self-contained RAG system.



## Features## Features



- 🗄️ **PostgreSQL + pgvector**: Professional vector database with ACID properties- 🔍 **Document Storage & Retrieval**: Add documents and search using word-frequency based embeddings

- 🧠 **Local Embeddings**: Xenova/all-MiniLM-L6-v2 (no external APIs needed)- 🤖 **Response Generation**: Intelligent response synthesis from retrieved documents

- 🔍 **Top-K Semantic Search**: Intelligent relevance scoring with transparency- 🔌 **MCP Interface**: Integrates seamlessly with MCP-compatible tools and clients

- 🔄 **Multi-Session Support**: Documents persist across VS Code instances- 📊 **Real-time Statistics**: Track document count, similarities, and system status

- 🛠️ **FastMCP Integration**: 5 MCP tools for VS Code- 🚀 **Zero External Dependencies**: No external APIs or databases required



## Quick Start## Technologies



1. **Start PostgreSQL Database**:- **FastMCP**: Provides the MCP interface for tool communication

   ```bash- **Local Embeddings**: Word-frequency based similarity matching

   npm run docker:up- **In-Memory Storage**: Fast document storage and retrieval

   ```- **ES Modules**: Modern JavaScript module system



2. **Start MCP Server**:## Getting Started

   ```bash

   npm start1. **Install dependencies:**

   ```    ```bash

    npm install

3. **Use in VS Code**: The RAG tools will be available in VS Code MCP panel    ```



## Available MCP Tools2. **Run the MCP server:**

    ```bash

- `add_document` - Add document to knowledge base    npm start        # Start the MCP server

- `query_documents` - Semantic search with relevance scores    npm run dev      # Start with file watching

- `list_documents` - View all documents    npm run mcp      # Direct MCP server execution

- `remove_document` - Delete document    ```

- `get_rag_status` - System status and statistics

## Project Structure

## Dependencies

```

- **@xenova/transformers**: Local embedding model├── index.js          # Main entry point

- **fastmcp**: MCP server framework├── mcp/

- **pg**: PostgreSQL client│   └── server.js     # MCP server with RAG tools

- **zod**: Schema validation├── retriever/

│   └── index.js      # Document retrieval and embedding logic

## Architecture├── generator/

│   └── index.js      # Response generation and synthesis

```└── package.json      # Project configuration

├── index.js                 # Entry point```

├── mcp/server.js            # MCP server with 5 RAG tools

├── retriever/## MCP Tools Available

│   └── postgresql-retriever.js  # PostgreSQL + pgvector implementation

├── generator/### `add_document`

│   └── index.js             # Response generator with adaptive scoringAdd documents to the RAG knowledge base.

├── docker-compose.yml       # PostgreSQL + pgvector setup- **Parameters**: `content`, `title` (optional), `metadata` (optional)

└── db-init/                 # Database initialization scripts- **Returns**: Document ID and storage confirmation

```

### `query_documents` 

## Search QualitySearch and retrieve relevant documents with AI-generated responses.

- **Parameters**: `query`, `limit` (optional), `threshold` (optional)

The system uses adaptive relevance scoring:- **Returns**: Generated response with sources and metadata

- **>50%**: High relevance

- **30-50%**: Medium relevance  ### `list_documents`

- **15-30%**: Low relevanceView all stored documents with statistics.

- **5-15%**: Very low relevance- **Returns**: Complete document list with previews

- **<5%**: Minimal relevance

### `remove_document`

## DevelopmentRemove documents from the knowledge base.

- **Parameters**: `id`

```bash- **Returns**: Removal confirmation

# Development with auto-reload

npm run dev### `get_rag_status`

Get system status and statistics.

# Docker management- **Returns**: Component status, document count, and performance metrics

npm run docker:up

npm run docker:down## Usage Example

npm run docker:logs

```1. **Add some documents:**

   ```

## Database Schema   Use add_document tool with content like:

   - "Artificial Intelligence is a branch of computer science..."

The PostgreSQL database includes:   - "Machine Learning algorithms learn patterns from data..."

- **documents** table with pgvector embeddings   ```

- **Similarity search functions** for efficient queries

- **Indexes** optimized for vector operations2. **Query the knowledge base:**

   ```

## Performance   Use query_documents with queries like:

   - "What is artificial intelligence?"

- **Multi-process safe**: ACID transactions prevent conflicts   - "How do machine learning algorithms work?"

- **Persistent storage**: Documents survive server restarts   ```

- **Real-time sync**: Changes visible across all VS Code instances

- **Efficient search**: pgvector optimized cosine similarity3. **Monitor the system:**
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
