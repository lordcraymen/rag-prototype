import { FastMCP } from 'fastmcp';
import { z } from 'zod';
import PostgreSQLRetriever from '../retriever/postgresql-retriever.js';
import SimpleGenerator from '../generator/index.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

// Get the directory of the current file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.dirname(__dirname); // Go one level up from mcp/ to project root

// Initialize RAG components
console.error('Initializing PostgreSQL RAG components...');
const retriever = new PostgreSQLRetriever({
  host: 'localhost',
  port: 5432,
  database: 'rag',
  user: 'raguser',
  password: 'ragpassword',
  modelName: 'Xenova/all-MiniLM-L6-v2'
});

const generator = new SimpleGenerator({
  maxResponseLength: 2000,
  includeSourceInfo: true
});

// Initialize retriever (async)
let initializationPromise = null;
const initializeRetriever = async () => {
  if (!initializationPromise) {
    initializationPromise = retriever.initialize();
  }
  return initializationPromise;
};

const server = new FastMCP({
  name: 'RAG Service',
  version: '1.0.0',
  description: 'A RAG service with local embeddings and vector search'
});

// Add a tool to add documents to the RAG system
server.addTool({
  name: 'add_document',
  description: 'Add a document to the RAG knowledge base',
  parameters: z.object({
    content: z.string().describe('The document content to add'),
    title: z.string().optional().describe('Optional document title'),
    metadata: z.record(z.any()).optional().describe('Optional metadata for the document')
  }),
  execute: async (params) => {
    try {
      // Ensure retriever is initialized
      await initializeRetriever();
      
      // Generate unique document ID
      const docId = `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Add document to retriever
      const document = await retriever.addDocument(docId, params.content, {
        title: params.title,
        ...params.metadata
      });

      console.error('\n=== DOCUMENT ADDED ===');
      console.error(`ID: ${docId}`);
      console.error(`Title: ${params.title || 'Untitled'}`);
      console.error(`Content: ${params.content.substring(0, 100)}...`);
      console.error(`Metadata: ${JSON.stringify(params.metadata || {})}`);
      console.error(`Timestamp: ${new Date().toISOString()}`);
      console.error('===================\n');
      
      const stats = await retriever.getStats();
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ Document successfully added to RAG knowledge base!\n\nDetails:\n- Document ID: ${docId}\n- Title: ${params.title || 'Untitled'}\n- Content length: ${params.content.length} characters\n- Added with Xenova embeddings (${retriever.modelName})\n- Timestamp: ${document.metadata.addedAt}\n- Storage: PostgreSQL + pgvector\n\n📊 Knowledge Base Stats:\n- Total documents: ${stats.totalDocuments}\n- Average document length: ${Math.round(stats.averageDocumentLength)} characters\n- Database: ${stats.database}@${stats.host}\n- Embedding model: ${stats.modelName}\n- Storage: PostgreSQL + pgvector extension`
          }
        ]
      };
    } catch (error) {
      console.error('Error adding document:', error);
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error adding document: ${error.message}`
          }
        ]
      };
    }
  }
});

// Add a tool to fetch and add documents from URLs
server.addTool({
  name: 'add_document_from_url',
  description: 'Fetch content from URLs and add to knowledge base. Perfect for adding documentation websites, API references, or technical articles. Much faster than manual web requests.',
  parameters: z.object({
    url: z.string().describe('URL to fetch content from'),
    title: z.string().optional().describe('Optional title override (will use page title if not provided)'),
    metadata: z.record(z.any()).optional().describe('Optional additional metadata')
  }),
  execute: async (params) => {
    try {
      // Ensure retriever is initialized
      await initializeRetriever();
      
      console.error('\n=== FETCHING URL ===');
      console.error(`URL: ${params.url}`);
      console.error(`Title: ${params.title || 'Auto-detect'}`);
      console.error('==================\n');
      
      // Fetch content from URL
      let response;
      try {
        response = await fetch(params.url);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Failed to fetch URL: ${error.message}`
            }
          ]
        };
      }
      
