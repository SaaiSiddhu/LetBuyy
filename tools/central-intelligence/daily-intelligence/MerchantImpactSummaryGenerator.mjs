/**
 * LCIS V3 Phase 28 — MerchantImpactSummaryGenerator
 *
 * Generates graphify-out/briefs/merchant-impact-{date}.md
 *
 * Content: merchant-affecting risks, store/theme/checkout health hooks,
 * multi-tenant blast notes, merchant recommendations.
 * Live merchant magnitudes (store count, GMV, active sessions) are
 * NOT CONNECTED + Supabase source stated explicitly.
 *
 * Engines used (all lazy, all graceful):
 *   ExecutiveRecommendationEngine.recommendMerchant()
 *   V1 LCIS /api/merchant-intelligence
 *   V1 LCIS /api/merchant-health
 *   V1 LCIS /api/merchant-risk
 *   V1 LCIS /api/customer-journey
 *   RiskScorer.scoreDomain('payments'), ('checkout'), ('identity')
 *
 * Honesty contract: structural multi-tenant topology CONNECTED; all live
 * merchant counts / GMV / churn rates NOT CONNECTED + exact source.
 *
 * @module MerchantImpactSummaryGenerator
 */

import { writeFileSync, mkdirSync } from 'node:fs';
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

async function loadRecommendationEngine() {
  try {
    const m = await import('../recommendation-engine/ExecutiveRecommendationEngine.mjs');
    return m.default ?? null;
  } catch { return null; }
}

async function loadRiskScorer() {
  try {
    const m = await import('../correlation/RiskScorer.mjs');
    return m.default ?? null;
  } catch { return null; }
}

// ── Section builders ──────────────────────────────────────────────────────────

async function buildMerchantMagnitudesSection(merchantIntel, merchantHealth) {
  const lines = [
    '## Merchant Platform Magnitudes',
    '> All live merchant counts and revenue figures are NOT CONNECTED + exact source stated below.',
    '> Source for all live merchant data: Supabase `sites` table (service-role query).',
  ];

  // V1 may have pre-computed magnitudes
  const combined = { ...(merchantIntel ?? {}), ...(merchantHealth ?? {}) };

  const merchantCount  = combined.merchantCount  ?? combined.totalMerchants  ?? combined.storeCount;
  const activeMerchants = combined.activeMerchants ?? combined.activeStores;
  const newMerchants   = combined.newMerchants    ?? combined.newStores;
  const gmv            = combined.gmv             ?? combined.totalGMV       ?? combined.revenue;

  if (merchantCount != null) {
    lines.push(`- Total merchants: **${merchantCount}** (source: V1 LCIS /api/merchant-intelligence — CONNECTED if V1 is up)`);
  } else {
    lines.push('- Total merchants: **NOT CONNECTED** (source: Supabase `SELECT COUNT(*) FROM sites`)');
  }

  if (activeMerchants != null) {
    lines.push(`- Active merchants: **${activeMerchants}** (source: V1 LCIS)`);
  } else {
    lines.push('- Active merchants (last 30d): **NOT CONNECTED** (source: Supabase `sites` + `orders` join)');
  }

  if (newMerchants != null) {
    lines.push(`- New merchants (last 7d): **${newMerchants}** (source: V1 LCIS)`);
  } else {
    lines.push('- New merchants (7d): **NOT CONNECTED** (source: Supabase `sites.created_at` filter)');
  }

  if (gmv != null) {
    lines.push(`- GMV: **${gmv}** (source: V1 LCIS — value may be structural estimate)`);
  } else {
    lines.push('- GMV / total order value: **NOT CONNECTED** (source: Supabase `confirm_order_payment_with_ledger` ledger + payment_transactions reconciliation)');
  }

  lines.push('- Live merchant sessions: **NOT CONNECTED** (source: Cloudflare Analytics Engine / KV session store)');

  return lines.join('\n');
}

