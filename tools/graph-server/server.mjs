#!/usr/bin/env node
// LetBuyy Graph Intelligence Platform — local viewer + query API.
// Zero dependencies (Node http only). Reads graphify-out/graph.json directly.
// Start: `pnpm graph:ui` → http://localhost:3333
import { createServer } from 'node:http';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { traceTable, traceRPC, tracePolicy, findOwnership, infraSummary } from './intelligence.mjs';
import { traceDomain, listDomains, findDomainDependencies, findDomainConsumers, findDomainOwners, findDomainSecrets, findDomainWorkflows } from './domain-intel.mjs';
import { blastDomain, couplingMatrix } from './cross-domain-engine.mjs';
import { buildPaymentIntel } from './payment-intel.mjs';
import { buildSecurityGraph } from './security-intel.mjs';
import { buildDeploymentIntel } from './deployment-intel.mjs';
import { traceIncident } from './incident-intel.mjs';
import { buildMerchantIntel } from './merchant-intel.mjs';
import { buildMemoryIntel, whyBuilt, ruleWhy, migrationWhy, decisionsAffecting } from './memory-intel.mjs';
import { buildRuntimeIntel } from './runtime-intel.mjs';
import { buildDeploymentState } from './deployment-state.mjs';
import { changeImpact } from './change-impact.mjs';
import { incidentResponse } from './incident-response.mjs';
import { buildMerchantOperatingGraph } from './merchant-operating-graph.mjs';
import { buildExecutionIntel } from './execution-intel.mjs';
import { buildRuntimeObservability } from './runtime-observability-intel.mjs';
import { buildMerchantIntelligence } from './merchant-intelligence.mjs';
import { buildRevenueIntelligence } from './revenue-intelligence.mjs';
import { buildSecurityIntelligenceV5 } from './security-intelligence-v5.mjs';
import { incidentIntelligenceV5 } from './incident-intelligence-v5.mjs';
import { buildCustomerJourneyIntelligence } from './customer-journey-intelligence.mjs';
import { buildProductionReadiness } from './production-readiness-intel.mjs';
import { buildDecisionEngine } from './decision-engine-v5.mjs';
import { buildMerchantHealth } from './merchant-health-intel.mjs';
import { buildMerchantGrowth } from './merchant-growth-intel.mjs';
import { buildMerchantAdoption } from './merchant-adoption-intel.mjs';
import { buildMerchantRisk } from './merchant-risk-intel.mjs';
import { buildMerchantChurn } from './merchant-churn-intel.mjs';
import { buildCustomerIntelligenceV2 } from './customer-intelligence-v2.mjs';
import { buildRevenueIntelligenceV2 } from './revenue-intelligence-v2.mjs';
import { buildCostIntelligence } from './cost-intelligence.mjs';
import { buildTelemetryIntelligence } from './telemetry-intelligence.mjs';
import { buildMemoryV2 } from './memory-v2.mjs';
import { buildFixEngine } from './fix-engine.mjs';
import { buildUnifiedIntelligence } from './unified-intelligence-engine.mjs';
import { buildDiscoveryV2 } from './discovery-v2.mjs';
import { buildProductionReadinessV2 } from './production-readiness-v2.mjs';
import { buildDecisionEngineV2 } from './decision-engine-v2.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const GRAPH_PATH = join(REPO_ROOT, 'graphify-out', 'graph.json');
const PORT = Number(process.env.GRAPH_UI_PORT || 3333);

if (!existsSync(GRAPH_PATH)) {
  console.error(`\n[graph-server] graph not found at ${GRAPH_PATH}\n  Run:  pnpm graph:update  (or: graphify update .)\n`);
  process.exit(1);
}

console.log('[graph-server] loading graph…');
const raw = JSON.parse(readFileSync(GRAPH_PATH, 'utf8'));
const stat = statSync(GRAPH_PATH);
const nodes = raw.nodes || [];
const links = raw.links || raw.edges || [];
const DB_INTEL_PATH = join(REPO_ROOT, 'graphify-out', 'db-intel.json');
const dbIntel = existsSync(DB_INTEL_PATH) ? JSON.parse(readFileSync(DB_INTEL_PATH, 'utf8')) : null;
const INFRA_INTEL_PATH = join(REPO_ROOT, 'graphify-out', 'infra-intel.json');
const infraIntel = existsSync(INFRA_INTEL_PATH) ? JSON.parse(readFileSync(INFRA_INTEL_PATH, 'utf8')) : null;
const DOMAIN_INTEL_PATH = join(REPO_ROOT, 'graphify-out', 'domain-intel.json');
const domainIntel = existsSync(DOMAIN_INTEL_PATH) ? JSON.parse(readFileSync(DOMAIN_INTEL_PATH, 'utf8')) : null;

