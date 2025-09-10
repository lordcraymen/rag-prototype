-- Initialize RAG database with pgvector extension
-- This script runs automatically when the container starts

-- Create the vector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create documents table with vector support
CREATE TABLE documents (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255),
    content TEXT NOT NULL,
    embedding vector(384), -- Dimension for all-MiniLM-L6-v2 model
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_documents_embedding ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX idx_documents_metadata ON documents USING GIN (metadata);
CREATE INDEX idx_documents_title ON documents (title);
CREATE INDEX idx_documents_created_at ON documents (created_at);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_documents_updated_at BEFORE UPDATE
    ON documents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert some sample data for testing
INSERT INTO documents (id, title, content, metadata) VALUES 
(
    'sample_doc_1',
    'PostgreSQL Vector Test',
    'Dies ist ein Testdokument um die PostgreSQL Vector-Funktionalität zu testen.',
    '{"source": "init", "type": "test"}'
);

-- Create a function for similarity search
CREATE OR REPLACE FUNCTION search_documents(
    query_embedding vector(384),
    similarity_threshold float DEFAULT 0.3,
    result_limit int DEFAULT 5
)
RETURNS TABLE (
    id VARCHAR(50),
    title VARCHAR(255),
    content TEXT,
    metadata JSONB,
    similarity float,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.title,
        d.content,
        d.metadata,
        1 - (d.embedding <=> query_embedding) as similarity,
        d.created_at
    FROM documents d
    WHERE d.embedding IS NOT NULL
        AND 1 - (d.embedding <=> query_embedding) >= similarity_threshold
    ORDER BY d.embedding <=> query_embedding
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL PRIVILEGES ON TABLE documents TO raguser;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO raguser;
