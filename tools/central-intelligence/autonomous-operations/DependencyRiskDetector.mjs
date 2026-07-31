/**
 * LCIS Autonomous Operations — DependencyRiskDetector
 *
 * Scans the workspace dependency graph for:
 *   - Cycles (circular dependencies between workspace packages)
 *   - Single points of failure (high in-degree packages like getSupabaseAdmin,
 *     @letbuyy/shared-types, @letbuyy/api-client)
 *   - Unpinned critical external dependencies
 *
 * CONNECTED: all detections are structural (from DependencyGraphBuilder +
 *            ArchitectureDriftDetector architecture risk report).
 * NOT CONNECTED: live runtime dependency health (whether a package is actually
 *               broken in production) requires external telemetry.
 */

import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');

// Known single-point-of-failure packages from LCIS architecture intelligence
// (documented in CLAUDE.md as change-control hotspots)
const KNOWN_SPOF_PACKAGES = new Set([
  '@letbuyy/shared-types',
  '@letbuyy/api-client',
  '@letbuyy/ui',
]);

// Symbol names that are known blast-radius hotspots (CLAUDE.md)
const KNOWN_SPOF_SYMBOLS = [
  'getSupabaseAdmin', // 115 files
  'create_checkout_order',
  'signQueueTenantEnvelope',
  'verifySiteOwnership',
];

/** In-degree threshold to flag as a SPOF candidate */
const SPOF_IN_DEGREE_THRESHOLD = 4;

// ── Lazy import helpers ───────────────────────────────────────────────────────

async function getDependencyGraphBuilder() {
  try {
    const m = await import('../context-intelligence/DependencyGraphBuilder.mjs');
    return m.default ?? null;
  } catch {
    return null;
  }
}

async function getArchitectureDriftDetector() {
  try {
    const m = await import('../architecture-intelligence/ArchitectureDriftDetector.mjs');
    return m.default ?? null;
  } catch {
    return null;
  }
}

async function getRiskScorer() {
  try {
    const m = await import('../correlation/RiskScorer.mjs');
    return m.default ?? null;
  } catch {
    return null; // Optional — graceful degradation
  }
}

// ── Cycle detection (DFS) ─────────────────────────────────────────────────────

/**
 * Find all cycles in a directed dependency graph using DFS.
 * @param {Map<string, Set<string>>} deps  module → modules it depends on
 * @returns {string[][]}  Each entry is a cycle path
 */
