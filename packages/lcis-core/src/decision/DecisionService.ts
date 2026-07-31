/**
 * DecisionService — consolidates decision-engine-v5, decision-engine-v2 (wrapper),
 * fix-engine, production-readiness-intel, and production-readiness-v2 into one
 * deterministic, evidence-cited service.
 *
 * v2/v5 resolution (spec §1):
 *   decision-engine-v5.mjs owns all ranking logic (highestRisk + fixNext + scale tiers).
 *   decision-engine-v2.mjs is a pure wrapper that adds two extra scale tiers and calls v5.
 *   → We consolidate to ONE ranking pass (this class) and absorb the v2 scale tiers.
 *
 * Honesty contract:
 *   - No live values fabricated.
 *   - Scale-tier capacity strings are labelled "requires a load test", never numbers.
 *   - applied: false always.
 */
import type { ArtifactStore } from '../runtime/ArtifactStore';
import {
  loadDecisionEngineV2,
  loadExecutionIntel,
  loadFixEngine,
  loadMerchantIntel,
  loadProductionReadiness,
  loadProductionReadinessV2,
  loadRevenueIntel,
  loadSecurityIntel,
  openBlockerIds,
  systemReadinessForDomain,
} from './artifacts';
import {
  MONEY_DOMAINS,
  fixFormulaString,
  fixScore,
  inrImpactTier,
  riskFormulaString,
  riskScore,
  severityWeight,
} from './scoring';
import type {
  Decision,
  DimensionReadiness,
  Evidence,
  InrImpactTier,
  LaunchVerdict,
  PrioritizedItem,
  RankedFix,
  RankedRisk,
  ScaleTiers,
  ScoringFactors,
  Severity,
  SystemReadiness,
} from './types';

function ev(
  source: Evidence['source'],
  ref: string,
  value: string,
  timestamp?: string,
): Evidence {
  const e: {
    source: Evidence['source'];
    ref: string;
    value: string;
    timestamp?: string;
  } = { source, ref, value };
  if (timestamp !== undefined) e.timestamp = timestamp;
  return e;
}

export class DecisionService {
  constructor(private readonly store: ArtifactStore) {}

  // ─── Private: lazy-loaded data ───────────────────────────────────────────────

  private _risks: RankedRisk[] | null = null;
  private _fixes: RankedFix[] | null = null;

  // ─── rankRisks() ────────────────────────────────────────────────────────────

