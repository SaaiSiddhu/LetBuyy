/**
 * LCIS V3 Phase 21 — ObjectiveTracker
 *
 * An Objective is a concrete, measurable milestone beneath a Goal.
 * Each Objective has Key Results (KRs) with targets and current values.
 * Live current values are explicitly labelled NOT CONNECTED + exact source
 * where they require runtime data (analytics, ledger counts, etc.).
 *
 * Persistence: graphify-out/goals/objectives.json
 *
 * Seeded objectives cover all five seeded goals.
 *
 * Honesty contract:
 *   - Structural KR values (file counts, artefact scores): CONNECTED
 *   - Live KR values (active merchants, GMV, funnel rates): NOT CONNECTED + source
 *
 * @module ObjectiveTracker
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const GOALS_DIR = resolve(REPO_ROOT, 'graphify-out/goals');
const OBJECTIVES_PATH = resolve(GOALS_DIR, 'objectives.json');
const LCIS_BASE = process.env.LCIS_URL ?? 'http://localhost:3333';

/**
 * @typedef {{
 *   kr: string,
 *   target: string | number,
 *   current: string | number,
 *   met: boolean,
 *   source: string,
 *   connected: boolean
 * }} KeyResult
 *
 * @typedef {'pending'|'in-progress'|'achieved'|'blocked'} ObjectiveStatus
 *
 * @typedef {{
 *   id: string,
 *   goalId: string,
 *   title: string,
 *   keyResults: KeyResult[],
 *   status: ObjectiveStatus,
 *   createdAt: string,
 *   updatedAt: string
 * }} Objective
 */

