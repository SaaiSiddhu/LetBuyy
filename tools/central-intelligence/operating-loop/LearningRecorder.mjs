/**
 * LCIS V3 Autonomous Operating Loop — LearningRecorder
 *
 * Closes the continuous-improvement loop by extracting learnings from each
 * cycle result and routing them into:
 *   1. MemoryIngestionPipeline  (architecture / incidents collections)
 *   2. graphify-out/operating-loop/learnings.jsonl  (append-only log)
 *
 * Public API:
 *   record(cycleResult)          — extract + persist learnings for one cycle
 *   getLearnings(filter?)        — read learnings from the JSONL log
 *   correlateLearnings()         — find recurring patterns across cycles
 *   getImprovementSignals()      — ranked signals the loop has learned to watch
 *
 * @module operating-loop/LearningRecorder
 */

import { existsSync, mkdirSync, appendFileSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID, createHash } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const LOOP_OUT_DIR = join(REPO_ROOT, 'graphify-out', 'operating-loop');
const LEARNINGS_PATH = join(LOOP_OUT_DIR, 'learnings.jsonl');

// Lazy-loaded MemoryIngestionPipeline singleton.
let _pipeline = null;
async function getPipeline() {
  if (_pipeline) return _pipeline;
  try {
    const m = await import('../memory-engine/MemoryIngestionPipeline.mjs');
    _pipeline = m.default;
  } catch {
    _pipeline = null;
  }
  return _pipeline;
}

