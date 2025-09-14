#!/usr/bin/env node

/**
 * Test für die Konfiguration des RAG-Systems
 * Prüft ob die Config-Module korrekt geladen werden können
 */

import { ConfigManager } from '../mcp/lib/config.js';

async function testConfig() {
    try {
        console.log('🧪 Testing configuration loading...');
        
        const config = ConfigManager.getRagConfig();
        
        console.log('✅ Config loaded successfully:');
        console.log('   Database Host:', config.host);
        console.log('   Database Port:', config.port);
        console.log('   Database Name:', config.database);
        console.log('   Database User:', config.user);
        console.log('   Model Name:', config.modelName);
        
        console.log('\n✅ Configuration test passed!');
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Configuration test failed:');
        console.error(error.message);
        process.exit(1);
    }
}

testConfig();
