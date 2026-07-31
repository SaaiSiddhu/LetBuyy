/**
 * GitHubAdapter — READ-ONLY observer of the GitHub REST API v3.
 *
 * Capabilities: health, pr, issue, release, deployment, workflows.
 * Facts emitted: commit, pr, release, deployment, failed-workflow.
 * CODEOWNERS parsed as evidence metadata.
 *
 * Host allowlist: api.github.com only.
 * Auth: Bearer token via GITHUB_TOKEN env var (value only ever placed in outbound header).
 * No write operations. No fabrication of live values.
 */
import { type Evidence, evidence } from '@letbuyy/lcis-core';
import { AdapterBase, type AdapterDeps, type GatherResult } from '../shared/base';
import { EvidenceBuilder } from '../shared/evidence';
import type { AdapterMetadata, VerificationFinding, LiveFact } from '../shared/contracts';
import {
  GitHubCommitSchema,
  GitHubDeploymentSchema,
  GitHubPRSchema,
  GitHubReleaseSchema,
  GitHubWorkflowRunsResponseSchema,
  GitHubCODEOWNERSSchema,
  type GitHubCommit,
  type GitHubDeployment,
  type GitHubPR,
  type GitHubRelease,
  type GitHubWorkflowRun,
} from './types';

const SOURCE = 'GitHub';
const BASE = 'https://api.github.com';
const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

interface GitHubPayload {
  readonly repo: string;
  readonly facts: readonly LiveFact[];
  readonly codeownersRaw: string | null;
}

export class GitHubAdapter extends AdapterBase {
  constructor(deps: AdapterDeps) {
    super(deps);
  }

  metadata(): AdapterMetadata {
    return {
      name: 'github',
      displayName: 'GitHub',
      requiredEnv: ['GITHUB_TOKEN', 'GITHUB_REPOSITORY'],
      capabilities: ['health', 'pr', 'issue', 'release', 'deployment', 'workflows'],
      sourceOfTruth: SOURCE,
    };
  }

  private repoPath(): string {
    const raw = this.creds.value('GITHUB_REPOSITORY') ?? '';
    // GITHUB_REPOSITORY is 'owner/repo'
    return raw;
  }

  private ownerRepo(): { owner: string; repo: string } {
    const parts = this.repoPath().split('/');
    return { owner: parts[0] ?? '', repo: parts[1] ?? '' };
  }

  private authHeaders(): Record<string, string> {
    return {
      Authorization: `Bearer ${this.creds.value('GITHUB_TOKEN')}`,
      Accept: 'application/vnd.github+json',
    };
  }

  protected async probe(): Promise<void> {
    const { owner, repo } = this.ownerRepo();
    await this.http.get(`${BASE}/repos/${owner}/${repo}`, { headers: this.authHeaders() });
  }

