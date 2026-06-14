#!/usr/bin/env node
// LCIS V7 — Connection Registry (the Live Operating System honesty core). For every live data
// source, reports: STATUS (NOT CONNECTED — no runtime credentials are stored in the repo by design),
// the EXACT SOURCE REQUIRED (env var / binding / API), and the INTEGRATION STATUS (adapter readiness).
// Never fabricates a metric. Used by telemetry / production-health / operations / environment.
// Output: graphify-out/connections-intel.json   ·   Run: pnpm graph:connections
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const g = (f) => existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : null;

// A source is "connectable" only with runtime credentials. None are stored in the repo (secrets are
// deploy-time via `wrangler secret put`), so every live source is NOT CONNECTED from the repo context.
const NOT = 'NOT CONNECTED';
const SOURCES = [
  { source: 'Cloudflare Workers', provider: 'Cloudflare', category: 'runtime', metrics: ['latency', 'error rate', 'throughput', 'cpu', 'cold starts'], exactSource: 'Cloudflare GraphQL Analytics API (account token) + `wrangler tail`', binding: '[observability]', adapter: 'telemetry-intelligence: Analytics Engine adapter' },
  { source: 'Cloudflare Queues', provider: 'Cloudflare', category: 'runtime', metrics: ['queue depth', 'throughput', 'retries', 'dead-letters'], exactSource: 'Cloudflare Queues metrics API (account token)', binding: '[[queues.consumers]] + DLQ', adapter: 'telemetry-intelligence: Queues adapter' },
  { source: 'Cloudflare R2', provider: 'Cloudflare', category: 'storage', metrics: ['object count', 'storage GB', 'class-A/B ops'], exactSource: 'Cloudflare R2 metrics (account token)', binding: 'R2_BUCKET', adapter: 'telemetry-intelligence: R2 adapter' },
  { source: 'Cloudflare KV', provider: 'Cloudflare', category: 'storage', metrics: ['reads', 'writes', 'storage'], exactSource: 'Cloudflare KV metrics (account token)', binding: '(no KV bound in wrangler)', adapter: 'n/a — KV not bound' },
  { source: 'Cloudflare Hyperdrive', provider: 'Cloudflare', category: 'database', metrics: ['connections', 'pool stats'], exactSource: 'Cloudflare dashboard / Hyperdrive metrics', binding: 'HYPERDRIVE', adapter: 'telemetry-intelligence: pool adapter' },
  { source: 'Cloudflare Analytics Engine', provider: 'Cloudflare', category: 'telemetry', metrics: ['the RUNTIME_TELEMETRY series'], exactSource: 'Analytics Engine SQL API (account token)', binding: 'RUNTIME_TELEMETRY', adapter: 'telemetry-intelligence: Analytics Engine SQL' },
  { source: 'Supabase Database', provider: 'Supabase', category: 'database', metrics: ['query latency', 'connections', 'db size', 'slow queries'], exactSource: 'SUPABASE_DB_URL + SUPABASE_SERVICE_ROLE_KEY (deploy-time secret)', binding: 'Supabase project', adapter: 'telemetry-intelligence: pg_stat_statements' },
  { source: 'Supabase Storage', provider: 'Supabase', category: 'storage', metrics: ['bucket size', 'bandwidth'], exactSource: 'Supabase Storage API (service role)', binding: 'Supabase project', adapter: 'telemetry-intelligence: Storage adapter' },
  { source: 'Supabase Realtime', provider: 'Supabase', category: 'runtime', metrics: ['channels', 'concurrent connections'], exactSource: 'Supabase Realtime metrics (service role)', binding: 'Supabase project', adapter: 'n/a — not in active topology' },
  { source: 'Resend', provider: 'Resend', category: 'email', metrics: ['delivered', 'bounced', 'complained'], exactSource: 'RESEND_API_KEY (deploy-time secret)', binding: 'RESEND_API_KEY', adapter: 'telemetry-intelligence: Resend API + webhook' },
  { source: 'Razorpay', provider: 'Razorpay', category: 'payments', metrics: ['captured', 'failed', 'settlement status'], exactSource: 'RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET + RAZORPAY_WEBHOOK_SECRET (deploy-time)', binding: 'payment_webhook_events', adapter: 'telemetry-intelligence: Razorpay API + webhook' },
  { source: 'Turnstile', provider: 'Cloudflare', category: 'security', metrics: ['challenge pass/fail'], exactSource: 'TURNSTILE_SECRET_KEY (deploy-time secret)', binding: 'TURNSTILE_SECRET_KEY', adapter: 'siteverify response (server-side)' },
  { source: 'Upstash Redis', provider: 'Upstash', category: 'rate-limit', metrics: ['rate-limit hits', 'cache stats'], exactSource: 'UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN (deploy-time)', binding: 'UPSTASH_REDIS_*', adapter: 'telemetry-intelligence: Upstash REST' },
];

export function buildConnectionsIntel() {
  const infra = g('infra-intel.json');
  const declaredSecrets = new Set(infra?.secrets || []);
  const connections = SOURCES.map((s) => {
    // integration status: adapter defined? secret declared in the deploy matrix?
    const secretName = (s.exactSource.match(/[A-Z][A-Z_]+/g) || [])[0];
    const secretDeclared = secretName ? [...declaredSecrets].some((x) => s.exactSource.includes(x)) : null;
    const adapterDefined = !/^n\/a/.test(s.adapter);
    return {
      ...s, status: NOT,
      integrationStatus: adapterDefined
        ? `adapter defined; needs runtime credential (${secretDeclared ? 'secret is in the deploy matrix' : 'configure source'}) + read access`
        : 'no adapter — source not in active topology',
      ready: adapterDefined,
    };
  });
  const summary = {
    sources: connections.length,
    connected: connections.filter((c) => c.status !== NOT).length,
    notConnected: connections.filter((c) => c.status === NOT).length,
    adapterReady: connections.filter((c) => c.ready).length,
    policy: 'No runtime credentials are stored in the repository (secrets are deploy-time via wrangler secret put). Every live source is therefore NOT CONNECTED from the repo; the exact source + integration status is shown so it can be wired. No metric is ever fabricated.',
    generatedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  };
  return { summary, connections };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const intel = buildConnectionsIntel();
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'connections-intel.json'), JSON.stringify(intel));
  const s = intel.summary;
  console.log('\nLCIS Connection Registry (V7) — Live Operating System');
  console.log(`  sources ${s.sources} · connected ${s.connected} · NOT CONNECTED ${s.notConnected} · adapter-ready ${s.adapterReady}`);
  console.log(`  every live source shows status + exact source required + integration status (no fabrication)`);
  console.log(`  → graphify-out/connections-intel.json\n`);
}
