/**
 * LCIS V3 Autonomous Operating Loop — LCISOperatingLoop
 *
 * The continuous brain cycle that makes LCIS a self-improving operating system.
 *
 * Loop: Observe → Understand → Reason → Predict → Recommend → Execute → Verify → Learn
 *
 * Design contracts:
 *   - Every stage is isolated: a failing stage degrades the cycle (status=degraded)
 *     but NEVER aborts the loop.
 *   - EXECUTE stage: only safe, whitelisted read-only actions via ExecutionEngine.
 *   - Live data honesty: structural intelligence is CONNECTED; every live metric
 *     is NOT CONNECTED + exact source until telemetry adapters are wired.
 *   - runOnce() always terminates — no hanging intervals; process can exit normally.
 *   - run(intervalMs) uses setInterval().unref() so the loop does not block process exit.
 *
 * @module operating-loop/LCISOperatingLoop
 */

import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

import LoopStage from './LoopStage.mjs';
import LearningRecorder from './LearningRecorder.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CI_ROOT = join(__dirname, '..');
const REPO_ROOT = join(__dirname, '..', '..', '..');
const LOOP_OUT_DIR = join(REPO_ROOT, 'graphify-out', 'operating-loop');

const V1_BASE = process.env.LCIS_V1_URL ?? 'http://localhost:3333';

// Maximum cycle history kept in-memory.
const MAX_HISTORY = 50;

// ── Lazy subsystem loaders ────────────────────────────────────────────────────
// Each uses Promise.allSettled semantics: a missing subsystem does not crash the cycle.

async function tryLoad(rel) {
  try {
    const m = await import(join(CI_ROOT, rel));
    return m.default ?? m;
  } catch {
    return null;
  }
}

