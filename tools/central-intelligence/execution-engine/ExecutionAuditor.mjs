/**
 * ExecutionAuditor — tamper-evident, append-only audit log for every execution.
 *
 * Hash chain: each entry contains a SHA-256 hash of its own content + the
 * previous entry's hash, forming an append-only linked chain.
 * Tampering any entry breaks the chain from that point forward.
 *
 * Storage: graphify-out/execution-audit/audit.jsonl (one JSON object per line).
 */

import { createHash, randomUUID } from 'node:crypto';
import { createWriteStream, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { appendFile, readFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');
const AUDIT_DIR = join(REPO_ROOT, 'graphify-out', 'execution-audit');
const AUDIT_FILE = join(AUDIT_DIR, 'audit.jsonl');

/** Compute SHA-256 hash of an arbitrary string. */
function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

/** Ensure the audit directory exists. */
async function ensureDir() {
  try {
    await mkdir(AUDIT_DIR, { recursive: true });
  } catch {
    // Already exists.
  }
}

class ExecutionAuditor {
  constructor() {
    this._lastHash = '0'.repeat(64); // genesis hash
    this._initialized = false;
  }

  async _init() {
    if (this._initialized) return;
    await ensureDir();
    // If there are existing entries, load the last hash to continue the chain.
    if (existsSync(AUDIT_FILE)) {
      try {
        const raw = readFileSync(AUDIT_FILE, 'utf8').trim();
        if (raw) {
          const lines = raw.split('\n').filter(Boolean);
          if (lines.length > 0) {
            const last = JSON.parse(lines[lines.length - 1]);
            this._lastHash = last.hash ?? this._lastHash;
          }
        }
      } catch {
        // If the file is malformed, start fresh — integrity check will catch it.
      }
    }
    this._initialized = true;
  }

  /**
   * Record an execution to the audit log.
   * @param {object} execution — must contain at minimum {id, action, status}.
   * @returns {string} auditId
   */
  async record(execution) {
    await this._init();

    const auditId = randomUUID();
    const timestamp = new Date().toISOString();
    const prevHash = this._lastHash;

    const entryWithoutHash = {
      auditId,
      executionId: execution.id ?? null,
      action: execution.action ?? 'unknown',
      params: execution.params ?? {},
      status: execution.status ?? 'UNKNOWN',
      safe: execution.safe ?? true,
      mutating: execution.mutating ?? false,
      reversible: execution.reversible ?? true,
      durationMs: execution.durationMs ?? null,
      outputSummary: summariseOutput(execution.output),
      error: execution.error ?? null,
      timestamp,
      prevHash,
    };

    const contentForHash = JSON.stringify(entryWithoutHash);
    const hash = sha256(contentForHash);
    const entry = { ...entryWithoutHash, hash };

    await appendFile(AUDIT_FILE, JSON.stringify(entry) + '\n', 'utf8');
    this._lastHash = hash;
    return auditId;
  }

  /**
   * Return audit entries, optionally filtered.
   * @param {object} filter — { action?, status?, limit? }
   */
  async getAuditLog(filter = {}) {
    await this._init();
    const lines = await this._readLines();
    let entries = lines.map((l) => {
      try {
        return JSON.parse(l);
      } catch {
        return null;
      }
    }).filter(Boolean);

    if (filter.action) {
      entries = entries.filter((e) => e.action === filter.action);
    }
    if (filter.status) {
      entries = entries.filter((e) => e.status === filter.status);
    }
    if (filter.limit && Number.isFinite(filter.limit)) {
      entries = entries.slice(-filter.limit);
    }

    return entries;
  }

  /**
   * Return the full audit trail for a specific executionId.
   */
  async getAuditTrail(executionId) {
    await this._init();
    const lines = await this._readLines();
    return lines
      .map((l) => { try { return JSON.parse(l); } catch { return null; } })
      .filter((e) => e && e.executionId === executionId);
  }

  /**
   * Verify the hash chain integrity.
   * Returns { valid: boolean, totalEntries, firstBrokenAt? }.
   */
  async verifyAuditIntegrity() {
    await this._init();
    const lines = await this._readLines();
    if (lines.length === 0) return { valid: true, totalEntries: 0 };

    let prevHash = '0'.repeat(64);
    let valid = true;
    let firstBrokenAt = null;

    for (let i = 0; i < lines.length; i++) {
      let entry;
      try {
        entry = JSON.parse(lines[i]);
      } catch {
        valid = false;
        firstBrokenAt = i;
        break;
      }

      const { hash, ...rest } = entry;
      const expectedHash = sha256(JSON.stringify(rest));
      if (hash !== expectedHash || entry.prevHash !== prevHash) {
        valid = false;
        firstBrokenAt = i;
        break;
      }
      prevHash = hash;
    }

    return { valid, totalEntries: lines.length, ...(firstBrokenAt != null ? { firstBrokenAt } : {}) };
  }

  /**
   * Return aggregate statistics over the audit log.
   */
  async getStats() {
    const entries = await this.getAuditLog();
    const byStatus = {};
    const byAction = {};
    for (const e of entries) {
      byStatus[e.status] = (byStatus[e.status] ?? 0) + 1;
      byAction[e.action] = (byAction[e.action] ?? 0) + 1;
    }
    const durations = entries.map((e) => e.durationMs).filter(Number.isFinite);
    const avgDurationMs = durations.length
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : null;
    return {
      totalEntries: entries.length,
      byStatus,
      byAction,
      avgDurationMs,
      auditFile: AUDIT_FILE,
    };
  }

  /** Read raw lines from the audit file. */
  async _readLines() {
    try {
      const raw = await readFile(AUDIT_FILE, 'utf8');
      return raw.trim().split('\n').filter(Boolean);
    } catch {
      return [];
    }
  }
}

/** Produce a compact summary of output for audit storage (avoids huge blobs). */
function summariseOutput(output) {
  if (output == null) return null;
  if (typeof output === 'string') return output.slice(0, 500);
  if (typeof output === 'object') {
    try {
      const s = JSON.stringify(output);
      return s.length > 500 ? s.slice(0, 500) + '…' : s;
    } catch {
      return '[unserializable]';
    }
  }
  return String(output).slice(0, 500);
}

export default new ExecutionAuditor();
