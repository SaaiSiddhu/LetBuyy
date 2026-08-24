import {
  createSupabaseServiceClient,
  type SupabaseServiceEnv,
} from '@letbuyy/infrastructure/supabase-adapter';
import {
  writeRuntimeTelemetryDataPoint,
  type RuntimeTelemetryDatasetBinding,
} from '@letbuyy/infrastructure/runtime-telemetry-adapter';

// Phase O1: emits the six database-derived SLIs infrastructure/monitoring/
// slo-catalog.yaml defines -- the EMISSION half only. This does not make any
// SLO "MEASURED": reading Analytics Engine back out needs Cloudflare API
// credentials this repository does not have, and every emitted SLO's
// errorBudgetPolicy implies a detection window (1h burn-rate, 15m p95, or
// "immediately") this 6-hourly cron structurally cannot serve. See
// docs/evidence/production-readiness/2026-08-24-readiness-evidence.md
// Dimension 10 and SKIP-CAP-SLO-TELEMETRY-WIRING for the honest framing.
//
// Deliberately NOT emitted: deployment-gate-success (zero writers to
// deployment_health_gate_results anywhere in the codebase -- would always
// emit sample_size=0, which serves no one) and
// tenant-isolation-zero-cross-tenant-rows (the catalog itself records this
// as not measurable via a database rollup -- needs a scheduled red-team
// probe, SKIP-CAP-TENANT-REDTEAM-ADOPTION, not a count query).
//
// Read-only throughout: every query below is a SELECT/count against an
// existing commerce table. Nothing is written back to the commerce
// database -- results go only to RUNTIME_TELEMETRY, per CLAUDE.md's "keep
// observability off the transactional commerce database."

export interface SloTelemetryEmitterEnv extends SupabaseServiceEnv {
  RUNTIME_TELEMETRY?: RuntimeTelemetryDatasetBinding;
  RUNTIME_NAME?: string;
  DEPLOYMENT_ENV?: string;
  TELEMETRY_ENV?: string;
  ENVIRONMENT?: string;
  PRIMARY_REGION?: string;
}

export interface SloTelemetryEmitterInput {
  requestId: string;
  /** Injectable clock for tests; defaults to the real current time. */
  now?: () => Date;
}

export type SloEmissionOutcome = 'emitted' | 'skipped_empty_window' | 'query_failed';

export interface SloEmissionResult {
  slo: string;
  outcome: SloEmissionOutcome;
  sampleSize: number;
  value: number | null;
  error?: string;
}

const OUTBOX_LAG_FETCH_LIMIT = 5000;

function windowStartIso(now: Date, days: number): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Computes a success-ratio SLI (successful / total) over a time window using
 * two lightweight COUNT queries -- never fetches row bodies. Returns null
 * sampleSize/value on a genuinely empty window, distinct from a query error
 * (which throws and is caught by the caller).
 */
async function computeSuccessRatio(
  db: ReturnType<typeof createSupabaseServiceClient>,
  table: string,
  statusColumn: string,
  successValues: string[],
  sinceIso: string,
  extraFilter?: { column: string; value: string },
): Promise<{ total: number; successful: number }> {
  let totalQuery = db.from(table).select('id', { count: 'exact', head: true }).gte('created_at', sinceIso);
  let successQuery = db.from(table).select('id', { count: 'exact', head: true }).gte('created_at', sinceIso).in(statusColumn, successValues);

  if (extraFilter) {
    totalQuery = totalQuery.eq(extraFilter.column, extraFilter.value);
    successQuery = successQuery.eq(extraFilter.column, extraFilter.value);
  }

  const [totalResult, successResult] = await Promise.all([totalQuery, successQuery]);

  if (totalResult.error) throw new Error(`${table} total count failed: ${totalResult.error.message}`);
  if (successResult.error) throw new Error(`${table} success count failed: ${successResult.error.message}`);

  return {
    total: totalResult.count ?? 0,
    successful: successResult.count ?? 0,
  };
}

interface OutboxLagRow {
  created_at: string;
  dispatched_at: string | null;
}

/**
 * Nearest-rank p95 over a bounded, explicitly-limited row fetch (never an
 * unbounded scan). Returns null when the window has zero eligible rows --
 * the caller must not treat that the same as a genuine zero-latency p95.
 */
export function computeP95Ms(deltasMs: number[]): number | null {
  if (deltasMs.length === 0) return null;
  const sorted = [...deltasMs].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil(0.95 * sorted.length) - 1));
  return sorted[rank];
}

async function computeOutboxLagP95(
  db: ReturnType<typeof createSupabaseServiceClient>,
  sinceIso: string,
): Promise<{ p95Ms: number | null; sampleSize: number; truncated: boolean }> {
  const { data, error } = await db
    .from('outbox_events')
    .select('created_at, dispatched_at')
    .eq('status', 'processed')
    .gte('created_at', sinceIso)
    .not('dispatched_at', 'is', null)
    .order('created_at', { ascending: true })
    .limit(OUTBOX_LAG_FETCH_LIMIT);

  if (error) throw new Error(`outbox_events lag fetch failed: ${error.message}`);

  const rows = (data || []) as OutboxLagRow[];
  const deltasMs = rows
    .map((row) => (row.dispatched_at ? new Date(row.dispatched_at).getTime() - new Date(row.created_at).getTime() : null))
    .filter((value): value is number => value !== null && Number.isFinite(value) && value >= 0);

  return {
    p95Ms: computeP95Ms(deltasMs),
    sampleSize: deltasMs.length,
    truncated: rows.length >= OUTBOX_LAG_FETCH_LIMIT,
  };
}

