import { makeEndpoint, type EndpointRegistry } from '@lordcraymen/rivetbench';
import { z } from 'zod';
import { OntologyStore } from './store.js';
import { OntologySearch, traverse, HIERARCHY_PREDICATES } from './search.js';

const Ref = z.object({ release_id: z.string().min(1), resource_id: z.string().min(1) });
const Candidate = z.object({
  release_id: z.string(), resource_id: z.string(), label: z.string(), description: z.string(),
  labels: z.array(z.string()), kinds: z.array(z.string()), text_content: z.string(), score: z.number(),
  signals: z.array(z.object({ method: z.string(), rank: z.number(), value: z.coerce.number(), contribution: z.number(), evidence: z.record(z.unknown()).optional() })),
});

/** Register graph retrieval and explicit alignment decisions alongside the legacy document API. */
export function registerOntologyEndpoints(registry: EndpointRegistry, store: OntologyStore, search: OntologySearch) {
  registry.register(makeEndpoint({ name: 'ontology_releases', summary: 'List imported vocabulary releases',
    input: z.object({}), output: z.object({ releases: z.array(z.object({
      id: z.string(), vocabulary: z.string(), version: z.string(), source_url: z.string().nullable(), source_checksum: z.string(), format: z.string(),
    })) }), handler: async () => ({ releases: await store.releases() }),
  }));
  registry.register(makeEndpoint({ name: 'ontology_search', summary: 'Rank ontology candidates using lexical, semantic and graph evidence',
    description: 'Return advisory candidates, not classification probabilities. Defaults to the most recently imported release per vocabulary. Constraint restricts classes to explicit rdfs:subClassOf paths within depth; mappings never license a refinement.',
    input: z.object({ text: z.string().min(1).optional(), release_ids: z.array(z.string().min(1)).min(1).optional(),
      kind: z.enum(['class','property','concept','resource']).optional(), limit: z.number().int().min(1).max(100).default(10),
      mode: z.enum(['hybrid','keyword','semantic']).default('hybrid'), context: Ref.optional(), constraint: Ref.optional(),
      depth: z.number().int().min(1).max(6).default(2),
      weights: z.object({lexical:z.number().min(0).max(10).optional(),label:z.number().min(0).max(10).optional(),
        semantic:z.number().min(0).max(10).optional(),graph:z.number().min(0).max(10).optional(),accepted_alignment:z.number().min(0).max(10).optional()}).optional(),
    }), output: z.object({ results: z.array(Candidate), warnings: z.array(z.string()), release_ids: z.array(z.string()), fusion: z.string(), weights:z.record(z.number()),constraint: Ref.nullable() }),
    handler: ({ input }) => search.search(input),
  }));
  registry.register(makeEndpoint({ name: 'ontology_resource', summary: 'Read a resource and its original incoming and outgoing RDF statements',
    input: Ref, output: z.object({ resource: z.record(z.unknown()), statements: z.array(z.record(z.unknown())) }),
    handler: ({ input }) => store.resource(input),
  }));
  registry.register(makeEndpoint({ name: 'ontology_traverse', summary: 'Traverse specified source predicates within one release',
    input: Ref.extend({ predicates: z.array(z.string().url()).min(1).default(HIERARCHY_PREDICATES),
      direction: z.enum(['outbound','inbound','both']).default('both'), depth: z.number().int().min(1).max(6).default(2),
    }), output: z.object({ nodes: z.array(z.object({ resource_id: z.string(), depth: z.number(), path: z.array(z.string()), predicates: z.array(z.string()) })) }),
    handler: async ({ input }) => ({ nodes: await traverse(store,input,input.predicates,input.direction,input.depth) }),
  }));
  registry.register(makeEndpoint({ name: 'ontology_assert_alignment', summary: 'Record an explicit proposed or accepted cross-vocabulary mapping',
    input: z.object({ source: Ref, target: Ref, relation: z.enum(['closeMatch','exactMatch','broadMatch','narrowMatch','relatedMatch']),
      status: z.enum(['proposed','accepted','rejected']).default('proposed'), confidence: z.number().min(0).max(1).optional(),
      rationale: z.string().min(1), evidence: z.array(z.string()).default([]), actor: z.string().min(1),
      supersedes: z.string().uuid().optional(),
    }), output: z.object({ id: z.string(), status: z.string() }), handler: ({ input }) => store.assertAlignment(input),
  }));
  registry.register(makeEndpoint({ name: 'ontology_alignments', summary: 'Inspect recorded mapping assertions for a resource',
    input: Ref, output: z.object({ assertions: z.array(z.record(z.unknown())) }), handler: async ({ input }) => {
      await store.resource(input);
      return { assertions: (await store.pool.query(`SELECT * FROM alignment_assertions WHERE
        (source_release=$1 AND source_resource=$2) OR (target_release=$1 AND target_resource=$2) ORDER BY created_at,id`, [input.release_id,input.resource_id])).rows };
    },
  }));
}
