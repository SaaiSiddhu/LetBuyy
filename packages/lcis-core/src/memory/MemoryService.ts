/**
 * MemoryService — deterministic BM25 retrieval over the LCIS governance/decision corpus.
 *
 * The BM25 index is built in-process on first query from:
 *  • Markdown corpus files (governance, architecture, security, runbooks, launch)
 *  • Decisions + migrations from graphify-out/memory-intel.json
 *
 * No external dependencies. No Qdrant, no embeddings, no OpenAI.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { findRepoRoot } from '../runtime/paths';
import { buildBM25Index, scoreQuery, tokenize, type BM25Index } from './bm25';
import { loadCorpus } from './corpus';
import type {
  Citation,
  ContextPack,
  Decision,
  IndexedDocument,
  MemoryHit,
  RawDecision,
  RawMemoryIntel,
} from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Approximate token count: ~4 chars per token */
function approxTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

/**
 * Map the IndexedDocument type to the MemoryHit type union.
 * Decisions and migrations keep their own type strings;
 * governance_detail and governance_detail both map to 'governance'.
 */
function hitType(doc: IndexedDocument): MemoryHit['type'] {
  switch (doc.type) {
    case 'decision': return 'decision';
    case 'migration': return 'migration';
    case 'runbook': return 'runbook';
    case 'architecture': return 'architecture';
    default: return 'governance';
  }
}

function toMemoryHit(doc: IndexedDocument, score: number): MemoryHit {
  return {
    id: doc.id,
    score,
    type: hitType(doc),
    ...(doc.subtype ? { subtype: doc.subtype } : {}),
    source: doc.source,
    section: doc.section,
    text: doc.text,
    ...(doc.rule ? { rule: doc.rule } : {}),
  };
}

function confidenceLabel(score: number): Citation['confidence'] {
  if (score > 8) return 'high';
  if (score >= 4) return 'medium';
  return 'low';
}

// ── Service ───────────────────────────────────────────────────────────────────

export class MemoryService {
  private index: BM25Index | null = null;
  private docMap: Map<string, IndexedDocument> | null = null;
  private decisionsMap: Map<string, Decision> | null = null;
  private latestMigrationN = 0;
  private builtAtMigration = 0;
  private schemaHash = '';

  constructor(private readonly repoRoot: string = findRepoRoot()) {}

  // ── Lazy init ──────────────────────────────────────────────────────────────

