/**
 * LCIS V3 Phase 20 — ExecutiveDecisionEngine
 *
 * Converts intelligence signals into scored, evidence-backed decisions.
 * Decision options are scored on four orthogonal axes:
 *   impact  (0–10) — how much does this move the platform forward?
 *   risk    (0–10) — how dangerous is this action if it goes wrong?
 *   effort  (0–10) — how hard is this to execute? (lower = less effort needed)
 *   confidence (0–10) — how certain are we about the outcome?
 *
 * Score = (impact × 4 + confidence × 3 - risk × 2 - effort × 1) / 10
 *         normalised to 0–100.
 *
 * Decision log persists to graphify-out/executive-intelligence/decisions.jsonl.
 * Decisions are also ingested to the V2 memory pipeline so future reasoning
 * can recall them.
 *
 * Honesty contract: all live values labeled NOT CONNECTED + exact source.
 *
 * @module ExecutiveDecisionEngine
 */

import { createReadStream, createWriteStream, existsSync, mkdirSync } from 'fs';
import { appendFile, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const DECISIONS_DIR = join(REPO_ROOT, 'graphify-out', 'executive-intelligence');
const DECISIONS_FILE = join(DECISIONS_DIR, 'decisions.jsonl');

/**
 * @typedef {{
 *   action: string,
 *   impact: number,
 *   risk: number,
 *   effort: number,
 *   confidence: number,
 *   score: number,
 *   rationale?: string
 * }} DecisionOption
 *
 * @typedef {{
 *   id: string,
 *   situation: string,
 *   options: DecisionOption[],
 *   recommended: DecisionOption,
 *   rationale: string,
 *   reversible: boolean,
 *   timestamp: string
 * }} Decision
 */

// ── Lazy primitive loaders ────────────────────────────────────────────────────

async function getMemoryIngestion() {
  try {
    const m = await import('../memory-engine/MemoryIngestionPipeline.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function getRiskScorer() {
  try {
    const m = await import('../correlation/RiskScorer.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function getReasoningEngine() {
  try {
    const m = await import('../reasoning/ReasoningEngine.mjs');
    return m.default ?? null;
  } catch { return null; }
}

// ── V1 LCIS fetch helper ─────────────────────────────────────────────────────

async function fetchV1(path) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10_000);
  try {
    const res = await fetch(`http://localhost:3333${path}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ── Scoring formula ───────────────────────────────────────────────────────────

/**
 * Score a single decision option.
 * @param {{ impact:number, risk:number, effort:number, confidence:number }} opt
 * @returns {number} 0–100
 */
function scoreOption({ impact = 5, risk = 5, effort = 5, confidence = 5 }) {
  // Clamp inputs to 0–10
  const i = Math.min(10, Math.max(0, impact));
  const r = Math.min(10, Math.max(0, risk));
  const e = Math.min(10, Math.max(0, effort));
  const c = Math.min(10, Math.max(0, confidence));
  // raw = (4×impact + 3×confidence - 2×risk - 1×effort) / 100 → 0–100
  const raw = (i * 4 + c * 3 - r * 2 - e * 1);
  return Math.round(Math.min(100, Math.max(0, raw * 10)));
}

// ── Persistence helpers ───────────────────────────────────────────────────────

function ensureDir() {
  if (!existsSync(DECISIONS_DIR)) {
    mkdirSync(DECISIONS_DIR, { recursive: true });
  }
}

async function appendDecision(decision) {
  ensureDir();
  await appendFile(DECISIONS_FILE, JSON.stringify(decision) + '\n', 'utf8');
}

// ── ID generator ──────────────────────────────────────────────────────────────

function makeId() {
  return `dec_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Reversibility heuristic ───────────────────────────────────────────────────

function isReversible(option) {
  const irreversibleWords = /delete|drop|purge|destroy|revoke|terminate|payment|refund|payout|ledger/i;
  return !irreversibleWords.test(option.action ?? '');
}

// ── Main class ────────────────────────────────────────────────────────────────

class ExecutiveDecisionEngine {
  /**
   * Synthesise evidence for a situation and produce a scored decision.
   * @param {string} situation
   * @returns {Promise<Decision>}
   */
  async decide(situation) {
    const [riskScorerEng, reasoningEng, v1FixEngine] = await Promise.allSettled([
      getRiskScorer(),
      getReasoningEngine(),
      fetchV1('/api/fix-engine'),
    ]).then(rs => rs.map(r => (r.status === 'fulfilled' ? r.value : null)));

    // Build candidate options from available intelligence
    const candidates = [];

    // V1 fix engine options
    if (v1FixEngine) {
      const fixes = v1FixEngine.fixes ?? v1FixEngine.recommendations ?? [];
      fixes.slice(0, 5).forEach((f, idx) => {
        candidates.push({
          action: String(f.action ?? f.fix ?? f.recommendation ?? `Fix #${idx + 1}`),
          impact: f.impact ?? 6,
          risk: f.risk ?? 4,
          effort: f.effort ?? 5,
          confidence: f.confidence ? (f.confidence === 'HIGH' ? 8 : f.confidence === 'MEDIUM' ? 5 : 3) : 5,
          rationale: f.rationale ?? f.description ?? '',
        });
      });
    }

    // Reasoning engine options
    if (reasoningEng?.reason) {
      try {
        const rr = await reasoningEng.reason(situation);
        const investigations = rr?.recommendedInvestigation ?? [];
        investigations.slice(0, 3).forEach(inv => {
          candidates.push({
            action: String(inv),
            impact: 6,
            risk: 3,
            effort: 4,
            confidence: rr.confidence === 'HIGH' ? 8 : rr.confidence === 'MEDIUM' ? 5 : 3,
            rationale: 'Derived from ReasoningEngine investigation chain',
          });
        });
      } catch { /* degrade */ }
    }

    // Ensure at least one fallback option
    if (candidates.length === 0) {
      candidates.push({
        action: `Investigate: ${situation}`,
        impact: 5,
        risk: 2,
        effort: 3,
        confidence: 3,
        rationale: 'Default investigation option — primitives not connected',
      });
    }

    const options = this.evaluateOptions(candidates);
    const recommended = options[0];
    const reversible = isReversible(recommended);

    const decision = {
      id: makeId(),
      situation,
      options,
      recommended,
      rationale: recommended.rationale
        ?? `Highest-scored option across impact, risk, effort, and confidence axes (score: ${recommended.score}/100).`,
      reversible,
      timestamp: new Date().toISOString(),
    };

    await this.recordDecision(decision);
    return decision;
  }

  /**
   * Score each option and return sorted descending by score.
   * @param {Array<Partial<DecisionOption>>} options
   * @returns {DecisionOption[]}
   */
  evaluateOptions(options) {
    return options
      .map(opt => ({
        action: opt.action ?? 'Unknown action',
        impact: opt.impact ?? 5,
        risk: opt.risk ?? 5,
        effort: opt.effort ?? 5,
        confidence: opt.confidence ?? 5,
        rationale: opt.rationale ?? '',
        score: scoreOption(opt),
      }))
      .sort((a, b) => b.score - a.score);
  }

  /**
   * Lightweight wrapper that calls decide() and returns just the recommended option.
   * @param {string} situation
   * @returns {Promise<DecisionOption & { situation: string, timestamp: string }>}
   */
  async recommendDecision(situation) {
    const d = await this.decide(situation);
    return { ...d.recommended, situation, timestamp: d.timestamp };
  }

  /**
   * Read persisted decision log.
   * @returns {Promise<Decision[]>}
   */
  async getDecisionLog() {
    if (!existsSync(DECISIONS_FILE)) return [];
    try {
      const raw = await readFile(DECISIONS_FILE, 'utf8');
      return raw
        .split('\n')
        .filter(Boolean)
        .map(line => { try { return JSON.parse(line); } catch { return null; } })
        .filter(Boolean);
    } catch { return []; }
  }

  /**
   * Append a decision to the JSONL log and ingest to memory.
   * @param {Decision} decision
   */
  async recordDecision(decision) {
    // Persist to JSONL
    try {
      await appendDecision(decision);
    } catch { /* non-fatal */ }

    // Ingest to V2 memory
    const memIngestion = await getMemoryIngestion().catch(() => null);
    if (memIngestion?.runFromText) {
      const text = `Decision [${decision.id}]: ${decision.situation}\nRecommended: ${decision.recommended?.action}\nRationale: ${decision.rationale}`;
      try {
        await memIngestion.runFromText(text, { collection: 'knowledge', source: 'ExecutiveDecisionEngine' });
      } catch { /* non-fatal */ }
    }
  }
}

export default new ExecutiveDecisionEngine();
