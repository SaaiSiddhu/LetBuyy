/**
 * LCIS V3 Phase 28 — ExecutiveSummaryGenerator
 *
 * Generates graphify-out/briefs/executive-summary-{date}.md
 *
 * Content: what leadership should know — top 5 things, highest-priority risk,
 * goal/mission progress, launch readiness, decisions needed.
 *
 * Engines used (all lazy, all graceful):
 *   ExecutiveIntelligenceEngine  — executive briefing + what leadership should know
 *   ExecutiveKnowledgeSynthesizer — synthesize platform state
 *   GoalEngine                   — refreshAll, goal progress
 *   MissionEngine                — getMissionProgress
 *   V1 LCIS /api/launch-command-center
 *   V1 LCIS /api/production-readiness-v2
 *
 * Honesty contract: structural topology CONNECTED; all live magnitudes NOT CONNECTED + source.
 *
 * @module ExecutiveSummaryGenerator
 */

import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname  = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = resolve(__dirname, '../../..');
const BRIEFS_DIR = resolve(REPO_ROOT, 'graphify-out', 'briefs');
const V1_BASE    = process.env.LCIS_V1_URL ?? 'http://localhost:3333';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoDate(d = new Date()) { return d.toISOString().slice(0, 10); }

function ensureBriefsDir() { mkdirSync(BRIEFS_DIR, { recursive: true }); }

function writeBrief(filename, content) {
  ensureBriefsDir();
  const p = join(BRIEFS_DIR, filename);
  writeFileSync(p, content, 'utf8');
  return p;
}

