#!/usr/bin/env node
// LCIS Mission Control — Relationship Intelligence (Phase 8). Extracts the table relationship graph
// (foreign keys) the existing db-intel does not capture: parses REFERENCES / FOREIGN KEY across the
// migrations to build child→parent edges, per-table fan-in (referencedBy) and fan-out (references).
// Output: graphify-out/relationship-intel.json   ·   Run: pnpm graph:relationships
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const MIG = join(ROOT, 'database/supabase/migrations');
const clean = (s) => (s || '').replace(/^public\./, '').replace(/["']/g, '');

export function buildRelationshipIntel() {
  if (!existsSync(MIG)) return { error: 'migrations dir missing' };
  const files = readdirSync(MIG).filter((f) => /\.sql$/.test(f)).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0));
  const edges = new Map(); // "child>parent" -> {from, to, columns:Set}
  const addEdge = (child, parent, col) => { if (!child || !parent || child === parent) return; const k = child + '>' + parent; const e = edges.get(k) || { from: child, to: parent, columns: new Set() }; if (col) e.columns.add(col); edges.set(k, e); };

  for (const f of files) {
    const sql = readFileSync(join(MIG, f), 'utf8');
    // CREATE TABLE blocks: child = the table, parents from inline REFERENCES
    for (const m of sql.matchAll(/CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?(\w+)\s*\(([\s\S]*?)\n\);/g)) {
      const child = clean(m[1]); const body = m[2];
      for (const r of body.matchAll(/(\w+)[\s\S]{0,80}?REFERENCES\s+(?:public\.)?(\w+)/g)) addEdge(child, clean(r[2]), r[1]);
    }
    // ALTER TABLE ... ADD ... FOREIGN KEY (col) REFERENCES parent
    for (const m of sql.matchAll(/ALTER TABLE (?:ONLY )?(?:public\.)?(\w+)[\s\S]{0,160}?REFERENCES\s+(?:public\.)?(\w+)/g)) {
      const colM = m[0].match(/FOREIGN KEY\s*\((\w+)\)/);
      addEdge(clean(m[1]), clean(m[2]), colM ? colM[1] : null);
    }
  }

  const edgeArr = [...edges.values()].map((e) => ({ from: e.from, to: e.to, columns: [...e.columns] }));
  const tables = new Map();
  const ensure = (t) => tables.get(t) || tables.set(t, { name: t, references: [], referencedBy: [] }).get(t);
  for (const e of edgeArr) { ensure(e.from).references.push(e.to); ensure(e.to).referencedBy.push(e.from); }
  const tableArr = [...tables.values()].map((t) => ({ name: t.name, references: [...new Set(t.references)], referencedBy: [...new Set(t.referencedBy)], fanOut: new Set(t.references).size, fanIn: new Set(t.referencedBy).size }));

  const mostReferenced = [...tableArr].sort((a, b) => b.fanIn - a.fanIn).slice(0, 15).map((t) => ({ table: t.name, fanIn: t.fanIn }));
  const mostDependent = [...tableArr].sort((a, b) => b.fanOut - a.fanOut).slice(0, 15).map((t) => ({ table: t.name, fanOut: t.fanOut }));

  return {
    summary: { foreignKeys: edgeArr.length, tablesInGraph: tableArr.length,
      tenantRoot: mostReferenced[0] || null, mostReferenced, mostDependent,
      generatedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z') },
    edges: edgeArr, tables: tableArr,
  };
}

export function relationshipsFor(intel, table) {
  const t = intel.tables.find((x) => x.name === table);
  if (!t) return { error: `table '${table}' not in relationship graph`, note: 'table may have no foreign keys' };
  return { table, references: t.references, referencedBy: t.referencedBy, fanIn: t.fanIn, fanOut: t.fanOut };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2];
  const intel = buildRelationshipIntel();
  if (intel.error) { console.error(intel.error); process.exit(1); }
  if (cmd && cmd !== 'build') {
    const j = existsSync(join(OUT, 'relationship-intel.json')) ? JSON.parse(readFileSync(join(OUT, 'relationship-intel.json'), 'utf8')) : intel;
    console.log(JSON.stringify(relationshipsFor(j, cmd), null, 2));
  } else {
    if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, 'relationship-intel.json'), JSON.stringify(intel));
    const s = intel.summary;
    console.log('\nLCIS Relationship Intelligence (Mission Control)');
    console.log(`  foreign keys ${s.foreignKeys} · tables in graph ${s.tablesInGraph}`);
    console.log(`  tenant root (most-referenced): ${s.tenantRoot?.table} (fan-in ${s.tenantRoot?.fanIn})`);
    console.log(`  most-referenced: ${s.mostReferenced.slice(0, 6).map((t) => t.table + '(' + t.fanIn + ')').join(', ')}`);
    console.log(`  → graphify-out/relationship-intel.json\n`);
  }
}
