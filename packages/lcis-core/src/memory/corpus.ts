/**
 * Corpus ingestion — reads governance/architecture/decision files and chunks them
 * into IndexedDocument records for the BM25 index.
 *
 * Sources (per spec §2.4):
 *  governance          — GOVERNANCE_REWRITE_2026_06_10/*.md + AGENTS.md + CLAUDE.md
 *  architecture        — docs/architecture/**‌/*.md (depth ≤ 2, max 30)
 *  governance_detail   — docs/governance/**‌/*.md (depth ≤ 2, max 24)
 *  security            — docs/security/**‌/*.md (depth ≤ 2, max 16)
 *  runbook             — docs/central-intelligence/incident-response.md + *runbook*.md in docs/
 *  launch              — docs/launch-readiness/**‌/*.md + docs/final-v1-certification/**‌/*.md (max 12)
 *  decision / migration— from graphify-out/memory-intel.json (decisions + migrations)
 */
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { tokenize } from './bm25';
import type { IndexedDocument, RawDecision, RawMemoryIntel, RawMigration } from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

function sha256Prefix(s: string, len = 12): string {
  return createHash('sha256').update(s).digest('hex').slice(0, len);
}

function docId(source: string, section: string): string {
  return `DOC-${sha256Prefix(`${source}:${section}`)}`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, max) : s;
}

/** Glob markdown files under `dir` (recursive depth ≤ `maxDepth`), capped at `max`. */
function globMd(dir: string, maxDepth = 2, max = 30): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  function walk(d: string, depth: number): void {
    if (depth > maxDepth || results.length >= max) return;
    for (const entry of readdirSync(d)) {
      if (results.length >= max) break;
      const full = join(d, entry);
      const stat = statSync(full);
      if (stat.isDirectory()) {
        walk(full, depth + 1);
      } else if (entry.endsWith('.md')) {
        results.push(full);
      }
    }
  }
  walk(dir, 0);
  return results;
}

// ── Heading-based chunker ─────────────────────────────────────────────────────

interface Chunk {
  section: string;
  text: string;
}

const MAX_CHUNK = 1600;
const HEADING_RE = /^#{1,3}\s+(.+)$/m;

/** Split markdown text into section chunks by heading. */
function chunkByHeading(raw: string): Chunk[] {
  const lines = raw.split('\n');
  const chunks: Chunk[] = [];
  let currentSection = '(top)';
  let buffer: string[] = [];

  function flush(): void {
    const text = buffer.join('\n').trim();
    if (text.length < 10) return; // skip empty/tiny sections
    // If text exceeds MAX_CHUNK, emit multiple chunks
    let pos = 0;
    while (pos < text.length) {
      chunks.push({
        section: truncate(currentSection, 90),
        text: text.slice(pos, pos + MAX_CHUNK),
      });
      pos += MAX_CHUNK;
    }
  }

  for (const line of lines) {
    const m = line.match(HEADING_RE);
    if (m) {
      flush();
      buffer = [];
      currentSection = (m[1] ?? '').trim();
    } else {
      buffer.push(line);
    }
  }
  flush();
  return chunks;
}

// ── Document builders ─────────────────────────────────────────────────────────

type DocType = IndexedDocument['type'];

function buildDocsFromFile(
  absPath: string,
  repoRoot: string,
  type: DocType,
  subtype?: string,
): IndexedDocument[] {
  if (!existsSync(absPath)) return [];
  let raw: string;
  try {
    raw = readFileSync(absPath, 'utf8');
  } catch {
    return [];
  }
  const source = relative(repoRoot, absPath);
  const chunks = chunkByHeading(raw);
  const docs: IndexedDocument[] = [];
  for (const chunk of chunks) {
    const id = docId(source, chunk.section);
    const tokens = tokenize(chunk.text + ' ' + chunk.section);
    const doc: IndexedDocument = {
      id,
      source,
      section: chunk.section,
      text: truncate(chunk.text, 320),
      tokens,
      type,
      ...(subtype ? { subtype } : {}),
    };
    docs.push(doc);
  }
  return docs;
}

/** Build IndexedDocument records from memory-intel.json decisions. */
function buildDecisionDocs(decisions: readonly RawDecision[]): IndexedDocument[] {
  return decisions.map((d): IndexedDocument => {
    // Map decision type to a doc type
    const type: DocType = d.type === 'migration' ? 'migration' : 'decision';
    // Determine subtype from decision type for non-migration docs
    const subtype = (d.type !== 'governance' && d.type !== 'architecture' && d.type !== 'migration')
      ? d.type
      : undefined;
    const tokenText = `${d.rule} ${d.section} ${d.source}`;
    return {
      id: d.id,
      source: d.source,
      section: truncate(d.section, 90),
      text: truncate(d.rule, 320),
      tokens: tokenize(tokenText),
      type,
      ...(subtype ? { subtype } : {}),
      rule: d.rule,
    };
  });
}

