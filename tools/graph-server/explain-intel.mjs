#!/usr/bin/env node
// LCIS v6 — Explain Intelligence. Builds the dual-mode (Explain + Technical) content model that
// turns LCIS into LetBuyy's operating system: per-domain Purpose/Importance/Criticality/Owner/
// Dependencies/Consumers/Failure-impact/Operational-notes + the Technical reveal (routes/rpcs/
// tables/policies/workers/queues/secrets) + an AI-context block + Atlas links + flows.
//
// Plain-language descriptions explain what the REAL schema/routes do (repository truth in prose) —
// no fabricated metrics. Live values stay query-bound exactly as in the underlying engines.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const g = (f) => existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : null;

// Authored plain-language descriptions of what each domain actually does (grounded in its tables/RPCs).
const NARRATIVE = {
  orders:        { purpose: 'Captures and orchestrates the order lifecycle — cart → checkout → order → fulfillment.', importance: 'The commerce spine; every sale flows through it.', failureImpact: 'Checkout breaks; no new orders; revenue stops.' },
  payments:      { purpose: 'Authorizes and captures money (Razorpay + COD) and posts it to the canonical double-entry ledger.', importance: 'Server-authoritative money movement; the financial source of truth.', failureImpact: 'Payments fail or mis-post; revenue and ledger integrity at risk.' },
  refunds:       { purpose: 'Reverses captured payments and restores gift-card balances via SECURITY DEFINER RPCs with step-up.', importance: 'Customer trust + financial correctness on returns.', failureImpact: 'Refunds stuck or double-refunded; chargebacks; ledger drift.' },
  payouts:       { purpose: 'Settles merchant earnings — settlement, commission, partner payout ledgers.', importance: 'Merchants get paid; platform economics.', failureImpact: 'Merchants unpaid; settlement disputes.' },
  'gift-cards':  { purpose: 'Issues, redeems and restores gift cards as a ledger projection (no mutable decrement).', importance: 'Stored-value liability that must always reconcile.', failureImpact: 'Unredeemable codes or balance leaks; liability mismatch.' },
  gst:           { purpose: 'Computes India GST server-side and issues immutable invoices.', importance: 'Legal tax compliance for every order.', failureImpact: 'Wrong tax; non-compliant invoices; legal exposure.' },
  discounts:     { purpose: 'Applies coupons, promotions and marketing campaigns at checkout.', importance: 'Conversion + merchant marketing.', failureImpact: 'Wrong pricing; promo abuse; lost margin.' },
  shipping:      { purpose: 'Manages shipping zones/rates, fulfillment orders, shipments and labels.', importance: 'Physical delivery of every order.', failureImpact: 'Orders cannot ship; tracking breaks.' },
  inventory:     { purpose: 'Tracks stock levels, reservations, transfers and adjustments per location.', importance: 'Prevents overselling; reserves stock at checkout.', failureImpact: 'Overselling or false out-of-stock; checkout failures.' },
  products:      { purpose: 'The catalog — products, options, variants and metafields.', importance: 'What merchants sell; the storefront source.', failureImpact: 'Catalog unavailable; storefront empty.' },
  collections:   { purpose: 'Groups products into collections and categories for merchandising.', importance: 'Storefront navigation + discovery.', failureImpact: 'Broken navigation; products undiscoverable.' },
  storefront:    { purpose: 'The customer-facing store rendered per tenant (Liquid/React) with cart and public pages.', importance: 'The buyer experience; the revenue surface.', failureImpact: 'Store down; no traffic converts.' },
  identity:      { purpose: 'Customer + merchant identity records, KYC and onboarding.', importance: 'Who the actors are; trust + compliance.', failureImpact: 'Cannot identify/onboard; KYC gaps.' },
  authentication:{ purpose: 'Issues sessions — customer HS256, merchant ES256 — with Turnstile and 2FA.', importance: 'Proves who is calling; the front door.', failureImpact: 'Logins fail or sessions forgeable; account takeover risk.' },
  authorization: { purpose: 'RBAC, permissions, entitlements and step-up HMAC gating refunds/payouts.', importance: 'What an authenticated actor may do.', failureImpact: 'Privilege escalation or blocked operators.' },
  merchant:      { purpose: 'Stores/sites, memberships, employees, billing and onboarding.', importance: 'The tenant — the unit LetBuyy sells to.', failureImpact: 'Merchant management down; onboarding blocked.' },
  themes:        { purpose: 'Theme engine — Liquid/JSON rendering with a locked sanitizer.', importance: 'Storefront appearance + safety.', failureImpact: 'Store renders broken or unsafe HTML.' },
  marketplace:   { purpose: 'App store — app installs, extensions, billing and webhooks (frozen).', importance: 'Third-party extensibility (post-freeze).', failureImpact: 'App ecosystem unavailable (currently frozen).' },
  developer:     { purpose: 'Developer platform — OAuth/PKCE, API clients and tooling (frozen).', importance: 'Programmatic access (post-freeze).', failureImpact: 'Developer access unavailable (currently frozen).' },
  analytics:     { purpose: 'Event stream, rollups, projections and exports.', importance: 'Insight + read-model projections.', failureImpact: 'Reporting stale; projections lag.' },
  notifications: { purpose: 'Transactional + lifecycle email (Resend), WhatsApp and tickets.', importance: 'Customer/merchant comms.', failureImpact: 'Customers not notified; support degraded.' },
  operations:    { purpose: 'Internal ops — incidents, RBAC, risk, trust & safety, reconciliation.', importance: 'Running and protecting the platform.', failureImpact: 'Ops blind; incident response degraded.' },
};