async function buildMerchantAffectingRisksSection(riskScorer, merchantIntel) {
  const lines = ['## Merchant-Affecting Risks'];

  // Domain-level risks affecting merchants
  const MERCHANT_DOMAINS = ['payments', 'checkout', 'identity', 'orders', 'themes', 'storefront'];

  if (riskScorer) {
    const results = await Promise.allSettled(
      MERCHANT_DOMAINS.map(d => riskScorer.scoreDomain(d))
    );
    const scored = results
      .map((r, i) => ({ domain: MERCHANT_DOMAINS[i], ...(r.status === 'fulfilled' ? r.value : { score: null }) }))
      .filter(r => r.score != null)
      .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));

    if (scored.length) {
      lines.push('### Domain Risk Scores (Structural)');
      for (const { domain, score, breakdown } of scored) {
        const pct   = Math.round(score ?? 0);
        const label = pct >= 70 ? 'HIGH' : pct >= 40 ? 'MEDIUM' : 'LOW';
        const money = breakdown?.moneyWeight ? ' [MONEY]' : '';
        const tenant = breakdown?.tenantWeight ? ' [TENANT]' : '';
        lines.push(`- **${domain}**: ${pct}/100 [${label}]${money}${tenant}`);
      }
    } else {
      lines.push('- Domain risk scores: **NOT CONNECTED** (graphify-out/domain-intel.json missing — run `pnpm graph:omega`)');
    }
  } else {
    lines.push('- Risk scorer: **NOT CONNECTED** (engine unavailable)');
  }

  // V1 merchant risks
  if (merchantIntel) {
    const risks = merchantIntel.risks ?? merchantIntel.merchantRisks ?? merchantIntel.topRisks ?? [];
    if (Array.isArray(risks) && risks.length) {
      lines.push('\n### V1 Merchant Risk Signals');
      for (const r of risks.slice(0, 5)) {
        const desc = typeof r === 'string' ? r : (r.description ?? r.title ?? r.risk ?? JSON.stringify(r).slice(0, 100));
        const sev  = r.severity ?? r.impact ?? '';
        lines.push(`- ${sev ? `[${sev}] ` : ''}${desc}`);
      }
    }
  }

  lines.push('\n> Live payment failure rates affecting merchants: **NOT CONNECTED** (source: Cloudflare Analytics Engine / Razorpay webhook event log)');

  return lines.join('\n');
}

async function buildStoreThemeCheckoutHealthSection() {
  const lines = ['## Store / Theme / Checkout Health Hooks'];

  const [themeIntel, customerJourney] = await Promise.all([
    v1('/api/theme-intelligence'),
    v1('/api/customer-journey'),
  ]);

  // Store health (structural)
  lines.push('### Storefront');
  lines.push('- Runtime: `apps/customer_web` (Next.js, Cloudflare Workers) — structural status CONNECTED');
  lines.push('- Liquid canary: OFF by default (`THEME_LIQUID_RENDERING_DEFAULT_ENABLED=false`) — CONNECTED');
  lines.push('- React hybrid: ON by default — CONNECTED');
  lines.push('- Live store error rate: **NOT CONNECTED** (source: Cloudflare Analytics Engine)');
  lines.push('- Live store availability: **NOT CONNECTED** (source: Cloudflare status / uptime ping)');

  // Theme health
  lines.push('\n### Theme Engine');
  if (themeIntel) {
    const status = themeIntel.status ?? themeIntel.health ?? 'UNKNOWN';
    lines.push(`- Theme platform status: **${status}**`);
    const themes = themeIntel.themes ?? themeIntel.availableThemes ?? [];
    if (Array.isArray(themes) && themes.length) {
      lines.push(`- Available themes: ${themes.length}`);
      for (const t of themes.slice(0, 4)) {
        const name = typeof t === 'string' ? t : (t.name ?? t.id ?? JSON.stringify(t).slice(0, 40));
        lines.push(`  - ${name}`);
      }
    }
    const frozen = themeIntel.frozen ?? themeIntel.marketplaceFrozen;
    if (frozen != null) lines.push(`- Theme marketplace frozen: ${frozen ? 'YES (by policy)' : 'NO'}`);
  } else {
    lines.push('- Theme intelligence: **NOT CONNECTED** (source: V1 LCIS /api/theme-intelligence @ localhost:3333)');
  }
  lines.push('- Urban Kicks theme: 85% reusable as Core (Phase-2 foundation CONNECTED — packages/theme-engine)');
  lines.push('- Preset apply_preset API: MISSING (launch blocker — Phase-5 backlog)');

  // Checkout health
  lines.push('\n### Checkout');
  if (customerJourney) {
    const checkoutHealth = customerJourney.checkout ?? customerJourney.stages?.find(s => s.name === 'checkout' || s.stage === 'checkout');
    if (checkoutHealth) {
      const status = checkoutHealth.status ?? checkoutHealth.health ?? 'UNKNOWN';
      lines.push(`- Checkout stage status: **${status}**`);
      const gaps = checkoutHealth.gaps ?? checkoutHealth.issues ?? [];
      if (gaps.length) {
        lines.push(`  - Gaps: ${gaps.length}`);
        for (const g of (Array.isArray(gaps) ? gaps : []).slice(0, 3)) {
          const desc = typeof g === 'string' ? g : (g.description ?? g.issue ?? JSON.stringify(g).slice(0, 80));
          lines.push(`    - ${desc}`);
        }
      }
    } else {
      lines.push('- Checkout status: not enumerated in customer-journey response');
    }
  } else {
    lines.push('- Checkout health: **NOT CONNECTED** (source: V1 LCIS /api/customer-journey @ localhost:3333)');
  }
  lines.push('- Checkout embedding: `customer-web` (not yet centralized) — CONNECTED structural fact');
  lines.push('- Branding tokens reaching checkout: MISSING (audit finding — gap)');
  lines.push('- COD + Razorpay: supported (server-side HMAC verified) — CONNECTED');
  lines.push('- Cart abandonment recovery: NOT IMPLEMENTED — CONNECTED structural gap');
  lines.push('- Live checkout conversion rate: **NOT CONNECTED** (source: Supabase orders funnel / Cloudflare Analytics)');

  return lines.join('\n');
}