  private ensureIndex(): void {
    if (this.index !== null) return;

    const memoryIntelPath = join(this.repoRoot, 'graphify-out', 'memory-intel.json');
    const memoryIntelJson = existsSync(memoryIntelPath)
      ? readFileSync(memoryIntelPath, 'utf8')
      : JSON.stringify({ decisions: [], migrations: [] });

    const { documents, latestMigrationN, memoryIntelHash } = loadCorpus(
      this.repoRoot,
      memoryIntelJson,
    );

    this.latestMigrationN = latestMigrationN;
    this.builtAtMigration = latestMigrationN; // built right now, so in sync
    this.schemaHash = memoryIntelHash;

    // Build doc map
    const docMap = new Map<string, IndexedDocument>();
    for (const doc of documents) {
      docMap.set(doc.id, doc);
    }
    this.docMap = docMap;

    // Build decisions map
    const intel = JSON.parse(memoryIntelJson) as RawMemoryIntel;
    const decisionsMap = new Map<string, Decision>();
    for (const d of intel.decisions) {
      const dec: Decision = {
        id: d.id,
        type: d.type,
        ...(d.subtype ? { subtype: d.subtype } : {}),
        source: d.source,
        section: d.section,
        rule: d.rule,
      };
      decisionsMap.set(d.id, dec);
    }
    // Also index migrations as pseudo-decisions accessible by "migration-N"
    for (const m of intel.migrations) {
      const id = `migration-${m.n}`;
      const dec: Decision = {
        id,
        type: m.type,
        source: `migrations/${m.file}`,
        section: `Migration ${m.n}`,
        rule: m.decision,
        lastConfirmedMigration: m.n,
      };
      decisionsMap.set(id, dec);
      // Also index by number string for convenience
      decisionsMap.set(String(m.n), dec);
    }
    this.decisionsMap = decisionsMap;

    // Build BM25 index
    this.index = buildBM25Index(documents);
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * BM25-ranked search over the full deterministic corpus.
   * @param query  Natural language or keyword query
   * @param opts   Optional: limit (default 10), type filter
   */
  search(query: string, opts?: { limit?: number; type?: string }): MemoryHit[] {
    this.ensureIndex();
    const limit = opts?.limit ?? 10;
    const typeFilter = opts?.type;

    const scored = scoreQuery(query, this.index!);
    const hits: MemoryHit[] = [];

    for (const { docId, score } of scored) {
      if (hits.length >= limit) break;
      const doc = this.docMap!.get(docId);
      if (!doc) continue;
      // Apply type filter if provided
      if (typeFilter) {
        const t = hitType(doc);
        if (t !== typeFilter && doc.type !== typeFilter) continue;
      }
      hits.push(toMemoryHit(doc, score));
    }
    return hits;
  }

  /**
   * Retrieve a single document/decision by id.
   * Accepts "D-001" (decision), "migration-174" (migration), or "DOC-<hash>" (prose chunk).
   */
  get(id: string): MemoryHit | Decision | undefined {
    this.ensureIndex();
    // Try decisions first (D-xxx, migration-N)
    const dec = this.decisionsMap!.get(id);
    if (dec) return dec;
    // Try doc map
    const doc = this.docMap!.get(id);
    if (doc) return toMemoryHit(doc, 0);
    return undefined;
  }

  /**
   * Return structured citations for an agent/LLM grounding call.
   * Confidence: high = score > 8, medium = 4–8, low < 4.
   */
  cite(query: string, limit = 5): Citation[] {
    const hits = this.search(query, { limit });
    return hits.map((h): Citation => ({
      id: h.id,
      source: h.source,
      section: h.section,
      text: h.text,
      confidence: confidenceLabel(h.score),
    }));
  }

  /**
   * Build a token-budget-aware context pack for an agent.
   * Selects top BM25 hits, trims to budget, marks freshness.
   */
  buildContext(query: string, tokenBudget = 4000): ContextPack {
    this.ensureIndex();
    const allHits = this.search(query, { limit: 20 });
    const selectedHits: MemoryHit[] = [];
    let tokensUsed = 0;

    for (const hit of allHits) {
      const approx = approxTokens(hit.text) + approxTokens(hit.section) + 10;
      if (tokensUsed + approx > tokenBudget) break;
      selectedHits.push(hit);
      tokensUsed += approx;
    }

    const citations: Citation[] = selectedHits.map((h): Citation => ({
      id: h.id,
      source: h.source,
      section: h.section,
      text: h.text,
      confidence: confidenceLabel(h.score),
    }));

    // Stale if the index was built at a lower migration than the current latest
    const stale = this.builtAtMigration < this.latestMigrationN;

    return {
      query,
      tokenBudget,
      tokensUsed,
      hits: selectedHits,
      citations,
      stale,
      builtAtMigration: this.builtAtMigration,
      schemaHash: this.schemaHash,
    };
  }

  /** All decisions (full list, optionally filtered by type). */
  decisions(filter?: { type?: string }): Decision[] {
    this.ensureIndex();
    const all = [...this.decisionsMap!.values()];
    // Only return "D-xxx" decisions (not migration-N pseudo-entries)
    const realDecisions = all.filter((d) => d.id.startsWith('D-'));
    if (!filter?.type) return realDecisions;
    return realDecisions.filter((d) => d.type === filter.type);
  }

  /** Single decision by stable id (e.g. "D-016", "migration-174"). */
  decision(id: string): Decision | undefined {
    this.ensureIndex();
    return this.decisionsMap!.get(id);
  }

  /** Expose the corpus token count for diagnostics. */
  diagnostics(): { docCount: number; termCount: number; latestMigrationN: number; schemaHash: string } {
    this.ensureIndex();
    return {
      docCount: this.docMap!.size,
      termCount: this.index!.invertedIndex.size,
      latestMigrationN: this.latestMigrationN,
      schemaHash: this.schemaHash,
    };
  }

  // ── Staleness test helper ─────────────────────────────────────────────────

  /** Override the builtAtMigration value to simulate a stale index in tests. */
  _simulateStale(builtAtMigration: number): void {
    this.ensureIndex();
    this.builtAtMigration = builtAtMigration;
  }
}