/** Build IndexedDocument records from memory-intel.json migrations. */
function buildMigrationDocs(migrations: readonly RawMigration[]): IndexedDocument[] {
  return migrations.map((m): IndexedDocument => {
    const text = `migration ${m.n}: ${m.name} (${m.file}) type: ${m.type}`;
    const subtype = m.type !== 'migration' ? m.type : undefined;
    return {
      id: `migration-${m.n}`,
      source: `migrations/${m.file}`,
      section: `Migration ${m.n}`,
      text: truncate(text, 320),
      tokens: tokenize(text),
      type: 'migration',
      ...(subtype ? { subtype } : {}),
    };
  });
}

// ── Public interface ──────────────────────────────────────────────────────────

export interface CorpusResult {
  readonly documents: IndexedDocument[];
  readonly latestMigrationN: number;
  readonly memoryIntelHash: string;
}

/**
 * Load the full corpus from the repo root.
 * `memoryIntelJson` is the raw content of memory-intel.json (passed in so
 * MemoryService can also compute the schema hash from the same data).
 */
export function loadCorpus(repoRoot: string, memoryIntelJson: string): CorpusResult {
  const docs: IndexedDocument[] = [];

  // ── 1. GOVERNANCE root files ─────────────────────────────────────────────
  const govDir = join(repoRoot, 'GOVERNANCE_REWRITE_2026_06_10');
  const govFiles = [
    'LETBUYY_CONSTITUTION.md',
    'LETBUYY_AGENTS_V2.md',
    'LETBUYY_CANONICAL_SYSTEMS.md',
    'LETBUYY_FINAL_ARCHITECTURE_SCORECARD.md',
    'LETBUYY_FOUNDATION_ROADMAP.md',
    '000_GOVERNANCE_INDEX.md',
  ];
  for (const f of govFiles) {
    docs.push(...buildDocsFromFile(join(govDir, f), repoRoot, 'governance'));
  }
  docs.push(...buildDocsFromFile(join(repoRoot, 'AGENTS.md'), repoRoot, 'governance'));
  docs.push(...buildDocsFromFile(join(repoRoot, 'CLAUDE.md'), repoRoot, 'governance'));

  // ── 2. ARCHITECTURE docs ─────────────────────────────────────────────────
  for (const f of globMd(join(repoRoot, 'docs', 'architecture'), 2, 30)) {
    docs.push(...buildDocsFromFile(f, repoRoot, 'architecture'));
  }

  // ── 3. GOVERNANCE DETAIL docs ────────────────────────────────────────────
  for (const f of globMd(join(repoRoot, 'docs', 'governance'), 2, 24)) {
    docs.push(...buildDocsFromFile(f, repoRoot, 'governance_detail'));
  }

  // ── 4. SECURITY docs ─────────────────────────────────────────────────────
  for (const f of globMd(join(repoRoot, 'docs', 'security'), 2, 16)) {
    docs.push(...buildDocsFromFile(f, repoRoot, 'security', 'security'));
  }

  // ── 5. RUNBOOKS ──────────────────────────────────────────────────────────
  const incidentDoc = join(repoRoot, 'docs', 'central-intelligence', 'incident-response.md');
  docs.push(...buildDocsFromFile(incidentDoc, repoRoot, 'runbook'));
  // Any *runbook*.md in docs/
  const docsDir = join(repoRoot, 'docs');
  if (existsSync(docsDir)) {
    for (const entry of readdirSync(docsDir)) {
      if (entry.toLowerCase().includes('runbook') && entry.endsWith('.md')) {
        docs.push(...buildDocsFromFile(join(docsDir, entry), repoRoot, 'runbook'));
      }
    }
  }

  // ── 6. LAUNCH docs ───────────────────────────────────────────────────────
  let launchCount = 0;
  for (const f of globMd(join(repoRoot, 'docs', 'launch-readiness'), 2, 12)) {
    if (launchCount >= 12) break;
    docs.push(...buildDocsFromFile(f, repoRoot, 'launch'));
    launchCount++;
  }
  for (const f of globMd(join(repoRoot, 'docs', 'final-v1-certification'), 2, 12 - launchCount)) {
    docs.push(...buildDocsFromFile(f, repoRoot, 'launch'));
  }

  // ── 7. DECISIONS + MIGRATIONS from memory-intel.json ────────────────────
  const intel: RawMemoryIntel = JSON.parse(memoryIntelJson) as RawMemoryIntel;
  docs.push(...buildDecisionDocs(intel.decisions));
  docs.push(...buildMigrationDocs(intel.migrations));

  // Compute outputs
  const latestMigrationN = intel.migrations.reduce((max, m) => Math.max(max, m.n), 0);
  const memoryIntelHash = sha256Prefix(memoryIntelJson, 12);

  return { documents: docs, latestMigrationN, memoryIntelHash };
}
