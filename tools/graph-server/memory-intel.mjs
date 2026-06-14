#!/usr/bin/env node
// LetBuyy Memory / Decision Intelligence (LCIS v4, Phase 1) — builds the decision graph
// by parsing the governance + architecture + security docs and the migration ledger.
// Answers: why was this built · why does this rule exist · why was this migration added ·
// what previous decisions affect this change. Output: graphify-out/memory-intel.json
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const MIG = join(ROOT, 'database/supabase/migrations');

// Curated decision sources (existence-checked). type = decision category.
const SOURCES = [
  ['governance', 'GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md'],
  ['governance', 'GOVERNANCE_REWRITE_2026_06_10/LETBUYY_AGENTS_V2.md'],
  ['architecture', 'GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md'],
  ['architecture', 'GOVERNANCE_REWRITE_2026_06_10/LETBUYY_FINAL_ARCHITECTURE_SCORECARD.md'],
  ['governance', 'AGENTS.md'],
  ['architecture', 'CLAUDE.md'],
  ['governance', 'docs/governance/skipped-human-decisions.md'],
];
const SOURCE_DIRS = [
  ['architecture', 'docs/architecture'],
  ['governance', 'docs/governance'],
  ['security', 'docs/security'],
];

// keyword → decision sub-type (so a rule about refunds is tagged 'refund', etc.)
const SUBTYPE = [
  [/refund|return/i, 'refund'], [/payout|settlement|commission/i, 'payout'],
  [/payment|razorpay|cod|ledger|money|gift.?card/i, 'payment'], [/migration|db push|sql/i, 'migration'],
  [/rls|tenant|site_id|isolation/i, 'security'], [/auth|session|jwt|oauth|identity|step.?up/i, 'security'],
  [/theme|liquid|sanitiz/i, 'theme'], [/storefront|checkout|cart/i, 'storefront'],
];
function subtype(text, fallback) { for (const [re, t] of SUBTYPE) if (re.test(text)) return t; return fallback; }

// A "decision/rule" line = an imperative governance statement.
const RULE_RE = /\b(MUST|MUST NOT|NEVER|ALWAYS|SHALL|REQUIRED|FORBIDDEN|forbid|enforced|do not|cannot|may only|only via|supreme law)\b/;

function parseDoc(type, rel) {
  const path = join(ROOT, rel);
  if (!existsSync(path)) return [];
  const lines = readFileSync(path, 'utf8').split('\n');
  const out = [];
  let section = '';
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i].trim();
    if (/^#{1,4}\s+/.test(l)) { section = l.replace(/^#+\s+/, '').slice(0, 90); continue; }
    if (l.length < 16 || l.length > 320) continue;
    if (RULE_RE.test(l)) {
      const rule = l.replace(/^[-*>\s]+/, '').replace(/\*\*/g, '').slice(0, 240);
      // "why" = the section it lives under (the rationale anchor)
      out.push({ type: subtype(section + ' ' + l, type), source: rel, section, rule });
    }
  }
  return out;
}

function listMd(dir) {
  const full = join(ROOT, dir); if (!existsSync(full)) return [];
  const acc = [];
  for (const e of readdirSync(full, { withFileTypes: true })) {
    if (e.isFile() && /\.md$/.test(e.name)) acc.push(join(dir, e.name));
  }
  return acc.slice(0, 24); // bound
}

export function buildMemoryIntel() {
  const decisions = [];
  const seen = new Set();
  const push = (type, rel) => { for (const d of parseDoc(type, rel)) { const k = d.rule.toLowerCase().slice(0, 80); if (seen.has(k)) continue; seen.add(k); decisions.push(d); } };
  const sources = [];
  for (const [type, rel] of SOURCES) if (existsSync(join(ROOT, rel))) { sources.push(rel); push(type, rel); }
  for (const [type, dir] of SOURCE_DIRS) for (const rel of listMd(dir)) { sources.push(rel); push(type, rel); }

  // migration decisions — each migration filename encodes its decision
  const migrations = existsSync(MIG)
    ? readdirSync(MIG).filter((f) => /^\d+.*\.sql$/.test(f)).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0))
      .map((f) => { const n = parseInt(f); const name = f.replace(/^\d+_/, '').replace(/\.sql$/, '').replace(/_/g, ' '); return { n, file: f, name, type: subtype(name, 'migration'), decision: `migration ${n}: ${name}` }; })
    : [];

  const byType = {};
  for (const d of decisions) byType[d.type] = (byType[d.type] || 0) + 1;
  // assign stable ids
  decisions.forEach((d, i) => { d.id = `D-${String(i + 1).padStart(3, '0')}`; });

  const summary = {
    sources: sources.length, decisions: decisions.length, byType,
    migrationDecisions: migrations.length, latestMigration: migrations[migrations.length - 1] || null,
    generatedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  };
  return { summary, decisions, migrations, sources: [...new Set(sources)] };
}

// ---- query functions (Phase 1) ----
function searchDecisions(mi, q, n = 25) {
  const ql = (q || '').toLowerCase();
  if (!ql) return mi.decisions.slice(0, n);
  return mi.decisions.filter((d) => (d.rule + ' ' + d.section + ' ' + d.source).toLowerCase().includes(ql)).slice(0, n);
}
export function whyBuilt(mi, q) { return { query: q, decisions: searchDecisions(mi, q) }; }
export function ruleWhy(mi, q) { return { query: q, rules: searchDecisions(mi, q).map((d) => ({ id: d.id, type: d.type, rule: d.rule, source: d.source, section: d.section })) }; }
export function migrationWhy(mi, n) { const m = mi.migrations.find((x) => x.n === Number(n)); return m || { error: `migration ${n} not found` }; }
export function decisionsAffecting(mi, domainOrKeyword) {
  return { topic: domainOrKeyword, decisions: searchDecisions(mi, domainOrKeyword), migrations: mi.migrations.filter((m) => m.name.toLowerCase().includes((domainOrKeyword || '').toLowerCase())) };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const cmd = process.argv[2], arg = process.argv.slice(3).join(' ');
  if (cmd && cmd !== 'build') {
    const mi = JSON.parse(readFileSync(join(OUT, 'memory-intel.json'), 'utf8'));
    const p = (o) => console.log(JSON.stringify(o, null, 2));
    if (cmd === 'why') p(whyBuilt(mi, arg));
    else if (cmd === 'rule') p(ruleWhy(mi, arg));
    else if (cmd === 'migration') p(migrationWhy(mi, arg));
    else if (cmd === 'affecting') p(decisionsAffecting(mi, arg));
    else p(searchDecisions(mi, arg));
  } else {
    const intel = buildMemoryIntel();
    if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
    writeFileSync(join(OUT, 'memory-intel.json'), JSON.stringify(intel));
    const s = intel.summary;
    console.log('\nLetBuyy Memory / Decision Intelligence (LCIS v4)');
    console.log(`  decisions ${s.decisions} from ${s.sources} sources · migration decisions ${s.migrationDecisions}`);
    console.log(`  by type: ${Object.entries(s.byType).map(([k, v]) => k + ' ' + v).join(' · ')}`);
    console.log(`  latest migration: ${s.latestMigration?.decision || '—'}`);
    console.log(`  → graphify-out/memory-intel.json\n`);
  }
}