  /**
   * Ranked open blockers + structural risks, deterministic, highest severity first.
   * Source: decision-engine-v2.json highestRisk + execution-intel.json blockers.
   * Tie-break: alphabetical by id (deterministic across runs).
   */
  rankRisks(): RankedRisk[] {
    if (this._risks !== null) return this._risks;

    const d2 = loadDecisionEngineV2(this.store);
    const exec = loadExecutionIntel(this.store);
    const pr = loadProductionReadiness(this.store);

    const systems = pr?.systems ?? [];
    const openIds = exec ? openBlockerIds(exec) : new Set<string>();
    const ts = exec?.summary?.generatedAt;

    // Accumulate items from highestRisk list in decision-engine-v2
    type IntermediateRisk = {
      id: string;
      type: 'blocker' | 'money' | 'tenant' | 'spof' | 'structural';
      severity: Severity;
      title: string;
      status: string;
      domain: string;
      evidence: Evidence[];
    };

    const items: IntermediateRisk[] = [];

    if (d2) {
      for (const r of d2.highestRisk) {
        const id = r.ref;
        const type = (r.type ?? 'structural') as IntermediateRisk['type'];
        const title = r.detail ?? id;
        // For blockers, pull status from execution-intel
        const execBlocker = exec?.blockers.find((b) => b.id === id);
        const status = execBlocker?.status ?? (openIds.has(id) ? 'open' : 'structural');
        const sev = (r.severity ?? 'unknown') as Severity;

        // Domain inference for money flag
        let domain = 'unknown';
        if (type === 'money') domain = 'payments';
        else if (type === 'tenant') domain = 'security';
        else if (type === 'spof') domain = 'infrastructure';
        else if (type === 'blocker') {
          // Map LB IDs → domain
          const domainByLb: Record<string, string> = {
            'LB-7': 'shipping',
            'LB-8': 'merchant',
            'LB-9': 'merchant',
            'LB-10': 'identity',
            'LB-11': 'merchant',
            'LB-12': 'identity',
          };
          domain = domainByLb[id] ?? 'unknown';
        }

        const evidence: Evidence[] = [
          ev('execution-intel', id, `${title} — ${status}`, ts),
        ];

        items.push({ id, type, severity: sev, title, status, domain, evidence });
      }
    } else if (exec) {
      // Fallback: build from execution-intel blockers only
      for (const b of exec.blockers) {
        const domainByLb: Record<string, string> = {
          'LB-7': 'shipping',
          'LB-8': 'merchant',
          'LB-9': 'merchant',
          'LB-10': 'identity',
          'LB-11': 'merchant',
          'LB-12': 'identity',
        };
        items.push({
          id: b.id,
          type: 'blocker',
          severity: (b.severity ?? 'unknown') as Severity,
          title: b.title,
          status: b.status,
          domain: domainByLb[b.id] ?? 'unknown',
          evidence: [ev('execution-intel', b.id, `${b.title} — ${b.status}`, ts)],
        });
      }
    }

    // Score + rank
    const scored = items.map((item) => {
      const sw = severityWeight(item.severity);
      const md: 0 | 1 = MONEY_DOMAINS.has(item.domain) || item.type === 'money' ? 1 : 0;
      const sr = systemReadinessForDomain(systems, item.id || item.domain);
      const obr: 0 | 1 = openIds.has(item.id) ? 1 : 0;

      const factors: ScoringFactors = {
        severityWeight: sw,
        moneyDomain: md,
        systemReadiness: sr,
        openBlockerRef: obr,
      };
      const score = riskScore(factors);
      const formula = riskFormulaString(factors, score);

      return { item, factors, score, formula };
    });

    // Sort: highest score first; tie-break alphabetical by id
    scored.sort((a, b) => {
      const diff = b.score - a.score;
      if (diff !== 0) return diff;
      return a.item.id.localeCompare(b.item.id);
    });

    this._risks = scored.map((s, i) => ({
      rank: i + 1,
      id: s.item.id,
      type: s.item.type,
      severity: s.item.severity,
      title: s.item.title,
      status: s.item.status,
      score: s.score,
      factors: s.factors,
      formula: s.formula,
      evidence: s.item.evidence,
    }));

    return this._risks;
  }

  // ─── rankFixes() ────────────────────────────────────────────────────────────

