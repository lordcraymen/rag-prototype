import { PostgreSQLRetriever } from '../retriever/postgresql-retriever.js';
import fs from 'fs';
import { parse } from 'csv-parse/sync';

class CSVImporter {
  constructor() {
    this.retriever = new PostgreSQLRetriever();
  }

  async initialize() {
    await this.retriever.initialize();
    console.log('✅ PostgreSQL Retriever initialized');
  }

  /**
   * Import CSV file to RAG database
   * @param {string} csvFile - Path to CSV file
   * @param {Object} options - Import options
   * @param {string} options.delimiter - CSV delimiter (default: ',')
   * @param {string} options.idColumn - Column to use as document ID
   * @param {string} options.titleColumn - Column to use as document title
   * @param {Array<string>} options.excludeColumns - Columns to exclude from content
   */
  async importCSV(csvFile, options = {}) {
    const {
      delimiter = ';',  // Standard für deutsche CSV-Dateien
      idColumn = 'JIRA Issue Key',
      titleColumn = 'Überschrift',
      excludeColumns = []
    } = options;

    console.log(`📁 Reading CSV file: ${csvFile}`);
    console.log(`🔧 Using delimiter: "${delimiter}"`);

    try {
      const csvData = fs.readFileSync(csvFile, 'utf8');
      
      const records = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        delimiter: delimiter,
        trim: true,
        bom: true // Handle UTF-8 BOM
      });

      console.log(`📊 Found ${records.length} records`);

      if (records.length === 0) {
        console.log('❌ No records found in CSV file');
        return;
      }

      // Show available columns
      const columns = Object.keys(records[0]);
      console.log(`📋 Available columns: ${columns.join(', ')}`);

      let successCount = 0;
      let errorCount = 0;

      for (const [index, record] of records.entries()) {
        try {
          const doc = this.transformRecord(record, {
            idColumn,
            titleColumn,
            excludeColumns,
            rowIndex: index
          });

          await this.retriever.addDocument(doc);
          successCount++;

          if ((index + 1) % 10 === 0) {
            console.log(`⏳ Processed ${index + 1}/${records.length} documents`);
          }

        } catch (error) {
          console.error(`❌ Error processing row ${index + 1}:`, error.message);
          errorCount++;
        }
      }

      console.log(`\n🎉 Batch import completed!`);
      console.log(`✅ Success: ${successCount} documents`);
      console.log(`❌ Errors: ${errorCount} documents`);

      return {
        success: successCount,
        errors: errorCount,
        total: records.length
      };

    } catch (error) {
      console.error('❌ Failed to import CSV:', error.message);
      throw error;
    }
  }

  /**
   * Transform CSV record to RAG document format
   */
  transformRecord(record, options) {
    const { idColumn, titleColumn, excludeColumns, rowIndex } = options;

    // Generate document title
    const title = titleColumn && record[titleColumn]
      ? record[titleColumn]
      : `STAB Anforderung ${rowIndex + 1}`;

    // Generate content from all columns with proper formatting
    const contentParts = [];
    
    for (const [columnName, value] of Object.entries(record)) {
      // Skip excluded columns
      if (excludeColumns.includes(columnName)) {
        continue;
      }

      // Add column with value (or empty if null/undefined)
      const cleanValue = (value || '').toString().trim();
      contentParts.push(`${columnName}: ${cleanValue}`);
    }

    const content = contentParts.join('\n');

    // Ensure content is not empty
    const finalContent = content.trim() || `Empty document - Row ${rowIndex + 1}`;

    // Create metadata from original record
    const metadata = {
      source: 'csv_import',
      file: 'STAB-ANFORDERUNGEN.CSV',
      imported_at: new Date().toISOString(),
      jira_key: record[idColumn] || null,
      prüfkriterium: record['Prüfkriteriennummer'] || null,
      quelle: record['Quelle'] || null,
      verbindlichkeit: record['Verbindlichkeit'] || null,
      original_data: record
    };

    return {
      title: title,
      text: finalContent,  // PostgreSQL erwartet 'text' nicht 'content'
      metadata: metadata
    };
  }

  async close() {
    if (this.retriever) {
      await this.retriever.close();
    }
  }
}

// CLI Usage
async function main() {
  const args = process.argv.slice(2);
  console.log(`Starting with args: ${JSON.stringify(args)}`);
  
  if (args.length === 0) {
    console.log(`
📖 Usage: node utils/CSVImporter.js <csv-file> [options]

Options:
  --delimiter=<char>     CSV delimiter (default: ';')
  --id-column=<name>     Column to use as document ID (default: 'JIRA Issue Key')
  --title-column=<name>  Column to use as document title (default: 'Überschrift')
  --exclude=<col1,col2>  Columns to exclude from content

Examples:
  node utils/CSVImporter.js STAB-ANFORDERUNGEN.CSV
  node utils/CSVImporter.js STAB-ANFORDERUNGEN.CSV --delimiter=";"
  node utils/CSVImporter.js STAB-ANFORDERUNGEN.CSV --title-column="Überschrift"
  node utils/CSVImporter.js STAB-ANFORDERUNGEN.CSV --exclude="JIRA Issue Key"
    `);
    process.exit(1);
  }

  const csvFile = args[0];
  const options = {};

  // Parse CLI options
  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    
    if (arg.startsWith('--delimiter=')) {
      options.delimiter = arg.split('=')[1];
    } else if (arg.startsWith('--id-column=')) {
      options.idColumn = arg.split('=')[1];
    } else if (arg.startsWith('--title-column=')) {
      options.titleColumn = arg.split('=')[1];
    } else if (arg.startsWith('--exclude=')) {
      options.excludeColumns = arg.split('=')[1].split(',');
    }
  }

  if (!fs.existsSync(csvFile)) {
    console.error(`❌ File not found: ${csvFile}`);
    process.exit(1);
  }

  const importer = new CSVImporter();
  
  try {
    await importer.initialize();
    const result = await importer.importCSV(csvFile, options);
    
    console.log(`\n📊 Final Results:`);
    console.log(`Total processed: ${result.total}`);
    console.log(`Successful imports: ${result.success}`);
    console.log(`Failed imports: ${result.errors}`);
    
  } catch (error) {
    console.error('❌ Import failed:', error.message);
    process.exit(1);
  } finally {
    await importer.close();
  }
}

// Run if called directly
if (process.argv[1].endsWith('CSVImporter.js')) {
  main().catch(error => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
  });
}

export { CSVImporter };