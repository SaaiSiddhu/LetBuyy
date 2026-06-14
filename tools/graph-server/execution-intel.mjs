#!/usr/bin/env node
// LetBuyy Execution Intelligence (LCIS v4, Phase 7) — what remains before launch.
// Parses the blocker/gap/certification docs + code TODO markers into open work items.
// Answers: what remains before launch · what risks remain · what audits are unresolved.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const read = (rel) => existsSync(join(ROOT, rel)) ? readFileSync(join(ROOT, rel), 'utf8') : null;

// Parse the V1 blocker report table rows: | **LB-n** | title | sev | status | ...
function parseBlockers() {
  const txt = read('V1_SCOPE_LOCK_2026_06_12/LETBUYY_V1_BLOCKER_REPORT.md');
  if (!txt) return [];
  const out = [];
  for (const m of txt.matchAll(/\|\s*\*\*(LB-\d+)\*\*\s*\|\s*([^|]+?)\s*\|\s*([^|]*?)\s*\|\s*\*\*([^|]+?)\*\*\s*\|/g)) {
    out.push({ id: m[1], title: m[2].trim(), severity: m[3].replace(/[^\w🔴🟠🟡🟢]/g, '').trim() || m[3].trim(), status: m[4].trim() });
  }
  return out;
}

// Verdict scan across certification docs.
function certVerdicts() {
  const docs = ['docs/final-v1-certification/FINAL_V1_CERTIFICATION.md', 'docs/implementation/FINAL_V1_CERTIFICATION.md',
    'docs/implementation/FINAL_V1_LAUNCH_READINESS_REPORT.md', 'V1_SCOPE_LOCK_2026_06_12/LETBUYY_V1_BLOCKER_REPORT.md',
    'docs/central-intelligence/LCIS_V3_CERTIFICATION.md'];
  const out = [];
  for (const rel of docs) {
    const txt = read(rel); if (!txt) continue;
    const v = (txt.match(/\b(NO-GO|GO\b|NOT PRODUCTION READY|PRODUCTION READY|CERTIFIED|BLOCKED|NO GO)\b/i) || [])[0] || 'see doc';
    out.push({ doc: rel, verdict: v });
  }
  return out;
}

// Open gap / risk docs (by presence + headline).
function openDocs() {
  const list = ['docs/implementation/DEPLOYMENT_GAP_REPORT.md', 'docs/final-v1-certification/TOP_50_BLOCKERS.md',
    'docs/governance/skipped-human-decisions.md', 'V1_SCOPE_LOCK_2026_06_12/LETBUYY_V1_SCOPE_LOCK.md'];
  return list.filter((rel) => existsSync(join(ROOT, rel))).map((rel) => {
    const txt = read(rel) || '';
    const title = (txt.match(/^#\s+(.+)$/m) || [, rel])[1];
    const open = (txt.match(/\b(\d+)\s+(blockers?|gaps?|open|risks?|skipped)\b/i) || [])[0] || null;
    return { doc: rel, title: title.slice(0, 80), signal: open };
  });
}

// Code TODO/FIXME markers (bounded recursive scan of source).
function codeTodos() {
  const hits = [];
  const walk = (dir, depth = 0) => {
    if (depth > 6 || hits.length > 200) return;
    let ents; try { ents = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (e.name === 'node_modules' || e.name === '.git' || e.name.startsWith('.next')) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p, depth + 1);
      else if (/\.(ts|tsx|mjs)$/.test(e.name)) {
        let src; try { src = readFileSync(p, 'utf8'); } catch { continue; }
        for (const m of src.matchAll(/\/\/\s*(TODO|FIXME|HACK|XXX)\b[:\s]*(.{0,80})/g)) hits.push({ file: p.replace(ROOT + '/', ''), kind: m[1], note: m[2].trim() });
      }
    }
  };
  for (const d of ['services', 'apps', 'packages']) walk(join(ROOT, d));
  return hits;
}

export function buildExecutionIntel() {
  const blockers = parseBlockers();
  const verdicts = certVerdicts();
  const docs = openDocs();
  const todos = codeTodos();
  const openBlockers = blockers.filter((b) => !/done|resolved|complete|hidden|fixed/i.test(b.status));
  return {
    summary: {
      openBlockers: openBlockers.length, totalBlockers: blockers.length,
      codeTodos: todos.length, openGapDocs: docs.length,
      launchVerdict: verdicts.find((v) => /BLOCKER_REPORT/.test(v.doc))?.verdict || verdicts[0]?.verdict || 'see docs',
      generatedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    },
    blockers, verdicts, openDocs: docs, todos: todos.slice(0, 50),
    questions: {
      whatRemainsBeforeLaunch: openBlockers.map((b) => `${b.id} (${b.severity}): ${b.title}`),
      whatRisksRemain: docs.map((d) => d.title),
      whatAuditsAreUnresolved: verdicts.filter((v) => /NO-?GO|NOT PRODUCTION|BLOCKED/i.test(v.verdict)).map((v) => v.doc),
    },
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const intel = buildExecutionIntel();
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'execution-intel.json'), JSON.stringify(intel));
  const s = intel.summary;
  console.log('\nLetBuyy Execution Intelligence (LCIS v4)');
  console.log(`  open blockers ${s.openBlockers}/${s.totalBlockers} · code TODOs ${s.codeTodos} · open gap docs ${s.openGapDocs}`);
  console.log(`  launch verdict: ${s.launchVerdict}`);
  console.log(`  remaining: ${intel.questions.whatRemainsBeforeLaunch.slice(0, 6).join(' · ') || '—'}`);
  console.log(`  → graphify-out/execution-intel.json\n`);
}