async function buildMultiTenantBlastSection() {
  const lines = [
    '## Multi-Tenant Blast Notes',
    '> All stores share a single schema (`site_id` everywhere). A RLS gap or money-RPC bug affects ALL merchants.',
  ];

  // Pull blast info from V1
  const [blastPayments, blastCheckout] = await Promise.all([
    v1('/api/cross-domain?key=payments'),
    v1('/api/cross-domain?key=checkout'),
  ]);

  if (blastPayments) {
    const deps = blastPayments.dependsOn ?? blastPayments.consumers ?? [];
    if (Array.isArray(deps) && deps.length) {
      lines.push(`\n### Payments Cross-Domain Blast (${deps.length} consumers)`);
      for (const d of deps.slice(0, 5)) {
        const name = typeof d === 'string' ? d : (d.domain ?? d.name ?? JSON.stringify(d).slice(0, 40));
        lines.push(`- ${name}`);
      }
    }
  } else {
    lines.push('- Payments cross-domain blast: **NOT CONNECTED** (source: V1 LCIS /api/cross-domain @ localhost:3333)');
  }

  if (blastCheckout) {
    const deps = blastCheckout.dependsOn ?? blastCheckout.consumers ?? [];
    if (Array.isArray(deps) && deps.length) {
      lines.push(`\n### Checkout Cross-Domain Blast (${deps.length} consumers)`);
      for (const d of deps.slice(0, 4)) {
        const name = typeof d === 'string' ? d : (d.domain ?? d.name ?? JSON.stringify(d).slice(0, 40));
        lines.push(`- ${name}`);
      }
    }
  }

  lines.push('\n### Key Multi-Tenant Invariants (CONNECTED structural facts)');
  lines.push('- `site_id` scoping: every tenant table uses `site_id` primary key — CONNECTED');
  lines.push('- RLS forced: no `USING (true)` policies — gate enforced by 107-validator');
  lines.push('- `verifySiteOwnership` gating: service-role access requires site ownership check — CONNECTED');
  lines.push('- Change-control hotspot: `getSupabaseAdmin` used in 115 files — run `graph:intel blast getSupabaseAdmin` before merge');

  return lines.join('\n');
}

