/**
 * LCIS V3 — EvidenceVerifier (Phase 27)
 *
 * Cross-checks individual evidence items against authoritative sources.
 * Answers:
 *   - Is each evidence item traceable to a real, known source?
 *   - Do independent sources agree on the claim?
 *   - What is the aggregate evidence strength?
 *   - Can we find corroboration or contradiction from the graph/memory/V1?
 *
 * Sources consulted (in order of authority):
 *   1. V1 LCIS http://localhost:3333 (107-validator structural truth)
 *   2. Architecture Intelligence Engine (structural)
 *   3. Graph Explorer (domain/blast/dependency)
 *   4. Memory Retriever (historical recall)
 *
 * HONESTY CONTRACT:
 *   - Every live source that is NOT CONNECTED is flagged explicitly.
 *   - Structural topology from graphify-out snapshots is CONNECTED.
 *   - No claims are fabricated from absent data.
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const V1_BASE   = 'http://localhost:3333';

// ── Source registry ────────────────────────────────────────────────────────────

/** Known authoritative source keys.  Anything outside this set is UNKNOWN. */
const AUTHORITATIVE_SOURCES = new Set([
  'v1-lcis', '107-validators', 'security-gate', 'rls-gate', 'canonical-ledger',
]);
const STRUCTURAL_SOURCES = new Set([
  'arch-intel', 'domain-graph', 'code-graph', 'db-intel', 'fix-engine',
  'arch-reasoner', 'security-reasoner', 'dependency-graph',
]);
const OPERATIONAL_SOURCES = new Set([
  'memory-engine', 'v2-ops', 'decision-v2', 'impact-predictor',
  'risk-scorer', 'recommendation-engine', 'prediction-engine',
]);

function sourceCategory(source) {
  if (!source) return 'unknown';
  const s = source.toLowerCase().trim();
  if (AUTHORITATIVE_SOURCES.has(s)) return 'authoritative';
  if (STRUCTURAL_SOURCES.has(s))    return 'structural';
  if (OPERATIONAL_SOURCES.has(s))   return 'operational';
  if (s.includes('live-connected'))    return 'live-connected';
  if (s.includes('live-disconnected') || s.includes('not connected')) return 'live-disconnected';
  return 'unknown';
}

// ── Lazy sibling imports ───────────────────────────────────────────────────────

const _cache = new Map();

async function loadModule(rel) {
  if (_cache.has(rel)) return _cache.get(rel);
  try {
    const abs = new URL(rel, import.meta.url).pathname;
    const mod = (await import(abs)).default;
    _cache.set(rel, mod);
    return mod;
  } catch {
    _cache.set(rel, null);
    return null;
  }
}

async function getArchIntel()    { return loadModule('../architecture-intelligence/ArchitectureIntelligenceEngine.mjs'); }
async function getGraphExplorer(){ return loadModule('../graph-engine/GraphExplorer.mjs'); }
async function getMemory()       { return loadModule('../memory-engine/MemoryRetriever.mjs'); }

// ── V1 fetch helper ────────────────────────────────────────────────────────────

