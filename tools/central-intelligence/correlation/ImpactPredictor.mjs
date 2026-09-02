/**
 * LCIS Phase 16 — ImpactPredictor
 *
 * Forward-propagation impact analysis: given a change (code, schema, config,
 * deployment), identify which services, domains, merchants, and revenue paths
 * will be affected.
 *
 * Architecture notes
 * ──────────────────
 * • All stores share the same schema (multi-tenant via site_id).  A schema
 *   change or shared-service failure therefore affects ALL merchants.
 * • Revenue amounts are NOT CONNECTED — we identify the money tables/RPCs that
 *   lie on the affected path but never fabricate monetary figures.
 * • Blast radius from LCIS V1 /api/blast is the primary structural signal;
 *   we augment it with dependency graph traversal.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const GRAPHIFY_OUT = resolve(REPO_ROOT, 'graphify-out');

const LCIS_BASE = process.env.LCIS_URL ?? 'http://localhost:3333';

// ── Money metadata ─────────────────────────────────────────────────────────
// Tables and RPCs that carry monetary semantics — touching these raises
// revenueAtRisk to "REVIEW REQUIRED".
const MONEY_TABLES = new Set([
  'payment_transactions', 'refunds', 'payouts', 'orders', 'order_items',
  'gift_card_accounts', 'gift_card_ledger_entries', 'gift_card_redemptions',
]);
const MONEY_RPCS = new Set([
  'create_checkout_order', 'confirm_order_payment_with_ledger',
  'complete_order_refund', 'issue_gift_card', 'set_gift_card_status',
  'restore_gift_card_on_refund',
]);
const MONEY_DOMAINS = new Set([
  'payments', 'orders', 'checkout', 'refunds', 'gift_cards', 'payouts', 'billing',
]);
const SHARED_SERVICES = new Set([
  'getSupabaseAdmin', '@letbuyy/shared-types', '@letbuyy/api-client',
  'create_checkout_order',
]);

// ── Helpers ────────────────────────────────────────────────────────────────

function readOut(name) {
  try {
    const p = resolve(GRAPHIFY_OUT, name);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch { return null; }
}

async function fetchLCIS(path, params = {}) {
  try {
    const url = new URL(LCIS_BASE + path);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

async function tryImport(rel) {
  try {
    const m = await import(new URL(rel, import.meta.url).href);
    return m.default ?? null;
  } catch { return null; }
}

function normalise(s) { return (s ?? '').toLowerCase().trim(); }

function isMoneyPath(component) {
  const c = normalise(component);
  for (const t of MONEY_TABLES) { if (c.includes(t)) return true; }
  for (const r of MONEY_RPCS) { if (c.includes(r)) return true; }
  for (const d of MONEY_DOMAINS) { if (c.includes(d)) return true; }
  return false;
}

function isSharedService(component) {
  const c = normalise(component);
  for (const s of SHARED_SERVICES) { if (c.includes(normalise(s))) return true; }
  return false;
}

// ── ImpactPredictor ────────────────────────────────────────────────────────

class ImpactPredictor {

  /**
   * Forward-propagate a change through the dependency + cross-domain + FK graph.
   *
   * @param {{
   *   component?: string,
   *   domain?: string,
   *   type?: 'code'|'schema'|'config'|'deployment',
   *   description?: string
   * }} change
   * @returns {Promise<{
   *   change: object,
   *   affectedServices: string[],
   *   affectedDomains: string[],
   *   affectedMerchants: string,
   *   revenueAtRisk: string,
   *   blastRadius: object,
   *   confidence: 'HIGH'|'MEDIUM'|'LOW',
   *   note: string
   * }>}
   */
  async predict(change) {
    const component = change.component ?? change.domain ?? '';
    const [services, domains, merchants, revenue, blast] = await Promise.allSettled([
      this.getAffectedServices(component),
      this.getAffectedDomains(component),
      this.getAffectedMerchants(component),
      this.estimateRevenueAtRisk(component),
      this.getBlastRadius(component),
    ]);

    const affectedServices = services.status === 'fulfilled' ? services.value : [];
    const affectedDomains = domains.status === 'fulfilled' ? domains.value : [];
    const affectedMerchants = merchants.status === 'fulfilled' ? merchants.value : 'unknown — merchant count NOT CONNECTED (source: sites table count via RPC)';
    const revenueAtRisk = revenue.status === 'fulfilled' ? revenue.value : 'NOT CONNECTED';
    const blastData = blast.status === 'fulfilled' ? blast.value : { error: 'blast radius unavailable' };

    const confidence = affectedDomains.length > 0 && affectedServices.length > 0 ? 'HIGH'
      : affectedDomains.length > 0 || affectedServices.length > 0 ? 'MEDIUM'
      : 'LOW';

    return {
      change,
      affectedServices,
      affectedDomains,
      affectedMerchants,
      revenueAtRisk,
      blastRadius: blastData,
      confidence,
      note: 'Revenue amounts are NOT CONNECTED — sources: payment_transactions ledger + Razorpay payout API. Merchant count is NOT CONNECTED — source: SELECT count(*) FROM sites.',
    };
  }

  // ── Affected Services ──────────────────────────────────────────────────────

  /**
   * Find services directly or transitively consuming the component.
   * @param {string} component
   * @returns {Promise<string[]>}
   */
  async getAffectedServices(component) {
    const services = new Set();

    // 1. LCIS V1 graph consumers
    const blastData = await fetchLCIS('/api/blast', { q: component });
    if (blastData?.affected) {
      for (const a of blastData.affected) {
        const name = a.name ?? a.id ?? a;
        if (typeof name === 'string') services.add(name);
      }
    }

    // 2. Dependency graph traversal
    const builder = await tryImport('../context-intelligence/DependencyGraphBuilder.mjs');
    if (builder && typeof builder.buildGraph === 'function') {
      const graph = await builder.buildGraph().catch(() => null);
      if (graph?.edges) {
        for (const edge of graph.edges) {
          if (normalise(edge.source) === normalise(component) ||
              normalise(edge.target) === normalise(component)) {
            services.add(edge.source);
            services.add(edge.target);
          }
        }
      }
    }

    // 3. Infra intel snapshot
    if (services.size === 0) {
      const infra = readOut('infra-intel.json');
      if (infra?.services) {
        const c = normalise(component);
        for (const [svcName, svc] of Object.entries(infra.services)) {
          const deps = (svc.dependencies ?? svc.dependsOn ?? []).map(normalise);
          if (deps.includes(c) || normalise(svcName) === c) {
            services.add(svcName);
          }
        }
      }
    }

    // 4. Known topology for super-high-blast symbols
    if (isSharedService(component)) {
      for (const svc of [
        'customer-web', 'merchant-web', 'identity-platform',
        'services/api-gateway', 'services/queue-workers', 'services/webhook-service',
      ]) services.add(svc);
    }

    return [...services].filter((s) => s && normalise(s) !== normalise(component));
  }

  // ── Affected Domains ───────────────────────────────────────────────────────

  /**
   * Find business domains affected by the change via cross-domain graph.
   * @param {string} component
   * @returns {Promise<string[]>}
   */
  async getAffectedDomains(component) {
    const domains = new Set();
    const c = normalise(component);

    // 1. LCIS cross-domain endpoint
    const cross = await fetchLCIS('/api/cross-domain', { key: c });
    if (cross?.dependsOn) for (const d of cross.dependsOn) domains.add(typeof d === 'string' ? d : d.key ?? d.name ?? '');
    if (cross?.consumedBy) for (const d of cross.consumedBy) domains.add(typeof d === 'string' ? d : d.key ?? d.name ?? '');

    // 2. Domain intel snapshot
    if (domains.size === 0) {
      const intel = readOut('domain-intel.json');
      const list = Array.isArray(intel) ? intel : Object.values(intel ?? {});
      for (const domain of list) {
        const key = normalise(domain.key ?? domain.name ?? '');
        const tables = (domain.tables ?? []).map(normalise);
        const rpcs = (domain.rpcs ?? []).map(normalise);
        const routes = (domain.routes ?? []).map(normalise);
        if (key.includes(c) || tables.some((t) => c.includes(t) || t.includes(c))
            || rpcs.some((r) => c.includes(r) || r.includes(c))
            || routes.some((r) => c.includes(r))) {
          domains.add(domain.key ?? domain.name ?? key);
        }
      }
    }

    // 3. Keyword heuristic for well-known change types
    if (domains.size === 0 && c) {
      if (c.includes('payment') || c.includes('razorpay') || c.includes('cod')) {
        for (const d of ['payments', 'orders', 'checkout', 'refunds']) domains.add(d);
      }
      if (c.includes('auth') || c.includes('jwt') || c.includes('session')) {
        for (const d of ['identity', 'auth', 'tenancy']) domains.add(d);
      }
      if (c.includes('theme') || c.includes('liquid')) {
        domains.add('themes');
      }
      if (c.includes('product') || c.includes('inventory') || c.includes('collection')) {
        for (const d of ['products', 'inventory']) domains.add(d);
      }
    }

    return [...domains].filter(Boolean);
  }

  // ── Affected Merchants ─────────────────────────────────────────────────────

  /**
   * All merchants are structurally affected by schema/shared-service changes
   * because all stores share the same schema (multi-tenant via site_id).
   * @param {string} component
   * @returns {Promise<string>}
   */
  async getAffectedMerchants(component) {
    // Multi-tenant architecture: all stores share the schema.
    // Any shared-service or schema-level change reaches every site_id.
    if (isSharedService(component)) {
      return 'ALL merchants (shared schema — every site_id affected; exact count NOT CONNECTED: source SELECT count(*) FROM sites)';
    }

    if (isMoneyPath(component)) {
      return 'ALL merchants transacting through the affected payment path (exact count NOT CONNECTED: source payment_transactions grouped by site_id)';
    }

    // Try to get domain context
    const affectedDomains = await this.getAffectedDomains(component).catch(() => []);
    if (affectedDomains.length > 0) {
      return `All merchants whose operations touch domain(s) [${affectedDomains.join(', ')}] — exact segment NOT CONNECTED (source: sites + domain-usage analytics)`;
    }

    return 'Merchant scope unknown — structural analysis incomplete. Assume broad impact for any shared-service or schema change (multi-tenant: one schema, all site_id rows).';
  }

  // ── Revenue at Risk ────────────────────────────────────────────────────────

  /**
   * Identify money tables/RPCs on the affected path.
   * Magnitude is NOT CONNECTED — we name the exact source.
   * @param {string} component
   * @returns {Promise<string>}
   */
  async estimateRevenueAtRisk(component) {
    const c = normalise(component);

    const hitTables = [...MONEY_TABLES].filter((t) => c.includes(t));
    const hitRpcs = [...MONEY_RPCS].filter((r) => c.includes(r));
    const hitDomains = [...MONEY_DOMAINS].filter((d) => c.includes(d));

    const isOnMoneyPath = hitTables.length > 0 || hitRpcs.length > 0 || hitDomains.length > 0;

    if (!isOnMoneyPath) {
      // Check domain-intel for indirect money connections
      const affectedDomains = await this.getAffectedDomains(component).catch(() => []);
      const indirectMoney = affectedDomains.some((d) => MONEY_DOMAINS.has(normalise(d)));
      if (!indirectMoney) {
        return 'NOT ON MONEY PATH — no direct revenue impact detected';
      }
      return `INDIRECT MONEY RISK via domain(s) [${affectedDomains.join(', ')}] — revenue magnitude NOT CONNECTED (source: payment_transactions ledger reconciliation RPC + Razorpay payout API)`;
    }

    const parts = [];
    if (hitTables.length) parts.push(`tables: [${hitTables.join(', ')}]`);
    if (hitRpcs.length) parts.push(`RPCs: [${hitRpcs.join(', ')}]`);
    if (hitDomains.length) parts.push(`domains: [${hitDomains.join(', ')}]`);

    return `MONEY PATH HIT — ${parts.join('; ')}. Revenue magnitude NOT CONNECTED (source: payment_transactions ledger, confirm_order_payment_with_ledger RPC, Razorpay dashboard API). Idempotency + ledger integrity must be verified before deploying.`;
  }

  // ── Blast Radius ───────────────────────────────────────────────────────────

  /**
   * Get blast radius from LCIS V1 /api/blast; fall back to local graph.
   * @param {string} component
   * @returns {Promise<object>}
   */
  async getBlastRadius(component) {
    // Primary: LCIS V1
    const blast = await fetchLCIS('/api/blast', { q: component });
    if (blast) return { ...blast, source: 'LCIS /api/blast', connected: true };

    // Fallback: domain cross-impact from snapshot
    const domainIntel = readOut('domain-intel.json');
    if (domainIntel) {
      const c = normalise(component);
      const list = Array.isArray(domainIntel) ? domainIntel : Object.values(domainIntel);
      const matching = list.filter((d) =>
        normalise(d.key ?? d.name ?? '').includes(c) ||
        (d.tables ?? []).some((t) => normalise(t).includes(c))
      );
      return {
        source: 'graphify-out/domain-intel.json snapshot',
        connected: false,
        note: 'NOT CONNECTED to live graph — run LCIS at :3333 for precise blast radius',
        matchingDomains: matching.map((d) => d.key ?? d.name),
      };
    }

    return {
      source: 'unavailable',
      connected: false,
      note: 'Blast radius NOT CONNECTED — source: LCIS /api/blast (requires pnpm graph:v3 and LCIS running at :3333)',
    };
  }
}

export default new ImpactPredictor();