  /**
   * Ranked fix/verify/test/rollback plans, ₹-impact-ordered.
   * Source: fix-engine.json plans + execution-intel.json blocker metadata.
   */
  rankFixes(): RankedFix[] {
    if (this._fixes !== null) return this._fixes;

    const fe = loadFixEngine(this.store);
    const exec = loadExecutionIntel(this.store);
    const pr = loadProductionReadiness(this.store);

    const systems = pr?.systems ?? [];
    const openIds = exec ? openBlockerIds(exec) : new Set<string>();
    const ts = fe?.summary?.generatedAt;

    const plans = fe?.plans ?? [];

    type IntermediateFix = {
      id: string;
      finding: string;
      severity: Severity;
      domain: string;
      isOpenBlocker: boolean;
      fixPlan: string;
      verificationPlan: string;
      testPlan: string;
      rollbackPlan: string;
      evidence: Evidence[];
    };

    const items: IntermediateFix[] = plans.map((p, idx) => {
      // Extract blocker id from the finding string (e.g. "LB-8 (🔴): ...")
      const lbMatch = /^(LB-\d+)/.exec(p.finding);
      const id = p.id ?? lbMatch?.[1] ?? `fix-${idx + 1}`;

      // Extract severity from finding string emoji or from execution-intel
      const emojiMatch = /(🔴|🟠|🟡|🟢)/.exec(p.finding);
      const execB = exec?.blockers.find((b) => b.id === id);
      const sev = ((execB?.severity ?? emojiMatch?.[1] ?? 'unknown') as Severity);

      // Domain inference
      const isOpenBlocker = openIds.has(id);
      let domain = 'structural';
      const findingLower = p.finding.toLowerCase();
      if (findingLower.includes('payment') || findingLower.includes('refund') || findingLower.includes('payout')) {
        domain = 'payments';
      } else if (findingLower.includes('shopper') || findingLower.includes('registrat') || id === 'LB-12') {
        domain = 'identity';
      } else if (findingLower.includes('email')) {
        domain = 'identity';
      } else if (findingLower.includes('shipping') || findingLower.includes('gst') || id === 'LB-7') {
        domain = 'shipping';
      } else if (findingLower.includes('announcement') || findingLower.includes('appearance') || id === 'LB-8' || id === 'LB-9') {
        domain = 'merchant';
      } else if (findingLower.includes('rpc') || findingLower.includes('security definer')) {
        domain = 'structural';
      }

      const evidence: Evidence[] = [
        ev('execution-intel', id, p.finding, ts),
      ];
      if (isOpenBlocker) {
        evidence.push(ev('blocker-report', id, `Open blocker: ${execB?.title ?? id}`, ts));
      }

      return {
        id,
        finding: p.finding,
        severity: sev,
        domain,
        isOpenBlocker,
        fixPlan: p.fixPlan,
        verificationPlan: p.verificationPlan,
        testPlan: p.testPlan,
        rollbackPlan: p.rollbackPlan,
        evidence,
      };
    });

    // Score
    const scored = items.map((item) => {
      const sw = severityWeight(item.severity);
      const md: 0 | 1 = MONEY_DOMAINS.has(item.domain) ? 1 : 0;
      const sr = systemReadinessForDomain(systems, item.domain);
      const obr: 0 | 1 = item.isOpenBlocker ? 1 : 0;
      const tier = inrImpactTier(item.domain, item.severity, item.isOpenBlocker, item.finding);

      const factors: ScoringFactors = {
        severityWeight: sw,
        moneyDomain: md,
        systemReadiness: sr,
        openBlockerRef: obr,
      };
      const score = fixScore(factors, tier);
      const formula = fixFormulaString(factors, tier, score);

      return { item, factors, score, formula, tier };
    });

    // Sort: highest score first; tie-break alphabetical by id
    scored.sort((a, b) => {
      const diff = b.score - a.score;
      if (diff !== 0) return diff;
      return a.item.id.localeCompare(b.item.id);
    });

    this._fixes = scored.map((s, i) => ({
      rank: i + 1,
      id: s.item.id,
      finding: s.item.finding,
      severity: s.item.severity,
      domain: s.item.domain,
      inrImpactTier: s.tier as InrImpactTier,
      fixPlan: s.item.fixPlan,
      verificationPlan: s.item.verificationPlan,
      testPlan: s.item.testPlan,
      rollbackPlan: s.item.rollbackPlan,
      score: s.score,
      factors: s.factors,
      formula: s.formula,
      evidence: s.item.evidence,
    }));

    return this._fixes;
  }

  // ─── prioritize() ────────────────────────────────────────────────────────────

  /**
   * Prioritize an arbitrary list of items using the risk scoring formula.
   * Returns ranked items sorted highest score first.
   */
  prioritize(
    items: Array<{ id: string; severity: string; domain?: string }>,
  ): PrioritizedItem[] {
    const pr = loadProductionReadiness(this.store);
    const exec = loadExecutionIntel(this.store);
    const systems = pr?.systems ?? [];
    const openIds = exec ? openBlockerIds(exec) : new Set<string>();

    const scored = items.map((item) => {
      const sw = severityWeight(item.severity as Severity);
      const dom = item.domain ?? 'unknown';
      const md: 0 | 1 = MONEY_DOMAINS.has(dom) ? 1 : 0;
      const sr = systemReadinessForDomain(systems, dom);
      const obr: 0 | 1 = openIds.has(item.id) ? 1 : 0;

      const factors: ScoringFactors = {
        severityWeight: sw,
        moneyDomain: md,
        systemReadiness: sr,
        openBlockerRef: obr,
      };
      const score = riskScore(factors);
      return { item, factors, score };
    });

    scored.sort((a, b) => {
      const diff = b.score - a.score;
      if (diff !== 0) return diff;
      return a.item.id.localeCompare(b.item.id);
    });

    return scored.map((s, i) => ({
      rank: i + 1,
      id: s.item.id,
      score: s.score,
      factors: s.factors,
    }));
  }