  protected async gather(): Promise<GatherResult> {
    const { owner, repo } = this.ownerRepo();
    const base = `${BASE}/repos/${owner}/${repo}`;
    const headers = this.authHeaders();
    const facts: LiveFact[] = [];
    const evidences: Evidence[] = [];

    // ── Commits ──────────────────────────────────────────────────────────────
    try {
      const raw = await this.http.get<unknown[]>(`${base}/commits?per_page=10`, { headers });
      const commits: GitHubCommit[] = [];
      if (Array.isArray(raw)) {
        for (const item of raw) {
          const r = GitHubCommitSchema.safeParse(item);
          if (r.success) commits.push(r.data);
        }
      }
      for (const c of commits) {
        const shortMsg = c.commit.message.split('\n')[0]?.slice(0, 120) ?? '';
        facts.push({
          adapter: 'github',
          kind: 'commit',
          subject: `${owner}/${repo}`,
          detail: `${c.sha.slice(0, 7)} ${shortMsg}`,
          at: c.commit.author.date,
          evidence: [EvidenceBuilder.observed(`github.commit.${c.sha.slice(0, 7)}`, shortMsg, SOURCE)],
        });
      }
      evidences.push(EvidenceBuilder.observed('github.commits', `${commits.length} recent commits`, SOURCE));
    } catch {
      // partial results — continue
    }

    // ── Open Pull Requests ────────────────────────────────────────────────────
    try {
      const raw = await this.http.get<unknown[]>(`${base}/pulls?state=open&per_page=10`, { headers });
      const prs: GitHubPR[] = [];
      if (Array.isArray(raw)) {
        for (const item of raw) {
          const r = GitHubPRSchema.safeParse(item);
          if (r.success) prs.push(r.data);
        }
      }
      for (const pr of prs) {
        facts.push({
          adapter: 'github',
          kind: 'pr',
          subject: `${owner}/${repo}#${pr.number}`,
          detail: `PR #${pr.number} "${pr.title}" (${pr.state}) by ${pr.user.login} — ${pr.head.ref} → ${pr.base.ref}`,
          at: pr.updated_at,
          evidence: [EvidenceBuilder.observed(`github.pr.${pr.number}`, pr.title, SOURCE)],
        });
      }
      evidences.push(EvidenceBuilder.observed('github.prs', `${prs.length} open PRs`, SOURCE));
    } catch {
      // partial results — continue
    }

    // ── Releases ─────────────────────────────────────────────────────────────
    try {
      const raw = await this.http.get<unknown[]>(`${base}/releases?per_page=5`, { headers });
      const releases: GitHubRelease[] = [];
      if (Array.isArray(raw)) {
        for (const item of raw) {
          const r = GitHubReleaseSchema.safeParse(item);
          if (r.success) releases.push(r.data);
        }
      }
      for (const rel of releases) {
        facts.push({
          adapter: 'github',
          kind: 'release',
          subject: rel.tag_name,
          detail: `Release ${rel.tag_name}${rel.name ? ` "${rel.name}"` : ''}${rel.prerelease ? ' (prerelease)' : ''}${rel.draft ? ' (draft)' : ''}`,
          at: rel.published_at,
          evidence: [EvidenceBuilder.observed(`github.release.${rel.tag_name}`, rel.name ?? rel.tag_name, SOURCE)],
        });
      }
      evidences.push(EvidenceBuilder.observed('github.releases', `${releases.length} recent releases`, SOURCE));
    } catch {
      // partial results — continue
    }

    // ── Deployments ──────────────────────────────────────────────────────────
    try {
      const raw = await this.http.get<unknown[]>(`${base}/deployments?per_page=10`, { headers });
      const deployments: GitHubDeployment[] = [];
      if (Array.isArray(raw)) {
        for (const item of raw) {
          const r = GitHubDeploymentSchema.safeParse(item);
          if (r.success) deployments.push(r.data);
        }
      }
      for (const dep of deployments) {
        facts.push({
          adapter: 'github',
          kind: 'deployment',
          subject: dep.environment,
          detail: `Deployment to ${dep.environment} at ref=${dep.ref} sha=${dep.sha.slice(0, 7)} task=${dep.task}`,
          at: dep.created_at,
          evidence: [EvidenceBuilder.observed(`github.deployment.${dep.id}`, dep.environment, SOURCE)],
        });
      }
      evidences.push(EvidenceBuilder.observed('github.deployments', `${deployments.length} deployments`, SOURCE));
    } catch {
      // partial results — continue
    }

    // ── Workflow Runs (failed only) ────────────────────────────────────────────
    try {
      const raw = await this.http.get<unknown>(`${base}/actions/runs?per_page=20`, { headers });
      const parsed = GitHubWorkflowRunsResponseSchema.safeParse(raw);
      const runs: GitHubWorkflowRun[] = parsed.success ? parsed.data.workflow_runs : [];
      const failed = runs.filter((r) => r.conclusion === 'failure');
      for (const run of failed) {
        facts.push({
          adapter: 'github',
          kind: 'failed-workflow',
          subject: run.name ?? `workflow-${run.id}`,
          detail: `Workflow "${run.name ?? run.id}" failed on branch ${run.head_branch ?? 'unknown'} (sha ${run.head_sha.slice(0, 7)})`,
          at: run.updated_at,
          evidence: [
            EvidenceBuilder.observed(`github.workflow.${run.id}`, run.name ?? String(run.id), SOURCE),
            EvidenceBuilder.observed(`github.workflow.${run.id}.url`, run.html_url, SOURCE),
          ],
        });
      }
      evidences.push(EvidenceBuilder.observed('github.workflow-runs', `${runs.length} runs, ${failed.length} failed`, SOURCE));
    } catch {
      // partial results — continue
    }

    // ── CODEOWNERS ────────────────────────────────────────────────────────────
    let codeownersRaw: string | null = null;
    const codeownersPaths = [`${base}/contents/CODEOWNERS`, `${base}/contents/.github/CODEOWNERS`];
    for (const coPath of codeownersPaths) {
      try {
        const raw = await this.http.get<unknown>(coPath, { headers });
        const parsed = GitHubCODEOWNERSSchema.safeParse(raw);
        if (parsed.success && parsed.data.encoding === 'base64') {
          codeownersRaw = Buffer.from(parsed.data.content.replace(/\n/g, ''), 'base64').toString('utf8');
          const owners = extractOwners(codeownersRaw);
          evidences.push(EvidenceBuilder.observed('github.codeowners', `${owners.length} owner(s): ${owners.slice(0, 5).join(', ')}`, SOURCE));
          break;
        }
      } catch {
        // try next path
      }
    }

    // Sort facts by timestamp descending (most recent first)
    const sorted = [...facts].sort((a, b) => {
      if (!a.at && !b.at) return 0;
      if (!a.at) return 1;
      if (!b.at) return -1;
      return b.at.localeCompare(a.at);
    });

    const payload: GitHubPayload = {
      repo: this.repoPath(),
      facts: sorted,
      codeownersRaw,
    };

    return {
      payload,
      evidence: evidences,
      confidence: 0.9,
    };
  }

