export const RDF = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
export const RDFS = 'http://www.w3.org/2000/01/rdf-schema#';
export const OWL = 'http://www.w3.org/2002/07/owl#';
export const SKOS = 'http://www.w3.org/2004/02/skos/core#';

export interface Statement {
  id: string; subject: string; predicate: string;
  object_kind: 'iri' | 'blank' | 'literal'; object_value: string;
  datatype: string; language: string;
  graph_kind: 'default' | 'iri' | 'blank'; graph_value: string;
}
export interface Resource { id: string; term_kind: 'iri' | 'blank' }
export interface SearchDocument {
  resource_id: string; label: string; description: string; labels: string[];
  kinds: string[]; text_content: string;
}
export interface VocabularyArtifact {
  release: { id: string; vocabulary: string; version: string; source_url?: string; source_checksum: string; format: string; base_iri?: string };
  resources: Resource[]; statements: Statement[]; documents: SearchDocument[];
}
export interface ResourceRef { release_id: string; resource_id: string }
export interface SearchInput {
  text?: string; release_ids?: string[]; kind?: string; limit: number;
  mode: 'hybrid' | 'keyword' | 'semantic';
  context?: ResourceRef;
  constraint?: ResourceRef;
  depth: number;
  weights?: Partial<Record<'lexical' | 'label' | 'semantic' | 'graph' | 'accepted_alignment',number>>;
}
export interface RankedCandidate extends SearchDocument {
  release_id: string; score: number;
  signals: Array<{ method: string; rank: number; value: number; contribution: number; evidence?: Record<string, unknown> }>;
}
