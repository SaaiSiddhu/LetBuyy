#!/usr/bin/env node
// LetBuyy Graph Intelligence Platform — local viewer + query API.
// Zero dependencies (Node http only). Reads graphify-out/graph.json directly.
// Start: `pnpm graph:ui` → http://localhost:3333
import { createServer } from 'node:http';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

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

// ---- http ----
const indexHtml = readFileSync(join(__dirname, 'index.html'), 'utf8');
function json(res, obj, code = 200) { const b = JSON.stringify(obj); res.writeHead(code, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(b) }); res.end(b); }

const server = createServer((req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const p = u.pathname;
  try {
    if (p === '/' || p === '/index.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(indexHtml); }
    if (p === '/api/stats') return json(res, stats);
    if (p === '/api/search') return json(res, search(u.searchParams.get('q') || '', Number(u.searchParams.get('limit') || 50)));
    if (p === '/api/node') { const v = neighbors(u.searchParams.get('id'), 1, 60); const n = byId.get(u.searchParams.get('id')); return json(res, { node: nodeView(u.searchParams.get('id')), graph: v, raw: n || null }); }
    if (p === '/api/neighbors') return json(res, neighbors(u.searchParams.get('id'), Number(u.searchParams.get('depth') || 1), Number(u.searchParams.get('limit') || 80)));
    if (p === '/api/path') return json(res, shortestPath(u.searchParams.get('a'), u.searchParams.get('b')));
    if (p === '/api/domain') return json(res, domain(u.searchParams.get('key') || 'services'));
    if (p === '/api/health') return json(res, { ok: true, nodes: nodes.length });
    res.writeHead(404, { 'content-type': 'application/json' }); res.end('{"error":"not found"}');
  } catch (err) { json(res, { error: String(err) }, 500); }
});

server.listen(PORT, () => {
  console.log(`\n  LetBuyy Graph Intelligence Platform`);
  console.log(`  ${stats.nodes.toLocaleString()} nodes · ${stats.edges.toLocaleString()} edges · ${stats.communities.toLocaleString()} communities`);
  console.log(`  graph built ${stats.freshness_minutes} min ago${stats.built_at_commit ? ' @ ' + stats.built_at_commit.slice(0, 8) : ''}`);
  console.log(`\n  ▶  http://localhost:${PORT}\n`);
});
