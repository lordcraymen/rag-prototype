#!/usr/bin/env node

/**
 * Test-Client für den HTTP MCP Server
 */

import fetch from 'node-fetch';

const serverUrl = 'http://localhost:3000';

async function testServer() {
  console.log('🧪 Testing HTTP MCP Server...\n');
  
  try {
    // Test 1: Server Status
    console.log('📡 Test 1: Server Status (GET)');
    const statusResponse = await fetch(serverUrl);
    console.log(`   Status: ${statusResponse.status}`);
    
    if (statusResponse.ok) {
      const statusData = await statusResponse.json();
      console.log(`   ✅ Server: ${statusData.service}`);
      console.log(`   📋 Tools: ${statusData.available_tools.join(', ')}`);
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
    return;
  }
  
  try {
    // Test 2: Add Document
    console.log('\n📝 Test 2: Add Document');
    const addDocRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: {
        name: "add_document",
        arguments: {
          content: "This is a test document for the HTTP MCP server. It contains information about testing and validation.",
          title: "HTTP Test Document",
          metadata: {
            test: true,
            created_by: "http_test_client"
          }
        }
      }
    };
    
    const addResponse = await fetch(serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(addDocRequest)
    });
    
    console.log(`   Status: ${addResponse.status}`);
    
    if (addResponse.ok) {
      const data = await addResponse.json();
      console.log(`   ✅ Document added successfully`);
      const responseText = data.result?.content?.[0]?.text || '';
      const docIdMatch = responseText.match(/Document ID: ([^\n]+)/);
      if (docIdMatch) {
        console.log(`   📄 Document ID: ${docIdMatch[1]}`);
      }
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  try {
    // Test 3: Query Documents
    console.log('\n🔍 Test 3: Query Documents');
    const queryRequest = {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: "query_documents",
        arguments: {
          query: "HTTP test document validation",
          limit: 3
        }
      }
    };
    
    const queryResponse = await fetch(serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(queryRequest)
    });
    
    console.log(`   Status: ${queryResponse.status}`);
    
    if (queryResponse.ok) {
      const data = await queryResponse.json();
      const responseText = data.result?.content?.[0]?.text || '';
      
      if (responseText.includes('No documents found')) {
        console.log(`   ℹ️  No matching documents found`);
      } else {
        console.log(`   ✅ Query executed successfully`);
        console.log(`   📊 Response length: ${responseText.length} characters`);
        
        // Extract relevance scores
        const relevanceMatches = responseText.match(/\((\d+\.\d+)% relevance\)/g);
        if (relevanceMatches) {
          console.log(`   🎯 Found ${relevanceMatches.length} relevant documents`);
        }
      }
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  try {
    // Test 4: List Documents
    console.log('\n📚 Test 4: List Documents');
    const listRequest = {
      jsonrpc: "2.0",
      id: 3,
      method: "tools/call",
      params: {
        name: "list_documents",
        arguments: {}
      }
    };
    
    const listResponse = await fetch(serverUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(listRequest)
    });
    
    console.log(`   Status: ${listResponse.status}`);
    
    if (listResponse.ok) {
      const data = await listResponse.json();
      const responseText = data.result?.content?.[0]?.text || '';
      
      const docCountMatch = responseText.match(/\((\d+) documents\)/);
      if (docCountMatch) {
        console.log(`   ✅ Found ${docCountMatch[1]} documents in knowledge base`);
      } else if (responseText.includes('No documents')) {
        console.log(`   ℹ️  Knowledge base is empty`);
      }
    }
    
  } catch (error) {
    console.log(`   ❌ Error: ${error.message}`);
  }
  
  console.log('\n🎉 Test completed!');
  console.log(`\n💡 For ChatGPT Developer Mode:`);
  console.log(`   URL: ${serverUrl}`);
  console.log(`   Method: Add this URL as an MCP server in ChatGPT Developer Mode`);
}

// Run tests
testServer().catch(console.error);
