#!/usr/bin/env node
// LetBuyy Cross-Domain Intelligence (LCIS v3, Phase 3) — answers
// "what domains depend on X", "what breaks if X changes", "what consumes X"
// by walking the cross-domain edge set in domain-intel.json. Pure functions.
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// Transitive closure of consumers (who breaks if `key` changes — inbound coupling).
export function blastDomain(di, key) {
  const d = di.domains.find((x) => x.key === key);
  if (!d) return { error: `domain '${key}' not found`, available: di.domains.map((x) => x.key) };
  const consumersOf = (k) => di.domains.find((x) => x.key === k)?.consumedBy.map((c) => c.domain) || [];
  const seen = new Set([key]); let frontier = [key]; const layers = [];
  while (frontier.length) {
    const next = [];
    for (const cur of frontier) for (const c of consumersOf(cur)) if (!seen.has(c)) { seen.add(c); next.push(c); }
    if (!next.length) break; layers.push(next.length); frontier = next;
  }
  const impacted = [...seen].filter((k) => k !== key);
  const impactedDomains = impacted.map((k) => di.domains.find((x) => x.key === k));
  return {
    domain: key, label: d.label,
    directConsumers: d.consumedBy,
    blastRadius: { domains: impacted.length, layers, affected: impacted },
    owners: [...new Set(impactedDomains.flatMap((x) => x.owners).concat(d.owners))],
    services: { apps: [...new Set(impactedDomains.flatMap((x) => x.apps).concat(d.apps))],
      workers: [...new Set(impactedDomains.flatMap((x) => x.workers).concat(d.workers))] },
    routes: [...new Set(impactedDomains.flatMap((x) => x.routes).concat(d.routes))],
    rpcs: [...new Set(impactedDomains.flatMap((x) => x.rpcs).concat(d.rpcs))],
    tables: [...new Set(impactedDomains.flatMap((x) => x.tables).concat(d.tables))],
  };
}

// Who does `key` depend on (transitive — what `key` needs to function).
export function domainDependencyClosure(di, key) {
  const dependsOf = (k) => di.domains.find((x) => x.key === k)?.dependsOn.map((c) => c.domain) || [];
  const seen = new Set([key]); let frontier = [key];
  while (frontier.length) { const next = []; for (const cur of frontier) for (const c of dependsOf(cur)) if (!seen.has(c)) { seen.add(c); next.push(c); } frontier = next; }
  return [...seen].filter((k) => k !== key);
}

// The full N×N domain coupling matrix (for the UI graph + certification coverage).
export function couplingMatrix(di) {
  return di.edges.map((e) => ({ from: e.from, to: e.to, strength: e.strength, via: e.via }));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const di = JSON.parse(readFileSync(join(ROOT, 'graphify-out/domain-intel.json'), 'utf8'));
  const key = process.argv[2] || 'payments';
  console.log(JSON.stringify(blastDomain(di, key), null, 2));
}
