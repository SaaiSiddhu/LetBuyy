#!/usr/bin/env node
// LCIS Omega — Telemetry Intelligence (Phase 6). Defines the telemetry INGESTION ARCHITECTURE +
// per-source ADAPTERS (Cloudflare / Vercel / Supabase / Resend / Razorpay). All metric VALUES are
// query-bound — this engine wires WHERE/HOW to read them, and ingests graphify-out/runtime-metrics.json
// if an operator drops a snapshot. No values are fabricated.
import { loadIntel, g, writeOut, LIVE, nowStamp } from './omega-lib.mjs';

// adapter = how LCIS would ingest each metric source (read API / binding / CLI).
const ADAPTERS = [
  { source: 'Cloudflare Analytics Engine', metrics: ['latency', 'errors', 'requests', 'cpu', 'cold-starts'], adapter: 'Analytics Engine SQL API (GraphQL) over RUNTIME_TELEMETRY dataset', binding: 'RUNTIME_TELEMETRY', auth: 'CF API token' },
  { source: 'Workers (runtime)', metrics: ['invocations', 'errors', 'subrequest count'], adapter: '`wrangler tail <worker>` stream + [observability.logs]', binding: 'observability', auth: 'wrangler' },
  { source: 'Cloudflare Queues', metrics: ['backlog', 'retries', 'dead-letters', 'throughput'], adapter: 'Queues metrics API + dead-letter queue inspection', binding: 'queue consumers/DLQ', auth: 'CF API token' },
  { source: 'Cron', metrics: ['last-run', 'success', 'duration'], adapter: 'Workers cron trigger logs', binding: '[triggers] crons', auth: 'wrangler' },
  { source: 'Deployment', metrics: ['live worker version', 'Vercel build id', 'applied migration'], adapter: 'Cloudflare + Vercel + Supabase deploy APIs', binding: 'deploy APIs', auth: 'provider tokens' },
  { source: 'API (gateway)', metrics: ['route latency', 'status codes', 'rate-limit hits'], adapter: 'Analytics Engine per-route + logs', binding: 'RUNTIME_TELEMETRY', auth: 'CF API token' },
  { source: 'Webhook', metrics: ['delivery success', 'signature failures', 'retries'], adapter: 'webhook_deliveries table + webhook-service logs', binding: 'webhook_deliveries', auth: 'Supabase' },
  { source: 'Database (Supabase)', metrics: ['query latency', 'connections', 'db size', 'slow queries'], adapter: 'Supabase metrics + pg_stat_statements', binding: 'Supabase project', auth: 'Supabase service role' },
  { source: 'Resend (email)', metrics: ['delivered', 'bounced', 'complained'], adapter: 'Resend API + webhook events', binding: 'RESEND_API_KEY', auth: 'Resend key' },
  { source: 'Razorpay (payments)', metrics: ['captured', 'failed', 'settlement status'], adapter: 'Razorpay API + payment_webhook_events', binding: 'payment_webhook_events', auth: 'Razorpay key (server-side)' },
  { source: 'Merchant metrics', metrics: ['per-site GMV / orders / health'], adapter: 'SQL aggregation over site-scoped tables (see merchant-* engines)', binding: 'Supabase', auth: 'service role + verifySiteOwnership' },
  { source: 'Customer metrics', metrics: ['funnel / conversion / retention'], adapter: 'analytics_event_stream aggregation', binding: 'analytics_event_stream', auth: 'Supabase' },
];

export function buildTelemetryIntelligence() {
  const { db, infra } = loadIntel();
  const snapshot = g('runtime-metrics.json'); // operator-provided; never fabricated
  const ingestion = {
    contract: 'Each adapter reads its source live. To feed LCIS offline, an operator drops a snapshot at graphify-out/runtime-metrics.json keyed by metric (errorsByWorker, latencyByWorker, queueDepth, errorsByRoute, …).',
    snapshotPresent: !!snapshot,
    snapshotKeys: snapshot ? Object.keys(snapshot) : [],
    realBindingsInRepo: { runtimeTelemetry: infra ? true : null, observability: true, deadLetterQueues: (infra?.summary.queueConsumers || []).filter((q) => /dead.?letter/i.test(q)) },
  };
  return { summary: { sources: ADAPTERS.length, metricsCovered: ADAPTERS.reduce((a, x) => a + x.metrics.length, 0), liveSnapshot: !!snapshot, allValues: LIVE,
    liveDataNote: 'Every telemetry VALUE is query-bound via its adapter; the repo declares the bindings (RUNTIME_TELEMETRY, observability, DLQs). No metric is fabricated — drop runtime-metrics.json to ingest a snapshot.',
    generatedAt: nowStamp(db) }, adapters: ADAPTERS, ingestion };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const i = buildTelemetryIntelligence(); writeOut('telemetry-intelligence.json', i);
  console.log('\nTelemetry Intelligence —', i.summary.sources, 'sources /', i.summary.metricsCovered, 'metrics · all query-bound · snapshot:', i.summary.liveSnapshot);
  console.log('  → graphify-out/telemetry-intelligence.json');
}