function emitPercentageSlo(
  env: SloTelemetryEmitterEnv,
  runtimeName: string,
  deploymentEnv: string,
  telemetryEnv: string,
  requestId: string,
  sloName: string,
  windowLabel: string,
  total: number,
  successful: number,
  computedAtIso: string,
): SloEmissionResult {
  if (total === 0) {
    return { slo: sloName, outcome: 'skipped_empty_window', sampleSize: 0, value: null };
  }

  const successRatePercent = (successful / total) * 100;

  writeRuntimeTelemetryDataPoint(env.RUNTIME_TELEMETRY, {
    metricName: `letbuyy.slo.${sloName}`,
    runtimeName,
    environment: env.ENVIRONMENT,
    deploymentEnv,
    telemetryEnv,
    requestId,
    index: sloName,
    blobs: [sloName, windowLabel, computedAtIso],
    // [value, sampleSize, successfulCount] -- sampleSize is what lets a
    // reader distinguish "0% because 0/1000 failed" from "no data": a
    // genuinely empty window is never emitted at all (see the total===0
    // branch above), so any emitted point here has sampleSize > 0 by
    // construction, not merely a non-NaN doubles[0].
    doubles: [successRatePercent, total, successful],
  });

  return { slo: sloName, outcome: 'emitted', sampleSize: total, value: successRatePercent };
}

export async function runSloTelemetryEmitter(
  env: SloTelemetryEmitterEnv,
  input: SloTelemetryEmitterInput,
): Promise<{ results: SloEmissionResult[]; request_id: string }> {
  const now = (input.now ?? (() => new Date()))();
  const computedAtIso = now.toISOString();
  const db = createSupabaseServiceClient(env);
  const runtimeName = env.RUNTIME_NAME || 'Queue Workers';
  const deploymentEnv = env.DEPLOYMENT_ENV || env.ENVIRONMENT || 'unknown';
  const telemetryEnv = env.TELEMETRY_ENV || env.ENVIRONMENT || 'unknown';

  const results: SloEmissionResult[] = [];

  // Each SLI is independently try/caught so one failing query cannot take
  // down a sibling emission or the scheduled handler itself.

  try {
    const { total, successful } = await computeSuccessRatio(
      db, 'checkout_sessions', 'status', ['completed'], windowStartIso(now, 30),
    );
    results.push(emitPercentageSlo(
      env, runtimeName, deploymentEnv, telemetryEnv, input.requestId,
      'checkout-order-creation-success', '30d', total, successful, computedAtIso,
    ));
  } catch (error) {
    results.push({
      slo: 'checkout-order-creation-success', outcome: 'query_failed', sampleSize: 0, value: null,
      error: error instanceof Error ? error.message : 'unknown error',
    });
  }

  try {
    const { total, successful } = await computeSuccessRatio(
      db, 'payment_transactions', 'status', ['captured', 'completed'], windowStartIso(now, 30),
    );
    results.push(emitPercentageSlo(
      env, runtimeName, deploymentEnv, telemetryEnv, input.requestId,
      'payment-capture-confirmation-success', '30d', total, successful, computedAtIso,
    ));
  } catch (error) {
    results.push({
      slo: 'payment-capture-confirmation-success', outcome: 'query_failed', sampleSize: 0, value: null,
      error: error instanceof Error ? error.message : 'unknown error',
    });
  }

  try {
    const { total, successful } = await computeSuccessRatio(
      db, 'payment_webhook_events', 'signature_valid', ['true'], windowStartIso(now, 7),
      { column: 'provider', value: 'razorpay' },
    );
    results.push(emitPercentageSlo(
      env, runtimeName, deploymentEnv, telemetryEnv, input.requestId,
      'razorpay-webhook-signature-verification', '7d', total, successful, computedAtIso,
    ));
  } catch (error) {
    results.push({
      slo: 'razorpay-webhook-signature-verification', outcome: 'query_failed', sampleSize: 0, value: null,
      error: error instanceof Error ? error.message : 'unknown error',
    });
  }

  try {
    const { p95Ms, sampleSize, truncated } = await computeOutboxLagP95(db, windowStartIso(now, 1));

    if (sampleSize === 0 || p95Ms === null) {
      results.push({ slo: 'outbox-event-processing-lag', outcome: 'skipped_empty_window', sampleSize: 0, value: null });
    } else {
      writeRuntimeTelemetryDataPoint(env.RUNTIME_TELEMETRY, {
        metricName: 'letbuyy.slo.outbox-event-processing-lag',
        runtimeName,
        environment: env.ENVIRONMENT,
        deploymentEnv,
        telemetryEnv,
        requestId: input.requestId,
        index: 'outbox-event-processing-lag',
        blobs: [
          'outbox-event-processing-lag',
          '24h',
          computedAtIso,
          truncated ? 'truncated' : 'complete',
        ],
        doubles: [p95Ms, sampleSize],
      });
      results.push({ slo: 'outbox-event-processing-lag', outcome: 'emitted', sampleSize, value: p95Ms });
    }
  } catch (error) {
    results.push({
      slo: 'outbox-event-processing-lag', outcome: 'query_failed', sampleSize: 0, value: null,
      error: error instanceof Error ? error.message : 'unknown error',
    });
  }

  return { results, request_id: input.requestId };
}
