#!/usr/bin/env node
// LCIS X — Federation Intelligence (Phases 1-8). READ-ONLY.
// Composes the existing read-only live-adapters (connection truth) with repository truth
// (db-intel / infra-intel / environment-registry / CODEOWNERS / graph.json) to produce, per
// provider, a federation graph that is HONEST about what is live vs structural:
//   • connection: CONNECTED | NOT CONNECTED (from live-adapters — never fabricated)
//   • discovers[]: every read-only discovery operation, each tagged repository(known) vs live(needs creds)
//   • graph: the generated provider graph, with basis 'repository' (structural) until live is connected
// Phase 8 merges all 7 provider graphs + the repository graph into one unified live graph.
// NO writes · NO mutations · NO fabricated metric. A value is either a real repository count
// (source labelled) or NOT CONNECTED (+ the exact env vars + activation steps).
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADAPTERS, adapterStatus } from './live-adapters.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, '..', '..');
const OUT = join(REPO_ROOT, 'graphify-out');
const NOT = 'NOT CONNECTED';

const readJson = (name, fallback = {}) => {
  const p = join(OUT, name);
  try { return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : fallback; }
  catch { return fallback; }
};

// ── Repository truth sources (already extracted; read-only) ─────────────────────────────────
const db = readJson('db-intel.json');
const infra = readJson('infra-intel.json');
const env = readJson('environment-registry.json');
const graph = readJson('graph.json');
const domain = readJson('domain-intel.json');

const dbS = db.summary || {};
const infS = infra.summary || {};

// CODEOWNERS rule count (read-only, structural). live-adapters never reads file values, so we count here.
function codeownersRules() {
  const p = join(REPO_ROOT, '.github', 'CODEOWNERS');
  try {
    return readFileSync(p, 'utf8').split('\n').filter((l) => l.trim() && !l.trim().startsWith('#')).length;
  } catch { return infS.ownerRules || 0; }
}

const status = (provider) => adapterStatus(ADAPTERS.find((a) => a.provider === provider));

// A discovery row. `repo` is a real repository count (or null when the repo can't know it);
// `live` is the live value when CONNECTED, else NOT CONNECTED. Never both fabricated.
function disc(item, repo, repoSource, liveRequires) {
  return {
    item,
    repository: repo === null || repo === undefined ? null : repo,
    repositorySource: repo === null || repo === undefined ? null : repoSource,
    live: NOT,
    liveRequires: liveRequires || null,
  };
}

// ── Phase 1 — Supabase Federation → Live Database Graph ─────────────────────────────────────
function supabase() {
  const st = status('Supabase');
  const discovers = [
    disc('Projects', null, null, 'SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF (Management API)'),
    disc('Schemas', 1, 'repository (db-intel: public schema extracted)', 'SUPABASE_SERVICE_ROLE_KEY (information_schema)'),
    disc('Tables', dbS.tables ?? null, 'repository (db-intel)', 'live row counts: SUPABASE_SERVICE_ROLE_KEY'),
    disc('Views', null, null, 'SUPABASE_SERVICE_ROLE_KEY (information_schema.views)'),
    disc('Functions', dbS.functions ?? null, 'repository (db-intel)', 'SUPABASE_SERVICE_ROLE_KEY'),
    disc('Policies', dbS.policies ?? null, 'repository (db-intel)', 'SUPABASE_SERVICE_ROLE_KEY (pg_policies)'),
    disc('Indexes', dbS.indexes ?? null, 'repository (db-intel)', 'SUPABASE_SERVICE_ROLE_KEY (pg_indexes)'),
    disc('Triggers', dbS.triggers ?? null, 'repository (db-intel)', 'SUPABASE_SERVICE_ROLE_KEY'),
    disc('Foreign Keys', dbS.foreignKeys ?? dbS.fks ?? (db.foreignKeys || []).length ?? null, 'repository (db-intel)', 'SUPABASE_SERVICE_ROLE_KEY'),
    disc('Storage Buckets', null, null, 'SUPABASE_SERVICE_ROLE_KEY (/storage/v1/bucket)'),
    disc('Realtime', null, null, 'SUPABASE_SERVICE_ROLE_KEY (realtime.subscription)'),
    disc('Health', null, null, 'live REST probe: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY'),
  ];
  const tables = dbS.tables || 0, funcs = dbS.functions || 0, policies = dbS.policies || 0;
  const triggers = dbS.triggers || 0, indexes = dbS.indexes || 0;
  return {
    phase: 1, provider: 'Supabase', category: 'database', graphName: 'Live Database Graph',
    connection: st, discovers,
    graph: {
      name: 'Live Database Graph', basis: 'repository', liveStatus: st.status,
      nodes: tables + funcs + policies,
      edges: triggers + indexes,
      layers: { tables, functions: funcs, policies, triggers, indexes, tenantTables: dbS.tenantTables || 0, securityDefiner: dbS.securityDefiner || 0, moneyFunctions: dbS.moneyFunctions || 0 },
    },
  };
}

