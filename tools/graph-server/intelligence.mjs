#!/usr/bin/env node
// LetBuyy Central Intelligence engine — architecture/dependency/impact/flow queries over
// the Graphify graph + the DB intelligence layer. Pure functions; loaded by the CLI
// (intel-cli.mjs) and the graph server (/api/intel). No external dependencies.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function load() {
  const g = JSON.parse(readFileSync(join(ROOT, 'graphify-out/graph.json'), 'utf8'));
  const dbPath = join(ROOT, 'graphify-out/db-intel.json');
  const db = existsSync(dbPath) ? JSON.parse(readFileSync(dbPath, 'utf8')) : null;
  const infraPath = join(ROOT, 'graphify-out/infra-intel.json');
  const infra = existsSync(infraPath) ? JSON.parse(readFileSync(infraPath, 'utf8')) : null;
  const nodes = g.nodes || [], links = g.links || g.edges || [];
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const out = new Map(), inc = new Map(), deg = new Map();
  for (const e of links) {
    (out.get(e.source) || out.set(e.source, []).get(e.source)).push({ id: e.target, rel: e.relation });
    (inc.get(e.target) || inc.set(e.target, []).get(e.target)).push({ id: e.source, rel: e.relation });
    deg.set(e.source, (deg.get(e.source) || 0) + 1); deg.set(e.target, (deg.get(e.target) || 0) + 1);
  }
  return { nodes, links, byId, out, inc, deg, db, infra };
}

function resolveId(ix, q) {
  if (ix.byId.has(q)) return q;
  const ql = q.toLowerCase();
  let best = null, bd = -1;
  for (const n of ix.nodes) { const l = (n.label || '').toLowerCase(); if (l === ql || l.startsWith(ql) || l.includes(ql) || (n.source_file || '').toLowerCase().includes(ql)) { const d = ix.deg.get(n.id) || 0; if (d > bd) { bd = d; best = n.id; } } }
  return best;
}
const view = (ix, id) => { const n = ix.byId.get(id); return n ? { id, label: n.label, file: n.source_file, loc: n.source_location, degree: ix.deg.get(id) || 0, community: n.community } : null; };

export function findDependencies(ix, q) { const id = resolveId(ix, q); if (!id) return null; return { node: view(ix, id), dependsOn: (ix.out.get(id) || []).map((e) => ({ ...view(ix, e.id), rel: e.rel })).filter(Boolean) }; }
export function findConsumers(ix, q) { const id = resolveId(ix, q); if (!id) return null; return { node: view(ix, id), consumedBy: (ix.inc.get(id) || []).map((e) => ({ ...view(ix, e.id), rel: e.rel })).filter(Boolean) }; }

export function findBlastRadius(ix, q, depth = 3) {
  const id = resolveId(ix, q); if (!id) return null;
  const seen = new Set([id]); let frontier = [id]; const layers = [];
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const cur of frontier) for (const e of (ix.inc.get(cur) || [])) if (!seen.has(e.id)) { seen.add(e.id); next.push(e.id); }
    if (!next.length) break; layers.push(next.length); frontier = next;
  }
  const impacted = [...seen].filter((x) => x !== id);
  const files = new Set(impacted.map((x) => ix.byId.get(x)?.source_file).filter(Boolean));
  return { node: view(ix, id), impactedNodes: impacted.length, impactedFiles: files.size, layers, topImpacted: impacted.map((x) => view(ix, x)).sort((a, b) => b.degree - a.degree).slice(0, 12) };
}

export function findCriticalSystems(ix, n = 20) {
  return ix.nodes.map((nd) => ({ ...view(ix, nd.id) })).sort((a, b) => b.degree - a.degree).slice(0, n);
}

export function tracePaymentFlow(ix) {
  if (!ix.db) return { error: 'db-intel.json missing — run pnpm graph:db' };
  const money = ix.db.functions.filter((f) => f.money);
  return {
    moneyRpcs: money.map((f) => ({ rpc: f.name, securityDefiner: f.securityDefiner, idempotency: f.hasIdempotency, forUpdate: f.forUpdate, tables: f.touches.filter((t) => ix.db.summary.moneyTablesPresent.includes(t)), calledBy: f.callers })),
    moneyTables: ix.db.summary.moneyTablesPresent,
    invariant: 'money mutations route through SECURITY DEFINER RPCs (db.rpc); enforced by canonical-ledger-only-validator',
  };
}
export function traceTenantFlow(ix) {
  if (!ix.db) return { error: 'db-intel.json missing' };
  const t = ix.db.tables.filter((x) => x.tenant);
  return { tenantTables: t.length, withRls: t.filter((x) => x.rls).length, withForce: t.filter((x) => x.force).length, candidatesWithoutDetectedRls: ix.db.summary.tenantTablesWithoutRls, note: 'rls-force-coverage-validator is authoritative; candidates may be service-role-only or RLS-via-pattern-not-regex-detected' };
}
export function traceFlow(ix, routeMatch) {
  if (!ix.db) return { error: 'db-intel.json missing' };
  const routes = Object.entries(ix.db.routeRpc).filter(([r]) => r.includes(routeMatch));
  return routes.map(([route, rpcs]) => ({ route, rpcs, tables: ix.db.routeTables[route] || [] }));
}

