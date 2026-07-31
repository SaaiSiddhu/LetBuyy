/**
 * VercelAdapter — READ-ONLY observer of Vercel deployments, projects, and domains.
 *
 * Reads: projects list, recent deployments, per-project domains.
 * Uses the injected ReadOnlyHttpClient (GET only, host-allowlisted to api.vercel.com).
 * No mutation is possible — the interface exposes only this.http.get(...).
 *
 * Honesty contract:
 *  - Credentials absent → NOT_CONNECTED, names VERCEL_TOKEN (and VERCEL_TEAM_ID if missing).
 *  - VERCEL_TEAM_ID is optional — used as a teamId query param when present.
 *  - Live metric values (e.g. request counts, bandwidth, error rates) NOT CONNECTED;
 *    they require the Vercel Analytics / Observability API with separate credentials.
 *  - Confidence capped at 0.85 (deployment list is paginated; only first page observed).
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
  type VercelDeployment,
  VercelDeploymentsResponseSchema,
  VercelDomainsResponseSchema,
  VercelProjectsResponseSchema,
  VercelUserResponseSchema,
  type VercelPayload,
  type VercelProject,
  type VercelDomain,
} from './types';

const VERCEL_API = 'https://api.vercel.com';
const SOURCE = 'Vercel';

/** Threshold (ms) after which a deployment is considered stale (7 days). */
const STALE_DEPLOYMENT_THRESHOLD_MS = 7 * 24 * 60 * 60 * 1000;

/** Convert a Vercel timestamp (epoch ms number or ISO string) to ms since epoch. */
function toMs(ts: number | string): number {
  if (typeof ts === 'number') return ts;
  return new Date(ts).getTime();
}

export class VercelAdapter extends AdapterBase {
  constructor(deps: AdapterDeps) {
    super(deps);
  }

  metadata(): AdapterMetadata {
    return {
      name: 'vercel',
      displayName: 'Vercel',
      /** VERCEL_TEAM_ID is optional — presence checked separately, not blocking. */
      requiredEnv: ['VERCEL_TOKEN'],
      capabilities: ['status', 'deployments', 'domains', 'projects', 'functions'],
      sourceOfTruth: SOURCE,
    };
  }

  // ── Probe ─────────────────────────────────────────────────────────────────────

  protected async probe(): Promise<void> {
    const token = this.creds.value('VERCEL_TOKEN');
    const raw = await this.http.get(`${VERCEL_API}/v2/user`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const parsed = VercelUserResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error('Vercel user endpoint: unexpected response shape — token may be invalid');
    }
  }

  // ── Gather ────────────────────────────────────────────────────────────────────

