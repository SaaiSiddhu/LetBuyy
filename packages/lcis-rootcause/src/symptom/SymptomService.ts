/**
 * SymptomService — deterministic symptom classifier.
 *
 * classify(text):
 *  1. Lower-cases the input.
 *  2. Scans SYMPTOM_TAXONOMY in declaration order.
 *  3. Collects ALL entries whose terms substring-match the lowered text.
 *  4. kind  = first matching entry's kind (taxonomy order wins on tie).
 *  5. domains / anchors = union (deduped, insertion order) of ALL matching entries.
 *  6. matchedTerms = every matched term, in taxonomy order.
 *  7. No match → { text, kind:'unknown', domains:[], anchors:[], matchedTerms:[] }.
 *
 * Pure — no deps, no clock, no IO, no AI.
 */
import { SYMPTOM_TAXONOMY } from '../shared/taxonomy';
import type { Symptom } from '../shared/types';

export class SymptomService {
  /** No dependencies required. */
  constructor() {}

  classify(text: string): Symptom {
    const lower = text.toLowerCase();

    let kind: Symptom['kind'] | undefined;
    const domainsSet: string[] = [];
    const anchorsSet: string[] = [];
    const matchedTerms: string[] = [];

    for (const entry of SYMPTOM_TAXONOMY) {
      const entryTermMatches: string[] = [];

      for (const term of entry.terms) {
        if (lower.includes(term)) {
          entryTermMatches.push(term);
        }
      }

      if (entryTermMatches.length === 0) continue;

      // First matching entry's kind wins.
      if (kind === undefined) {
        kind = entry.kind;
      }

      // Union domains (insertion-order dedup).
      for (const d of entry.domains) {
        if (!domainsSet.includes(d)) domainsSet.push(d);
      }

      // Union anchors (insertion-order dedup).
      for (const a of entry.anchors) {
        if (!anchorsSet.includes(a)) anchorsSet.push(a);
      }

      // Collect matched terms (taxonomy order; no cross-entry dedup needed — terms
      // are unique within each entry per spec invariant).
      for (const t of entryTermMatches) {
        matchedTerms.push(t);
      }
    }

    if (kind === undefined) {
      return {
        text,
        kind: 'unknown',
        domains: [],
        anchors: [],
        matchedTerms: [],
      };
    }

    return {
      text,
      kind,
      domains: domainsSet,
      anchors: anchorsSet,
      matchedTerms,
    };
  }
}
