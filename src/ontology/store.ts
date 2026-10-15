import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import type { DatabaseConfig, IEmbeddingService } from '../types/database.js';
import type { VocabularyArtifact, ResourceRef, Statement } from './types.js';
import { PROJECTION_VERSION, projectDocuments } from './projection.js';

export class OntologyStore {
  readonly pool: Pool;
  constructor(config: DatabaseConfig) { this.pool = new Pool({ ...config, max: 5 }); }
  async close() { await this.pool.end(); }
  async releases() { return (await this.pool.query('SELECT * FROM vocabulary_releases ORDER BY vocabulary, created_at DESC')).rows; }

  /** Atomically import one immutable source release and its derived lexical index. */
  async import(artifact: VocabularyArtifact) {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const { release } = artifact;
      const inserted = await client.query(`INSERT INTO vocabulary_releases
        (id,vocabulary,version,source_url,source_checksum,format,base_iri) VALUES ($1,$2,$3,$4,$5,$6,$7)
        ON CONFLICT (vocabulary,version) DO NOTHING RETURNING id`,
      [release.id, release.vocabulary, release.version, release.source_url ?? null, release.source_checksum, release.format,release.base_iri ?? null]);
      if (!inserted.rowCount) {
        const existing = (await client.query('SELECT source_checksum,format,base_iri FROM vocabulary_releases WHERE id=$1', [release.id])).rows[0];
        if (existing?.source_checksum !== release.source_checksum || existing?.format !== release.format || existing?.base_iri !== (release.base_iri ?? null)) throw new Error('Release already exists with different source bytes or parser options; use a new version');
        await client.query('COMMIT');
        return { release_id: release.id, imported: false, resources: artifact.resources.length, statements: artifact.statements.length, searchable: artifact.documents.length };
      }
      await client.query(`INSERT INTO resources SELECT $1, x.id, x.term_kind
        FROM jsonb_to_recordset($2::jsonb) AS x(id text, term_kind text)`, [release.id, JSON.stringify(artifact.resources)]);
      await client.query(`INSERT INTO statements SELECT $1, x.* FROM jsonb_to_recordset($2::jsonb) AS x(
        id text,subject text,predicate text,object_kind text,object_value text,datatype text,language text,graph_kind text,graph_value text)`,
      [release.id, JSON.stringify(artifact.statements)]);
      await client.query(`INSERT INTO search_documents (release_id,resource_id,label,description,kinds,labels,text_content,projection_version)
        SELECT $1,x.*, $3 FROM jsonb_to_recordset($2::jsonb) AS x(resource_id text,label text,description text,kinds text[],labels text[],text_content text)`,
      [release.id, JSON.stringify(artifact.documents), PROJECTION_VERSION]);
      await client.query('COMMIT');
      return { release_id: release.id, imported: true, resources: artifact.resources.length, statements: artifact.statements.length, searchable: artifact.documents.length };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  /** Rebuild the projection from stored facts, optionally generating semantic embeddings. */
  async reindex(releaseId: string, embeddings?: IEmbeddingService, model?: string, progress?: (completed: number,total: number) => void) {
    if (!(await this.pool.query('SELECT id FROM vocabulary_releases WHERE id=$1', [releaseId])).rowCount) throw new Error('Unknown release');
    if (embeddings && (embeddings.getDimensions() !== 384 || !model)) throw new Error('A model name and 384-dimensional embeddings are required');
    const facts = (await this.pool.query<Statement>('SELECT * FROM statements WHERE release_id=$1 ORDER BY id', [releaseId])).rows;
    const documents = projectDocuments(facts);
    const rows = [];
    for (const document of documents) {
      const vector = embeddings ? await embeddings.generateEmbedding(document.text_content) : undefined;
      if (vector && (vector.length !== 384 || vector.some(value => !Number.isFinite(value)))) throw new Error('Invalid embedding vector');
      rows.push({ ...document, vector: vector ? JSON.stringify(vector) : null });
      if (rows.length%100===0 || rows.length===documents.length) progress?.(rows.length,documents.length);
    }
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      // Serialise projection replacement against simultaneous rebuilds of this release.
      await client.query('SELECT id FROM vocabulary_releases WHERE id=$1 FOR UPDATE', [releaseId]);
      await client.query('DELETE FROM search_documents WHERE release_id=$1', [releaseId]);
      await client.query(`INSERT INTO search_documents (release_id,resource_id,label,description,kinds,labels,text_content,embedding,embedding_model,projection_version)
        SELECT $1,x.resource_id,x.label,x.description,x.kinds,x.labels,x.text_content,x.vector::vector,$3,$4
        FROM jsonb_to_recordset($2::jsonb) AS x(resource_id text,label text,description text,kinds text[],labels text[],text_content text,vector text)`,
      [releaseId, JSON.stringify(rows), embeddings ? model : null, PROJECTION_VERSION]);
      await client.query('COMMIT');
      return { release_id: releaseId, searchable: rows.length, embedded: embeddings ? rows.length : 0, projection_version: PROJECTION_VERSION };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }

  async resource(ref: ResourceRef) {
    const result = await this.pool.query('SELECT * FROM resources WHERE release_id=$1 AND id=$2', [ref.release_id, ref.resource_id]);
    if (!result.rowCount) throw new Error('Unknown resource in release');
    const facts = await this.pool.query(`SELECT * FROM statements WHERE release_id=$1 AND
      (subject=$2 OR (object_kind<>'literal' AND object_value=$2)) ORDER BY id`, [ref.release_id, ref.resource_id]);
    return { resource: result.rows[0], statements: facts.rows };
  }

  /** Append a mapping decision without modifying either imported vocabulary. */
  async assertAlignment(input: {
    source: ResourceRef; target: ResourceRef; relation: string;
    status: string; confidence?: number; rationale: string; evidence: string[]; actor: string; supersedes?: string;
  }) {
    await this.resource(input.source); await this.resource(input.target);
    if (input.supersedes) {
      const previous = (await this.pool.query('SELECT * FROM alignment_assertions WHERE id=$1',[input.supersedes])).rows[0];
      if (!previous || previous.source_release!==input.source.release_id || previous.source_resource!==input.source.resource_id ||
        previous.target_release!==input.target.release_id || previous.target_resource!==input.target.resource_id || previous.relation!==input.relation) {
        throw new Error('Superseded assertion must describe the same directed mapping');
      }
    }
    const id = randomUUID();
    await this.pool.query(`INSERT INTO alignment_assertions
      (id,source_release,source_resource,target_release,target_resource,relation,status,confidence,rationale,evidence,actor,supersedes)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [id,input.source.release_id,input.source.resource_id,input.target.release_id,input.target.resource_id,
      input.relation,input.status,input.confidence ?? null,input.rationale,JSON.stringify(input.evidence),input.actor,input.supersedes ?? null]);
    return { id, status: input.status };
  }
}
