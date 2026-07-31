/**
 * OwnershipService — maps every entity (domain / service / worker / queue / rpc / table /
 * runbook) to its declared owner, surfaces gaps with severity + evidence, and generates
 * an honest OwnershipReport with coverage statistics.
 *
 * ABSOLUTE READ-ONLY: no fetch, no spawn, no eval, no writeFile, no network, no DB writes.
 * Pure deterministic reasoning over GovernanceArtifactStore + LcisEngine artifacts.
 */
import { type Evidence, evidence } from '@letbuyy/lcis-core';
import {
  GovernanceArtifactStore,
  SeverityScorer,
  GovernanceEvidenceBuilder,
  governance,
  defaultNow,
  type OwnershipReport,
  type OwnershipGap,
  type OwnershipCoverage,
  type OwnedEntityType,
} from '../shared/index';
import type { LcisEngine } from '@letbuyy/lcis-core';

const scorer = new SeverityScorer();
const eb = new GovernanceEvidenceBuilder();

/** True if a path (e.g. 'services/workers/email.ts') matches a CODEOWNERS pattern. */
function matchesOwnership(path: string, patterns: readonly string[]): boolean {
  for (const pattern of patterns) {
    if (path === pattern) return true;
    const dir = pattern.endsWith('/') ? pattern : pattern + '/';
    if (path.startsWith(dir)) return true;
    if (pattern.includes('*')) {
      const prefix = pattern.split('*')[0];
      if (prefix && path.startsWith(prefix)) return true;
    }
    if (path.includes(pattern)) return true;
  }
  return false;
}

export class OwnershipService {
  private readonly gov: GovernanceArtifactStore;

  constructor(
    private readonly core: LcisEngine,
    private readonly now = defaultNow,
  ) {
    this.gov = new GovernanceArtifactStore(core);
  }

  // ── 1. Unowned Domains ──────────────────────────────────────────────────────

  findUnownedDomains(): OwnershipGap[] {
    return this.gov
      .domains()
      .filter((d) => d.owners.length === 0)
      .map((d): OwnershipGap => ({
        entityType: 'domain',
        subject: d.key,
        severity: scorer.forEntity({ money: d.money, tenant: d.tenant }),
        evidence: [
          eb.domain(d.key, `domain.owners is empty (length === 0) — no declared owner in domain-intel.json`),
        ],
      }));
  }

  // ── 2. Unowned Services (apps) ──────────────────────────────────────────────

  findUnownedServices(): OwnershipGap[] {
    const domains = this.gov.domains();
    const ownedDomainKeys = new Set(domains.filter((d) => d.owners.length > 0).map((d) => d.key));
    const ownershipEntries = this.gov.ownership();
    const ownedPaths = ownershipEntries.map((o) => o.path);

    const gaps: OwnershipGap[] = [];

    for (const domain of domains) {
      for (const app of domain.apps) {
        const domainOwned = ownedDomainKeys.has(domain.key);
        const pathOwned = matchesOwnership(app, ownedPaths);

        if (!domainOwned && !pathOwned) {
          gaps.push({
            entityType: 'service',
            subject: app,
            severity: scorer.forEntity({ money: domain.money, tenant: domain.tenant }),
            evidence: [
              eb.domain(
                domain.key,
                `app '${app}' belongs to domain '${domain.key}' which has no owners; no matching CODEOWNERS entry found`,
              ),
            ],
          });
        }
      }
    }

    return gaps;
  }

  // ── 3. Unowned Workers ──────────────────────────────────────────────────────

