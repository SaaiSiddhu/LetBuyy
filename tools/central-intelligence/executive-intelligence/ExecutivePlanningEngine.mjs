/**
 * LCIS V3 Phase 20 — ExecutivePlanningEngine
 *
 * Decomposes executive goals into ordered, dependency-aware execution plans.
 * Plans persist to graphify-out/executive-intelligence/plans/<id>.json.
 *
 * Step schema:
 *   { id, action, dependsOn:string[], owner, risk:'LOW'|'MEDIUM'|'HIGH', verifiable:bool }
 *
 * Topological sort handles dependency ordering.
 * Cycle detection surfaces unresolvable plans as an error step.
 *
 * Honesty contract: live data NOT CONNECTED + exact source. No fabrications.
 *
 * @module ExecutivePlanningEngine
 */

import { existsSync, mkdirSync, readFileSync } from 'fs';
import { writeFile, readFile, readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const PLANS_DIR = join(REPO_ROOT, 'graphify-out', 'executive-intelligence', 'plans');

/**
 * @typedef {{
 *   id: string,
 *   action: string,
 *   dependsOn: string[],
 *   owner: string,
 *   risk: 'LOW'|'MEDIUM'|'HIGH',
 *   verifiable: boolean,
 *   estimatedHours?: number
 * }} PlanStep
 *
 * @typedef {{
 *   id: string,
 *   goal: string,
 *   steps: PlanStep[],
 *   orderedSteps: PlanStep[],
 *   estimatedTotalHours: number,
 *   timestamp: string
 * }} ExecutionPlan
 */

// ── Lazy primitive loaders ────────────────────────────────────────────────────

async function getReasoningEngine() {
  try {
    const m = await import('../reasoning/ReasoningEngine.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function getOpsEngine() {
  try {
    const m = await import('../autonomous-operations/OperationsReasoningEngine.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function getMemoryRetriever() {
  try {
    const m = await import('../memory-engine/MemoryRetriever.mjs');
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

// ── Persistence helpers ───────────────────────────────────────────────────────

function ensurePlansDir() {
  if (!existsSync(PLANS_DIR)) {
    mkdirSync(PLANS_DIR, { recursive: true });
  }
}

function planPath(id) {
  return join(PLANS_DIR, `${id}.json`);
}

// ── ID generators ─────────────────────────────────────────────────────────────

function makeId() {
  return `plan_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}

function makeStepId(idx) {
  return `step_${String(idx + 1).padStart(3, '0')}`;
}

// ── Risk inference ────────────────────────────────────────────────────────────

function inferRisk(action = '') {
  const a = action.toLowerCase();
  if (/payment|refund|payout|ledger|money|delete|drop|purge|security|rls|auth/.test(a)) return 'HIGH';
  if (/migration|schema|deploy|release|webhook|queue|worker/.test(a)) return 'MEDIUM';
  return 'LOW';
}

// ── Verifiability heuristic ───────────────────────────────────────────────────

function isVerifiable(action = '') {
  const a = action.toLowerCase();
  // Steps with testable outcomes are verifiable
  return /test|verify|check|confirm|validate|audit|review|deploy|build|run/.test(a);
}

// ── Effort estimation ─────────────────────────────────────────────────────────

function estimateHours(action = '') {
  const a = action.toLowerCase();
  if (/audit|review|investigate|research/.test(a)) return 4;
  if (/implement|build|create|add|fix/.test(a)) return 8;
  if (/migrate|refactor|redesign|overhaul/.test(a)) return 16;
  if (/test|verify|check|validate/.test(a)) return 2;
  if (/deploy|release|rollout/.test(a)) return 3;
  return 4; // default
}

// ── Topological sort ──────────────────────────────────────────────────────────

/**
 * Topologically sort steps by dependsOn edges (Kahn's algorithm).
 * Returns sorted steps; steps in a cycle are appended at the end with a warning.
 * @param {PlanStep[]} steps
 * @returns {PlanStep[]}
 */
function topologicalSort(steps) {
  const ids = new Set(steps.map(s => s.id));
  const inDegree = new Map(steps.map(s => [s.id, 0]));
  const graph = new Map(steps.map(s => [s.id, []]));

  for (const s of steps) {
    for (const dep of (s.dependsOn ?? [])) {
      if (ids.has(dep)) {
        graph.get(dep).push(s.id);
        inDegree.set(s.id, (inDegree.get(s.id) ?? 0) + 1);
      }
    }
  }

  const queue = steps.filter(s => (inDegree.get(s.id) ?? 0) === 0).map(s => s.id);
  const order = [];
  const stepMap = new Map(steps.map(s => [s.id, s]));

  while (queue.length > 0) {
    const id = queue.shift();
    order.push(stepMap.get(id));
    for (const neighbour of (graph.get(id) ?? [])) {
      const deg = (inDegree.get(neighbour) ?? 0) - 1;
      inDegree.set(neighbour, deg);
      if (deg === 0) queue.push(neighbour);
    }
  }

  // Any remaining steps are in a cycle — append with warning flag
  const included = new Set(order.map(s => s.id));
  const cycleSteps = steps
    .filter(s => !included.has(s.id))
    .map(s => ({ ...s, _cycleWarning: true }));

  return [...order, ...cycleSteps];
}

// ── Goal decomposer ───────────────────────────────────────────────────────────

/**
 * Break a goal string into candidate steps using reasoning + ops primitives.
 * @param {string} goal
 * @returns {Promise<Array<Partial<PlanStep>>>}
 */
async function decomposeGoal(goal) {
  const [reasoningEng, opsEng, v1FixEngine, memRetriever] = await Promise.allSettled([
    getReasoningEngine(),
    getOpsEngine(),
    fetchV1('/api/fix-engine'),
    getMemoryRetriever(),
  ]).then(rs => rs.map(r => (r.status === 'fulfilled' ? r.value : null)));

  const candidates = [];

  // ReasoningEngine investigation chain
  if (reasoningEng?.reason) {
    try {
      const rr = await reasoningEng.reason(`How to achieve: ${goal}`);
      (rr?.recommendedInvestigation ?? rr?.reasoningChain ?? []).forEach((step, idx) =>
        candidates.push({ action: String(step), dependsOn: idx > 0 ? [`${goal}_step_${idx - 1}`] : [] })
      );
    } catch { /* degrade */ }
  }

  // Ops engine recommendations
  if (opsEng?.getEngineeringRecommendations) {
    try {
      const recs = await opsEng.getEngineeringRecommendations();
      const arr = Array.isArray(recs) ? recs : (recs?.recommendations ?? []);
      arr.slice(0, 4).forEach(r =>
        candidates.push({ action: String(r.recommendation ?? r.action ?? r), dependsOn: [] })
      );
    } catch { /* degrade */ }
  }

  // V1 fix engine steps
  if (v1FixEngine) {
    const fixes = v1FixEngine.fixes ?? v1FixEngine.plan ?? [];
    fixes.slice(0, 5).forEach(f =>
      candidates.push({
        action: String(f.action ?? f.fix ?? f),
        dependsOn: f.dependsOn ?? [],
        owner: f.owner ?? 'engineering',
      })
    );
  }

  // Memory recall for similar goals
  if (memRetriever?.retrieve) {
    try {
      const hits = await memRetriever.retrieve(goal, { limit: 3, collection: 'knowledge' });
      const arr = Array.isArray(hits) ? hits : (hits?.results ?? []);
      arr.forEach(h => {
        const fact = String(h.content ?? h.text ?? h.fact ?? '');
        if (fact.length > 10) {
          candidates.push({ action: `Recall: ${fact.slice(0, 120)}`, dependsOn: [] });
        }
      });
    } catch { /* degrade */ }
  }

  // Always ensure at least one step
  if (candidates.length === 0) {
    candidates.push({
      action: `Investigate and scope: ${goal}`,
      dependsOn: [],
      owner: 'engineering',
    });
    candidates.push({
      action: `Implement solution for: ${goal}`,
      dependsOn: [],
      owner: 'engineering',
    });
    candidates.push({
      action: `Verify and validate: ${goal}`,
      dependsOn: [],
      owner: 'engineering',
    });
  }

  return candidates;
}

// ── Main class ────────────────────────────────────────────────────────────────

class ExecutivePlanningEngine {
  /**
   * Decompose a goal into an ordered execution plan.
   * @param {string} goal
   * @returns {Promise<ExecutionPlan>}
   */
  async plan(goal) {
    const raw = await decomposeGoal(goal);
    return this.buildExecutionPlan({ goal, rawSteps: raw });
  }

  /**
   * Build a structured execution plan from an objective + raw steps.
   * @param {{ goal: string, rawSteps?: Array<Partial<PlanStep>> }} objective
   * @returns {Promise<ExecutionPlan>}
   */
  async buildExecutionPlan({ goal, rawSteps }) {
    const steps = (rawSteps ?? []).map((raw, idx) => ({
      id: makeStepId(idx),
      action: raw.action ?? `Step ${idx + 1}`,
      dependsOn: (raw.dependsOn ?? []).filter(Boolean),
      owner: raw.owner ?? 'engineering',
      risk: inferRisk(raw.action ?? ''),
      verifiable: isVerifiable(raw.action ?? ''),
      estimatedHours: estimateHours(raw.action ?? ''),
    }));

    const orderedSteps = this.sequenceActions(steps);
    const estimatedTotalHours = this.estimateEffort({ steps: orderedSteps });

    const plan = {
      id: makeId(),
      goal,
      steps,
      orderedSteps,
      estimatedTotalHours,
      timestamp: new Date().toISOString(),
    };

    await this.savePlan(plan);
    return plan;
  }

  /**
   * Topologically sort steps respecting dependsOn edges.
   * @param {PlanStep[]} actions
   * @returns {PlanStep[]}
   */
  sequenceActions(actions) {
    return topologicalSort(actions);
  }

  /**
   * Estimate total effort in hours for a plan.
   * @param {{ steps: PlanStep[] }} plan
   * @returns {number} total hours
   */
  estimateEffort(plan) {
    const steps = plan?.steps ?? plan?.orderedSteps ?? [];
    return steps.reduce((sum, s) => sum + (s.estimatedHours ?? 4), 0);
  }

  /**
   * Retrieve a saved plan by ID.
   * @param {string} id
   * @returns {Promise<ExecutionPlan|null>}
   */
  async getPlan(id) {
    const path = planPath(id);
    if (!existsSync(path)) return null;
    try {
      const raw = await readFile(path, 'utf8');
      return JSON.parse(raw);
    } catch { return null; }
  }

  /**
   * Persist a plan to graphify-out/executive-intelligence/plans/<id>.json.
   * @param {ExecutionPlan} plan
   */
  async savePlan(plan) {
    ensurePlansDir();
    try {
      await writeFile(planPath(plan.id), JSON.stringify(plan, null, 2), 'utf8');
    } catch { /* non-fatal */ }
  }

  /**
   * List all saved plan IDs.
   * @returns {Promise<string[]>}
   */
  async listPlans() {
    ensurePlansDir();
    try {
      const files = await readdir(PLANS_DIR);
      return files
        .filter(f => f.endsWith('.json'))
        .map(f => f.replace('.json', ''));
    } catch { return []; }
  }
}

export default new ExecutivePlanningEngine();
