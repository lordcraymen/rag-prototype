import { load } from 'cheerio';
import { RDF, RDFS, OWL, SKOS, type SearchDocument, type Statement } from './types.js';

export const PROJECTION_VERSION = 'label-description-v2';
const LABELS = new Set([`${RDFS}label`, `${SKOS}prefLabel`, `${SKOS}altLabel`, 'https://schema.org/name', 'http://schema.org/name']);
const DESCRIPTIONS = new Set([`${RDFS}comment`, `${SKOS}definition`, `${SKOS}scopeNote`, 'https://schema.org/description', 'http://schema.org/description']);
const TYPES: Record<string, string> = {
  [`${RDFS}Class`]: 'class', [`${OWL}Class`]: 'class', [`${RDF}Property`]: 'property',
  [`${OWL}ObjectProperty`]: 'property', [`${OWL}DatatypeProperty`]: 'property',
  [`${OWL}AnnotationProperty`]: 'property', [`${SKOS}Concept`]: 'concept',
};
const clean = (value: string) => load(value).text().replace(/\s+/g, ' ').trim();

/** Derive searchable definitions without rewriting the imported source statements. */
export function projectDocuments(statements: Statement[]): SearchDocument[] {
  const subjects = new Map<string, Statement[]>();
  for (const statement of statements) {
    const facts = subjects.get(statement.subject) ?? [];
    facts.push(statement); subjects.set(statement.subject, facts);
  }
  const documents: SearchDocument[] = [];
  for (const [resource_id, facts] of subjects) {
    facts.sort((a,b) => {
      const priority = (fact: Statement) => (fact.language==='en' ? 0 : fact.language==='' ? 1 : 2)*10 +
        (fact.predicate===`${SKOS}prefLabel` ? 0 : fact.predicate===`${RDFS}label` ? 1 : 2);
      return priority(a)-priority(b) || a.predicate.localeCompare(b.predicate) || a.object_value.localeCompare(b.object_value);
    });
    const labels = [...new Set(facts.filter(f => f.object_kind === 'literal' && LABELS.has(f.predicate)).map(f => clean(f.object_value)).filter(Boolean))];
    const description = [...new Set(facts.filter(f => f.object_kind === 'literal' && DESCRIPTIONS.has(f.predicate)).map(f => clean(f.object_value)).filter(Boolean))].join('\n');
    const kinds = [...new Set(facts.filter(f => f.predicate === `${RDF}type`).map(f => TYPES[f.object_value]).filter(Boolean))];
    // Skip structural blank nodes and undefined external references in search; keep them in the graph.
    if (resource_id.startsWith('_:') || (!labels.length && !description)) continue;
    const label = labels[0] ?? resource_id.split(/[/#]/).pop() ?? resource_id;
    documents.push({ resource_id, label, description, labels, kinds: kinds.length ? kinds : ['resource'], text_content: [label, ...labels.slice(1), description].filter(Boolean).join('\n') });
  }
  return documents;
}