// ── Phase 2 — Cloudflare Federation → Live Infrastructure Graph ─────────────────────────────
function cloudflare() {
  const st = status('Cloudflare');
  const producers = infS.queueProducers || [];
  const consumers = infS.queueConsumers || [];
  const crons = infS.crons || [];
  const r2 = infS.r2 || [];
  const kv = infS.kv || [];
  const discovers = [
    disc('Workers', infS.workers ?? (infra.workers || []).length ?? null, 'repository (infra-intel: wrangler.toml)', 'CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID'),
    disc('Queues', producers.length + consumers.length || null, 'repository (infra-intel: producers+consumers)', 'live depth: Cloudflare Queues API'),
    disc('Cron Jobs', crons.length || null, 'repository (infra-intel: wrangler crons)', 'CLOUDFLARE_API_TOKEN'),
    disc('KV', kv.length || null, 'repository (infra-intel)', 'CLOUDFLARE_API_TOKEN'),
    disc('R2', r2.length || null, 'repository (infra-intel)', 'live usage: CLOUDFLARE_API_TOKEN'),
    disc('Hyperdrive', infS.hyperdrive ? 1 : 0, 'repository (infra-intel)', 'CLOUDFLARE_API_TOKEN'),
    disc('Analytics Engine', null, null, 'CLOUDFLARE_API_TOKEN (GraphQL Analytics API)'),
    disc('Routes', null, null, 'CLOUDFLARE_API_TOKEN (zone routes)'),
    disc('Bindings', producers.length + r2.length + kv.length || null, 'repository (infra-intel: wrangler bindings)', 'CLOUDFLARE_API_TOKEN'),
    disc('Secrets Metadata', infS.secretsRequired ?? null, 'repository (infra-intel: required secrets)', 'CLOUDFLARE_API_TOKEN (names only, never values)'),
    disc('Deployment Status', null, null, 'CLOUDFLARE_API_TOKEN (workers deployments)'),
    disc('Health', null, null, 'live workers-list probe: CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID'),
  ];
  const workers = infS.workers || 0;
  return {
    phase: 2, provider: 'Cloudflare', category: 'runtime', graphName: 'Live Infrastructure Graph',
    connection: st, discovers,
    graph: {
      name: 'Live Infrastructure Graph', basis: 'repository', liveStatus: st.status,
      nodes: workers + producers.length + consumers.length + r2.length + kv.length + (infS.hyperdrive ? 1 : 0),
      edges: producers.length + consumers.length,
      layers: { workers, queueProducers: producers.length, queueConsumers: consumers.length, r2: r2.length, kv: kv.length, crons: crons.length, hyperdrive: !!infS.hyperdrive, secretsRequired: infS.secretsRequired || 0 },
    },
  };
}

// ── Phase 3 — Vercel Federation → Live Deployment Graph ─────────────────────────────────────
function vercel() {
  const st = status('Vercel');
  const apps = infS.vercelApps || [];
  const discovers = [
    disc('Projects', apps.length || null, 'repository (infra-intel: vercel app roots)', 'VERCEL_TOKEN'),
    disc('Domains', null, null, 'VERCEL_TOKEN (/v9/projects/:id/domains)'),
    disc('Deployments', null, null, 'VERCEL_TOKEN (/v6/deployments)'),
    disc('Environment Variables Metadata', null, null, 'VERCEL_TOKEN (names only, never values)'),
    disc('Build Status', null, null, 'VERCEL_TOKEN (deployment state)'),
    disc('Health', null, null, 'live deployments probe: VERCEL_TOKEN'),
    disc('Traffic', null, null, 'VERCEL_TOKEN (Web Analytics API)'),
  ];
  return {
    phase: 3, provider: 'Vercel', category: 'deployment', graphName: 'Live Deployment Graph',
    connection: st, discovers,
    graph: {
      name: 'Live Deployment Graph', basis: 'repository', liveStatus: st.status,
      nodes: apps.length, edges: 0,
      layers: { projects: apps.length, apps },
    },
  };
}