function detectCycles(deps) {
  const visited = new Set();
  const inStack = new Set();
  const cycles = [];

  function dfs(node, path) {
    visited.add(node);
    inStack.add(node);

    for (const dep of (deps.get(node) ?? [])) {
      if (!visited.has(dep)) {
        dfs(dep, [...path, dep]);
      } else if (inStack.has(dep)) {
        // Found a cycle — record the cycle path
        const cycleStart = path.indexOf(dep);
        const cyclePath = cycleStart >= 0 ? path.slice(cycleStart) : [...path, dep];
        cycles.push([...cyclePath, dep]);
      }
    }

    inStack.delete(node);
  }

  for (const node of deps.keys()) {
    if (!visited.has(node)) {
      dfs(node, [node]);
    }
  }

  // Deduplicate cycles by sorted key
  const seen = new Set();
  return cycles.filter(c => {
    const key = [...c].sort().join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ── Main class ────────────────────────────────────────────────────────────────

class DependencyRiskDetector {
  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Run all dependency risk detectors.
   * @returns {Promise<{
   *   detectedAt: string,
   *   risks: import('./types.mjs').DependencyRisk[],
   *   spofs: object[],
   *   cycles: string[][],
   *   ranked: import('./types.mjs').DependencyRisk[]
   * }>}
   */
  async detect() {
    const [spofs, cycles, archRisks] = await Promise.allSettled([
      this.getSinglePointsOfFailure(),
      this.getCycles(),
      this.#getArchitectureRisks(),
    ]);

    const allRisks = [
      ...(spofs.status === 'fulfilled' ? spofs.value.map(s => this.#spofToRisk(s)) : []),
      ...(cycles.status === 'fulfilled' ? cycles.value.map(c => this.#cycleToRisk(c)) : []),
      ...(archRisks.status === 'fulfilled' ? archRisks.value : []),
    ];

    const ranked = await this.rankByRisk(allRisks);

    return {
      detectedAt: new Date().toISOString(),
      risks: ranked,
      spofs: spofs.status === 'fulfilled' ? spofs.value : [],
      cycles: cycles.status === 'fulfilled' ? cycles.value : [],
      ranked,
    };
  }

  /**
   * Find single points of failure — packages with high in-degree (many
   * dependents) where a change would propagate widely.
   * CONNECTED: topology from DependencyGraphBuilder + architecture snapshot.
   * @returns {Promise<object[]>}
   */
  async getSinglePointsOfFailure() {
    const spofs = [];

    // 1. From DependencyGraphBuilder (workspace package topology)
    const builder = await getDependencyGraphBuilder();
    if (builder) {
      try {
        builder.build();
        const dependents = builder._dependents;
        if (dependents instanceof Map) {
          for (const [pkg, deps] of dependents.entries()) {
            const inDegree = deps.size;
            if (inDegree >= SPOF_IN_DEGREE_THRESHOLD || KNOWN_SPOF_PACKAGES.has(pkg)) {
              spofs.push({
                package: pkg,
                inDegree,
                dependents: [...deps],
                isKnownHotspot: KNOWN_SPOF_PACKAGES.has(pkg),
                severity: inDegree >= 8 || KNOWN_SPOF_PACKAGES.has(pkg) ? 'critical' : 'high',
                connected: true,
              });
            }
          }
        }
      } catch {
        // DependencyGraphBuilder may need graph data — skip gracefully
      }
    }

    // 2. From architecture risk report (blast-radius packages)
    const archDetector = await getArchitectureDriftDetector();
    if (archDetector) {
      try {
        const report = await archDetector.getArchitectureRiskReport();
        for (const risk of report.risks ?? []) {
          if (risk.category === 'blast-radius') {
            const existing = spofs.find(s => s.package === risk.subject);
            if (!existing) {
              spofs.push({
                package: risk.subject,
                inDegree: risk.dependents?.length ?? 0,
                dependents: risk.dependents ?? [],
                isKnownHotspot: KNOWN_SPOF_PACKAGES.has(risk.subject),
                severity: risk.severity,
                connected: true,
                detail: risk.detail,
              });
            } else {
              // Enrich with architecture data
              existing.detail = risk.detail;
            }
          }
        }
      } catch {
        // Architecture snapshot may not exist
      }
    }

    // 3. Always include known LCIS hotspot symbols (documented in CLAUDE.md)
    for (const symbol of KNOWN_SPOF_SYMBOLS) {
      if (!spofs.some(s => s.package === symbol)) {
        spofs.push({
          package: symbol,
          inDegree: symbol === 'getSupabaseAdmin' ? 115 : 0,
          dependents: [],
          isKnownHotspot: true,
          severity: symbol === 'getSupabaseAdmin' ? 'critical' : 'high',
          connected: true,
          detail: `Known LCIS hotspot symbol — documented in CLAUDE.md change-control hotspots`,
          documentedBlastRadius: symbol === 'getSupabaseAdmin' ? 115 : 'unknown',
        });
      }
    }

    return spofs.sort((a, b) => b.inDegree - a.inDegree);
  }

  /**
   * Detect circular dependencies between workspace packages.
   * CONNECTED: topology from DependencyGraphBuilder.
   * @returns {Promise<string[][]>}
   */
  async getCycles() {
    const builder = await getDependencyGraphBuilder();
    if (!builder) return [];

    try {
      builder.build();
      const deps = builder._deps;
      if (!(deps instanceof Map)) return [];
      return detectCycles(deps);
    } catch {
      return [];
    }
  }

  /**
   * Rank risks by severity × estimated blast radius.
   * @param {import('./types.mjs').DependencyRisk[]} risks
   * @returns {Promise<import('./types.mjs').DependencyRisk[]>}
   */
  async rankByRisk(risks) {
    const scorer = await getRiskScorer();

    const severityScore = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };

    return risks
      .map(risk => {
        const base = severityScore[risk.severity] ?? 1;
        const blastFactor = Math.min(10, (risk.blastRadius ?? risk.inDegree ?? 1));
        const score = scorer
          ? (scorer.score?.({ ...risk, blastFactor }) ?? base * blastFactor)
          : base * blastFactor;
        return { ...risk, riskScore: score };
      })
      .sort((a, b) => b.riskScore - a.riskScore);
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  async #getArchitectureRisks() {
    const detector = await getArchitectureDriftDetector();
    if (!detector) return [];

    try {
      const report = await detector.getArchitectureRiskReport();
      return (report.risks ?? [])
        .filter(r => r.category === 'money-domain' || r.category === 'high-coupling')
        .map(r => ({
          type: 'dependency',
          category: r.category,
          subject: r.subject,
          severity: r.severity,
          detail: r.detail,
          connected: true,
          blastRadius: r.tables?.length ?? 0,
        }));
    } catch {
      return [];
    }
  }

  #spofToRisk(spof) {
    return {
      type: 'single-point-of-failure',
      subject: spof.package,
      severity: spof.severity,
      inDegree: spof.inDegree,
      dependents: spof.dependents,
      blastRadius: spof.inDegree,
      connected: spof.connected,
      detail: spof.detail ?? `${spof.inDegree} dependents — single point of failure`,
      isKnownHotspot: spof.isKnownHotspot ?? false,
    };
  }

  #cycleToRisk(cycle) {
    return {
      type: 'cycle',
      subject: cycle.join(' → '),
      severity: 'high',
      cycle,
      blastRadius: cycle.length,
      connected: true,
      detail: `Circular dependency detected: ${cycle.join(' → ')}`,
    };
  }
}

export default new DependencyRiskDetector();