  protected async checks(payload: unknown): Promise<readonly VerificationFinding[]> {
    const p = payload as GitHubPayload;
    const findings: VerificationFinding[] = [];
    const facts = p.facts ?? [];
    // Injected clock (deps.now) — never the wall clock, so staleness checks stay deterministic.
    const now = new Date(this.now()).getTime();

    // ── Failed workflow findings ──────────────────────────────────────────────
    const failedWorkflows = facts.filter((f) => f.kind === 'failed-workflow');
    for (const f of failedWorkflows) {
      // Find the html_url evidence
      const urlEvidence = f.evidence.find((e) => e.kind === 'artifact-field' && e.detail?.startsWith('http'));
      findings.push({
        kind: 'failed-workflow',
        severity: 'high',
        subject: f.subject,
        detail: f.detail,
        evidence: [
          ...f.evidence,
          ...(urlEvidence ? [] : []),
          EvidenceBuilder.observed(`github.failed-workflow.${f.subject}`, f.detail, SOURCE),
        ],
      });
    }

    // ── Deployment timeline ───────────────────────────────────────────────────
    const deployments = facts.filter((f) => f.kind === 'deployment');
    if (deployments.length > 0) {
      findings.push({
        kind: 'deployment-timeline',
        severity: 'info',
        subject: p.repo,
        detail: `${deployments.length} recent deployment(s): ${deployments
          .slice(0, 5)
          .map((d) => `[${d.subject} at ${d.at ?? 'unknown'}]`)
          .join(', ')}`,
        evidence: deployments.slice(0, 5).map((d) =>
          EvidenceBuilder.observed(`github.deployment.${d.subject}`, d.detail, SOURCE)
        ),
      });
    }

    // ── Stale deployments (> 7 days) ──────────────────────────────────────────
    for (const dep of deployments) {
      if (dep.at) {
        const age = now - new Date(dep.at).getTime();
        if (age > SEVEN_DAYS_MS) {
          findings.push({
            kind: 'stale-deployment',
            severity: 'low',
            subject: dep.subject,
            detail: `Deployment to "${dep.subject}" is more than 7 days old (last at ${dep.at}): ${dep.detail}`,
            evidence: [EvidenceBuilder.observed(`github.stale-deployment.${dep.subject}`, dep.at, SOURCE)],
          });
        }
      }
    }

    return findings;
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractOwners(content: string): string[] {
  const owners = new Set<string>();
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const parts = trimmed.split(/\s+/);
    // parts[0] is the pattern, rest are owners
    for (let i = 1; i < parts.length; i++) {
      const owner = parts[i];
      if (owner && (owner.startsWith('@') || owner.includes('@'))) {
        owners.add(owner);
      }
    }
  }
  return Array.from(owners);
}
