/**
 * Test script for SimplePersistentRetriever
 * Tests reading and writing functionality independently
 */

import SimplePersistentRetriever from './retriever/simple-persistent-retriever.js';

async function testPersistence() {
  console.log('🧪 Starting SimplePersistentRetriever test...\n');
  
  try {
    // Create retriever instance
    const retriever = new SimplePersistentRetriever({
      modelName: 'Xenova/all-MiniLM-L6-v2',
      storagePath: './test_rag_storage'
    });
    
    console.log('📦 Initializing retriever (this may take a moment to load the model)...');
    await retriever.initialize();
    console.log('✅ Retriever initialized successfully!\n');
    
    // Check initial state
    console.log('📊 Initial stats:');
    const initialStats = await retriever.getStats();
    console.log(JSON.stringify(initialStats, null, 2));
    console.log();
    
    // Add test documents
    console.log('📝 Adding test documents...');
    
    const doc1 = await retriever.addDocument(
      'test1',
      'Das Einhorn lebt in mystischen Wäldern und hat magische Heilkräfte.',
      { title: 'Einhorn Info', source: 'test' }
    );
    console.log('✅ Added document 1:', doc1.id);
    
    const doc2 = await retriever.addDocument(
      'test2', 
      'Drachen sind mächtige Kreaturen die Feuer speien können.',
      { title: 'Drachen Info', source: 'test' }
    );
    console.log('✅ Added document 2:', doc2.id);
    
    const doc3 = await retriever.addDocument(
      'test3',
      'Feen sind kleine magische Wesen mit Flügeln die in Blumenfeldern leben.',
      { title: 'Fee Info', source: 'test' }
    );
    console.log('✅ Added document 3:', doc3.id);
    console.log();
    
    // Check stats after adding
    console.log('📊 Stats after adding documents:');
    const afterAddStats = await retriever.getStats();
    console.log(JSON.stringify(afterAddStats, null, 2));
    console.log();
    
    // Test search
    console.log('🔍 Testing search functionality...');
    const searchResults = await retriever.search('magische Kreaturen', 3, 0.1);
    console.log('Search results for "magische Kreaturen":');
    searchResults.forEach((result, idx) => {
      console.log(`  ${idx + 1}. ${result.metadata?.title || result.id} (${(result.similarity * 100).toFixed(1)}%)`);
      console.log(`     Content: ${result.content.substring(0, 60)}...`);
    });
    console.log();
    
    // Test file persistence by creating a new instance
    console.log('💾 Testing persistence - creating new retriever instance...');
    const retriever2 = new SimplePersistentRetriever({
      modelName: 'Xenova/all-MiniLM-L6-v2',
      storagePath: './test_rag_storage'
    });
    
    await retriever2.initialize();
    
    const persistedStats = await retriever2.getStats();
    console.log('📊 Stats from new instance (should show persisted documents):');
    console.log(JSON.stringify(persistedStats, null, 2));
    console.log();
    
    const persistedDocs = await retriever2.getAllDocuments();
    console.log('📚 Documents loaded from persistence:');
    persistedDocs.forEach((doc, idx) => {
      console.log(`  ${idx + 1}. ${doc.metadata?.title || doc.id}`);
      console.log(`     Content: ${doc.content.substring(0, 60)}...`);
    });
    console.log();
    
    // Test search on persisted data
    console.log('🔍 Testing search on persisted data...');
    const persistedSearch = await retriever2.search('Einhorn', 2, 0.1);
    console.log('Search results for "Einhorn" from persisted data:');
    persistedSearch.forEach((result, idx) => {
      console.log(`  ${idx + 1}. ${result.metadata?.title || result.id} (${(result.similarity * 100).toFixed(1)}%)`);
    });
    console.log();
    
    // Clean up test - remove one document
    console.log('🗑️  Testing document removal...');
    const removed = await retriever2.removeDocument('test2');
    console.log('Document removal result:', removed);
    
    const finalStats = await retriever2.getStats();
    console.log('📊 Final stats after removal:');
    console.log(JSON.stringify(finalStats, null, 2));
    
    console.log('\n✅ All tests completed successfully!');
    console.log('📁 Check the ./test_rag_storage folder for persisted files.');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Stack:', error.stack);
  }
}

// Run the test
testPersistence().catch(console.error);
