/**
 * LCIS V3 Phase 21 — OutcomeTracker
 *
 * Records outcomes (progress events, regressions, achievements, blockers) against
 * goals and writes them to an append-only JSONL log:
 *   graphify-out/goals/outcomes.jsonl
 *
 * Outcomes feed the learning loop — over time the GoalEngine can correlate
 * structural signals to actual progress or regression events.
 *
 * Methods:
 *   recordOutcome(outcome) — append to outcomes.jsonl
 *   getOutcomes(goalId)    — read + filter by goalId
 *   correlateOutcomeToGoal(outcome) — determine which goal this outcome belongs to
 *   getOutcomeTrend(goalId) — structural trend: improving / degrading / stable / insufficient-data
 *   measureImpact(outcome)  — score the impact of a single outcome on its goal
 *
 * Honesty contract:
 *   - Outcome correlation uses structural evidence + keyword matching: CONNECTED
 *   - Live business impact (GMV affected, merchants impacted): NOT CONNECTED + source
 *
 * @module OutcomeTracker
 */

import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const GOALS_DIR = resolve(REPO_ROOT, 'graphify-out/goals');
const OUTCOMES_PATH = resolve(GOALS_DIR, 'outcomes.jsonl');

/**
 * @typedef {'progress'|'regression'|'achievement'|'blocker'} OutcomeType
 *
 * @typedef {{
 *   id: string,
 *   goalId: string,
 *   description: string,
 *   type: OutcomeType,
 *   evidence: Record<string, unknown>,
 *   timestamp: string,
 *   impactScore: number,
 *   businessImpact: {
 *     merchantsAffected: string,
 *     revenueAtRisk: string,
 *     note: string
 *   }
 * }} Outcome
 */

// ── Goal category → domain keyword map (for correlation) ─────────────────────
const GOAL_KEYWORD_MAP = {
  'launch-readiness': ['launch', 'blocker', 'readiness', 'go-live', 'production', 'cert', 'ca-cert', 'razorpay-route'],
  '107-validator-gate-green': ['validator', 'gate', 'governance', 'validate-governance', 'violation', '107'],
  'zero-money-ledger-drift': ['ledger', 'money', 'payment', 'refund', 'payout', 'order', 'rpc', 'drift', 'reconcil'],
  'rls-force-coverage': ['rls', 'row-level', 'security', 'policy', 'tenant', 'auth', 'identity', 'cross-tenant'],
  'merchant-onboarding-completion': ['onboarding', 'merchant', 'store-create', 'theme-assign', 'setup-complete', 'first-order'],
};