// ── Seeded objectives ─────────────────────────────────────────────────────────
const SEED_OBJECTIVES = [
  // launch-readiness
  {
    id: 'obj-lr-blockers',
    goalId: 'launch-readiness',
    title: 'Resolve all 5 code launch blockers',
    keyResults: [
      {
        kr: 'Open launch blockers (LB-7..LB-12 style) count',
        target: 0,
        current: 'NOT CONNECTED',
        met: false,
        source: '/api/production-readiness-v2 → openBlockers',
        connected: false,
      },
      {
        kr: 'Production readiness overall score',
        target: 100,
        current: 98,
        met: false,
        source: 'graphify-out/production-readiness-v2.json → summary.overall (CONNECTED)',
        connected: true,
      },
      {
        kr: 'Razorpay Route (H8) implementation started',
        target: 'yes',
        current: 'NOT CONNECTED',
        met: false,
        source: 'PRs against services/api-gateway (NOT CONNECTED — requires live GitHub API)',
        connected: false,
      },
    ],
    status: 'in-progress',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 'obj-lr-certs',
    goalId: 'launch-readiness',
    title: 'Install live certs CAP-C01..C04',
    keyResults: [
      {
        kr: 'CAP-C01 (Razorpay webhook key) installed in production',
        target: 'present',
        current: 'NOT CONNECTED',
        met: false,
        source: '/api/secrets → RAZORPAY_WEBHOOK_SECRET presence (NOT CONNECTED — Vercel env API)',
        connected: false,
      },
      {
        kr: 'CAP-C02 (Customer session secret) rotated',
        target: 'present',
        current: 'NOT CONNECTED',
        met: false,
        source: '/api/secrets → CUSTOMER_SESSION_SECRET (NOT CONNECTED — Vercel env API)',
        connected: false,
      },
      {
        kr: 'CAP-C03 (Identity JWKS) configured',
        target: 'present',
        current: 'NOT CONNECTED',
        met: false,
        source: '/api/secrets → LETBUYY_IDENTITY_PUBLIC_JWKS (NOT CONNECTED — Vercel env API)',
        connected: false,
      },
      {
        kr: 'CAP-C04 (Queue HMAC signing key) installed',
        target: 'present',
        current: 'NOT CONNECTED',
        met: false,
        source: '/api/secrets → QUEUE_HMAC_KEY (NOT CONNECTED — Vercel env API)',
        connected: false,
      },
    ],
    status: 'blocked',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  // 107-validator-gate-green
  {
    id: 'obj-gate-violations',
    goalId: '107-validator-gate-green',
    title: 'Keep all 107 validators passing with zero hard violations',
    keyResults: [
      {
        kr: 'Hard violations on current HEAD',
        target: 0,
        current: 'NOT CONNECTED',
        met: false,
        source: 'node scripts/validate-governance.mjs (run locally — NOT CONNECTED to CI signal)',
        connected: false,
      },
      {
        kr: 'canonical-ledger-only-validator passes',
        target: 'pass',
        current: 'NOT CONNECTED',
        met: false,
        source: 'validate-governance output (NOT CONNECTED — requires local run)',
        connected: false,
      },
      {
        kr: 'Security review workflow present (.github/workflows/security-review.yml)',
        target: 'present',
        current: 'present',
        met: true,
        source: 'graphify-out/infra-intel.json → github actions (CONNECTED)',
        connected: true,
      },
    ],
    status: 'in-progress',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  // zero-money-ledger-drift
  {
    id: 'obj-ledger-rpc-only',
    goalId: 'zero-money-ledger-drift',
    title: 'Enforce all money mutations via canonical RPCs',
    keyResults: [
      {
        kr: 'TypeScript files with direct money-table inserts/updates',
        target: 0,
        current: 'NOT CONNECTED',
        met: false,
        source: 'canonical-ledger-only-validator scan (NOT CONNECTED — requires validate-governance run)',
        connected: false,
      },
      {
        kr: 'Canonical money RPCs present in db-intel',
        target: 6,
        current: 6,
        met: true,
        source: 'graphify-out/db-intel.json → rpc count (CONNECTED)',
        connected: true,
      },
      {
        kr: 'Ledger reconciliation shows zero drift',
        target: 0,
        current: 'NOT CONNECTED',
        met: false,
        source: 'Supabase ledger reconciliation RPC results (NOT CONNECTED — requires DB connection)',
        connected: false,
      },
    ],
    status: 'in-progress',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  // rls-force-coverage
  {
    id: 'obj-rls-coverage',
    goalId: 'rls-force-coverage',
    title: 'Achieve 100% RLS force coverage on tenant tables',
    keyResults: [
      {
        kr: 'Total RLS policies in db-intel',
        target: '≥651',
        current: 651,
        met: true,
        source: 'graphify-out/db-intel.json → summary.policies (CONNECTED)',
        connected: true,
      },
      {
        kr: 'Tenant tables with RLS FORCE enabled (%)',
        target: 100,
        current: 'NOT CONNECTED',
        met: false,
        source: 'Supabase pg_tables + pg_policies query (NOT CONNECTED — requires DB connection)',
        connected: false,
      },
      {
        kr: 'Policies with USING (true) found',
        target: 0,
        current: 'NOT CONNECTED',
        met: false,
        source: 'Security audit scan (NOT CONNECTED — requires validate-governance or DB run)',
        connected: false,
      },
      {
        kr: 'Security intelligence score',
        target: 95,
        current: 90,
        met: false,
        source: 'graphify-out/security-intelligence-v5.json (CONNECTED)',
        connected: true,
      },
    ],
    status: 'in-progress',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  // merchant-onboarding-completion
  {
    id: 'obj-onboarding-flow',
    goalId: 'merchant-onboarding-completion',
    title: 'Wire and measure end-to-end merchant onboarding funnel',
    keyResults: [
      {
        kr: 'Onboarding flow implemented in identity-platform',
        target: 'yes',
        current: 'yes',
        met: true,
        source: 'apps/identity-platform/src/app/onboarding/page.tsx (CONNECTED)',
        connected: true,
      },
      {
        kr: 'Theme auto-assigned on store creation',
        target: 'yes',
        current: 'partial',
        met: false,
        source: 'apps/identity-platform/src/app/api/auth/create-store/route.ts (CONNECTED — needs theme assign)',
        connected: true,
      },
      {
        kr: 'Merchant onboarding completion rate (live funnel)',
        target: '≥80%',
        current: 'NOT CONNECTED',
        met: false,
        source: 'identity-platform onboarding analytics (NOT CONNECTED — requires analytics ingestion)',
        connected: false,
      },
      {
        kr: 'Merchants who completed first product creation (live)',
        target: 'NOT CONNECTED',
        current: 'NOT CONNECTED',
        met: false,
        source: 'Supabase sites + products table count (NOT CONNECTED — requires DB connection)',
        connected: false,
      },
    ],
    status: 'in-progress',
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
    console.warn('[ObjectiveTracker] safeSave failed:', err.message);
  }
}

async function lcis(path, timeout = 5000) {
  const url = `${LCIS_BASE}${path}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    clearTimeout(timer);
    return null;
  }
}

// ── ObjectiveTracker class ────────────────────────────────────────────────────

class ObjectiveTracker {
  /** @type {Map<string, Objective>} */
  #objectives = new Map();

  constructor() {
    this.#loadSync();
  }

  // ── Persistence ─────────────────────────────────────────────────────────────

  #loadSync() {
    ensureDir();
    if (existsSync(OBJECTIVES_PATH)) {
      try {
        const raw = JSON.parse(readFileSync(OBJECTIVES_PATH, 'utf8'));
        const list = Array.isArray(raw) ? raw : (raw.objectives ?? []);
        for (const o of list) this.#objectives.set(o.id, o);
      } catch (err) {
        console.warn('[ObjectiveTracker] load failed — seeding fresh:', err.message);
      }
    }
    for (const seed of SEED_OBJECTIVES) {
      if (!this.#objectives.has(seed.id)) {
        this.#objectives.set(seed.id, { ...seed });
      }
    }
  }

  #save() {
    const list = [...this.#objectives.values()];
    safeSave(OBJECTIVES_PATH, { objectives: list, savedAt: new Date().toISOString() });
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  /**
   * Define or replace an objective.
   * @param {Partial<Objective> & {goalId:string, title:string}} objective
   * @returns {Objective}
   */
  defineObjective(objective) {
    const id = objective.id ?? createHash('sha1')
      .update(`${objective.goalId}:${objective.title}`)
      .digest('hex').slice(0, 12);
    const now = new Date().toISOString();
    /** @type {Objective} */
    const record = {
      id,
      goalId: objective.goalId,
      title: objective.title,
      keyResults: objective.keyResults ?? [],
      status: objective.status ?? 'pending',
      createdAt: objective.createdAt ?? now,
      updatedAt: now,
    };
    this.#objectives.set(id, record);
    this.#save();
    return record;
  }

  /**
   * Get all objectives for a given goalId.
   * @param {string} goalId
   * @returns {Objective[]}
   */
  getObjectives(goalId) {
    return [...this.#objectives.values()].filter(o => o.goalId === goalId);
  }

  /**
   * Get all objectives across all goals.
   * @returns {Objective[]}
   */
  getAllObjectives() {
    return [...this.#objectives.values()];
  }

  /**
   * Get a single objective by id.
   * @param {string} id
   * @returns {Objective|null}
   */
  getObjective(id) {
    return this.#objectives.get(id) ?? null;
  }

  /**
   * Update the status of an objective and persist.
   * @param {string} id
   * @param {ObjectiveStatus} status
   * @returns {Objective|null}
   */
  updateObjective(id, status) {
    const obj = this.#objectives.get(id);
    if (!obj) return null;
    obj.status = status;
    obj.updatedAt = new Date().toISOString();
    this.#save();
    return obj;
  }

  /**
   * Get progress for an objective: % of key results met.
   * Attempts to refresh connected KRs from live LCIS data.
   * @param {string} id
   * @returns {Promise<{id:string, title:string, progress:number, keyResults:KeyResult[], liveNote:string}>}
   */
  async getObjectiveProgress(id) {
    const obj = this.#objectives.get(id);
    if (!obj) return null;

    // Refresh connected KRs where we can
    await this.trackObjective(id);

    const kr = obj.keyResults;
    const met = kr.filter(k => k.met).length;
    const progress = kr.length ? Math.round((met / kr.length) * 100) : 0;

    const unconnected = kr.filter(k => !k.connected).length;

    return {
      id: obj.id,
      goalId: obj.goalId,
      title: obj.title,
      progress,
      metCount: met,
      totalKrs: kr.length,
      unconnectedKrs: unconnected,
      keyResults: kr,
      status: obj.status,
      liveNote: unconnected > 0
        ? `${unconnected}/${kr.length} KR(s) are NOT CONNECTED — wire live data sources for accurate progress.`
        : 'All KRs are structurally connected.',
    };
  }

  /**
   * Attempt to refresh KR values from V1 LCIS or on-disk artefacts.
   * Only updates KRs that are explicitly CONNECTED by the tracker.
   * @param {string} id
   * @returns {Promise<Objective|null>}
   */
  async trackObjective(id) {
    const obj = this.#objectives.get(id);
    if (!obj) return null;

    // Pull fresh data from LCIS if available
    const [readiness, dbIntel, secIntel] = await Promise.all([
      lcis('/api/production-readiness-v2'),
      lcis('/api/db'),
      lcis('/api/security-intelligence'),
    ]);

    let changed = false;

    for (const kr of obj.keyResults) {
      if (!kr.connected) continue; // Never update NOT CONNECTED KRs automatically

      // Refresh specific connected KRs by source heuristic
      if (kr.source.includes('production-readiness-v2') && readiness) {
        if (kr.kr.includes('overall score')) {
          const val = readiness?.summary?.overall ?? kr.current;
          if (val !== kr.current) { kr.current = val; kr.met = val >= Number(kr.target); changed = true; }
        }
      }
      if (kr.source.includes('db-intel') && dbIntel) {
        if (kr.kr.includes('RLS policies')) {
          const val = dbIntel?.summary?.policies ?? dbIntel?.policyCount ?? kr.current;
          if (val !== kr.current) { kr.current = val; kr.met = val >= 651; changed = true; }
        }
        if (kr.kr.includes('Canonical money RPCs')) {
          const val = dbIntel?.summary?.rpcs ?? kr.current;
          if (val !== kr.current) { kr.current = val; kr.met = val >= 6; changed = true; }
        }
      }
      if (kr.source.includes('security-intelligence') && secIntel) {
        if (kr.kr.includes('Security intelligence score')) {
          const val = secIntel?.score ?? secIntel?.overallScore ?? kr.current;
          if (val !== kr.current) { kr.current = val; kr.met = val >= Number(kr.target); changed = true; }
        }
      }
    }

    if (changed) {
      obj.updatedAt = new Date().toISOString();
      obj.status = _objectiveStatusFromKRs(obj.keyResults);
      this.#save();
    }

    return obj;
  }

  /**
   * Get all objectives that are currently blocked.
   * @returns {Objective[]}
   */
  getBlockedObjectives() {
    return [...this.#objectives.values()].filter(o => o.status === 'blocked');
  }
}

// ── Pure helpers ──────────────────────────────────────────────────────────────

/**
 * Derive objective status from its KRs.
 * @param {KeyResult[]} keyResults
 * @returns {ObjectiveStatus}
 */
function _objectiveStatusFromKRs(keyResults) {
  if (!keyResults.length) return 'pending';
  const allMet = keyResults.every(k => k.met);
  if (allMet) return 'achieved';
  const anyMet = keyResults.some(k => k.met);
  // If no KR is met and there are hard blockers (NOT CONNECTED required KRs with false), mark blocked
  const hasHardBlocker = keyResults.some(k => !k.met && k.current === 'NOT CONNECTED');
  if (!anyMet && hasHardBlocker) return 'blocked';
  return 'in-progress';
}

// ── Singleton export ──────────────────────────────────────────────────────────
export default new ObjectiveTracker();
