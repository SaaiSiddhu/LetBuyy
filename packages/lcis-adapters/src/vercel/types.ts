/**
 * Vercel API response types — normalised shapes from the Vercel REST API.
 * All fields are read-only and schema-validated with Zod before use.
 * Values observed from source of truth; none are fabricated by LCIS.
 *
 * READ-ONLY: no mutation primitives exist in this file.
 */
import { z } from 'zod';
import type { LiveFact } from '../shared/contracts';

// ---------------------------------------------------------------------------
// Project schema
// ---------------------------------------------------------------------------

export const VercelProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  framework: z.string().nullable().optional(),
  rootDirectory: z.string().nullable().optional(),
  buildCommand: z.string().nullable().optional(),
  outputDirectory: z.string().nullable().optional(),
  nodeVersion: z.string().nullable().optional(),
  createdAt: z.union([z.number(), z.string()]).optional(),
  updatedAt: z.union([z.number(), z.string()]).optional(),
  link: z
    .object({
      type: z.string().optional(),
      repo: z.string().optional(),
      repoId: z.number().optional(),
    })
    .optional(),
});
export type VercelProject = z.infer<typeof VercelProjectSchema>;

export const VercelProjectsResponseSchema = z.object({
  projects: z.array(VercelProjectSchema),
  pagination: z
    .object({
      count: z.number().optional(),
      next: z.number().nullable().optional(),
    })
    .optional(),
});
export type VercelProjectsResponse = z.infer<typeof VercelProjectsResponseSchema>;

// ---------------------------------------------------------------------------
// Deployment schema
// ---------------------------------------------------------------------------

/** Vercel deployment states as defined by the Vercel API. */
export const VercelDeploymentStateSchema = z.enum([
  'BUILDING',
  'ERROR',
  'INITIALIZING',
  'QUEUED',
  'READY',
  'CANCELED',
]);
export type VercelDeploymentState = z.infer<typeof VercelDeploymentStateSchema>;

export const VercelDeploymentSchema = z.object({
  uid: z.string(),
  name: z.string(),
  url: z.string().optional(),
  /**
   * Deployment state — absent means the state field was not present in the API response.
   * LCIS cannot determine state in that case (structural gap, not a fabrication).
   */
  state: VercelDeploymentStateSchema.optional(),
  createdAt: z.union([z.number(), z.string()]),
  buildingAt: z.union([z.number(), z.string()]).nullable().optional(),
  ready: z.union([z.number(), z.string()]).nullable().optional(),
  target: z.string().nullable().optional(),
  meta: z.record(z.string(), z.string()).optional(),
  creator: z
    .object({
      uid: z.string().optional(),
      username: z.string().optional(),
    })
    .optional(),
});
export type VercelDeployment = z.infer<typeof VercelDeploymentSchema>;

export const VercelDeploymentsResponseSchema = z.object({
  deployments: z.array(VercelDeploymentSchema),
  pagination: z
    .object({
      count: z.number().optional(),
      next: z.number().nullable().optional(),
    })
    .optional(),
});
export type VercelDeploymentsResponse = z.infer<typeof VercelDeploymentsResponseSchema>;

// ---------------------------------------------------------------------------
// Domain schema
// ---------------------------------------------------------------------------

export const VercelDomainSchema = z.object({
  name: z.string(),
  apexName: z.string().optional(),
  projectId: z.string().optional(),
  redirect: z.string().nullable().optional(),
  verified: z.boolean().optional(),
  createdAt: z.union([z.number(), z.string()]).optional(),
  updatedAt: z.union([z.number(), z.string()]).optional(),
});
export type VercelDomain = z.infer<typeof VercelDomainSchema>;

export const VercelDomainsResponseSchema = z.object({
  domains: z.array(VercelDomainSchema),
  pagination: z
    .object({
      count: z.number().optional(),
      next: z.number().nullable().optional(),
    })
    .optional(),
});
export type VercelDomainsResponse = z.infer<typeof VercelDomainsResponseSchema>;

// ---------------------------------------------------------------------------
// User/probe schema
// ---------------------------------------------------------------------------

export const VercelUserResponseSchema = z.object({
  user: z.object({
    uid: z.string(),
    username: z.string().optional(),
    email: z.string().optional(),
  }),
});
export type VercelUserResponse = z.infer<typeof VercelUserResponseSchema>;

// ---------------------------------------------------------------------------
// Normalised gathered payload
// ---------------------------------------------------------------------------

export interface VercelPayload {
  /** All observed projects (from /v9/projects). */
  readonly projects: readonly VercelProject[];
  /** Recent deployments ordered newest-first by createdAt (from /v6/deployments). */
  readonly deployments: readonly VercelDeployment[];
  /** Domains keyed by projectId → domains on that project (from /v9/projects/{id}/domains). */
  readonly domainsByProject: Record<string, readonly VercelDomain[]>;
  /** Normalised LiveFacts for CorrelationEngine consumption. */
  readonly facts: readonly LiveFact[];
}
