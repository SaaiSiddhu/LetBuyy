/**
 * QualityScoreService — deterministic composite quality scorer (PURE, no injected clock).
 *
 * Applies the QUALITY_RULES (QA01..QA08) penalty model to CONNECTED structural signals
 * and emits a QualityScore, QualityHealth, and advisory-only recommendations.
 *
 * HARD RULES enforced here:
 *  - PURE: no constructor arguments (no LcisEngine, no clock injection).
 *  - READ-ONLY: no fetch, no exec, no fs, no DB.
 *  - DETERMINISTIC: given the same input, always the same output.
 *  - ADVISORY: every recommendation has advisory:true.
 *  - Honesty: coverage/mutation/flaky values are NOT_CONNECTED — always emits QA07 advisory
 *    when !coverageConnected.
 */
import { evidence, notConnected } from '@letbuyy/lcis-core';
import { QUALITY_RULES } from '../shared/rules';
import type {
  ArchitectureQuality,
  ApiQuality,
  Complexity,
  DocQuality,
  QualityFinding,
  QualityHealth,
  QualityRecommendation,
  QualityScore,
  TechDebtItem,
} from '../shared/types';

export interface QualityScoreInput {
  readonly coverageGaps: readonly QualityFinding[];
  readonly architecture: ArchitectureQuality;
  readonly complexity: Complexity;
  readonly techDebt: readonly TechDebtItem[];
  readonly docs: DocQuality;
  readonly api: ApiQuality;
  readonly coverageConnected: boolean;
}

// ── Internal helpers ───────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function bandFromScore(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 85) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'fair';
  return 'poor';
}

function healthFromScore(score: number): 'healthy' | 'degraded' | 'failing' {
  if (score >= 80) return 'healthy';
  if (score >= 50) return 'degraded';
  return 'failing';
}

/** True when this DocQuality is NOT_CONNECTED. */
function isDocNotConnected(docs: DocQuality): boolean {
  return docs.connection === 'NOT_CONNECTED';
}

/** True when this ApiQuality is NOT_CONNECTED. */
function isApiNotConnected(api: ApiQuality): boolean {
  return api.connection === 'NOT_CONNECTED';
}

// ── QualityScoreService ────────────────────────────────────────────────────────

export class QualityScoreService {
  /** Pure constructor — no dependencies. */
  constructor() {}