// Lazy-loaded OutcomeTracker singleton.
let _outcomeTracker = null;
async function getOutcomeTracker() {
  if (_outcomeTracker) return _outcomeTracker;
  try {
    const m = await import('../goal-engine/OutcomeTracker.mjs');
    _outcomeTracker = m.default;
  } catch {
    _outcomeTracker = null;
  }
  return _outcomeTracker;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir() {
  if (!existsSync(LOOP_OUT_DIR)) mkdirSync(LOOP_OUT_DIR, { recursive: true });
}

/**
 * Deterministic learning id: sha256 of cycleId + content slice.
 * @param {string} cycleId
 * @param {string} content
 */
function learningId(cycleId, content) {
  return createHash('sha256')
    .update(`${cycleId}:${content}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * @typedef {{
 *   id: string,
 *   cycleId: string,
 *   recordedAt: string,
 *   collection: 'architecture'|'incidents',
 *   category: string,
 *   content: string,
 *   evidence: Record<string,unknown>,
 *   posture: string,
 *   confidence: number,
 *   memoryStored: boolean,
 *   memoryError?: string,
 * }} LearningEntry
 */

// ── LearningExtractor ─────────────────────────────────────────────────────────

/**
 * Extract discrete learnings from a CycleResult.
 *
 * @param {object} cycleResult
 * @returns {Array<{collection:'architecture'|'incidents', category:string, content:string, evidence:Record<string,unknown>}>}
 */
function extractLearnings(cycleResult) {
  const learnings = [];
  const { cycleId, posture, confidence, stages = [] } = cycleResult;

  // ── Posture-level learning ────────────────────────────────────────────────
  learnings.push({
    collection: 'architecture',
    category: 'cycle-posture',
    content: `Cycle ${cycleId} completed with posture=${posture}, confidence=${confidence}. ` +
      `Stages: ${stages.map((s) => `${s.stage}=${s.status}`).join(', ')}.`,
    evidence: { cycleId, posture, confidence, stageCount: stages.length },
  });

  // ── Degraded stage learnings (architecture) ───────────────────────────────
  const degradedStages = stages.filter((s) => s.status === 'degraded');
  for (const s of degradedStages) {
    learnings.push({
      collection: 'architecture',
      category: 'degraded-stage',
      content: `Stage "${s.stage}" (subsystem: ${s.subsystem}) degraded in cycle ${cycleId}: ${s.error ?? s.summary}.`,
      evidence: { stage: s.stage, subsystem: s.subsystem, error: s.error, durationMs: s.durationMs },
    });
  }

  // ── Incident / anomaly observations ──────────────────────────────────────
  const observations = cycleResult.observations ?? {};
  const incidents = observations.incidents ?? [];
  const anomalies = observations.anomalies ?? [];

  for (const inc of incidents) {
    learnings.push({
      collection: 'incidents',
      category: 'incident-signal',
      content: `Incident signal detected in cycle ${cycleId}: ${inc.type ?? inc.kind ?? 'unknown'} — ${inc.message ?? inc.description ?? JSON.stringify(inc).slice(0, 120)}.`,
      evidence: { cycleId, incident: inc },
    });
  }

  for (const anom of anomalies) {
    learnings.push({
      collection: 'incidents',
      category: 'anomaly-signal',
      content: `Anomaly detected in cycle ${cycleId}: ${anom.metric ?? anom.name ?? 'unknown'} — z-score ${anom.zScore ?? '?'}, value ${anom.value ?? '?'}.`,
      evidence: { cycleId, anomaly: anom },
    });
  }

  // ── Prediction learnings ──────────────────────────────────────────────────
  const predictions = cycleResult.predictions ?? {};
  const predArray = Array.isArray(predictions) ? predictions
    : (predictions.predictions ?? []);

  const highRisk = predArray.filter((p) => (p.probability ?? 0) > 0.65 || /HIGH|CRITICAL/i.test(p.risk ?? ''));
  for (const pred of highRisk) {
    learnings.push({
      collection: 'architecture',
      category: 'high-risk-prediction',
      content: `High-risk prediction in cycle ${cycleId}: [${pred.target ?? '?'}] ${pred.prediction ?? ''}. ` +
        `Horizon: ${pred.horizon ?? 'unknown'}.`,
      evidence: { cycleId, prediction: pred },
    });
  }

  // ── Reasoning learnings ───────────────────────────────────────────────────
  const reasoning = cycleResult.reasoning ?? {};
  if (reasoning.hypothesis) {
    learnings.push({
      collection: 'architecture',
      category: 'reasoning-hypothesis',
      content: `Cycle ${cycleId} reasoning hypothesis: ${reasoning.hypothesis}`,
      evidence: { cycleId, confidence: reasoning.confidence },
    });
  }

  return learnings;
}

// ── LearningRecorder class ────────────────────────────────────────────────────

class LearningRecorder {
  /**
   * Extract learnings from a CycleResult, persist to JSONL, and route to MemoryIngestionPipeline.
   *
   * @param {object} cycleResult — a CycleResult as produced by LCISOperatingLoop.runOnce()
   * @returns {Promise<LearningEntry[]>}
   */
  async record(cycleResult) {
    ensureDir();
    const pipeline = await getPipeline();
    const outcomeTracker = await getOutcomeTracker();
    const rawLearnings = extractLearnings(cycleResult);
    const entries = [];

    for (const raw of rawLearnings) {
      const id = learningId(cycleResult.cycleId ?? 'unknown', raw.content);
      const entry = /** @type {LearningEntry} */ ({
        id,
        cycleId: cycleResult.cycleId,
        recordedAt: new Date().toISOString(),
        collection: raw.collection,
        category: raw.category,
        content: raw.content,
        evidence: raw.evidence,
        posture: cycleResult.posture ?? 'UNKNOWN',
        confidence: typeof cycleResult.confidence === 'number' ? cycleResult.confidence : 0,
        memoryStored: false,
      });

      // ── Append to learnings.jsonl ─────────────────────────────────────────
      try {
        appendFileSync(LEARNINGS_PATH, JSON.stringify(entry) + '\n', 'utf8');
      } catch {
        // disk write failure should not crash the loop
      }

      // ── Route to MemoryIngestionPipeline ──────────────────────────────────
      if (pipeline?.runFromText) {
        try {
          await pipeline.runFromText(
            raw.content,
            raw.collection,
            { source: `operating-loop:${entry.cycleId}`, category: raw.category, evidence: raw.evidence },
          );
          entry.memoryStored = true;
        } catch (err) {
          entry.memoryError = err?.message ?? String(err);
        }
      }

      // ── Record to OutcomeTracker ──────────────────────────────────────────
      if (outcomeTracker?.recordOutcome) {
        try {
          const type = raw.category === 'degraded-stage' ? 'regression'
            : raw.category === 'incident-signal' ? 'blocker'
            : raw.category === 'high-risk-prediction' ? 'blocker'
            : 'progress';

          await outcomeTracker.recordOutcome({
            goalId: `operating-loop:${raw.collection}`,
            description: raw.content.slice(0, 200),
            type,
            evidence: raw.evidence,
          });
        } catch {
          // non-fatal
        }
      }

      entries.push(entry);
    }

    return entries;
  }

  /**
   * Read learning entries from the JSONL log.
   *
   * @param {{ cycleId?: string, collection?: string, category?: string, limit?: number }} [filter]
   * @returns {LearningEntry[]}
   */
  getLearnings(filter = {}) {
    if (!existsSync(LEARNINGS_PATH)) return [];
    const lines = readFileSync(LEARNINGS_PATH, 'utf8').trim().split('\n').filter(Boolean);
    let entries = lines.map((l) => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);

    if (filter.cycleId) entries = entries.filter((e) => e.cycleId === filter.cycleId);
    if (filter.collection) entries = entries.filter((e) => e.collection === filter.collection);
    if (filter.category) entries = entries.filter((e) => e.category === filter.category);

    const limit = filter.limit ?? entries.length;
    return entries.slice(-limit);
  }

  /**
   * Find recurring patterns across cycles.
   * Returns categories that appear in >= 2 distinct cycles, sorted by occurrence count.
   *
   * @returns {{ category: string, occurrences: number, cycles: string[], exampleContent: string }[]}
   */
  correlateLearnings() {
    const entries = this.getLearnings();
    /** @type {Map<string, Set<string>>} */
    const byCategory = new Map();
    /** @type {Map<string, string>} */
    const example = new Map();

    for (const e of entries) {
      if (!byCategory.has(e.category)) byCategory.set(e.category, new Set());
      byCategory.get(e.category).add(e.cycleId);
      if (!example.has(e.category)) example.set(e.category, e.content);
    }

    return [...byCategory.entries()]
      .filter(([, cycles]) => cycles.size >= 2)
      .map(([category, cycles]) => ({
        category,
        occurrences: cycles.size,
        cycles: [...cycles],
        exampleContent: example.get(category) ?? '',
      }))
      .sort((a, b) => b.occurrences - a.occurrences);
  }

  /**
   * Return improvement signals: what the loop has learned to watch.
   * Combines recurring patterns (from correlateLearnings) with high-confidence posture trends.
   *
   * @returns {{
   *   signals: Array<{signal:string, strength:'HIGH'|'MEDIUM'|'LOW', category:string, basis:string}>,
   *   watchCategories: string[],
   *   degradedSubsystems: string[],
   *   generatedAt: string,
   * }}
   */
  getImprovementSignals() {
    const patterns = this.correlateLearnings();
    const entries = this.getLearnings({ limit: 500 });

    // Degraded subsystems that appear frequently
    /** @type {Map<string, number>} */
    const degradedCount = new Map();
    for (const e of entries.filter((e) => e.category === 'degraded-stage')) {
      const sub = e.evidence?.stage ?? 'unknown';
      degradedCount.set(sub, (degradedCount.get(sub) ?? 0) + 1);
    }

    const degradedSubsystems = [...degradedCount.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([s]) => s);

    // High-posture cycles
    const highConfidence = entries.filter(
      (e) => e.category === 'cycle-posture' && e.confidence >= 0.7,
    ).length;
    const totalCycles = entries.filter((e) => e.category === 'cycle-posture').length;

    const signals = patterns.map((p) => ({
      signal: `Recurring "${p.category}" pattern seen in ${p.occurrences} cycles`,
      strength: p.occurrences >= 5 ? 'HIGH' : p.occurrences >= 3 ? 'MEDIUM' : 'LOW',
      category: p.category,
      basis: p.exampleContent.slice(0, 120),
    }));

    if (degradedSubsystems.length > 0) {
      signals.push({
        signal: `Subsystems with repeated degradation: ${degradedSubsystems.join(', ')}`,
        strength: 'HIGH',
        category: 'degraded-stage',
        basis: 'Aggregate across all recorded cycles',
      });
    }

    if (totalCycles > 0) {
      const pct = Math.round((highConfidence / totalCycles) * 100);
      signals.push({
        signal: `${pct}% of cycles completed with ≥0.70 confidence (${highConfidence}/${totalCycles})`,
        strength: pct >= 70 ? 'HIGH' : pct >= 40 ? 'MEDIUM' : 'LOW',
        category: 'cycle-posture',
        basis: 'Based on all learning entries in learnings.jsonl',
      });
    }

    return {
      signals: signals.sort((a, b) =>
        (['HIGH', 'MEDIUM', 'LOW'].indexOf(a.strength)) - (['HIGH', 'MEDIUM', 'LOW'].indexOf(b.strength))
      ),
      watchCategories: patterns.map((p) => p.category),
      degradedSubsystems,
      generatedAt: new Date().toISOString(),
    };
  }
}

export default new LearningRecorder();
