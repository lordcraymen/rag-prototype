// Zod-basierte Tool Schema Utilities
import { z } from 'zod';
import type { MCPTool } from '@/types/mcp-interfaces.js';

/**
 * Tool Builder für einfache Tool-Erstellung mit Zod
 */
export class MCPToolBuilder<TInput = any, TOutput = any> {
    private name?: string;
    private description?: string;
    private inputSchema?: z.ZodSchema<TInput>;
    private handler?: (args: TInput) => Promise<TOutput>;

    /**
     * Tool Name setzen
     */
    withName(name: string): MCPToolBuilder<TInput, TOutput> {
        this.name = name;
        return this;
    }

    /**
     * Tool Beschreibung setzen
     */
    withDescription(description: string): MCPToolBuilder<TInput, TOutput> {
        this.description = description;
        return this;
    }

    /**
     * Input Schema mit Zod setzen
     */
    withInputSchema<T>(schema: z.ZodSchema<T>): MCPToolBuilder<T, TOutput> {
        const builder = new MCPToolBuilder<T, TOutput>();
        builder.name = this.name;
        builder.description = this.description;
        builder.inputSchema = schema;
        return builder;
    }

    /**
     * Handler Function setzen
     */
    withHandler<T>(handler: (args: TInput) => Promise<T>): MCPToolBuilder<TInput, T> {
        const builder = new MCPToolBuilder<TInput, T>();
        builder.name = this.name;
        builder.description = this.description;
        builder.inputSchema = this.inputSchema;
        builder.handler = handler;
        return builder;
    }

    /**
     * Tool erstellen
     */
    build(): MCPTool<TInput, TOutput> {
        if (!this.name || !this.description || !this.inputSchema || !this.handler) {
            throw new Error('Tool is incomplete. Missing name, description, inputSchema, or handler');
        }

        return {
            name: this.name,
            description: this.description,
            inputSchema: this.inputSchema,
            handler: this.handler
        };
    }
}

/**
 * Convenience function für Tool-Erstellung
 */
export function createTool(): MCPToolBuilder {
    return new MCPToolBuilder();
}

/**
 * Häufig verwendete Zod Schemas
 */
export const CommonSchemas = {
    /**
     * String Parameter
     */
    string: (description?: string) => z.string().describe(description || 'String parameter'),

    /**
     * Optional String Parameter
     */
    optionalString: (description?: string) => z.string().optional().describe(description || 'Optional string parameter'),

    /**
     * Number Parameter
     */
    number: (description?: string) => z.number().describe(description || 'Number parameter'),

    /**
     * Optional Number Parameter
     */
    optionalNumber: (description?: string) => z.number().optional().describe(description || 'Optional number parameter'),

    /**
     * Boolean Parameter
     */
    boolean: (description?: string) => z.boolean().describe(description || 'Boolean parameter'),

    /**
     * Optional Boolean Parameter
     */
    optionalBoolean: (description?: string) => z.boolean().optional().describe(description || 'Optional boolean parameter'),

    /**
     * File Path Parameter
     */
    filePath: (description?: string) => z.string().describe(description || 'File path'),

    /**
     * URL Parameter
     */
    url: (description?: string) => z.string().url().describe(description || 'URL'),

    /**
     * Document Content Schema
     */
    documentContent: z.object({
        content: z.string().describe('Document content'),
        title: z.string().optional().describe('Document title'),
        metadata: z.record(z.any()).optional().describe('Document metadata')
    }),

    /**
     * Query Parameter Schema
     */
    querySchema: z.object({
        query: z.string().describe('Search query'),
        limit: z.number().min(1).max(100).default(10).describe('Maximum number of results'),
        threshold: z.number().min(0).max(1).default(0.7).describe('Similarity threshold'),
        useHybrid: z.boolean().default(true).describe('Use hybrid search (BM25 + vector)'),
        bm25Weight: z.number().min(0).max(1).default(0.3).describe('BM25 weight in hybrid search'),
        vectorWeight: z.number().min(0).max(1).default(0.7).describe('Vector weight in hybrid search')
    }),

    /**
     * CSV Import Schema
     */
    csvImportSchema: z.object({
        filePath: z.string().describe('Path to CSV file'),
        delimiter: z.string().default(',').describe('CSV delimiter'),
        encoding: z.string().default('utf8').describe('File encoding'),
        validateText: z.boolean().default(true).describe('Validate text fields')
    }),

    /**
     * Document ID Schema
     */
    documentIdSchema: z.object({
        id: z.string().describe('Document ID')
    }),

    /**
     * URL Import Schema
     */
    urlImportSchema: z.object({
        url: z.string().url().describe('URL to import'),
        title: z.string().optional().describe('Document title'),
        metadata: z.record(z.any()).optional().describe('Document metadata')
    }),

    /**
     * Empty Schema für Parameter-lose Tools
     */
    empty: z.object({}).describe('No parameters required')
};

/**
 * Schema zu JSON Schema Converter für MCP
 */
export function zodToJsonSchema(schema: z.ZodSchema): any {
    // Vereinfachte Implementierung - könnte mit zod-to-json-schema erweitert werden
    if (schema instanceof z.ZodObject) {
        const shape = schema.shape;
        const properties: any = {};
        const required: string[] = [];

        for (const [key, value] of Object.entries(shape)) {
            properties[key] = zodSchemaToJsonProperty(value as z.ZodSchema);
            
            if (!(value as any).isOptional()) {
                required.push(key);
            }
        }

        return {
            type: 'object',
            properties,
            required: required.length > 0 ? required : undefined
        };
    }

    return zodSchemaToJsonProperty(schema);
}

function zodSchemaToJsonProperty(schema: z.ZodSchema): any {
    if (schema instanceof z.ZodString) {
        return { type: 'string', description: schema.description };
    }
    if (schema instanceof z.ZodNumber) {
        return { type: 'number', description: schema.description };
    }
    if (schema instanceof z.ZodBoolean) {
        return { type: 'boolean', description: schema.description };
    }
    if (schema instanceof z.ZodOptional) {
        return zodSchemaToJsonProperty(schema.unwrap());
    }
    if (schema instanceof z.ZodDefault) {
        const prop = zodSchemaToJsonProperty(schema.removeDefault());
        prop.default = schema._def.defaultValue();
        return prop;
    }

    return { type: 'object', description: schema.description };
}