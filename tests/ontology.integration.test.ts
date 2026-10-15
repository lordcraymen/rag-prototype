import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { convertVocabulary } from '../src/ontology/import.js';
import { OntologyStore } from '../src/ontology/store.js';
import { OntologySearch, traverse } from '../src/ontology/search.js';
import { readServerConfig } from '../src/server/config.js';
import { RDFS, type VocabularyArtifact } from '../src/ontology/types.js';
import type { IEmbeddingService } from '../src/types/database.js';
import { registerOntologyEndpoints } from '../src/ontology/endpoints.js';
import { createTransportPort, InMemoryEndpointRegistry, type LoggerPort } from '@lordcraymen/rivetbench';

// Opt-in: these tests create and remove only uniquely named fixture releases.
describe.skipIf(process.env.ONTOLOGY_TEST_DATABASE!=='1')('Ontology PostgreSQL integration', () => {
  const store = new OntologyStore(readServerConfig([]).database);
  const suffix = randomUUID();
  let a: VocabularyArtifact, b: VocabularyArtifact;
  const ids: string[] = [];
  const embedding: IEmbeddingService = {
    getDimensions: () => 384, isAvailable: async () => true,
    generateEmbedding: async text => { const vector=Array(384).fill(0); vector[text.includes('human') ? 0 : 1]=1; return vector; },
  };
  const search = new OntologySearch(store,embedding,'fixture-model');
  beforeAll(async () => {
    await store.pool.query(await readFile(new URL('../db-init/020-ontology.sql',import.meta.url),'utf8'));
    a = await convertVocabulary(await readFile(new URL('./fixtures/ontology-a.ttl',import.meta.url),'utf8'),{vocabulary:`fixture-a-${suffix}`,version:'1',format:'turtle'});
    b = await convertVocabulary(await readFile(new URL('./fixtures/ontology-b.ttl',import.meta.url),'utf8'),{vocabulary:`fixture-b-${suffix}`,version:'1',format:'turtle'});
    ids.push(a.release.id,b.release.id);
    await store.import(a); await store.import(b);
  });
  afterAll(async () => {
    await store.pool.query('DELETE FROM alignment_assertions WHERE source_release=ANY($1::text[]) OR target_release=ANY($1::text[])',[ids]);
    for (const table of ['search_documents','statements','resources']) await store.pool.query(`DELETE FROM ${table} WHERE release_id=ANY($1::text[])`,[ids]);
    await store.pool.query('DELETE FROM vocabulary_releases WHERE id=ANY($1::text[])',[ids]);
    await store.close();
  });
  const person = () => ({release_id:a.release.id,resource_id:'https://example.org/a/Person'});
  const human = () => ({release_id:b.release.id,resource_id:'https://example.org/b/Human'});

  it('imports idempotently and refuses changed bytes for an existing release', async () => {
    expect((await store.import(a)).imported).toBe(false);
    await expect(store.import({...a,release:{...a.release,source_checksum:'different'}})).rejects.toThrow('different source bytes');
    expect((await store.resource(person())).statements.some(fact => fact.object_value.includes('<b>'))).toBe(true);
  });

  it('rolls back the entire import when a statement is invalid', async () => {
    const invalid = await convertVocabulary('<https://ex/s> <https://ex/p> <https://ex/o> .',{vocabulary:`invalid-${suffix}`,version:'1',format:'turtle'});
    invalid.statements[0].subject='https://ex/missing';
    await expect(store.import(invalid)).rejects.toThrow();
    expect((await store.pool.query('SELECT id FROM vocabulary_releases WHERE id=$1',[invalid.release.id])).rowCount).toBe(0);
  });

  it('retrieves aliases across vocabularies while preserving term kinds', async () => {
    const result = await search.search({text:'Person',release_ids:ids,mode:'keyword',limit:10,depth:2});
    expect(result.results.map(candidate => candidate.resource_id)).toEqual(expect.arrayContaining([person().resource_id,human().resource_id]));
    expect(result.results.find(candidate => candidate.resource_id===human().resource_id)!.kinds).toEqual(['concept']);
  });

  it('combines vectors with lexical signals and enforces model identity', async () => {
    await store.reindex(a.release.id,embedding,'fixture-model');
    const result = await search.search({text:'human',release_ids:[a.release.id],mode:'hybrid',limit:10,depth:2});
    expect(result.results.some(candidate => candidate.signals.some(signal => signal.method==='semantic'))).toBe(true);
    expect(result.results.some(candidate => candidate.signals.some(signal => signal.method==='lexical'))).toBe(true);
    const wrongModel = new OntologySearch(store,embedding,'other-model');
    expect((await wrongModel.search({text:'human',release_ids:[a.release.id],mode:'semantic',limit:10,depth:2})).warnings).toHaveLength(1);
  });

  it('uses subclass constraints before ranking and never crosses a mapping', async () => {
    const result = await search.search({text:'human',release_ids:ids,mode:'keyword',limit:10,depth:2,constraint:person()});
    expect(result.results.map(candidate => candidate.resource_id).sort()).toEqual(['https://example.org/a/Engineer',person().resource_id].sort());
    expect((await traverse(store,person(),[`${RDFS}subClassOf`],'inbound',2)).find(node => node.resource_id.endsWith('/Engineer'))!.path).toEqual([person().resource_id,'https://example.org/a/Engineer']);
    await expect(search.search({text:'human',release_ids:[b.release.id],mode:'keyword',limit:10,depth:2,constraint:human()})).rejects.toThrow('declared class');
  });

  it('keeps proposed mappings out of ranking and honours later rejection', async () => {
    const mapping = {source:person(),target:human(),relation:'closeMatch',rationale:'Fixture match',evidence:[],actor:'test'};
    const proposal = await store.assertAlignment({...mapping,status:'proposed'});
    const query = {context:person(),release_ids:ids,mode:'keyword' as const,limit:10,depth:2};
    expect((await search.search(query)).results.find(candidate => candidate.resource_id===human().resource_id)).toBeUndefined();
    const accepted = await store.assertAlignment({...mapping,status:'accepted',supersedes:proposal.id});
    const match = (await search.search(query)).results.find(candidate => candidate.resource_id===human().resource_id)!;
    expect(match.signals[0].evidence).toMatchObject({relation:'closeMatch',assertion_id:accepted.id});
    await store.assertAlignment({...mapping,status:'rejected',supersedes:accepted.id});
    expect((await search.search(query)).results.find(candidate => candidate.resource_id===human().resource_id)).toBeUndefined();
  });

  it('rebuilds lexical documents from facts without changing the source graph', async () => {
    const original = (await store.resource(person())).statements;
    await store.reindex(a.release.id);
    expect((await store.resource(person())).statements).toEqual(original);
    const result = await search.search({text:'human',release_ids:[a.release.id],mode:'keyword',limit:10,depth:2});
    expect(result.results.find(candidate => candidate.resource_id===person().resource_id)!.description).toBe('A human individual.');
  });

  it('validates ontology operations through the shared RivetBench pipeline', async () => {
    const registry = new InMemoryEndpointRegistry();
    registerOntologyEndpoints(registry,store,search);
    const logger: LoggerPort = {info:()=>{},warn:()=>{},error:()=>{},child:()=>logger};
    const transport = createTransportPort(registry,logger);
    const result = await transport.invoke('ontology_search',{text:'Person',mode:'keyword',release_ids:ids});
    expect(result.output).toMatchObject({results:expect.arrayContaining([expect.objectContaining({resource_id:person().resource_id})])});
    await expect(transport.invoke('ontology_traverse',{...person(),depth:50})).rejects.toThrow('Invalid endpoint input');
  });

  it('scopes repeated URIs to their release and chooses the newest import by default', async () => {
    const newer = await convertVocabulary('<https://example.org/a/Person> <http://www.w3.org/2000/01/rdf-schema#label> "New Person" .',
      {vocabulary:a.release.vocabulary,version:'2',format:'turtle'});
    ids.push(newer.release.id); await store.import(newer);
    const old = await search.search({text:'Person',release_ids:[a.release.id],mode:'keyword',limit:10,depth:2});
    expect(old.results.find(candidate => candidate.resource_id===person().resource_id)!.label).toBe('Person');
    const current = await search.search({text:'New Person',mode:'keyword',limit:100,depth:2});
    expect(current.release_ids).toContain(newer.release.id);
    expect(current.release_ids).not.toContain(a.release.id);
  });

  it('terminates traversal through cyclic hierarchies without repeating a path node', async () => {
    const cycle = await convertVocabulary('@prefix ex: <https://ex/> . @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#> . ex:A rdfs:subClassOf ex:B . ex:B rdfs:subClassOf ex:A .',
      {vocabulary:`cycle-${suffix}`,version:'1',format:'turtle'});
    ids.push(cycle.release.id); await store.import(cycle);
    const nodes = await traverse(store,{release_id:cycle.release.id,resource_id:'https://ex/A'},[`${RDFS}subClassOf`],'outbound',6);
    expect(nodes).toHaveLength(2);
    expect(nodes.every(node => new Set(node.path).size===node.path.length)).toBe(true);
  });
});
