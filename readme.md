# RAG Prototype with BM25 + Vector Hybrid Search

A production-ready Retrieval-Augmented Generation (RAG) system using PostgreSQL + pgvector with hybrid BM25 + vector similarity search.

## 🚀 Features

- **Hybrid Search**: Combines BM25 keyword matching with vector semantic similarity  
- **PostgreSQL + pgvector**: Professional vector database with ACID properties
- **MCP Integration**: Model Context Protocol server for VS Code integration
- **Local Embeddings**: Uses Xenova/all-MiniLM-L6-v2 (no external API required)
- **Configurable Weights**: Adjustable BM25/vector score combinations
- **Automatic Triggers**: BM25 data updates automatically on document changes

## 📋 Prerequisites

- **Docker & Docker Compose**
- **Node.js 18+** 
- **Git**

## 🛠️ Complete Setup (Fresh Start)

### 1. Clone and Setup
```bash
git clone <repository-url>
cd rag-protoype
npm install
```

### 2. Start PostgreSQL Database
```bash
# Start database (includes automatic schema setup)
docker-compose up -d

# Verify database is ready
docker logs rag-postgres

# Check database connection
docker exec rag-postgres psql -U raguser -d rag -c "SELECT 'Database ready!';"
```

### 3. Test the System
```bash
# Start MCP server
node mcp/server.js

# Or test directly with Node.js
node -e "
const { PostgreSQLRetriever } = require('./retriever/postgresql-retriever.js');
async function test() {
  const retriever = new PostgreSQLRetriever();
  await retriever.initialize();
  console.log('✅ RAG System ready!');
}
test().catch(console.error);
"
```

## 🔧 Configuration

### Database Connection
Default settings (modify in `docker-compose.yml` if needed):
- **Host**: localhost:5432
- **Database**: rag  
- **User**: raguser
- **Password**: ragpassword

### Search Parameters
```javascript
// Hybrid Search (recommended)
const results = await retriever.hybridSearch(
  'your query',
  5,        // limit
  0.05,     // threshold  
  0.3,      // BM25 weight (30%)
  0.7       // Vector weight (70%)
);

// Vector-only Search
const results = await retriever.search('your query', 5, 0.1);
```

## 🗄️ Database Schema

The system automatically creates:

**Documents Table:**
- `id`: Unique document identifier
- `title`: Document title  
- `content`: Full text content
- `embedding`: 384-dimensional vector (all-MiniLM-L6-v2)
- `metadata`: JSON metadata
- `word_count`: Word count for BM25
- `tsvector_content`: Full-text search vector

**Functions:**
- `hybrid_search_documents()`: BM25 + vector hybrid search
- `search_documents_by_similarity()`: Vector-only search  
- `bm25_score()`: BM25 relevance scoring

## 📚 Usage Examples

### Add Documents via MCP
```javascript
// Use VS Code with MCP integration
// or call MCP tools directly:

await mcp_server.add_document({
  title: "Sample Document",
  content: "Your document content here..."
});
```

### Search Documents
```javascript
// Hybrid Search (best results)
const results = await mcp_server.query_documents({
  query: "your search query",
  limit: 5
});

// Results include:
// - Hybrid score (BM25 + vector combined)
// - Individual BM25 and vector scores
// - Relevance rankings
```

### Direct Database Access
```javascript
const { PostgreSQLRetriever } = require('./retriever/postgresql-retriever.js');

const retriever = new PostgreSQLRetriever();
await retriever.initialize();

// Add document
await retriever.addDocument('doc1', 'Title', 'Content', {category: 'test'});

// Hybrid search
const results = await retriever.hybridSearch('query', 5);
console.log(results.map(r => ({
  title: r.metadata?.title,
  hybrid: r.hybridScore,
  vector: r.similarity, 
  bm25: r.bm25Score
})));
```

## 🚨 Troubleshooting

### Database Issues
```bash
# Reset database completely
docker-compose down -v
docker-compose up -d

# Check logs
docker logs rag-postgres

# Connect to database
docker exec -it rag-postgres psql -U raguser -d rag
```

### Connection Issues
```bash
# Check if container is running
docker ps

# Test database connectivity  
docker exec rag-postgres pg_isready -U raguser -d rag
```

### Embedding Issues
```bash
# Test embedding generation
node -e "
const { PostgreSQLRetriever } = require('./retriever/postgresql-retriever.js');
async function test() {
  const retriever = new PostgreSQLRetriever();
  await retriever.initialize();
  const embedding = await retriever.generateEmbedding('test');
  console.log('Embedding dimension:', embedding.length);
}
test();
"
```

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   VS Code MCP   │────│  FastMCP Server  │────│  RAG Generator  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │ PostgreSQL + 🔍  │
                       │ Retriever        │  
                       └──────────────────┘
                                │
                                ▼
                       ┌──────────────────┐
                       │  PostgreSQL DB   │
                       │  + pgvector      │
                       │  + BM25 Hybrid   │
                       └──────────────────┘
```

## 📊 Performance

- **Hybrid Search**: Combines keyword precision with semantic understanding
- **BM25 Weight 0.3**: Good for exact keyword matches
- **Vector Weight 0.7**: Strong semantic similarity
- **Optimal for**: Technical documents, mixed content, multilingual search

## 🔄 Reset & Clean Start

To completely reset the system:
```bash
# Stop and remove all data
docker-compose down -v

# Remove old containers
docker system prune

# Fresh start
docker-compose up -d
npm run start
```

## 📝 Dependencies

- **@xenova/transformers**: Local embeddings (all-MiniLM-L6-v2)
- **fastmcp**: MCP server framework  
- **pg**: PostgreSQL client
- **zod**: Schema validation

---

**🎯 This RAG system provides industry-standard hybrid search with transparent scoring and professional database persistence.**



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
