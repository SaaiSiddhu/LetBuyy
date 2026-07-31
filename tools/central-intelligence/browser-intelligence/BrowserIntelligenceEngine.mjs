/**
 * LCIS Browser Intelligence Engine
 * Hidden implementation detail: uses Playwright for real browser automation.
 * Playwright is NEVER exposed as a first-class API — it is an internal primitive.
 *
 * Safety contract:
 *  - Headless only by default (PLAYWRIGHT_HEADLESS=true)
 *  - NEVER executes real payments — checkout flow halts before any gateway redirect
 *  - All evidence written to graphify-out/browser-evidence/
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../..');
const EVIDENCE_DIR = path.join(REPO_ROOT, 'graphify-out', 'browser-evidence');

const HEADLESS = (process.env.PLAYWRIGHT_HEADLESS ?? 'true') !== 'false';
const TIMEOUT = parseInt(process.env.BROWSER_INTELLIGENCE_TIMEOUT ?? '30000', 10);

// ---------------------------------------------------------------------------
// Lazy Playwright loader — returns null if not installed
// ---------------------------------------------------------------------------
let _playwright = null;
async function loadPlaywright() {
  if (_playwright !== null) return _playwright;
  try {
    const require = createRequire(import.meta.url);
    const pw = await import('playwright');
    _playwright = pw;
    return _playwright;
  } catch {
    try {
      const pw = await import('@playwright/test');
      _playwright = pw;
      return _playwright;
    } catch {
      _playwright = false; // sentinel: not available
      return false;
    }
  }
}

// ---------------------------------------------------------------------------
// Ensure evidence directory exists
// ---------------------------------------------------------------------------
function ensureEvidenceDir() {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

// ---------------------------------------------------------------------------
// Internal browser session management
// ---------------------------------------------------------------------------
class SessionPool {
  constructor() {
    this._active = new Map(); // label -> { browser, context, page, startedAt }
  }

  async acquire(label) {
    const pw = await loadPlaywright();
    if (!pw) return null;
    const browser = await pw.chromium.launch({ headless: HEADLESS });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (compatible; LCIS-BrowserIntelligence/2.0; +https://letbuyy.com)',
      ignoreHTTPSErrors: false,
    });
    const page = await context.newPage();
    page.setDefaultTimeout(TIMEOUT);
    const session = { browser, context, page, startedAt: Date.now(), label };
    this._active.set(label, session);
    return session;
  }

  async release(label) {
    const session = this._active.get(label);
    if (!session) return;
    try { await session.browser.close(); } catch { /* best effort */ }
    this._active.delete(label);
  }

  get size() { return this._active.size; }
}

const pool = new SessionPool();

// ---------------------------------------------------------------------------
// Shared navigation helper
// ---------------------------------------------------------------------------
async function navigate(page, url) {
  const response = await page.goto(url, {
    waitUntil: 'domcontentloaded',
    timeout: TIMEOUT,
  });
  return response;
}

// ---------------------------------------------------------------------------
// BrowserIntelligenceEngine
// ---------------------------------------------------------------------------
class BrowserIntelligenceEngine {
  constructor() {
    this._lastRun = null;
    this._playwrightAvailable = null;
  }

  // ---- availability probe --------------------------------------------------
  async _checkPlaywright() {
    if (this._playwrightAvailable !== null) return this._playwrightAvailable;
    const pw = await loadPlaywright();
    this._playwrightAvailable = !!pw;
    return this._playwrightAvailable;
  }

  _notAvailable() {
    return { status: 'NOT AVAILABLE', reason: 'playwright not installed' };
  }

  // ---- captureEvidence -----------------------------------------------------
  async captureEvidence(url, label) {
    const available = await this._checkPlaywright();
    if (!available) return this._notAvailable();

    ensureEvidenceDir();
    const dateStr = new Date().toISOString().slice(0, 10);
    const artifactDir = path.join(EVIDENCE_DIR, dateStr, label.replace(/[^a-z0-9_-]/gi, '_'));
    fs.mkdirSync(artifactDir, { recursive: true });

    const sessionKey = `evidence-${label}-${Date.now()}`;
    const session = await pool.acquire(sessionKey);
    if (!session) return this._notAvailable();

    const startedAt = Date.now();
    const consoleLogs = [];
    const networkErrors = [];

    session.page.on('console', (msg) =>
      consoleLogs.push({ type: msg.type(), text: msg.text() })
    );
    session.page.on('requestfailed', (req) =>
      networkErrors.push({ url: req.url(), failure: req.failure()?.errorText })
    );

    let httpStatus = null;
    try {
      const response = await navigate(session.page, url);
      httpStatus = response?.status() ?? null;

      const screenshotPath = path.join(artifactDir, 'screenshot.png');
      await session.page.screenshot({ path: screenshotPath, fullPage: true });

      const htmlPath = path.join(artifactDir, 'page.html');
      const html = await session.page.content();
      fs.writeFileSync(htmlPath, html, 'utf8');

      const evidence = {
        label,
        url,
        timestamp: new Date().toISOString(),
        screenshotPath,
        htmlPath,
        consoleLogs,
        networkErrors,
        httpStatus,
        duration: Date.now() - startedAt,
      };

      const metaPath = path.join(artifactDir, 'meta.json');
      fs.writeFileSync(metaPath, JSON.stringify(evidence, null, 2), 'utf8');

      return evidence;
    } finally {
      await pool.release(sessionKey);
    }
  }

