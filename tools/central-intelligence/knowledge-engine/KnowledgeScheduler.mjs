/**
 * KnowledgeScheduler — manages timed refresh schedules for all knowledge sources.
 * Converts per-source refreshIntervalHours into setInterval timers.
 */

import { setInterval, clearInterval } from 'node:timers';
import KnowledgeSourceRegistry from './KnowledgeSourceRegistry.mjs';
import KnowledgeAcquisitionService from './KnowledgeAcquisitionService.mjs';

function ts() {
  return `[${new Date().toISOString()}]`;
}

class KnowledgeScheduler {
  #timers = new Map();   // sourceKey → Timer
  #schedule = new Map(); // sourceKey → {intervalMs, nextRunAt}
  #running = false;

  /**
   * Start the scheduler: registers a setInterval for every source based on
   * its refreshIntervalHours. Safe to call multiple times (idempotent).
   */
  start() {
    if (this.#running) {
      console.log(`${ts()} [KnowledgeScheduler] Already running — ignoring duplicate start()`);
      return;
    }

    this.#running = true;
    const sources = KnowledgeSourceRegistry.getSources();
    console.log(`${ts()} [KnowledgeScheduler] Starting — scheduling ${sources.length} source(s)`);

    for (const src of sources) {
      const intervalMs = src.refreshIntervalHours * 60 * 60 * 1000;
      this.scheduleSource(src.key, intervalMs);
    }
  }

  /**
   * Stop all scheduled timers.
   */
  stop() {
    if (!this.#running) return;

    for (const [key, timer] of this.#timers.entries()) {
      clearInterval(timer);
      console.log(`${ts()} [KnowledgeScheduler] Cleared schedule for '${key}'`);
    }

    this.#timers.clear();
    this.#schedule.clear();
    this.#running = false;
    console.log(`${ts()} [KnowledgeScheduler] Stopped`);
  }

  /**
   * Schedule or reschedule a single source.
   * @param {string} sourceKey
   * @param {number} intervalMs
   */
  scheduleSource(sourceKey, intervalMs) {
    if (this.#timers.has(sourceKey)) {
      clearInterval(this.#timers.get(sourceKey));
    }

    const nextRunAt = new Date(Date.now() + intervalMs).toISOString();
    this.#schedule.set(sourceKey, { intervalMs, nextRunAt });

    const timer = setInterval(async () => {
      console.log(`${ts()} [KnowledgeScheduler] Scheduled refresh firing for '${sourceKey}'`);
      this.#schedule.set(sourceKey, {
        intervalMs,
        nextRunAt: new Date(Date.now() + intervalMs).toISOString(),
      });
      try {
        const result = await KnowledgeAcquisitionService.crawlSource(sourceKey);
        console.log(
          `${ts()} [KnowledgeScheduler] '${sourceKey}' refresh done: ` +
          `${result.documentsAcquired} docs, ${result.errors} errors`,
        );
      } catch (err) {
        console.error(`${ts()} [KnowledgeScheduler] '${sourceKey}' refresh threw: ${err.message}`);
      }
    }, intervalMs);

    // Non-blocking: allow process to exit when all other work is done
    if (timer.unref) timer.unref();

    this.#timers.set(sourceKey, timer);
    console.log(`${ts()} [KnowledgeScheduler] Scheduled '${sourceKey}' every ${intervalMs}ms (next: ${nextRunAt})`);
  }

  /**
   * Return the current schedule snapshot.
   * @returns {Array<{sourceKey:string,nextRunAt:string,intervalMs:number}>}
   */
  getSchedule() {
    return Array.from(this.#schedule.entries()).map(([sourceKey, info]) => ({
      sourceKey,
      nextRunAt: info.nextRunAt,
      intervalMs: info.intervalMs,
    }));
  }

  /**
   * Immediately trigger a crawl for a source outside the normal schedule.
   * @param {string} sourceKey
   * @returns {Promise<{source:string,documentsAcquired:number,errors:number}>}
   */
  async runNow(sourceKey) {
    console.log(`${ts()} [KnowledgeScheduler] runNow('${sourceKey}') triggered`);
    return KnowledgeAcquisitionService.crawlSource(sourceKey);
  }
}

export default new KnowledgeScheduler();
