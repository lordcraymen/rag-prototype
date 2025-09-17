// Quick script to query documents in the database
import { createXenovaConnector } from './src/connectors/postgresql/factories.js';

const config = { 
    host: 'localhost', 
    port: 5432, 
    database: 'rag', 
    user: 'postgres', 
    password: 'postgres' 
};

const db = createXenovaConnector(config);

try {
    await db.connect();
    
    // Get sample documents with titles and content previews
    const result = await db.connection.query(`
        SELECT id, title, SUBSTRING(content, 1, 100) as preview, 
               LENGTH(content) as content_length,
               created_at
        FROM documents 
        ORDER BY created_at DESC 
        LIMIT 15;
    `);
    
    console.log(`📚 Sample documents in database (${result.length}/212):\n`);
    
    result.forEach((doc, i) => {
        console.log(`${i+1}. "${doc.title}"`);
        console.log(`   Preview: ${doc.preview}...`);
        console.log(`   Length: ${doc.content_length} chars, Created: ${doc.created_at.toISOString().split('T')[0]}\n`);
    });
    
    // Also check what topics/domains are covered
    const topicQuery = await db.connection.query(`
        SELECT DISTINCT 
            CASE 
                WHEN LOWER(title) LIKE '%ai%' OR LOWER(content) LIKE '%artificial intelligence%' THEN 'AI/ML'
                WHEN LOWER(title) LIKE '%python%' OR LOWER(content) LIKE '%python%' THEN 'Python'
                WHEN LOWER(title) LIKE '%javascript%' OR LOWER(content) LIKE '%javascript%' THEN 'JavaScript'
                WHEN LOWER(title) LIKE '%database%' OR LOWER(content) LIKE '%database%' THEN 'Database'
                WHEN LOWER(title) LIKE '%web%' OR LOWER(content) LIKE '%html%' THEN 'Web Development'
                WHEN LOWER(title) LIKE '%api%' OR LOWER(content) LIKE '%api%' THEN 'API'
                ELSE 'Other'
            END as topic_category,
            COUNT(*) as count
        FROM documents 
        GROUP BY topic_category
        ORDER BY count DESC;
    `);
    
    console.log('📊 Topic distribution:');
    topicQuery.forEach(row => {
        console.log(`   ${row.topic_category}: ${row.count} documents`);
    });
    
} catch (error) {
    console.error('Error:', error.message);
} finally {
    await db.disconnect();
}