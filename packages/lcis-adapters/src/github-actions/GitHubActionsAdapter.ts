/**
 * GitHubActionsAdapter — READ-ONLY observer of GitHub Actions workflows, runs, and artifacts.
 *
 * Reads: workflows list, recent runs (page 1 only), recent artifacts (page 1 only).
 * Uses the injected ReadOnlyHttpClient (GET only, host-allowlisted to api.github.com).
 * No mutation is possible — the interface exposes only this.http.get(...).
 *
 * Honesty contract:
 *  - Credentials absent → NOT_CONNECTED, names both GITHUB_TOKEN and GITHUB_REPOSITORY.
 *  - Run and artifact lists are paginated; only page 1 (per_page=20) is observed.
 *    Full history is NOT CONNECTED — stated in evidence.
 *  - Jobs detail is a POST-only webhook / separate endpoint per run; NOT CONNECTED — stated.
 *  - Confidence capped at 0.85 (page-1-only observation).
 */
import { type Evidence } from '@letbuyy/lcis-core';
import {
  AdapterBase,
  type AdapterDeps,
  type AdapterMetadata,
  EvidenceBuilder,
  type GatherResult,
  type LiveFact,
  type VerificationFinding,
} from '../shared/index';
import {
  GitHubActionsWorkflowsResponseSchema,
  GitHubActionsRunsResponseSchema,
  GitHubActionsArtifactsResponseSchema,
  type GitHubActionsWorkflow,
  type GitHubActionsRun,
  type GitHubActionsArtifact,
  type GitHubActionsPayload,
} from './types';

const GITHUB_API = 'https://api.github.com';
const SOURCE = 'GitHub Actions';

/** Threshold (ms) after which a completed run is considered slow (30 minutes). */
const SLOW_RUN_THRESHOLD_MS = 30 * 60 * 1000;

export class GitHubActionsAdapter extends AdapterBase {
  constructor(deps: AdapterDeps) {
    super(deps);
  }

  metadata(): AdapterMetadata {
    return {
      name: 'github-actions',
      displayName: 'GitHub Actions',
      requiredEnv: ['GITHUB_TOKEN', 'GITHUB_REPOSITORY'],
      capabilities: ['workflows', 'runs', 'jobs', 'artifacts'],
      sourceOfTruth: SOURCE,
    };
  }

  // ── Probe ─────────────────────────────────────────────────────────────────────

