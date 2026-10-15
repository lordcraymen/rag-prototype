import { InMemoryEndpointRegistry, makeEndpoint } from '@lordcraymen/rivetbench';
import { z } from 'zod';
import { RAGTools } from '../mcp/rag-tools.js';
import type { IDatabaseConnector } from '../types/database.js';

const MutationOutput = z.object({ success: z.boolean(), id: z.string(), message: z.string() });
const ResultDocument = z.object({
  id: z.string(), title: z.string().nullable().optional(), content: z.string(),
  score: z.number(), metadata: z.record(z.unknown()).optional(),
});
const outputs = {
  add_document: MutationOutput,
  remove_document: MutationOutput,
  query_documents: z.object({
    success: z.boolean(), query: z.string(), resultsCount: z.number().int(),
    results: z.array(ResultDocument),
  }),
  import_from_csv: z.object({
    success: z.boolean(), imported: z.number().int(), failed: z.number().int(),
    errors: z.array(z.string()).optional(), message: z.string(),
  }),
  get_rag_status: z.object({
    connected: z.boolean(), documentCount: z.number().int(),
    database: z.string().optional(), host: z.string().optional(), error: z.string().optional(),
    architecture: z.string(), runtime: z.string(), embedding: z.unknown(),
  }).passthrough(),
};

/**
 * Create the shared REST/MCP registry using the existing RAG operation handlers.
 * URL ingestion and listing are omitted until their placeholder handlers are implemented.
 * @example const registry = createRagRegistry(connector);
 */
export function createRagRegistry(connector: IDatabaseConnector): InMemoryEndpointRegistry {
  const registry = new InMemoryEndpointRegistry();
  const tools = new RAGTools(connector);
  function register<Input extends z.ZodTypeAny, Output extends z.ZodTypeAny>(
    tool: { name: string; description: string; inputSchema: Input; handler: (input: z.infer<Input>) => Promise<unknown> },
    output: Output,
  ) {
    registry.register(makeEndpoint({
      name: tool.name, summary: tool.description,
      input: tool.inputSchema, output,
      handler: async ({ input }) => output.parse(await tool.handler(input)),
    }));
  }
  register(tools.createAddDocumentTool(), outputs.add_document);
  register(tools.createQueryDocumentsTool(), outputs.query_documents);
  register(tools.createImportFromCSVTool(), outputs.import_from_csv);
  register(tools.createGetRagStatusTool(), outputs.get_rag_status);
  register(tools.createRemoveDocumentTool(), outputs.remove_document);
  return registry;
}
