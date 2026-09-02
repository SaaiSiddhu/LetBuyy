#!/usr/bin/env node
// LetBuyy Domain Intelligence (LCIS v3) — discovers business domains and the
// Domain → Service → Route → RPC → Table → Queue → Worker graph by JOINING the
// existing intelligence layers (db-intel.json, infra-intel.json, graph.json) with
// the gateway route inventory. Pure deterministic classification (rule-based,
// repository truth — the rules are listed below; nothing is fabricated).
// Output: graphify-out/domain-intel.json   ·   Run: pnpm graph:domain
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDbIntel } from './db-intel.mjs';
import { buildInfraIntel, findOwnership } from './infra-intel.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const ROUTES_DIR = join(ROOT, 'services/api-gateway/src/routes');
const WF_DIR = join(ROOT, '.github/workflows');

// ----------------------------------------------------------------------------
// Domain rules — ordered, specific → general. First match wins for primary
// assignment of a table / route / rpc. `t` = table/route/rpc-name regex.
// These are classification rules over repository identifiers, not assumptions.
// ----------------------------------------------------------------------------
const DOMAINS = [
  { key: 'themes',         label: 'Themes',              t: /^theme|store_themes|liquid/ },
  { key: 'marketplace',    label: 'Marketplace',         t: /^app_|marketplace|extension|^app-store/ },
  { key: 'developer',      label: 'Developer Platform',  t: /developer|oauth|api_client|api_key|_api_clients|^app-api/ },
  { key: 'gift-cards',     label: 'Gift Cards',          t: /gift_card|gift-card|^wallet/ },
  { key: 'refunds',        label: 'Refunds',             t: /refund|return/ },
  { key: 'payouts',        label: 'Payouts',             t: /payout|settlement|commission|cod_recon|cod-recon|partner_payout/ },
  { key: 'payments',       label: 'Payments',            t: /payment|razorpay|^ledger|ledger_/ },
  { key: 'gst',            label: 'GST & Tax',           t: /^gst|_gst|^tax|_tax_|tax_|invoice/ },
  { key: 'discounts',      label: 'Discounts',           t: /coupon|promotion|discount|marketing|campaign/ },
  { key: 'shipping',       label: 'Shipping',            t: /shipping|shipment|fulfillment|^fulfil/ },
  { key: 'inventory',      label: 'Inventory',           t: /inventory|^stock/ },
  { key: 'collections',    label: 'Collections',         t: /collection|categor/ },
  { key: 'products',       label: 'Products',            t: /^product|metafield|variant|product_/ },
  { key: 'orders',         label: 'Orders',              t: /^order|order_|^cart|checkout|purchase_order/ },
  { key: 'storefront',     label: 'Storefront',          t: /storefront|^blog|^page|custom_domain|custom-domain|^domains|contact|wishlist|^review|stores-localization|form/ },
  { key: 'authorization',  label: 'Authorization',       t: /rbac|permission|^role|step_up|step-up|entitlement|membership|two_factor|two-factor/ },
  { key: 'authentication', label: 'Authentication',      t: /session|credential|^otp|^login|^token|turnstile|^auth/ },
  { key: 'identity',       label: 'Identity',            t: /customer|^kyc|store_customers/ },
  { key: 'merchant',       label: 'Merchant',            t: /^store|^site|merchant|employee|onboard|billing/ },
  { key: 'notifications',  label: 'Notifications',       t: /notification|email|whatsapp|^wa_|ticket|message|contact/ },
  { key: 'analytics',      label: 'Analytics',           t: /analytics|event|metric|rollup|projection|outbox|portfolio|^export/ },
  { key: 'operations',     label: 'Internal Operations', t: /incident|operational|operation|internal|console|production_|risk|trust|security|feature_flag|runtime|distributed|execution|audit|admin|reconcil|support/ },
];
const DOMAIN_KEYS = DOMAINS.map((d) => d.key);
const LABEL = Object.fromEntries(DOMAINS.map((d) => [d.key, d.label]));

