/**
 * LCIS V3 Phase 28 — DailyIntelligenceSystem (Facade)
 *
 * Facade that orchestrates the full executive brief family.
 * Builds on V2 IntelligenceReportGenerator (autonomous-operations) and the V3
 * engines (prediction, recommendation, goal, correlation, architecture, executive).
 * All live metric values are NOT CONNECTED + exact source stated; structural
 * topology is CONNECTED via graphify-out artefacts.
 *
 * Output directory: graphify-out/briefs/
 *
 * Methods
 * ───────
 *   generateAll()                   — produce every brief family, return {paths}
 *   generateDailyBrief()            — graphify-out/briefs/daily-{date}.md
 *   generateWeeklyBrief()           — graphify-out/briefs/weekly-{week}.md
 *   generatePlatformHealthBrief()   — graphify-out/briefs/platform-health-{date}.md
 *   getLatestBrief(type)            — { path, content, generatedAt }
 *
 * @module DailyIntelligenceSystem
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = resolve(__dirname, '../../..');
const BRIEFS_DIR = resolve(REPO_ROOT, 'graphify-out', 'briefs');
const V1_BASE    = process.env.LCIS_V1_URL ?? 'http://localhost:3333';

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoDate(d = new Date()) { return d.toISOString().slice(0, 10); }
function isoWeek(d = new Date()) {
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const diff  = d - jan4;
  const week  = Math.ceil((diff / 86_400_000 + jan4.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

function ensureBriefsDir() { mkdirSync(BRIEFS_DIR, { recursive: true }); }

function writeBrief(filename, content) {
  ensureBriefsDir();
  const p = join(BRIEFS_DIR, filename);
  writeFileSync(p, content, 'utf8');
  return p;
}

function briefSize(p) {
  try { return statSync(p).size; } catch { return 0; }
}

async function v1(path, timeout = 5_000) {
  try {
    const res = await fetch(`${V1_BASE}${path}`, { signal: AbortSignal.timeout(timeout) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// ── Lazy engine loaders ───────────────────────────────────────────────────────

async function loadV2ReportGenerator() {
  try {
    const m = await import('../autonomous-operations/IntelligenceReportGenerator.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function loadPredictionEngine() {
  try {
    const m = await import('../prediction-engine/PredictionEngine.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function loadRiskScorer() {
  try {
    const m = await import('../correlation/RiskScorer.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function loadGoalEngine() {
  try {
    const m = await import('../goal-engine/GoalEngine.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function loadExecutiveRecommendationEngine() {
  try {
    const m = await import('../recommendation-engine/ExecutiveRecommendationEngine.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function loadArchitectureIntelligenceEngine() {
  try {
    const m = await import('../architecture-intelligence/ArchitectureIntelligenceEngine.mjs');
    return m.default ?? null;
  } catch { return null; }
}

// ── Section builders ──────────────────────────────────────────────────────────

async function buildPostureSection() {
  const [prodHealth, launchCenter] = await Promise.all([
    v1('/api/production-health'),
    v1('/api/launch-command-center'),
  ]);

  const lines = ['## Platform Posture'];
  if (prodHealth) {
    const status = prodHealth.status ?? prodHealth.overall ?? 'UNKNOWN';
    lines.push(`- Overall: **${status}**`);
    if (prodHealth.dimensions) {
      const dims = prodHealth.dimensions;
      const dimList = Array.isArray(dims) ? dims : Object.entries(dims).map(([k, v]) => ({ name: k, ...v }));
      for (const d of dimList.slice(0, 6)) {
        const name   = d.name ?? d.dimension ?? d.key ?? JSON.stringify(d).slice(0, 40);
        const status = d.status ?? d.health ?? '?';
        lines.push(`  - ${name}: ${status}`);
      }
    }
  } else {
    lines.push('- Production health: **NOT CONNECTED** (source: V1 LCIS /api/production-health @ localhost:3333)');
  }

  if (launchCenter) {
    const verdict = launchCenter.verdict ?? launchCenter.readiness?.verdict ?? launchCenter.status ?? 'UNKNOWN';
    lines.push(`- Launch readiness: **${verdict}**`);
    const blockers = launchCenter.blockers ?? launchCenter.criticalBlockers ?? [];
    if (Array.isArray(blockers) && blockers.length) {
      lines.push(`- Active blockers: ${blockers.length}`);
      for (const b of blockers.slice(0, 3)) {
        const desc = typeof b === 'string' ? b : (b.description ?? b.title ?? b.name ?? JSON.stringify(b).slice(0, 80));
        lines.push(`  - ${desc}`);
      }
    }
  } else {
    lines.push('- Launch command center: **NOT CONNECTED** (source: V1 LCIS /api/launch-command-center @ localhost:3333)');
  }

  return lines.join('\n');
}

async function buildTopRisksSection() {
  const riskScorer = await loadRiskScorer();
  const lines = ['## Top Risks'];

  if (!riskScorer) {
    lines.push('- Risk scorer: **NOT CONNECTED** (engine unavailable)');
    return lines.join('\n');
  }

  const domains = ['payments', 'checkout', 'identity', 'orders', 'webhooks'];
  const results = await Promise.allSettled(domains.map(d => riskScorer.scoreDomain(d)));
  const scored = results
    .map((r, i) => ({ domain: domains[i], ...(r.status === 'fulfilled' ? r.value : { score: null }) }))
    .filter(r => r.score != null)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

  if (scored.length === 0) {
    lines.push('- Risk scores: **NOT CONNECTED** (graphify-out/domain-intel.json not found or stale)');
  } else {
    for (const { domain, score, breakdown } of scored.slice(0, 5)) {
      const pct    = Math.round(score);
      const label  = pct >= 70 ? 'HIGH' : pct >= 40 ? 'MEDIUM' : 'LOW';
      const detail = breakdown ? ` (blast:${breakdown.blastRadius?.toFixed(2) ?? '?'} money:${breakdown.moneyWeight ?? 0} tenant:${breakdown.tenantWeight ?? 0})` : '';
      lines.push(`- **${domain}**: ${pct}/100 [${label}]${detail}`);
    }
    lines.push('\n> Live anomaly signal: **NOT CONNECTED** (source: Cloudflare Analytics Engine / Wrangler tail)');
  }

  return lines.join('\n');
}

async function buildPredictionsSection() {
  const predEngine = await loadPredictionEngine();
  const lines = ['## Predictions'];

  if (!predEngine) {
    lines.push('- Prediction engine: **NOT CONNECTED** (engine unavailable)');
    return lines.join('\n');
  }

  let preds;
  try {
    const report = await predEngine.getPredictionReport();
    preds = report?.predictions ?? [];
  } catch {
    preds = [];
  }

  if (!preds.length) {
    lines.push('- Predictions: **NOT CONNECTED** (structural artefacts missing or stale — run `pnpm graph:omega`)');
    return lines.join('\n');
  }

  for (const p of preds.slice(0, 5)) {
    const badge = p.connected ? 'CONNECTED' : 'NOT CONNECTED';
    lines.push(`- [${p.horizon ?? '?'}] **${p.target}**: ${p.prediction} _(confidence: ${((p.confidence ?? 0) * 100).toFixed(0)}%, basis: ${p.basis ?? 'structural'}, ${badge})_`);
  }

  lines.push('\n> Live trend data: **NOT CONNECTED** (source: Cloudflare Analytics Engine / SigNoz OTel endpoint)');
  return lines.join('\n');
}

async function buildTopRecommendationsSection() {
  const recEngine = await loadExecutiveRecommendationEngine();
  const lines = ['## Top Recommendations'];

  if (!recEngine) {
    lines.push('- Recommendation engine: **NOT CONNECTED** (engine unavailable)');
    return lines.join('\n');
  }

  let recs;
  try {
    const all = await recEngine.recommendAll();
    recs = all?.ranked ?? all?.recommendations ?? [];
  } catch {
    recs = [];
  }

  if (!recs.length) {
    lines.push('- Recommendations: **NOT CONNECTED** (engines unavailable or no data)');
    return lines.join('\n');
  }

  for (const r of recs.slice(0, 5)) {
    const p     = r.priority ?? 'P?';
    const eff   = r.effort   ?? '?';
    const title = r.title    ?? r.action ?? 'Untitled recommendation';
    const act   = r.action   ?? '';
    lines.push(`- [${p}] [${eff}] **${title}**${act && act !== title ? `: ${act}` : ''}`);
  }

  return lines.join('\n');
}

async function buildGoalStatusSection() {
  const goalEngine = await loadGoalEngine();
  const lines = ['## Goal Status'];

  if (!goalEngine) {
    lines.push('- Goal engine: **NOT CONNECTED** (engine unavailable)');
    return lines.join('\n');
  }

  let goals;
  try {
    goals = await goalEngine.refreshAll();
  } catch {
    try {
      // fallback: try to read cached goals
      const p = resolve(REPO_ROOT, 'graphify-out/goals/goals.json');
      if (existsSync(p)) {
        const raw = JSON.parse(readFileSync(p, 'utf8'));
        goals = Array.isArray(raw) ? raw : (raw.goals ?? []);
      }
    } catch { goals = []; }
  }

  if (!Array.isArray(goals) || !goals.length) {
    lines.push('- Goals: **NOT CONNECTED** (graphify-out/goals/goals.json missing — run GoalEngine.refreshAll())');
    return lines.join('\n');
  }

  for (const g of goals.slice(0, 6)) {
    const pct    = typeof g.progress === 'number' ? `${Math.round(g.progress * 100)}%` : '?';
    const status = g.status ?? 'unknown';
    const icon   = status === 'achieved' ? '✓' : status === 'at-risk' ? '⚠' : status === 'blocked' ? '✗' : '→';
    lines.push(`- ${icon} **${g.id}** [${g.category ?? '?'}]: ${status} (${pct})`);
  }

  return lines.join('\n');
}

async function buildWhatChangedSection() {
  const arch = await loadArchitectureIntelligenceEngine();
  const lines = ['## What Changed'];

  if (!arch) {
    lines.push('- Architecture engine: **NOT CONNECTED** (engine unavailable)');
    return lines.join('\n');
  }

  let drift;
  try {
    drift = await arch.whatChanged(null);
  } catch {
    drift = null;
  }

  if (!drift) {
    lines.push('- Architecture drift: **NOT CONNECTED** (run `pnpm graph:omega` to refresh)');
  } else {
    const changes = drift.changes ?? drift.drifts ?? [];
    if (!changes.length) {
      lines.push('- No architecture drift detected in latest snapshot.');
    } else {
      lines.push(`- ${changes.length} architecture change(s) detected:`);
      for (const c of changes.slice(0, 4)) {
        const desc = typeof c === 'string' ? c : (c.description ?? c.summary ?? JSON.stringify(c).slice(0, 80));
        lines.push(`  - ${desc}`);
      }
    }
  }

  lines.push('\n> Deployment history: **NOT CONNECTED** (source: Vercel API / GitHub Actions API)');
  return lines.join('\n');
}

function buildConnectionStatusSection() {
  return [
    '## Data Source Status',
    '| Source | Status | Note |',
    '|--------|--------|------|',
    `| V1 LCIS structural graph (localhost:3333) | see posture section | Run \`pnpm graph:omega\` to refresh |`,
    `| Live telemetry (Cloudflare Analytics Engine) | **NOT CONNECTED** | Requires CLOUDFLARE_ACCOUNT_ID + Analytics Engine binding |`,
    `| Live transaction amounts / GMV | **NOT CONNECTED** | Requires Supabase service-role key + ledger reconciliation RPCs |`,
    `| Active merchants / store count | **NOT CONNECTED** | Requires Supabase \`sites\` table query |`,
    `| Deploy versions (Vercel) | **NOT CONNECTED** | Requires VERCEL_TOKEN |`,
    `| Error rates / latency (SigNoz) | **NOT CONNECTED** | Requires OTEL_EXPORTER_OTLP_ENDPOINT |`,
    `| Security advisories (crawled) | **NOT CONNECTED** | Requires LCIS V2 Qdrant + Crawl4AI running |`,
  ].join('\n');
}

// ── Last-7-daily-briefs reader ─────────────────────────────────────────────

function readLast7Briefs() {
  if (!existsSync(BRIEFS_DIR)) return [];
  const files = readdirSync(BRIEFS_DIR)
    .filter(f => f.startsWith('daily-') && f.endsWith('.md'))
    .sort()
    .reverse()
    .slice(0, 7);
  return files.map(f => {
    const p = join(BRIEFS_DIR, f);
    try { return { file: f, content: readFileSync(p, 'utf8') }; }
    catch { return null; }
  }).filter(Boolean);
}

// ── Class ─────────────────────────────────────────────────────────────────────

class DailyIntelligenceSystem {
  /**
   * Generate all briefs (daily + executive + engineering + security + merchant + platform health).
   * Spawns sub-generators lazily. Returns an object with {paths, errors}.
   */
  async generateAll() {
    const date = isoDate();
    const results = await Promise.allSettled([
      this.generateDailyBrief(),
      this.generatePlatformHealthBrief(),
      (async () => {
        const { default: eg } = await import('./ExecutiveSummaryGenerator.mjs');
        return eg.generate();
      })(),
      (async () => {
        const { default: eng } = await import('./EngineeringSummaryGenerator.mjs');
        return eng.generate();
      })(),
      (async () => {
        const { default: sec } = await import('./SecuritySummaryGenerator.mjs');
        return sec.generate();
      })(),
      (async () => {
        const { default: mi } = await import('./MerchantImpactSummaryGenerator.mjs');
        return mi.generate();
      })(),
    ]);

    const paths  = [];
    const errors = [];
    for (const r of results) {
      if (r.status === 'fulfilled') {
        const val = r.value;
        paths.push(typeof val === 'string' ? val : (val?.path ?? String(val)));
      } else {
        errors.push(r.reason?.message ?? String(r.reason));
      }
    }
    return { paths, errors, date };
  }

  /**
   * Generate the daily operational brief.
   * @returns {Promise<string>} Absolute path to the written file.
   */
  async generateDailyBrief() {
    const date = isoDate();
    const ts   = new Date().toISOString();

    // Gather all sections in parallel
    const [posture, topRisks, predictions, topRecs, goalStatus, whatChanged] = await Promise.all([
      buildPostureSection().catch(() => '## Platform Posture\n- ERROR collecting posture data'),
      buildTopRisksSection().catch(() => '## Top Risks\n- ERROR collecting risk data'),
      buildPredictionsSection().catch(() => '## Predictions\n- ERROR collecting predictions'),
      buildTopRecommendationsSection().catch(() => '## Top Recommendations\n- ERROR collecting recommendations'),
      buildGoalStatusSection().catch(() => '## Goal Status\n- ERROR collecting goal status'),
      buildWhatChangedSection().catch(() => '## What Changed\n- ERROR collecting architecture drift'),
    ]);

    // Pull operational daily report from V2 for context
    let v2Excerpt = '';
    try {
      const v2Gen = await loadV2ReportGenerator();
      if (v2Gen) {
        const rpt = await v2Gen.generateOperationalInsights();
        if (rpt && rpt.insights) {
          const topInsights = (Array.isArray(rpt.insights) ? rpt.insights : []).slice(0, 3);
          if (topInsights.length) {
            v2Excerpt = '\n## V2 Operational Highlights\n' + topInsights.map(i => `- ${i.summary ?? i.title ?? i}`).join('\n');
          }
        }
      }
    } catch { /* graceful — V2 not running */ }

    const connectionStatus = buildConnectionStatusSection();

    const content = [
      `# LetBuyy Daily Intelligence Brief — ${date}`,
      `> Generated: ${ts} | System: LCIS V3 Phase 28 | Branch: Production`,
      `> Honesty contract: structural intelligence CONNECTED; every live value labeled NOT CONNECTED + exact source.`,
      '',
      posture,
      '',
      topRisks,
      '',
      predictions,
      '',
      topRecs,
      '',
      goalStatus,
      '',
      whatChanged,
      ...(v2Excerpt ? [v2Excerpt] : []),
      '',
      connectionStatus,
      '',
      `---`,
      `_Auto-generated by DailyIntelligenceSystem.generateDailyBrief() — do not edit manually._`,
    ].join('\n');

    return writeBrief(`daily-${date}.md`, content);
  }

  /**
   * Generate the weekly rollup brief aggregating the last 7 daily briefs.
   * @returns {Promise<string>} Absolute path to the written file.
   */
  async generateWeeklyBrief() {
    const week    = isoWeek();
    const date    = isoDate();
    const ts      = new Date().toISOString();
    const dailies = readLast7Briefs();

    const lines = [
      `# LetBuyy Weekly Intelligence Rollup — ${week}`,
      `> Generated: ${ts} | Coverage: last 7 daily briefs | System: LCIS V3 Phase 28`,
      '',
    ];

    if (!dailies.length) {
      lines.push('> No daily briefs found. Run `generateDailyBrief()` each day to populate the rollup.');
    } else {
      lines.push(`## Week Covered: ${dailies[dailies.length - 1].file.replace('daily-', '').replace('.md', '')} → ${dailies[0].file.replace('daily-', '').replace('.md', '')}`);
      lines.push('');
      lines.push(`## Daily Briefs Included (${dailies.length})`);
      for (const d of dailies) {
        lines.push(`- ${d.file} (${(d.content.length / 1024).toFixed(1)} KB)`);
      }
      lines.push('');
      lines.push('## Aggregated Posture');
      // Extract posture lines from each daily
      for (const d of dailies) {
        const postureMatch = d.content.match(/## Platform Posture\n([\s\S]*?)(?=\n##|\n---)/);
        if (postureMatch) {
          const dayLabel = d.file.replace('daily-', '').replace('.md', '');
          lines.push(`### ${dayLabel}`);
          lines.push(postureMatch[1].trim());
          lines.push('');
        }
      }
      lines.push('## Aggregated Top Risks');
      // Extract risk sections
      for (const d of dailies) {
        const riskMatch = d.content.match(/## Top Risks\n([\s\S]*?)(?=\n##|\n---)/);
        if (riskMatch) {
          const dayLabel = d.file.replace('daily-', '').replace('.md', '');
          lines.push(`### ${dayLabel}`);
          lines.push(riskMatch[1].trim());
          lines.push('');
        }
      }
    }

    lines.push('');
    lines.push(buildConnectionStatusSection());
    lines.push('');
    lines.push(`---`);
    lines.push(`_Auto-generated by DailyIntelligenceSystem.generateWeeklyBrief() — do not edit manually._`);

    return writeBrief(`weekly-${week}.md`, lines.join('\n'));
  }

  /**
   * Generate the platform health brief across all subsystems + V1 production-health.
   * @returns {Promise<string>} Absolute path to the written file.
   */
  async generatePlatformHealthBrief() {
    const date = isoDate();
    const ts   = new Date().toISOString();

    const [prodHealth, launchCenter, secIntel, merchantIntel, archEngine] = await Promise.all([
      v1('/api/production-health'),
      v1('/api/launch-command-center'),
      v1('/api/security-intelligence'),
      v1('/api/merchant-intelligence'),
      loadArchitectureIntelligenceEngine(),
    ]);

    const lines = [
      `# LetBuyy Platform Health Brief — ${date}`,
      `> Generated: ${ts} | System: LCIS V3 Phase 28`,
      `> Honesty contract: structural intelligence CONNECTED; every live value labeled NOT CONNECTED + exact source.`,
      '',
      '## Production Health (V1 LCIS)',
    ];

    if (prodHealth) {
      lines.push(`- Overall: **${prodHealth.status ?? prodHealth.overall ?? 'UNKNOWN'}**`);
      const dims = Array.isArray(prodHealth.dimensions) ? prodHealth.dimensions
        : prodHealth.dimensions ? Object.entries(prodHealth.dimensions).map(([k, v]) => ({ name: k, ...v }))
        : [];
      for (const d of dims) {
        const name   = d.name ?? d.dimension ?? d.key ?? '?';
        const status = d.status ?? d.health ?? '?';
        const note   = d.note ?? d.evidence ?? '';
        lines.push(`  - **${name}**: ${status}${note ? ` — ${note}` : ''}`);
      }
    } else {
      lines.push('- **NOT CONNECTED** (source: V1 LCIS /api/production-health @ localhost:3333)');
    }

    lines.push('');
    lines.push('## Launch Command Center');
    if (launchCenter) {
      lines.push(`- Verdict: **${launchCenter.verdict ?? launchCenter.readiness?.verdict ?? launchCenter.status ?? 'UNKNOWN'}**`);
      const areas = launchCenter.areas ?? launchCenter.dimensions ?? [];
      if (Array.isArray(areas) && areas.length) {
        for (const a of areas) {
          const name = a.name ?? a.area ?? a.key ?? '?';
          const s    = a.status ?? a.readiness ?? '?';
          lines.push(`  - ${name}: **${s}**`);
        }
      }
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

    lines.push('');
    lines.push('## Security Posture');
    if (secIntel) {
      const posture = secIntel.posture ?? secIntel.overallPosture ?? 'UNKNOWN';
      lines.push(`- Posture: **${posture}**`);
      const controls = secIntel.controls ?? secIntel.securityControls ?? [];
      if (Array.isArray(controls) && controls.length) {
        const critical = controls.filter(c => c.critical || c.criticality === 'CRITICAL');
        lines.push(`- Critical controls: ${critical.length}/${controls.length}`);
        for (const c of critical.slice(0, 4)) {
          const name = c.name ?? c.id ?? '?';
          const s    = c.status ?? c.coverage ?? '?';
          lines.push(`  - ${name}: ${s}`);
        }
      }
    } else {
      lines.push('- **NOT CONNECTED** (source: V1 LCIS /api/security-intelligence @ localhost:3333)');
    }

    lines.push('');
    lines.push('## Merchant Platform Health');
    if (merchantIntel) {
      const merchantCount = merchantIntel.merchantCount ?? merchantIntel.totalMerchants;
      if (merchantCount != null) {
        lines.push(`- Active merchants: ${merchantCount} (source: Supabase sites table — CONNECTED)`);
      } else {
        lines.push('- Active merchant count: **NOT CONNECTED** (source: Supabase `sites` table)');
      }
      const risks = merchantIntel.risks ?? merchantIntel.merchantRisks ?? [];
      if (Array.isArray(risks) && risks.length) {
        lines.push(`- Merchant risks: ${risks.length}`);
        for (const r of risks.slice(0, 3)) {
          const desc = typeof r === 'string' ? r : (r.description ?? r.title ?? JSON.stringify(r).slice(0, 80));
          lines.push(`  - ${desc}`);
        }
      }
    } else {
      lines.push('- **NOT CONNECTED** (source: V1 LCIS /api/merchant-intelligence @ localhost:3333)');
    }

    lines.push('');
    lines.push('## Architecture Health');
    if (archEngine) {
      try {
        const health = await archEngine.getHealth();
        if (health) {
          lines.push(`- Engine status: ${health.status ?? 'OK'}`);
          if (health.engines) {
            for (const [k, v] of Object.entries(health.engines)) {
              lines.push(`  - ${k}: ${v?.status ?? v ?? '?'}`);
            }
          }
        }
      } catch {
        lines.push('- Architecture engine: loaded but getHealth() failed — run `pnpm graph:omega`');
      }
    } else {
      lines.push('- Architecture engine: **NOT CONNECTED** (engine unavailable)');
    }

    lines.push('');
    lines.push(buildConnectionStatusSection());
    lines.push('');
    lines.push('---');
    lines.push('_Auto-generated by DailyIntelligenceSystem.generatePlatformHealthBrief() — do not edit manually._');

    return writeBrief(`platform-health-${date}.md`, lines.join('\n'));
  }

  /**
   * Get the latest brief of a given type.
   * @param {'daily'|'weekly'|'platform-health'|'executive-summary'|'engineering-summary'|'security-summary'|'merchant-impact'} type
   * @returns {{ path: string, content: string, generatedAt: string } | null}
   */
  getLatestBrief(type) {
    ensureBriefsDir();
    const prefix = type + '-';
    let files;
    try {
      files = readdirSync(BRIEFS_DIR)
        .filter(f => f.startsWith(prefix) && f.endsWith('.md'))
        .sort()
        .reverse();
    } catch { return null; }

    if (!files.length) return null;
    const p = join(BRIEFS_DIR, files[0]);
    try {
      const content = readFileSync(p, 'utf8');
      const stat    = statSync(p);
      return { path: p, content, generatedAt: stat.mtime.toISOString() };
    } catch { return null; }
  }
}

export default new DailyIntelligenceSystem();
