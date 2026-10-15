import type { IEmbeddingService } from '../types/database.js';
import { RDF, RDFS, OWL, SKOS, type ResourceRef, type SearchInput, type RankedCandidate } from './types.js';
import { OntologyStore } from './store.js';

export const HIERARCHY_PREDICATES = [`${RDFS}subClassOf`, `${RDFS}subPropertyOf`, `${SKOS}broader`];
export const DEFAULT_WEIGHTS: Record<string,number> = { semantic:3, lexical:0.25, label:2, graph:1, accepted_alignment:1 };

/** Traverse source relationships with explicit predicates, release scope, and cycle protection. */
export async function traverse(store: OntologyStore, ref: ResourceRef, predicates = HIERARCHY_PREDICATES,
  direction: 'outbound' | 'inbound' | 'both' = 'both', depth = 2) {
  if (!Number.isInteger(depth) || depth < 1 || depth > 6) throw new Error('Depth must be between 1 and 6');
  await store.resource(ref);
  const result = await store.pool.query(`WITH RECURSIVE edges AS (
    SELECT subject AS source, object_value AS target, predicate FROM statements
    WHERE release_id=$1 AND object_kind<>'literal' AND predicate=ANY($3::text[]) AND $4 IN ('outbound','both')
    UNION
    SELECT object_value,subject,predicate FROM statements
    WHERE release_id=$1 AND object_kind<>'literal' AND predicate=ANY($3::text[]) AND $4 IN ('inbound','both')
  ), walk AS (
    SELECT $2::text AS resource_id, 0 AS depth, ARRAY[$2::text] AS path, ARRAY[]::text[] AS predicates
    UNION ALL
    SELECT e.target,w.depth+1,w.path||e.target,w.predicates||e.predicate
    FROM walk w JOIN edges e ON e.source=w.resource_id
    WHERE w.depth<$5 AND NOT e.target=ANY(w.path)
  ) SELECT DISTINCT ON(resource_id) resource_id,depth,path,predicates FROM walk ORDER BY resource_id,depth,path`,
  [ref.release_id, ref.resource_id, predicates, direction, depth]);
  return result.rows as Array<{ resource_id: string; depth: number; path: string[]; predicates: string[] }>;
}

/** Fuse independent rankings. Scores express retrieval evidence, not classification probability. */
export function fuse(rankings: Array<{ method: string; rows: Array<RankedCandidate & { value: number; evidence?: Record<string, unknown> }> }>, limit: number, weights = DEFAULT_WEIGHTS): RankedCandidate[] {
  const candidates = new Map<string, RankedCandidate>();
  for (const ranking of rankings) {
    const weight = weights[ranking.method] ?? 1;
    if (weight===0) continue;
    const seen = new Set<string>();
    ranking.rows.forEach((row, index) => {
      const key = JSON.stringify([row.release_id, row.resource_id]);
      if (seen.has(key)) return;
      seen.add(key);
      const candidate = candidates.get(key) ?? {
        release_id: row.release_id, resource_id: row.resource_id, label: row.label,
        description: row.description, labels: row.labels, kinds: row.kinds, text_content: row.text_content,
        score: 0, signals: [],
      };
      const contribution = weight / (60 + index + 1);
      candidate.score += contribution;
      candidate.signals.push({ method: ranking.method, rank: index + 1, value: row.value, contribution, evidence: row.evidence });
      candidates.set(key, candidate);
    });
  }
  return [...candidates.values()].sort((a,b) => b.score-a.score || a.release_id.localeCompare(b.release_id) || a.resource_id.localeCompare(b.resource_id)).slice(0,limit);
}

export class OntologySearch {
  constructor(readonly store: OntologyStore, readonly embeddings: IEmbeddingService, readonly model: string) {}