// Domain → primary product surface (Vercel apps) — repository topology (CLAUDE.md runtime map).
const DOMAIN_APPS = {
  merchant: ['merchant-web'], products: ['merchant-web'], collections: ['merchant-web'],
  inventory: ['merchant-web'], orders: ['merchant-web', 'customer-web'], shipping: ['merchant-web'],
  gst: ['merchant-web'], discounts: ['merchant-web'], 'gift-cards': ['merchant-web', 'customer-web'],
  payments: ['merchant-web', 'customer-web'], refunds: ['merchant-web'], payouts: ['merchant-web'],
  analytics: ['merchant-web'], themes: ['merchant-web', 'customer-web'],
  storefront: ['customer-web'], identity: ['identity-platform'], authentication: ['identity-platform'],
  authorization: ['identity-platform', 'admin-web'], operations: ['admin-web'],
  marketplace: ['app-marketplace'], developer: ['developer-portal'], notifications: ['merchant-web'],
};

// Domain → Cloudflare queues (wrangler producers). EVENT_QUEUE = generic outbox emitter.
const DOMAIN_QUEUES = {
  analytics: ['ANALYTICS_QUEUE', 'EVENT_QUEUE'], notifications: ['NOTIFICATION_QUEUE', 'EVENT_QUEUE'],
  storefront: ['RUNTIME_QUEUE', 'SEARCH_QUEUE', 'EVENT_QUEUE'], products: ['SEARCH_QUEUE', 'EVENT_QUEUE'],
  collections: ['SEARCH_QUEUE', 'EVENT_QUEUE'], orders: ['RUNTIME_QUEUE', 'EVENT_QUEUE'], inventory: ['EVENT_QUEUE'],
  payments: ['EVENT_QUEUE'], refunds: ['EVENT_QUEUE'], payouts: ['EVENT_QUEUE'], 'gift-cards': ['EVENT_QUEUE'],
  themes: ['RUNTIME_QUEUE', 'EVENT_QUEUE'], marketplace: ['EVENT_QUEUE'], operations: ['EVENT_QUEUE'],
};

// Secret → domains that consume it (from the 19 production secrets; powers Phase 10).
const SECRET_DOMAINS = [
  [/^SUPABASE_/, DOMAIN_KEYS],                              // data layer — every domain
  [/AUTH_SECRET|CSRF_SECRET/, ['authentication']],
  [/CUSTOMER_SESSION_SECRET/, ['authentication', 'identity']],
  [/STEP_UP_SIGNING_SECRET/, ['authorization', 'payments', 'refunds', 'payouts']],
  [/LETBUYY_IDENTITY_PUBLIC_JWKS/, ['authentication', 'authorization', 'identity']],
  [/CHECKOUT_SIGNING_SECRET/, ['orders', 'payments']],
  [/TURNSTILE_SECRET_KEY/, ['authentication', 'storefront']],
  [/INTERNAL_API_SECRET|LETBUYY_INTERNAL_API_SECRET|INTERNAL_API_KEYRING/, ['operations']],
  [/QUEUE_TENANT_ENVELOPE_SECRET/, ['operations', 'analytics', 'notifications']],
  [/PLATFORM_CONSOLE_API_TOKEN/, ['operations']],
  [/UPSTASH_REDIS/, ['operations', 'storefront', 'authentication']],
  [/RESEND_API_KEY/, ['notifications']],
  [/PAYMENT_CONFIG_ENCRYPTION_KEY/, ['payments', 'payouts', 'refunds']],
];

function classify(name) {
  const n = (name || '').toLowerCase();
  for (const d of DOMAINS) if (d.t.test(n)) return d.key;
  return null;
}
const routeName = (rel) => rel.replace(/^services\/api-gateway\/src\/routes\//, '').replace(/\.ts$/, '');

function listRoutes(dir, acc = []) {
  if (!existsSync(dir)) return acc;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) listRoutes(p, acc);
    else if (/\.ts$/.test(e.name)) acc.push(p.replace(ROOT + '/', ''));
  }
  return acc;
}