// Function to extract readable content from HTML
function extractContentFromHtml(html, url) {
  // Remove script, style, and navigation elements
  let cleanContent = html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, ''); // Remove comments

  // Extract title
  const titleMatch = cleanContent.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].trim() : new URL(url).pathname;

  // Extract meta description
  const metaDescMatch = cleanContent.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']*)["'][^>]*>/i);
  const description = metaDescMatch ? metaDescMatch[1] : '';

  // Convert headers to readable format with hierarchy
  cleanContent = cleanContent
    .replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h[1-6]>/gi, (match, level, text) => {
      const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      const prefix = '#'.repeat(parseInt(level));
      return `\n\n${prefix} ${cleanText}\n\n`;
    });

  // Convert paragraphs and preserve structure
  cleanContent = cleanContent
    .replace(/<p[^>]*>([\s\S]*?)<\/p>/gi, (match, text) => {
      const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      return cleanText ? `${cleanText}\n\n` : '';
    });

  // Convert lists
  cleanContent = cleanContent
    .replace(/<ul[^>]*>([\s\S]*?)<\/ul>/gi, (match, content) => {
      const items = content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
      const listItems = items.map(item => {
        const text = item.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        return text ? `• ${text}` : '';
      }).filter(Boolean).join('\n');
      return listItems ? `\n${listItems}\n\n` : '';
    })
    .replace(/<ol[^>]*>([\s\S]*?)<\/ol>/gi, (match, content) => {
      const items = content.match(/<li[^>]*>([\s\S]*?)<\/li>/gi) || [];
      const listItems = items.map((item, index) => {
        const text = item.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
        return text ? `${index + 1}. ${text}` : '';
      }).filter(Boolean).join('\n');
      return listItems ? `\n${listItems}\n\n` : '';
    });

  // Convert code blocks
  cleanContent = cleanContent
    .replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, (match, code) => {
      const cleanCode = code
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&amp;/g, '&')
        .replace(/&quot;/g, '"');
      return `\n\`\`\`\n${cleanCode}\n\`\`\`\n\n`;
    })
    .replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, (match, code) => {
      const cleanCode = code.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
      return ` \`${cleanCode}\` `;
    });

  // Extract and preserve important links as markdown
  cleanContent = cleanContent
    .replace(/<a[^>]*href=["']([^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi, (match, href, text) => {
      const linkText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      if (linkText && href) {
        // Convert relative URLs to absolute
        try {
          const absoluteUrl = new URL(href, url).href;
          return ` [${linkText}](${absoluteUrl}) `;
        } catch {
          return ` [${linkText}](${href}) `;
        }
      }
      return linkText || '';
    });

  // Remove remaining HTML tags
  cleanContent = cleanContent
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-zA-Z0-9#]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\n\s*\n\s*\n/g, '\n\n')
    .trim();

  return {
    title,
    content: cleanContent,
    metadata: {
      description,
      originalUrl: url,
      contentLength: cleanContent.length,
      hasCodeBlocks: /```/.test(cleanContent),
      hasLinks: /\[.*\]\(.*\)/.test(cleanContent)
    }
  };
}
      // Get content
      const html = await response.text();
      
      // Extract content using improved HTML processing
      const extracted = extractContentFromHtml(html, params.url);
      const documentTitle = params.title || extracted.title;
      const cleanContent = extracted.content;
      
      if (cleanContent.length < 50) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Content too short after processing (${cleanContent.length} chars). URL might require JavaScript or have restricted access.`
            }
          ]
        };
      }
      
      // Generate unique document ID
      const docId = `url_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Add document to retriever with enhanced metadata
      const document = await retriever.addDocument(docId, cleanContent, {
        title: documentTitle,
        source: 'url',
        sourceUrl: params.url,
        sourceType: 'web_fetch',
        fetchedAt: new Date().toISOString(),
        description: extracted.metadata.description,
        hasCodeBlocks: extracted.metadata.hasCodeBlocks,
        hasLinks: extracted.metadata.hasLinks,
        ...params.metadata
      });

      console.error('\n=== URL DOCUMENT ADDED ===');
      console.error(`ID: ${docId}`);
      console.error(`Title: ${documentTitle}`);
      console.error(`URL: ${params.url}`);
      console.error(`Content length: ${cleanContent.length} characters`);
      console.error(`Timestamp: ${document.metadata.addedAt}`);
      console.error('========================\n');
      
      const stats = await retriever.getStats();
      
      return {
        content: [
          {
            type: 'text',
            text: `✅ Document successfully fetched and added to knowledge base!\n\nDetails:\n- Document ID: ${docId}\n- Title: ${documentTitle}\n- URL: ${params.url}\n- Content length: ${cleanContent.length} characters\n- Fetched at: ${document.metadata.fetchedAt}\n- Added with Xenova embeddings (${retriever.modelName})\n- Storage: PostgreSQL + pgvector\n\n📊 Knowledge Base Stats:\n- Total documents: ${stats.totalDocuments}\n- Average document length: ${Math.round(stats.averageDocumentLength)} characters\n- Database: ${stats.database}@${stats.host}\n- Embedding model: ${stats.modelName}`
          }
        ]
      };
    } catch (error) {
      console.error('Error adding document from URL:', error);
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error fetching and adding document: ${error.message}`
          }
        ]
      };
    }
  }
});