  findUnownedWorkers(): OwnershipGap[] {
    const domains = this.gov.domains();
    const ownershipEntries = this.gov.ownership();
    const ownedPaths = ownershipEntries.map((o) => o.path);

    const workerDomainMap = new Map<string, { money: boolean; tenant: boolean; hasOwner: boolean }>();
    for (const domain of domains) {
      const hasOwner = domain.owners.length > 0;
      for (const w of domain.workers) {
        const existing = workerDomainMap.get(w);
        if (existing) {
          workerDomainMap.set(w, {
            money: existing.money || domain.money,
            tenant: existing.tenant || domain.tenant,
            hasOwner: existing.hasOwner || hasOwner,
          });
        } else {
          workerDomainMap.set(w, { money: domain.money, tenant: domain.tenant, hasOwner });
        }
      }
    }

    const gaps: OwnershipGap[] = [];

    for (const worker of this.gov.workers()) {
      const domainEntry = workerDomainMap.get(worker.name);
      const pathOwned = matchesOwnership(worker.file, ownedPaths) || matchesOwnership(worker.name, ownedPaths);

      if (domainEntry === undefined) {
        if (!pathOwned) {
          gaps.push({
            entityType: 'worker',
            subject: worker.name,
            severity: 'medium',
            evidence: [
              eb.worker(worker.name, `worker '${worker.name}' (${worker.file}) not claimed by any domain.workers[] and has no matching CODEOWNERS entry`),
            ],
          });
        }
      } else if (!domainEntry.hasOwner && !pathOwned) {
        gaps.push({
          entityType: 'worker',
          subject: worker.name,
          severity: scorer.forEntity({ money: domainEntry.money, tenant: domainEntry.tenant }),
          evidence: [
            eb.worker(worker.name, `worker '${worker.name}' (${worker.file}) belongs to a domain with no declared owners`),
          ],
        });
      }
    }

    return gaps;
  }

  // ── 4. Unowned Queues ─────────────────────────────────────────────────────

  findUnownedQueues(): OwnershipGap[] {
    const domains = this.gov.domains();

    const queueDomainMap = new Map<string, { money: boolean; tenant: boolean; hasOwner: boolean }>();
    for (const domain of domains) {
      const hasOwner = domain.owners.length > 0;
      for (const q of domain.queues) {
        const existing = queueDomainMap.get(q);
        if (existing) {
          queueDomainMap.set(q, {
            money: existing.money || domain.money,
            tenant: existing.tenant || domain.tenant,
            hasOwner: existing.hasOwner || hasOwner,
          });
        } else {
          queueDomainMap.set(q, { money: domain.money, tenant: domain.tenant, hasOwner });
        }
      }
    }

    const gaps: OwnershipGap[] = [];
    for (const [queue, meta] of queueDomainMap) {
      if (!meta.hasOwner) {
        gaps.push({
          entityType: 'queue',
          subject: queue,
          severity: scorer.forEntity({ money: meta.money, tenant: meta.tenant }),
          evidence: [
            eb.domain(queue, `queue '${queue}' belongs to a domain with no declared owners (owners.length === 0)`),
          ],
        });
      }
    }

    return gaps;
  }

  // ── 5. Unowned RPCs ────────────────────────────────────────────────────────

  findUnownedRPCs(): OwnershipGap[] {
    const domains = this.gov.domains();

    const claimedRpcs = new Set<string>();
    for (const domain of domains) {
      for (const rpc of domain.rpcs) {
        claimedRpcs.add(rpc);
      }
    }

    return this.gov
      .functions()
      .filter((fn) => !claimedRpcs.has(fn.name))
      .map((fn): OwnershipGap => ({
        entityType: 'rpc',
        subject: fn.name,
        severity: scorer.forEntity({ money: fn.money }),
        evidence: [
          eb.rpc(fn.name, `RPC '${fn.name}' is not present in any domain.rpcs[] across all 22 domains`),
        ],
      }));
  }

  // ── 6. Unowned Tables ─────────────────────────────────────────────────────

  findUnownedTables(): OwnershipGap[] {
    const domains = this.gov.domains();

    const claimedTables = new Set<string>();
    for (const domain of domains) {
      for (const tbl of domain.tables) {
        claimedTables.add(tbl);
      }
    }

    return this.gov
      .tables()
      .filter((t) => !claimedTables.has(t.name))
      .map((t): OwnershipGap => ({
        entityType: 'table',
        subject: t.name,
        severity: scorer.forEntity({ money: t.money, tenant: t.tenant }),
        evidence: [
          eb.table(t.name, `table '${t.name}' is not present in any domain.tables[] across all 22 domains`),
        ],
      }));
  }

  // ── 7. Unowned Runbooks ───────────────────────────────────────────────────

