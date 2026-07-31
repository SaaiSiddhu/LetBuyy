/**
 * LCIS V3 Autonomous Operating Loop — LoopStage
 *
 * Reusable stage runner for the 8-stage Observe→Learn loop.
 * Each stage call is timed, error-isolated, and connectivity-honest.
 *
 * StageResult shape:
 *   { stage, subsystem, status:'ok'|'degraded'|'skipped', connected, durationMs, output, summary, error? }
 *
 * @module operating-loop/LoopStage
 */

import { performance } from 'node:perf_hooks';

// ── Stage registry ────────────────────────────────────────────────────────────

/** @type {Array<{name:string, description:string}>} */
export const STAGES = [
  {
    name: 'observe',
    description: 'Collect live signals: health, incidents, anomalies, V1 detection API.',
  },
  {
    name: 'understand',
    description: 'Assemble minimal context and build platform explanation for this cycle.',
  },
  {
    name: 'reason',
    description: 'Synthesise observations + context into hypotheses via reasoning engines.',
  },
  {
    name: 'predict',
    description: 'Forecast structural risks, capacity constraints, and incident likelihood.',
  },
  {
    name: 'recommend',
    description: 'Generate ranked, actionable recommendations from reasoning + predictions.',
  },
  {
    name: 'execute',
    description: 'Run SAFE read-only actions only (health-check, diagnostics, analysis).',
  },
  {
    name: 'verify',
    description: 'Cross-check cycle conclusions for evidence quality and consistency.',
  },
  {
    name: 'learn',
    description: 'Persist learnings to memory + goal engine; close the improvement loop.',
  },
];

/** @type {Set<string>} */
const STAGE_NAMES = new Set(STAGES.map((s) => s.name));

// ── StageResult factory ───────────────────────────────────────────────────────

/**
 * Build a canonical StageResult.
 *
 * @param {object} opts
 * @param {string} opts.stage
 * @param {string} opts.subsystem
 * @param {'ok'|'degraded'|'skipped'} opts.status
 * @param {boolean} opts.connected
 * @param {number} opts.durationMs
 * @param {unknown} opts.output
 * @param {string} opts.summary
 * @param {string} [opts.error]
 * @returns {StageResult}
 */
function makeResult({ stage, subsystem, status, connected, durationMs, output, summary, error }) {
  return { stage, subsystem, status, connected, durationMs, output, summary, ...(error ? { error } : {}) };
}

// ── LoopStage class ───────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   stage: string,
 *   subsystem: string,
 *   status: 'ok'|'degraded'|'skipped',
 *   connected: boolean,
 *   durationMs: number,
 *   output: unknown,
 *   summary: string,
 *   error?: string,
 * }} StageResult
 */

class LoopStage {
  /**
   * Run a stage function and return a canonical StageResult.
   *
   * @param {string} name — one of STAGES[*].name
   * @param {() => Promise<unknown>} fn — async work; return value becomes output
   * @param {{ subsystem?: string, context?: unknown }} [opts]
   * @returns {Promise<StageResult>}
   */
  async run(name, fn, opts = {}) {
    if (!STAGE_NAMES.has(name)) {
      return makeResult({
        stage: name,
        subsystem: opts.subsystem ?? 'unknown',
        status: 'skipped',
        connected: false,
        durationMs: 0,
        output: null,
        summary: `Stage "${name}" is not a recognised stage name.`,
        error: `Unknown stage: ${name}`,
      });
    }

    const subsystem = opts.subsystem ?? name;
    const t0 = performance.now();

    try {
      const output = await fn();
      const durationMs = Math.round(performance.now() - t0);

      // Infer connectivity: an output is considered connected if it is non-null
      // and not explicitly marked NOT CONNECTED.
      const connected = this.#inferConnected(output);

      return makeResult({
        stage: name,
        subsystem,
        status: 'ok',
        connected,
        durationMs,
        output,
        summary: this.#summarise(name, output, connected),
      });
    } catch (err) {
      const durationMs = Math.round(performance.now() - t0);
      return makeResult({
        stage: name,
        subsystem,
        status: 'degraded',
        connected: false,
        durationMs,
        output: null,
        summary: `Stage "${name}" failed: ${err?.message ?? String(err)}`,
        error: err?.message ?? String(err),
      });
    }
  }

  /**
   * Wrap a lazy subsystem call so that import failures degrade gracefully.
   *
   * @template T
   * @param {() => Promise<T>} subsystemCall
   * @param {string} [fallbackSummary]
   * @returns {() => Promise<T | { connected: false, reason: string }>}
   */
  wrap(subsystemCall, fallbackSummary = 'Subsystem unavailable — NOT CONNECTED') {
    return async () => {
      try {
        return await subsystemCall();
      } catch (err) {
        return { connected: false, reason: fallbackSummary, error: err?.message ?? String(err) };
      }
    };
  }

  // ── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Infer whether a stage output represents a live-connected result.
   * Structural intelligence (graph, code) is always CONNECTED.
   * Live telemetry/metrics returned with explicit NOT CONNECTED marker is not.
   *
   * @param {unknown} output
   * @returns {boolean}
   */
  #inferConnected(output) {
    if (output == null) return false;
    if (typeof output !== 'object') return true;
    const obj = /** @type {Record<string,unknown>} */ (output);
    // Explicit connectivity flag
    if ('connected' in obj) return Boolean(obj.connected);
    // Posture / health signals
    if (obj.overall === 'DOWN') return false;
    // Array outputs (e.g. recommendations, predictions)
    if (Array.isArray(output)) return output.length > 0;
    // Treat as connected unless there's a NOT CONNECTED marker
    const raw = JSON.stringify(output);
    if (raw.includes('NOT CONNECTED')) return false;
    return true;
  }

  /**
   * Produce a short human-readable summary for a completed stage.
   *
   * @param {string} stage
   * @param {unknown} output
   * @param {boolean} connected
   * @returns {string}
   */
  #summarise(stage, output, connected) {
    const connTag = connected ? 'CONNECTED' : 'NOT CONNECTED (structural only)';
    if (output == null) return `${stage}: no output — ${connTag}`;

    if (Array.isArray(output)) {
      return `${stage}: ${output.length} item(s) — ${connTag}`;
    }

    if (typeof output === 'object') {
      const obj = /** @type {Record<string,unknown>} */ (output);
      // Health
      if (obj.overall) return `${stage}: overall=${obj.overall} — ${connTag}`;
      // Predictions report
      if (obj.predictions && Array.isArray(obj.predictions)) {
        return `${stage}: ${obj.predictions.length} prediction(s) — ${connTag}`;
      }
      // Recommendations
      if (obj.recommendations && Array.isArray(obj.recommendations)) {
        return `${stage}: ${obj.recommendations.length} recommendation(s) — ${connTag}`;
      }
      // Verification report
      if (obj.verifications && Array.isArray(obj.verifications)) {
        return `${stage}: ${obj.verifications.length} verification(s) — ${connTag}`;
      }
      // Reasoning result
      if (obj.hypothesis) {
        const hyp = String(obj.hypothesis).slice(0, 80);
        return `${stage}: "${hyp}…" — ${connTag}`;
      }
      // Generic key count
      const keys = Object.keys(obj).length;
      return `${stage}: ${keys} field(s) — ${connTag}`;
    }

    return `${stage}: ${String(output).slice(0, 120)} — ${connTag}`;
  }
}

export default LoopStage;