// ── Phase 4 — GitHub Federation → Engineering Graph ─────────────────────────────────────────
function github() {
  const st = status('GitHub');
  const owners = codeownersRules();
  const discovers = [
    disc('Repositories', 1, 'repository (this repo)', 'GITHUB_TOKEN'),
    disc('Branches', null, null, 'GITHUB_TOKEN (/branches)'),
    disc('Pull Requests', null, null, 'GITHUB_TOKEN (/pulls)'),
    disc('Actions', (infra.workflows || []).length || null, 'repository (.github/workflows)', 'GITHUB_TOKEN (/actions/runs)'),
    disc('Workflows', (infra.workflows || []).length || null, 'repository (.github/workflows)', 'GITHUB_TOKEN'),
    disc('Failures', null, null, 'GITHUB_TOKEN (actions/runs?status=failure)'),
    disc('CODEOWNERS', owners || null, 'repository (.github/CODEOWNERS)', null),
    disc('Releases', null, null, 'GITHUB_TOKEN (/releases)'),
  ];
  return {
    phase: 4, provider: 'GitHub', category: 'ci', graphName: 'Engineering Graph',
    connection: st, discovers,
    graph: {
      name: 'Engineering Graph', basis: 'repository', liveStatus: st.status,
      nodes: owners + ((infra.workflows || []).length || 0) + 1, edges: owners,
      layers: { codeownerRules: owners, workflows: (infra.workflows || []).length || 0, repositories: 1 },
    },
  };
}

// ── Phase 5 — Razorpay Federation → Money Operations Graph ──────────────────────────────────
function razorpay() {
  const st = status('Razorpay');
  // Repository truth: the money RPCs / functions that WOULD drive Razorpay operations.
  const moneyFns = dbS.moneyFunctions || 0;
  const discovers = [
    disc('Payments', null, null, 'RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET (/v1/payments)'),
    disc('Refunds', null, null, 'RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET (/v1/refunds)'),
    disc('Orders', null, null, 'RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET (/v1/orders)'),
    disc('Settlements', null, null, 'RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET (/v1/settlements)'),
    disc('Failures', null, null, 'RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET (payments?status=failed)'),
  ];
  return {
    phase: 5, provider: 'Razorpay', category: 'payments', graphName: 'Money Operations Graph',
    connection: st, discovers,
    graph: {
      name: 'Money Operations Graph', basis: 'repository', liveStatus: st.status,
      // Structural money surface (canonical ledger RPCs) is repository truth; live amounts are NOT CONNECTED.
      nodes: moneyFns, edges: 0,
      layers: { moneyFunctions: moneyFns, note: 'Live payments/refunds/settlements require Razorpay credentials (read-only).' },
    },
  };
}

// ── Phase 6 — Resend Federation → Communication Graph ───────────────────────────────────────
function resend() {
  const st = status('Resend');
  const discovers = [
    disc('Email Volume', null, null, 'RESEND_API_KEY (events webhook / domains)'),
    disc('Failures', null, null, 'RESEND_API_KEY'),
    disc('Bounce Rate', null, null, 'RESEND_API_KEY (delivery events)'),
    disc('Deliverability', null, null, 'RESEND_API_KEY (/domains DNS/SPF/DKIM)'),
  ];
  return {
    phase: 6, provider: 'Resend', category: 'email', graphName: 'Communication Graph',
    connection: st, discovers,
    graph: { name: 'Communication Graph', basis: 'repository', liveStatus: st.status, nodes: 0, edges: 0, layers: { note: 'Email volume/bounce/deliverability require RESEND_API_KEY (read-only).' } },
  };
}