const FLOWS = {
  orders: ['Customer adds product', 'Cart', 'Checkout (totals + tax + shipping server-side)', 'Payment authorized/captured', 'Order created (create_checkout_order)', 'Inventory reserved', 'Shipping/fulfillment created', 'Notifications sent', 'Analytics updated'],
  payments: ['Checkout submits', 'Server computes authoritative totals', 'Razorpay order created / COD selected', 'Razorpay signature verified (HMAC-SHA256)', 'confirm_order_payment_with_ledger (SECURITY DEFINER)', 'Double-entry ledger posted', 'Payout/settlement accrues'],
  refunds: ['Return/refund requested', 'Step-up HMAC second factor', 'complete_order_refund (SECURITY DEFINER, idempotent, FOR UPDATE)', 'Ledger reversal posted', 'restore_gift_card_on_refund if gift-card used', 'Customer notified'],
  customer: ['Landing', 'Browse', 'Product', 'Cart', 'Checkout', 'Payment', 'Order', 'Tracking', 'Refund', 'Support'],
  merchant: ['Merchant onboarding + KYC', 'Store creation', 'Product management', 'Inventory', 'Orders', 'Shipping', 'Analytics', 'Themes', 'Payouts'],
};

// The new Information Architecture (Phase 1) — Atlas is the deepest layer, not the first.
const IA = [
  { key: 'getting-started', label: 'Getting Started', icon: '◎', kind: 'page' },
  { key: 'mission-control', label: 'Mission Control', icon: '◉', kind: 'page' },
  { key: 'business', label: 'Business View', icon: '◷', kind: 'section', children: ['merchant', 'orders', 'payments', 'analytics'] },
  { key: 'merchant-journey', label: 'Merchant Journey', icon: '◵', kind: 'ecosystem', eco: 'merchant' },
  { key: 'customer-journey', label: 'Customer Journey', icon: '◴', kind: 'ecosystem', eco: 'customer' },
  { key: 'commerce', label: 'Commerce Engine', icon: '▤', kind: 'section', children: ['orders', 'products', 'collections', 'inventory', 'shipping', 'discounts'] },
  { key: 'payments-engine', label: 'Payments Engine', icon: '▦', kind: 'section', children: ['payments', 'refunds', 'payouts', 'gift-cards', 'gst'] },
  { key: 'security', label: 'Security', icon: '⛨', kind: 'section', children: ['authentication', 'authorization', 'identity'] },
  { key: 'operations', label: 'Operations', icon: '◍', kind: 'section', children: ['operations', 'notifications'] },
  { key: 'database', label: 'Database', icon: '▤', kind: 'page' },
  { key: 'infrastructure', label: 'Infrastructure', icon: '◰', kind: 'page' },
  { key: 'ops-center', label: 'Operations Center', icon: '◍', kind: 'page' },
  { key: 'connections', label: 'Live & Connections', icon: '◌', kind: 'page' },
  { key: 'readiness', label: 'Readiness', icon: '◉', kind: 'page' },
  { key: 'ai-context', label: 'AI Context', icon: '✦', kind: 'page' },
  { key: 'technical', label: 'Technical View', icon: '⌥', kind: 'toggle' },
  { key: 'atlas', label: 'Atlas (deep)', icon: '★', kind: 'atlas' },
];

function criticality(d) {
  if (d.money) return 'Tier 1 — critical (money path)';
  if ((d.consumedBy?.length || 0) >= 3) return 'Tier 1 — critical (high fan-in)';
  if (d.tenant) return 'Tier 2 — important (tenant data)';
  return 'Tier 3 — supporting';
}

