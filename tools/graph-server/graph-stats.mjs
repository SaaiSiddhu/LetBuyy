#!/usr/bin/env node
// pnpm graph:stats — print graph statistics (nodes, edges, languages, workspaces, routes).
import { existsSync, readFileSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GRAPH = join(ROOT, 'graphify-out', 'graph.json');
if (!existsSync(GRAPH)) { console.error('graph.json missing. Run: pnpm graph:update'); process.exit(1); }

const g = JSON.parse(readFileSync(GRAPH, 'utf8'));
const nodes = g.nodes || [], links = g.links || g.edges || [];
const st = statSync(GRAPH);
const langs = {}, ws = {};
let routes = 0, pages = 0;
const wsOf = (sf) => (sf.match(/^(apps\/mobile\/[^/]+|apps\/[^/]+|services\/[^/]+|packages\/[^/]+\/[^/]+|packages\/[^/]+)/) || ['(root)'])[0];
for (const n of nodes) {
  const sf = n.source_file || '';
  const ext = (sf.match(/\.([a-z0-9]+)$/i) || [])[1];
  if (ext) langs[ext] = (langs[ext] || 0) + 1;
  ws[wsOf(sf)] = (ws[wsOf(sf)] || 0) + 1;
  if (/\/route\.ts$/.test(sf)) routes++;
  if (/\/page\.tsx$/.test(sf)) pages++;
}
const top = (o, k) => Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, k);
const communities = new Set(nodes.map((n) => n.community)).size;

console.log(`\nLetBuyy Graph — statistics`);
console.log(`  nodes        ${nodes.length.toLocaleString()}`);
console.log(`  edges        ${links.length.toLocaleString()}`);
console.log(`  communities  ${communities.toLocaleString()}`);
console.log(`  API routes   ${routes}    pages ${pages}`);
console.log(`  size         ${(st.size / 1048576).toFixed(1)} MB    built ${Math.round((Date.now() - st.mtimeMs) / 60000)} min ago${g.built_at_commit ? ' @ ' + g.built_at_commit.slice(0, 8) : ''}`);
console.log(`  languages    ${top(langs, 8).map(([k, v]) => `${k}:${v}`).join('  ')}`);
console.log(`\n  workspaces (top 12 by node count):`);
for (const [k, v] of top(ws, 12)) console.log(`    ${String(v).padStart(6)}  ${k}`);
console.log('');
