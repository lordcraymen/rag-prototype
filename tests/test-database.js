#!/usr/bin/env node

/**
 * Test für die Datenbankfunktionalität
 * Führt eine einfache SQL-Abfrage aus um zu prüfen ob die DB funktioniert
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function testDatabase() {
    try {
        console.log('🧪 Testing database functionality...');
        
        const { stdout } = await execAsync(
            'docker exec -e PGPASSWORD=ragpassword rag-postgres psql -U raguser -d rag -c "SELECT \'Database ready!\' as status;"'
        );
        
        if (stdout.includes('Database ready!')) {
            console.log('✅ Database query executed successfully');
            console.log('✅ PostgreSQL database is functional');
            console.log('\n✅ Database functionality test passed!');
            process.exit(0);
        } else {
            throw new Error('Database query failed');
        }
        
    } catch (error) {
        console.error('❌ Database functionality test failed:');
        console.error('   Make sure Docker is running and execute: npm run docker:up');
        console.error('   Error:', error.message);
        process.exit(1);
    }
}

testDatabase();
