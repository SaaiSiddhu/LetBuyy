/**
 * SeedResolver — maps a natural-language change request to REAL graph entities
 * (domains / tables / symbols / files) deterministically: explicit seeds first,
 * then token matching against domain-intel keys/labels + db-intel table names.
 *
 * This is NOT an LLM. No embeddings, no generation. Pure token + structural matching,
 * every match evidence-cited. Corpus grounding (BM25) is done by the analyzer, not here.
 */
import { type Evidence, type LcisEngine, evidence } from '@letbuyy/lcis-core';
import type { ChangeRequest, ResolvedSeed, SeedKind } from './types';

const STOPWORDS = new Set([
  'add', 'the', 'for', 'and', 'or', 'implement', 'build', 'create', 'migrate', 'launch', 'new',
  'feature', 'support', 'enable', 'with', 'into', 'system', 'flow', 'page', 'update', 'change',
]);

interface RawDomain {
  key: string;
  label?: string;
}
interface RawDomainIntel {
  domains: RawDomain[];
}
interface RawDbTable {
  name: string;
}
interface RawDbIntel {
  tables: RawDbTable[];
}

/** Lowercase alphanumeric tokens ≥3 chars, stopwords removed, de-duplicated. */
export function tokenizeRequest(text: string): string[] {
  return [
    ...new Set(
      text
        .toLowerCase()
        .replace(/[^a-z0-9 ]+/g, ' ')
        .split(/\s+/)
        .filter((t) => t.length >= 3 && !STOPWORDS.has(t)),
    ),
  ];
}

function seedFor(kind: SeedKind, ref: string, reason: string, score: number, ev: Evidence): ResolvedSeed {
  return { kind, ref, reason, score, evidence: [ev] };
}

export class SeedResolver {
  constructor(private readonly engine: LcisEngine) {}

  /** Resolve a request to ranked, de-duplicated, evidence-cited seeds. Empty = honestly unresolved. */
  resolve(request: ChangeRequest): ResolvedSeed[] {
    const seeds: ResolvedSeed[] = [];
    const seen = new Set<string>();
    const add = (s: ResolvedSeed): void => {
      const k = `${s.kind}:${s.ref}`;
      if (!seen.has(k)) {
        seen.add(k);
        seeds.push(s);
      }
    };

    // 1. Explicit seeds — maximal precision, score 1.
    for (const d of request.domains ?? [])
      add(seedFor('domain', d, 'explicit domain seed', 1, evidence('artifact-field', `domain:${d}`, 'caller-provided', 'graphify-out/domain-intel.json')));
    for (const s of request.symbols ?? [])
      add(seedFor('symbol', s, 'explicit symbol seed', 1, evidence('graph-node', s, 'caller-provided', 'graphify-out/graph.json')));
    for (const t of request.tables ?? [])
      add(seedFor('table', t, 'explicit table seed', 1, evidence('table', t, 'caller-provided', 'graphify-out/db-intel.json')));
    for (const f of request.files ?? [])
      add(seedFor('file', f, 'explicit file seed', 1, evidence('file', f, 'caller-provided')));

    // 2. NL token matching against domain keys/labels + table names (deterministic).
    const tokens = tokenizeRequest(request.text);
    const di = this.engine.store.tryRead<RawDomainIntel>('domain-intel');
    const db = this.engine.store.tryRead<RawDbIntel>('db-intel');
    for (const tok of tokens) {
      if (di) {
        for (const d of di.domains) {
          const key = d.key.toLowerCase();
          const label = (d.label ?? '').toLowerCase();
          if (key.includes(tok) || label.includes(tok)) {
            add(
              seedFor(
                'domain',
                d.key,
                `token "${tok}" ~ domain "${d.key}"`,
                key === tok ? 0.9 : 0.6,
                evidence('artifact-field', `domain:${d.key}`, `matched token "${tok}"`, 'graphify-out/domain-intel.json'),
              ),
            );
          }
        }
      }
      if (db) {
        for (const t of db.tables) {
          if (t.name.toLowerCase().includes(tok)) {
            add(
              seedFor(
                'table',
                t.name,
                `token "${tok}" ~ table "${t.name}"`,
                t.name.toLowerCase() === tok ? 0.85 : 0.7,
                evidence('table', t.name, `matched token "${tok}"`, 'graphify-out/db-intel.json'),
              ),
            );
          }
        }
      }
    }

    return seeds.sort((a, b) => b.score - a.score);
  }
}
