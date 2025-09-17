#!/usr/bin/env tsx
// Quick RAG Status Check Script

import { PostgreSQLXenovaConnector } from '@/connectors/postgresql/PostgreSQLXenovaConnector.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration laden
function loadConfig() {
    try {
        const configPath = join(__dirname, '..', 'config.json');
        const configData = readFileSync(configPath, 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        console.error('Failed to load config.json, using environment variables');
        return {
            database: {
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '5432'),
                database: process.env.DB_NAME || 'rag',
                user: process.env.DB_USER || 'raguser',
                password: process.env.DB_PASSWORD || 'ragpassword',
                ssl: false
            },
            embedding: {
                model: process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2'
            }
        };
    }
}

async function checkRAGStatus() {
    try {
        console.error('🔍 Checking RAG database status...');
        
        const config = loadConfig();
        const connector = new PostgreSQLXenovaConnector(config.database, config.embedding.model);
        
        // Connect
        await connector.connect();
        console.error('✅ Connected to database');
        
        // Get basic status
        const status = await connector.getStatus();
        const documentCount = await connector.getDocumentCount();
        
        console.error('\n📊 RAG Database Status:');
        console.error('🔗 Connection:', status.connected ? 'Connected' : 'Disconnected');
        console.error('🗄️ Database:', status.database);
        console.error('🏠 Host:', status.host);
        console.error('📚 Total Documents:', documentCount);
        
        // Test search to see what topics are available
        if (documentCount > 0) {
            console.error('\n🔍 Analyzing document topics...');
            
            // Search for common topics
            const topics = ['software', 'development', 'typescript', 'javascript', 'code', 'programming', 'documentation', 'api', 'database', 'system'];
            
            for (const topic of topics) {
                try {
                    const results = await connector.search({
                        query: topic,
                        limit: 5,
                        threshold: 0.3
                    });
                    
                    if (results.length > 0) {
                        console.error(`\n📋 Topic "${topic}": ${results.length} related documents found`);
                        results.forEach((doc, index) => {
                            const preview = doc.content.substring(0, 100).replace(/\n/g, ' ');
                            console.error(`  ${index + 1}. ${doc.title || 'Untitled'}: ${preview}...`);
                        });
                    }
                } catch (error) {
                    // Skip topics that cause errors
                }
            }
        }
        
        await connector.disconnect();
        console.error('\n✅ RAG status check completed');
        
    } catch (error) {
        console.error('❌ Error checking RAG status:', error);
        process.exit(1);
    }
}

// Run if executed directly
if (process.argv[1] && (process.argv[1].includes('rag-status-check') || process.argv[1].endsWith('rag-status-check.ts'))) {
    checkRAGStatus().catch(error => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
}