/**
 * Zod schemas for the Supabase/PostgREST and Management API responses.
 * All schemas are STRICT — unknown fields are stripped, not rejected, so the
 * adapter is tolerant to new API fields without becoming fabrication-prone.
 */
import { z } from 'zod';

// ---------------------------------------------------------------------------
// PostgREST OpenAPI root (GET /rest/v1/)
// ---------------------------------------------------------------------------

export const PostgRestColumnSchema = z.object({
  type: z.string().optional(),
  description: z.string().nullable().optional(),
  format: z.string().optional(),
}).passthrough();

export const PostgRestDefinitionSchema = z.object({
  type: z.string().optional(),
  properties: z.record(z.string(), PostgRestColumnSchema).optional(),
  required: z.array(z.string()).optional(),
}).passthrough();

export const PostgRestInfoSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  version: z.string().optional(),
}).passthrough();

export const PostgRestPathSchema = z.object({
  get: z.unknown().optional(),
  post: z.unknown().optional(),
}).passthrough();

export const PostgRestOpenApiSchema = z.object({
  openapi: z.string().optional(),
  swagger: z.string().optional(),
  info: PostgRestInfoSchema.optional(),
  paths: z.record(z.string(), PostgRestPathSchema).optional(),
  definitions: z.record(z.string(), PostgRestDefinitionSchema).optional(),
}).passthrough();

export type PostgRestOpenApi = z.infer<typeof PostgRestOpenApiSchema>;
export type PostgRestDefinition = z.infer<typeof PostgRestDefinitionSchema>;

// ---------------------------------------------------------------------------
// Management API — migrations
// ---------------------------------------------------------------------------

export const MigrationSchema = z.object({
  version: z.string(),
  name: z.string().optional(),
  status: z.enum(['SUCCESS', 'FAILED', 'FAILED_CLEANUP', 'REVERTED', 'PENDING']).optional(),
  inserted_at: z.string().nullable().optional(),
}).passthrough();

export const MigrationsListSchema = z.array(MigrationSchema);
export type Migration = z.infer<typeof MigrationSchema>;
export type MigrationsList = z.infer<typeof MigrationsListSchema>;

// ---------------------------------------------------------------------------
// Management API — RLS policies
// ---------------------------------------------------------------------------

export const PolicySchema = z.object({
  id: z.number().optional(),
  name: z.string(),
  schema: z.string().optional(),
  table: z.string(),
  table_id: z.number().optional(),
  action: z.string().optional(),
  roles: z.array(z.string()).optional(),
  command: z.string().optional(),
  definition: z.string().nullable().optional(),
  check: z.string().nullable().optional(),
}).passthrough();

export const PoliciesListSchema = z.array(PolicySchema);
export type Policy = z.infer<typeof PolicySchema>;
export type PoliciesList = z.infer<typeof PoliciesListSchema>;

// ---------------------------------------------------------------------------
// Management API — database functions
// ---------------------------------------------------------------------------

export const DbFunctionSchema = z.object({
  id: z.number().optional(),
  schema: z.string().optional(),
  name: z.string(),
  language: z.string().optional(),
  return_type: z.string().optional(),
  security_definer: z.boolean().optional(),
  config_params: z.record(z.string(), z.string()).nullable().optional(),
}).passthrough();

export const DbFunctionsListSchema = z.array(DbFunctionSchema);
export type DbFunction = z.infer<typeof DbFunctionSchema>;
export type DbFunctionsList = z.infer<typeof DbFunctionsListSchema>;

// ---------------------------------------------------------------------------
// Management API — extensions
// ---------------------------------------------------------------------------

export const ExtensionSchema = z.object({
  name: z.string(),
  schema: z.string().nullable().optional(),
  default_version: z.string().optional(),
  installed_version: z.string().nullable().optional(),
  comment: z.string().nullable().optional(),
}).passthrough();

export const ExtensionsListSchema = z.array(ExtensionSchema);
export type Extension = z.infer<typeof ExtensionSchema>;
export type ExtensionsList = z.infer<typeof ExtensionsListSchema>;
