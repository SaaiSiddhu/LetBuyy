/**
 * GitHub Actions API response types — normalised shapes from the GitHub REST API v3.
 * All fields are read-only and schema-validated with Zod before use.
 * Values observed from source of truth; none are fabricated by LCIS.
 *
 * READ-ONLY: no mutation primitives exist in this file.
 */
import { z } from 'zod';
import type { LiveFact } from '../shared/contracts';

// ---------------------------------------------------------------------------
// Workflow schema
// ---------------------------------------------------------------------------

export const GitHubActionsWorkflowSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    path: z.string(),
    state: z.string(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
    html_url: z.string().optional(),
    badge_url: z.string().optional(),
  })
  .passthrough();

export type GitHubActionsWorkflow = z.infer<typeof GitHubActionsWorkflowSchema>;

export const GitHubActionsWorkflowsResponseSchema = z.object({
  total_count: z.number(),
  workflows: z.array(GitHubActionsWorkflowSchema),
});

export type GitHubActionsWorkflowsResponse = z.infer<typeof GitHubActionsWorkflowsResponseSchema>;

// ---------------------------------------------------------------------------
// Run schema
// ---------------------------------------------------------------------------

export const GitHubActionsRunSchema = z
  .object({
    id: z.number(),
    name: z.string().nullable().optional(),
    status: z.string(),
    conclusion: z.string().nullable().optional(),
    head_branch: z.string().nullable().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    html_url: z.string().optional(),
    run_number: z.number().optional(),
    workflow_id: z.number().optional(),
  })
  .passthrough();

export type GitHubActionsRun = z.infer<typeof GitHubActionsRunSchema>;

export const GitHubActionsRunsResponseSchema = z.object({
  total_count: z.number(),
  workflow_runs: z.array(GitHubActionsRunSchema),
});

export type GitHubActionsRunsResponse = z.infer<typeof GitHubActionsRunsResponseSchema>;

// ---------------------------------------------------------------------------
// Artifact schema
// ---------------------------------------------------------------------------

export const GitHubActionsArtifactSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    size_in_bytes: z.number(),
    expired: z.boolean(),
    created_at: z.string().nullable().optional(),
    expires_at: z.string().nullable().optional(),
    archive_download_url: z.string().optional(),
    workflow_run: z
      .object({
        id: z.number().optional(),
        head_branch: z.string().nullable().optional(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

export type GitHubActionsArtifact = z.infer<typeof GitHubActionsArtifactSchema>;

export const GitHubActionsArtifactsResponseSchema = z.object({
  total_count: z.number(),
  artifacts: z.array(GitHubActionsArtifactSchema),
});

export type GitHubActionsArtifactsResponse = z.infer<typeof GitHubActionsArtifactsResponseSchema>;

// ---------------------------------------------------------------------------
// Normalised gathered payload
// ---------------------------------------------------------------------------

export interface GitHubActionsPayload {
  /** All observed workflows (from /repos/{repo}/actions/workflows). */
  readonly workflows: readonly GitHubActionsWorkflow[];
  /** Recent runs — page 1 only (from /repos/{repo}/actions/runs?per_page=20). */
  readonly runs: readonly GitHubActionsRun[];
  /** Recent artifacts — page 1 only (from /repos/{repo}/actions/artifacts?per_page=20). */
  readonly artifacts: readonly GitHubActionsArtifact[];
  /** Normalised LiveFacts for CorrelationEngine consumption. */
  readonly facts: readonly LiveFact[];
}