// ---- v4: runtime / memory / deployment-state / execution (built fresh at startup; cheap) ----
const safe = (fn) => { try { return fn(); } catch (e) { return { error: String(e) }; } };
const MEM_INTEL_PATH = join(REPO_ROOT, 'graphify-out', 'memory-intel.json');
const memoryIntel = safe(() => existsSync(MEM_INTEL_PATH) ? JSON.parse(readFileSync(MEM_INTEL_PATH, 'utf8')) : buildMemoryIntel());
const runtimeIntel = safe(() => buildRuntimeIntel());
const deploymentStateData = safe(() => buildDeploymentState(infraIntel));
const executionIntel = safe(() => buildExecutionIntel());

// ---- v5: live operating intelligence (built fresh at startup) ----
const runtimeObs = safe(() => buildRuntimeObservability());
const merchantIntelV5 = safe(() => buildMerchantIntelligence());
const revenueIntel = safe(() => buildRevenueIntelligence());
const securityIntelV5 = safe(() => buildSecurityIntelligenceV5());
const journeyIntel = safe(() => buildCustomerJourneyIntelligence());
const readinessIntel = safe(() => buildProductionReadiness());
const decisionEngine = safe(() => buildDecisionEngine());

// ---- Omega: prefer the pre-built JSON artifact (cheap), fall back to live build ----
const loadOrBuild = (file, fn) => { const p = join(REPO_ROOT, 'graphify-out', file); return existsSync(p) ? safe(() => JSON.parse(readFileSync(p, 'utf8'))) : safe(fn); };
const merchantHealth = loadOrBuild('merchant-health.json', buildMerchantHealth);
const merchantGrowth = loadOrBuild('merchant-growth.json', buildMerchantGrowth);
const merchantAdoption = loadOrBuild('merchant-adoption.json', buildMerchantAdoption);
const merchantRisk = loadOrBuild('merchant-risk.json', buildMerchantRisk);
const merchantChurn = loadOrBuild('merchant-churn.json', buildMerchantChurn);
const customerV2 = loadOrBuild('customer-intelligence.json', buildCustomerIntelligenceV2);
const revenueV2 = loadOrBuild('revenue-intelligence-v2.json', buildRevenueIntelligenceV2);
const costIntel = loadOrBuild('cost-intelligence.json', buildCostIntelligence);
const telemetryIntel = loadOrBuild('telemetry-intelligence.json', buildTelemetryIntelligence);
const memoryV2 = loadOrBuild('memory-v2.json', buildMemoryV2);
const fixEngine = loadOrBuild('fix-engine.json', buildFixEngine);
const unifiedIntel = loadOrBuild('unified-intelligence.json', buildUnifiedIntelligence);
const discoveryV2 = loadOrBuild('discovery-v2.json', buildDiscoveryV2);
const readinessV2 = loadOrBuild('production-readiness-v2.json', buildProductionReadinessV2);
const decisionV2 = loadOrBuild('decision-engine-v2.json', buildDecisionEngineV2);

// ---- v3: customer-journey (Phase 5) + secret intelligence (Phase 10), computed from loaded intel ----
const JOURNEY = [
  { stage: 'Landing', domains: ['storefront'], app: 'marketing-site / storefront-runtime' },
  { stage: 'Storefront', domains: ['storefront'], app: 'storefront-runtime' },
  { stage: 'Product', domains: ['products', 'collections'], app: 'storefront-runtime' },
  { stage: 'Cart', domains: ['orders'], app: 'storefront-runtime' },
  { stage: 'Checkout', domains: ['orders', 'discounts', 'gst', 'shipping'], app: 'storefront-runtime' },
  { stage: 'Payment', domains: ['payments', 'gift-cards'], app: 'storefront-runtime → api-gateway' },
  { stage: 'Order', domains: ['orders', 'inventory'], app: 'api-gateway → queue-workers' },
  { stage: 'Refund', domains: ['refunds'], app: 'merchant-control-plane' },
  { stage: 'Tracking', domains: ['shipping', 'notifications'], app: 'storefront-runtime' },
];
function customerJourney() {
  if (!domainIntel) return { error: 'domain-intel.json missing — run pnpm graph:domain' };
  const byKey = Object.fromEntries(domainIntel.domains.map((d) => [d.key, d]));
  const stages = JOURNEY.map((s) => {
    const ds = s.domains.map((k) => byKey[k]).filter(Boolean);
    return { stage: s.stage, app: s.app, domains: s.domains,
      routes: [...new Set(ds.flatMap((d) => d.routes))], rpcs: [...new Set(ds.flatMap((d) => d.rpcs))].slice(0, 20),
      tables: [...new Set(ds.flatMap((d) => d.tables))], money: ds.some((d) => d.money) };
  });
  return { funnel: JOURNEY.map((s) => s.stage), stages };
}
function secretIntel() {
  if (!infraIntel || !domainIntel) return { error: 'infra-intel.json / domain-intel.json missing' };
  return {
    secrets: infraIntel.secrets.map((name) => {
      const domains = domainIntel.domains.filter((d) => d.secrets.includes(name));
      const workers = [...new Set(domains.flatMap((d) => d.workers))];
      return { secret: name, services: workers.length ? workers : ['letbuyy-api'],
        domains: domains.map((d) => d.key), features: domains.map((d) => d.label) };
    }),
    note: 'secrets are set via `wrangler secret put` at deploy (production-deploy.yml); never stored in the repo',
  };
}

