/**
 * LCIS Phase 22 — CapacityForecaster
 *
 * Forecasts capacity limits and saturation risk from structural topology.
 *
 * HONESTY CONTRACT
 * ────────────────
 * Structural ceilings (Cloudflare Workers max concurrent requests, Supabase
 * pooler connection limits, queue consumer concurrency, DB connection model)
 * ARE CONNECTED — derived from wrangler configs, package.json topology, and
 * infra-intel.json.
 *
 * Current utilization (active connections, live queue depth, live request
 * rates, live CPU/memory) is NOT CONNECTED — the exact sources are stated
 * for each dimension and never fabricated.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const GRAPHIFY_OUT = resolve(REPO_ROOT, 'graphify-out');

// ── Cloudflare Workers structural limits ────────────────────────────────────
// Source: https://developers.cloudflare.com/workers/platform/limits/
const CF_WORKER_LIMITS = {
  maxConcurrentRequests: 1000,     // per-worker global concurrent limit (free plan: 6 subreqs, paid: unlimited)
  maxCPUTimeMs: 30000,             // Workers Paid: 30s CPU time per invocation
  maxScriptSizeBytes: 5 * 1024 * 1024, // 5 MB compressed
  maxEnvVarSizeBytes: 5120,        // per env var
  maxQueueMessageBytes: 128 * 1024, // 128 KB per message
  maxQueueBatchSize: 100,          // messages per batch
  maxQueueRetries: 3,              // default retry limit
};

// ── Supabase/Postgres structural limits ─────────────────────────────────────
// Source: Supabase pooler defaults (PgBouncer transaction mode)
const SUPABASE_LIMITS = {
  poolerConnectionLimit: 60,       // PgBouncer default max_client_conn
  directConnectionLimit: 100,      // Postgres max_connections for free/pro
  connectionTimeoutMs: 30000,
  queryTimeoutMs: 8000,            // Supabase enforced default
  statementTimeoutMs: 8000,
};

// ── Helpers ────────────────────────────────────────────────────────────────

function readOut(name) {
  try {
    const p = resolve(GRAPHIFY_OUT, name);
    if (!existsSync(p)) return null;
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch { return null; }
}

function round2(v) { return Math.round(v * 100) / 100; }

// ── CapacityForecaster class ───────────────────────────────────────────────

class CapacityForecaster {

  /**
   * Overall capacity outlook from topology.
   * Combines queue, database, and worker forecasts into a ranked risk list.
   *
   * @returns {Promise<{
   *   summary: object,
   *   queues: object,
   *   database: object,
   *   workers: object,
   *   risks: object[],
   *   generatedAt: string,
   *   note: string
   * }>}
   */
  async forecast() {
    const [queueResult, dbResult, workerResult] = await Promise.allSettled([
      this.forecastQueueSaturation(),
      this.forecastDatabaseCapacity(),
      this.forecastWorkerCapacity(),
    ]);

    const queues = queueResult.status === 'fulfilled' ? queueResult.value : { error: queueResult.reason?.message };
    const database = dbResult.status === 'fulfilled' ? dbResult.value : { error: dbResult.reason?.message };
    const workers = workerResult.status === 'fulfilled' ? workerResult.value : { error: workerResult.reason?.message };

    const risks = await this.getCapacityRisks({ queues, database, workers });

    return {
      summary: {
        queueRisk: queues.saturationRisk ?? 'UNKNOWN',
        databaseRisk: database.saturationRisk ?? 'UNKNOWN',
        workerRisk: workers.saturationRisk ?? 'UNKNOWN',
        overallRisk: risks[0]?.severity ?? 'UNKNOWN',
        connectedDimensions: [
          queues.connected ? 'queue-topology' : null,
          database.connected ? 'db-topology' : null,
          workers.connected ? 'worker-topology' : null,
        ].filter(Boolean),
        liveUtilizationConnected: false,
        liveUtilizationSource: 'Cloudflare Analytics Engine (queue depth, worker invocations, error rate) + Supabase dashboard (pg_stat_activity)',
      },
      queues,
      database,
      workers,
      risks,
      generatedAt: new Date().toISOString(),
      note: 'Structural ceilings CONNECTED from wrangler.toml + infra-intel.json. ' +
        'Current utilization NOT CONNECTED — sources stated per dimension.',
    };
  }

  /**
   * Forecast queue saturation risk from structural topology.
   *
   * Structural (CONNECTED):
   *   - Number of queues, producers, consumers from infra-intel.json
   *   - Cloudflare Queue limits (max batch size, max message size)
   *   - Single dead-letter queue (SPOF for failed messages)
   *
   * Live (NOT CONNECTED):
   *   - Current queue depth
   *   - Current throughput (messages/sec)
   *   - DLQ accumulation rate
   *   Source: Cloudflare Analytics Engine / Workers Observability API
   *
   * @returns {Promise<object>}
   */
  async forecastQueueSaturation() {
    const infra = readOut('infra-intel.json');
    if (!infra) {
      return {
        connected: false,
        saturationRisk: 'UNKNOWN',
        note: 'infra-intel.json not found — run pnpm graph:infra to extract topology.',
        liveUtilizationConnected: false,
        liveUtilizationSource: 'Cloudflare Analytics Engine queue depth metrics',
      };
    }

    const producers = infra.summary?.queueProducers ?? [];
    const consumers = infra.summary?.queueConsumers ?? [];
    const workerCount = infra.summary?.workers ?? 0;

    // Structural ceiling: one CF queue consumer processes up to maxQueueBatchSize messages per batch.
    // With N consumers and one dead-letter queue, the structural throughput ceiling is:
    //   consumers.length × CF_WORKER_LIMITS.maxQueueBatchSize messages/invocation
    const throughputCeiling = consumers.length * CF_WORKER_LIMITS.maxQueueBatchSize;

    // SPOF analysis: dead-letter queue is a structural SPOF if there's only one DLQ
    const dlqCount = consumers.filter((c) => c.toLowerCase().includes('dead')).length;
    const hasDlqSpof = dlqCount <= 1;

    // Imbalance: more producers than consumers is a structural risk
    const producerConsumerRatio = consumers.length > 0 ? round2(producers.length / consumers.length) : null;
    const imbalanceRisk = producerConsumerRatio !== null && producerConsumerRatio > 2;

    // Structural saturation risk: HIGH if imbalance or single DLQ + many producers
    const saturationRisk = imbalanceRisk || (hasDlqSpof && producers.length > 3) ? 'HIGH'
      : hasDlqSpof ? 'MEDIUM'
      : 'LOW';

    return {
      connected: true,
      saturationRisk,
      structural: {
        queueProducers: producers,
        queueConsumers: consumers,
        producerCount: producers.length,
        consumerCount: consumers.length,
        producerConsumerRatio,
        dlqCount,
        hasDlqSpof,
        imbalanceRisk,
        throughputCeiling,
        cfLimits: {
          maxQueueBatchSize: CF_WORKER_LIMITS.maxQueueBatchSize,
          maxQueueMessageBytes: CF_WORKER_LIMITS.maxQueueMessageBytes,
          maxQueueRetries: CF_WORKER_LIMITS.maxQueueRetries,
        },
      },
      liveUtilizationConnected: false,
      liveUtilizationSource: 'Cloudflare Analytics Engine → queue_depth, queue_throughput, dlq_accumulation_rate (NOT CONNECTED — source: wrangler tail or Cloudflare dash → Workers & Queues → Analytics)',
      risks: [
        imbalanceRisk ? `Producer/consumer imbalance (ratio ${producerConsumerRatio}) — queue backlog risk at high throughput` : null,
        hasDlqSpof ? `Single DLQ (${dlqCount} dead-letter queue) — structural SPOF for failed message recovery` : null,
        producers.length === 0 ? 'No queue producers detected — check wrangler.toml [[queues.producers]]' : null,
      ].filter(Boolean),
      note: `Queue structural topology: ${producers.length} producers, ${consumers.length} consumers. ` +
        `Throughput ceiling: ${throughputCeiling} msgs/invocation. ` +
        `Live queue depth NOT CONNECTED — source: Cloudflare Analytics Engine.`,
    };
  }

  /**
   * Forecast database capacity risk from structural topology.
   *
   * Structural (CONNECTED):
   *   - Supabase PgBouncer connection model (transaction mode, 60 max client conn)
   *   - Hyperdrive binding presence (connection pooling at CF edge)
   *   - DB-intel.json table / RLS / index / trigger counts
   *
   * Live (NOT CONNECTED):
   *   - pg_stat_activity active connection count
   *   - Table bloat / index hit rate
   *   - Query latency p95/p99
   *   Source: Supabase dashboard → Database → pg_stat_activity view,
   *           or direct SQL: SELECT count(*) FROM pg_stat_activity
   *
   * @returns {Promise<object>}
   */
  async forecastDatabaseCapacity() {
    const infra = readOut('infra-intel.json');
    const dbIntel = readOut('db-intel.json');

    const hasHyperdrive = infra?.summary?.hyperdrive === true;
    const tableCount = dbIntel?.summary?.tables ?? dbIntel?.tables?.length ?? null;
    const rpcCount = dbIntel?.summary?.rpcs ?? dbIntel?.rpcs?.length ?? null;
    const policyCount = dbIntel?.summary?.policies ?? dbIntel?.policies?.length ?? null;
    const indexCount = dbIntel?.summary?.indexes ?? dbIntel?.indexes?.length ?? null;
    const triggerCount = dbIntel?.summary?.triggers ?? dbIntel?.triggers?.length ?? null;

    const connected = !!(infra || dbIntel);

    // Schema complexity → structural read pressure proxy
    // High table count + high trigger count = more write amplification
    const schemaComplexity = tableCount !== null
      ? (tableCount > 200 ? 'HIGH' : tableCount > 80 ? 'MEDIUM' : 'LOW')
      : 'UNKNOWN';

    // Connection model risk: without Hyperdrive, every Vercel/Next.js serverless
    // function opens a direct Postgres connection → connection exhaustion risk
    // at scale. With Hyperdrive, pooling happens at the CF edge.
    const connectionModelRisk = hasHyperdrive ? 'MITIGATED (Hyperdrive pools at CF edge)' : 'HIGH (direct connections — no edge pooling)';

    // Trigger amplification: many triggers per table increase write latency
    const writePressureRisk = (triggerCount ?? 0) > 400 ? 'HIGH'
      : (triggerCount ?? 0) > 100 ? 'MEDIUM'
      : 'LOW';

    const saturationRisk = !hasHyperdrive ? 'HIGH'
      : schemaComplexity === 'HIGH' ? 'MEDIUM'
      : 'LOW';

    return {
      connected,
      saturationRisk,
      structural: {
        hasHyperdrive,
        tableCount,
        rpcCount,
        policyCount,
        indexCount,
        triggerCount,
        schemaComplexity,
        connectionModelRisk,
        writePressureRisk,
        supabaseLimits: SUPABASE_LIMITS,
      },
      liveUtilizationConnected: false,
      liveUtilizationSource: 'Supabase dashboard → Database → pg_stat_activity (active connections) + pg_stat_user_tables (bloat) + query_performance (p95 latency). NOT CONNECTED — credential: SUPABASE_SERVICE_ROLE_KEY (deploy-time only).',
      risks: [
        !hasHyperdrive ? 'No Hyperdrive detected — direct Postgres connections from serverless functions will exhaust max_connections at scale' : null,
        schemaComplexity === 'HIGH' ? `High schema complexity (${tableCount} tables) — read pressure and RLS policy evaluation overhead at scale` : null,
        writePressureRisk === 'HIGH' ? `High trigger count (${triggerCount}) — write amplification risk at high order/payment volumes` : null,
        (rpcCount ?? 0) > 100 ? `Large RPC surface (${rpcCount} RPCs) — ensure all money RPCs use idempotency_key + FOR UPDATE` : null,
      ].filter(Boolean),
      note: `Database capacity from structural topology: ${tableCount ?? '?'} tables, ${triggerCount ?? '?'} triggers, ${policyCount ?? '?'} RLS policies. ` +
        `Connection ceiling: ${SUPABASE_LIMITS.poolerConnectionLimit} (PgBouncer) / ${SUPABASE_LIMITS.directConnectionLimit} (direct). ` +
        `Live pg_stat_activity NOT CONNECTED.`,
    };
  }

  /**
   * Forecast worker capacity from structural topology.
   *
   * Structural (CONNECTED):
   *   - Worker count from wrangler configs (infra-intel.json)
   *   - Cron schedule density
   *   - Queue consumer binding count
   *   - Cloudflare Workers concurrency limits
   *
   * Live (NOT CONNECTED):
   *   - Active invocations per worker
   *   - CPU time p95 per invocation
   *   - Error rate / subrequest latency
   *   Source: Cloudflare Analytics Engine → workers_analytics_engine binding
   *           or wrangler tail (real-time log stream)
   *
   * @returns {Promise<object>}
   */
  async forecastWorkerCapacity() {
    const infra = readOut('infra-intel.json');

    if (!infra) {
      return {
        connected: false,
        saturationRisk: 'UNKNOWN',
        note: 'infra-intel.json not found — run pnpm graph:infra.',
        liveUtilizationConnected: false,
        liveUtilizationSource: 'Cloudflare Workers Analytics Engine',
      };
    }

    const workers = infra.workers ?? [];
    const workerCount = workers.length;
    const cronSchedules = workers.flatMap((w) => w.crons ?? []);
    const queueConsumerWorkers = workers.filter((w) => (w.queueConsumers ?? []).length > 0);

    // Cron density risk: if a cron fires every hour or more frequently across
    // multiple workers, it's a capacity concern at low-request idle periods
    const highFreqCrons = cronSchedules.filter((c) => {
      // Parse the minute field: "*/N" where N <= 60 → frequency concern
      const parts = c.split(' ');
      if (parts.length < 1) return false;
      const minutePart = parts[0];
      if (minutePart === '*') return true;
      const stepMatch = minutePart.match(/^\*\/(\d+)$/);
      if (stepMatch) return parseInt(stepMatch[1], 10) <= 30;
      return false;
    });

    // Structural capacity ceiling
    const concurrencyCeiling = workerCount * CF_WORKER_LIMITS.maxConcurrentRequests;

    // Risk: queue consumer workers are long-lived → higher CPU ceiling risk
    const saturationRisk = queueConsumerWorkers.length === 0 && cronSchedules.length > 3 ? 'MEDIUM'
      : workerCount === 0 ? 'UNKNOWN'
      : 'LOW';

    return {
      connected: true,
      saturationRisk,
      structural: {
        workerCount,
        workers: workers.map((w) => ({
          name: w.name,
          file: w.file,
          queueConsumers: w.queueConsumers ?? [],
          queueProducers: w.queueProducers ?? [],
          crons: w.crons ?? [],
          bindings: w.bindings ?? [],
        })),
        cronSchedules,
        highFreqCrons,
        queueConsumerWorkerCount: queueConsumerWorkers.length,
        concurrencyCeiling,
        cfLimits: {
          maxConcurrentRequests: CF_WORKER_LIMITS.maxConcurrentRequests,
          maxCPUTimeMs: CF_WORKER_LIMITS.maxCPUTimeMs,
          maxScriptSizeBytes: CF_WORKER_LIMITS.maxScriptSizeBytes,
        },
      },
      liveUtilizationConnected: false,
      liveUtilizationSource: 'Cloudflare Analytics Engine (worker_invocations, cpu_time_p95, error_rate) via RUNTIME_TELEMETRY binding OR wrangler tail --format=json. NOT CONNECTED — source credential: Cloudflare API token (deploy-time).',
      risks: [
        highFreqCrons.length > 0 ? `${highFreqCrons.length} high-frequency cron(s) (≤30min interval) — CPU budget risk at peak` : null,
        queueConsumerWorkers.length === 0 ? 'No queue consumer workers detected — queue messages may accumulate unprocessed' : null,
        workerCount === 1 ? 'Single worker handles all workloads (api-gateway) — no horizontal isolation between request types' : null,
      ].filter(Boolean),
      note: `Worker capacity from ${workerCount} wrangler.toml file(s). ` +
        `Concurrency ceiling: ${concurrencyCeiling.toLocaleString()} concurrent requests (${workerCount} workers × ${CF_WORKER_LIMITS.maxConcurrentRequests}). ` +
        `Live invocation metrics NOT CONNECTED.`,
    };
  }

  /**
   * Return a ranked list of capacity risks across all dimensions.
   *
   * @param {{ queues?: object, database?: object, workers?: object }} [dimensions]
   * @returns {Promise<object[]>}
   */
  async getCapacityRisks(dimensions) {
    const dims = dimensions ?? await this.forecast().then((r) => ({
      queues: r.queues, database: r.database, workers: r.workers,
    }));

    const risks = [];

    // Collect from each dimension
    const addRisks = (source, dimResult) => {
      if (!dimResult || dimResult.error) return;
      for (const r of (dimResult.risks ?? [])) {
        if (r) {
          risks.push({
            source,
            severity: dimResult.saturationRisk ?? 'MEDIUM',
            description: r,
            connected: dimResult.connected,
          });
        }
      }
    };

    addRisks('queue', dims.queues);
    addRisks('database', dims.database);
    addRisks('worker', dims.workers);

    // Sort by severity
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, UNKNOWN: 4 };
    risks.sort((a, b) => (order[a.severity] ?? 4) - (order[b.severity] ?? 4));

    return risks;
  }
}

export default new CapacityForecaster();
