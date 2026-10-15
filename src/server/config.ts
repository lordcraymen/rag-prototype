import { z } from 'zod';

const Config = z.object({
  transport: z.enum(['stdio', 'http']),
  host: z.string().min(1), port: z.coerce.number().int().min(1).max(65535),
  model: z.string().min(1),
  application: z.object({ name: z.string().min(1), version: z.string().min(1) }),
  database: z.object({
    host: z.string().min(1), port: z.coerce.number().int().min(1).max(65535),
    database: z.string().min(1), user: z.string().min(1), password: z.string(), ssl: z.boolean(),
  }),
});

/** Read configuration once, preserving the prototype's transport and port flags.
 * @example const config = readServerConfig(process.argv.slice(2));
 */
export function readServerConfig(args: string[], env = process.env) {
  let transport = 'stdio';
  let port = env.SERVER_PORT ?? '3000';
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--verbose') continue;
    if (argument === '--transport') {
      const value = args[++index];
      transport = value === 'httpStream' ? 'http' : value;
    } else if (argument === '--port') {
      port = args[++index];
    } else {
      throw new Error(`Unknown argument: ${argument}`);
    }
  }
  return Config.parse({
    transport, port, host: env.SERVER_HOST ?? '127.0.0.1',
    model: env.EMBEDDING_MODEL ?? 'Xenova/all-MiniLM-L6-v2',
    application: { name: env.SERVER_NAME ?? 'rag-knowledge-base', version: env.SERVER_VERSION ?? '1.0.1' },
    database: {
      host: env.DB_HOST ?? 'localhost', port: env.DB_PORT ?? '5432',
      database: env.DB_NAME ?? 'rag', user: env.DB_USER ?? 'raguser',
      password: env.DB_PASSWORD ?? 'ragpassword', ssl: env.DB_SSL === 'true',
    },
  });
}
