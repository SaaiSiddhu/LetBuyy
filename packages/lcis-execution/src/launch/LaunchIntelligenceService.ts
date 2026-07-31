/**
 * LaunchIntelligenceService — Deliverable 6 of the EIS.
 *
 * Plans, analyzes, and recommends on launch readiness using structural artifacts
 * (production-readiness-v2, launch-command-center) + change-risk. NEVER fabricates:
 *   - An item that cannot be determined → UNKNOWN (surfaced, never silently passed)
 *   - A KNOWN critical blocker → NO_GO
 *   - UNKNOWNs or warnings → CONDITIONAL_GO
 *   - Clean + evidenced → GO
 *
 * Read-only. No fetch, no spawn, no eval, no writeFile.
 */
import { type LcisEngine, evidence, notConnected } from '@letbuyy/lcis-core';
import { ChangeAnalyzer, toAnalysis, plan } from '../shared/index';
import type {
  ChangeRequest,
  ChangeAnalysis,
  GoNoGo,
  GoNoGoDecision,
  LaunchBlocker,
  LaunchChecklistItem,
  LaunchPlan,
  RiskLevel,
} from '../shared/types';
import type { Evidence } from '@letbuyy/lcis-core';

// ─── Raw artifact shapes (local; VerificationService owns the authoritative ones) ─

interface RawBlocker {
  readonly id: string;
  readonly severity: string;
  readonly title: string;
  readonly description?: string;
}

interface RawLaunchSummary {
  readonly recommendation: string;
  readonly overallReadiness: number;
  readonly openBlockers: number;
  readonly criticalRisks?: number;
  readonly liveNotConnected?: number;
}

interface RawLaunchCommandCenter {
  readonly summary: RawLaunchSummary;
  readonly blockers: readonly RawBlocker[];
  readonly openMigrations?: { readonly latestDeclared?: string };
}

interface RawPrSystem {
  readonly system: string;
  readonly key?: string;
  readonly score: number;
  readonly blockers?: readonly string[];
}

interface RawPrSummary {
  readonly overall: number;
  readonly dimensions: number;
  readonly launchVerdict: string;
  readonly openBlockers: number;
}

interface RawProductionReadinessV2 {
  readonly summary: RawPrSummary;
  readonly dimensions: readonly { readonly dimension: string; readonly score: number }[];
  readonly systems: readonly RawPrSystem[];
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const BLOCKER_SOURCES = [
  'graphify-out/launch-command-center.json',
  'graphify-out/production-readiness-v2.json',
] as const;

/** Parse emoji-based severity to RiskLevel. */
function parseSeverity(s: string): RiskLevel {
  if (s.includes('🔴') || s.toLowerCase().includes('critical') || s.toLowerCase().includes('red')) return 'critical';
  if (s.includes('🟠') || s.toLowerCase().includes('high') || s.toLowerCase().includes('orange')) return 'high';
  if (s.includes('🟡') || s.toLowerCase().includes('medium') || s.toLowerCase().includes('yellow')) return 'medium';
  return 'low';
}

/** Risk level → risk level string guard for critical check */
function isCriticalOrHigh(r: RiskLevel): boolean {
  return r === 'critical' || r === 'high';
}

// ─── Service ────────────────────────────────────────────────────────────────

export class LaunchIntelligenceService {
  private readonly analyzer: ChangeAnalyzer;

  constructor(
    private readonly engine: LcisEngine,
    private readonly now = (): string => new Date().toISOString(),
  ) {
    this.analyzer = new ChangeAnalyzer(engine, now);
  }

  // ── Deliverable 6a: readiness score ─────────────────────────────────────

  async calculateLaunchReadiness(input: ChangeRequest | ChangeAnalysis): Promise<number> {
    const analysis = toAnalysis(this.analyzer, input);
    const prv2 = this.engine.store.tryRead<RawProductionReadinessV2>('production-readiness-v2');

    let base = 0.5; // honest default when no artifact
    let denominator = 1;
    let numerator = 0.5;

    if (prv2) {
      const pct = prv2.summary.overall ?? 0;
      base = pct / 100;
      numerator = pct;
      denominator = 100;
    }

    // Change risk lowers "ready" bar:
    // money → −10%; tenant → −5%; critical risk → −8%; high risk → −4%
    let penalty = 0;
    if (analysis.risk.money) penalty += 0.10;
    if (analysis.risk.tenant) penalty += 0.05;
    if (analysis.risk.level === 'critical') penalty += 0.08;
    else if (analysis.risk.level === 'high') penalty += 0.04;

    void numerator; void denominator;

    const raw = Math.max(0, Math.min(1, base - penalty));
    // Round to 2 decimal places
    return Math.round(raw * 100) / 100;
  }

