#!/usr/bin/env node

/**
 * Test-Runner für alle Tests
 * Führt alle Tests nacheinander aus und gibt eine Zusammenfassung
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const tests = [
    { name: 'Configuration', file: 'test-config.js', description: 'Tests config loading' },
    { name: 'Connection', file: 'test-connection.js', description: 'Tests PostgreSQL connection' },
    { name: 'Database', file: 'test-database.js', description: 'Tests database functionality' },
    { name: 'RAG System', file: 'test-system.js', description: 'Tests complete RAG system' },
    { name: 'HTML Extractor', file: 'test-html-content-extractor.js', description: 'Tests HTML content extraction' }
];

async function runAllTests() {
    console.log('🧪 Running RAG Prototype Test Suite');
    console.log('=====================================\n');

    const results = [];

    for (const test of tests) {
        console.log(`🔍 Running ${test.name} test...`);
        console.log(`   ${test.description}`);

        try {
            const testPath = join(__dirname, test.file);
            await execAsync(`node "${testPath}"`);

            console.log(`✅ ${test.name} test PASSED\n`);
            results.push({ name: test.name, status: 'PASSED' });

        } catch (error) {
            console.log(`❌ ${test.name} test FAILED`);
            console.log(`   Error: ${error.message}\n`);
            results.push({ name: test.name, status: 'FAILED', error: error.message });
        }
    }

    // Zusammenfassung
    console.log('📊 Test Results Summary');
    console.log('=======================');

    const passed = results.filter(r => r.status === 'PASSED').length;
    const failed = results.filter(r => r.status === 'FAILED').length;

    results.forEach(result => {
        const icon = result.status === 'PASSED' ? '✅' : '❌';
        console.log(`${icon} ${result.name}: ${result.status}`);
    });

    console.log(`\n📈 Results: ${passed} passed, ${failed} failed of ${results.length} tests`);

    if (failed > 0) {
        console.log('\n❌ Some tests failed. Check the output above for details.');
        process.exit(1);
    } else {
        console.log('\n🎉 All tests passed successfully!');
        process.exit(0);
    }
}

runAllTests().catch(error => {
    console.error('❌ Test runner failed:', error.message);
    process.exit(1);
});