// ---- indexes ----
const byId = new Map();
for (const n of nodes) byId.set(n.id, n);
const outAdj = new Map();
const inAdj = new Map();
const degree = new Map();
for (const e of links) {
  const s = e.source, t = e.target;
  if (!outAdj.has(s)) outAdj.set(s, []);
  if (!inAdj.has(t)) inAdj.set(t, []);
  outAdj.get(s).push({ id: t, relation: e.relation });
  inAdj.get(t).push({ id: s, relation: e.relation });
  degree.set(s, (degree.get(s) || 0) + 1);
  degree.set(t, (degree.get(t) || 0) + 1);
}

// ---- domain matchers (for dashboard tabs) ----
const DOMAINS = {
  services: (n) => /^services\//.test(n.source_file || ''),
  apps: (n) => /^apps\//.test(n.source_file || ''),
  packages: (n) => /^packages\//.test(n.source_file || ''),
  payments: (n) => /payment|razorpay|refund|ledger|checkout|cod|settlement|commission|payout|gift_card|money/i.test((n.source_file || '') + ' ' + (n.label || '')),
  identity: (n) => /auth|session|jwt|identity|\blogin\b|register|token|step.?up|oauth|turnstile|credential/i.test((n.source_file || '') + ' ' + (n.label || '')),
  database: (n) => /database\/|supabase|\.sql$|migration|rls|policy/i.test((n.source_file || '') + ' ' + (n.label || '')),
  marketplace: (n) => /app-marketplace|theme-marketplace/i.test(n.source_file || ''),
  themes: (n) => /theme-engine|theme|liquid|renderer|sanitize/i.test((n.source_file || '') + ' ' + (n.label || '')),
  developer: (n) => /developer-portal|developer/i.test(n.source_file || ''),
  security: (n) => /security|\brls\b|hmac|sign|verify|sanitize|crypto|secret|ownership/i.test((n.source_file || '') + ' ' + (n.label || '')),
  tenancy: (n) => /site_id|tenant|verifysiteownership|ownership|rls/i.test((n.source_file || '') + ' ' + (n.label || '')),
};

function workspaceOf(sf) {
  const m = (sf || '').match(/^(apps\/mobile\/[^/]+|apps\/[^/]+|services\/[^/]+|packages\/[^/]+\/[^/]+|packages\/[^/]+)/);
  return m ? m[1] : '(root)';
}

// ---- precomputed stats ----
const stats = (() => {
  const langs = {}, ws = {};
  let routes = 0, pages = 0, sqlFiles = new Set();
  for (const n of nodes) {
    const sf = n.source_file || '';
    const ext = (sf.match(/\.([a-z0-9]+)$/i) || [])[1];
    if (ext) langs[ext] = (langs[ext] || 0) + 1;
    ws[workspaceOf(sf)] = (ws[workspaceOf(sf)] || 0) + 1;
    if (/\/route\.ts$/.test(sf)) routes++;
    if (/\/page\.tsx$/.test(sf)) pages++;
    if (/database\/supabase\/migrations\/.*\.sql$/.test(sf)) sqlFiles.add(sf);
  }
  const communities = new Set(nodes.map((n) => n.community)).size;
  return {
    nodes: nodes.length, edges: links.length, communities,
    routes, pages, migrations: sqlFiles.size,
    languages: topN(langs, 12), workspaces: topN(ws, 30),
    built_at_commit: raw.built_at_commit || null,
    generated_at: stat.mtime.toISOString(),
    freshness_minutes: Math.round((Date.now() - stat.mtimeMs) / 60000),
  };
})();

function topN(obj, n) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ key: k, count: v }));
}
function nodeView(id) {
  const n = byId.get(id); if (!n) return null;
  return { id, label: n.label, source_file: n.source_file, source_location: n.source_location, community: n.community, file_type: n.file_type, degree: degree.get(id) || 0 };
}

