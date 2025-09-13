#!/usr/bin/env node

import http from 'http';

const port = 3005;

const server = http.createServer((req, res) => {
  console.log(`📥 ${req.method} ${req.url}`);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/json');
  
  res.writeHead(200);
  res.end(JSON.stringify({
    message: 'Hello from simple test server!',
    method: req.method,
    url: req.url,
    timestamp: new Date().toISOString()
  }, null, 2));
});

server.listen(port, () => {
  console.log(`🚀 Simple test server running on http://localhost:${port}`);
});

process.on('SIGINT', () => {
  console.log('\n🛑 Stopping...');
  process.exit(0);
});
