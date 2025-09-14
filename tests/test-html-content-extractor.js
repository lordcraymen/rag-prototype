#!/usr/bin/env node

/**
 * Tests for HTMLContentExtractor
 * Covers edge cases for content extraction
 */

import assert from 'assert';
import { HTMLContentExtractor } from '../mcp/lib/html-content-extractor.js';

async function run() {
  console.log('🧪 Testing HTML content extraction...');
  const extractor = new HTMLContentExtractor();

  // Test removing scripts and styles
  let html = `<html><head><title>T</title><script>var x=1</script><style>p{}</style></head><body><p>Hello</p></body></html>`;
  let result = extractor.extractContentFromHtml(html, 'https://example.com');
  assert.ok(!result.content.includes('var x'), 'Script content should be removed');
  assert.ok(result.content.includes('Hello'), 'Paragraph should remain');

  // Test relative link resolution
  html = `<html><body><a href="/path">Link</a></body></html>`;
  result = extractor.extractContentFromHtml(html, 'https://example.com/base');
  assert.ok(result.content.includes('[Link](https://example.com/path)'), 'Relative link should resolve to absolute');

  // Test headings and code blocks
  html = `<html><body><h2>Header</h2><pre><code>const a = 1;</code></pre></body></html>`;
  result = extractor.extractContentFromHtml(html, 'https://example.com');
  assert.ok(result.content.includes('## Header'), 'Heading level should be converted');
  assert.ok(result.metadata.hasCodeBlocks, 'Code block should be detected');

  console.log('✅ HTML content extraction tests passed');
}

run().catch(err => {
  console.error('❌ HTML content extraction tests failed');
  console.error(err);
  process.exit(1);
});

