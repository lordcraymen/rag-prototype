/**
 * Test PostgreSQL RAG Connection
 */

import PostgreSQLRetriever from './retriever/postgresql-retriever.js';

async function testPostgreSQL() {
  console.log('Testing PostgreSQL RAG connection...');
  
  const retriever = new PostgreSQLRetriever({
    host: 'localhost',
    port: 5432,
    database: 'rag',
    user: 'raguser',
    password: 'ragpassword',
    modelName: 'Xenova/all-MiniLM-L6-v2'
  });

  try {
    // Initialize
    await retriever.initialize();
    console.log('✅ PostgreSQL connection successful!');

    // Get stats
    const stats = await retriever.getStats();
    console.log('Database stats:', stats);

    // Add test document
    console.log('\nAdding test document...');
    const doc = await retriever.addDocument(
      'test_pg_1', 
      'Das ist ein Test für PostgreSQL mit pgvector. Es funktioniert mit Embeddings und semantischer Suche.',
      { title: 'PostgreSQL Test' }
    );
    console.log('✅ Document added:', doc.id);

    // Search
    console.log('\nSearching for documents...');
    const results = await retriever.search('PostgreSQL Test', 3, 0.3);
    console.log('✅ Search results:', results.length);
    results.forEach((result, i) => {
      console.log(`  ${i+1}. ${result.id} (${(result.similarity * 100).toFixed(1)}%)`);
    });

    // List all
    console.log('\nAll documents:');
    const all = await retriever.getAllDocuments();
    console.log(`✅ Total documents: ${all.length}`);
    all.forEach((doc, i) => {
      console.log(`  ${i+1}. ${doc.id}: ${doc.content.substring(0, 50)}...`);
    });

    await retriever.close();
    console.log('\n✅ Test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

testPostgreSQL();
