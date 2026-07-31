/**
 * WorkersAdapter types — Zod schemas and normalised payload shapes for the
 * Cloudflare Workers deep adapter. All shapes are validated on receipt;
 * no write surfaces exist.
 *
 * READ-ONLY: no mutation primitives in this file.
 */
import { z } from 'zod';
import type { LiveFact } from '../shared/contracts';

// ---------------------------------------------------------------------------
// Shared Cloudflare envelope (loose — success field only required for probe)
// ---------------------------------------------------------------------------

/** Loose probe envelope: only checks that `success` exists. */
export const WorkersSubdomainProbeSchema = z.object({
  success: z.boolean(),
}).passthrough();
export type WorkersSubdomainProbe = z.infer<typeof WorkersSubdomainProbeSchema>;

// ---------------------------------------------------------------------------
// Scripts list
// ---------------------------------------------------------------------------

export const WorkerScriptItemSchema = z.object({
  id: z.string(),
  created_on: z.string().optional(),
  modified_on: z.string().optional(),
}).passthrough();
export type WorkerScriptItem = z.infer<typeof WorkerScriptItemSchema>;

export const WorkersScriptsResponseSchema = z.object({
  result: z.array(WorkerScriptItemSchema).nullable().optional(),
  success: z.boolean().optional(),
}).passthrough();
export type WorkersScriptsResponse = z.infer<typeof WorkersScriptsResponseSchema>;

// ---------------------------------------------------------------------------
// Per-script settings (bindings, compatibility_date)
// ---------------------------------------------------------------------------

export const WorkerBindingSchema = z.object({
  type: z.string(),
  name: z.string(),
}).passthrough();
export type WorkerBinding = z.infer<typeof WorkerBindingSchema>;

export const WorkerSettingsSchema = z.object({
  bindings: z.array(WorkerBindingSchema).optional(),
  compatibility_date: z.string().optional(),
}).passthrough();
export type WorkerSettings = z.infer<typeof WorkerSettingsSchema>;

/** The settings endpoint wraps result in a CF envelope. Result may be absent. */
export const WorkerSettingsResponseSchema = z.object({
  result: WorkerSettingsSchema.nullable().optional(),
  success: z.boolean().optional(),
}).passthrough();
export type WorkerSettingsResponse = z.infer<typeof WorkerSettingsResponseSchema>;

// ---------------------------------------------------------------------------
// Per-script deployments
// ---------------------------------------------------------------------------

export const WorkerDeploymentItemSchema = z.object({
  id: z.string().optional(),
  created_on: z.string().optional(),
}).passthrough();
export type WorkerDeploymentItem = z.infer<typeof WorkerDeploymentItemSchema>;

/** Loose deployment list: result array; either key may be absent. */
export const WorkerDeploymentsResponseSchema = z.object({
  result: z.array(WorkerDeploymentItemSchema).nullable().optional(),
  success: z.boolean().optional(),
}).passthrough();
export type WorkerDeploymentsResponse = z.infer<typeof WorkerDeploymentsResponseSchema>;

// ---------------------------------------------------------------------------
// Normalised per-script detail (gathered from settings + deployments)
// ---------------------------------------------------------------------------

export interface WorkerScriptDetail {
  readonly name: string;
  readonly createdOn: string | null;
  readonly modifiedOn: string | null;
  readonly bindings: readonly WorkerBinding[];
  readonly compatibilityDate: string | null;
  /** Most recent deployment id, or null if none fetched. */
  readonly latestDeploymentId: string | null;
  /** Most recent deployment created_on, or null. */
  readonly latestDeploymentAt: string | null;
  /** True when per-script settings/deployments fetch failed. */
  readonly fetchError: boolean;
  /** Reason when fetchError=true. */
  readonly fetchErrorDetail: string | null;
}

// ---------------------------------------------------------------------------
// Normalised gathered payload
// ---------------------------------------------------------------------------

export interface WorkersPayload {
  /** All scripts observed from /workers/scripts (inventory). */
  readonly scripts: readonly WorkerScriptDetail[];
  /** Total script count at gather time. */
  readonly scriptCount: number;
  /** True when the account has a Workers subdomain (probe succeeded). */
  readonly subdomainActive: boolean;
  /** Normalised LiveFacts for CorrelationEngine consumption. */
  readonly facts: readonly LiveFact[];
}