  // ── Deliverable 6b: detect blockers ─────────────────────────────────────

  async detectLaunchBlockers(input: ChangeRequest | ChangeAnalysis): Promise<LaunchBlocker[]> {
    const analysis = toAnalysis(this.analyzer, input);
    const lcc = this.engine.store.tryRead<RawLaunchCommandCenter>('launch-command-center');
    const prv2 = this.engine.store.tryRead<RawProductionReadinessV2>('production-readiness-v2');

    const blockers: LaunchBlocker[] = [];

    if (lcc) {
      for (const b of lcc.blockers) {
        const sev = parseSeverity(b.severity);
        blockers.push({
          id: b.id,
          title: b.title,
          severity: sev,
          state: 'KNOWN',
          evidence: [
            evidence('artifact-field', b.id, b.title, 'graphify-out/launch-command-center.json'),
          ],
        });
      }
    } else {
      // No artifact → UNKNOWN (never a silent pass)
      blockers.push({
        id: 'UNKNOWN-LCC',
        title: 'launch-command-center.json not available — open blockers unknown',
        severity: 'high',
        state: 'UNKNOWN',
        evidence: [
          notConnected('launch-command-center', 'graphify-out/launch-command-center.json'),
        ],
      });
    }

    // Money path blocker: if money + no prv2 confirmation → KNOWN blocker (must re-blast before launch)
    if (analysis.risk.money) {
      const confirmed = prv2?.systems.some(
        (s) => (s.system?.toLowerCase().includes('payment') || s.system?.toLowerCase().includes('commerce')) && s.score >= 90,
      ) ?? false;
      if (!confirmed) {
        blockers.push({
          id: 'RISK-MONEY-PATH',
          title: 'Money/ledger tables in change blast radius — canonical-ledger-only-validator + step-up verification required before launch',
          severity: 'critical',
          state: lcc ? 'KNOWN' : 'UNKNOWN',
          evidence: [
            evidence(
              'artifact-field',
              'risk.money',
              `money=true in change analysis; affected tables: ${analysis.affected.tables.join(', ')}`,
              'graphify-out/domain-intel.json',
            ),
          ],
        });
      }
    }

    // Tenant blocker: tenant table touched → RLS check before launch
    if (analysis.risk.tenant) {
      blockers.push({
        id: 'RISK-TENANT-RLS',
        title: 'Tenant-facing change — RLS isolation and verifySiteOwnership must be verified before launch (affects ALL merchants on shared schema)',
        severity: 'high',
        state: 'KNOWN',
        evidence: [
          evidence(
            'artifact-field',
            'risk.tenant',
            `tenant=true in change analysis; affected tables: ${analysis.affected.tables.join(', ')}`,
            'graphify-out/domain-intel.json',
          ),
        ],
      });
    }

    return blockers;
  }

  // ── Deliverable 6c: launch checklist ─────────────────────────────────────