async function tryFetch(path, timeoutMs = 4000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${V1_BASE}${path}`, { signal: controller.signal });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Posture calculator ────────────────────────────────────────────────────────

/**
 * Derive an overall posture from cycle stage results.
 * @param {import('./LoopStage.mjs').StageResult[]} stages
 * @returns {'HEALTHY'|'DEGRADED'|'AT_RISK'|'DOWN'}
 */
function calculatePosture(stages) {
  const degradedCount = stages.filter((s) => s.status === 'degraded').length;
  const total = stages.length;

  if (degradedCount === 0) return 'HEALTHY';
  if (degradedCount <= 1) return 'AT_RISK';
  if (degradedCount <= Math.floor(total / 2)) return 'DEGRADED';
  return 'DOWN';
}

/**
 * Derive a confidence score (0–1) from stage results.
 * @param {import('./LoopStage.mjs').StageResult[]} stages
 * @returns {number}
 */
function calculateConfidence(stages) {
  if (stages.length === 0) return 0;
  const okCount = stages.filter((s) => s.status === 'ok').length;
  return Math.round((okCount / stages.length) * 100) / 100;
}

// ── Safe EXECUTE stage actions ────────────────────────────────────────────────

/**
 * Run exactly two safe, bounded actions through ExecutionEngine.
 * Returns the list of executed actions (with results).
 *
 * @returns {Promise<Array<{action:string,status:string,output:unknown}>>}
 */
async function runSafeExecutions() {
  const engine = await tryLoad('execution-engine/ExecutionEngine.mjs');
  if (!engine?.runHealthCheck) {
    return [{ action: 'run_health_check', status: 'SKIPPED', output: null, reason: 'ExecutionEngine not available' }];
  }

  const results = [];

  // Action 1: health check — always safe, always informative.
  try {
    const r = await engine.runHealthCheck();
    results.push({ action: 'run_health_check', status: r?.status ?? 'SUCCESS', output: r });
  } catch (err) {
    results.push({ action: 'run_health_check', status: 'FAILED', output: null, error: err?.message });
  }

  // Action 2: repository analysis — safe read-only code graph scan.
  try {
    const r = await engine.runRepositoryAnalysis();
    results.push({ action: 'run_repository_analysis', status: r?.status ?? 'SUCCESS', output: r });
  } catch (err) {
    results.push({ action: 'run_repository_analysis', status: 'FAILED', output: null, error: err?.message });
  }

  return results;
}

// ── CycleResult type ──────────────────────────────────────────────────────────

/**
 * @typedef {{
 *   cycleId: string,
 *   startedAt: string,
 *   completedAt: string,
 *   durationMs: number,
 *   stages: import('./LoopStage.mjs').StageResult[],
 *   observations: object,
 *   understanding: object,
 *   reasoning: object,
 *   predictions: object,
 *   recommendations: object,
 *   executions: object[],
 *   verifications: object,
 *   learnings: object[],
 *   posture: 'HEALTHY'|'DEGRADED'|'AT_RISK'|'DOWN',
 *   confidence: number,
 *   artifactPath: string,
 * }} CycleResult
 */

// ── LCISOperatingLoop ─────────────────────────────────────────────────────────

class LCISOperatingLoop {
  constructor() {
    this._runner = new LoopStage();
    /** @type {CycleResult[]} */
    this._history = [];
    this._running = false;
    this._cycleCount = 0;
    this._lastCycleAt = null;
    this._lastPosture = null;
    this._intervalMs = null;
    this._timer = null;
    this._cycleInProgress = false;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Execute one full 8-stage cycle and persist result to disk.
   * Always terminates — never leaves open handles.
   *
   * @returns {Promise<CycleResult>}
   */
  async runOnce() {
    const cycleId = randomUUID();
    const startedAt = new Date().toISOString();
    const t0 = performance.now();

    ensureOutputDir();

    const stages = [];

    // ── Stage 1: OBSERVE ────────────────────────────────────────────────────
    let observations = {};
    {
      const result = await this._runner.run('observe', async () => {
        const [healthMod, incidentMod, anomalyMod, v1Detection] = await Promise.allSettled([
          tryLoad('observability/HealthService.mjs'),
          tryLoad('observability/IncidentDetectionService.mjs'),
          tryLoad('observability/AnomalyDetectionService.mjs'),
          tryFetch('/api/detection'),
        ]);

        const healthSvc   = healthMod.status   === 'fulfilled' ? healthMod.value   : null;
        const incidentSvc = incidentMod.status === 'fulfilled' ? incidentMod.value : null;
        const anomalySvc  = anomalyMod.status  === 'fulfilled' ? anomalyMod.value  : null;
        const detection   = v1Detection.status === 'fulfilled' ? v1Detection.value : null;

        const [healthResult, incidentResult, anomalyResult] = await Promise.allSettled([
          healthSvc?.getHealth?.() ?? Promise.resolve({ connected: false, source: 'HealthService NOT CONNECTED' }),
          // IncidentDetectionService.analyze() requires a metric snapshot — use an empty one
          Promise.resolve(incidentSvc ? incidentSvc.analyze({}) : { connected: false, source: 'IncidentDetectionService NOT CONNECTED' }),
          Promise.resolve(anomalySvc ? (anomalySvc.getAnomalies?.() ?? []) : []),
        ]);

        return {
          health: healthResult.status === 'fulfilled' ? healthResult.value : null,
          incidents: incidentResult.status === 'fulfilled'
            ? (Array.isArray(incidentResult.value) ? incidentResult.value : [])
            : [],
          anomalies: anomalyResult.status === 'fulfilled'
            ? (Array.isArray(anomalyResult.value) ? anomalyResult.value : [])
            : [],
          v1Detection: detection,
          liveNote: 'Live telemetry NOT CONNECTED — structural topology only.',
        };
      }, { subsystem: 'HealthService + IncidentDetectionService + AnomalyDetectionService + V1/api/detection' });

      stages.push(result);
      observations = result.output ?? {};
    }

    // ── Stage 2: UNDERSTAND ─────────────────────────────────────────────────
    let understanding = {};
    {
      const result = await this._runner.run('understand', async () => {
        const [contextMod, explainerMod] = await Promise.allSettled([
          tryLoad('context-intelligence/ContextAssembler.mjs'),
          tryLoad('self-model/PlatformExplainer.mjs'),
        ]);

        const assembler = contextMod.status   === 'fulfilled' ? contextMod.value   : null;
        const explainer = explainerMod.status === 'fulfilled' ? explainerMod.value : null;

        const [contextResult, platformResult] = await Promise.allSettled([
          assembler?.assembleTopLevel?.()
            ?? assembler?.assemble?.('operating loop cycle context', { tokenBudget: 2000 })
            ?? Promise.resolve({ connected: false, source: 'ContextAssembler NOT CONNECTED' }),
          explainer?.explainPlatform?.()
            ?? Promise.resolve({ connected: false, source: 'PlatformExplainer NOT CONNECTED' }),
        ]);

        return {
          context: contextResult.status === 'fulfilled' ? contextResult.value : null,
          platform: platformResult.status === 'fulfilled' ? platformResult.value : null,
        };
      }, { subsystem: 'ContextAssembler + PlatformExplainer' });

      stages.push(result);
      understanding = result.output ?? {};
    }

    // ── Stage 3: REASON ─────────────────────────────────────────────────────
    let reasoning = {};
    {
      const result = await this._runner.run('reason', async () => {
        const [reasoningMod, execReasonMod, correlMod] = await Promise.allSettled([
          tryLoad('reasoning/ReasoningEngine.mjs'),
          tryLoad('executive-intelligence/ExecutiveReasoningEngine.mjs'),
          tryLoad('correlation/IntelligenceCorrelationEngine.mjs'),
        ]);

        const reasoningEng = reasoningMod.status  === 'fulfilled' ? reasoningMod.value  : null;
        const execReason   = execReasonMod.status === 'fulfilled' ? execReasonMod.value : null;
        const correlEng    = correlMod.status     === 'fulfilled' ? correlMod.value     : null;

        const question = 'What is the current operational posture and what are the highest structural risks?';

        const [reasonResult, execResult, correlResult] = await Promise.allSettled([
          reasoningEng?.reason?.(question, { context: understanding }) ?? Promise.resolve(null),
          execReason?.reason?.(question) ?? Promise.resolve(null),
          correlEng?.correlate?.({ type: 'operating-loop-cycle', context: observations }) ?? Promise.resolve(null),
        ]);

        const primary    = reasonResult.status === 'fulfilled' ? reasonResult.value   : null;
        const executive  = execResult.status   === 'fulfilled' ? execResult.value     : null;
        const correlation = correlResult.status === 'fulfilled' ? correlResult.value  : null;

        return {
          hypothesis: primary?.hypothesis ?? executive?.conclusion
            ?? 'Structural topology CONNECTED; live signals NOT CONNECTED.',
          confidence: primary?.confidence ?? executive?.confidence ?? 'LOW',
          reasoningChain: primary?.reasoningChain ?? [],
          executiveReasoning: executive,
          correlation,
        };
      }, { subsystem: 'ReasoningEngine + ExecutiveReasoningEngine + IntelligenceCorrelationEngine' });

      stages.push(result);
      reasoning = result.output ?? {};
    }

    // ── Stage 4: PREDICT ────────────────────────────────────────────────────
    let predictions = {};
    {
      const result = await this._runner.run('predict', async () => {
        const predMod = await tryLoad('prediction-engine/PredictionEngine.mjs');
        if (!predMod?.predictAll) {
          return { connected: false, predictions: [], source: 'PredictionEngine NOT CONNECTED' };
        }
        const report = await predMod.predictAll();
        return report ?? { predictions: [], connected: false };
      }, { subsystem: 'PredictionEngine' });

      stages.push(result);
      predictions = result.output ?? {};
    }

    // ── Stage 5: RECOMMEND ──────────────────────────────────────────────────
    let recommendations = {};
    {
      const result = await this._runner.run('recommend', async () => {
        const recMod = await tryLoad('recommendation-engine/ExecutiveRecommendationEngine.mjs');
        if (!recMod?.recommendAll) {
          return { connected: false, recommendations: [], source: 'ExecutiveRecommendationEngine NOT CONNECTED' };
        }
        const all = await recMod.recommendAll();
        return all ?? { recommendations: [], connected: false };
      }, { subsystem: 'ExecutiveRecommendationEngine' });

      stages.push(result);
      recommendations = result.output ?? {};
    }

    // ── Stage 6: EXECUTE ────────────────────────────────────────────────────
    let executions = [];
    {
      const result = await this._runner.run('execute', async () => {
        const actions = await runSafeExecutions();
        return {
          actions,
          safetyContract: 'ENFORCED — only whitelisted read-only actions executed. No state mutations.',
        };
      }, { subsystem: 'ExecutionEngine (safe read-only)' });

      stages.push(result);
      executions = result.output?.actions ?? [];
    }

    // ── Stage 7: VERIFY ─────────────────────────────────────────────────────
    let verifications = {};
    {
      const result = await this._runner.run('verify', async () => {
        const verMod = await tryLoad('verification-engine/VerificationEngine.mjs');
        if (!verMod?.verify) {
          return { connected: false, verifications: [], source: 'VerificationEngine NOT CONNECTED' };
        }

        const conclusionToVerify = {
          type: 'architectural',
          hypothesis: reasoning?.hypothesis ?? 'No hypothesis',
          confidence: reasoning?.confidence ?? 'LOW',
          evidence: [
            { source: 'cycle-observations', value: JSON.stringify(observations).slice(0, 200) },
            { source: 'cycle-predictions',  value: JSON.stringify(predictions).slice(0, 200) },
          ],
        };

        const vResult = await verMod.verify(conclusionToVerify);
        return { verifications: [vResult], cycleId };
      }, { subsystem: 'VerificationEngine' });

      stages.push(result);
      verifications = result.output ?? {};
    }

    // ── Stage 8: LEARN ──────────────────────────────────────────────────────
    let learnings = [];
    {
      // Preliminary cycleResult (without learnings) so LearningRecorder can operate on it.
      const partialResult = {
        cycleId,
        startedAt,
        stages,
        observations,
        understanding,
        reasoning,
        predictions,
        recommendations,
        executions,
        verifications,
        posture: calculatePosture(stages),
        confidence: calculateConfidence(stages),
      };

      const result = await this._runner.run('learn', async () => {
        const entries = await LearningRecorder.record(partialResult);
        return {
          entries,
          count: entries.length,
          memoryStored: entries.filter((e) => e.memoryStored).length,
          // SelfModelBuilder: only record a learning entry, do NOT rebuild every cycle.
          selfModelNote: 'SelfModelBuilder NOT invoked this cycle — only LearningRecorder + OutcomeTracker updated.',
        };
      }, { subsystem: 'LearningRecorder + MemoryIngestionPipeline + OutcomeTracker' });

      stages.push(result);
      learnings = result.output?.entries ?? [];
    }

    // ── Assemble CycleResult ────────────────────────────────────────────────
    const completedAt = new Date().toISOString();
    const durationMs = Math.round(performance.now() - t0);
    const posture = calculatePosture(stages);
    const confidence = calculateConfidence(stages);

    const safeTs = startedAt.replace(/[:.]/g, '-');
    const artifactPath = join(LOOP_OUT_DIR, `cycle-${safeTs}.json`);

    /** @type {CycleResult} */
    const cycleResult = {
      cycleId,
      startedAt,
      completedAt,
      durationMs,
      stages,
      observations,
      understanding,
      reasoning,
      predictions,
      recommendations,
      executions,
      verifications,
      learnings,
      posture,
      confidence,
      artifactPath,
    };

    // ── Persist artifact ────────────────────────────────────────────────────
    try {
      ensureOutputDir();
      writeFileSync(artifactPath, JSON.stringify(cycleResult, null, 2), 'utf8');
    } catch {
      // disk write failure should not crash the loop
    }

    // ── Update in-memory state ──────────────────────────────────────────────
    this._cycleCount++;
    this._lastCycleAt = completedAt;
    this._lastPosture = posture;
    this._history.push(cycleResult);
    if (this._history.length > MAX_HISTORY) this._history.shift();

    return cycleResult;
  }

  /**
   * Start continuous autonomous loop.
   * Guards against overlapping cycles — if a cycle is still running when the
   * next tick fires, that tick is skipped.
   *
   * @param {number} [intervalMs=300_000] — default 5 minutes
   */
  run(intervalMs = 300_000) {
    if (this._running) return;
    this._running = true;
    this._intervalMs = intervalMs;

    const tick = async () => {
      if (this._cycleInProgress) return; // skip overlapping cycle
      this._cycleInProgress = true;
      try {
        await this.runOnce();
      } catch {
        // never crash the loop
      } finally {
        this._cycleInProgress = false;
      }
    };

    this._timer = setInterval(tick, intervalMs);
    // .unref() ensures the interval does not prevent process exit.
    if (this._timer.unref) this._timer.unref();
  }

  /**
   * Stop the continuous loop.
   */
  stop() {
    if (this._timer) {
      clearInterval(this._timer);
      this._timer = null;
    }
    this._running = false;
    this._cycleInProgress = false;
  }

  /**
   * Return the current loop state.
   *
   * @returns {{ running: boolean, cycleCount: number, lastCycleAt: string|null, lastPosture: string|null, intervalMs: number|null }}
   */
  getLoopState() {
    return {
      running: this._running,
      cycleCount: this._cycleCount,
      lastCycleAt: this._lastCycleAt,
      lastPosture: this._lastPosture,
      intervalMs: this._intervalMs,
    };
  }

  /**
   * Return the last N cycle results (most recent last).
   *
   * @param {number} [n=10]
   * @returns {CycleResult[]}
   */
  getHistory(n = 10) {
    return this._history.slice(-n);
  }

  /**
   * Return a specific cycle result by cycleId.
   *
   * @param {string} id
   * @returns {CycleResult|undefined}
   */
  getCycle(id) {
    return this._history.find((c) => c.cycleId === id);
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function ensureOutputDir() {
  if (!existsSync(LOOP_OUT_DIR)) mkdirSync(LOOP_OUT_DIR, { recursive: true });
}

export default new LCISOperatingLoop();