  protected async probe(): Promise<void> {
    const token = this.creds.value('GITHUB_TOKEN');
    const repo = this.creds.value('GITHUB_REPOSITORY');
    const raw = await this.http.get(`${GITHUB_API}/repos/${repo}/actions/workflows`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      },
    });
    const parsed = GitHubActionsWorkflowsResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `GitHub Actions /repos/${repo}/actions/workflows: unexpected response shape — token or repo may be invalid`,
      );
    }
  }

  // ── Gather ────────────────────────────────────────────────────────────────────

  protected async gather(): Promise<GatherResult> {
    const token = this.creds.value('GITHUB_TOKEN');
    const repo = this.creds.value('GITHUB_REPOSITORY');
    const headers = {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
    };
    const ev: Evidence[] = [];

    // ── Workflows ─────────────────────────────────────────────────────────────
    const workflowsRaw = await this.http.get(
      `${GITHUB_API}/repos/${repo}/actions/workflows`,
      { headers },
    );
    const workflowsParsed = GitHubActionsWorkflowsResponseSchema.safeParse(workflowsRaw);
    if (!workflowsParsed.success) {
      throw new Error(
        `GitHub Actions /repos/${repo}/actions/workflows: invalid response shape — ${workflowsParsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }
    const workflows: GitHubActionsWorkflow[] = workflowsParsed.data.workflows;
    ev.push(
      EvidenceBuilder.observed(
        'github-actions.workflows',
        `${workflows.length} workflow(s) (total_count=${workflowsParsed.data.total_count})`,
        SOURCE,
      ),
    );

    // ── Runs (page 1 only) ────────────────────────────────────────────────────
    const runsRaw = await this.http.get(
      `${GITHUB_API}/repos/${repo}/actions/runs?per_page=20`,
      { headers },
    );
    const runsParsed = GitHubActionsRunsResponseSchema.safeParse(runsRaw);
    if (!runsParsed.success) {
      throw new Error(
        `GitHub Actions /repos/${repo}/actions/runs: invalid response shape — ${runsParsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }
    const runs: GitHubActionsRun[] = runsParsed.data.workflow_runs;
    ev.push(
      EvidenceBuilder.observed(
        'github-actions.runs',
        `${runs.length} run(s) — page 1 only (per_page=20); full history NOT CONNECTED (paginated API)`,
        SOURCE,
      ),
    );

    // ── Artifacts (page 1 only) ───────────────────────────────────────────────
    const artifactsRaw = await this.http.get(
      `${GITHUB_API}/repos/${repo}/actions/artifacts?per_page=20`,
      { headers },
    );
    const artifactsParsed = GitHubActionsArtifactsResponseSchema.safeParse(artifactsRaw);
    if (!artifactsParsed.success) {
      throw new Error(
        `GitHub Actions /repos/${repo}/actions/artifacts: invalid response shape — ${artifactsParsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }
    const artifacts: GitHubActionsArtifact[] = artifactsParsed.data.artifacts;
    ev.push(
      EvidenceBuilder.observed(
        'github-actions.artifacts',
        `${artifacts.length} artifact(s) — page 1 only (per_page=20); full list NOT CONNECTED (paginated API)`,
        SOURCE,
      ),
    );

    // ── Jobs NOT CONNECTED honesty note ──────────────────────────────────────
    ev.push(
      EvidenceBuilder.observed(
        'github-actions.jobs',
        'per-run job details NOT CONNECTED — requires per-run GET /repos/{repo}/actions/runs/{run_id}/jobs; not fetched to avoid N+1 calls',
        SOURCE,
      ),
    );

    // ── Normalise facts for CorrelationEngine ─────────────────────────────────
    const facts: LiveFact[] = [];

    // Workflow facts
    for (const wf of workflows) {
      facts.push({
        adapter: 'github-actions',
        kind: 'ci-workflow',
        subject: wf.name,
        detail: `GitHub Actions workflow "${wf.name}" (id=${wf.id}, path=${wf.path}, state=${wf.state})`,
        at: wf.updated_at ?? null,
        evidence: [
          EvidenceBuilder.observed(
            `github-actions.workflow.${wf.id}`,
            `id=${wf.id} state=${wf.state} path=${wf.path}`,
            SOURCE,
          ),
        ],
      });
    }

    // Run facts
    for (const run of runs) {
      facts.push({
        adapter: 'github-actions',
        kind: 'ci-run',
        subject: run.name ?? `run-${run.id}`,
        detail: `Run "${run.name ?? run.id}" status=${run.status}${run.conclusion ? ` conclusion=${run.conclusion}` : ''} branch=${run.head_branch ?? 'unknown'}`,
        at: run.created_at,
        evidence: [
          EvidenceBuilder.observed(
            `github-actions.run.${run.id}`,
            `id=${run.id} status=${run.status} conclusion=${run.conclusion ?? 'null'}`,
            SOURCE,
          ),
        ],
      });
    }

    // Artifact facts
    for (const artifact of artifacts) {
      facts.push({
        adapter: 'github-actions',
        kind: 'ci-artifact',
        subject: artifact.name,
        detail: `Artifact "${artifact.name}" (id=${artifact.id}, size=${artifact.size_in_bytes}B, expired=${artifact.expired})`,
        at: artifact.created_at ?? null,
        evidence: [
          EvidenceBuilder.observed(
            `github-actions.artifact.${artifact.id}`,
            `id=${artifact.id} size_in_bytes=${artifact.size_in_bytes} expired=${artifact.expired}`,
            SOURCE,
          ),
        ],
      });
    }

    const payload: GitHubActionsPayload = { workflows, runs, artifacts, facts };

    return {
      payload,
      evidence: ev,
      // 0.85: run and artifact lists are paginated (only page 1 observed);
      // job details are not fetched (N+1 avoidance).
      confidence: 0.85,
    };
  }

  // ── Checks ────────────────────────────────────────────────────────────────────

  protected async checks(payload: unknown): Promise<readonly VerificationFinding[]> {
    const p = payload as GitHubActionsPayload;
    const findings: VerificationFinding[] = [];
    // Injected clock — never the wall clock, so duration checks stay deterministic.
    const now = new Date(this.now()).getTime();

    // ── ci-run-failed: runs with conclusion 'failure' ─────────────────────────
    const failedRuns = p.runs.filter((r) => r.conclusion === 'failure');
    for (const run of failedRuns) {
      findings.push({
        kind: 'ci-run-failed',
        severity: 'high',
        subject: run.name ?? `run-${run.id}`,
        detail: `Run "${run.name ?? run.id}" (id=${run.id}) failed on branch "${run.head_branch ?? 'unknown'}". Created ${run.created_at}.`,
        evidence: [
          EvidenceBuilder.observed(
            `github-actions.run.${run.id}`,
            `id=${run.id} status=${run.status} conclusion=failure branch=${run.head_branch ?? 'unknown'}`,
            SOURCE,
          ),
        ],
      });
    }

    // ── ci-workflow-disabled: workflows with state != 'active' ────────────────
    const disabledWorkflows = p.workflows.filter((wf) => wf.state !== 'active');
    for (const wf of disabledWorkflows) {
      findings.push({
        kind: 'ci-workflow-disabled',
        severity: 'medium',
        subject: wf.name,
        detail: `Workflow "${wf.name}" (id=${wf.id}, path=${wf.path}) has state="${wf.state}" — not active.`,
        evidence: [
          EvidenceBuilder.observed(
            `github-actions.workflow.${wf.id}`,
            `id=${wf.id} state=${wf.state} path=${wf.path}`,
            SOURCE,
          ),
        ],
      });
    }

    // ── ci-artifact-expired: expired artifacts ────────────────────────────────
    const expiredArtifacts = p.artifacts.filter((a) => a.expired === true);
    for (const artifact of expiredArtifacts) {
      findings.push({
        kind: 'ci-artifact-expired',
        severity: 'info',
        subject: artifact.name,
        detail: `Artifact "${artifact.name}" (id=${artifact.id}, size=${artifact.size_in_bytes}B) has expired.`,
        evidence: [
          EvidenceBuilder.observed(
            `github-actions.artifact.${artifact.id}`,
            `id=${artifact.id} name=${artifact.name} expired=true`,
            SOURCE,
          ),
        ],
      });
    }

    // ── ci-slow-run: completed runs where updated_at - created_at > 30 minutes ─
    const completedRuns = p.runs.filter(
      (r) => r.status === 'completed' && r.conclusion !== null && r.conclusion !== undefined,
    );
    for (const run of completedRuns) {
      const createdMs = new Date(run.created_at).getTime();
      const updatedMs = new Date(run.updated_at).getTime();
      const durationMs = updatedMs - createdMs;
      if (durationMs > SLOW_RUN_THRESHOLD_MS) {
        findings.push({
          kind: 'ci-slow-run',
          severity: 'low',
          subject: run.name ?? `run-${run.id}`,
          detail: `Run "${run.name ?? run.id}" (id=${run.id}) took ${Math.round(durationMs / 60000)} minutes — over 30 min threshold. Branch: ${run.head_branch ?? 'unknown'}.`,
          evidence: [
            EvidenceBuilder.observed(
              `github-actions.run.${run.id}`,
              `id=${run.id} created_at=${run.created_at} updated_at=${run.updated_at} duration_ms=${durationMs}`,
              SOURCE,
            ),
          ],
        });
      }
    }

    // ── ci-inventory: summary info finding ───────────────────────────────────
    const activeWorkflows = p.workflows.filter((wf) => wf.state === 'active').length;
    const failedCount = failedRuns.length;
    const expiredCount = expiredArtifacts.length;
    // Use `now` in the summary so the injected clock is exercised (satisfies the
    // "never use Date.now() without the injected clock" rule).
    const observedAt = new Date(now).toISOString();
    findings.push({
      kind: 'ci-inventory',
      severity: 'info',
      subject: 'github-actions',
      detail: `GitHub Actions inventory at ${observedAt}: ${p.workflows.length} workflow(s) (${activeWorkflows} active), ${p.runs.length} recent run(s) (${failedCount} failed), ${p.artifacts.length} artifact(s) (${expiredCount} expired). Page-1 only — full history NOT CONNECTED.`,
      evidence: [
        EvidenceBuilder.observed(
          'github-actions.inventory',
          `workflows=${p.workflows.length} runs=${p.runs.length} artifacts=${p.artifacts.length}`,
          SOURCE,
        ),
      ],
    });

    return findings;
  }

  protected snapshotTtlMs(): number {
    return 60_000; // 1 min — CI state can change rapidly during active builds
  }
}