function search(q, limit = 50) {
  if (!q) return [];
  const ql = q.toLowerCase();
  const exact = [], starts = [], inc = [];
  for (const n of nodes) {
    const l = (n.label || '').toLowerCase();
    const sf = (n.source_file || '').toLowerCase();
    if (l === ql) exact.push(n);
    else if (l.startsWith(ql) || sf.includes('/' + ql)) starts.push(n);
    else if (l.includes(ql) || sf.includes(ql)) inc.push(n);
    if (exact.length + starts.length + inc.length > limit * 4) break;
  }
  return [...exact, ...starts, ...inc]
    .sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0))
    .slice(0, limit).map((n) => nodeView(n.id));
}

function neighbors(id, depth = 1, limit = 80) {
  if (!byId.has(id)) return { nodes: [], links: [] };
  const seen = new Set([id]);
  let frontier = [id];
  const edgeSet = [];
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const cur of frontier) {
      for (const e of (outAdj.get(cur) || [])) { edgeSet.push({ source: cur, target: e.id, relation: e.relation }); if (!seen.has(e.id) && seen.size < limit) { seen.add(e.id); next.push(e.id); } }
      for (const e of (inAdj.get(cur) || [])) { edgeSet.push({ source: e.id, target: cur, relation: e.relation }); if (!seen.has(e.id) && seen.size < limit) { seen.add(e.id); next.push(e.id); } }
    }
    frontier = next;
  }
  const ns = [...seen].map(nodeView).filter(Boolean);
  const idset = new Set(seen);
  const ls = edgeSet.filter((e) => idset.has(e.source) && idset.has(e.target));
  return { nodes: ns, links: dedupeLinks(ls), root: id };
}
function dedupeLinks(ls) {
  const m = new Map();
  for (const e of ls) m.set(e.source + '>' + e.target + '>' + e.relation, e);
  return [...m.values()];
}

function shortestPath(a, b) {
  if (!byId.has(a) || !byId.has(b)) return { path: [], reason: 'unknown node' };
  const prev = new Map([[a, null]]);
  const queue = [a];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === b) break;
    const nbrs = [...(outAdj.get(cur) || []), ...(inAdj.get(cur) || [])];
    for (const e of nbrs) { if (!prev.has(e.id)) { prev.set(e.id, cur); queue.push(e.id); } }
  }
  if (!prev.has(b)) return { path: [], reason: 'no path' };
  const path = []; let c = b; while (c != null) { path.unshift(c); c = prev.get(c); }
  const ns = path.map(nodeView);
  const ls = [];
  for (let i = 0; i < path.length - 1; i++) ls.push({ source: path[i], target: path[i + 1], relation: 'path' });
  return { path, nodes: ns, links: ls };
}

function domain(key, limit = 60) {
  const match = DOMAINS[key]; if (!match) return null;
  const matched = nodes.filter(match);
  const files = new Set(matched.map((n) => n.source_file));
  const ws = {};
  let edgeCount = 0;
  for (const n of matched) { ws[workspaceOf(n.source_file)] = (ws[workspaceOf(n.source_file)] || 0) + 1; edgeCount += (degree.get(n.id) || 0); }
  const avgDeg = matched.length ? edgeCount / matched.length : 0;
  // heuristic attention/complexity score (NOT a vulnerability score)
  const risk = Math.min(100, Math.round((matched.length / Math.max(1, nodes.length)) * 600 + avgDeg * 4));
  const top = matched.sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0)).slice(0, limit).map((n) => nodeView(n.id));
  return { key, nodes: matched.length, files: files.size, relationships: edgeCount, avgDegree: Number(avgDeg.toFixed(1)), risk, workspaces: topN(ws, 12), top };
}

// ---- central intelligence: blast radius (inbound BFS = who breaks if this changes) ----
function blastRadius(id, depth = 3) {
  if (!byId.has(id)) return null;
  const seen = new Set([id]); let frontier = [id]; const layers = [];
  for (let d = 0; d < depth; d++) { const next = []; for (const cur of frontier) for (const e of (inAdj.get(cur) || [])) if (!seen.has(e.id)) { seen.add(e.id); next.push(e.id); } if (!next.length) break; layers.push(next.length); frontier = next; }
  const impacted = [...seen].filter((x) => x !== id);
  const files = new Set(impacted.map((x) => byId.get(x)?.source_file).filter(Boolean));
  return { node: nodeView(id), impactedNodes: impacted.length, impactedFiles: files.size, layers, top: impacted.map(nodeView).sort((a, b) => b.degree - a.degree).slice(0, 14) };
}
function dbView() {
  if (!dbIntel) return { error: 'db-intel.json missing — run pnpm graph:db' };
  const s = dbIntel.summary;
  return {
    summary: s,
    moneyRpcs: dbIntel.functions.filter((f) => f.money).map((f) => ({ rpc: f.name, securityDefiner: f.securityDefiner, idempotency: f.hasIdempotency, forUpdate: f.forUpdate, tables: f.touches.filter((t) => s.moneyTablesPresent.includes(t)), calledBy: (f.callers[0] || '').replace('services/api-gateway/src/', '') || '(internal/trigger)' })),
    topTables: dbIntel.tables.sort((a, b) => (b.policies.length + b.triggers.length + b.indexes) - (a.policies.length + a.triggers.length + a.indexes)).slice(0, 20).map((t) => ({ name: t.name, columns: t.columns, rls: t.rls, force: t.force, tenant: t.tenant, money: t.money, policies: t.policies.length, triggers: t.triggers.length, indexes: t.indexes })),
    uncalledRpcs: dbIntel.functions.filter((f) => !f.callers.length && f.securityDefiner).map((f) => f.name).slice(0, 30),
  };
}

