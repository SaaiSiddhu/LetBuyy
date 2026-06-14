#!/usr/bin/env node
// LCIS Omega shared library — loads the existing intel artifacts and exposes helpers that
// resolve ONLY tables/RPCs that actually exist in the schema (so no engine can reference a
// fabricated table). Pure; no side effects on import.
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const OUT = join(ROOT, 'graphify-out');
export const DOCS = join(ROOT, 'docs', 'central-intelligence');

export const g = (f) => existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : null;
export function loadIntel() {
  return { db: g('db-intel.json'), di: g('domain-intel.json'), infra: g('infra-intel.json'),
    mem: g('memory-intel.json'), rt: g('runtime-intel.json'), exec: g('execution-intel.json') };
}
// Resolve only tables/RPCs that exist (guards against referencing a non-existent object).
export function tablesMatching(db, re) { return db ? db.tables.filter((t) => re.test(t.name)).map((t) => t.name) : []; }
export function rpcsMatching(db, re) { return db ? db.functions.filter((f) => re.test(f.name)).map((f) => f.name) : []; }
export function tableExists(db, name) { return !!db && db.tables.some((t) => t.name === name); }
export function pickTables(db, names) { return names.filter((n) => tableExists(db, n)); }

export function writeOut(name, obj) { if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true }); writeFileSync(join(OUT, name), JSON.stringify(obj)); }
export function writeDoc(name, body) { if (!existsSync(DOCS)) mkdirSync(DOCS, { recursive: true }); writeFileSync(join(DOCS, name), body); }
export const nowStamp = (db) => (db?.summary.generatedAt) || 'generated';
export const LIVE = 'live-query-required';
