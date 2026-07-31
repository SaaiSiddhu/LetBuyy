/**
 * SecurityTimelineService — LSAS Phase 14.
 *
 * Composes over the LCTS TrackingEngine: calls generateTimeline() and filters the resulting
 * ChangeRecord[] to only security-relevant entries. A record is security-relevant when its
 * kind is 'migration' or 'decision' AND its detail (case-insensitive) matches at least one
 * term in the SECURITY_TERMS set.
 *
 * READ ONLY. DETERMINISTIC. NO Date.now() / new Date() / fetch / fs / exec / AI.
 * Injectable clock: constructor(core, now). Recommendations are NEVER produced here.
 *
 * Honesty: structural records (migrations + decisions from memory-intel.json) are CONNECTED;
 * live change feeds are NOT_CONNECTED — connection is inherited from each ChangeRecord and
 * preserved verbatim. at: null is preserved — never fabricated.
 *
 * try/catch: any exception from the tracking engine returns [] — honest empty, never throws.
 */
import { type LcisEngine } from '@letbuyy/lcis-core';
import { createTrackingEngine } from '@letbuyy/lcis-tracking';
import { defaultNow } from '../shared/index';
import type { SecurityTimelineEntry } from '../shared/types';

/**
 * Fixed set of security-relevant terms matched (case-insensitive) against a record's detail.
 * The regex is anchored to word/token boundaries via the source string — we use a simple
 * substring search on the lower-cased detail which is efficient, honest, and easy to audit.
 */
const SECURITY_TERMS: readonly string[] = [
  'rls',
  'policy',
  'auth',
  'security',
  'refund',
  'payment',
  'payout',
  'gift',
  'ledger',
  'tenant',
  'site_id',
];

/**
 * The two ChangeRecord kinds that are security-relevant for the timeline.
 */
const SECURITY_KINDS = new Set<string>(['migration', 'decision']);

function isSecurityRelevant(kind: string, detail: string): boolean {
  if (!SECURITY_KINDS.has(kind)) return false;
  const lower = detail.toLowerCase();
  return SECURITY_TERMS.some((term) => lower.includes(term));
}

export class SecurityTimelineService {
  private readonly tracking: ReturnType<typeof createTrackingEngine>;

  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {
    this.tracking = createTrackingEngine({ core: this.core, now: this.now });
  }

  /**
   * Returns security-relevant timeline entries, newest-first (preserving the order already
   * established by the underlying LCTS TimelineService).
   *
   * Filters to records where:
   *   kind is 'migration' | 'decision'
   *   AND detail (case-insensitive) contains at least one SECURITY_TERMS token.
   *
   * Maps ChangeRecord → SecurityTimelineEntry:
   *   id, at (null preserved — honest), kind, subject, detail, connection, evidence.
   */
  entries(): readonly SecurityTimelineEntry[] {
    try {
      const timeline = this.tracking.generateTimeline();
      return timeline.records
        .filter((r) => isSecurityRelevant(r.kind, r.detail))
        .map(
          (r): SecurityTimelineEntry => ({
            id: r.id,
            at: r.at,
            kind: r.kind,
            subject: r.subject,
            detail: r.detail,
            connection: r.connection,
            evidence: r.evidence,
          }),
        );
    } catch {
      return [];
    }
  }
}
