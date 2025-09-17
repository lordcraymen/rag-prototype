#!/usr/bin/env tsx
// FastMCP API Research Script

import { FastMCP } from 'fastmcp';

console.error('🔬 Researching FastMCP API...');

try {
    // Test: Constructor mit korrektem ServerOptions
    console.error('📝 Test: FastMCP constructor mit ServerOptions');
    const server = new FastMCP({
        name: 'test-server',
        version: '1.0.0'
    });
    console.error('✅ Constructor mit ServerOptions funktioniert');
    
    // Test: addTool mit korrekter Struktur
    console.error('\n� Test: addTool method');
    try {
        server.addTool({
            name: 'test_tool',
            description: 'Test tool',
            func: () => 'test result'  // func statt handler?
        });
        console.error('✅ addTool mit func funktioniert');
    } catch (error) {
        console.error('❌ addTool mit func error:', error);
        
        // Probiere andere mögliche property names
        try {
            server.addTool({
                name: 'test_tool2',
                description: 'Test tool 2',
                execute: () => 'test result'
            });
            console.error('✅ addTool mit execute funktioniert');
        } catch (error2) {
            console.error('❌ addTool mit execute error:', error2);
        }
    }
    
    // Test: Verfügbare Methoden
    console.error('\n📝 Available properties on FastMCP instance:');
    const props = Object.getOwnPropertyNames(server);
    console.error('📋 Instance properties:', props);
    
    // Test prototype methods
    const prototype = Object.getPrototypeOf(server);
    const methods = Object.getOwnPropertyNames(prototype).filter(name => {
        const prop = prototype[name];
        return typeof prop === 'function' && name !== 'constructor';
    });
    console.error('📋 Prototype methods:', methods);
    
} catch (error) {
    console.error('❌ Constructor error:', error);
    console.error('📋 Error details:', {
        name: error.name,
        message: error.message,
        stack: error.stack?.split('\n')[0]
    });
}

console.error('\n✅ FastMCP API research completed');