  protected async gather(): Promise<GatherResult> {
    const token = this.creds.value('VERCEL_TOKEN');
    const teamId = this.creds.value('VERCEL_TEAM_ID');
    const headers = { Authorization: `Bearer ${token}` };
    const ev: Evidence[] = [];

    // Build optional team query param
    const teamParam = teamId ? `?teamId=${encodeURIComponent(teamId)}` : '';

    // ── Projects ─────────────────────────────────────────────────────────────
    const projectsRaw = await this.http.get(
      `${VERCEL_API}/v9/projects${teamParam}`,
      { headers },
    );
    const projectsParsed = VercelProjectsResponseSchema.safeParse(projectsRaw);
    if (!projectsParsed.success) {
      throw new Error(`Vercel /v9/projects: invalid response shape — ${projectsParsed.error.issues[0]?.message ?? 'parse error'}`);
    }
    const projects: VercelProject[] = projectsParsed.data.projects;
    ev.push(EvidenceBuilder.observed('vercel.projects', `${projects.length} project(s)`, SOURCE));

    // ── Deployments ───────────────────────────────────────────────────────────
    const deploymentsRaw = await this.http.get(
      `${VERCEL_API}/v6/deployments${teamParam}`,
      { headers },
    );
    const deploymentsParsed = VercelDeploymentsResponseSchema.safeParse(deploymentsRaw);
    if (!deploymentsParsed.success) {
      throw new Error(`Vercel /v6/deployments: invalid response shape — ${deploymentsParsed.error.issues[0]?.message ?? 'parse error'}`);
    }
    // Order newest-first by createdAt
    const deployments: VercelDeployment[] = [...deploymentsParsed.data.deployments].sort(
      (a, b) => toMs(b.createdAt) - toMs(a.createdAt),
    );
    ev.push(
      EvidenceBuilder.observed(
        'vercel.deployments',
        `${deployments.length} deployment(s) — page 1 only; full history NOT CONNECTED (paginated API)`,
        SOURCE,
      ),
    );

    // ── Domains (per project) ─────────────────────────────────────────────────
    const domainsByProject: Record<string, readonly VercelDomain[]> = {};
    for (const project of projects) {
      try {
        const domainsRaw = await this.http.get(
          `${VERCEL_API}/v9/projects/${encodeURIComponent(project.id)}/domains${teamParam}`,
          { headers },
        );
        const domainsParsed = VercelDomainsResponseSchema.safeParse(domainsRaw);
        if (domainsParsed.success) {
          domainsByProject[project.id] = domainsParsed.data.domains;
        } else {
          domainsByProject[project.id] = [];
          ev.push(
            EvidenceBuilder.observed(
              `vercel.domains.${project.name}`,
              `domains parse error for project "${project.name}" — skipped`,
              SOURCE,
            ),
          );
        }
      } catch {
        // Domain fetch failure for one project must not block the whole gather.
        domainsByProject[project.id] = [];
        ev.push(
          EvidenceBuilder.observed(
            `vercel.domains.${project.name}`,
            `domains fetch error for project "${project.name}" — NOT CONNECTED`,
            SOURCE,
          ),
        );
      }
    }

    const allDomains = Object.values(domainsByProject).flat();
    ev.push(EvidenceBuilder.observed('vercel.domains', `${allDomains.length} domain(s) across ${projects.length} project(s)`, SOURCE));

    // ── Normalise facts for CorrelationEngine ─────────────────────────────────
    const facts: LiveFact[] = [];

    // Project facts
    for (const project of projects) {
      facts.push({
        adapter: 'vercel',
        kind: 'project',
        subject: project.name,
        detail: `Vercel project "${project.name}" (id=${project.id}${project.framework ? `, framework=${project.framework}` : ''})`,
        at: project.createdAt != null ? new Date(toMs(project.createdAt)).toISOString() : null,
        evidence: [EvidenceBuilder.observed(`vercel.project.${project.name}`, `id=${project.id}`, SOURCE)],
      });
    }

    // Deployment facts
    for (const dep of deployments) {
      facts.push({
        adapter: 'vercel',
        kind: 'deployment',
        subject: dep.name,
        detail: `Deployment of "${dep.name}" state=${dep.state ?? 'unknown'}${dep.url ? ` url=${dep.url}` : ''}`,
        at: new Date(toMs(dep.createdAt)).toISOString(),
        evidence: [
          EvidenceBuilder.observed(
            `vercel.deployment.${dep.uid}`,
            `project=${dep.name} state=${dep.state ?? 'unknown'}`,
            SOURCE,
          ),
        ],
      });
    }

    // Domain facts
    for (const [projectId, domains] of Object.entries(domainsByProject)) {
      const project = projects.find((p) => p.id === projectId);
      for (const domain of domains) {
        facts.push({
          adapter: 'vercel',
          kind: 'domain',
          subject: domain.name,
          detail: `Domain "${domain.name}" on project "${project?.name ?? projectId}"${domain.verified === false ? ' — NOT VERIFIED' : ''}`,
          at: domain.createdAt != null ? new Date(toMs(domain.createdAt)).toISOString() : null,
          evidence: [
            EvidenceBuilder.observed(
              `vercel.domain.${domain.name}`,
              `project=${project?.name ?? projectId} verified=${domain.verified ?? 'unknown'}`,
              SOURCE,
            ),
          ],
        });
      }
    }

    const payload: VercelPayload = { projects, deployments, domainsByProject, facts };

    return {
      payload,
      evidence: ev,
      // 0.85: deployment list is paginated (only first page observed); domain data
      // may be incomplete if a project's domain fetch fails.
      confidence: 0.85,
    };
  }

  // ── Checks ────────────────────────────────────────────────────────────────────