  score(input: QualityScoreInput): {
    score: QualityScore;
    health: QualityHealth;
    recommendations: readonly QualityRecommendation[];
  } {
    const qa01 = QUALITY_RULES.find((r) => r.id === 'QA01')!;
    const qa02 = QUALITY_RULES.find((r) => r.id === 'QA02')!;
    const qa03 = QUALITY_RULES.find((r) => r.id === 'QA03')!;
    const qa04 = QUALITY_RULES.find((r) => r.id === 'QA04')!;
    const qa05 = QUALITY_RULES.find((r) => r.id === 'QA05')!;
    const qa06 = QUALITY_RULES.find((r) => r.id === 'QA06')!;
    const qa07 = QUALITY_RULES.find((r) => r.id === 'QA07')!;
    const qa08 = QUALITY_RULES.find((r) => r.id === 'QA08')!;

    // ── Penalty calculation ────────────────────────────────────────────────────

    // QA01: coverage gaps (cap 24)
    const penQA01 = clamp(input.coverageGaps.length * qa01.weight, 0, 24);

    // QA02: dependency cycles (cap 21)
    const penQA02 = clamp(input.architecture.cycleCount * qa02.weight, 0, 21);

    // QA04: SPOFs (cap 21)
    const penQA04 = clamp(input.architecture.spofCount * qa04.weight, 0, 21);

    // QA03: high-complexity entries (band === 'poor', cap 15)
    const poorCount = input.complexity.entries.filter((e) => e.band === 'poor').length;
    const penQA03 = clamp(poorCount * qa03.weight, 0, 15);

    // QA06: tech debt high-severity (cap 15)
    const highDebtCount = input.techDebt.filter(
      (d) => d.severity === 'critical' || d.severity === 'high',
    ).length;
    const penQA06 = clamp(highDebtCount * qa06.weight, 0, 15);

    // QA05: docs ratio < 0.5 -> flat weight penalty
    const penQA05 = input.docs.ratio < 0.5 ? qa05.weight : 0;

    // QA08: api findings (cap 12)
    const penQA08 = clamp(input.api.findings.length * qa08.weight, 0, 12);

    const sumPenalties = penQA01 + penQA02 + penQA03 + penQA04 + penQA05 + penQA06 + penQA08;
    const rawScore = clamp(100 - sumPenalties, 0, 100);

    // ── Band ───────────────────────────────────────────────────────────────────

    const band = bandFromScore(rawScore);

    // ── Components map ─────────────────────────────────────────────────────────

    const components: Record<string, number> = {};
    if (penQA01 > 0) components['QA01'] = penQA01;
    if (penQA02 > 0) components['QA02'] = penQA02;
    if (penQA03 > 0) components['QA03'] = penQA03;
    if (penQA04 > 0) components['QA04'] = penQA04;
    if (penQA05 > 0) components['QA05'] = penQA05;
    if (penQA06 > 0) components['QA06'] = penQA06;
    if (penQA08 > 0) components['QA08'] = penQA08;

    // ── Connected / not-connected signal counts ────────────────────────────────

    let connectedSignals = 0;
    let notConnectedSignals = 0;

    // Architecture and complexity are always CONNECTED (structural)
    if (input.architecture.connection === 'CONNECTED') connectedSignals++;
    if (input.complexity.connection === 'CONNECTED') connectedSignals++;
    // Docs
    if (input.docs.connection === 'CONNECTED') connectedSignals++;
    if (isDocNotConnected(input.docs)) notConnectedSignals++;
    // API
    if (input.api.connection === 'CONNECTED') connectedSignals++;
    if (isApiNotConnected(input.api)) notConnectedSignals++;
    // Coverage values (structural gaps count as CONNECTED signal even when % is NOT_CONNECTED)
    if (!input.coverageConnected) {
      notConnectedSignals++;
    } else {
      connectedSignals++;
    }

    // ── QualityScore ───────────────────────────────────────────────────────────

    const qualityScore: QualityScore = {
      score: rawScore,
      band,
      components,
      connectedSignals,
      notConnectedSignals,
    };

    // ── QualityHealth ──────────────────────────────────────────────────────────

    let healthBand: 'healthy' | 'degraded' | 'failing' | 'unknown';
    let healthScore: number | null;

    if (connectedSignals === 0) {
      healthBand = 'unknown';
      healthScore = null;
    } else {
      healthBand = healthFromScore(rawScore);
      healthScore = rawScore;
    }

    const qualityHealth: QualityHealth = {
      band: healthBand,
      score: healthScore,
      connectedSignals,
      notConnectedSignals,
    };

    // ── Recommendations ────────────────────────────────────────────────────────

    const recs: QualityRecommendation[] = [];

    // QA01 — coverage gaps
    if (penQA01 > 0) {
      const firstGap = input.coverageGaps[0];
      recs.push({
        id: 'QA01-rec',
        rule: 'QA01',
        advisory: true,
        action: `Consider improving ${qa01.title}`,
        rationale: `${input.coverageGaps.length} coverage gap(s) contribute a penalty of ${penQA01} point(s).`,
        severity: qa01.severity,
        evidence: firstGap
          ? [...firstGap.evidence].slice(0, 2)
          : [evidence('artifact-field', 'coverage-gaps', `${input.coverageGaps.length} gap(s)`, 'lcis-quality:score')],
      });
    }

    // QA02 — dependency cycles
    if (penQA02 > 0) {
      const firstFinding = input.architecture.findings.find((f) => f.rule === 'QA02');
      recs.push({
        id: 'QA02-rec',
        rule: 'QA02',
        advisory: true,
        action: `Consider improving ${qa02.title}`,
        rationale: `${input.architecture.cycleCount} dependency cycle(s) contribute a penalty of ${penQA02} point(s).`,
        severity: qa02.severity,
        evidence: firstFinding
          ? [...firstFinding.evidence].slice(0, 2)
          : [evidence('artifact-field', 'architecture-cycles', `${input.architecture.cycleCount} cycle(s)`, 'lcis-quality:score')],
      });
    }

    // QA03 — high-complexity hotspots
    if (penQA03 > 0) {
      recs.push({
        id: 'QA03-rec',
        rule: 'QA03',
        advisory: true,
        action: `Consider improving ${qa03.title}`,
        rationale: `${poorCount} high-complexity hotspot(s) (poor band) contribute a penalty of ${penQA03} point(s).`,
        severity: qa03.severity,
        evidence: [evidence('artifact-field', 'complexity-poor', `${poorCount} poor-band entr(ies)`, 'lcis-quality:score')],
      });
    }

    // QA04 — SPOFs
    if (penQA04 > 0) {
      const firstFinding = input.architecture.findings.find((f) => f.rule === 'QA04');
      recs.push({
        id: 'QA04-rec',
        rule: 'QA04',
        advisory: true,
        action: `Consider improving ${qa04.title}`,
        rationale: `${input.architecture.spofCount} SPOF(s) contribute a penalty of ${penQA04} point(s).`,
        severity: qa04.severity,
        evidence: firstFinding
          ? [...firstFinding.evidence].slice(0, 2)
          : [evidence('artifact-field', 'architecture-spof', `${input.architecture.spofCount} SPOF(s)`, 'lcis-quality:score')],
      });
    }

    // QA05 — docs gap
    if (penQA05 > 0) {
      const firstFinding = input.docs.findings[0];
      recs.push({
        id: 'QA05-rec',
        rule: 'QA05',
        advisory: true,
        action: `Consider improving ${qa05.title}`,
        rationale: `Doc ratio ${(input.docs.ratio * 100).toFixed(0)}% is below 50% — penalty of ${penQA05} point(s).`,
        severity: qa05.severity,
        evidence: firstFinding
          ? [...firstFinding.evidence].slice(0, 2)
          : [evidence('artifact-field', 'doc-ratio', `ratio ${input.docs.ratio}`, 'lcis-quality:score')],
      });
    }

    // QA06 — tech debt hotspots
    if (penQA06 > 0) {
      const firstDebt = input.techDebt.find((d) => d.severity === 'critical' || d.severity === 'high');
      recs.push({
        id: 'QA06-rec',
        rule: 'QA06',
        advisory: true,
        action: `Consider improving ${qa06.title}`,
        rationale: `${highDebtCount} high-severity tech-debt hotspot(s) contribute a penalty of ${penQA06} point(s).`,
        severity: qa06.severity,
        evidence: firstDebt
          ? [...firstDebt.evidence].slice(0, 2)
          : [evidence('artifact-field', 'tech-debt-high', `${highDebtCount} item(s)`, 'lcis-quality:score')],
      });
    }

    // QA08 — API typing gaps
    if (penQA08 > 0) {
      const firstFinding = input.api.findings[0];
      recs.push({
        id: 'QA08-rec',
        rule: 'QA08',
        advisory: true,
        action: `Consider improving ${qa08.title}`,
        rationale: `${input.api.findings.length} API typing gap(s) contribute a penalty of ${penQA08} point(s).`,
        severity: qa08.severity,
        evidence: firstFinding
          ? [...firstFinding.evidence].slice(0, 2)
          : [evidence('artifact-field', 'api-findings', `${input.api.findings.length} finding(s)`, 'lcis-quality:score')],
      });
    }

    // QA07 — ALWAYS emit when coverage is not connected (info advisory)
    if (!input.coverageConnected) {
      recs.push({
        id: 'QA07-rec',
        rule: 'QA07',
        advisory: true,
        action: `Consider improving ${qa07.title}`,
        rationale: 'Coverage/mutation/flaky values are NOT_CONNECTED — measure coverage before scoring numerically.',
        severity: qa07.severity,
        evidence: [
          notConnected('coverage-values', 'CI_COVERAGE_REPORT'),
        ],
      });
    }

    // Sort: severity order then id (critical > high > medium > low > info)
    const SEV_ORDER: Record<string, number> = {
      critical: 0,
      high: 1,
      medium: 2,
      low: 3,
      info: 4,
    };
    recs.sort((a, b) => {
      const sd = (SEV_ORDER[a.severity] ?? 5) - (SEV_ORDER[b.severity] ?? 5);
      if (sd !== 0) return sd;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    return {
      score: qualityScore,
      health: qualityHealth,
      recommendations: recs,
    };
  }
}