async function v1(path, timeout = 5_000) {
  try {
    const res = await fetch(`${V1_BASE}${path}`, { signal: AbortSignal.timeout(timeout) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ── Lazy engine loaders ───────────────────────────────────────────────────────

async function loadExecEngine() {
  try {
    const m = await import('../executive-intelligence/ExecutiveIntelligenceEngine.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function loadSynthesizer() {
  try {
    const m = await import('../executive-intelligence/ExecutiveKnowledgeSynthesizer.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function loadGoalEngine() {
  try {
    const m = await import('../goal-engine/GoalEngine.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function loadMissionEngine() {
  try {
    const m = await import('../goal-engine/MissionEngine.mjs');
    return m.default ?? null;
  } catch { return null; }
}

// ── Section builders ──────────────────────────────────────────────────────────

async function buildTop5Section(execEngine) {
  const lines = ['## Top 5 Things Leadership Should Know'];

  if (execEngine) {
    let briefing = null;
    try { briefing = await execEngine.getExecutiveBriefing(); } catch { /* graceful */ }

    if (briefing) {
      const items = briefing.topThings ?? briefing.highlights ?? briefing.keyPoints ?? briefing.findings ?? [];
      const risks = briefing.topRisks  ?? briefing.risks ?? [];
      const all   = [...(Array.isArray(items) ? items : []), ...(Array.isArray(risks) ? risks : [])];
      const top   = all.slice(0, 5);
      if (top.length) {
        let i = 1;
        for (const item of top) {
          const txt = typeof item === 'string' ? item : (item.summary ?? item.title ?? item.description ?? JSON.stringify(item).slice(0, 120));
          lines.push(`${i++}. ${txt}`);
        }
        return lines.join('\n');
      }
    }

    // fallback: whatShouldHappenNext
    try {
      const next = await execEngine.whatShouldHappenNext();
      if (next) {
        const actions = next.actions ?? next.priorities ?? next.recommendations ?? [];
        let i = 1;
        for (const a of (Array.isArray(actions) ? actions : []).slice(0, 5)) {
          const txt = typeof a === 'string' ? a : (a.action ?? a.title ?? JSON.stringify(a).slice(0, 120));
          lines.push(`${i++}. ${txt}`);
        }
        if (i > 1) return lines.join('\n');
      }
    } catch { /* graceful */ }
  }

  // Structural fallback from V1 decision engine
  const decision = await v1('/api/decision-v2');
  if (decision) {
    const items = decision.topActions ?? decision.rankedFixes ?? decision.priorities ?? [];
    let i = 1;
    for (const item of (Array.isArray(items) ? items : []).slice(0, 5)) {
      const txt = typeof item === 'string' ? item : (item.action ?? item.title ?? item.description ?? JSON.stringify(item).slice(0, 120));
      lines.push(`${i++}. ${txt}`);
    }
    if (i > 1) return lines.join('\n');
  }

  lines.push('1. **NOT CONNECTED** — run `pnpm graph:omega` and restart LCIS V1 (:3333) to populate executive briefing.');
  return lines.join('\n');
}

async function buildHighestPriorityRiskSection(execEngine) {
  const lines = ['## Highest-Priority Risk'];

  let risk = null;
  if (execEngine) {
    try {
      const briefing = await execEngine.getExecutiveBriefing();
      const risks    = briefing?.topRisks ?? briefing?.risks ?? [];
      risk = (Array.isArray(risks) ? risks : [])[0] ?? null;
    } catch { /* graceful */ }
  }

  if (!risk) {
    const secIntel = await v1('/api/security-intelligence');
    if (secIntel) {
      const r = (secIntel.highestRisk ?? secIntel.criticalRisks?.[0] ?? secIntel.risks?.[0]) ?? null;
      if (r) risk = r;
    }
  }

  if (!risk) {
    const prodReadiness = await v1('/api/production-readiness-v2');
    if (prodReadiness) {
      const blocker = (prodReadiness.criticalBlockers ?? prodReadiness.blockers ?? [])[0];
      if (blocker) risk = blocker;
    }
  }

  if (risk) {
    const title = typeof risk === 'string' ? risk : (risk.title ?? risk.name ?? risk.description ?? JSON.stringify(risk).slice(0, 120));
    const sev   = risk.severity ?? risk.impact ?? risk.priority ?? '?';
    const domain = risk.domain ?? risk.area ?? '';
    lines.push(`**${title}**`);
    if (sev !== '?') lines.push(`- Severity: ${sev}`);
    if (domain) lines.push(`- Domain: ${domain}`);
    if (risk.recommendation ?? risk.mitigation) lines.push(`- Recommended action: ${risk.recommendation ?? risk.mitigation}`);
  } else {
    lines.push('- **NOT CONNECTED** (source: ExecutiveIntelligenceEngine + V1 /api/security-intelligence @ localhost:3333)');
  }

  return lines.join('\n');
}

async function buildGoalMissionSection(goalEngine, missionEngine) {
  const lines = ['## Goal & Mission Progress'];

  // Goals
  let goals = [];
  if (goalEngine) {
    try {
      goals = await goalEngine.refreshAll();
      if (!Array.isArray(goals)) goals = [];
    } catch {
      try {
        const p = resolve(REPO_ROOT, 'graphify-out/goals/goals.json');
        if (existsSync(p)) {
          const raw = JSON.parse(readFileSync(p, 'utf8'));
          goals = Array.isArray(raw) ? raw : (raw.goals ?? []);
        }
      } catch { goals = []; }
    }
  }

  if (goals.length) {
    lines.push('### Goals');
    for (const g of goals) {
      const pct  = typeof g.progress === 'number' ? `${Math.round(g.progress * 100)}%` : '?%';
      const icon = g.status === 'achieved' ? '✓' : g.status === 'at-risk' ? '⚠' : g.status === 'blocked' ? '✗' : '→';
      lines.push(`- ${icon} **${g.id}** (${g.category ?? '?'}): ${g.status ?? 'unknown'} — ${pct}`);
    }
  } else {
    lines.push('### Goals: **NOT CONNECTED** (graphify-out/goals/goals.json missing)');
  }

  // Missions
  if (missionEngine) {
    const MISSION_IDS = ['letbuyy-ga-launch', 'platform-stability', 'merchant-growth'];
    for (const mid of MISSION_IDS) {
      try {
        const mp = await missionEngine.getMissionProgress(mid);
        if (mp) {
          lines.push(`### Mission: ${mp.title ?? mid}`);
          lines.push(`- Status: **${mp.status ?? 'unknown'}** | Goals: ${mp.goalProgress?.filter(g => g.status === 'achieved').length ?? 0}/${mp.goalProgress?.length ?? 0} achieved`);
        }
      } catch { /* mission may not exist */ }
    }
  }

  return lines.join('\n');
}

async function buildLaunchReadinessSection() {
  const lines = ['## Launch Readiness'];

  const [launchCenter, prodReadiness] = await Promise.all([
    v1('/api/launch-command-center'),
    v1('/api/production-readiness-v2'),
  ]);

  if (launchCenter) {
    const verdict = launchCenter.verdict ?? launchCenter.readiness?.verdict ?? launchCenter.status ?? 'UNKNOWN';
    lines.push(`- Verdict: **${verdict}**`);
    const score = launchCenter.readiness?.score ?? launchCenter.overallScore;
    if (score != null) lines.push(`- Readiness score: ${score}%`);
    const blockers = launchCenter.blockers ?? launchCenter.criticalBlockers ?? [];
    if (Array.isArray(blockers) && blockers.length) {
      lines.push(`- Critical blockers (${blockers.length}):`);
      for (const b of blockers.slice(0, 5)) {
        const desc = typeof b === 'string' ? b : (b.description ?? b.title ?? JSON.stringify(b).slice(0, 80));
        lines.push(`  - ${desc}`);
      }
    }
  } else {
    lines.push('- **NOT CONNECTED** (source: V1 LCIS /api/launch-command-center @ localhost:3333)');
  }

  if (prodReadiness) {
    const overallPct = prodReadiness.overallScore ?? prodReadiness.score;
    if (overallPct != null) lines.push(`- Production readiness: ${overallPct}% (structural)`);
    const verdict2 = prodReadiness.verdict ?? prodReadiness.launchVerdict ?? 'UNKNOWN';
    lines.push(`- Production verdict: **${verdict2}**`);
  } else {
    lines.push('- Production readiness V2: **NOT CONNECTED** (source: V1 LCIS /api/production-readiness-v2 @ localhost:3333)');
  }

  return lines.join('\n');
}

async function buildDecisionsNeededSection(execEngine, synthesizer) {
  const lines = ['## Decisions Needed'];

  let decisions = null;
  if (execEngine) {
    try {
      const briefing = await execEngine.getExecutiveBriefing();
      decisions = briefing?.decisionsNeeded ?? briefing?.openDecisions ?? null;
    } catch { /* graceful */ }
  }

  if (!decisions && synthesizer) {
    try {
      const state = await synthesizer.synthesizePlatformState();
      decisions = state?.decisionsNeeded ?? state?.openQuestions ?? null;
    } catch { /* graceful */ }
  }

  if (Array.isArray(decisions) && decisions.length) {
    for (const d of decisions.slice(0, 6)) {
      const txt = typeof d === 'string' ? d : (d.question ?? d.title ?? d.decision ?? JSON.stringify(d).slice(0, 120));
      lines.push(`- ${txt}`);
    }
  } else {
    // Structural fallbacks from V1
    const decision = await v1('/api/decision-v2');
    if (decision) {
      const open = decision.openDecisions ?? decision.decisionsNeeded ?? decision.humanDecisionsRequired ?? [];
      if (Array.isArray(open) && open.length) {
        for (const d of open.slice(0, 6)) {
          const txt = typeof d === 'string' ? d : (d.question ?? d.title ?? JSON.stringify(d).slice(0, 120));
          lines.push(`- ${txt}`);
        }
      } else {
        lines.push('- No open decisions flagged by V1 decision engine.');
        lines.push('- > See launch blockers section for items requiring human approval (ARB gated).');
      }
    } else {
      lines.push('- **NOT CONNECTED** (source: V1 LCIS /api/decision-v2 @ localhost:3333)');
    }
  }

  return lines.join('\n');
}

// ── Class ─────────────────────────────────────────────────────────────────────

class ExecutiveSummaryGenerator {
  /**
   * Generate the executive summary brief for today.
   * @returns {Promise<string>} Absolute path to written file.
   */
  async generate() {
    return this.generateForRole('founder');
  }

  /**
   * Generate the executive summary scoped for a specific role.
   * @param {'founder'|'investor'|'cto'|'operations'} role
   * @returns {Promise<string>} Absolute path to written file.
   */
  async generateForRole(role = 'founder') {
    const date = isoDate();
    const ts   = new Date().toISOString();

    const [execEngine, synthesizer, goalEngine, missionEngine] = await Promise.all([
      loadExecEngine(),
      loadSynthesizer(),
      loadGoalEngine(),
      loadMissionEngine(),
    ]);

    // For role-specific synthesis
    let roleSynthesis = '';
    if (synthesizer) {
      try {
        const rs = await synthesizer.synthesizeForRole(role);
        if (rs?.summary) roleSynthesis = `\n> Role context (${role}): ${rs.summary}`;
      } catch { /* graceful */ }
    }

    const [top5, highRisk, goalMission, launchReadiness, decisions] = await Promise.all([
      buildTop5Section(execEngine).catch(() => '## Top 5 Things Leadership Should Know\n- ERROR collecting briefing data'),
      buildHighestPriorityRiskSection(execEngine).catch(() => '## Highest-Priority Risk\n- ERROR collecting risk data'),
      buildGoalMissionSection(goalEngine, missionEngine).catch(() => '## Goal & Mission Progress\n- ERROR collecting goal data'),
      buildLaunchReadinessSection().catch(() => '## Launch Readiness\n- ERROR collecting readiness data'),
      buildDecisionsNeededSection(execEngine, synthesizer).catch(() => '## Decisions Needed\n- ERROR collecting decision data'),
    ]);

    const content = [
      `# LetBuyy Executive Summary — ${date}`,
      `> Role: **${role.toUpperCase()}** | Generated: ${ts} | System: LCIS V3 Phase 28`,
      `> Honesty contract: structural intelligence CONNECTED; every live value labeled NOT CONNECTED + exact source.`,
      ...(roleSynthesis ? [roleSynthesis] : []),
      '',
      top5,
      '',
      highRisk,
      '',
      goalMission,
      '',
      launchReadiness,
      '',
      decisions,
      '',
      '## Data Source Status',
      '- Structural architecture graph: CONNECTED (graphify-out artefacts)',
      '- Live transaction amounts / GMV: **NOT CONNECTED** (source: Supabase ledger reconciliation RPCs)',
      '- Live merchant count: **NOT CONNECTED** (source: Supabase `sites` table)',
      '- Real-time error rates: **NOT CONNECTED** (source: SigNoz OTel / Cloudflare Analytics Engine)',
      '- Deploy status: **NOT CONNECTED** (source: Vercel API)',
      '',
      '---',
      `_Auto-generated by ExecutiveSummaryGenerator.generateForRole("${role}") — do not edit manually._`,
    ].join('\n');

    return writeBrief(`executive-summary-${date}.md`, content);
  }
}

export default new ExecutiveSummaryGenerator();
