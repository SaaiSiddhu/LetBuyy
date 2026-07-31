/**
 * LCIS Context Intelligence — ContextHealthMonitor
 *
 * Monitors the freshness and validity of the Context Intelligence artefacts.
 * Key concern: if graph.json has been regenerated (graphify update .) but the
 * derived cache files haven't been rebuilt, they are STALE and must be
 * refreshed before an AI can rely on them.
 *
 * Can be executed directly:
 *   node tools/central-intelligence/context-intelligence/ContextHealthMonitor.mjs
 */

import { existsSync, statSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import diagnostics from './ContextDiagnostics.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../../');
const OUT_DIR = resolve(REPO_ROOT, 'graphify-out/context-intelligence');
const GRAPH_JSON = resolve(REPO_ROOT, 'graphify-out/graph.json');

const ARTIFACTS = {
  repoGraph: resolve(OUT_DIR, 'repo-file-graph.json'),
  depGraph: resolve(OUT_DIR, 'dependency-graph.json'),
  archGraph: resolve(OUT_DIR, 'architecture-graph.json'),
  ranking: resolve(OUT_DIR, 'importance-ranking.json'),
};

/** Default max age for artefacts relative to graph.json (24 hours in ms) */
const DEFAULT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

function mtimeMs(p) {
  try { return existsSync(p) ? statSync(p).mtimeMs : null; } catch { return null; }
}

function mtimeIso(p) {
  const ms = mtimeMs(p);
  return ms ? new Date(ms).toISOString() : null;
}

class ContextHealthMonitor {
  /**
   * Returns a combined health report from ContextDiagnostics, enriched with
   * freshness checks.
   */
  getHealth() {
    const base = diagnostics.getHealth();
    const freshness = this.checkFreshness(DEFAULT_MAX_AGE_MS);
    return {
      ...base,
      freshness,
      recommendRebuild: this.recommendRebuild(),
    };
  }

  /**
   * Check whether the derived artefacts are fresh relative to graph.json.
   *
   * An artefact is STALE if:
   *   • It doesn't exist, OR
   *   • graph.json is newer than the artefact by more than `maxAgeMs`
   *
   * @param {number} [maxAgeMs]
   * @returns {{
   *   graphMtime: string|null,
   *   stale: boolean,
   *   artifacts: Record<string, {mtime:string|null, stale:boolean, ageDiffMs:number|null}>
   * }}
   */
  checkFreshness(maxAgeMs = DEFAULT_MAX_AGE_MS) {
    const graphMtimeMs = mtimeMs(GRAPH_JSON);
    const graphMtime = graphMtimeMs ? new Date(graphMtimeMs).toISOString() : null;

    const artifactDetails = {};
    let anyStale = false;

    for (const [key, path] of Object.entries(ARTIFACTS)) {
      const artMtimeMs = mtimeMs(path);
      const artMtime = artMtimeMs ? new Date(artMtimeMs).toISOString() : null;

      let stale = false;
      let ageDiffMs = null;

      if (!artMtimeMs) {
        stale = true; // missing → stale
      } else if (graphMtimeMs) {
        ageDiffMs = artMtimeMs - graphMtimeMs; // negative means graph is newer
        stale = ageDiffMs < -maxAgeMs;
      }

      if (stale) anyStale = true;
      artifactDetails[key] = { mtime: artMtime, stale, ageDiffMs };
    }

    return {
      graphMtime,
      stale: anyStale,
      maxAgeMs,
      artifacts: artifactDetails,
    };
  }

  /**
   * Snapshot of runtime metrics useful for monitoring dashboards.
   * @returns {{
   *   subsystem: string,
   *   timestamp: string,
   *   graphPresent: boolean,
   *   graphSizeBytes: number|null,
   *   artifactCount: number,
   *   artifactsPresent: number,
   *   staleness: boolean
   * }}
   */
  getMetrics() {
    const graphPresent = existsSync(GRAPH_JSON);
    const graphSizeBytes = graphPresent ? statSync(GRAPH_JSON).size : null;
    let artifactsPresent = 0;
    for (const path of Object.values(ARTIFACTS)) {
      if (existsSync(path)) artifactsPresent++;
    }
    const { stale } = this.checkFreshness();

    return {
      subsystem: 'context-intelligence',
      timestamp: new Date().toISOString(),
      graphPresent,
      graphSizeBytes,
      artifactCount: Object.keys(ARTIFACTS).length,
      artifactsPresent,
      staleness: stale,
    };
  }

  /**
   * Returns whether a rebuild of the derived artefacts is recommended.
   * @returns {{ rebuild: boolean, reason: string }}
   */
  recommendRebuild() {
    const graphPresent = existsSync(GRAPH_JSON);
    if (!graphPresent) {
      return {
        rebuild: false,
        reason: 'graph.json missing — run graphify update . first, then rebuild artefacts.',
      };
    }

    const freshness = this.checkFreshness();
    if (freshness.stale) {
      const staleKeys = Object.entries(freshness.artifacts)
        .filter(([, v]) => v.stale)
        .map(([k]) => k);
      return {
        rebuild: true,
        reason: `Stale artefacts: ${staleKeys.join(', ')}. Run: node tools/central-intelligence/context-intelligence/build-all.mjs`,
      };
    }

    const { artifactsPresent } = this.getMetrics();
    if (artifactsPresent < Object.keys(ARTIFACTS).length) {
      return {
        rebuild: true,
        reason: `${Object.keys(ARTIFACTS).length - artifactsPresent} artefact(s) missing. Run: node tools/central-intelligence/context-intelligence/build-all.mjs`,
      };
    }

    return { rebuild: false, reason: 'All artefacts present and fresh.' };
  }
}

const monitor = new ContextHealthMonitor();
export default monitor;

// ── CLI entry-point ─────────────────────────────────────────────────────────
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const health = monitor.getHealth();
  console.log(JSON.stringify(health, null, 2));
}