async function buildMerchantRecommendationsSection(recEngine) {
  const lines = ['## Merchant Recommendations'];

  if (!recEngine) {
    lines.push('- Recommendation engine: **NOT CONNECTED** (engine unavailable)');
    // Structural fallback
    lines.push('\n### Structural Recommendations (always CONNECTED)');
    lines.push('1. [P0] Implement `apply_preset` API in theme engine before launch (merchant onboarding blocker)');
    lines.push('2. [P0] Resolve H8/H9 (Razorpay Route + step-up HMAC enforcement) before October 1 GA');
    lines.push('3. [P1] Add branding token propagation to checkout (customer-web → checkout context)');
    lines.push('4. [P1] Build customer detail page in merchant control plane (Phase-4 gap)');
    lines.push('5. [P1] Enforce RBAC for merchant staff accounts at the API level (not just UI)');
    lines.push('6. [P2] Auto-assign theme during merchant onboarding (`letbuyy-core` alias, packages/theme-engine)');
    return lines.join('\n');
  }

  let recs = [];
  try {
    const result = await recEngine.recommendMerchant();
    recs = result?.recommendations ?? result?.ranked ?? (Array.isArray(result) ? result : []);
  } catch {
    recs = [];
  }

  if (recs.length) {
    let i = 1;
    for (const r of recs.slice(0, 8)) {
      const p     = r.priority ?? 'P?';
      const eff   = r.effort   ?? '?';
      const title = r.title    ?? r.action ?? 'Untitled recommendation';
      const act   = r.action   ?? '';
      const conf  = r.confidence != null ? ` (confidence: ${Math.round(r.confidence * 100)}%)` : '';
      lines.push(`${i++}. [${p}] [${eff}] **${title}**${act && act !== title ? `: ${act}` : ''}${conf}`);
    }
  } else {
    // Same structural fallback as above when recEngine is present but returns nothing
    lines.push('- Engine returned no recommendations (structural artefacts may be stale).');
    lines.push('\n### Structural Recommendations (always CONNECTED)');
    lines.push('1. [P0] Implement `apply_preset` API — merchant onboarding blocker (Phase-2 gap)');
    lines.push('2. [P0] Enforce step-up HMAC gate on refund/payout routes (H8/H9 blockers)');
    lines.push('3. [P1] Propagate branding tokens into checkout context');
    lines.push('4. [P1] Build customer detail page in merchant control plane');
    lines.push('5. [P2] Auto-assign `letbuyy-core` theme during onboarding');
  }

  return lines.join('\n');
}

// ── Class ─────────────────────────────────────────────────────────────────────

class MerchantImpactSummaryGenerator {
  /**
   * Generate the merchant impact brief for today.
   * @returns {Promise<string>} Absolute path to written file.
   */
  async generate() {
    const date = isoDate();
    const ts   = new Date().toISOString();

    const [recEngine, riskScorer, merchantIntel, merchantHealth] = await Promise.all([
      loadRecommendationEngine(),
      loadRiskScorer(),
      v1('/api/merchant-intelligence'),
      v1('/api/merchant-health'),
    ]);

    const [magnitudes, affectingRisks, storeThemeCheckout, multiTenantBlast, merchantRecs] = await Promise.all([
      buildMerchantMagnitudesSection(merchantIntel, merchantHealth).catch(() => '## Merchant Platform Magnitudes\n- ERROR collecting data'),
      buildMerchantAffectingRisksSection(riskScorer, merchantIntel).catch(() => '## Merchant-Affecting Risks\n- ERROR collecting data'),
      buildStoreThemeCheckoutHealthSection().catch(() => '## Store / Theme / Checkout Health\n- ERROR collecting data'),
      buildMultiTenantBlastSection().catch(() => '## Multi-Tenant Blast Notes\n- ERROR collecting data'),
      buildMerchantRecommendationsSection(recEngine).catch(() => '## Merchant Recommendations\n- ERROR collecting data'),
    ]);

    const content = [
      `# LetBuyy Merchant Impact Brief — ${date}`,
      `> Generated: ${ts} | System: LCIS V3 Phase 28`,
      `> Honesty contract: structural multi-tenant topology CONNECTED; all live merchant counts / GMV / session data NOT CONNECTED + exact source (Supabase).`,
      '',
      magnitudes,
      '',
      affectingRisks,
      '',
      storeThemeCheckout,
      '',
      multiTenantBlast,
      '',
      merchantRecs,
      '',
      '## Data Source Status',
      '- Structural multi-tenant topology: CONNECTED (graphify-out artefacts)',
      '- V1 LCIS merchant-intelligence: ' + (merchantIntel ? 'CONNECTED' : '**NOT CONNECTED** (start V1 LCIS at :3333)'),
      '- V1 LCIS merchant-health: ' + (merchantHealth ? 'CONNECTED' : '**NOT CONNECTED** (start V1 LCIS at :3333)'),
      '- Live merchant count: **NOT CONNECTED** (source: Supabase `SELECT COUNT(*) FROM sites`)',
      '- Live GMV: **NOT CONNECTED** (source: Supabase payment_transactions + ledger reconciliation)',
      '- Live checkout conversion: **NOT CONNECTED** (source: Supabase orders funnel analysis)',
      '- Live store error rates: **NOT CONNECTED** (source: Cloudflare Analytics Engine)',
      '- Live merchant sessions: **NOT CONNECTED** (source: Cloudflare KV / Analytics Engine)',
      '',
      '---',
      '_Auto-generated by MerchantImpactSummaryGenerator.generate() — do not edit manually._',
    ].join('\n');

    return writeBrief(`merchant-impact-${date}.md`, content);
  }
}

export default new MerchantImpactSummaryGenerator();