export function buildDomainIntel() {
  const db = buildDbIntel();
  const infra = buildInfraIntel();

  // --- primary assignment: table / route / rpc -> domain ---
  const tableDomain = new Map();
  for (const t of db.tables) tableDomain.set(t.name, classify(t.name));

  const routeFiles = listRoutes(ROUTES_DIR);
  const routeDomain = new Map();
  for (const rel of routeFiles) routeDomain.set(rel, classify(routeName(rel)));

  // rpc -> domain: by name; fallback to the dominant domain of the tables it touches.
  const rpcDomain = new Map();
  for (const f of db.functions) {
    let dk = classify(f.name);
    if (!dk) {
      const counts = {};
      for (const tn of f.touches) { const td = tableDomain.get(tn); if (td) counts[td] = (counts[td] || 0) + 1; }
      dk = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    }
    rpcDomain.set(f.name, dk);
  }

  // workflows (advisory): which CI/CD workflows mention each domain.
  const workflows = existsSync(WF_DIR) ? readdirSync(WF_DIR).filter((f) => /\.ya?ml$/.test(f)) : [];
  const wfText = Object.fromEntries(workflows.map((w) => [w, readFileSync(join(WF_DIR, w), 'utf8').toLowerCase()]));
  const universalWf = ['production-deploy.yml', 'ci.yml', 'architecture-governance.yml'].filter((w) => workflows.includes(w));

  // --- per-domain aggregation ---
  const fnByName = new Map(db.functions.map((f) => [f.name, f]));
  const domains = DOMAINS.map((d) => {
    const routes = routeFiles.filter((r) => routeDomain.get(r) === d.key).map(routeName);
    const rpcs = db.functions.filter((f) => rpcDomain.get(f.name) === d.key).map((f) => f.name);
    const tables = db.tables.filter((t) => tableDomain.get(t.name) === d.key);
    const tableNames = tables.map((t) => t.name);
    const queues = DOMAIN_QUEUES[d.key] || ['EVENT_QUEUE'];
    const apps = DOMAIN_APPS[d.key] || [];
    const workers = ['letbuyy-api', ...(queues.length ? ['letbuyy-queue-workers'] : []),
      ...(/payments|refunds|payouts|marketplace|notifications/.test(d.key) ? ['letbuyy-webhook'] : [])];
    const secrets = infra.secrets.filter((s) => SECRET_DOMAINS.some(([re, ks]) => re.test(s) && ks.includes(d.key)));
    const owners = [...new Set(routeFiles.filter((r) => routeDomain.get(r) === d.key)
      .flatMap((r) => findOwnership(infra, r)?.owners || []))];
    const dwf = [...new Set([...universalWf,
      ...workflows.filter((w) => new RegExp(d.key.replace('-', '.?').replace('s$', '')).test(wfText[w]))])];
    const money = tables.some((t) => t.money) || rpcs.some((r) => fnByName.get(r)?.money);
    const tenant = tables.some((t) => t.tenant);
    return {
      key: d.key, label: d.label, money, tenant,
      routes, rpcs, tables: tableNames, queues, apps, workers, secrets, owners, workflows: dwf,
      counts: { routes: routes.length, rpcs: rpcs.length, tables: tableNames.length,
        policies: tables.reduce((a, t) => a + t.policies.length, 0),
        triggers: tables.reduce((a, t) => a + t.triggers.length, 0),
        indexes: tables.reduce((a, t) => a + t.indexes, 0) },
      dependsOn: [], consumedBy: [],
    };
  });
  const byKey = Object.fromEntries(domains.map((d) => [d.key, d]));

  // --- cross-domain edges: A depends on B when an RPC in A touches a table in B,
  //     or a route in A calls an RPC in B (real data/control coupling). ---
  const edges = new Map(); // "A>B" -> { from, to, via:Set }
  const addEdge = (a, b, label) => { if (!a || !b || a === b) return; const k = a + '>' + b; const e = edges.get(k) || { from: a, to: b, via: new Set() }; e.via.add(label); edges.set(k, e); };
  for (const f of db.functions) {
    const a = rpcDomain.get(f.name); if (!a) continue;
    for (const tn of f.touches) { const b = tableDomain.get(tn); if (b && b !== a) addEdge(a, b, `${f.name}→${tn}`); }
  }
  for (const [route, rpcs] of Object.entries(db.routeRpc)) {
    const a = routeDomain.get(route) ?? classify(routeName(route));
    for (const rpc of rpcs) { const b = rpcDomain.get(rpc); if (b && b !== a) addEdge(a, b, `${routeName(route)}→${rpc}()`); }
  }
  const edgeArr = [...edges.values()].map((e) => ({ from: e.from, to: e.to, via: [...e.via].slice(0, 12), strength: e.via.size }));
  for (const e of edgeArr) {
    if (byKey[e.from] && !byKey[e.from].dependsOn.find((x) => x.domain === e.to)) byKey[e.from].dependsOn.push({ domain: e.to, strength: e.strength });
    if (byKey[e.to] && !byKey[e.to].consumedBy.find((x) => x.domain === e.from)) byKey[e.to].consumedBy.push({ domain: e.from, strength: e.strength });
  }
  for (const d of domains) { d.dependsOn.sort((a, b) => b.strength - a.strength); d.consumedBy.sort((a, b) => b.strength - a.strength); }

  // --- discovery: anything not classified (Phase 15 input) ---
  const unclassifiedTables = [...tableDomain].filter(([, v]) => !v).map(([k]) => k);
  const unclassifiedRoutes = routeFiles.filter((r) => !routeDomain.get(r)).map(routeName);
  const unclassifiedRpcs = db.functions.filter((f) => !rpcDomain.get(f.name)).map((f) => f.name);

  const summary = {
    domains: domains.length,
    classifiedRoutes: routeFiles.length - unclassifiedRoutes.length, totalRoutes: routeFiles.length,
    classifiedTables: db.tables.length - unclassifiedTables.length, totalTables: db.tables.length,
    classifiedRpcs: db.functions.length - unclassifiedRpcs.length, totalRpcs: db.functions.length,
    crossDomainEdges: edgeArr.length,
    unclassifiedRoutes, unclassifiedTables, unclassifiedRpcs,
    generatedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  };
  return { summary, domains, edges: edgeArr, rules: DOMAINS.map((d) => ({ key: d.key, label: d.label, pattern: d.t.source })) };
}

