/**
 * TechDebtService — LQAS Phase 15, technical-debt hotspot analysis.
 *
 * Composes change-tracking (churn) with structural complexity (graph degree)
 * to surface the subjects most likely to become maintenance liabilities.
 *
 *   score = churn × complexity
 *
 * where:
 *   churn      = count of ChangeRecords in the timeline whose subject matches
 *   complexity = core.graph.degree() for the best node id guess; defaults to 1
 *
 * Rule QA06: "Technical-debt hotspot — high churn × complexity subject is a
 * maintenance risk." (severity medium, weight 5)
 *
 * READ ONLY. DETERMINISTIC. No Date.now() / argless new Date(). No network,
 * no FS write, no AI. Injectable clock for provenance. Recommendations advisory.
 */
import { type LcisEngine, evidence } from '@letbuyy/lcis-core';
import { createTrackingEngine } from '@letbuyy/lcis-tracking';
import { defaultNow } from '../shared/envelope';
import type { Severity, TechDebtItem } from '../shared/types';

/** Maximum hotspot items emitted. */
const HOTSPOT_CAP = 30;

/** Minimum score to appear in the result. */
const SCORE_THRESHOLD = 2;

function severity(score: number): Severity {
  if (score >= 20) return 'high';
  if (score >= 8) return 'medium';
  return 'low';
}

/**
 * Try to resolve a subject to a graph-node degree using three id patterns:
 *   1. 'table:<subject>'
 *   2. 'rpc:<subject>'
 *   3. raw subject
 * Returns the first non-zero result, or 1 (honest default — node not in graph).
 */
function resolveDegree(core: LcisEngine, subject: string): number {
  const candidates = [`table:${subject}`, `rpc:${subject}`, subject];
  for (const id of candidates) {
    const d = core.graph.degree(id);
    if (d > 0) return d;
  }
  return 1;
}

export class TechDebtService {
  private readonly trackingEngine: ReturnType<typeof createTrackingEngine>;

  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {
    this.trackingEngine = createTrackingEngine({ core, now });
  }

  /**
   * Return the top-30 technical-debt hotspots (score ≥ 2) sorted by score desc
   * then subject asc. Empty timeline → []. Any error → [].
   */
  hotspots(): readonly TechDebtItem[] {
    try {
      const timeline = this.trackingEngine.generateTimeline();
      const records = timeline.records;

      if (records.length === 0) return [];

      // ── 1. Count churn per subject ─────────────────────────────────────────
      const churnMap = new Map<string, number>();
      for (const r of records) {
        churnMap.set(r.subject, (churnMap.get(r.subject) ?? 0) + 1);
      }

      // ── 2. Build items ─────────────────────────────────────────────────────
      const items: TechDebtItem[] = [];
      for (const [subject, churn] of churnMap) {
        const complexity = resolveDegree(this.core, subject);
        const score = churn * complexity;

        if (score < SCORE_THRESHOLD) continue;

        const sev = severity(score);

        const ev = [
          evidence(
            'artifact-field',
            `lcis-quality:techdebt:${subject}`,
            `churn ${churn} × complexity ${complexity} = score ${score} (${sev})`,
            'graphify-out/memory-intel.json',
          ),
          evidence(
            'graph-node',
            subject,
            `graph degree ${complexity} (node id candidates: table:${subject}, rpc:${subject}, ${subject})`,
            'graphify-out/graph.json',
          ),
        ];

        items.push({ subject, churn, complexity, score, severity: sev, evidence: ev });
      }

      // ── 3. Sort: score desc, then subject asc ─────────────────────────────
      items.sort((a, b) => {
        const sd = b.score - a.score;
        if (sd !== 0) return sd;
        return a.subject.localeCompare(b.subject);
      });

      // ── 4. Cap ────────────────────────────────────────────────────────────
      return items.slice(0, HOTSPOT_CAP);
    } catch {
      return [];
    }
  }
}
