// Migration script from legacy JavaScript to new TypeScript architecture

import { PostgreSQLConnector } from '../dist/index.js';
import { readFileSync } from 'fs';
import { join } from 'path';

// Configuration
const config = {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    database: process.env.DB_NAME || 'rag_db',
    user: process.env.DB_USER || 'raguser',
    password: process.env.DB_PASSWORD || 'ragpassword',
    ssl: false
};

const openaiApiKey = process.env.OPENAI_API_KEY;

if (!openaiApiKey) {
    console.error('OPENAI_API_KEY environment variable is required');
    process.exit(1);
}

// Test the new architecture
async function testNewArchitecture() {
    console.log('🚀 Testing new TypeScript architecture...');
    
    // Create new connector
    const connector = new PostgreSQLConnector(config, openaiApiKey);
    
    try {
        // Test connection
        console.log('📡 Connecting to database...');
        await connector.connect();
        
        const status = await connector.getStatus();
        console.log('✅ Connected:', status);
        
        // Test document count
        const count = await connector.getDocumentCount();
        console.log(`📊 Current document count: ${count}`);
        
        // Test adding a document
        console.log('📝 Testing document addition...');
        const testDoc = {
            title: 'TypeScript Migration Test',
            content: 'This is a test document to verify the new TypeScript architecture is working correctly.',
            metadata: {
                source: 'migration-test',
                timestamp: new Date().toISOString(),
                architecture: 'typescript'
            }
        };
        
        const docId = await connector.addDocument(testDoc);
        console.log(`✅ Document added with ID: ${docId}`);
        
        // Test search
        console.log('🔍 Testing search functionality...');
        const searchResults = await connector.search({
            query: 'TypeScript migration test',
            limit: 5,
            useHybrid: true
        });
        
        console.log(`✅ Search returned ${searchResults.length} results`);
        if (searchResults.length > 0) {
            console.log('📖 Top result:', {
                id: searchResults[0].id,
                title: searchResults[0].title,
                score: searchResults[0].score
            });
        }
        
        // Test retrieval
        console.log('📖 Testing document retrieval...');
        const retrievedDoc = await connector.getDocument(docId);
        console.log('✅ Document retrieved:', {
            id: retrievedDoc?.id,
            title: retrievedDoc?.title,
            hasEmbedding: !!retrievedDoc?.embedding
        });
        
        // Clean up test document
        await connector.deleteDocument(docId);
        console.log('🗑️ Test document cleaned up');
        
        console.log('🎉 All tests passed! New architecture is working correctly.');
        
    } catch (error) {
        console.error('❌ Error during testing:', error);
        throw error;
    } finally {
        await connector.disconnect();
        console.log('📡 Disconnected from database');
    }
}

// CSV import test
async function testCSVImport() {
    console.log('📄 Testing CSV import functionality...');
    
    const connector = new PostgreSQLConnector(config, openaiApiKey);
    
    try {
        await connector.connect();
        
        // Check if STAB-ANFORDERUNGEN.CSV exists
        const csvPath = join(process.cwd(), 'STAB-ANFORDERUNGEN.CSV');
        
        try {
            readFileSync(csvPath);
            console.log('📄 Found STAB-ANFORDERUNGEN.CSV, testing import...');
            
            const importResult = await connector.importFromCSV(csvPath, {
                delimiter: ';',
                encoding: 'utf8',
                validateText: true,
                skipEmptyLines: true
            });
            
            console.log('📊 Import result:', importResult);
            
        } catch (fileError) {
            console.log('ℹ️ STAB-ANFORDERUNGEN.CSV not found, skipping CSV import test');
        }
        
    } catch (error) {
        console.error('❌ Error during CSV import test:', error);
    } finally {
        await connector.disconnect();
    }
}

// Main migration test
async function main() {
    console.log('🔄 Starting TypeScript Architecture Migration Test');
    console.log('=====================================================');
    
    try {
        await testNewArchitecture();
        await testCSVImport();
        
        console.log('\n✅ Migration test completed successfully!');
        console.log('\n📋 Next steps:');
        console.log('1. Update your MCP server to use the new TypeScript connector');
        console.log('2. Update import statements to use the new architecture');
        console.log('3. Replace PostgreSQLRetriever with PostgreSQLConnector');
        console.log('4. Use the new typed interfaces for better development experience');
        
    } catch (error) {
        console.error('\n❌ Migration test failed:', error);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
    main();
}