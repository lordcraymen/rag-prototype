#!/usr/bin/env tsx
import { readFile, writeFile } from 'node:fs/promises';
import { parseArgs } from 'node:util';
import { convertVocabulary } from '../ontology/import.js';
import { OntologyStore } from '../ontology/store.js';
import { XenovaEmbeddingService } from '../services/XenovaEmbeddingService.js';
import { readServerConfig } from '../server/config.js';

async function main() {
  const { positionals, values } = parseArgs({ allowPositionals: true, options: {
    vocabulary: { type: 'string' }, version: { type: 'string' }, format: { type: 'string' },
    source: { type: 'string' }, base: { type: 'string' }, output: { type: 'string' },
    release: { type: 'string' }, embed: { type: 'boolean', default: false }, 'dry-run': { type: 'boolean', default: false },
  } });
  const [command, file] = positionals;
  if (values['dry-run'] && command!=='import' && command!=='convert') throw new Error('--dry-run is supported only for import and convert');
  const config = readServerConfig([]);
  let artifact;
  if (command === 'import' || command === 'convert') {
    if (!file || !values.vocabulary || !values.version || !['turtle','ntriples','trig','jsonld'].includes(values.format ?? '')) {
      throw new Error('Usage: ontology import|convert FILE --vocabulary NAME --version VERSION --format turtle|ntriples|trig|jsonld [--dry-run] [--embed] [--output FILE]');
    }
    artifact = await convertVocabulary(await readFile(file,'utf8'), {
      vocabulary: values.vocabulary, version: values.version,
      format: values.format as 'turtle' | 'ntriples' | 'trig' | 'jsonld', source_url: values.source, base_iri: values.base,
    });
    if (values.output) await writeFile(values.output,JSON.stringify(artifact,null,2)+'\n');
    if (values['dry-run'] || command === 'convert') {
      console.log(JSON.stringify({ release: artifact.release, resources: artifact.resources.length, statements: artifact.statements.length, searchable: artifact.documents.length }));
      return;
    }
  }
  const store = new OntologyStore(config.database);
  const progress = (completed: number,total: number) => console.error(`Indexed ${completed}/${total} definitions`);
  try {
    if (command === 'migrate') {
      await store.pool.query(await readFile(new URL('../../db-init/020-ontology.sql', import.meta.url),'utf8'));
      console.log('Ontology schema ready');
    } else if (artifact) {
      console.log(JSON.stringify(await store.import(artifact)));
      if (values.embed) console.log(JSON.stringify(await store.reindex(artifact.release.id,new XenovaEmbeddingService(config.model),config.model,progress)));
    } else if (command === 'reindex' && values.release) {
      console.log(JSON.stringify(await store.reindex(values.release,values.embed ? new XenovaEmbeddingService(config.model) : undefined,config.model,progress)));
    } else { throw new Error('Commands: migrate, convert, import, reindex --release ID [--embed]'); }
  } finally { await store.close(); }
}
void main().catch(error => { console.error(error); process.exitCode=1; });
