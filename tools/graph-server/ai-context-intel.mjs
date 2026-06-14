#!/usr/bin/env node
// LCIS Genesis — AI Context Engine (Phase 8). Consolidates the self-contained context packs for
// Claude / Gemini / Codex / Cursor / OpenAI. < 20k tokens, generated from LCIS (Explain + execution +
// connections), no repository scan required. Reuses the Explain model; no duplicate intelligence.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildExplainIntel } from './explain-intel.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const g = (f) => existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : null;
export const TARGETS = ['Claude', 'Gemini', 'Codex', 'Cursor', 'OpenAI'];

export function buildPack(target) {
  const ex = buildExplainIntel(); if (ex.error) return ex;
  const exec = g('execution-intel.json'), conn = g('connections-intel.json'), di = g('domain-intel.json');
  const gs = ex.gettingStarted;
  const domains = Object.values(ex.nodes).map((n) => `- ${n.label} [${n.criticality.split('—')[0].trim()}]: ${n.purpose} (owner ${n.owner.join(',')}; depends ${n.dependsOn.join('/') || 'none'}; breaks→ ${n.consumers.join('/') || 'none'})`).join('\n');
  const body = [
    `# LetBuyy — self-contained LCIS context pack for ${target}`,
    `${gs.steps[0].d} ${gs.steps[1].d}`,
    `Commerce: ${ex.flows.orders.join(' → ')}`,
    `Payments: ${ex.flows.payments.join(' → ')}`,
    `Refunds: ${ex.flows.refunds.join(' → ')}`,
    `Security: ${gs.steps[6].d}`,
    `Infrastructure: ${gs.steps[7].d}`,
    `Launch: ${exec?.summary.launchVerdict} — blockers: ${(exec?.questions.whatRemainsBeforeLaunch || []).join('; ')}`,
    `Live data: ${conn?.summary.notConnected ?? '?'} sources NOT CONNECTED (adapters ready; real source or NOT CONNECTED — never fabricated).`,
    `## Domains (${di?.summary.domains})`, domains,
    `## Query LCIS instead of scanning the repo`,
    `/api/search-v2?q=<question> · /api/explain?node=<key> · /api/database-control (lineage) · /api/change-impact?key= · /api/atlas-v2?node= · /api/launch-command-center · /api/connections`,
  ].join('\n');
  const approxTokens = Math.round(body.length / 4);
  return { target, approxTokens, withinBudget: approxTokens < 20000, selfContained: true, repoScan: 'not required', pack: body };
}
export function allPacks() { return { targets: TARGETS, packs: TARGETS.map((t) => { const p = buildPack(t); return { target: t, approxTokens: p.approxTokens, withinBudget: p.withinBudget }; }) }; }

if (import.meta.url === `file://${process.argv[1]}`) {
  const t = process.argv[2];
  if (t) console.log(buildPack(t).pack);
  else { const a = allPacks(); console.log('\nLCIS Genesis — AI Context Engine'); for (const p of a.packs) console.log(`  ${p.target.padEnd(8)} ~${p.approxTokens} tokens · <20k: ${p.withinBudget}`); }
}
