/**
 * LCIS V3 Phase 21 — MissionEngine
 *
 * A Mission is a high-level strategic intent that links multiple Goals.
 * The MissionEngine aggregates goal progress to compute mission-level
 * completion, health, and reasoning.
 *
 * Seeded mission: "LetBuyy GA Launch" — links the three goals that gate GA:
 *   - launch-readiness (strategic)
 *   - 107-validator-gate-green (engineering)
 *   - zero-money-ledger-drift (reliability)
 *
 * Persistence: in-memory with a snapshot written to graphify-out/goals/goals.json
 * alongside GoalEngine (MissionEngine delegates save back to GoalEngine singleton).
 *
 * Honesty contract:
 *   - Progress aggregation: from GoalEngine.scoreGoal → CONNECTED (structural)
 *   - Live merchant / GMV dimensions: NOT CONNECTED + exact source labelled
 *
 * @module MissionEngine
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const GOALS_DIR = resolve(REPO_ROOT, 'graphify-out/goals');
const MISSIONS_PATH = resolve(GOALS_DIR, 'missions.json');

/**
 * @typedef {'now'|'quarter'|'year'} MissionHorizon
 * @typedef {'active'|'paused'|'achieved'|'abandoned'} MissionStatus
 *
 * @typedef {{
 *   id: string,
 *   title: string,
 *   vision: string,
 *   goalIds: string[],
 *   horizon: MissionHorizon,
 *   status: MissionStatus,
 *   createdAt: string,
 *   updatedAt: string
 * }} Mission
 */

