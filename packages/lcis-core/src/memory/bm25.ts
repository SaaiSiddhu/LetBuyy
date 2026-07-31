/**
 * BM25 index + scorer — zero external dependencies.
 * k1 = 1.5, b = 0.75 (TREC-standard defaults per spec §2.2).
 * Tokenizer: lowercase → strip markdown → split on punctuation/whitespace
 *            → filter short tokens + stop words → no stemming.
 */
import type { IndexedDocument, PostingEntry } from './types';

// ── Constants ────────────────────────────────────────────────────────────────

const K1 = 1.5;
const B = 0.75;

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'on',
  'at', 'for', 'with', 'by', 'from', 'or', 'and', 'not', 'this', 'that',
  'it', 'its', 'if', 'via', 'per', 'also', 'only', 'never', 'always',
]);

// ── Tokenizer ────────────────────────────────────────────────────────────────

/** Strip markdown formatting characters, then split+filter. */
export function tokenize(text: string): string[] {
  const stripped = text
    .toLowerCase()
    // remove markdown: **, *, #, >, -, backticks, brackets, underscores
    .replace(/[*#>`\-_\[\](){}|~]/g, ' ')
    // remove backtick pairs
    .replace(/`[^`]*`/g, ' ');

  return stripped
    .split(/[\s\-_/.,;:!?()[\]{}|~]+/)
    .filter((tok) => tok.length >= 2 && !STOP_WORDS.has(tok));
}

// ── Index ─────────────────────────────────────────────────────────────────────

export interface BM25Index {
  readonly invertedIndex: Map<string, PostingEntry[]>;
  readonly docLengths: Map<string, number>;
  readonly avgdl: number;
  readonly N: number;
}

/** Build the BM25 inverted index from an array of indexed documents. */
export function buildBM25Index(docs: readonly IndexedDocument[]): BM25Index {
  const invertedIndex = new Map<string, PostingEntry[]>();
  const docLengths = new Map<string, number>();
  let totalTokens = 0;

  for (const doc of docs) {
    const tokens = doc.tokens as string[];
    docLengths.set(doc.id, tokens.length);
    totalTokens += tokens.length;

    // Count term frequencies + positions within this document
    const termPositions = new Map<string, number[]>();
    for (let i = 0; i < tokens.length; i++) {
      const tok = tokens[i] as string;
      const existing = termPositions.get(tok);
      if (existing) {
        existing.push(i);
      } else {
        termPositions.set(tok, [i]);
      }
    }

    // Build posting list entries
    for (const [term, positions] of termPositions) {
      const tf = positions.length / tokens.length;
      const entry: PostingEntry = { docId: doc.id, tf, positions };
      const existing = invertedIndex.get(term);
      if (existing) {
        existing.push(entry);
      } else {
        invertedIndex.set(term, [entry]);
      }
    }
  }

  const N = docs.length;
  const avgdl = N > 0 ? totalTokens / N : 1;

  return { invertedIndex, docLengths, avgdl, N };
}

// ── Scorer ────────────────────────────────────────────────────────────────────

export interface ScoredDoc {
  readonly docId: string;
  readonly score: number;
}

/** Score a query against the BM25 index. Returns docs sorted by score descending. */
export function scoreQuery(
  queryText: string,
  index: BM25Index,
): ScoredDoc[] {
  const queryTokens = tokenize(queryText);
  if (queryTokens.length === 0) return [];

  const { invertedIndex, docLengths, avgdl, N } = index;
  const scores = new Map<string, number>();

  for (const term of queryTokens) {
    const postings = invertedIndex.get(term);
    if (!postings || postings.length === 0) continue;

    const df = postings.length;
    // IDF from spec: ln((N - df + 0.5) / (df + 0.5) + 1)
    const idf = Math.log((N - df + 0.5) / (df + 0.5) + 1);

    for (const { docId, tf } of postings) {
      const dl = docLengths.get(docId) ?? avgdl;
      // BM25 tf_norm = tf * (K1 + 1) / (tf + K1 * (1 - B + B * dl / avgdl))
      const tfNorm = (tf * (K1 + 1)) / (tf + K1 * (1 - B + B * (dl / avgdl)));
      const contribution = idf * tfNorm;
      scores.set(docId, (scores.get(docId) ?? 0) + contribution);
    }
  }

  const result: ScoredDoc[] = [];
  for (const [docId, score] of scores) {
    result.push({ docId, score });
  }
  result.sort((a, b) => b.score - a.score);
  return result;
}
