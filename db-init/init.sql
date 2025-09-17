-- RAG Prototype Complete Database Setup
-- This script sets up PostgreSQL with pgvector extension and BM25 hybrid search
-- Run this script to initialize a complete RAG database from scratch

-- Create postgres superuser for pgAdmin access (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'postgres') THEN
        CREATE ROLE postgres WITH SUPERUSER CREATEDB CREATEROLE LOGIN PASSWORD 'postgres';
        RAISE NOTICE 'Created postgres superuser with password "postgres"';
    END IF;
END
$$;

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create documents table with all required columns for hybrid search
CREATE TABLE IF NOT EXISTS documents (
    id VARCHAR(50) PRIMARY KEY,
    title VARCHAR(255),
    content TEXT NOT NULL,
    embedding vector(384),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    -- Source tracking
    source_url TEXT,
    source_type VARCHAR(50) DEFAULT 'manual',
    fetched_at TIMESTAMP,
    -- BM25 columns
    word_count INTEGER DEFAULT 0,
    avg_doc_length REAL DEFAULT 0,
    tsvector_content tsvector
);

-- Create BM25 statistics table
CREATE TABLE IF NOT EXISTS bm25_stats (
    id SERIAL PRIMARY KEY,
    total_documents INTEGER DEFAULT 0,
    average_document_length REAL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert initial BM25 stats
INSERT INTO bm25_stats (total_documents, average_document_length) 
VALUES (0, 0) 
ON CONFLICT DO NOTHING;

-- Create all necessary indexes
CREATE INDEX IF NOT EXISTS idx_documents_embedding ON documents USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title);
CREATE INDEX IF NOT EXISTS idx_documents_metadata ON documents USING GIN(metadata);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at);
-- BM25 indexes
CREATE INDEX IF NOT EXISTS idx_documents_tsvector ON documents USING GIN(tsvector_content);
CREATE INDEX IF NOT EXISTS idx_documents_word_count ON documents(word_count);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for updated_at
CREATE TRIGGER update_documents_updated_at
    BEFORE UPDATE ON documents
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- BM25 score calculation function
CREATE OR REPLACE FUNCTION bm25_score(
    query_terms TEXT[],
    doc_tsvector tsvector,
    doc_length INTEGER,
    avg_doc_length REAL,
    total_docs INTEGER,
    k1 REAL DEFAULT 1.2,
    b REAL DEFAULT 0.75
) RETURNS DOUBLE PRECISION AS $$
DECLARE
    term TEXT;
    tf INTEGER;
    df INTEGER;
    idf DOUBLE PRECISION;
    score DOUBLE PRECISION := 0;
    normalized_tf DOUBLE PRECISION;
BEGIN
    -- For each query term
    FOREACH term IN ARRAY query_terms LOOP
        -- Calculate term frequency in document
        SELECT INTO tf (ts_rank_cd(doc_tsvector, plainto_tsquery(term)) * 1000)::INTEGER;
        
        -- Calculate document frequency (how many docs contain this term)
        SELECT INTO df COUNT(*) 
        FROM documents 
        WHERE tsvector_content @@ plainto_tsquery(term);
        
        -- Skip if term not found
        IF df = 0 THEN
            CONTINUE;
        END IF;
        
        -- Calculate IDF
        idf := ln((total_docs - df + 0.5) / (df + 0.5));
        
        -- Calculate normalized TF with BM25 formula
        normalized_tf := (tf * (k1 + 1)) / 
                        (tf + k1 * (1 - b + b * (doc_length / avg_doc_length)));
        
        -- Add to total score
        score := score + (idf * normalized_tf);
    END LOOP;
    
    RETURN GREATEST(score, 0);
END;
$$ LANGUAGE plpgsql;

-- Function to update document BM25 data
CREATE OR REPLACE FUNCTION update_document_bm25(doc_id VARCHAR(50)) RETURNS VOID AS $$
DECLARE
    content_text TEXT;
    word_cnt INTEGER;
BEGIN
    -- Get document content
    SELECT content INTO content_text FROM documents WHERE id = doc_id;
    
    -- Calculate word count
    word_cnt := array_length(string_to_array(regexp_replace(content_text, '[^\w\s]', ' ', 'g'), ' '), 1);
    
    -- Update document with BM25 data
    UPDATE documents 
    SET 
        word_count = word_cnt,
        tsvector_content = to_tsvector('german', content)
    WHERE id = doc_id;
END;
$$ LANGUAGE plpgsql;

-- Function to update global BM25 statistics
CREATE OR REPLACE FUNCTION update_bm25_stats() RETURNS VOID AS $$
DECLARE
    total_docs INTEGER;
    avg_length REAL;