// ---- v2: SQL lineage queries ----
export function traceRPC(ix, name) {
  if (!ix.db) return { error: 'db-intel.json missing' };
  const f = ix.db.functions.find((x) => x.name === name) || ix.db.functions.find((x) => x.name.includes(name));
  if (!f) return { error: `RPC '${name}' not found` };
  return { rpc: f.name, securityDefiner: f.securityDefiner, idempotency: f.hasIdempotency, forUpdate: f.forUpdate, money: f.money, tables: f.touches, calledByRoutes: f.callers, definedIn: f.definedIn };
}
export function traceTable(ix, name) {
  if (!ix.db) return { error: 'db-intel.json missing' };
  const t = ix.db.tables.find((x) => x.name === name);
  if (!t) return { error: `table '${name}' not found` };
  const touchedBy = ix.db.functions.filter((f) => f.touches.includes(name)).map((f) => f.name);
  const reachedByRoutes = Object.entries(ix.db.routeTables).filter(([, ts]) => ts.includes(name)).map(([r]) => r);
  return { table: name, columns: t.columns, rls: t.rls, force: t.force, tenant: t.tenant, money: t.money, policies: t.policies, triggers: t.triggers, indexes: t.indexes, touchedByRpcs: touchedBy, reachedByRoutes };
}
export function tracePolicy(ix, table) {
  if (!ix.db) return { error: 'db-intel.json missing' };
  return { table, policies: ix.db.policies.filter((p) => p.table === table) };
}
export function traceRoute(ix, routeMatch) { return traceFlow(ix, routeMatch); }
export function traceRefund(ix) { if (!ix.db) return { error: 'db-intel.json missing' }; return ix.db.functions.filter((f) => /refund|return/.test(f.name)).map((f) => traceRPC(ix, f.name)); }
export function tracePayout(ix) { if (!ix.db) return { error: 'db-intel.json missing' }; return ix.db.functions.filter((f) => /payout|settle|commission/.test(f.name)).map((f) => traceRPC(ix, f.name)); }

// ---- v2: ownership (CODEOWNERS) ----
export function findOwnership(ix, q) {
  const id = resolveId(ix, q); const node = id ? view(ix, id) : null;
  const file = node?.file || q;
  if (!ix.infra || !ix.infra.ownership.length) return { node, file, owners: null, note: 'infra-intel.json missing — run pnpm graph:infra' };
  let best = null, blen = -1;
  for (const r of ix.infra.ownership) { const pat = r.path === '*' ? '' : r.path.replace(/^\//, '').replace(/\/$/, ''); if (pat === '' || (file || '').includes(pat)) if (pat.length >= blen) { blen = pat.length; best = r; } }
  return { node, file, rule: best?.path, owners: best?.owners || null };
}
export function infraSummary(ix) { return ix.infra ? ix.infra.summary : { error: 'infra-intel.json missing — run pnpm graph:infra' }; }

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const [cmd, ...rest] = process.argv.slice(2);
  const arg = rest.join(' ');
  const ix = load();
  const p = (o) => console.log(JSON.stringify(o, null, 2));
  switch (cmd) {
    case 'deps': p(findDependencies(ix, arg)); break;
    case 'consumers': p(findConsumers(ix, arg)); break;
    case 'blast': p(findBlastRadius(ix, arg)); break;
    case 'critical': p(findCriticalSystems(ix, Number(arg) || 20)); break;
    case 'payment': p(tracePaymentFlow(ix)); break;
    case 'tenant': p(traceTenantFlow(ix)); break;
    case 'flow': case 'route': p(traceFlow(ix, arg || 'checkout')); break;
    case 'rpc': p(traceRPC(ix, arg)); break;
    case 'table': p(traceTable(ix, arg)); break;
    case 'policy': p(tracePolicy(ix, arg)); break;
    case 'refund': p(traceRefund(ix)); break;
    case 'payout': p(tracePayout(ix)); break;
    case 'owner': p(findOwnership(ix, arg)); break;
    case 'infra': p(infraSummary(ix)); break;
    default:
      console.log(`LetBuyy Central Intelligence (LCIS) — usage:
  CODE        deps | consumers | blast | critical "<symbol>"
  SQL         rpc "<rpc>" | table "<table>" | policy "<table>" | payment | refund | payout | tenant
  FLOW        flow|route "<route substr>"
  OWNERSHIP   owner "<symbol|path>"        (from .github/CODEOWNERS)
  INFRA       infra                         (workers, queues, bindings, secrets, deploy targets)
e.g.  pnpm graph:intel blast "getSupabaseAdmin"  ·  pnpm graph:intel table gift_card_accounts  ·  pnpm graph:intel owner payments.ts`);
  }
}
