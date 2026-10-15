# Ontology retrieval prototype

The source graph is authoritative. Search documents and embeddings are rebuildable projections. Ontology concepts remain scoped to a vocabulary release, even when two releases describe the same URI.

## Storage

- `vocabulary_releases`: vocabulary name, explicit version, source URL, SHA-256 checksum, parser format and base IRI. Reimporting identical source is idempotent. Different source bytes or parser options require a new version.
- `resources`: IRIs and release-local blank nodes. Blank-node identifiers are deterministic for identical input bytes, not canonical identities across equivalent serializations.
- `statements`: RDF subject, predicate, object, datatype, language and graph. Original predicates and literal values are preserved. Duplicate quads have RDF set semantics.
- `search_documents`: labels, cleaned definitions, resource kinds, lexical index, model-specific embeddings and projection version. External references with no label or definition and anonymous structure are retained in the graph but omitted from definition search.
- `alignment_assertions`: directed mapping proposals and decisions with actor, rationale, evidence and optional confidence. Imported facts are never rewritten by a mapping.

RDFS/OWL classes, RDF/OWL properties and SKOS concepts get distinct search filters. Resource kind is a projection of explicit type declarations, not inferred ontological equivalence.

## Import

Start PostgreSQL with `npm run docker:up`. Fresh databases run `db-init/020-ontology.sql` automatically. Existing databases need:

```bash
npm run ontology -- migrate
```

Import Turtle, TriG, N-Triples or JSON-LD:

```bash
npm run ontology -- import data/schemaorg-30.1.ttl \
  --vocabulary schema.org --version 30.1 --format turtle \
  --source https://schema.org/version/30.1/schemaorg-current-https.ttl \
  --output data/schemaorg-30.1.json --embed
```

`--dry-run` converts and reports counts without opening a database connection. `convert` also produces a reusable artifact without importing:

```bash
npm run ontology -- convert tests/fixtures/ontology-a.ttl \
  --vocabulary example --version 1 --format turtle --output data/example.json
```

JSON-LD requires inline contexts. Remote context retrieval is deliberately disabled so conversion does not depend on a mutable network response. Relative IRIs can use `--base`. RDF-star quoted triples and RDF/XML are not supported. OWL restrictions and RDF lists are preserved as statements, but there is no OWL reasoner.

Source import and lexical indexing are one transaction. Semantic indexing is separate: a failed embedding run leaves the previous projection intact. To rebuild from stored facts:

```bash
npm run ontology -- reindex --release RELEASE_ID --embed
```

Omitting `--embed` rebuilds the lexical projection and clears semantic embeddings for that release. Embeddings are fixed at 384 dimensions for the current model. Search compares only vectors bearing the configured model name. Rebuild after changing the embedding model or projection.

## Retrieval

Start `npm run dev:rest`. The same ontology operations are available through MCP, including stdio via `npm start`.

| Operation | Purpose |
| --- | --- |
| `ontology_releases` | Discover imported release IDs and provenance |
| `ontology_search` | Rank candidates from independent evidence channels |
| `ontology_resource` | Read original statements touching a resource |
| `ontology_traverse` | Walk explicitly chosen predicates within one release |
| `ontology_assert_alignment` | Append a proposal, acceptance or rejection |
| `ontology_alignments` | Inspect mapping decision history |

```bash
curl http://127.0.0.1:3000/rpc/ontology_search \
  -H 'Content-Type: application/json' \
  -d '{"text":"A human individual","kind":"class","mode":"hybrid","limit":8}'
```

Text search combines exact labels/aliases, partial-term English full-text ranking with length normalization, and cosine similarity over label/description text. Each channel retrieves a bounded candidate pool. Weighted reciprocal rank fusion uses `weight / (60 + rank)` per channel. Initial weights are semantic `3`, lexical `0.25`, exact label `2`, graph `1` and accepted alignment `1`. This keeps partial-word matches from overwhelming definition similarity. These are heuristic defaults, not calibrated measures; requests can override them with `weights`, and responses report the weights and each contribution. These scores rank evidence; they are not probabilities of a correct classification.

A `context` resource adds hierarchy neighbours and accepted mappings as independent channels. Hierarchy traversal uses `rdfs:subClassOf`, `rdfs:subPropertyOf` and `skos:broader`, retaining the actual predicates in explanation paths. Mapping evidence identifies the assertion, its direction, relation and rationale.

Use `release_ids` to pin the vocabulary versions. Without them, search chooses the most recently imported release of each vocabulary, not the greatest semantic version. `mode` may be `keyword`, `semantic` or `hybrid`. Keyword and graph-only searches need no model download; semantic indexing and semantic queries use the local Xenova model.

For a mechanically checked class refinement, add:

```json
{
  "text": "A human receiving medical care",
  "kind": "class",
  "mode": "hybrid",
  "constraint": {
    "release_id": "SCHEMA_RELEASE_ID",
    "resource_id": "https://schema.org/Person"
  },
  "context": {
    "release_id": "SCHEMA_RELEASE_ID",
    "resource_id": "https://schema.org/Person"
  },
  "depth": 2
}
```

The constraint is applied before candidate retrieval. It admits the ancestor itself and explicitly declared classes reached through inbound `rdfs:subClassOf` paths up to `depth`. A SKOS broader relation or cross-vocabulary mapping cannot satisfy it. This is bounded source-graph checking, not a proof of complete OWL subsumption or consistency. Cycles cannot repeat nodes in a traversal path.

`ontology_traverse` can inspect other predicates such as schema.org `domainIncludes` and `rangeIncludes`. These are retained as source guidance; this prototype does not promote them to hard restrictions. Relation-signature scoring, disjointness checks, role-aware classification and calibrated abstention remain future work.

## Mapping decisions

Mappings are explicitly directed and use the SKOS-inspired relation names `closeMatch`, `exactMatch`, `broadMatch`, `narrowMatch` and `relatedMatch`. For example, an Engineer concept can have `broadMatch` to Person: the target is broader than the source. These assertions do not assert OWL class equivalence.

The default status is `proposed`. Only current `accepted` assertions contribute ranking evidence. To revise one, append another assertion with the same endpoints/relation and `supersedes` set to the earlier assertion ID. A later rejection removes its ranking contribution while retaining its history. Confidence is an explicitly supplied judgement, not an embedding score. No mappings are automatically accepted during import.

## Verification and current data

```bash
npm run type-check
npm run test:unit
ONTOLOGY_TEST_DATABASE=1 npm run test:ontology:integration
```

Integration tests create uniquely named fixture releases and remove only their own data. They cover atomic rollback, version isolation, lexical aliases, semantic model identity, subclass filtering, cyclic traversal, projection rebuilding and mapping revision.

The local `data/` directory holds downloaded schema.org 30.1 and W3C ORG 0.8 sources, conversion artifacts and live smoke responses. ORG is recorded as `0.8-snapshot-2026-10-14` because its source URL is not version-pinned. Large downloaded artifacts are excluded from Git. PostgreSQL contains the imported releases and their locally generated embeddings.

The smoke cases demonstrate execution, not a retrieval-quality benchmark. The default projection combines available language labels and definitions; language-specific indexes and broader labelled evaluation are future improvements.

The original document tables and APIs remain available. Their pre-existing ID, CSV dry-run and lexical-search issues are outside the graph API and still need repair before using legacy document ingestion. Grapheon integration and acceptance of model classifications are separate from this reference retrieval prototype.