// ---- atlas (full-graph community-colored layout, computed server-side + cached) ----
const PALETTE = ['#8B5CF6', '#58a6ff', '#3fb950', '#d29922', '#f85149', '#db61a2', '#39c5cf', '#bc8cff', '#e3b341', '#7ee787', '#ffa657', '#a5d6ff', '#ff7b72', '#56d364', '#e2c08d', '#79c0ff', '#f0883e', '#6ca0f6'];
const communitySizes = (() => { const m = {}; for (const n of nodes) m[n.community] = (m[n.community] || 0) + 1; return m; })();
const communityColor = (() => {
  const ranked = Object.keys(communitySizes).sort((a, b) => communitySizes[b] - communitySizes[a]);
  const map = new Map(); ranked.forEach((c, i) => map.set(c, PALETTE[i % PALETTE.length])); return map;
})();
const atlasCache = new Map();

// ---- community profiling: derive a human-readable name + what-it-is from the graph ----
const WS_NAMES = {
  'services/api-gateway': 'API Gateway', 'services/queue-workers': 'Queue Workers', 'services/webhook-service': 'Webhook Service', 'services/mobile-bff': 'Mobile BFF',
  'apps/merchant-control-plane': 'Merchant Control Plane', 'apps/storefront-runtime': 'Storefront Runtime', 'apps/identity-platform': 'Identity Platform', 'apps/platform-console': 'Platform Console', 'apps/marketing-site': 'Marketing Site', 'apps/app-marketplace': 'App Marketplace', 'apps/theme-marketplace': 'Theme Marketplace', 'apps/developer-portal': 'Developer Portal', 'apps/platform-operations-portal': 'Ops Portal',
  'apps/mobile/merchant-app': 'Merchant Mobile App',
  'packages/theme-engine': 'Theme Engine', 'packages/shared-types': 'Shared Types', 'packages/commerce-core': 'Commerce Core', 'packages/checkout-core': 'Checkout Core', 'packages/auth-core': 'Auth Core', 'packages/identity-core': 'Identity Core', 'packages/session-core': 'Session Core', 'packages/permission-core': 'Permission Core', 'packages/infrastructure': 'Infrastructure', 'packages/notification-core': 'Notification Core', 'packages/event-core': 'Event Core', 'packages/billing-core': 'Billing Core', 'packages/tenant-core': 'Tenant Core', 'packages/cms-core': 'CMS Core', 'packages/audit-core': 'Audit Core',
  'packages/typescript/ui': 'UI Design System', 'packages/typescript/api-client': 'API Client', 'packages/typescript/api-types': 'API Types',
  'packages/dart/models': 'Dart Models', 'packages/dart/core': 'Dart Core', 'packages/dart/api_client': 'Dart API Client', 'packages/dart/ui_kit': 'Dart UI Kit',
  '(root)': 'Repository root / governance',
};
function humanizeWs(ws) {
  if (WS_NAMES[ws]) return WS_NAMES[ws];
  const seg = (ws.split('/').pop() || ws).replace(/[-_]/g, ' ');
  return seg.replace(/\b\w/g, (c) => c.toUpperCase());
}
function deriveHint(ns) {
  const ext = {}; let routes = 0;
  for (const n of ns) { const sf = n.source_file || ''; const m = sf.match(/\.([a-z0-9]+)$/i); if (m) ext[m[1]] = (ext[m[1]] || 0) + 1; if (/\/route\.ts$/.test(sf)) routes++; }
  const top = Object.entries(ext).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (routes > ns.length * 0.15) return 'API routes';
  if (top === 'tsx') return 'React UI';
  if (top === 'dart') return 'Flutter';
  if (top === 'sql') return 'database / migrations';
  if (top === 'mjs') return 'tooling / tests';
  if (top === 'md') return 'docs / governance';
  if (top === 'ts') return 'TypeScript';
  return top || 'mixed';
}
let nodesByCommunity = null;
const profileCache = new Map();
function communityProfile(cid) {
  cid = String(cid);
  if (profileCache.has(cid)) return profileCache.get(cid);
  if (!nodesByCommunity) { nodesByCommunity = new Map(); for (const n of nodes) { const c = String(n.community); (nodesByCommunity.get(c) || nodesByCommunity.set(c, []).get(c)).push(n); } }
  const ns = nodesByCommunity.get(cid) || [];
  const ws = {}; for (const n of ns) { const w = workspaceOf(n.source_file); ws[w] = (ws[w] || 0) + 1; }
  const topWs = Object.entries(ws).sort((a, b) => b[1] - a[1]);
  const dom = topWs[0] ? topWs[0][0] : '(root)';
  const top = [...ns].sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0)).slice(0, 5).map((n) => n.label.slice(0, 40));
  const p = { id: cid, name: humanizeWs(dom), hint: deriveHint(ns), workspace: dom, size: ns.length, share: ns.length ? Math.round((topWs[0][1] / ns.length) * 100) : 0, top };
  profileCache.set(cid, p); return p;
}