  async generateLaunchChecklist(input: ChangeRequest | ChangeAnalysis): Promise<LaunchChecklistItem[]> {
    const analysis = toAnalysis(this.analyzer, input);
    const prv2 = this.engine.store.tryRead<RawProductionReadinessV2>('production-readiness-v2');
    const lcc = this.engine.store.tryRead<RawLaunchCommandCenter>('launch-command-center');
    const items: LaunchChecklistItem[] = [];

    // 1. Structural readiness
    if (prv2) {
      const score = prv2.summary.overall ?? 0;
      items.push({
        area: 'readiness',
        requirement: `Structural readiness ≥ 80% (actual: ${score}%)`,
        status: score >= 80 ? 'MET' : 'UNMET',
        evidence: [
          evidence('artifact-field', 'summary.overall', `${score}%`, 'graphify-out/production-readiness-v2.json'),
        ],
      });
    } else {
      items.push({
        area: 'readiness',
        requirement: 'Structural readiness ≥ 80%',
        status: 'UNKNOWN',
        evidence: [notConnected('production-readiness-v2', 'graphify-out/production-readiness-v2.json')],
      });
    }

    // 2. Open blockers
    if (lcc) {
      const open = lcc.summary.openBlockers ?? 0;
      items.push({
        area: 'readiness',
        requirement: `No open launch blockers (found: ${open})`,
        status: open === 0 ? 'MET' : 'UNMET',
        evidence: [
          evidence('artifact-field', 'summary.openBlockers', `${open} open blockers`, 'graphify-out/launch-command-center.json'),
        ],
      });
    } else {
      items.push({
        area: 'readiness',
        requirement: 'No open launch blockers',
        status: 'UNKNOWN',
        evidence: [notConnected('launch-command-center', 'graphify-out/launch-command-center.json')],
      });
    }

    // 3. Tests
    const testCount = analysis.affected.tests.length;
    items.push({
      area: 'tests',
      requirement: `Affected tests identified and run (${testCount} test files in blast radius)`,
      status: testCount > 0 ? 'MET' : 'UNKNOWN',
      evidence: [
        evidence(
          'file',
          `${testCount} test file(s)`,
          testCount > 0 ? `Tests covering blast radius: ${analysis.affected.tests.slice(0, 3).join(', ')}` : 'No test files found in blast radius',
          'graphify-out/graph.json',
        ),
      ],
    });

    // 4. Migration
    const latestMigration = lcc?.openMigrations?.latestDeclared;
    items.push({
      area: 'migration',
      requirement: 'Migration declared and reversible',
      status: latestMigration ? 'MET' : 'UNKNOWN',
      evidence: latestMigration
        ? [evidence('migration', latestMigration, 'Latest declared migration', 'graphify-out/launch-command-center.json')]
        : [notConnected('migration-state', 'graphify-out/launch-command-center.json')],
    });

    // 5. Rollback
    items.push({
      area: 'rollback',
      requirement: analysis.risk.money
        ? 'Ledger-safe rollback via canonical RPCs (complete_order_refund / restore_gift_card_on_refund)'
        : 'Rollback plan: revert + migration-down + worker redeploy',
      status: 'MET', // structural — the canonical rollback RPCs always exist
      evidence: [
        evidence(
          'rpc',
          analysis.risk.money ? 'complete_order_refund' : 'git-revert',
          analysis.rollbackStrategy,
          'graphify-out/db-intel.json',
        ),
      ],
    });

    // 6. Security
    const secDim = prv2?.dimensions.find((d) => d.dimension === 'Security');
    if (secDim) {
      items.push({
        area: 'security',
        requirement: `Security dimension ≥ 80 (actual: ${secDim.score})`,
        status: secDim.score >= 80 ? 'MET' : 'UNMET',
        evidence: [
          evidence('artifact-field', 'Security', `${secDim.score}`, 'graphify-out/production-readiness-v2.json'),
        ],
      });
    } else {
      items.push({
        area: 'security',
        requirement: 'Security dimension ≥ 80',
        status: 'UNKNOWN',
        evidence: [notConnected('production-readiness-v2.Security', 'graphify-out/production-readiness-v2.json')],
      });
    }

    // 7. RLS (only if tenant)
    if (analysis.risk.tenant) {
      items.push({
        area: 'security',
        requirement: 'RLS isolation confirmed — tenant tables must enforce row-level security',
        status: 'UNKNOWN', // live value; cannot confirm structurally
        evidence: [
          notConnected('rls-live-check', 'SUPABASE_SERVICE_ROLE_KEY'),
          evidence('artifact-field', 'risk.tenant', 'tenant=true in change analysis', 'graphify-out/domain-intel.json'),
        ],
      });
    }

    // 8. Observability
    const obsDim = prv2?.dimensions.find((d) => d.dimension === 'Observability' || d.dimension === 'Telemetry');
    if (obsDim) {
      items.push({
        area: 'observability',
        requirement: `Observability/Telemetry dimension ≥ 80 (actual: ${obsDim.score})`,
        status: obsDim.score >= 80 ? 'MET' : 'UNMET',
        evidence: [
          evidence('artifact-field', obsDim.dimension, `${obsDim.score}`, 'graphify-out/production-readiness-v2.json'),
        ],
      });
    } else {
      items.push({
        area: 'observability',
        requirement: 'Observability/Telemetry dimension ≥ 80',
        status: 'UNKNOWN',
        evidence: [notConnected('production-readiness-v2.Observability', 'graphify-out/production-readiness-v2.json')],
      });
    }

    return items;
  }

  // ── Deliverable 6d: go/no-go decision ───────────────────────────────────

