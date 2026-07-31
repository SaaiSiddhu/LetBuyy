/**
 * ChangeCorrelationService — correlates the affected systems from AffectedSummary to
 * recent change records from the LCTS timeline. Pure composition over TrackingEngine;
 * no new intelligence. Read-only, deterministic, injectable clock.
 *
 * Anti-hallucination law: matching is deterministic substring (case-insensitive) over
 * subject and detail of each ChangeRecord against the affected system name-parts and
 * domain names. Cap: 20 matching changes, 10 migration subjects (newest first).
 */
import type { LcisEngine } from '@letbuyy/lcis-core';
import { createTrackingEngine, type TrackingEngine } from '@letbuyy/lcis-tracking';
import type { AffectedSummary, RecentChangeSummary } from '../shared/types';

/** Maximum correlated change records returned. */
const MAX_CHANGES = 20;

/** Maximum migration subjects returned. */
const MAX_MIGRATIONS = 10;

/**
 * Derive the searchable name-parts from a twin node id or domain name.
 * For 'domain:payments' → ['payments']; for 'rpc:create_checkout_order' → ['create_checkout_order'].
 * The raw id is also used so bare names match either way.
 */
function nameParts(id: string): string[] {
  const colon = id.indexOf(':');
  return colon >= 0 ? [id.slice(colon + 1).toLowerCase(), id.toLowerCase()] : [id.toLowerCase()];
}

/**
 * Check whether a change record is relevant to the affected summary.
 * Performs case-insensitive substring matching of subject and detail against
 * every affected system name-part and every domain name.
 */
function isRelevant(
  subject: string,
  detail: string,
  searchTerms: readonly string[],
): boolean {
  const lSubject = subject.toLowerCase();
  const lDetail = detail.toLowerCase();
  for (const term of searchTerms) {
    if (lSubject.includes(term) || lDetail.includes(term)) return true;
  }
  return false;
}

export class ChangeCorrelationService {
  private readonly tracking: TrackingEngine;

  constructor(core: LcisEngine, now: () => string) {
    this.tracking = createTrackingEngine({ core, now });
  }

  /**
   * Correlate the given affected summary to recent change records from the LCTS timeline.
   * Returns up to 20 matching changes and up to 10 migration subjects (newest-first per
   * timeline ordering). Connection is CONNECTED when the timeline had any records, else
   * NOT_CONNECTED.
   */
  correlate(affected: AffectedSummary): RecentChangeSummary {
    const timeline = this.tracking.generateTimeline();

    // Build the set of search terms from affected systems + domains.
    const searchTerms: string[] = [];
    for (const id of affected.systems) {
      for (const part of nameParts(id)) {
        if (part.length > 0) searchTerms.push(part);
      }
    }
    for (const domain of affected.domains) {
      const lower = domain.toLowerCase();
      if (lower.length > 0) searchTerms.push(lower);
    }

    // Deduplicate search terms.
    const uniqueTerms = [...new Set(searchTerms)];

    // Correlated changes: records whose subject/detail match any term, cap 20.
    const changes: { id: string; kind: string; subject: string; detail: string }[] = [];
    for (const record of timeline.records) {
      if (changes.length >= MAX_CHANGES) break;
      if (uniqueTerms.length === 0) break; // no terms → no matches (honest)
      if (isRelevant(record.subject, record.detail, uniqueTerms)) {
        changes.push({
          id: record.id,
          kind: record.kind,
          subject: record.subject,
          detail: record.detail,
        });
      }
    }

    // Migrations: ALL migration record subjects, newest first (timeline is newest-first
    // by the LCTS contract), cap 10.
    const migrations: string[] = [];
    for (const record of timeline.records) {
      if (record.kind === 'migration') {
        migrations.push(record.subject);
        if (migrations.length >= MAX_MIGRATIONS) break;
      }
    }

    // Connection: CONNECTED when the timeline had any records (structural facts present).
    const connection = timeline.records.length > 0 ? 'CONNECTED' : 'NOT_CONNECTED';

    return { changes, migrations, connection };
  }
}