function aiContext(node) {
  return [
    `# LetBuyy domain: ${node.label}`,
    `Purpose: ${node.purpose}`,
    `Criticality: ${node.criticality}`,
    `Owner: ${node.owner.join(', ') || 'unowned'}`,
    `Depends on: ${node.dependsOn.join(', ') || 'none'}`,
    `Consumed by: ${node.consumers.join(', ') || 'none'}`,
    `Routes (${node.technical.routes.length}): ${node.technical.routes.join(', ') || '—'}`,
    `RPCs (${node.technical.rpcs.length}): ${node.technical.rpcs.slice(0, 20).join(', ')}${node.technical.rpcs.length > 20 ? ' …' : ''}`,
    `Tables (${node.technical.tables.length}): ${node.technical.tables.slice(0, 25).join(', ')}${node.technical.tables.length > 25 ? ' …' : ''}`,
    `Workers: ${node.technical.workers.join(', ')} · Queues: ${node.technical.queues.join(', ')}`,
    `Secrets: ${node.technical.secrets.join(', ') || '—'}`,
    `Security: ${node.technical.money ? 'money path (SECURITY DEFINER RPCs, canonical-ledger-only)' : 'standard'}; ${node.technical.tenant ? 'tenant-scoped (RLS + verifySiteOwnership)' : 'platform-internal'}.`,
    `Failure impact: ${node.failureImpact}`,
    `Query without scanning: /api/domain?key=${node.key} · /api/change-impact?key=${node.key} · /api/incident-intelligence?domain=${node.key}`,
  ].join('\n');
}

export function buildExplainIntel() {
  const di = g('domain-intel.json'), db = g('db-intel.json'), infra = g('infra-intel.json');
  const pr = g('production-readiness-v2.json'), de = g('decision-engine-v2.json'), exec = g('execution-intel.json');
  const rel = g('relationship-intel.json');
  if (!di || !db) return { error: 'domain-intel.json / db-intel.json missing — run pnpm graph:omega' };

  const relMap = rel ? new Map(rel.tables.map((t) => [t.name, t])) : new Map();
  const fkFor = (tables) => {
    const set = new Set(tables); const out = new Set(), inc = new Set();
    for (const t of tables) { const r = relMap.get(t); if (!r) continue; r.references.forEach((x) => { if (!set.has(x)) out.add(x); }); r.referencedBy.forEach((x) => { if (!set.has(x)) inc.add(x); }); }
    return { references: [...out].slice(0, 20), referencedBy: [...inc].slice(0, 20) };
  };
  const policiesFor = (tables) => db.policies.filter((p) => tables.includes(p.table)).length;
  const nodes = {};
  for (const d of di.domains) {
    const nar = NARRATIVE[d.key] || { purpose: `${d.label} domain.`, importance: '—', failureImpact: '—' };
    const node = {
      key: d.key, label: d.label, kind: 'domain',
      purpose: nar.purpose, importance: nar.importance, failureImpact: nar.failureImpact,
      criticality: criticality(d),
      owner: d.owners,
      dependsOn: d.dependsOn.map((x) => x.domain),
      consumers: d.consumedBy.map((x) => x.domain),
      operationalNotes: `${d.money ? 'Money mutations only via SECURITY DEFINER RPCs (db.rpc). ' : ''}${d.tenant ? 'Tenant-scoped: every row carries site_id; RLS forced. ' : ''}Runs through ${d.workers.join(', ')}.`,
      technical: { routes: d.routes, rpcs: d.rpcs, tables: d.tables, policies: policiesFor(d.tables), workers: d.workers, queues: d.queues, secrets: d.secrets, services: d.apps, money: d.money, tenant: d.tenant, relationships: fkFor(d.tables) },
      atlas: { search: d.rpcs[0] || d.tables[0] || d.label, blast: d.key },
      flow: FLOWS[d.key] || null,
    };
    node.aiContext = aiContext(node);
    nodes[d.key] = node;
  }

  const ecosystems = {
    merchant: { label: 'Merchant Ecosystem', steps: FLOWS.merchant, stages: ['merchant', 'products', 'inventory', 'orders', 'shipping', 'analytics', 'themes', 'payouts'] },
    customer: { label: 'Customer Ecosystem', steps: FLOWS.customer, stages: ['storefront', 'products', 'orders', 'payments', 'shipping', 'refunds', 'notifications'] },
  };

  const readiness = pr ? { overall: pr.summary.overall, verdict: pr.summary.launchVerdict, dimensions: pr.dimensions, lowest: pr.summary.lowest,
    openBlockers: exec?.blockers.filter((b) => !/done|resolved|complete|hidden|fixed/i.test(b.status)) || [],
    nextActions: de?.fixNext.slice(0, 5) || [] } : null;

  const infrastructure = infra ? { workers: infra.workers.map((w) => w.name), queues: infra.summary.queueProducers, deadLetters: infra.summary.queueConsumers.filter((q) => /dead.?letter/i.test(q)),
    storage: { r2: infra.summary.r2, hyperdrive: infra.summary.hyperdrive }, vercelApps: infra.summary.vercelApps, secrets: infra.summary.secretsRequired, crons: infra.summary.crons } : null;

  return {
    summary: { domains: Object.keys(nodes).length, sections: IA.filter((i) => i.kind === 'section').length, ecosystems: Object.keys(ecosystems).length, generatedAt: di.summary.generatedAt },
    ia: IA, nodes, ecosystems, flows: FLOWS, readiness, infrastructure,
    gettingStarted: {
      title: 'Understand LetBuyy in 30 minutes',
      steps: [
        { t: 'Business Overview', d: 'A multi-tenant India-first commerce platform. Core unit = a merchant store (site_id). Merchants sell products; customers buy them; money flows through a canonical double-entry ledger.' },
        { t: 'Architecture Overview', d: `${db.summary.tables} tables, ${db.summary.functions} RPCs, ${di.summary.domains} domains, ${infra?.summary.workers || 4} Cloudflare Workers, ${infra?.summary.vercelApps.length || 5} Vercel apps — all proxying the api-gateway (/v1).` },
        { t: 'Commerce Flow', d: FLOWS.orders.join(' → ') },
        { t: 'Payments Flow', d: FLOWS.payments.join(' → ') },
        { t: 'Merchant Flow', d: FLOWS.merchant.join(' → ') },
        { t: 'Customer Flow', d: FLOWS.customer.join(' → ') },
        { t: 'Security Model', d: 'Two issuers never crossed (customer HS256, merchant ES256). Forced RLS + verifySiteOwnership isolate tenants. Money mutations only via SECURITY DEFINER RPCs. Step-up HMAC gates refunds/payouts.' },
        { t: 'Infrastructure Model', d: `Cloudflare Workers + Queues (incl dead-letter) + R2 + Hyperdrive → Supabase Postgres. ${infra?.summary.secretsRequired || 19} production secrets. Single deploy pipeline with a migrate gate + rollback.` },
        { t: 'Readiness Overview', d: readiness ? `${readiness.overall}% structural; launch ${readiness.verdict}; ${readiness.openBlockers.length} open blockers.` : '—' },
        { t: 'Atlas Introduction', d: 'Atlas is the deepest layer — a force-directed galaxy of all 52k code nodes by community. Use it after Explain mode to investigate a specific cluster or blast radius.' },
      ],
    },
  };
}

