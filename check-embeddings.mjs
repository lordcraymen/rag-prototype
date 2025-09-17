// Check embedding dimensions in database
import { PostgreSQLXenovaConnector } from './src/connectors/postgresql/PostgreSQLXenovaConnector.js';

const config = { 
    host: 'localhost', 
    port: 5432, 
    database: 'rag', 
    user: 'postgres', 
    password: 'postgres' 
};

const db = new PostgreSQLXenovaConnector(config);

try {
    await db.connect();
    
    // Check embedding dimensions  
    const result = await db.connection.query(`
        SELECT id, title, 
               vector_dims(embedding) as embedding_dims,
               embedding IS NULL as is_null
        FROM documents 
        LIMIT 5;
    `);
    
    console.log('📊 Embedding dimensions check:');
    result.forEach(doc => {
        console.log(`${doc.id}: "${doc.title}"`);
        console.log(`   Embedding dims: ${doc.embedding_dims || 'NULL'}`);
        console.log(`   Is NULL: ${doc.is_null}`);
        console.log('');
    });
    
    // Check if pgvector extension is working
    const vectorCheck = await db.connection.query(`
        SELECT COUNT(*) as total,
               COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embeddings,
               COUNT(CASE WHEN vector_dims(embedding) > 0 THEN 1 END) as valid_embeddings
        FROM documents;
    `);
    
    console.log('📈 Vector statistics:');
    console.log(`Total documents: ${vectorCheck[0].total}`);
    console.log(`With embeddings: ${vectorCheck[0].with_embeddings}`);
    console.log(`Valid embeddings: ${vectorCheck[0].valid_embeddings}`);
    
} catch (error) {
    console.error('Error:', error.message);
} finally {
    await db.disconnect();
}