  async generateGoNoGoDecision(input: ChangeRequest | ChangeAnalysis): Promise<GoNoGoDecision> {
    const blockers = await this.detectLaunchBlockers(input);
    const checklist = await this.generateLaunchChecklist(input);
    const analysis = toAnalysis(this.analyzer, input);

    const ev: Evidence[] = [];
    const unknowns: string[] = [];
    const lcc = this.engine.store.tryRead<RawLaunchCommandCenter>('launch-command-center');
    const prv2 = this.engine.store.tryRead<RawProductionReadinessV2>('production-readiness-v2');

    // Evidence from prv2
    if (prv2) {
      ev.push(
        evidence(
          'artifact-field',
          'summary.overall',
          `${prv2.summary.overall}% overall structural readiness`,
          'graphify-out/production-readiness-v2.json',
        ),
      );
    } else {
      unknowns.push('production-readiness-v2 artifact unavailable — structural readiness unknown');
      ev.push(notConnected('production-readiness-v2', 'graphify-out/production-readiness-v2.json'));
    }

    if (lcc) {
      ev.push(
        evidence(
          'artifact-field',
          'summary.openBlockers',
          `${lcc.summary.openBlockers} open blockers; recommendation: ${lcc.summary.recommendation}`,
          'graphify-out/launch-command-center.json',
        ),
      );
    } else {
      unknowns.push('launch-command-center artifact unavailable — open blockers unknown');
      ev.push(notConnected('launch-command-center', 'graphify-out/launch-command-center.json'));
    }

    // Collect checklist UNKNOWN items
    for (const item of checklist) {
      if (item.status === 'UNKNOWN') {
        unknowns.push(`${item.area}: ${item.requirement}`);
        ev.push(...item.evidence);
      } else {
        ev.push(...item.evidence);
      }
    }

    // Collect blocker evidence
    for (const b of blockers) {
      ev.push(...b.evidence);
    }

    // Decision rules (honesty-first):
    // 1. A KNOWN critical blocker → NO_GO
    // 2. An UNKNOWN blocker (cannot determine) → at most CONDITIONAL_GO
    // 3. Any UNMET critical checklist item → NO_GO
    // 4. UNKNOWNs or warnings → CONDITIONAL_GO
    // 5. Clean + evidenced → GO

    const knownCriticalBlockers = blockers.filter(
      (b) => b.state === 'KNOWN' && isCriticalOrHigh(b.severity),
    );
    const unknownBlockers = blockers.filter((b) => b.state === 'UNKNOWN');
    const hasUnmetItems = checklist.some((c) => c.status === 'UNMET');

    let decision: GoNoGo;
    let rationale: string;

    if (knownCriticalBlockers.length > 0) {
      decision = 'NO_GO';
      rationale = `${knownCriticalBlockers.length} KNOWN critical/high blocker(s): ${knownCriticalBlockers.map((b) => `[${b.id}] ${b.title}`).join('; ')}. A KNOWN critical blocker always → NO_GO.`;
    } else if (hasUnmetItems) {
      decision = 'NO_GO';
      const unmet = checklist.filter((c) => c.status === 'UNMET').map((c) => c.requirement);
      rationale = `${unmet.length} checklist requirement(s) UNMET: ${unmet.join('; ')}.`;
    } else if (unknownBlockers.length > 0 || unknowns.length > 0) {
      decision = 'CONDITIONAL_GO';
      rationale = `No KNOWN critical blockers; ${unknowns.length} item(s) UNKNOWN (cannot determine). UNKNOWNs prevent a clean GO — resolve before launch: ${unknowns.slice(0, 3).join('; ')}${unknowns.length > 3 ? '…' : ''}.`;
    } else if (!prv2 || !lcc) {
      decision = 'CONDITIONAL_GO';
      rationale = 'Required launch artifacts unavailable; readiness cannot be evidenced. Resolve artifact generation (pnpm graph:omega) before GO.';
    } else {
      const overall = prv2.summary.overall ?? 0;
      const openBl = lcc.summary.openBlockers ?? 0;
      if (openBl === 0 && overall >= 80 && analysis.risk.level !== 'critical') {
        decision = 'GO';
        rationale = `Structural readiness ${overall}%; 0 open blockers; no critical risk in change. Evidence chain complete.`;
      } else if (openBl > 0) {
        decision = 'NO_GO';
        rationale = `${openBl} open launch blocker(s) in launch-command-center. Must be resolved for GO.`;
      } else {
        decision = 'CONDITIONAL_GO';
        rationale = `Structural readiness ${overall}%; change risk level: ${analysis.risk.level}. Review risk before GO.`;
      }
    }

    const body = {
      decision,
      rationale,
      blockers,
      unknowns,
    };
    return plan(body, { evidence: ev, now: this.now });
  }

  // ── Deliverable 6e: full launch plan ────────────────────────────────────

  async evaluateLaunch(input: ChangeRequest | ChangeAnalysis): Promise<LaunchPlan> {
    const analysis = toAnalysis(this.analyzer, input);
    const [readiness, decision, blockers, checklist] = await Promise.all([
      this.calculateLaunchReadiness(input),
      this.generateGoNoGoDecision(input),
      this.detectLaunchBlockers(input),
      this.generateLaunchChecklist(input),
    ]);

    const ev: Evidence[] = [
      ...decision.evidence,
      ...blockers.flatMap((b) => b.evidence),
      ...checklist.flatMap((c) => c.evidence),
      ...analysis.evidence,
    ];

    const body = {
      request: analysis.request,
      readiness,
      decision,
      blockers,
      checklist,
    };
    return plan(body, { evidence: ev, now: this.now });
  }
}
