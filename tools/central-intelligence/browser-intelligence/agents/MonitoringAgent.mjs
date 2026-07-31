/**
 * LCIS Browser Intelligence Engine — MonitoringAgent
 * Continuous store health monitoring with alerting.
 * Uses node:timers for scheduling; StoreAgent + ThemeAgent + CheckoutAgent for checks.
 */

import { setInterval, clearInterval } from 'node:timers';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../../../..');
const ALERTS_FILE = path.join(REPO_ROOT, 'graphify-out', 'alerts.jsonl');

// Alert types
export const AlertType = Object.freeze({
  DOWN: 'DOWN',
  SLOW: 'SLOW',
  CHECKOUT_BROKEN: 'CHECKOUT_BROKEN',
  THEME_ERROR: 'THEME_ERROR',
  SSL_EXPIRED: 'SSL_EXPIRED',
});

// Thresholds
const SLOW_THRESHOLD_MS = 5000;

function ensureAlertsDir() {
  const dir = path.dirname(ALERTS_FILE);
  fs.mkdirSync(dir, { recursive: true });
}

// ---------------------------------------------------------------------------
class MonitoringAgent {
  constructor() {
    /** @type {Map<string, { intervalId: NodeJS.Timer, intervalMs: number, storeUrl: string, lastCheck: object|null }>} */
    this._monitors = new Map();
  }

  // ---- alert ---------------------------------------------------------------
  alert(storeUrl, type, details) {
    if (!Object.values(AlertType).includes(type)) {
      throw new Error(`Unknown alert type: ${type}. Valid types: ${Object.keys(AlertType).join(', ')}`);
    }

    const entry = {
      storeUrl,
      type,
      details,
      timestamp: new Date().toISOString(),
    };

    // stdout
    const prefix = `[LCIS-ALERT][${type}]`;
    console.log(`${prefix} ${storeUrl} — ${JSON.stringify(details)}`);

    // append to JSONL
    ensureAlertsDir();
    fs.appendFileSync(ALERTS_FILE, JSON.stringify(entry) + '\n', 'utf8');

    return entry;
  }

  // ---- runAllChecks --------------------------------------------------------
  async runAllChecks(storeUrl) {
    // Lazy imports to avoid circular dependency issues and keep startup fast
    const [
      { default: StoreAgent },
      { default: ThemeAgent },
      { default: CheckoutAgent },
    ] = await Promise.all([
      import('./StoreAgent.mjs'),
      import('./ThemeAgent.mjs'),
      import('./CheckoutAgent.mjs'),
    ]);

    const start = Date.now();

    const [storeResult, themeResult, checkoutResult] = await Promise.allSettled([
      StoreAgent.runFull(storeUrl),
      ThemeAgent.runFull(storeUrl),
      CheckoutAgent.runFlow(storeUrl, null),
    ]);

    const settle = (r) =>
      r.status === 'fulfilled' ? r.value : { overallStatus: 'FAIL', status: 'FAIL', error: r.reason?.message };

    const store = settle(storeResult);
    const theme = settle(themeResult);
    const checkout = settle(checkoutResult);

    // ── Alert evaluation ────────────────────────────────────────────────────

    // DOWN: store homepage unreachable
    if (store.overallStatus === 'FAIL' && store.homepage?.httpStatus !== 200) {
      this.alert(storeUrl, AlertType.DOWN, {
        reason: 'Homepage returned non-200 or failed',
        httpStatus: store.homepage?.httpStatus,
      });
    }

    // SLOW: page load > threshold
    if (store.pageSpeed?.loadTimeMs > SLOW_THRESHOLD_MS) {
      this.alert(storeUrl, AlertType.SLOW, {
        loadTimeMs: store.pageSpeed.loadTimeMs,
        thresholdMs: SLOW_THRESHOLD_MS,
      });
    }

    // CHECKOUT_BROKEN
    if (checkout.status === 'FAIL') {
      this.alert(storeUrl, AlertType.CHECKOUT_BROKEN, {
        failedChecks: checkout.failedChecks,
      });
    }

    // THEME_ERROR
    if (theme.overallStatus === 'FAIL') {
      this.alert(storeUrl, AlertType.THEME_ERROR, {
        failedChecks: theme.failedChecks,
      });
    }

    // SSL_EXPIRED
    if (store.ssl?.pass === false) {
      this.alert(storeUrl, AlertType.SSL_EXPIRED, {
        sslError: store.ssl?.sslError,
        isHttps: store.ssl?.isHttps,
      });
    }

    return {
      storeUrl,
      timestamp: new Date().toISOString(),
      duration: Date.now() - start,
      store,
      theme,
      checkout,
      overallStatus:
        store.overallStatus === 'PASS' && theme.overallStatus === 'PASS' && checkout.status === 'PASS'
          ? 'PASS'
          : store.overallStatus === 'FAIL' || checkout.status === 'FAIL'
          ? 'FAIL'
          : 'DEGRADED',
    };
  }

  // ---- monitorStore --------------------------------------------------------
  async monitorStore(storeUrl, intervalMs = 60_000) {
    if (this._monitors.has(storeUrl)) {
      console.log(`[LCIS-MONITOR] Already monitoring ${storeUrl} — call stopMonitoring first to change interval`);
      return this._monitors.get(storeUrl);
    }

    const entry = {
      storeUrl,
      intervalMs,
      lastCheck: null,
      startedAt: new Date().toISOString(),
    };

    // Run immediately, then on interval
    const runCheck = async () => {
      try {
        entry.lastCheck = await this.runAllChecks(storeUrl);
        console.log(
          `[LCIS-MONITOR] ${storeUrl} → ${entry.lastCheck.overallStatus} (${entry.lastCheck.duration}ms)`
        );
      } catch (err) {
        console.error(`[LCIS-MONITOR] Error checking ${storeUrl}:`, err.message);
        this.alert(storeUrl, AlertType.DOWN, { error: err.message });
      }
    };

    // Kick off first check without blocking the caller
    runCheck().catch(() => {});

    entry.intervalId = setInterval(runCheck, intervalMs);
    // Allow Node to exit even if monitor is active (caller manages lifecycle)
    if (entry.intervalId.unref) entry.intervalId.unref();

    this._monitors.set(storeUrl, entry);
    console.log(`[LCIS-MONITOR] Started monitoring ${storeUrl} every ${intervalMs}ms`);
    return entry;
  }

  // ---- stopMonitoring ------------------------------------------------------
  stopMonitoring(storeUrl) {
    const entry = this._monitors.get(storeUrl);
    if (!entry) {
      console.warn(`[LCIS-MONITOR] No active monitor for ${storeUrl}`);
      return false;
    }
    clearInterval(entry.intervalId);
    this._monitors.delete(storeUrl);
    console.log(`[LCIS-MONITOR] Stopped monitoring ${storeUrl}`);
    return true;
  }

  // ---- getMonitoringStatus -------------------------------------------------
  getMonitoringStatus() {
    const monitors = [];
    for (const [storeUrl, entry] of this._monitors) {
      monitors.push({
        storeUrl,
        intervalMs: entry.intervalMs,
        startedAt: entry.startedAt,
        lastCheck: entry.lastCheck
          ? {
              timestamp: entry.lastCheck.timestamp,
              overallStatus: entry.lastCheck.overallStatus,
              duration: entry.lastCheck.duration,
            }
          : null,
      });
    }
    return {
      activeMonitors: monitors.length,
      monitors,
      alertsFile: ALERTS_FILE,
    };
  }
}

export default new MonitoringAgent();
