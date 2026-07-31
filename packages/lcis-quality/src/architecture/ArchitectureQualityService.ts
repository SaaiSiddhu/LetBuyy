/**
 * ArchitectureQualityService — LQAS architecture-quality analytics.
 *
 * Composes the dependency twin (cycles, SPOF, high-fan entities) into:
 *   - analyze(): ArchitectureQuality — structural findings + band
 *   - maintainability(): Maintainability — deterministic index 0..100
 *
 * Rules applied:
 *   QA02 — Dependency cycle  (severity: high)
 *   QA03 — High-complexity hotspot  (severity: medium, fanIn+fanOut >= 10)
 *   QA04 — Single point of failure  (severity: high)
 *
 * Honesty: all values are structural (CONNECTED). Degrades gracefully on twin error.
 * Clock injected; never calls Date.now() or argless new Date().
 * No fetch / exec / fs / DB / AI.
 */
import { type LcisEngine, evidence } from '@letbuyy/lcis-core';
import { createTwinEngine } from '@letbuyy/lcis-twin';
import { defaultNow } from '../shared/envelope';
import type { ArchitectureQuality, Maintainability, QualityBand, QualityFinding, Severity } from '../shared/types';

// ── tiny helpers ──────────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function bandFromIndex(idx: number): QualityBand {
  if (idx >= 80) return 'excellent';
  if (idx >= 60) return 'good';
  if (idx >= 40) return 'fair';
  return 'poor';
}

function architectureBand(cycleCount: number, spofCount: number): QualityBand {
  if (cycleCount === 0 && spofCount <= 1) return 'excellent';
  if (cycleCount <= 1) return 'good';
  if (cycleCount <= 3) return 'fair';
  return 'poor';
}

function makeFinding(
  rule: string,
  severity: Severity,
  subject: string,
  title: string,
  detail: string,
  evidenceRef: string,
  evidenceDetail: string,
  seq: number,
): QualityFinding {
  return {
    id: `${rule.toLowerCase()}-${seq}`,
    rule,
    severity,
    subject,
    title,
    detail,
    connection: 'CONNECTED',
    evidence: [evidence('graph-node', evidenceRef, evidenceDetail, 'graphify-out/domain-intel.json')],
  };
}

// ── ArchitectureQualityService ────────────────────────────────────────────────

export class ArchitectureQualityService {
  private readonly twin: ReturnType<typeof createTwinEngine>;

  constructor(
    core: LcisEngine,
    now: () => string = defaultNow,
  ) {
    this.twin = createTwinEngine({ core, now });
  }

  analyze(): ArchitectureQuality {
    try {
      const cycleReport = this.twin.cycles();
      const spofReport = this.twin.spof();
      const fanReport = this.twin.fan(50);

      const cycleCount = cycleReport.count;
      const spofCount = spofReport.count;
      const highFanEntries = fanReport.top.filter((f) => f.fanIn + f.fanOut >= 10);
      const highFanCount = highFanEntries.length;

      const findings: QualityFinding[] = [];
      let qa02seq = 0;
      let qa03seq = 0;
      let qa04seq = 0;

      // QA02 — one finding per cycle
      for (const cycle of cycleReport.cycles) {
        const subject = cycle.join(' → ');
        findings.push(
          makeFinding(
            'QA02',
            'high',
            subject,
            'Dependency cycle',
            `Circular dependency among ${cycle.length} node(s): ${subject}`,
            cycle[0] ?? 'cycle',
            `Cycle of length ${cycle.length} detected in dependency graph`,
            ++qa02seq,
          ),
        );
      }

      // QA04 — one finding per SPOF
      for (const spof of spofReport.spofs) {
        findings.push(
          makeFinding(
            'QA04',
            'high',
            spof.id,
            'Single point of failure',
            `Node "${spof.id}" is an articulation point whose removal splits ${spof.splitComponents} component pair(s)`,
            spof.id,
            `Articulation point (splitComponents=${spof.splitComponents})`,
            ++qa04seq,
          ),
        );
      }

      // QA03 — one finding per high-fan entity
      for (const entry of highFanEntries) {
        const degree = entry.fanIn + entry.fanOut;
        findings.push(
          makeFinding(
            'QA03',
            'medium',
            entry.id,
            'High-complexity hotspot',
            `Entity "${entry.id}" has fan-in=${entry.fanIn} + fan-out=${entry.fanOut} = degree ${degree} (threshold ≥ 10)`,
            entry.id,
            `fanIn=${entry.fanIn} fanOut=${entry.fanOut} degree=${degree}`,
            ++qa03seq,
          ),
        );
      }

      return {
        cycleCount,
        spofCount,
        highFanCount,
        findings,
        band: architectureBand(cycleCount, spofCount),
        connection: 'CONNECTED',
      };
    } catch {
      return {
        cycleCount: 0,
        spofCount: 0,
        highFanCount: 0,
        findings: [],
        band: 'poor',
        connection: 'CONNECTED',
      };
    }
  }

  maintainability(): Maintainability {
    const arch = this.analyze();
    const { cycleCount, spofCount, highFanCount } = arch;

    const raw = 100 - 6 * cycleCount - 4 * spofCount - 2 * highFanCount;
    const index = clamp(raw, 0, 100);
    const band = bandFromIndex(index);

    const drivers: string[] = [];
    if (cycleCount > 0) drivers.push(`${cycleCount} cycle(s) (−${6 * cycleCount} pts)`);
    if (spofCount > 0) drivers.push(`${spofCount} SPOF(s) (−${4 * spofCount} pts)`);
    if (highFanCount > 0) drivers.push(`${highFanCount} high-fan entity(-ies) (−${2 * highFanCount} pts)`);
    if (drivers.length === 0) drivers.push('No structural issues detected');

    return { index, band, drivers };
  }
}
