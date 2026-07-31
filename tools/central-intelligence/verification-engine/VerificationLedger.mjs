/**
 * LCIS V3 — VerificationLedger (Phase 27)
 *
 * Append-only JSONL ledger for all verification results produced by the
 * VerificationEngine.  Persists to:
 *   graphify-out/verification/ledger.jsonl   (one JSON object per line)
 *
 * NEVER mutates an existing verification entry — the ledger is append-only so
 * that audit history is preserved across re-runs.  A second verification of the
 * same subject_id creates a new line with a new timestamp.
 *
 * Status vocabulary (mirrors VerificationEngine):
 *   VERIFIED  — all independent sources corroborate
 *   PARTIAL   — some corroboration, some gaps
 *   UNVERIFIED — insufficient independent sources
 *   REFUTED   — an authoritative source contradicts the claim
 */

import { createWriteStream, existsSync, readFileSync, mkdirSync } from 'node:fs';
import { appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT  = resolve(__dirname, '../../..');
const LEDGER_DIR = resolve(REPO_ROOT, 'graphify-out', 'verification');
const LEDGER_PATH = resolve(LEDGER_DIR, 'ledger.jsonl');

// ── Helpers ───────────────────────────────────────────────────────────────────

function ensureDir() {
  if (!existsSync(LEDGER_DIR)) mkdirSync(LEDGER_DIR, { recursive: true });
}

/** Read all ledger lines and parse them.  Returns array of objects. */
function readAllLines() {
  if (!existsSync(LEDGER_PATH)) return [];
  const raw = readFileSync(LEDGER_PATH, 'utf8').trim();
  if (!raw) return [];
  return raw
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line); }
      catch { return null; }
    })
    .filter(Boolean);
}

// ── Class ─────────────────────────────────────────────────────────────────────

class VerificationLedger {
  /**
   * Append a verification result to the ledger.
   * @param {object} verification — shape produced by VerificationEngine
   * @returns {object} the entry that was written (same object, with ledgerEntryId added)
   */
  record(verification) {
    ensureDir();

    const entry = {
      ledgerEntryId: `ve-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ...verification,
      recordedAt: new Date().toISOString(),
    };

    appendFileSync(LEDGER_PATH, JSON.stringify(entry) + '\n', 'utf8');
    return entry;
  }

  /**
   * Return the most recent verification for a given subjectId.
   * @param {string} subjectId
   * @returns {object|null}
   */
  getVerification(subjectId) {
    const all = readAllLines();
    const matches = all.filter((e) => e.subjectId === subjectId || e.subject?.id === subjectId);
    if (matches.length === 0) return null;
    // Most recent first
    return matches.sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))[0];
  }

  /**
   * Return filtered ledger entries.
   * @param {{status?:string, type?:string, since?:string, limit?:number}} filter
   * @returns {object[]}
   */
  getLedger({
    status = null,
    type   = null,
    since  = null,
    limit  = 500,
  } = {}) {
    let entries = readAllLines();

    if (status) entries = entries.filter((e) => e.status === status);
    if (type)   entries = entries.filter((e) => e.type   === type);
    if (since) {
      const sinceTs = new Date(since).getTime();
      entries = entries.filter((e) => new Date(e.recordedAt).getTime() >= sinceTs);
    }

    // Most recent first, up to limit
    return entries
      .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt))
      .slice(0, limit);
  }

  /**
   * Return all entries whose status is UNVERIFIED or PARTIAL with no
   * evidence.  These are the outstanding claims that still need evidence.
   * @returns {object[]}
   */
  getUnverifiedClaims() {
    const all = readAllLines();
    return all.filter(
      (e) => e.status === 'UNVERIFIED' || (e.status === 'PARTIAL' && (!e.evidence || e.evidence.length === 0))
    ).sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
  }

  /**
   * Return aggregate counts across the entire ledger.
   * @returns {{total:number, verified:number, partial:number, unverified:number, refuted:number, ledgerPath:string}}
   */
  getStats() {
    const all = readAllLines();

    const counts = { VERIFIED: 0, PARTIAL: 0, UNVERIFIED: 0, REFUTED: 0 };
    for (const e of all) {
      if (e.status in counts) counts[e.status]++;
    }

    return {
      total:      all.length,
      verified:   counts.VERIFIED,
      partial:    counts.PARTIAL,
      unverified: counts.UNVERIFIED,
      refuted:    counts.REFUTED,
      ledgerPath: LEDGER_PATH,
    };
  }
}

export default new VerificationLedger();