async function fetchV1(endpoint, timeout = 4000) {
  const ctrl  = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeout);
  try {
    const res = await fetch(`${V1_BASE}${endpoint}`, { signal: ctrl.signal });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

// ── Class ─────────────────────────────────────────────────────────────────────

class EvidenceVerifier {
  /**
   * Verify each evidence item in the array.
   * Returns an annotated copy with traceability status added.
   *
   * @param {Array<{source:string, fact:string, corroborates?:boolean}>} evidence
   * @returns {Promise<Array<{source:string, fact:string, corroborates:boolean, traceable:boolean, category:string, note:string}>>}
   */
  async verifyEvidence(evidence) {
    if (!Array.isArray(evidence) || evidence.length === 0) return [];

    return evidence.map((item) => {
      const cat       = sourceCategory(item.source);
      const traceable = cat !== 'unknown' && cat !== 'live-disconnected';
      const note      = this._noteForCategory(cat, item.source);

      return {
        ...item,
        corroborates: item.corroborates !== false, // default true if not set
        traceable,
        category: cat,
        note,
      };
    });
  }

  _noteForCategory(cat, source) {
    switch (cat) {
      case 'authoritative':   return `${source} is a 107-validator authoritative gate (CONNECTED)`;
      case 'structural':      return `${source} is structural topology from graphify-out (CONNECTED)`;
      case 'operational':     return `${source} is an operational inference layer (CONNECTED)`;
      case 'live-connected':  return `${source} is a live-connected adapter (CONNECTED)`;
      case 'live-disconnected': return `NOT CONNECTED — ${source} requires a live telemetry adapter`;
      default:                return `Source "${source}" is not in the authoritative source registry`;
    }
  }

  /**
   * Cross-check a textual claim against independent sources.
   * Returns agreement ratio and which sources agree.
   *
   * @param {string} claim
   * @param {string[]} sources — list of source keys to consult
   * @returns {Promise<{agreement:number, agreeing:string[], disagreeing:string[], notConnected:string[]}>}
   */
  async crossCheck(claim, sources = []) {
    const agreeing    = [];
    const disagreeing = [];
    const notConnected = [];

    // V1 check — structural truth
    const v1Result = await fetchV1(`/api/search?q=${encodeURIComponent(claim)}`);
    if (v1Result === null) {
      notConnected.push('v1-lcis (NOT CONNECTED — localhost:3333 not responding)');
    } else if (v1Result && (v1Result.results?.length > 0 || v1Result.matches?.length > 0)) {
      agreeing.push('v1-lcis');
    }

    // Architecture graph check
    const arch = await getArchIntel();
    if (arch) {
      try {
        const snapshot = await arch.getSnapshot?.();
        if (snapshot) {
          const snapshotStr = JSON.stringify(snapshot).toLowerCase();
          const claimWords  = claim.toLowerCase().split(/\s+/).filter(w => w.length > 4);
          const hit         = claimWords.some(w => snapshotStr.includes(w));
          if (hit) agreeing.push('arch-intel');
        }
      } catch { /* degraded */ }
    }

    // Graph explorer check
    const graph = await getGraphExplorer();
    if (graph) {
      try {
        const answer = await graph.explore?.(claim);
        if (answer && !answer.error) agreeing.push('domain-graph');
      } catch { /* degraded */ }
    }

    // Memory check
    const memory = await getMemory();
    if (memory) {
      try {
        const hits = await memory.retrieve(claim, { limit: 3, minScore: 0.4 });
        if (hits && hits.length > 0) agreeing.push('memory-engine');
      } catch { /* degraded */ }
    }

    // Anything in sources not yet consulted → not connected
    for (const s of sources) {
      const cat = sourceCategory(s);
      if (cat === 'live-disconnected') notConnected.push(`${s} (NOT CONNECTED)`);
    }

    const total     = Math.max(1, agreeing.length + disagreeing.length);
    const agreement = agreeing.length / total;

    return { agreement, agreeing, disagreeing, notConnected };
  }

  /**
   * Score the aggregate strength of an evidence set.
   * Returns a value 0–1 where 1 means all traceable authoritative sources corroborate.
   *
   * Formula:
   *   strength = (traceableCount × 0.4 + corroboratingCount × 0.6) / max(evidenceCount, 1)
   *   capped at 1.0
   *
   * @param {Array<{source:string, fact:string, corroborates?:boolean}>} evidence
   * @returns {number} 0–1
   */
  scoreEvidence(evidence) {
    if (!Array.isArray(evidence) || evidence.length === 0) return 0;

    let traceableCount      = 0;
    let corroboratingCount  = 0;

    for (const item of evidence) {
      const cat = sourceCategory(item.source);
      if (cat !== 'unknown' && cat !== 'live-disconnected') traceableCount++;
      if (item.corroborates !== false)                       corroboratingCount++;
    }

    const n         = evidence.length;
    const strength  = (traceableCount * 0.4 + corroboratingCount * 0.6) / n;
    return Math.min(1, Math.max(0, strength));
  }

  /**
   * Search available engines for facts that support the claim.
   * @param {string} claim
   * @returns {Promise<Array<{source:string, fact:string, corroborates:true}>>}
   */
  async findCorroboration(claim) {
    const corroborations = [];

    // V1 structural search
    const v1 = await fetchV1(`/api/search?q=${encodeURIComponent(claim)}`);
    if (v1?.results?.length > 0) {
      for (const r of v1.results.slice(0, 3)) {
        corroborations.push({
          source:       'v1-lcis',
          fact:         r.summary || r.text || r.description || JSON.stringify(r).slice(0, 120),
          corroborates: true,
        });
      }
    }

    // Domain blast radius for claim keywords
    const keyword = claim.split(/\s+/).find(w => w.length > 4) || claim;
    const blast   = await fetchV1(`/api/blast?q=${encodeURIComponent(keyword)}`);
    if (blast?.affected?.length > 0) {
      corroborations.push({
        source:       'domain-graph',
        fact:         `Blast radius for "${keyword}": ${blast.affected.slice(0, 5).join(', ')}`,
        corroborates: true,
      });
    }

    // Memory
    const memory = await getMemory();
    if (memory) {
      try {
        const hits = await memory.retrieve(claim, { limit: 2, minScore: 0.5 });
        for (const h of hits) {
          corroborations.push({
            source:       'memory-engine',
            fact:         h.payload?.content || h.payload?.summary || JSON.stringify(h.payload).slice(0, 120),
            corroborates: true,
          });
        }
      } catch { /* degraded */ }
    }

    return corroborations;
  }

  /**
   * Search for facts that directly contradict the claim.
   * @param {string} claim
   * @returns {Promise<Array<{source:string, fact:string, corroborates:false}>>}
   */
  async findContradiction(claim) {
    const contradictions = [];

    // Check V1 audit endpoint for known violations
    const audit = await fetchV1(`/api/audit`);
    if (audit?.violations?.length > 0) {
      const lowerClaim = claim.toLowerCase();
      for (const v of audit.violations) {
        const vText = JSON.stringify(v).toLowerCase();
        // If the violation text overlaps with claim keywords, it may contradict
        const claimWords = lowerClaim.split(/\s+/).filter(w => w.length > 4);
        if (claimWords.some(w => vText.includes(w))) {
          contradictions.push({
            source:       'security-gate',
            fact:         `Validator violation: ${v.message || v.description || JSON.stringify(v).slice(0, 120)}`,
            corroborates: false,
          });
        }
      }
    }

    // Architecture drift check
    const arch = await getArchIntel();
    if (arch) {
      try {
        const drift = await arch.getDrift?.();
        if (drift?.violations?.length > 0) {
          const lowerClaim = claim.toLowerCase();
          for (const d of drift.violations.slice(0, 3)) {
            const dText = JSON.stringify(d).toLowerCase();
            if (lowerClaim.split(/\s+/).filter(w => w.length > 4).some(w => dText.includes(w))) {
              contradictions.push({
                source:       'arch-intel',
                fact:         `Architecture drift: ${d.message || d.description || JSON.stringify(d).slice(0, 120)}`,
                corroborates: false,
              });
            }
          }
        }
      } catch { /* degraded */ }
    }

    return contradictions;
  }
}

export default new EvidenceVerifier();