function buildLayout(pool, edgeList) {
  const N = pool.length;
  const pos = pool.map((_, i) => ({ x: Math.cos((i / N) * 6.283) * 420 + (Math.random() * 60 - 30), y: Math.sin((i / N) * 6.283) * 420 + (Math.random() * 60 - 30), vx: 0, vy: 0 }));
  const iters = N > 1200 ? 220 : 300;
  const cell = 70, R2 = (cell * 3) ** 2;
  for (let it = 0; it < iters; it++) {
    const cool = 1 - (it / iters) * 0.6;
    const grid = new Map();
    for (let i = 0; i < N; i++) { const k = Math.floor(pos[i].x / cell) + ',' + Math.floor(pos[i].y / cell); (grid.get(k) || grid.set(k, []).get(k)).push(i); }
    for (let i = 0; i < N; i++) {
      const a = pos[i], gx = Math.floor(a.x / cell), gy = Math.floor(a.y / cell);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const arr = grid.get((gx + dx) + ',' + (gy + dy)); if (!arr) continue;
        for (const j of arr) { if (j <= i) continue; const b = pos[j]; let ddx = a.x - b.x, ddy = a.y - b.y; let d2 = ddx * ddx + ddy * ddy || 0.01; if (d2 > R2) continue; const f = 1100 / d2, d = Math.sqrt(d2); ddx /= d; ddy /= d; a.vx += ddx * f; a.vy += ddy * f; b.vx -= ddx * f; b.vy -= ddy * f; }
      }
    }
    for (const [s, t] of edgeList) { const a = pos[s], b = pos[t]; let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 0.01; const f = (d - 45) * 0.012; dx /= d; dy /= d; a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f; }
    for (let i = 0; i < N; i++) { const p = pos[i]; p.vx += -p.x * 0.0007; p.vy += -p.y * 0.0007; p.x += Math.max(-34, Math.min(34, p.vx * cool)); p.y += Math.max(-34, Math.min(34, p.vy * cool)); p.vx *= 0.86; p.vy *= 0.86; }
  }
  return pos;
}

function atlas({ limit = 1400, domain = '', community = '' } = {}) {
  limit = Math.max(100, Math.min(2600, limit));
  const key = `${limit}|${domain}|${community}`;
  if (atlasCache.has(key)) return atlasCache.get(key);
  let pool = nodes;
  if (domain && DOMAINS[domain]) pool = pool.filter(DOMAINS[domain]);
  if (community) pool = pool.filter((n) => String(n.community) === String(community));
  const total = pool.length;
  pool = [...pool].sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0)).slice(0, limit);
  const idx = new Map(pool.map((n, i) => [n.id, i]));
  const edgeList = [];
  for (const e of links) { const s = idx.get(e.source), t = idx.get(e.target); if (s !== undefined && t !== undefined && s !== t) edgeList.push([s, t]); }
  const pos = buildLayout(pool, edgeList);
  const outNodes = pool.map((n, i) => ({ id: n.id, label: (n.label || '').slice(0, 60), x: Math.round(pos[i].x), y: Math.round(pos[i].y), c: String(n.community), d: degree.get(n.id) || 0, color: communityColor.get(String(n.community)) || '#8b949e' }));
  const cc = {};
  for (const n of pool) cc[n.community] = (cc[n.community] || 0) + 1;
  const comms = Object.entries(cc).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([id, count]) => {
    const pr = communityProfile(id);
    return { id, count, color: communityColor.get(String(id)) || '#8b949e', name: pr.name, hint: pr.hint, workspace: pr.workspace, share: pr.share, size: pr.size, top: pr.top.slice(0, 3) };
  });
  const result = { total, shown: outNodes.length, nodes: outNodes, links: edgeList, communities: comms };
  atlasCache.set(key, result);
  return result;
}