// ── Impact weights per outcome type ──────────────────────────────────────────
const IMPACT_WEIGHTS = {
  achievement: 30,
  progress: 15,
  blocker: -25,
  regression: -20,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir() {
  if (!existsSync(GOALS_DIR)) mkdirSync(GOALS_DIR, { recursive: true });
}

function generateId(outcome) {
  return createHash('sha1')
    .update(`${outcome.goalId}:${outcome.description}:${outcome.timestamp ?? Date.now()}`)
    .digest('hex')
    .slice(0, 16);
}

/**
 * Lazy import GoalEngine — graceful if GoalEngine fails to load.
 */
async function getGoalEngine() {
  try {
    const m = await import('./GoalEngine.mjs');
    return m.default ?? null;
  } catch {
    return null;
  }
}

// ── OutcomeTracker class ──────────────────────────────────────────────────────

class OutcomeTracker {
  constructor() {
    ensureDir();
  }

  // ── Write ─────────────────────────────────────────────────────────────────────

  /**
   * Record an outcome and append to outcomes.jsonl.
   * Also notifies GoalEngine to update progress.
   * @param {Partial<Outcome> & {goalId:string, description:string, type:OutcomeType}} outcome
   * @returns {Promise<Outcome>}
   */
  async recordOutcome(outcome) {
    ensureDir();
    const now = new Date().toISOString();
    const id = outcome.id ?? generateId({ ...outcome, timestamp: now });

    const impactScore = this.measureImpact({ ...outcome, id });

    /** @type {Outcome} */
    const record = {
      id,
      goalId: outcome.goalId,
      description: outcome.description,
      type: outcome.type,
      evidence: outcome.evidence ?? {},
      timestamp: now,
      impactScore,
      businessImpact: {
        merchantsAffected: 'NOT CONNECTED',
        revenueAtRisk: 'NOT CONNECTED',
        note: 'Live business impact requires Supabase sites count + ledger totals (NOT CONNECTED). Wire analytics adapter for real values.',
      },
    };

    try {
      appendFileSync(OUTCOMES_PATH, JSON.stringify(record) + '\n', 'utf8');
    } catch (err) {
      console.warn('[OutcomeTracker] append failed:', err.message);
    }

    // Feed outcome back to GoalEngine as evidence
    const ge = await getGoalEngine();
    if (ge) {
      try {
        await ge.updateGoalProgress(record.goalId, {
          source: `outcome:${record.id}`,
          value: `${record.type}: ${record.description}`,
          connected: true,
        });
      } catch (err) {
        console.warn('[OutcomeTracker] GoalEngine updateGoalProgress failed:', err.message);
      }
    }

    return record;
  }

  // ── Read ──────────────────────────────────────────────────────────────────────

  /**
   * Read all outcomes from the JSONL log, optionally filtered by goalId.
   * @param {string|null} [goalId]
   * @returns {Outcome[]}
   */
  getOutcomes(goalId = null) {
    if (!existsSync(OUTCOMES_PATH)) return [];
    try {
      const lines = readFileSync(OUTCOMES_PATH, 'utf8')
        .split('\n')
        .filter(l => l.trim());
      const parsed = lines.map(l => {
        try { return JSON.parse(l); } catch { return null; }
      }).filter(Boolean);
      return goalId ? parsed.filter(o => o.goalId === goalId) : parsed;
    } catch (err) {
      console.warn('[OutcomeTracker] getOutcomes read failed:', err.message);
      return [];
    }
  }

  // ── Correlation ───────────────────────────────────────────────────────────────

  /**
   * Given an outcome (possibly without a goalId), determine which goal it belongs to
   * using keyword matching against goal domain maps.
   * @param {{description:string, type:OutcomeType, evidence?:Record<string,unknown>}} outcome
   * @returns {{ goalId:string|null, confidence:'high'|'medium'|'low', matches:string[] }}
   */
  correlateOutcomeToGoal(outcome) {
    const text = [
      outcome.description ?? '',
      outcome.type ?? '',
      JSON.stringify(outcome.evidence ?? {}),
    ].join(' ').toLowerCase();

    const scores = {};

    for (const [goalId, keywords] of Object.entries(GOAL_KEYWORD_MAP)) {
      const matched = keywords.filter(k => text.includes(k.toLowerCase()));
      if (matched.length) scores[goalId] = matched;
    }

    const entries = Object.entries(scores).sort((a, b) => b[1].length - a[1].length);

    if (!entries.length) {
      return { goalId: null, confidence: 'low', matches: [] };
    }

    const [bestGoalId, bestMatches] = entries[0];
    const confidence = bestMatches.length >= 3 ? 'high' : bestMatches.length >= 2 ? 'medium' : 'low';

    return { goalId: bestGoalId, confidence, matches: bestMatches };
  }

  // ── Trend ─────────────────────────────────────────────────────────────────────

  /**
   * Compute the structural trend for a goal from its recent outcomes.
   * Returns 'improving' | 'degrading' | 'stable' | 'insufficient-data'.
   *
   * Window: the 10 most recent outcomes, split into two halves.
   * If the second half has more progress/achievements than the first → improving.
   * If it has more regressions/blockers → degrading.
   * Otherwise → stable.
   *
   * @param {string} goalId
   * @returns {{ goalId:string, trend:'improving'|'degrading'|'stable'|'insufficient-data', signal:number, sampleSize:number, liveNote:string }}
   */
  getOutcomeTrend(goalId) {
    const outcomes = this.getOutcomes(goalId);

    if (outcomes.length < 2) {
      return {
        goalId,
        trend: 'insufficient-data',
        signal: 0,
        sampleSize: outcomes.length,
        liveNote: 'Fewer than 2 outcomes recorded. Record more outcomes to establish a trend.',
      };
    }

    // Sort by timestamp ascending, take last 10
    const recent = [...outcomes]
      .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp))
      .slice(-10);

    const half = Math.ceil(recent.length / 2);
    const firstHalf = recent.slice(0, half);
    const secondHalf = recent.slice(half);

    const positiveScore = (arr) =>
      arr.reduce((s, o) => s + (IMPACT_WEIGHTS[o.type] ?? 0), 0);

    const firstScore = positiveScore(firstHalf);
    const secondScore = positiveScore(secondHalf);
    const delta = secondScore - firstScore;

    let trend;
    if (delta > 5) trend = 'improving';
    else if (delta < -5) trend = 'degrading';
    else trend = 'stable';

    return {
      goalId,
      trend,
      signal: delta,
      sampleSize: recent.length,
      firstHalfScore: firstScore,
      secondHalfScore: secondScore,
      liveNote: 'Trend computed from structural outcome log (CONNECTED). Live velocity (PRs merged/day, test pass rate) NOT CONNECTED — wire CI telemetry adapter.',
    };
  }

  // ── Impact ────────────────────────────────────────────────────────────────────

  /**
   * Score the impact of a single outcome on its goal: -100..+100.
   * Uses outcome type weight + severity modifiers from evidence.
   * @param {Partial<Outcome>} outcome
   * @returns {number}
   */
  measureImpact(outcome) {
    const baseWeight = IMPACT_WEIGHTS[outcome.type] ?? 0;

    // Severity modifier from evidence
    const evidence = outcome.evidence ?? {};
    const severityMod = _severityModifier(evidence.severity ?? 'medium');

    // Category modifier: money/security goals amplify impact
    const categoryMod = _categoryModifier(outcome.goalId ?? '');

    const raw = baseWeight * severityMod * categoryMod;
    return Math.max(-100, Math.min(100, Math.round(raw)));
  }

  // ── Summary ───────────────────────────────────────────────────────────────────

  /**
   * Summarise outcome history across all goals.
   * @returns {{totalOutcomes:number, byGoal:Record<string,{count:number,trend:string}>, liveNote:string}}
   */
  getSummary() {
    const all = this.getOutcomes();
    const byGoal = {};
    const goalIds = [...new Set(all.map(o => o.goalId))];
    for (const gid of goalIds) {
      const gOutcomes = all.filter(o => o.goalId === gid);
      const trend = this.getOutcomeTrend(gid);
      byGoal[gid] = { count: gOutcomes.length, trend: trend.trend };
    }
    return {
      totalOutcomes: all.length,
      byGoal,
      liveNote: 'Summary from structural outcome log (CONNECTED). GMV/merchant live totals: NOT CONNECTED.',
    };
  }
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

/**
 * Severity multiplier for impact scoring.
 * @param {string} severity
 * @returns {number}
 */
function _severityModifier(severity) {
  switch ((severity ?? '').toLowerCase()) {
    case 'critical': return 2.0;
    case 'high': return 1.5;
    case 'medium': return 1.0;
    case 'low': return 0.5;
    default: return 1.0;
  }
}

/**
 * Category multiplier — money + security goals have higher impact.
 * @param {string} goalId
 * @returns {number}
 */
function _categoryModifier(goalId) {
  if (goalId === 'zero-money-ledger-drift') return 1.8;
  if (goalId === 'rls-force-coverage') return 1.6;
  if (goalId === 'launch-readiness') return 1.4;
  if (goalId === '107-validator-gate-green') return 1.2;
  return 1.0;
}

// ── Singleton export ──────────────────────────────────────────────────────────
export default new OutcomeTracker();