  protected async checks(payload: unknown): Promise<readonly VerificationFinding[]> {
    const p = payload as VercelPayload;
    const findings: VerificationFinding[] = [];
    // Injected clock (deps.now) — never the wall clock, so staleness checks stay deterministic.
    const now = new Date(this.now()).getTime();

    // ── failed-deployment: any deployment with state ERROR or CANCELED ─────────
    const failedDeployments = p.deployments.filter(
      (d) => d.state === 'ERROR' || d.state === 'CANCELED',
    );
    for (const dep of failedDeployments) {
      findings.push({
        kind: 'failed-deployment',
        severity: dep.state === 'ERROR' ? 'high' : 'medium',
        subject: dep.name,
        detail: `Deployment of project "${dep.name}" (uid=${dep.uid}) is in state ${dep.state}. Deployed at ${new Date(toMs(dep.createdAt)).toISOString()}.`,
        evidence: [
          EvidenceBuilder.observed(
            `vercel.deployment.${dep.uid}`,
            `state=${dep.state} project=${dep.name}`,
            SOURCE,
          ),
        ],
      });
    }

    // ── stale-deployment: deployments older than threshold with no newer READY ─
    // For each project, if the most recent deployment is older than the threshold, flag it.
    const projectNames = new Set(p.deployments.map((d) => d.name));
    for (const projectName of projectNames) {
      const projectDeps = p.deployments
        .filter((d) => d.name === projectName)
        .sort((a, b) => toMs(b.createdAt) - toMs(a.createdAt));
      const latest = projectDeps[0];
      if (latest && now - toMs(latest.createdAt) > STALE_DEPLOYMENT_THRESHOLD_MS) {
        findings.push({
          kind: 'stale-deployment',
          severity: 'low',
          subject: projectName,
          detail: `Project "${projectName}" last deployed ${new Date(toMs(latest.createdAt)).toISOString()} — over 7 days ago. Consider whether this is intentional.`,
          evidence: [
            EvidenceBuilder.observed(
              `vercel.deployment.${latest.uid}`,
              `latest deployment for ${projectName} at ${new Date(toMs(latest.createdAt)).toISOString()}`,
              SOURCE,
            ),
          ],
        });
      }
    }

    // ── build-drift: projects with inconsistent build configurations ───────────
    // Projects that have no framework set may use different defaults.
    const projectsWithoutFramework = p.projects.filter(
      (proj) => proj.framework == null || proj.framework === '',
    );
    if (projectsWithoutFramework.length > 0 && p.projects.length > 1) {
      findings.push({
        kind: 'build-drift',
        severity: 'low',
        subject: 'vercel-projects',
        detail: `${projectsWithoutFramework.length} project(s) have no framework set: ${projectsWithoutFramework.map((p) => p.name).join(', ')}. Build configuration may differ from other projects.`,
        evidence: projectsWithoutFramework.map((proj) =>
          EvidenceBuilder.observed(
            `vercel.project.${proj.name}`,
            `framework=null buildCommand=${proj.buildCommand ?? 'default'} outputDir=${proj.outputDirectory ?? 'default'}`,
            SOURCE,
          ),
        ),
      });
    }

    // ── domain-drift: domains that are not verified ────────────────────────────
    const allDomains = Object.values(p.domainsByProject).flat();
    const unverifiedDomains = allDomains.filter((d) => d.verified === false);
    for (const domain of unverifiedDomains) {
      const projectId = domain.projectId;
      const project = p.projects.find((pr) => pr.id === projectId);
      findings.push({
        kind: 'domain-drift',
        severity: 'medium',
        subject: domain.name,
        detail: `Domain "${domain.name}" on project "${project?.name ?? projectId ?? 'unknown'}" is NOT VERIFIED. DNS configuration may be missing or propagating.`,
        evidence: [
          EvidenceBuilder.observed(
            `vercel.domain.${domain.name}`,
            `verified=false project=${project?.name ?? projectId ?? 'unknown'}`,
            SOURCE,
          ),
        ],
      });
    }

    // ── inventory summary (info) ───────────────────────────────────────────────
    if (p.projects.length > 0) {
      findings.push({
        kind: 'project-inventory',
        severity: 'info',
        subject: 'vercel-projects',
        detail: `${p.projects.length} Vercel project(s) observed: ${p.projects.map((pr) => pr.name).join(', ')}.`,
        evidence: [
          EvidenceBuilder.observed('vercel.projects', `${p.projects.length} project(s)`, SOURCE),
        ],
      });
    }

    return findings;
  }

  protected snapshotTtlMs(): number {
    return 120_000; // 2 min — deployment topology changes infrequently
  }
}