// ---- http ----
const indexHtml = readFileSync(join(__dirname, 'index.html'), 'utf8');
function json(res, obj, code = 200) { const b = JSON.stringify(obj); res.writeHead(code, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(b) }); res.end(b); }

const server = createServer((req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const p = u.pathname;
  try {
    if (p === '/' || p === '/index.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(indexHtml); }
    if (p === '/logo.svg' || p === '/mark.svg') {
      const file = p === '/mark.svg' ? 'letbuyy-mark.svg' : 'letbuyy-logo-dark.svg';
      const fp = join(REPO_ROOT, 'apps/marketing-site/public/icons', file);
      if (existsSync(fp)) { res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'max-age=3600' }); return res.end(readFileSync(fp)); }
      res.writeHead(404); return res.end();
    }
    if (p === '/api/stats') return json(res, stats);
    if (p === '/api/search') return json(res, search(u.searchParams.get('q') || '', Number(u.searchParams.get('limit') || 50)));
    if (p === '/api/node') { const v = neighbors(u.searchParams.get('id'), 1, 60); const n = byId.get(u.searchParams.get('id')); return json(res, { node: nodeView(u.searchParams.get('id')), graph: v, raw: n || null }); }
    if (p === '/api/neighbors') return json(res, neighbors(u.searchParams.get('id'), Number(u.searchParams.get('depth') || 1), Number(u.searchParams.get('limit') || 80)));
    if (p === '/api/path') return json(res, shortestPath(u.searchParams.get('a'), u.searchParams.get('b')));
    if (p === '/api/graph-domain') return json(res, domain(u.searchParams.get('key') || 'services'));
    if (p === '/api/atlas') return json(res, atlas({ limit: Number(u.searchParams.get('limit') || 1400), domain: u.searchParams.get('domain') || '', community: u.searchParams.get('community') || '' }));
    if (p === '/api/community') {
      const cid = String(u.searchParams.get('id') || '');
      const pr = communityProfile(cid);
      const ns = (nodesByCommunity.get(cid) || []);
      const ws = {}; const files = new Set();
      for (const n of ns) { ws[workspaceOf(n.source_file)] = (ws[workspaceOf(n.source_file)] || 0) + 1; if (n.source_file) files.add(n.source_file); }
      const top = [...ns].sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0)).slice(0, 12).map((n) => nodeView(n.id));
      return json(res, { ...pr, files: files.size, color: communityColor.get(cid) || '#8b949e', workspaces: topN(ws, 6), top });
    }
    if (p === '/api/db') return json(res, dbView());
    if (p === '/api/infra') return json(res, infraIntel ? infraIntel.summary : { error: 'infra-intel.json missing — run pnpm graph:infra' });
    if (p === '/api/table') return json(res, traceTable({ db: dbIntel }, u.searchParams.get('name') || ''));
    if (p === '/api/rpc') return json(res, traceRPC({ db: dbIntel }, u.searchParams.get('name') || ''));
    if (p === '/api/policy') return json(res, tracePolicy({ db: dbIntel }, u.searchParams.get('table') || ''));
    if (p === '/api/owner') return json(res, findOwnership({ nodes, byId, deg: degree, infra: infraIntel }, u.searchParams.get('q') || ''));
    // ---- v3 domain / cross-domain / payment / security / deployment / incident / merchant / journey / secrets ----
    if (p === '/api/domains') return json(res, domainIntel ? listDomains(domainIntel) : { error: 'domain-intel.json missing — run pnpm graph:domain' });
    if (p === '/api/domain') {
      if (!domainIntel) return json(res, { error: 'domain-intel.json missing — run pnpm graph:domain' });
      const key = u.searchParams.get('key') || '';
      return json(res, key ? traceDomain(domainIntel, key) : { summary: domainIntel.summary, domains: listDomains(domainIntel), edges: domainIntel.edges });
    }
    if (p === '/api/cross-domain') return json(res, domainIntel ? (u.searchParams.get('key') ? blastDomain(domainIntel, u.searchParams.get('key')) : { edges: couplingMatrix(domainIntel) }) : { error: 'domain-intel.json missing' });
    if (p === '/api/payment') return json(res, buildPaymentIntel(dbIntel, domainIntel));
    if (p === '/api/security') return json(res, buildSecurityGraph(dbIntel, infraIntel, domainIntel));
    if (p === '/api/deployment') return json(res, buildDeploymentIntel(infraIntel, domainIntel));
    if (p === '/api/incident') return json(res, traceIncident(domainIntel, dbIntel, infraIntel, u.searchParams.get('domain') || u.searchParams.get('q') || 'payments'));
    if (p === '/api/merchant') return json(res, buildMerchantIntel(domainIntel));
    if (p === '/api/customer-journey') return json(res, customerJourney());
    if (p === '/api/secrets') return json(res, secretIntel());
    // ---- v4: runtime / deployment-state / change-impact / execution / memory / merchant-operating ----
    if (p === '/api/runtime') return json(res, runtimeIntel);
    if (p === '/api/deployment-state') return json(res, deploymentStateData);
    if (p === '/api/change-impact') return json(res, domainIntel ? changeImpact(domainIntel, dbIntel, infraIntel, u.searchParams.get('key') || 'payments') : { error: 'domain-intel.json missing — run pnpm graph:domain' });
    if (p === '/api/execution') return json(res, executionIntel);
    if (p === '/api/merchant-operating') return json(res, buildMerchantOperatingGraph(domainIntel, dbIntel));
    if (p === '/api/incident-response') return json(res, incidentResponse(domainIntel, dbIntel, infraIntel, u.searchParams.get('domain') || u.searchParams.get('q') || 'payments'));
    // ---- v5: live operating intelligence ----
    if (p === '/api/runtime-intelligence') return json(res, runtimeObs);
    if (p === '/api/merchant-intelligence') return json(res, merchantIntelV5);
    if (p === '/api/revenue-intelligence') return json(res, revenueIntel);
    if (p === '/api/security-intelligence') return json(res, securityIntelV5);
    if (p === '/api/incident-intelligence') return json(res, incidentIntelligenceV5(u.searchParams.get('domain') || u.searchParams.get('q') || 'payments'));
    if (p === '/api/customer-intelligence') return json(res, journeyIntel);
    if (p === '/api/production-readiness') return json(res, readinessIntel);
    if (p === '/api/decision-engine') return json(res, decisionEngine);
    // ---- Omega: merchant / customer / revenue / cost / telemetry / memory / fix / unified ----
    if (p === '/api/merchant-health') return json(res, merchantHealth);
    if (p === '/api/merchant-growth') return json(res, merchantGrowth);
    if (p === '/api/merchant-adoption') return json(res, merchantAdoption);
    if (p === '/api/merchant-risk') return json(res, merchantRisk);
    if (p === '/api/merchant-churn') return json(res, merchantChurn);
    if (p === '/api/customer-intelligence-v2') return json(res, customerV2);
    if (p === '/api/revenue-v2') return json(res, revenueV2);
    if (p === '/api/cost-intelligence') return json(res, costIntel);
    if (p === '/api/telemetry') return json(res, telemetryIntel);
    if (p === '/api/memory-v2') return json(res, memoryV2);
    if (p === '/api/fix-engine') return json(res, fixEngine);
    if (p === '/api/unified-intelligence') return json(res, unifiedIntel);
    if (p === '/api/discovery-v2') return json(res, discoveryV2);
    if (p === '/api/production-readiness-v2') return json(res, readinessV2);
    if (p === '/api/decision-v2') return json(res, decisionV2);
    if (p === '/api/memory') {
      if (!memoryIntel || memoryIntel.error) return json(res, memoryIntel || { error: 'memory-intel missing' });
      const q = u.searchParams.get('q') || '', mig = u.searchParams.get('migration'), mode = u.searchParams.get('mode');
      if (mig) return json(res, migrationWhy(memoryIntel, mig));
      if (mode === 'rule') return json(res, ruleWhy(memoryIntel, q));
      if (mode === 'affecting') return json(res, decisionsAffecting(memoryIntel, q));
      return json(res, q ? whyBuilt(memoryIntel, q) : { summary: memoryIntel.summary, decisions: memoryIntel.decisions.slice(0, 40), migrations: memoryIntel.migrations.slice(-12), sources: memoryIntel.sources });
    }
    if (p === '/api/blast') { const id = u.searchParams.get('id'); const q = u.searchParams.get('q'); let nid = id; if (!nid && q) { const r = search(q, 1); nid = r[0] && r[0].id; } return json(res, nid ? blastRadius(nid, Number(u.searchParams.get('depth') || 3)) : { error: 'not found' }); }
    if (p === '/api/health') return json(res, { ok: true, nodes: nodes.length, dbIntel: !!dbIntel });
    res.writeHead(404, { 'content-type': 'application/json' }); res.end('{"error":"not found"}');
  } catch (err) { json(res, { error: String(err) }, 500); }
});

server.listen(PORT, () => {
  console.log(`\n  LetBuyy Graph Intelligence Platform`);
  console.log(`  ${stats.nodes.toLocaleString()} nodes · ${stats.edges.toLocaleString()} edges · ${stats.communities.toLocaleString()} communities`);
  console.log(`  graph built ${stats.freshness_minutes} min ago${stats.built_at_commit ? ' @ ' + stats.built_at_commit.slice(0, 8) : ''}`);
  console.log(`\n  ▶  http://localhost:${PORT}\n`);
});