  findUnownedRunbooks(): OwnershipGap[] {
    const domains = this.gov.domains();
    const ownedDomainKeys = new Set(domains.filter((d) => d.owners.length > 0).map((d) => d.key));
    const runbookSubjects = this.gov.runbookSubjects();

    return runbookSubjects
      .filter((subject) => !ownedDomainKeys.has(subject))
      .map((subject): OwnershipGap => ({
        entityType: 'runbook',
        subject,
        severity: 'medium',
        evidence: [
          eb.field(
            `runbook:${subject}`,
            `runbook subject '${subject}' does not match any domain with declared owners`,
            'graphify-out/infra-intel.json',
          ),
        ],
      }));
  }

  // ── 8. Coverage Map ───────────────────────────────────────────────────────

  generateOwnershipCoverage(): Record<OwnedEntityType, OwnershipCoverage> {
    const safe = (owned: number, total: number): OwnershipCoverage => ({
      total,
      owned,
      coverage: total === 0 ? 1 : owned / total,
    });

    const domains = this.gov.domains();
    const totalDomains = domains.length;
    const unownedDomains = this.findUnownedDomains().length;
    const ownedDomains = totalDomains - unownedDomains;

    const allServices = domains.flatMap((d) => d.apps);
    const totalServices = allServices.length;
    const unownedServices = this.findUnownedServices().length;
    const ownedServices = totalServices - unownedServices;

    const totalWorkers = this.gov.workers().length;
    const unownedWorkers = this.findUnownedWorkers().length;
    const ownedWorkers = totalWorkers - unownedWorkers;

    const allQueues = new Set<string>(domains.flatMap((d) => d.queues));
    const totalQueues = allQueues.size;
    const unownedQueues = this.findUnownedQueues().length;
    const ownedQueues = totalQueues - unownedQueues;

    const totalRpcs = this.gov.functions().length;
    const unownedRpcs = this.findUnownedRPCs().length;
    const ownedRpcs = totalRpcs - unownedRpcs;

    const totalTables = this.gov.tables().length;
    const unownedTables = this.findUnownedTables().length;
    const ownedTables = totalTables - unownedTables;

    const runbookSubjects = this.gov.runbookSubjects();
    const totalRunbooks = runbookSubjects.length;
    const unownedRunbooks = this.findUnownedRunbooks().length;
    const ownedRunbooks = totalRunbooks - unownedRunbooks;

    return {
      domain: safe(ownedDomains, totalDomains),
      service: safe(ownedServices, totalServices),
      worker: safe(ownedWorkers, totalWorkers),
      queue: safe(ownedQueues, totalQueues),
      rpc: safe(ownedRpcs, totalRpcs),
      table: safe(ownedTables, totalTables),
      runbook: safe(ownedRunbooks, totalRunbooks),
    };
  }

  // ── 9. Full Ownership Report ──────────────────────────────────────────────

  generateOwnershipReport(): OwnershipReport {
    const allGaps: OwnershipGap[] = [
      ...this.findUnownedDomains(),
      ...this.findUnownedServices(),
      ...this.findUnownedWorkers(),
      ...this.findUnownedQueues(),
      ...this.findUnownedRPCs(),
      ...this.findUnownedTables(),
      ...this.findUnownedRunbooks(),
    ];

    const coverage = this.generateOwnershipCoverage();

    const allEvidence: Evidence[] = allGaps.flatMap((g) => [...g.evidence]);

    const sources = this.gov.sourcesPresent();
    for (const src of sources) {
      allEvidence.push(
        evidence('artifact-field', src, `ownership analysis source: ${src}`, src),
      );
    }

    const totalGaps = allGaps.length;
    const criticalOrHigh = allGaps.filter(
      (g) => g.severity === 'critical' || g.severity === 'high',
    ).length;

    const summary =
      `Ownership analysis: ${totalGaps} total gaps across 7 entity types. ` +
      `${criticalOrHigh} are critical/high severity. ` +
      `Domain coverage: ${Math.round(coverage.domain.coverage * 100)}%, ` +
      `RPC coverage: ${Math.round(coverage.rpc.coverage * 100)}%, ` +
      `Table coverage: ${Math.round(coverage.table.coverage * 100)}%.`;

    return governance(
      {
        gaps: allGaps,
        coverage,
        summary,
      },
      {
        evidence: allEvidence,
        now: this.now,
      },
    );
  }
}
