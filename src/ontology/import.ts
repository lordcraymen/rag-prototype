import { createHash } from 'node:crypto';
import { Parser } from 'n3';
import jsonld from 'jsonld';
import type { VocabularyArtifact, Statement } from './types.js';
import { projectDocuments } from './projection.js';

const hash = (value: string) => createHash('sha256').update(value).digest('hex');

/** Parse local RDF without fetching remote JSON-LD contexts.
 * @example const artifact = await convertVocabulary(turtle, { vocabulary: 'schema.org', version: '30.1', format: 'turtle' });
 */
export async function convertVocabulary(
  source: string,
  options: { vocabulary: string; version: string; format: 'turtle' | 'ntriples' | 'trig' | 'jsonld'; source_url?: string; base_iri?: string },
): Promise<VocabularyArtifact> {
  if (!options.vocabulary.trim() || !options.version.trim()) throw new Error('Vocabulary and version are required');
  const release = { ...options, id: hash(JSON.stringify([options.vocabulary, options.version])), source_checksum: hash(source) };
  let rdf = source;
  if (options.format === 'jsonld') {
    rdf = await jsonld.toRDF(JSON.parse(source), {
      format: 'application/n-quads', base: options.base_iri,
      documentLoader: async () => { throw new Error('Remote JSON-LD contexts are disabled; supply an inline context'); },
    }) as unknown as string;
  }
  const formats = { turtle: 'text/turtle', ntriples: 'N-Triples', trig: 'TriG', jsonld: 'N-Quads' };
  const quads = new Parser({ format: formats[options.format], baseIRI: options.base_iri, blankNodePrefix: '' }).parse(rdf);
  const resources = new Map<string, 'iri' | 'blank'>();
  const statements = new Map<string, Statement>();
  const blankIds = new Map<string,string>();
  const nodeId = (term: { termType: string; value: string }) => {
    if (term.termType!=='BlankNode') return term.value;
    if (!blankIds.has(term.value)) blankIds.set(term.value,`_:b${blankIds.size}`);
    return blankIds.get(term.value)!;
  };
  for (const quad of quads) {
    if (!['NamedNode','BlankNode'].includes(quad.subject.termType) || quad.predicate.termType!=='NamedNode' ||
      !['NamedNode','BlankNode','Literal'].includes(quad.object.termType)) throw new Error('Quoted RDF-star triples are not supported');
    for (const term of [quad.subject, quad.predicate, quad.object, quad.graph]) {
      if (term.termType === 'NamedNode' || term.termType === 'BlankNode') {
        resources.set(nodeId(term), term.termType === 'BlankNode' ? 'blank' : 'iri');
      }
    }
    const literal = quad.object.termType === 'Literal' ? quad.object : undefined;
    const statement = {
      subject: nodeId(quad.subject), predicate: quad.predicate.value,
      object_kind: literal ? 'literal' as const : quad.object.termType === 'BlankNode' ? 'blank' as const : 'iri' as const,
      object_value: literal ? literal.value : nodeId(quad.object),
      datatype: literal?.datatype.value ?? '', language: literal?.language ?? '',
      graph_kind: quad.graph.termType === 'DefaultGraph' ? 'default' as const : quad.graph.termType === 'BlankNode' ? 'blank' as const : 'iri' as const,
      graph_value: quad.graph.termType === 'DefaultGraph' ? '' : nodeId(quad.graph),
    };
    const id = hash(JSON.stringify(statement));
    statements.set(id, { id, ...statement });
  }
  const facts = [...statements.values()];
  return { release, resources: [...resources].map(([id, term_kind]) => ({ id, term_kind })), statements: facts, documents: projectDocuments(facts) };
}