  async search(input: SearchInput) {
    const releases = input.release_ids ?? (await this.store.pool.query(`SELECT DISTINCT ON(vocabulary) id
      FROM vocabulary_releases ORDER BY vocabulary,created_at DESC,id`)).rows.map(row => row.id);
    const allReleases = await this.store.releases();
    if (releases.some(id => !allReleases.some(release => release.id === id))) throw new Error('Unknown release filter');
    const parameters: unknown[] = [releases, input.kind ?? null];
    let allowed = '';
    if (input.constraint) {
      // Only rdfs:subClassOf licenses this mechanically checked class refinement.
      if (input.kind && input.kind !== 'class') throw new Error('Subclass constraints require kind=class');
      if (!releases.includes(input.constraint.release_id)) throw new Error('Constraint release is outside the search scope');
      if (!(await this.store.pool.query(`SELECT 1 FROM statements WHERE release_id=$1 AND subject=$2 AND predicate=$3
        AND object_kind='iri' AND object_value=ANY($4::text[])`,
        [input.constraint.release_id,input.constraint.resource_id,`${RDF}type`,[`${RDFS}Class`,`${OWL}Class`]])).rowCount) throw new Error('Constraint ancestor must be an explicitly declared class');
      const descendants = await traverse(this.store,input.constraint,[`${RDFS}subClassOf`],'inbound',input.depth);
      parameters.push(input.constraint.release_id, descendants.map(row => row.resource_id));
      allowed = ' AND d.release_id=$3 AND d.resource_id=ANY($4::text[]) AND \'class\'=ANY(d.kinds)';
    }
    const scope = `d.release_id=ANY($1::text[]) AND ($2::text IS NULL OR $2=ANY(d.kinds))${allowed}`;
    const rankings: Parameters<typeof fuse>[0] = [];
    const poolSize = Math.max(input.limit*5,50);
    const warnings: string[] = [];
    const run = async (method: string, sql: string, values: unknown[]) => {
      rankings.push({ method, rows: (await this.store.pool.query(sql, values)).rows.map(row => ({ ...row,value:Number(row.value) })) });
    };
    if (input.text?.trim()) {
      const textIndex = parameters.length+1;
      if (input.mode !== 'semantic') {
        const lexicalQuery = `websearch_to_tsquery('english',regexp_replace($${textIndex},'\\s+',' OR ','g'))`;
        await run('lexical', `SELECT d.*,ts_rank_cd(d.lexical,${lexicalQuery},2) AS value
          FROM search_documents d WHERE ${scope} AND d.lexical @@ ${lexicalQuery}
          ORDER BY value DESC,resource_id LIMIT ${poolSize}`, [...parameters,input.text]);
        await run('label', `SELECT d.*,1.0 AS value FROM search_documents d WHERE ${scope}
          AND EXISTS(SELECT 1 FROM unnest(d.labels||ARRAY[d.label]) label WHERE lower(label)=lower($${textIndex}))
          ORDER BY resource_id LIMIT ${poolSize}`, [...parameters,input.text]);
      }
      if (input.mode !== 'keyword') {
        const indexed = await this.store.pool.query(`SELECT 1 FROM search_documents d WHERE ${scope}
          AND d.embedding IS NOT NULL AND d.embedding_model=$${textIndex} LIMIT 1`,[...parameters,this.model]);
        if (!indexed.rowCount) {
          warnings.push('No semantic candidates indexed with the configured embedding model');
        } else {
        const vector = await this.embeddings.generateEmbedding(input.text);
        if (vector.length !== 384 || vector.some(value => !Number.isFinite(value))) throw new Error('Invalid query embedding');
        await run('semantic', `SELECT d.*,1-(d.embedding <=> $${textIndex}::vector) AS value FROM search_documents d
          WHERE ${scope} AND d.embedding IS NOT NULL AND d.embedding_model=$${textIndex+1}
          ORDER BY d.embedding <=> $${textIndex}::vector,resource_id LIMIT ${poolSize}`, [...parameters,JSON.stringify(vector),this.model]);
        }
      }
    }
    if (input.context) {
      const neighbours = await traverse(this.store,input.context,HIERARCHY_PREDICATES,'both',input.depth);
      const contextIndex = parameters.length+1;
      await run('graph', `SELECT d.*,1.0/(1+n.depth) AS value,
        jsonb_build_object('path',n.path,'predicates',n.predicates,'depth',n.depth) AS evidence FROM search_documents d
        JOIN jsonb_to_recordset($${contextIndex}::jsonb) AS n(resource_id text,depth integer,path text[],predicates text[]) USING(resource_id)
        WHERE ${scope} AND d.release_id=$${contextIndex+1} ORDER BY n.depth,d.resource_id LIMIT ${poolSize}`,
      [...parameters,JSON.stringify(neighbours),input.context.release_id]);
      await run('accepted_alignment', `SELECT DISTINCT d.*,1.0 AS value,
        jsonb_build_object('assertion_id',a.id,'relation',a.relation,'rationale',a.rationale,
          'source_release',a.source_release,'source_resource',a.source_resource,
          'target_release',a.target_release,'target_resource',a.target_resource) AS evidence
        FROM search_documents d JOIN alignment_assertions a
        ON (a.source_release=$${contextIndex} AND a.source_resource=$${contextIndex+1} AND a.target_release=d.release_id AND a.target_resource=d.resource_id)
        OR (a.target_release=$${contextIndex} AND a.target_resource=$${contextIndex+1} AND a.source_release=d.release_id AND a.source_resource=d.resource_id)
        WHERE ${scope} AND a.status='accepted' AND NOT EXISTS(SELECT 1 FROM alignment_assertions newer WHERE newer.supersedes=a.id)
        ORDER BY d.resource_id LIMIT ${poolSize}`,
      [...parameters,input.context.release_id,input.context.resource_id]);
    }
    if (!input.text?.trim() && !input.context) throw new Error('Search requires text or graph context');
    const weights = { ...DEFAULT_WEIGHTS,...input.weights };
    if (Object.values(weights).some(weight => !Number.isFinite(weight) || weight<0 || weight>10)) throw new Error('Weights must be between 0 and 10');
    const results = fuse(rankings,input.limit,weights);
    return { results, warnings, release_ids: releases, fusion: 'weighted_reciprocal_rank_60', weights, constraint: input.constraint ?? null };
  }
}