// ── Seeded missions ───────────────────────────────────────────────────────────
const SEED_MISSIONS = [
  {
    id: 'letbuyy-ga-launch',
    title: 'LetBuyy GA Launch',
    vision: 'Ship LetBuyy to general availability — a production-grade India-first multi-tenant commerce platform where merchants can onboard, sell, and get paid, with zero money-ledger drift and a fully green validator gate.',
    goalIds: [
      'launch-readiness',
      '107-validator-gate-green',
      'zero-money-ledger-drift',
    ],
    horizon: 'quarter',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'merchant-security-foundation',
    title: 'Merchant Security Foundation',
    vision: 'Establish a bulletproof multi-tenant security posture: 100% RLS force coverage, zero cross-tenant data leakage vectors, and complete merchant onboarding with verified GSTIN capture.',
    goalIds: [
      'rls-force-coverage',
      'merchant-onboarding-completion',
    ],
    horizon: 'quarter',
    status: 'active',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir() {
  if (!existsSync(GOALS_DIR)) mkdirSync(GOALS_DIR, { recursive: true });
}

function safeSave(path, data) {
  try {
    ensureDir();
    writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.warn('[MissionEngine] safeSave failed:', err.message);
  }
}

/** Lazy import GoalEngine to avoid circular at module init. */
async function getGoalEngine() {
  try {
    const m = await import('./GoalEngine.mjs');
    return m.default ?? null;
  } catch (err) {
    console.warn('[MissionEngine] GoalEngine unavailable:', err.message);
    return null;
  }
}

// ── MissionEngine class ───────────────────────────────────────────────────────

class MissionEngine {
  /** @type {Map<string, Mission>} */
  #missions = new Map();

  constructor() {
    this.#loadSync();
  }

  // ── Persistence ─────────────────────────────────────────────────────────────

  #loadSync() {
    ensureDir();
    if (existsSync(MISSIONS_PATH)) {
      try {
        const raw = JSON.parse(readFileSync(MISSIONS_PATH, 'utf8'));
        const list = Array.isArray(raw) ? raw : (raw.missions ?? []);
        for (const m of list) this.#missions.set(m.id, m);
      } catch (err) {
        console.warn('[MissionEngine] load failed — seeding fresh:', err.message);
      }
    }
    // Seed missing missions (idempotent)
    for (const seed of SEED_MISSIONS) {
      if (!this.#missions.has(seed.id)) {
        this.#missions.set(seed.id, { ...seed });
      }
    }
  }

  #save() {
    const list = [...this.#missions.values()];
    safeSave(MISSIONS_PATH, { missions: list, savedAt: new Date().toISOString() });
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  /**
   * Define or replace a mission.
   * @param {Partial<Mission> & {title:string, vision:string}} mission
   * @returns {Mission}
   */
  defineMission(mission) {
    const id = mission.id ?? createHash('sha1').update(mission.title).digest('hex').slice(0, 12);
    const now = new Date().toISOString();
    /** @type {Mission} */
    const record = {
      id,
      title: mission.title,
      vision: mission.vision,
      goalIds: mission.goalIds ?? [],
      horizon: mission.horizon ?? 'quarter',
      status: mission.status ?? 'active',
      createdAt: mission.createdAt ?? now,
      updatedAt: now,
    };
    this.#missions.set(id, record);
    this.#save();
    return record;
  }

  /**
   * Get all missions.
   * @returns {Mission[]}
   */
  getMissions() {
    return [...this.#missions.values()];
  }

  /**
   * Get a single mission by id.
   * @param {string} id
   * @returns {Mission|null}
   */
  getMission(id) {
    return this.#missions.get(id) ?? null;
  }

  /**
   * Link additional goal IDs to a mission.
   * @param {string} missionId
   * @param {string[]} goalIds
   * @returns {Mission|null}
   */
  linkGoalsToMission(missionId, goalIds) {
    const mission = this.#missions.get(missionId);
    if (!mission) return null;
    const existing = new Set(mission.goalIds);
    for (const id of goalIds) existing.add(id);
    mission.goalIds = [...existing];
    mission.updatedAt = new Date().toISOString();
    this.#save();
    return mission;
  }

  /**
   * Compute mission progress as the mean of all linked goal scores.
   * @param {string} id
   * @returns {Promise<{missionId:string, progress:number, goalScores:Record<string,number>, status:MissionStatus, liveNote:string}>}
   */
  async getMissionProgress(id) {
    const mission = this.#missions.get(id);
    if (!mission) return null;

    const ge = await getGoalEngine();
    const goalScores = {};

    if (ge) {
      await Promise.all(
        mission.goalIds.map(async (gid) => {
          const score = await ge.scoreGoal(gid).catch(() => 0);
          goalScores[gid] = score;
        })
      );
    }

    const scores = Object.values(goalScores);
    const progress = scores.length
      ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
      : 0;

    const status = _missionStatusFromProgress(progress, mission.status);

    // Update stored mission status
    mission.status = status;
    mission.updatedAt = new Date().toISOString();
    this.#save();

    return {
      missionId: id,
      title: mission.title,
      horizon: mission.horizon,
      progress,
      goalScores,
      status,
      liveNote: 'Progress derived from structural evidence (CONNECTED). Live merchant counts / GMV: NOT CONNECTED — source: Supabase ledger + Analytics Engine.',
    };
  }

  /**
   * Get the active mission (first with status === 'active').
   * @returns {Mission|null}
   */
  getActiveMission() {
    return this.getMissions().find(m => m.status === 'active') ?? null;
  }

  /**
   * Reason about a mission: are we on track? What is blocking progress?
   * @param {string} id
   * @returns {Promise<{mission:Mission, progress:number, onTrack:boolean, blockers:string[], recommendations:string[]}>}
   */
  async reasonAboutMission(id) {
    const mission = this.#missions.get(id);
    if (!mission) return null;

    const progressReport = await this.getMissionProgress(id);
    const ge = await getGoalEngine();

    const blockers = [];
    const recommendations = [];

    if (ge) {
      for (const gid of mission.goalIds) {
        const goal = ge.getGoal(gid);
        if (!goal) continue;
        if (goal.status === 'blocked') {
          blockers.push(`[BLOCKED] ${goal.title} — ${goal.target}`);
          recommendations.push(`Unblock: ${goal.id} — review open evidence and resolve the highest-impact barrier.`);
        } else if (goal.status === 'at-risk') {
          blockers.push(`[AT-RISK] ${goal.title} (progress: ${goal.progress}%)`);
          recommendations.push(`Accelerate: ${goal.id} — structural progress is ${goal.progress}%; needs intervention.`);
        }
      }
    }

    const onTrack = blockers.length === 0 && progressReport.progress >= 70;

    if (onTrack) {
      recommendations.push('Mission is structurally on-track. Wire live telemetry (NOT CONNECTED) to confirm at runtime.');
    }

    return {
      mission,
      progress: progressReport.progress,
      goalScores: progressReport.goalScores,
      onTrack,
      blockers,
      recommendations,
      liveNote: 'Reasoning is structural (CONNECTED). Live merchant funnel / GMV correlation: NOT CONNECTED.',
    };
  }
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

/**
 * Derive mission status from aggregate progress.
 * Preserves 'achieved'/'abandoned' if already set.
 * @param {number} progress 0–100
 * @param {MissionStatus} current
 * @returns {MissionStatus}
 */
function _missionStatusFromProgress(progress, current) {
  if (current === 'achieved' || current === 'abandoned') return current;
  if (progress >= 100) return 'achieved';
  return 'active';
}

// ── Singleton export ──────────────────────────────────────────────────────────
export default new MissionEngine();
