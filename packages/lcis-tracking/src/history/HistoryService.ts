/**
 * HistoryService — LCTS Phase 10.
 *
 * Derives per-subject change history by filtering an existing ChangeTimeline and augmenting
 * it with decision reasons from the lcis-core MemoryService (BM25 corpus search).
 *
 * CONNECTED: change records are filtered from the timeline (structural facts).
 * NOT_CONNECTED: memory corpus is absent/empty (memory-intel.json + governance docs not loaded).
 *
 * READ-ONLY, DETERMINISTIC, NO side effects, NO network, NO Date.now() in src.
 * Injectable clock: constructor(core, now) — always pass `now` from the parent engine.
 */
import { type LcisEngine, evidence, notConnected } from '@letbuyy/lcis-core';
import {
  defaultNow,
  tracking,
  type ChangeHistory,
  type ChangeTimeline,
} from '../shared/index';

const MEMORY_CORPUS_SOURCE =
  'lcis-core MemoryService corpus (memory-intel.json + docs)';

/** Maximum number of memory hits to include as reasons. */
const MAX_REASONS = 10;

export class HistoryService {
  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {}

  /**
   * Build the per-subject ChangeHistory.
   *
   * records: timeline.records where record.subject === subject OR
   *          record.subject.includes(subject) OR
   *          record.detail.toLowerCase().includes(subject.toLowerCase());
   *          preserve timeline order.
   *
   * reasons: core.memory.search(subject) hits (top MAX_REASONS) mapped to
   *          { id, title, source }. title = the hit's section (nearest heading).
   *          On search failure or empty corpus → [] + notConnected evidence.
   *
   * summary: '<n> change record(s) and <m> recorded reason(s) for <subject>.'
   * Wrapped with tracking() carrying real evidence.
   */
  historyOf(subject: string, timeline: ChangeTimeline): ChangeHistory {
    // ── 1. Filter timeline records ────────────────────────────────────────────
    const subjectLower = subject.toLowerCase();
    const filtered = timeline.records.filter(
      (r) =>
        r.subject === subject ||
        r.subject.includes(subject) ||
        r.detail.toLowerCase().includes(subjectLower),
    );

    // ── 2. Search memory corpus for reasons ───────────────────────────────────
    const ev = [...timeline.evidence];
    type Reason = { readonly id: string; readonly title: string; readonly source: string };
    let reasons: Reason[] = [];
    let searchFailed = false;

    try {
      const hits = this.core.memory.search(subject, { limit: MAX_REASONS });
      if (hits.length > 0) {
        reasons = hits.slice(0, MAX_REASONS).map((h) => ({
          id: h.id,
          // MemoryHit.section is the nearest heading above the chunk — the most title-like field.
          title: h.section,
          source: h.source,
        }));
        ev.push(
          evidence(
            'decision',
            'lcis-core:MemoryService',
            `${reasons.length} reason(s) found for subject "${subject}"`,
            MEMORY_CORPUS_SOURCE,
          ),
        );
      } else {
        // search() returned nothing — corpus may be absent or subject genuinely unrecorded.
        searchFailed = true;
      }
    } catch {
      // Any error from the BM25 engine is treated as corpus absence.
      searchFailed = true;
    }

    if (searchFailed) {
      ev.push(
        notConnected(
          `memory:reasons:${subject}`,
          MEMORY_CORPUS_SOURCE,
        ),
      );
    }

    // ── 3. Evidence for the filtered records ──────────────────────────────────
    if (filtered.length > 0) {
      ev.push(
        evidence(
          'artifact-field',
          'lcis-tracking:ChangeTimeline',
          `${filtered.length} record(s) matching subject "${subject}"`,
          'ChangeTimeline (LCTS)',
        ),
      );
    }

    // ── 4. Compose summary + wrap ─────────────────────────────────────────────
    const n = filtered.length;
    const m = reasons.length;
    const summary = `${n} change record(s) and ${m} recorded reason(s) for ${subject}.`;

    return tracking(
      { subject, records: filtered, reasons, summary },
      {
        evidence: ev,
        liveConnected: timeline.liveConnected,
        now: this.now,
      },
    );
  }
}