// ---- graph query functions (Phase 2) — pure, take the loaded domain intel ----
export function traceDomain(di, key) {
  const d = di.domains.find((x) => x.key === key || x.label.toLowerCase() === (key || '').toLowerCase());
  if (!d) return { error: `domain '${key}' not found`, available: di.domains.map((x) => x.key) };
  return d;
}
export function findDomainDependencies(di, key) { const d = traceDomain(di, key); return d.error ? d : { domain: d.key, dependsOn: d.dependsOn }; }
export function findDomainConsumers(di, key) { const d = traceDomain(di, key); return d.error ? d : { domain: d.key, consumedBy: d.consumedBy }; }
export function findDomainOwners(di, key) { const d = traceDomain(di, key); return d.error ? d : { domain: d.key, owners: d.owners }; }
export function findDomainSecrets(di, key) { const d = traceDomain(di, key); return d.error ? d : { domain: d.key, secrets: d.secrets }; }
export function findDomainWorkflows(di, key) { const d = traceDomain(di, key); return d.error ? d : { domain: d.key, workflows: d.workflows }; }
export function listDomains(di) {
  return di.domains.map((d) => ({ key: d.key, label: d.label, money: d.money, tenant: d.tenant, ...d.counts,
    apps: d.apps, queues: d.queues, dependsOn: d.dependsOn.length, consumedBy: d.consumedBy.length }));
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2], arg = process.argv.slice(3).join(' ');
  if (cmd && cmd !== 'build') {
    const di = JSON.parse(readFileSync(join(OUT, 'domain-intel.json'), 'utf8'));
    const p = (o) => console.log(JSON.stringify(o, null, 2));
    if (cmd === 'list') p(listDomains(di));
    else if (cmd === 'deps') p(findDomainDependencies(di, arg));
    else if (cmd === 'consumers') p(findDomainConsumers(di, arg));
    else if (cmd === 'owners') p(findDomainOwners(di, arg));
    else if (cmd === 'secrets') p(findDomainSecrets(di, arg));
    else if (cmd === 'workflows') p(findDomainWorkflows(di, arg));
    else p(traceDomain(di, arg || cmd));
  } else {
    const intel = buildDomainIntel();
    if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, 'domain-intel.json'), JSON.stringify(intel));
    const s = intel.summary;
    console.log('\nLetBuyy Domain Intelligence (LCIS v3)');
    console.log(`  domains ${s.domains} · cross-domain edges ${s.crossDomainEdges}`);
    console.log(`  routes ${s.classifiedRoutes}/${s.totalRoutes} classified · tables ${s.classifiedTables}/${s.totalTables} · rpcs ${s.classifiedRpcs}/${s.totalRpcs}`);
    console.log(`  unclassified → routes ${s.unclassifiedRoutes.length}, tables ${s.unclassifiedTables.length}, rpcs ${s.unclassifiedRpcs.length}`);
    for (const d of intel.domains) console.log(`    ${d.label.padEnd(22)} routes ${String(d.counts.routes).padStart(2)} · rpcs ${String(d.counts.rpcs).padStart(3)} · tables ${String(d.counts.tables).padStart(3)} · depends-on ${d.dependsOn.length}`);
    console.log(`  → graphify-out/domain-intel.json\n`);
  }
}