  // ─── order() ─────────────────────────────────────────────────────────────────

  /**
   * Order fix plans by commercial impact: money domains > launch-blocking > structural.
   * Accepts an arbitrary RankedFix[] and re-orders it (non-destructive — returns a new array).
   */
  order(fixes: RankedFix[]): RankedFix[] {
    const reordered = [...fixes].sort((a, b) => {
      const diff = b.score - a.score;
      if (diff !== 0) return diff;
      return a.id.localeCompare(b.id);
    });
    return reordered.map((f, i) => ({ ...f, rank: i + 1 }));
  }

  // ─── impactRank() ──────────────────────────────────────────────────────────

  /**
   * Rank all systems by impact score (structural readiness × blast-radius weight).
   * Uses production-readiness.json systems. Lower score = higher priority.
   */
  impactRank(): SystemReadiness[] {
    return this.systemReadiness().slice().sort((a, b) => a.score - b.score);
  }

  // ─── evidence() ──────────────────────────────────────────────────────────────

  /**
   * Return all evidence entries for a given decision or system key.
   * Searches ranked risks, fixes, and production-readiness systems.
   */
  evidence(decisionId: string): Evidence[] {
    const id = decisionId.toUpperCase();
    const evArr: Evidence[] = [];

    // From ranked risks
    for (const r of this.rankRisks()) {
      if (r.id.toUpperCase() === id) {
        evArr.push(...r.evidence);
        break;
      }
    }

    // From ranked fixes
    for (const f of this.rankFixes()) {
      if (f.id.toUpperCase() === id) {
        evArr.push(...f.evidence);
        break;
      }
    }

    // From production-readiness systems
    const pr = loadProductionReadiness(this.store);
    if (pr) {
      for (const sys of pr.systems) {
        if (
          sys.key.toUpperCase() === id ||
          sys.system.toUpperCase().includes(id)
        ) {
          evArr.push(
            ev('blocker-report', sys.key, `System ${sys.system}: score ${sys.score}`),
          );
          for (const e of sys.evidence) {
            evArr.push(ev('domain-intel', sys.key, e));
          }
        }
      }
    }

    // Always add blocker-report source if id matches a blocker
    const exec = loadExecutionIntel(this.store);
    if (exec) {
      const b = exec.blockers.find((x) => x.id.toUpperCase() === id);
      if (b) {
        evArr.push(
          ev('blocker-report', b.id, `${b.title} — ${b.status}`, exec.summary?.generatedAt),
        );
      }
    }

    // Deduplicate by ref+value
    const seen = new Set<string>();
    return evArr.filter((e) => {
      const k = `${e.source}:${e.ref}:${e.value}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }

  // ─── trace() ─────────────────────────────────────────────────────────────────

  /**
   * Full explainable trace: inputs → factor breakdown → weighted score → rank.
   */
  trace(decisionId: string): Decision {
    const id = decisionId.toUpperCase();
    const risks = this.rankRisks();

    // Find in ranked risks
    const risk = risks.find((r) => r.id.toUpperCase() === id);

    if (risk) {
      const pr = loadProductionReadiness(this.store);
      const exec = loadExecutionIntel(this.store);
      const openIds = exec ? openBlockerIds(exec) : new Set<string>();

      const blockerIds = openIds.has(risk.id) ? [risk.id] : [];
      const artifacts: string[] = ['execution-intel', 'decision-engine-v2'];
      if (pr) artifacts.push('production-readiness');

      return {
        id: risk.id,
        inputs: {
          blockers: blockerIds,
          artifacts,
          systemReadinessScore: risk.factors.systemReadiness ?? null,
        },
        factors: risk.factors,
        formula: risk.formula,
        score: risk.score,
        rank: risk.rank,
        evidence: [...risk.evidence],
      };
    }

    // Not found: return a null-ish trace
    return {
      id: decisionId,
      inputs: { blockers: [], artifacts: [], systemReadinessScore: null },
      factors: { severityWeight: 0, moneyDomain: 0, systemReadiness: 0, openBlockerRef: 0 },
      formula: 'not found',
      score: 0,
      rank: -1,
      evidence: [],
    };
  }

  // ─── systemReadiness() ───────────────────────────────────────────────────────

  /**
   * Per-system structural readiness (18 systems from production-readiness-intel / production-readiness.json).
   */
  systemReadiness(): SystemReadiness[] {
    const pr = loadProductionReadiness(this.store);
    if (!pr) return [];
    return pr.systems.map((s) => ({
      system: s.system,
      key: s.key,
      score: s.score,
      evidence: s.evidence,
      blockers: s.blockers,
    }));
  }

  // ─── dimensionReadiness() ─────────────────────────────────────────────────

  /**
   * 10-dimension readiness (architecture/infra/security/merchant/customer/revenue/
   * telemetry/ops/deploy/cost) from production-readiness-v2.json.
   */
  dimensionReadiness(): DimensionReadiness[] {
    const pr2 = loadProductionReadinessV2(this.store);
    if (!pr2) return [];
    return pr2.dimensions.map((d) => ({
      dimension: d.dimension,
      score: d.score,
      evidence: d.evidence,
      ...(d.note !== undefined ? { note: d.note } : {}),
    }));
  }

  // ─── scaleTiers() ───────────────────────────────────────────────────────────

  /**
   * Scale tier levers from decision-engine-v2.json blocksScale.
   * Structural observations only — capacity numbers carry "requires a load test".
   */
  scaleTiers(): ScaleTiers {
    const d2 = loadDecisionEngineV2(this.store);
    if (d2?.blocksScale) {
      return {
        blocks100Merchants: d2.blocksScale.blocks100Merchants,
        blocks10kUsers: d2.blocksScale.blocks10kUsers,
        blocks100kConcurrentUsers: d2.blocksScale.blocks100kConcurrentUsers,
        blocks1000Merchants: d2.blocksScale.blocks1000Merchants,
        blocks10000Merchants: d2.blocksScale.blocks10000Merchants,
      };
    }

    // Fallback: structural-only stubs that satisfy the honesty contract
    return {
      blocks100Merchants: [
        'Merchant onboarding completeness — all blockers must be resolved',
        'NOTE: capacity thresholds require a load test against staging, not derivable from the repo.',
      ],
      blocks10kUsers: [
        'Postgres connection pool sizing (Hyperdrive binding)',
        'NOTE: concrete ceiling requires a load test.',
      ],
      blocks100kConcurrentUsers: [
        'Single Supabase Postgres SPOF — read replicas required',
        'NOTE: capacity numbers require a load test against staging.',
      ],
      blocks1000Merchants: [
        'Shared-schema multi-tenancy compute ceiling',
        'NOTE: the exact merchant ceiling requires a load test against staging.',
      ],
      blocks10000Merchants: [
        'Partitioning/sharding by site_id required at this scale',
        'NOTE: the exact merchant ceiling requires a load test against staging.',
      ],
    };
  }

  // ─── launchVerdict() ─────────────────────────────────────────────────────────

  /**
   * Launch verdict derived from open blocker count + certification docs.
   * NO-GO while any 🔴 blocker is open.
   */
  launchVerdict(): LaunchVerdict {
    const exec = loadExecutionIntel(this.store);
    const pr = loadProductionReadiness(this.store);
    const pr2 = loadProductionReadinessV2(this.store);

    const openIds = exec ? openBlockerIds(exec) : new Set<string>();
    const openBlockers = openIds.size;

    // Has any critical (🔴) blocker open?
    const hasCritical =
      exec?.blockers.some(
        (b) => openIds.has(b.id) && (b.severity === '🔴' || b.severity === 'critical'),
      ) ?? false;

    const verdict =
      openBlockers === 0
        ? 'GO'
        : hasCritical
          ? 'NO-GO'
          : 'CONDITIONAL-GO';

    const overallReadiness =
      pr2?.summary?.overall ?? pr?.summary?.overall ?? 0;

    const certDocs = exec?.verdicts ?? [];

    return {
      verdict,
      openBlockers,
      overallReadiness,
      certificationDocs: certDocs.map((v) => ({ doc: v.doc, verdict: v.verdict })),
    };
  }
}