// Add a tool to fetch and process entire sitemap
server.addTool({
  name: 'add_documents_from_sitemap',
  description: 'Fetch entire sitemap and batch-add all relevant documentation URLs to knowledge base. Perfect for comprehensive documentation coverage.',
  parameters: z.object({
    sitemapUrl: z.string().describe('URL to the sitemap.xml file'),
    urlFilter: z.string().optional().describe('Filter pattern (regex) to match specific URLs (e.g., "/docs/" for documentation)'),
    maxDocuments: z.number().optional().describe('Maximum number of documents to process (default: 50)'),
    metadata: z.record(z.any()).optional().describe('Optional metadata to apply to all documents')
  }),
  execute: async (params) => {
    try {
      // Ensure retriever is initialized
      await initializeRetriever();
      
      console.error('\n=== SITEMAP PROCESSING ===');
      console.error(`Sitemap URL: ${params.sitemapUrl}`);
      console.error(`Filter: ${params.urlFilter || 'none'}`);
      console.error(`Max docs: ${params.maxDocuments || 50}`);
      console.error('=========================\n');
      
      // Fetch sitemap
      let response;
      try {
        response = await fetch(params.sitemapUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Failed to fetch sitemap: ${error.message}`
            }
          ]
        };
      }
      
      const sitemapXml = await response.text();
      
      // Extract URLs from sitemap XML
      const urlRegex = /<loc>(.*?)<\/loc>/g;
      const allUrls = [];
      let match;
      
      while ((match = urlRegex.exec(sitemapXml)) !== null) {
        allUrls.push(match[1]);
      }
      
      console.error(`Found ${allUrls.length} URLs in sitemap`);
      
      // Filter URLs if pattern provided
      let filteredUrls = allUrls;
      if (params.urlFilter) {
        const filterRegex = new RegExp(params.urlFilter, 'i');
        filteredUrls = allUrls.filter(url => filterRegex.test(url));
        console.error(`Filtered to ${filteredUrls.length} URLs matching "${params.urlFilter}"`);
      }
      
      // Limit number of documents
      const maxDocs = params.maxDocuments || 50;
      if (filteredUrls.length > maxDocs) {
        filteredUrls = filteredUrls.slice(0, maxDocs);
        console.error(`Limited to first ${maxDocs} URLs`);
      }
      
      // Process URLs in batches
      const results = [];
      const errors = [];
      const batchSize = 5; // Process 5 URLs at a time
      
      for (let i = 0; i < filteredUrls.length; i += batchSize) {
        const batch = filteredUrls.slice(i, i + batchSize);
        console.error(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(filteredUrls.length/batchSize)}: ${batch.length} URLs`);
        
        // Process batch sequentially to avoid overwhelming the server
        for (const url of batch) {
          try {
            console.error(`  [${i + batch.indexOf(url) + 1}/${filteredUrls.length}] ${url}`);
            
            // Fetch content from URL
            const urlResponse = await fetch(url);
            if (!urlResponse.ok) {
              throw new Error(`HTTP ${urlResponse.status}: ${urlResponse.statusText}`);
            }
            
            const html = await urlResponse.text();
            
            // Extract content using improved HTML processing
            const extracted = extractContentFromHtml(html, url);
            const documentTitle = extracted.title;
            const cleanContent = extracted.content;
            
            if (cleanContent.length < 50) {
              errors.push(`${url}: Content too short (${cleanContent.length} chars)`);
              continue;
            }
            
            // Generate unique document ID
            const docId = `sitemap_${Date.now()}_${i + batch.indexOf(url)}_${Math.random().toString(36).substr(2, 6)}`;
            
            // Add document to retriever with enhanced metadata
            await retriever.addDocument(docId, cleanContent, {
              title: documentTitle,
              source: 'sitemap',
              sourceUrl: url,
              sourceType: 'sitemap_fetch',
              fetchedAt: new Date().toISOString(),
              sitemapUrl: params.sitemapUrl,
              batchIndex: i + batch.indexOf(url),
              description: extracted.metadata.description,
              hasCodeBlocks: extracted.metadata.hasCodeBlocks,
              hasLinks: extracted.metadata.hasLinks,
              ...params.metadata
            });
            
            results.push({
              id: docId,
              title: documentTitle,
              url: url,
              length: cleanContent.length
            });
            
            console.error(`    ✅ Added: ${documentTitle} (${cleanContent.length} chars)`);
            
            // Small delay to be nice to the server
            await new Promise(resolve => setTimeout(resolve, 200));
            
          } catch (error) {
            console.error(`    ❌ Failed: ${error.message}`);
            errors.push(`${url}: ${error.message}`);
          }
        }
      }
      
      const stats = await retriever.getStats();
      
      let responseText = `🗺️ **Sitemap processing completed!**\n\n`;
      responseText += `**Results:**\n`;
      responseText += `- Successfully processed: **${results.length}/${filteredUrls.length}** URLs\n`;
      responseText += `- Total URLs in sitemap: ${allUrls.length}\n`;
      responseText += `- URLs after filtering: ${filteredUrls.length}\n`;
      responseText += `- Errors: ${errors.length}\n\n`;
      
      if (results.length > 0) {
        responseText += `**Successfully Added Documents:**\n`;
        results.slice(0, 10).forEach((result, index) => {
          responseText += `${index + 1}. **${result.title}**\n`;
          responseText += `   - URL: ${result.url}\n`;
          responseText += `   - Length: ${result.length} characters\n\n`;
        });
        
        if (results.length > 10) {
          responseText += `... and ${results.length - 10} more documents\n\n`;
        }
      }
      
      if (errors.length > 0 && errors.length <= 10) {
        responseText += `**Errors:**\n`;
        errors.forEach((error, index) => {
          responseText += `${index + 1}. ${error}\n`;
        });
        responseText += `\n`;
      } else if (errors.length > 10) {
        responseText += `**Errors:** ${errors.length} errors occurred (first few shown above)\n\n`;
      }
      
      responseText += `**Updated Knowledge Base Stats:**\n`;
      responseText += `- Total documents: ${stats.totalDocuments}\n`;
      responseText += `- Average document length: ${Math.round(stats.averageDocumentLength)} characters\n`;
      responseText += `- Database: ${stats.database}@${stats.host}\n`;
      responseText += `- Embedding model: ${stats.modelName}`;
      
      return {
        content: [
          {
            type: 'text',
            text: responseText
          }
        ]
      };
    } catch (error) {
      console.error('Error in sitemap processing:', error);
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error processing sitemap: ${error.message}`
          }
        ]
      };
    }
  }
});

// Add a tool to search/query the RAG system with hybrid search
server.addTool({
  name: 'query_documents',
  description: 'Search and retrieve relevant documents from the RAG knowledge base using hybrid BM25 + embedding search',
  parameters: z.object({
    query: z.string().describe('The search query'),
    limit: z.number().optional().describe('Maximum number of results to return (default: 5)'),
    threshold: z.number().optional().describe('Similarity threshold (0-1, default: 0.05)'),
    useHybrid: z.boolean().optional().describe('Use hybrid BM25+vector search (default: true)'),
    bm25Weight: z.number().optional().describe('Weight for BM25 score (0-1, default: 0.3)'),
    vectorWeight: z.number().optional().describe('Weight for vector similarity (0-1, default: 0.7)')
  }),
  execute: async (params) => {
    try {
      // Ensure retriever is initialized
      await initializeRetriever();
      
      const limit = params.limit || 5;
      const threshold = params.threshold || 0.05;
      const useHybrid = params.useHybrid !== false; // Default to true
      const bm25Weight = params.bm25Weight || 0.3;
      const vectorWeight = params.vectorWeight || 0.7;
      
      // Choose search method
      let documents;
      if (useHybrid) {
        documents = await retriever.hybridSearch(params.query, limit, threshold, bm25Weight, vectorWeight);
      } else {
        documents = await retriever.search(params.query, limit, threshold);
      }
      
      console.error('\n=== RAG QUERY ===');
      console.error(`Query: ${params.query}`);
      console.error(`Search type: ${useHybrid ? 'Hybrid (BM25+Vector)' : 'Vector only'}`);
      console.error(`Documents found: ${documents.length}`);
      console.error(`Threshold: ${threshold}`);
      if (documents.length > 0) {
        const bestDoc = documents[0];
        if (useHybrid) {
          console.error(`Best match: Hybrid=${(bestDoc.hybridScore * 100).toFixed(1)}% (Vector=${(bestDoc.similarity * 100).toFixed(1)}%, BM25=${bestDoc.bm25Score.toFixed(2)})`);
        } else {
          console.error(`Best match: ${(bestDoc.similarity * 100).toFixed(1)}%`);
        }
        console.error(`Worst match: ${useHybrid ? (documents[documents.length-1].hybridScore * 100).toFixed(1) : (documents[documents.length-1].similarity * 100).toFixed(1)}%`);
      }
      console.error('=================\n');

      if (documents.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `🔍 No documents found matching "${params.query}" in the knowledge base.\n\nThe system searched through all documents using ${useHybrid ? 'hybrid BM25+vector' : 'vector'} search with Xenova embeddings (${retriever.modelName}) but found no relevant content.\n\nTry:\n- Using different keywords or synonyms\n- Adding more relevant documents to the knowledge base\n- Checking if the content you're looking for exists`
            }
          ]
        };
      }

      // Generate response using the generator with ALL found documents
      const result = await generator.generate(params.query, documents);
      
      // Format response with detailed source information including scores
      let responseText = `🔍 **Query:** "${params.query}"\n`;
      responseText += `🔬 **Search Type:** ${useHybrid ? `Hybrid Search (BM25: ${Math.round(bm25Weight*100)}%, Vector: ${Math.round(vectorWeight*100)}%)` : 'Vector Search Only'}\n\n`;
      responseText += `**Generated Response:**\n${result.response}\n\n`;
      
      if (result.sources && result.sources.length > 0) {
        responseText += `**Sources Used (with ${useHybrid ? 'Hybrid' : 'Vector'} Scores):**\n`;
        result.sources.forEach((source, idx) => {
          if (useHybrid) {
            const hybridScore = documents[idx]?.hybridScore || source.similarity;
            const bm25Score = documents[idx]?.bm25Score || 0;
            const relevanceLevel = hybridScore > 0.5 ? "High" : 
                                  hybridScore > 0.3 ? "Medium" : 
                                  hybridScore > 0.15 ? "Low" : "Very Low";
            responseText += `${idx + 1}. **${source.title}** (Hybrid: ${(hybridScore * 100).toFixed(1)}% - ${relevanceLevel})\n`;
            responseText += `   📊 Vector: ${(source.similarity * 100).toFixed(1)}% | BM25: ${bm25Score.toFixed(2)} | Combined: ${(hybridScore * 100).toFixed(1)}%\n`;
            responseText += `   ${source.excerpt}\n\n`;
          } else {
            const relevanceLevel = source.similarity > 0.5 ? "High" : 
                                  source.similarity > 0.3 ? "Medium" : 
                                  source.similarity > 0.15 ? "Low" : "Very Low";
            responseText += `${idx + 1}. **${source.title}** (${(source.similarity * 100).toFixed(1)}% - ${relevanceLevel} Relevance)\n`;
            responseText += `   ${source.excerpt}\n\n`;
          }
        });
      }
      
      // Add all found documents with scores for transparency
      if (documents.length > (result.sources?.length || 0)) {
        responseText += `**Additional Documents Found (Lower Relevance):**\n`;
        documents.slice(result.sources?.length || 0).forEach((doc, idx) => {
          if (useHybrid) {
            const relevanceLevel = doc.hybridScore > 0.3 ? "Medium" : 
                                  doc.hybridScore > 0.15 ? "Low" : "Very Low";
            responseText += `${idx + (result.sources?.length || 0) + 1}. **${doc.metadata?.title || doc.id}** (Hybrid: ${(doc.hybridScore * 100).toFixed(1)}% - ${relevanceLevel})\n`;
            responseText += `   📊 Vector: ${(doc.similarity * 100).toFixed(1)}% | BM25: ${doc.bm25Score.toFixed(2)}\n`;
          } else {
            const relevanceLevel = doc.similarity > 0.3 ? "Medium" : 
                                  doc.similarity > 0.15 ? "Low" : "Very Low";
            responseText += `${idx + (result.sources?.length || 0) + 1}. **${doc.metadata?.title || doc.id}** (${(doc.similarity * 100).toFixed(1)}% - ${relevanceLevel})\n`;
          }
          responseText += `   ${doc.content.substring(0, 80)}...\n\n`;
        });
      }
      
      responseText += `**Search Metadata:**\n- Total documents found: ${documents.length}\n- Documents processed: ${result.metadata.documentsUsed}\n- Search algorithm: ${useHybrid ? 'Hybrid BM25+Vector' : 'Vector only'}\n`;
      
      if (useHybrid && documents.length > 0) {
        const avgHybrid = documents.reduce((sum, doc) => sum + doc.hybridScore, 0) / documents.length;
        const avgVector = documents.reduce((sum, doc) => sum + doc.similarity, 0) / documents.length;
        const avgBM25 = documents.reduce((sum, doc) => sum + doc.bm25Score, 0) / documents.length;
        responseText += `- Average hybrid score: ${(avgHybrid * 100).toFixed(1)}%\n- Average vector similarity: ${(avgVector * 100).toFixed(1)}%\n- Average BM25 score: ${avgBM25.toFixed(2)}\n`;
        responseText += `- Best hybrid match: ${(documents[0].hybridScore * 100).toFixed(1)}%\n`;
      } else if (documents.length > 0) {
        responseText += `- Average similarity: ${(result.metadata.averageSimilarity * 100).toFixed(1)}%\n- Best match: ${(documents[0].similarity * 100).toFixed(1)}%\n`;
      }
      
      responseText += `- Embedding model: ${retriever.modelName}\n- Generated at: ${result.metadata.generatedAt}`;

      return {
        content: [
          {
            type: 'text',
            text: responseText
          }
        ]
      };
    } catch (error) {
      console.error('Error querying documents:', error);
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error searching documents: ${error.message}`
          }
        ]
      };
    }
  }
});

// Add a tool to get RAG service status
server.addTool({
  name: 'get_rag_status',
  description: 'Get the current status of the RAG service',
  parameters: z.object({}),
  execute: async () => {
    try {
      // Ensure retriever is initialized
      await initializeRetriever();
      
      const stats = await retriever.getStats();
      const allDocs = await retriever.getAllDocuments();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'operational',
              service: 'RAG Service',
              uptime: process.uptime(),
              version: '1.0.0',
              components: {
                embeddings: `Xenova Transformers (${stats.modelName})`,
                vectordb: `PostgreSQL + pgvector (${stats.host}:${stats.database})`,
                retriever: 'PostgreSQLRetriever - ready',
                generator: 'SimpleGenerator - ready'
              },
              statistics: {
                ...stats,
                documents: allDocs.length > 0 ? allDocs.map(doc => ({
                  id: doc.id,
                  title: doc.metadata?.title || 'Untitled',
                  contentLength: doc.content.length,
                  addedAt: doc.metadata.addedAt
                })) : []
              },
              message: 'RAG service is operational with PostgreSQL + pgvector storage + Xenova embeddings'
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      console.error('Error getting RAG status:', error);
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error getting status: ${error.message}`
          }
        ]
      };
    }
  }
});

