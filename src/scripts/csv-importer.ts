#!/usr/bin/env tsx
// TypeScript CSV Importer - Lokale Xenova Embeddings (kein API Key!)

import { PostgreSQLXenovaConnector } from '@/connectors/postgresql/PostgreSQLXenovaConnector.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration laden
function loadConfig() {
    try {
        const configPath = join(__dirname, '..', 'config.json');
        const configData = readFileSync(configPath, 'utf8');
        return JSON.parse(configData);
    } catch (error) {
        return {
            database: {
                host: process.env.DB_HOST || 'localhost',
                port: parseInt(process.env.DB_PORT || '5432'),
                database: process.env.DB_NAME || 'rag',
                user: process.env.DB_USER || 'raguser',
                password: process.env.DB_PASSWORD || 'ragpassword',
                ssl: false
            },
            embedding: {
                model: process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2'
            }
        };
    }
}

interface CSVImportOptions {
    filePath: string;
    delimiter?: string;
    encoding?: string;
    validateText?: boolean;
    dryRun?: boolean;
}

class TypeScriptCSVImporter {
    private connector: PostgreSQLXenovaConnector;

    constructor(connector: PostgreSQLXenovaConnector) {
        this.connector = connector;
    }

    async importCSV(options: CSVImportOptions) {
        const {
            filePath,
            delimiter = ',',
            encoding = 'utf8',
            validateText = true,
            dryRun = false
        } = options;

        // Validate file exists
        if (!existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
        }

        console.error(`📄 Starting CSV import from: ${filePath}`);
        console.error(`🔧 Settings: delimiter="${delimiter}", encoding="${encoding}", validateText=${validateText}`);
        
        if (dryRun) {
            console.error('🧪 DRY RUN MODE - No documents will be actually imported');
        }

        try {
            const startTime = Date.now();
            
            const result = await this.connector.importFromCSV(filePath, {
                delimiter,
                encoding,
                validateText,
                skipEmptyLines: true
            });

            const duration = Date.now() - startTime;

            console.error('\n📊 Import Results:');
            console.error(`✅ Successfully imported: ${result.imported} documents`);
            console.error(`❌ Failed: ${result.failed} documents`);
            console.error(`⏱️ Duration: ${duration}ms`);
            console.error(`📈 Rate: ${(result.imported / (duration / 1000)).toFixed(2)} docs/sec`);

            if (result.errors && result.errors.length > 0) {
                console.error(`\n⚠️ Errors encountered:`);
                result.errors.slice(0, 10).forEach((error: string) => {
                    console.error(`  - ${error}`);
                });
                
                if (result.errors.length > 10) {
                    console.error(`  ... and ${result.errors.length - 10} more errors`);
                }
            }

            return result;

        } catch (error) {
            console.error(`❌ Import failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
            throw error;
        }
    }

    async getStatus() {
        const status = await this.connector.getStatus();
        const count = await this.connector.getDocumentCount();
        
        return {
            ...status,
            documentCount: count,
            architecture: 'typescript'
        };
    }
}

// CLI Interface
async function main() {
    const args = process.argv.slice(2);
    
    if (args.length === 0) {
        console.error(`
🔧 TypeScript CSV Importer

Usage:
  tsx src/scripts/csv-importer.ts <csv-file> [options]

Options:
  --delimiter=<char>     CSV delimiter (default: ',')
  --encoding=<encoding>  File encoding (default: 'utf8')
  --no-validate         Skip text validation
  --dry-run            Show what would be imported without actually importing

Examples:
  tsx src/scripts/csv-importer.ts data.csv
  tsx src/scripts/csv-importer.ts STAB-ANFORDERUNGEN.CSV --delimiter=";" --encoding="utf8"
  tsx src/scripts/csv-importer.ts data.csv --dry-run
        `);
        process.exit(1);
    }

    const filePath = args[0];
    const options: CSVImportOptions = { filePath };

    // Parse command line options
    for (const arg of args.slice(1)) {
        if (arg.startsWith('--delimiter=')) {
            options.delimiter = arg.split('=')[1];
        } else if (arg.startsWith('--encoding=')) {
            options.encoding = arg.split('=')[1];
        } else if (arg === '--no-validate') {
            options.validateText = false;
        } else if (arg === '--dry-run') {
            options.dryRun = true;
        }
    }

    try {
        console.error('🚀 Initializing TypeScript CSV Importer with local embeddings...');
        
        const config = loadConfig();
        
        // No API key needed for local Xenova embeddings! 🎉
        const connector = new PostgreSQLXenovaConnector(config.database, config.embedding.model);
        await connector.connect();

        const importer = new TypeScriptCSVImporter(connector);
        
        // Show current status
        const status = await importer.getStatus();
        console.error(`📊 Current status: ${status.documentCount} documents in database`);
        
        // Run import
        const result = await importer.importCSV(options);
        
        if (result.success) {
            console.error('\n🎉 Import completed successfully!');
        } else {
            console.error('\n⚠️ Import completed with errors');
            process.exit(1);
        }

        await connector.disconnect();

    } catch (error) {
        console.error(`💥 Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
        process.exit(1);
    }
}

// Run if this file is executed directly
if (process.argv[1] && (process.argv[1].includes('csv-importer') || process.argv[1].endsWith('csv-importer.ts'))) {
    main().catch(error => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}

export { TypeScriptCSVImporter };