  // ---- validateStore -------------------------------------------------------
  async validateStore(storeUrl) {
    const available = await this._checkPlaywright();
    if (!available) return this._notAvailable();

    const sessionKey = `store-${Date.now()}`;
    const session = await pool.acquire(sessionKey);
    if (!session) return this._notAvailable();

    const startedAt = Date.now();
    const checks = {};

    try {
      const response = await navigate(session.page, storeUrl);
      checks.httpStatus = { pass: response?.status() === 200, value: response?.status() };

      const title = await session.page.title();
      checks.hasTitle = { pass: title.length > 0, value: title };

      const h1Count = await session.page.locator('h1').count();
      checks.hasH1 = { pass: h1Count > 0, value: h1Count };

      const isHttps = storeUrl.startsWith('https://');
      checks.ssl = { pass: isHttps, value: isHttps ? 'HTTPS' : 'HTTP' };

      const consoleErrors = [];
      session.page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
      // brief wait for deferred scripts
      await session.page.waitForTimeout(1500);
      checks.noConsoleErrors = { pass: consoleErrors.length === 0, value: consoleErrors };

      const failed = Object.entries(checks).filter(([, v]) => !v.pass).map(([k]) => k);
      const status = failed.length === 0 ? 'PASS' : failed.length <= 1 ? 'DEGRADED' : 'FAIL';

      const evidence = await this.captureEvidence(storeUrl, `store-validate-${Date.now()}`);
      this._lastRun = new Date().toISOString();

      return { url: storeUrl, status, checks, evidence, duration: Date.now() - startedAt, timestamp: this._lastRun };
    } finally {
      await pool.release(sessionKey);
    }
  }

  // ---- validateTheme -------------------------------------------------------
  async validateTheme(storeUrl, themeId) {
    const available = await this._checkPlaywright();
    if (!available) return this._notAvailable();

    const { default: ThemeAgent } = await import('./agents/ThemeAgent.mjs');
    const report = await ThemeAgent.runFull(storeUrl);
    const evidence = await this.captureEvidence(storeUrl, `theme-${themeId}-${Date.now()}`);
    this._lastRun = new Date().toISOString();

    return {
      url: storeUrl,
      themeId,
      status: report.overallStatus,
      checks: {
        render: report.renderCheck,
        mobile: report.mobileCheck,
        nav: report.navCheck,
        product: report.productCheck,
        images: report.imageCheck,
        fonts: report.fontCheck,
      },
      evidence,
      duration: report.duration ?? 0,
      timestamp: this._lastRun,
    };
  }

  // ---- validateCheckout ----------------------------------------------------
  async validateCheckout(storeUrl) {
    const available = await this._checkPlaywright();
    if (!available) return this._notAvailable();

    const { default: CheckoutAgent } = await import('./agents/CheckoutAgent.mjs');
    const report = await CheckoutAgent.runFlow(storeUrl, null);
    this._lastRun = new Date().toISOString();

    return {
      url: storeUrl,
      status: report.status,
      checks: report.checks ?? {},
      evidence: report.evidence ?? null,
      duration: report.duration ?? 0,
      timestamp: this._lastRun,
    };
  }

  // ---- runHealthCheck ------------------------------------------------------
  async runHealthCheck(storeUrls = []) {
    const available = await this._checkPlaywright();
    if (!available) return storeUrls.map((url) => ({ url, ...this._notAvailable() }));

    const { default: StoreAgent } = await import('./agents/StoreAgent.mjs');
    const results = [];
    for (const url of storeUrls) {
      try {
        const report = await StoreAgent.runFull(url);
        results.push({ url, status: report.overallStatus, report });
      } catch (err) {
        results.push({ url, status: 'FAIL', error: err.message });
      }
    }
    this._lastRun = new Date().toISOString();
    return results;
  }

  // ---- getStatus -----------------------------------------------------------
  async getStatus() {
    const playwrightInstalled = await this._checkPlaywright();
    return {
      playwrightInstalled: !!playwrightInstalled,
      headless: HEADLESS,
      activeSessions: pool.size,
      lastRun: this._lastRun,
    };
  }
}

export default new BrowserIntelligenceEngine();
