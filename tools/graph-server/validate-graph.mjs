#!/usr/bin/env node
// pnpm graph:validate — sanity-check the generated graph exists and is well-formed.
import { existsSync, statSync, readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const GRAPH = join(ROOT, 'graphify-out', 'graph.json');
const fail = (m) => { console.error('[graph:validate] FAIL —', m); process.exit(1); };

if (!existsSync(GRAPH)) fail(`graph.json missing. Run: pnpm graph:update`);
const size = statSync(GRAPH).size;
if (size < 1000) fail(`graph.json suspiciously small (${size} bytes)`);

let g;
try { g = JSON.parse(readFileSync(GRAPH, 'utf8')); } catch (e) { fail(`graph.json is not valid JSON: ${e.message}`); }
const nodes = g.nodes || [];
const links = g.links || g.edges || [];
if (!Array.isArray(nodes) || nodes.length < 100) fail(`too few nodes (${nodes.length})`);
if (!Array.isArray(links) || links.length < 100) fail(`too few links (${links.length})`);

// referential integrity: a sample of links must reference real node ids
const ids = new Set(nodes.map((n) => n.id));
let dangling = 0;
for (const e of links.slice(0, 5000)) { if (!ids.has(e.source) || !ids.has(e.target)) dangling++; }
if (dangling > links.slice(0, 5000).length * 0.05) fail(`>5% dangling edges in sample (${dangling})`);

console.log(`[graph:validate] OK — ${nodes.length.toLocaleString()} nodes, ${links.length.toLocaleString()} links, ${(size / 1048576).toFixed(1)} MB, ${dangling} dangling in 5k sample`);
