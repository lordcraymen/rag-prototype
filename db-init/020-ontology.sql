-- Source statements are immutable per vocabulary release. Search is rebuildable.
CREATE EXTENSION IF NOT EXISTS vector;
CREATE TABLE IF NOT EXISTS vocabulary_releases (
  id text PRIMARY KEY,
  vocabulary text NOT NULL,
  version text NOT NULL,
  source_url text,
  source_checksum text NOT NULL,
  format text NOT NULL,
  base_iri text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vocabulary, version)
);
CREATE TABLE IF NOT EXISTS resources (
  release_id text NOT NULL REFERENCES vocabulary_releases(id),
  id text NOT NULL,
  term_kind text NOT NULL CHECK (term_kind IN ('iri', 'blank')),
  PRIMARY KEY (release_id, id)
);
CREATE TABLE IF NOT EXISTS statements (
  release_id text NOT NULL,
  id text NOT NULL,
  subject text NOT NULL,
  predicate text NOT NULL,
  object_kind text NOT NULL CHECK (object_kind IN ('iri', 'blank', 'literal')),
  object_value text NOT NULL,
  datatype text NOT NULL DEFAULT '',
  language text NOT NULL DEFAULT '',
  graph_kind text NOT NULL CHECK (graph_kind IN ('default', 'iri', 'blank')),
  graph_value text NOT NULL DEFAULT '',
  PRIMARY KEY (release_id, id),
  FOREIGN KEY (release_id, subject) REFERENCES resources(release_id, id)
);
CREATE INDEX IF NOT EXISTS statements_outbound ON statements(release_id, subject, predicate);
CREATE INDEX IF NOT EXISTS statements_inbound ON statements(release_id, object_value, predicate) WHERE object_kind <> 'literal';
CREATE TABLE IF NOT EXISTS search_documents (
  release_id text NOT NULL,
  resource_id text NOT NULL,
  label text NOT NULL,
  description text NOT NULL,
  kinds text[] NOT NULL,
  labels text[] NOT NULL,
  text_content text NOT NULL,
  embedding vector(384),
  embedding_model text,
  lexical tsvector GENERATED ALWAYS AS (to_tsvector('english', text_content)) STORED,
  projection_version text NOT NULL,
  PRIMARY KEY(release_id, resource_id),
  FOREIGN KEY(release_id, resource_id) REFERENCES resources(release_id, id)
);
CREATE INDEX IF NOT EXISTS ontology_lexical ON search_documents USING gin(lexical);
CREATE TABLE IF NOT EXISTS alignment_assertions (
  id text PRIMARY KEY,
  source_release text NOT NULL,
  source_resource text NOT NULL,
  target_release text NOT NULL,
  target_resource text NOT NULL,
  relation text NOT NULL CHECK (relation IN ('closeMatch','exactMatch','broadMatch','narrowMatch','relatedMatch')),
  status text NOT NULL CHECK (status IN ('proposed','accepted','rejected')),
  confidence double precision CHECK (confidence >= 0 AND confidence <= 1),
  rationale text NOT NULL,
  evidence jsonb NOT NULL DEFAULT '[]',
  actor text NOT NULL,
  supersedes text UNIQUE REFERENCES alignment_assertions(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(source_release, source_resource) REFERENCES resources(release_id, id),
  FOREIGN KEY(target_release, target_resource) REFERENCES resources(release_id, id)
);
-- Also upgrade databases created during the initial prototype iteration.
ALTER TABLE vocabulary_releases ADD COLUMN IF NOT EXISTS base_iri text;
ALTER TABLE alignment_assertions ADD COLUMN IF NOT EXISTS supersedes text UNIQUE REFERENCES alignment_assertions(id);
