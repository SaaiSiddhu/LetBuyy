/**
 * LCIS Browser Intelligence Engine — EvidenceCollector
 * Captures and stores browser evidence: screenshots, HTML snapshots, console logs, network errors.
 * Artifacts written to graphify-out/browser-evidence/{date}/{label}/
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const EVIDENCE_BASE = path.join(REPO_ROOT, 'graphify-out', 'browser-evidence');
const INDEX_FILE = path.join(EVIDENCE_BASE, 'index.json');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function dateStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function safeLabel(label) {
  return label.replace(/[^a-z0-9_-]/gi, '_').slice(0, 80);
}

function readIndex() {
  if (!fs.existsSync(INDEX_FILE)) return [];
  try {
    return JSON.parse(fs.readFileSync(INDEX_FILE, 'utf8'));
  } catch {
    return [];
  }
}

function writeIndex(entries) {
  fs.writeFileSync(INDEX_FILE, JSON.stringify(entries, null, 2), 'utf8');
}

// ---------------------------------------------------------------------------
class EvidenceCollector {
  constructor() {
    fs.mkdirSync(EVIDENCE_BASE, { recursive: true });
  }

  // ---- collect -------------------------------------------------------------
  /**
   * Captures a full evidence artifact from an active Playwright page.
   *
   * @param {string} url - The URL being captured
   * @param {string} label - Human-readable label for this evidence run
   * @param {import('playwright').Page} page - An already-navigated Playwright page
   * @returns {Promise<object>} Evidence artifact metadata
   */
  async collect(url, label, page) {
    const safeL = safeLabel(label);
    const date = dateStr();
    const artifactId = crypto.randomBytes(6).toString('hex');
    const artifactDir = path.join(EVIDENCE_BASE, date, `${safeL}_${artifactId}`);
    fs.mkdirSync(artifactDir, { recursive: true });

    // --- Screenshot ----------------------------------------------------------
    const screenshotPath = path.join(artifactDir, 'screenshot.png');
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } catch (err) {
      fs.writeFileSync(screenshotPath + '.error', err.message, 'utf8');
    }

    // --- HTML ----------------------------------------------------------------
    const htmlPath = path.join(artifactDir, 'page.html');
    let html = '';
    try {
      html = await page.content();
      fs.writeFileSync(htmlPath, html, 'utf8');
    } catch (err) {
      fs.writeFileSync(htmlPath + '.error', err.message, 'utf8');
    }

    // --- Console logs (collected externally by caller; access via page._consoleLogs if set) ----
    const consoleLogs = page._lcisConsoleLogs ?? [];

    // --- Network errors (collected externally) --------------------------------
    const networkErrors = page._lcisNetworkErrors ?? [];

    // --- HTTP status (from last response — caller sets page._lcisHttpStatus) -
    const httpStatus = page._lcisHttpStatus ?? null;

    const evidence = {
      id: artifactId,
      label,
      url,
      timestamp: new Date().toISOString(),
      screenshotPath,
      htmlPath,
      consoleLogs,
      networkErrors,
      httpStatus,
      artifactDir,
    };

    // --- Meta JSON -----------------------------------------------------------
    const metaPath = path.join(artifactDir, 'meta.json');
    fs.writeFileSync(metaPath, JSON.stringify(evidence, null, 2), 'utf8');

    this.store(evidence);
    return evidence;
  }

  // ---- store ---------------------------------------------------------------
  /**
   * Appends an evidence artifact to the shared index.
   * @param {object} evidence - Evidence metadata object
   */
  store(evidence) {
    fs.mkdirSync(EVIDENCE_BASE, { recursive: true });
    const index = readIndex();
    index.unshift(evidence); // newest first
    // Cap index at 1000 entries to avoid unbounded growth
    writeIndex(index.slice(0, 1000));
  }

  // ---- list ----------------------------------------------------------------
  /**
   * Lists evidence artifacts, optionally filtered.
   * @param {{ label?: string, url?: string, since?: string }} [filter]
   * @returns {object[]}
   */
  list(filter = {}) {
    const index = readIndex();
    return index.filter((e) => {
      if (filter.label && !e.label?.includes(filter.label)) return false;
      if (filter.url && e.url !== filter.url) return false;
      if (filter.since && e.timestamp < filter.since) return false;
      return true;
    });
  }

  // ---- getLatest -----------------------------------------------------------
  /**
   * Returns the most recent evidence artifact matching a label.
   * @param {string} label
   * @returns {object|null}
   */
  getLatest(label) {
    const matches = this.list({ label });
    return matches.length > 0 ? matches[0] : null;
  }

  // ---- clean ---------------------------------------------------------------
  /**
   * Removes evidence artifacts older than olderThanMs milliseconds.
   * Deletes artifact directories and updates the index.
   * @param {number} olderThanMs - Age threshold in milliseconds
   * @returns {{ removed: number, kept: number }}
   */
  clean(olderThanMs) {
    const cutoff = new Date(Date.now() - olderThanMs).toISOString();
    const index = readIndex();
    const keep = [];
    let removed = 0;

    for (const entry of index) {
      if (entry.timestamp < cutoff) {
        // Remove artifact directory
        if (entry.artifactDir && fs.existsSync(entry.artifactDir)) {
          try {
            fs.rmSync(entry.artifactDir, { recursive: true, force: true });
          } catch { /* best effort */ }
        }
        removed++;
      } else {
        keep.push(entry);
      }
    }

    writeIndex(keep);

    // Also scan filesystem for orphaned date-dirs that are now empty
    try {
      const dateDirs = fs.readdirSync(EVIDENCE_BASE, { withFileTypes: true })
        .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name));
      for (const d of dateDirs) {
        const fullPath = path.join(EVIDENCE_BASE, d.name);
        if (fs.readdirSync(fullPath).length === 0) {
          fs.rmdirSync(fullPath);
        }
      }
    } catch { /* best effort */ }

    return { removed, kept: keep.length };
  }
}

export default new EvidenceCollector();
