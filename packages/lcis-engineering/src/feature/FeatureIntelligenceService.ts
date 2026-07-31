/**
 * FeatureIntelligenceService — EINS Phase 7.
 *
 * Maps a FeatureRequest → EngineeringImpact by COMPOSING lcis-execution's EisEngine
 * (eis.analyze). It never reimplements what eis.analyze already does — it normalises
 * the ChangeAnalysis into the EINS vocabulary (EngineeringImpact) and stamps full
 * provenance via the FROZEN foundation builders.
 *
 * READ-ONLY P0 contract: no fetch / child_process / spawn / exec / eval / writeFile /
 * network / DB-write. Deterministic under a fixed clock. No placeholders/mocks/stubs/TODOs.
 */
import { type LcisEngine, getEngine } from '@letbuyy/lcis-core';
import { createEisEngine, type EisEngine } from '@letbuyy/lcis-execution';
import {
  engineering,
  defaultNow,
  EngineeringEvidenceBuilder,
  EngineeringConfidenceCalculator,
  type EngineeringImpact,
  type FeatureRequest,
} from '../shared/index';
import type { Severity } from '../shared/types';

/** RiskLevel (lcis-execution) and Severity (EINS) share the same string values for
 *  critical/high/medium/low. The only Severity-exclusive value is 'info', which never
 *  appears in a ChangeAnalysis risk level. A safe cast is therefore correct. */
function toSeverity(level: string): Severity {
  if (level === 'critical' || level === 'high' || level === 'medium' || level === 'low') return level;
  return 'info';
}

export class FeatureIntelligenceService {
  private readonly eis: EisEngine;
  private readonly ev: EngineeringEvidenceBuilder;
  private readonly conf: EngineeringConfidenceCalculator;

  constructor(
    private readonly core: LcisEngine = getEngine(),
    private readonly now = defaultNow,
  ) {
    this.eis = createEisEngine({ core, now });
    this.ev = new EngineeringEvidenceBuilder();
    this.conf = new EngineeringConfidenceCalculator();
  }

  /**
   * Analyse a feature request and return the normalized EngineeringImpact.
   *
   * Composes eis.analyze() (lcis-execution) — never reimplements it.
   * Honest: when the analysis is unresolved (no seed matched), all affected sets
   * are empty and unresolved=true. No set is fabricated.
   */
  analyzeFeature(req: FeatureRequest): EngineeringImpact {
    const analysis = this.eis.analyze(req);

    // ── Evidence ────────────────────────────────────────────────────────────────
    const evidence = [
      // Mandatory composition citation: which prior system + method was reused.
      this.ev.reuse('lcis-execution', 'eis.analyze', 'feature change surface'),
      // Per-set evidence (only when non-empty to stay honest).
      ...analysis.affected.domains.map((d) =>
        this.ev.domain(d, `domain in feature blast radius`),
      ),
      ...analysis.affected.tables.map((t) =>
        this.ev.table(t, `table in feature blast radius`),
      ),
      ...analysis.affected.rpcs.map((r) =>
        this.ev.rpc(r, `rpc in feature blast radius`),
      ),
      // Forward-evidence from the analysis itself (structural provenance).
      ...analysis.evidence,
    ];

    // ── Confidence ───────────────────────────────────────────────────────────────
    const confidence = this.conf.fromComposed([analysis.confidence]);

    // ── Honest unresolved path ───────────────────────────────────────────────────
    if (analysis.unresolved) {
      return engineering<Omit<EngineeringImpact, 'evidence' | 'confidence' | 'sources' | 'timestamp'>>(
        {
          request: req,
          domains: [],
          services: [],
          apis: [],
          rpcs: [],
          tables: [],
          workers: [],
          queues: [],
          events: [],
          tests: [],
          docs: [],
          complexity: analysis.complexity,
          risk: {
            level: toSeverity(analysis.risk.level),
            money: analysis.risk.money,
            tenant: analysis.risk.tenant,
            drivers: analysis.risk.drivers.map((d) => d.driver),
          },
          unresolved: true,
        },
        { evidence, confidence, now: this.now },
      );
    }

    // ── Resolved path — normalise AffectedSets into EngineeringImpact ───────────
    return engineering<Omit<EngineeringImpact, 'evidence' | 'confidence' | 'sources' | 'timestamp'>>(
      {
        request: req,
        domains: [...analysis.affected.domains],
        services: [...analysis.affected.services],
        apis: [...analysis.affected.apis],
        rpcs: [...analysis.affected.rpcs],
        tables: [...analysis.affected.tables],
        workers: [...analysis.affected.workers],
        queues: [...analysis.affected.queues],
        events: [...analysis.affected.events],
        tests: [...analysis.affected.tests],
        docs: [...analysis.affected.docs],
        complexity: analysis.complexity,
        risk: {
          level: toSeverity(analysis.risk.level),
          money: analysis.risk.money,
          tenant: analysis.risk.tenant,
          drivers: analysis.risk.drivers.map((d) => d.driver),
        },
        unresolved: false,
      },
      { evidence, confidence, now: this.now },
    );
  }
}