// Phase 15 — Copilot: route a natural-language question to the right LCIS engine (no repo scan).
export function copilot(q) {
  const t = (q || '').toLowerCase();
  const ex = buildExplainIntel();
  const findDomain = () => Object.keys(ex.nodes).find((k) => t.includes(k.replace('-', ' ')) || t.includes(ex.nodes[k].label.toLowerCase())) ||
    (t.includes('checkout') ? 'orders' : t.includes('gift') ? 'gift-cards' : t.includes('payment') ? 'payments' : null);
  const d = findDomain();
  if (/what breaks|impact|if .* change/.test(t) && d) return { intent: 'change-impact', engine: `/api/change-impact?key=${d}`, domain: d, answer: ex.nodes[d] && { breaks: ex.nodes[d].consumers, criticality: ex.nodes[d].criticality } };
  if (/who owns|owner/.test(t) && d) return { intent: 'ownership', engine: `/api/owner`, domain: d, answer: { owner: ex.nodes[d]?.owner } };
  if (/why|decided|exist/.test(t)) return { intent: 'memory', engine: `/api/memory?mode=rule&q=${encodeURIComponent(d || q)}`, domain: d };
  if (/security|trust|rls|auth/.test(t)) return { intent: 'security', engine: '/api/security-intelligence' };
  if (/onboard|merchant flow/.test(t)) return { intent: 'flow', engine: '/api/explain', flow: ex.flows.merchant };
  if (/flow|how.*work/.test(t) && d) return { intent: 'flow', engine: '/api/explain', domain: d, flow: ex.nodes[d]?.flow };
  if (/architecture|explain|show/.test(t) && d) return { intent: 'explain', engine: `/api/explain`, domain: d, answer: ex.nodes[d] };
  if (d) return { intent: 'explain', engine: `/api/explain`, domain: d, answer: ex.nodes[d] };
  return { intent: 'search', engine: `/api/search?q=${encodeURIComponent(q)}`, hint: 'Ask about a domain (payments, checkout, gift cards), ownership, impact, security, or a flow.' };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = buildExplainIntel();
  if (i.error) { console.error(i.error); process.exit(1); }
  console.log('\nLCIS v6 Explain Intelligence —', i.summary.domains, 'domain nodes ·', i.summary.sections, 'sections ·', i.summary.ecosystems, 'ecosystems');
  console.log('  IA:', i.ia.map((x) => x.label).join(' · '));
  console.log('  sample (orders):', i.nodes.orders.purpose, '|', i.nodes.orders.criticality);
}
