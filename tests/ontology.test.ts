import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { convertVocabulary } from '../src/ontology/import.js';
import { projectDocuments } from '../src/ontology/projection.js';
import { fuse } from '../src/ontology/search.js';
import type { RankedCandidate } from '../src/ontology/types.js';

const options = { vocabulary: 'test', version: '1', format: 'turtle' as const };
describe('Ontology conversion', () => {
  it('preserves hierarchy, typed resources, language and anonymous OWL restrictions', async () => {
    const artifact = await convertVocabulary(await readFile(new URL('./fixtures/ontology-a.ttl',import.meta.url),'utf8'),options);
    expect(artifact.statements.some(fact => fact.language==='en')).toBe(true);
    expect(artifact.resources.some(resource => resource.term_kind==='blank')).toBe(true);
    expect(artifact.statements.some(fact => fact.predicate.endsWith('onProperty'))).toBe(true);
    const person = artifact.documents.find(document => document.resource_id.endsWith('/Person'))!;
    expect(person.description).toBe('A human individual.');
    expect(person.kinds).toEqual(['class']);
    expect(artifact.statements.some(fact => fact.object_value.includes('<b>'))).toBe(true);
  });

  it('keeps named graphs, literal datatypes and duplicate RDF set semantics', async () => {
    const source = '<https://ex/g> { <https://ex/s> <https://ex/p> "12"^^<http://www.w3.org/2001/XMLSchema#integer> . <https://ex/s> <https://ex/p> "12"^^<http://www.w3.org/2001/XMLSchema#integer> . }';
    const result = await convertVocabulary(source,{ ...options,format:'trig' });
    expect(result.statements).toHaveLength(1);
    expect(result.statements[0]).toMatchObject({ graph_kind:'iri',graph_value:'https://ex/g',datatype:'http://www.w3.org/2001/XMLSchema#integer' });
  });

  it('imports inline JSON-LD and rejects remote contexts', async () => {
    const source = JSON.stringify({ '@context': { label:'http://www.w3.org/2000/01/rdf-schema#label' },'@id':'https://ex/Person',label:'Person' });
    const result = await convertVocabulary(source,{ ...options,format:'jsonld' });
    expect(result.documents[0].label).toBe('Person');
    await expect(convertVocabulary('{"@context":"https://schema.org","@id":"https://ex/P"}',{ ...options,format:'jsonld' })).rejects.toThrow();
  });

  it('creates reproducible release and statement IDs', async () => {
    const source = await readFile(new URL('./fixtures/ontology-a.ttl',import.meta.url),'utf8');
    expect(await convertVocabulary(source,options)).toEqual(await convertVocabulary(source,options));
  });

  it('preserves SKOS concepts and aliases as distinct from classes', async () => {
    const artifact = await convertVocabulary(await readFile(new URL('./fixtures/ontology-b.ttl',import.meta.url),'utf8'),options);
    expect(artifact.documents.find(document => document.resource_id.endsWith('/Human'))).toMatchObject({ kinds:['concept'],labels:expect.arrayContaining(['Human','Person']) });
    expect(projectDocuments(artifact.statements)).toEqual(artifact.documents);
  });

  it('retains undefined external classes in the graph but excludes them from definition search', async () => {
    const artifact = await convertVocabulary('<https://external/Person> a <http://www.w3.org/2000/01/rdf-schema#Class> .',options);
    expect(artifact.resources.some(resource => resource.id==='https://external/Person')).toBe(true);
    expect(artifact.documents).toEqual([]);
  });
});

describe('Rank fusion', () => {
  const candidate = (resource_id: string): RankedCandidate & { value:number } => ({ release_id:'release',resource_id,label:resource_id,description:'',labels:[],kinds:['class'],text_content:'',score:0,signals:[],value:0.8 });
  it('rewards agreement between methods and avoids duplicate contributions', () => {
    const results = fuse([{method:'lexical',rows:[candidate('a'),candidate('a'),candidate('b')]},{method:'semantic',rows:[candidate('b')]}],10);
    expect(results[0].resource_id).toBe('b');
    expect(results.find(result => result.resource_id==='a')!.signals).toHaveLength(1);
    expect(results[0].signals.map(signal => signal.method)).toEqual(['lexical','semantic']);
  });
  it('reports configurable channel contributions without treating scores as probabilities', () => {
    const results=fuse([{method:'semantic',rows:[candidate('a')]},{method:'lexical',rows:[candidate('b')]}],10,{semantic:2,lexical:0});
    expect(results.map(result=>result.resource_id)).toEqual(['a']);
    expect(results[0].signals[0].contribution).toBe(2/61);
  });
});