// Add a tool to list all documents
server.addTool({
  name: 'list_documents',
  description: 'List all documents in the RAG knowledge base',
  parameters: z.object({}),
  execute: async () => {
    try {
      // Ensure retriever is initialized
      await initializeRetriever();
      
      const documents = await retriever.getAllDocuments();
      const stats = await retriever.getStats();
      
      if (documents.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: '📚 No documents in the knowledge base yet.\n\nUse the `add_document` tool to add some content!\n\nThe system uses PostgreSQL + pgvector with Xenova embeddings.'
            }
          ]
        };
      }

      let response = `📚 **Knowledge Base Contents** (${documents.length} documents)\n\n`;
      
      documents.forEach((doc, index) => {
        response += `**${index + 1}. ${doc.metadata?.title || doc.id}**\n`;
        response += `   - ID: ${doc.id}\n`;
        response += `   - Length: ${doc.content.length} characters\n`;
        response += `   - Added: ${doc.metadata.addedAt}\n`;
        response += `   - Preview: ${doc.content.substring(0, 100)}${doc.content.length > 100 ? '...' : ''}\n\n`;
      });

      response += `**Statistics:**\n`;
      response += `- Total documents: ${stats.totalDocuments}\n`;
      response += `- Average length: ${Math.round(stats.averageDocumentLength)} characters\n`;
      response += `- Embedding model: ${stats.modelName}\n`;
      response += `- Database: ${stats.database}@${stats.host}\n`;
      response += `- Storage: PostgreSQL + pgvector extension`;

      return {
        content: [
          {
            type: 'text',
            text: response
          }
        ]
      };
    } catch (error) {
      console.error('Error listing documents:', error);
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error listing documents: ${error.message}`
          }
        ]
      };
    }
  }
});

// Add a tool to remove documents
server.addTool({
  name: 'remove_document',
  description: 'Remove a document from the RAG knowledge base',
  parameters: z.object({
    id: z.string().describe('The document ID to remove')
  }),
  execute: async (params) => {
    try {
      // Ensure retriever is initialized
      await initializeRetriever();
      
      const document = await retriever.getDocument(params.id);
      
      if (!document) {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Document with ID "${params.id}" not found in the knowledge base.`
            }
          ]
        };
      }
      
      const removed = await retriever.removeDocument(params.id);
      const stats = await retriever.getStats();
      
      if (removed) {
        return {
          content: [
            {
              type: 'text',
              text: `✅ Document successfully removed from PostgreSQL database!\n\n**Removed Document:**\n- ID: ${params.id}\n- Title: ${document.metadata?.title || 'Untitled'}\n- Length: ${document.content.length} characters\n\n**Updated Stats:**\n- Remaining documents: ${stats.totalDocuments}\n- Database: ${stats.database}@${stats.host}\n- Storage: PostgreSQL + pgvector extension`
            }
          ]
        };
      } else {
        return {
          content: [
            {
              type: 'text',
              text: `❌ Failed to remove document "${params.id}" from PostgreSQL database.`
            }
          ]
        };
      }
    } catch (error) {
      console.error('Error removing document:', error);
      return {
        content: [
          {
            type: 'text',
            text: `❌ Error removing document: ${error.message}`
          }
        ]
      };
    }
  }
});

// Start the server
async function main() {
  try {
    await server.start({
      transportType: 'stdio'
    });
  } catch (error) {
    process.exit(1);
  }
}

main();


export default server;
