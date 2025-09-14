#!/usr/bin/env node

/**
 * Test für die Datenbankverbindung
 * Prüft ob PostgreSQL verfügbar ist und die Verbindung funktioniert
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testConnection() {
    try {
        console.log('🧪 Testing PostgreSQL connection...');
        
        const { stdout } = await execAsync('docker exec rag-postgres pg_isready -U raguser -d rag');
        
        if (stdout.includes('accepting connections')) {
            console.log('✅ PostgreSQL is ready and accepting connections');
            console.log('\n✅ Database connection test passed!');
            process.exit(0);
        } else {
            throw new Error('PostgreSQL not ready');
        }
        
    } catch (error) {
        console.error('❌ Database connection test failed:');
        console.error('   Make sure Docker is running and execute: npm run docker:up');
        console.error('   Error:', error.message);
        process.exit(1);
    }
}

testConnection();
