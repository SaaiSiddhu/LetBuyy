/**
 * Zod schemas + TypeScript types for GitHub REST API v3 responses.
 * All schemas use .passthrough() so unknown fields don't fail; only the declared
 * fields are guaranteed. Use .safeParse() to avoid crashes on malformed payloads.
 */
import { z } from 'zod';

// ─── Repo ────────────────────────────────────────────────────────────────────

export const GitHubRepoSchema = z
  .object({
    id: z.number(),
    name: z.string(),
    full_name: z.string(),
    private: z.boolean(),
    pushed_at: z.string().nullable(),
    default_branch: z.string(),
  })
  .passthrough();

export type GitHubRepo = z.infer<typeof GitHubRepoSchema>;

// ─── Commit ──────────────────────────────────────────────────────────────────

export const GitHubCommitSchema = z
  .object({
    sha: z.string(),
    commit: z.object({
      message: z.string(),
      author: z.object({
        date: z.string(),
      }),
    }),
    author: z
      .object({
        login: z.string(),
      })
      .nullable()
      .optional(),
  })
  .passthrough();

export type GitHubCommit = z.infer<typeof GitHubCommitSchema>;

// ─── Pull Request ─────────────────────────────────────────────────────────────

export const GitHubPRSchema = z
  .object({
    number: z.number(),
    title: z.string(),
    state: z.string(),
    user: z.object({
      login: z.string(),
    }),
    created_at: z.string(),
    updated_at: z.string(),
    head: z.object({
      ref: z.string(),
    }),
    base: z.object({
      ref: z.string(),
    }),
    merged_at: z.string().nullable().optional(),
  })
  .passthrough();

export type GitHubPR = z.infer<typeof GitHubPRSchema>;

// ─── Release ─────────────────────────────────────────────────────────────────

export const GitHubReleaseSchema = z
  .object({
    id: z.number(),
    tag_name: z.string(),
    name: z.string().nullable(),
    published_at: z.string().nullable(),
    prerelease: z.boolean(),
    draft: z.boolean(),
  })
  .passthrough();

export type GitHubRelease = z.infer<typeof GitHubReleaseSchema>;

// ─── Deployment ───────────────────────────────────────────────────────────────

export const GitHubDeploymentSchema = z
  .object({
    id: z.number(),
    environment: z.string(),
    ref: z.string(),
    sha: z.string(),
    created_at: z.string(),
    updated_at: z.string(),
    task: z.string(),
  })
  .passthrough();

export type GitHubDeployment = z.infer<typeof GitHubDeploymentSchema>;

// ─── Workflow Run ─────────────────────────────────────────────────────────────

export const GitHubWorkflowRunSchema = z
  .object({
    id: z.number(),
    name: z.string().nullable(),
    status: z.string(),
    conclusion: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    head_branch: z.string().nullable(),
    head_sha: z.string(),
    html_url: z.string(),
  })
  .passthrough();

export type GitHubWorkflowRun = z.infer<typeof GitHubWorkflowRunSchema>;

export const GitHubWorkflowRunsResponseSchema = z
  .object({
    total_count: z.number(),
    workflow_runs: z.array(GitHubWorkflowRunSchema),
  })
  .passthrough();

export type GitHubWorkflowRunsResponse = z.infer<typeof GitHubWorkflowRunsResponseSchema>;

// ─── CODEOWNERS (base64-encoded file content from Contents API) ───────────────

export const GitHubCODEOWNERSSchema = z
  .object({
    content: z.string(),
    encoding: z.string(),
  })
  .passthrough();

export type GitHubCODEOWNERS = z.infer<typeof GitHubCODEOWNERSSchema>;