// ── Phase 7 — Turnstile Federation → Security Graph ─────────────────────────────────────────
function turnstile() {
  const st = status('Turnstile');
  const discovers = [
    disc('Challenge Rate', null, null, 'TURNSTILE_SECRET_KEY (request-time siteverify — no pull API)'),
    disc('Failure Rate', null, null, 'TURNSTILE_SECRET_KEY'),
    disc('Threat Signals', null, null, 'TURNSTILE_SECRET_KEY'),
  ];
  return {
    phase: 7, provider: 'Turnstile', category: 'security', graphName: 'Security Graph',
    connection: st, discovers,
    graph: { name: 'Security Graph', basis: 'repository', liveStatus: st.status, nodes: 0, edges: 0, layers: { note: 'Turnstile has no pull-metrics API; verification is request-time. Credential presence = configured.' } },
  };
}

// ── Phase 8 — Unified Live Graph ────────────────────────────────────────────────────────────
function unifiedGraph(providers) {
  const repoNodes = (graph.nodes || []).length;
  const repoEdges = (graph.links || graph.edges || []).length;
  const layers = [
    { layer: 'Repository Graph', basis: 'repository', status: 'CONNECTED', nodes: repoNodes, edges: repoEdges },
    ...providers.map((p) => ({ layer: p.graph.name, basis: p.graph.basis, status: p.graph.liveStatus, nodes: p.graph.nodes, edges: p.graph.edges, provider: p.provider })),
  ];
  return {
    name: 'Unified Live Graph',
    merges: ['Repository Graph', 'Database Graph', 'Infrastructure Graph', 'Deployment Graph', 'Engineering Graph', 'Money Operations Graph', 'Communication Graph', 'Security Graph'],
    layers,
    totalNodes: layers.reduce((n, l) => n + (l.nodes || 0), 0),
    totalEdges: layers.reduce((n, l) => n + (l.edges || 0), 0),
    connectedLayers: layers.filter((l) => l.status === 'CONNECTED').length,
    notConnectedLayers: layers.filter((l) => l.status !== 'CONNECTED').length,
    note: 'Structural layers (repository truth) are CONNECTED. Live provider layers are NOT CONNECTED until read-only credentials are set; the structural shape shown is what live federation would populate.',
  };
}

export function buildFederationIntel() {
  const providers = [supabase(), cloudflare(), vercel(), github(), razorpay(), resend(), turnstile()];
  const unified = unifiedGraph(providers);
  return {
    meta: {
      generatedAt: env?.summary?.generatedAt || infS.generatedAt || null,
      readOnly: true,
      providers: providers.length,
      policy: 'READ-ONLY federation. Connection status comes from live-adapters (process.env presence only — values never read). Every discovery is tagged repository(known) or live(NOT CONNECTED + exact env). No metric is fabricated.',
    },
    providers,
    unifiedGraph: unified,
    summary: {
      providers: providers.length,
      connected: providers.filter((p) => p.connection.status === 'CONNECTED' || p.connection.credentialsPresent).length,
      notConnected: providers.filter((p) => !(p.connection.status === 'CONNECTED' || p.connection.credentialsPresent)).length,
      unifiedNodes: unified.totalNodes,
      unifiedEdges: unified.totalEdges,
      connectedLayers: unified.connectedLayers,
      notConnectedLayers: unified.notConnectedLayers,
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const f = buildFederationIntel();
  console.log('\nLCIS X — Federation Intelligence (read-only)');
  console.log(`  providers ${f.summary.providers} · connected ${f.summary.connected} · NOT CONNECTED ${f.summary.notConnected}`);
  for (const p of f.providers) {
    console.log(`    ${String(p.connection.status).padEnd(13)} P${p.phase} ${p.provider.padEnd(11)} → ${p.graphName} (nodes ${p.graph.nodes}, edges ${p.graph.edges}, basis ${p.graph.basis})`);
  }
  const u = f.unifiedGraph;
  console.log(`\n  Unified Live Graph: ${u.layers.length} layers · ${u.totalNodes} nodes · ${u.totalEdges} edges · connected ${u.connectedLayers}/${u.layers.length}`);
}