BEGIN
    -- Calculate statistics
    SELECT COUNT(*), AVG(word_count) 
    INTO total_docs, avg_length
    FROM documents 
    WHERE word_count > 0;
    
    -- Update stats table
    UPDATE bm25_stats 
    SET 
        total_documents = total_docs,
        average_document_length = COALESCE(avg_length, 0),
        updated_at = NOW();
        
    -- Also update all documents with current avg_doc_length
    UPDATE documents 
    SET avg_doc_length = COALESCE(avg_length, 0);
END;
$$ LANGUAGE plpgsql;

-- Trigger function to automatically update BM25 data
CREATE OR REPLACE FUNCTION trigger_update_bm25() RETURNS TRIGGER AS $$
BEGIN
    -- Update BM25 data for the affected document
    PERFORM update_document_bm25(NEW.id);
    
    -- Update global statistics
    PERFORM update_bm25_stats();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create BM25 trigger
DROP TRIGGER IF EXISTS documents_bm25_update ON documents;
CREATE TRIGGER documents_bm25_update
    AFTER INSERT OR UPDATE OF content ON documents
    FOR EACH ROW
    EXECUTE FUNCTION trigger_update_bm25();

-- Vector similarity search function
CREATE OR REPLACE FUNCTION search_documents_by_similarity(
    query_embedding vector(384),
    similarity_threshold REAL DEFAULT 0.1,
    result_limit INTEGER DEFAULT 10
) RETURNS TABLE (
    id VARCHAR(50),
    title VARCHAR(255),
    content TEXT,
    metadata JSONB,
    created_at TIMESTAMP,
    similarity DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.title,
        d.content,
        d.metadata,
        d.created_at,
        1 - (d.embedding <=> query_embedding) AS similarity
    FROM documents d
    WHERE 1 - (d.embedding <=> query_embedding) > similarity_threshold
    ORDER BY d.embedding <=> query_embedding
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Hybrid search function combining BM25 + Vector similarity  
CREATE OR REPLACE FUNCTION hybrid_search_documents(
    query_text TEXT,
    query_embedding vector(384),
    similarity_threshold REAL DEFAULT 0.05,
    bm25_weight REAL DEFAULT 0.3,
    vector_weight REAL DEFAULT 0.7,
    result_limit INTEGER DEFAULT 5
) RETURNS TABLE (
    id VARCHAR(50),
    title VARCHAR(255),
    content TEXT,
    metadata JSONB,
    created_at TIMESTAMP,
    vector_similarity DOUBLE PRECISION,
    bm25_score DOUBLE PRECISION,
    hybrid_score DOUBLE PRECISION
) AS $$
DECLARE
    query_terms TEXT[];
    stats_record RECORD;
BEGIN
    -- Get current BM25 statistics
    SELECT * INTO stats_record FROM bm25_stats ORDER BY updated_at DESC LIMIT 1;
    
    -- Prepare query terms for BM25
    query_terms := string_to_array(
        regexp_replace(lower(query_text), '[^\w\s]', ' ', 'g'), 
        ' '
    );
    query_terms := array_remove(query_terms, '');
    
    RETURN QUERY
    SELECT 
        d.id,
        d.title,
        d.content,
        d.metadata,
        d.created_at,
        (1 - (d.embedding <=> query_embedding)) AS vector_similarity,
        bm25_score(
            query_terms,
            d.tsvector_content,
            d.word_count,
            stats_record.average_document_length,
            stats_record.total_documents
        ) AS bm25_score,
        (
            vector_weight * (1 - (d.embedding <=> query_embedding)) +
            bm25_weight * LEAST(bm25_score(
                query_terms,
                d.tsvector_content,
                d.word_count,
                stats_record.average_document_length,
                stats_record.total_documents
            ) / 10.0, 1.0)  -- Normalize BM25 score
        ) AS hybrid_score
    FROM documents d
    WHERE d.embedding <=> query_embedding < (1 - similarity_threshold)
    ORDER BY hybrid_score DESC
    LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- Insert sample document for testing (optional - remove if not needed)
-- INSERT INTO documents (id, title, content) VALUES 
-- ('sample_doc_1', 'Sample Document', 'This is a sample document for testing the RAG system.');

-- Final status message
DO $$ 
BEGIN 
    RAISE NOTICE 'RAG Database setup complete with hybrid BM25+Vector search capabilities';
    RAISE NOTICE 'Use hybrid_search_documents() for best search results';
    RAISE NOTICE 'Use search_documents_by_similarity() for vector-only search';
END $$;