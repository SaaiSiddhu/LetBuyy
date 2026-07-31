/**
 * LiveSignalRegistry — the Phase-0 detectability matrix encoded at runtime. Each operational
 * signal declares its detectability + the EXACT env vars required to connect its live value.
 * This is how LCOS stays honest: a NOT_CONNECTED signal always names what it needs.
 */
import type { OperationalArea, OperationalSignal, OperationalStatus } from './types';

const SUPA = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] as const;
const CF_AE = ['CF_ANALYTICS_API_TOKEN', 'CF_ACCOUNT_ID'] as const;
const CF = ['CLOUDFLARE_API_TOKEN', 'CF_ACCOUNT_ID'] as const;
const VERCEL = ['VERCEL_TOKEN'] as const;
const TURNSTILE = ['TURNSTILE_SECRET_KEY'] as const;

function sig(
  key: string,
  area: OperationalArea,
  label: string,
  detectability: OperationalStatus,
  dataSource: string,
  liveSource: string | null,
  requiresEnvVar: readonly string[],
): OperationalSignal {
  return { key, area, label, detectability, dataSource, liveSource, requiresEnvVar };
}

const SIGNALS: readonly OperationalSignal[] = [
  // runtime
  sig('runtime.worker-topology', 'runtime', 'Worker/queue topology', 'CONNECTED', 'runtime-intel.json', null, []),
  sig('runtime.worker-errors', 'runtime', 'Worker error rate', 'NOT_CONNECTED', 'runtime-intel.json', 'Cloudflare Analytics Engine', CF_AE),
  sig('runtime.queue-backlog', 'runtime', 'Queue backlog depth', 'NOT_CONNECTED', 'runtime-intel.json:queueGraph', 'Cloudflare Queues API', CF),
  sig('runtime.dead-letter-depth', 'runtime', 'Dead-letter queue depth', 'NOT_CONNECTED', 'runtime-observability.json:deadLetterQueues', 'Cloudflare Queues API', CF),
  sig('runtime.cron-last-run', 'runtime', 'Cron last-run status', 'NOT_CONNECTED', 'runtime-intel.json:workers.crons', 'Cloudflare Analytics Engine', CF_AE),
  // commerce
  sig('commerce.ledger-topology', 'commerce', 'Canonical ledger topology', 'CONNECTED', 'db-intel.json', null, []),
  sig('commerce.gmv', 'commerce', 'GMV', 'NOT_CONNECTED', 'revenue-intelligence-v2.json', 'orders.total_minor (Supabase)', SUPA),
  sig('commerce.order-rate', 'commerce', 'Order rate', 'NOT_CONNECTED', 'commerce-control-intel.json', 'orders (Supabase)', SUPA),
  sig('commerce.refund-rate', 'commerce', 'Refund rate', 'NOT_CONNECTED', 'revenue-intelligence-v2.json', 'refunds (Supabase)', SUPA),
  sig('commerce.payment-failure-rate', 'commerce', 'Payment failure rate', 'NOT_CONNECTED', 'commerce-control-intel.json', 'payment_transactions (Supabase)', SUPA),
  // merchant
  sig('merchant.topology', 'merchant', 'Merchant lifecycle model', 'CONNECTED', 'merchant-intelligence.json', null, []),
  sig('merchant.active-count', 'merchant', 'Active merchants', 'NOT_CONNECTED', 'merchant-intelligence.json', 'sites (Supabase)', SUPA),
  sig('merchant.churn-rate', 'merchant', 'Merchant churn rate', 'NOT_CONNECTED', 'merchant-churn.json', 'sites + orders (Supabase)', SUPA),
  sig('merchant.activation-rate', 'merchant', 'Activation rate', 'NOT_CONNECTED', 'merchant-adoption.json', 'sites + products (Supabase)', SUPA),
  // customer
  sig('customer.journey-topology', 'customer', 'Customer journey model', 'CONNECTED', 'customer-journey-intelligence.json', null, []),
  sig('customer.conversion-rate', 'customer', 'Conversion rate', 'NOT_CONNECTED', 'customer-intelligence.json', 'analytics_event_stream (CF Analytics)', CF_AE),
  sig('customer.traffic', 'customer', 'Traffic / sessions', 'NOT_CONNECTED', 'customer-intelligence.json', 'analytics_event_stream (CF Analytics)', CF_AE),
  sig('customer.abandonment-rate', 'customer', 'Cart abandonment rate', 'NOT_CONNECTED', 'customer-intelligence.json', 'carts (Supabase)', SUPA),
  // deployment
  sig('deployment.git-state', 'deployment', 'Declared deploy state (git)', 'CONNECTED', 'deployment-state.json', null, []),
  sig('deployment.rollback-scripts', 'deployment', 'Rollback scripts present', 'CONNECTED', 'deployment-intelligence-v5.json', null, []),
  sig('deployment.deployed-version', 'deployment', 'Live deployed version', 'NOT_CONNECTED', 'deployment-state.json', 'Vercel/Cloudflare deploy API', [...VERCEL, ...CF]),
  sig('deployment.release-health', 'deployment', 'Release health', 'NOT_CONNECTED', 'deployment-intelligence-v5.json', 'Vercel deploy API', VERCEL),
  // incident
  sig('incident.runbook-coverage', 'incident', 'Runbook coverage', 'CONNECTED', 'runbooks.json', null, []),
  sig('incident.blast-radius', 'incident', 'Incident blast radius', 'CONNECTED', 'domain-intel.json', null, []),
  sig('incident.open-incidents', 'incident', 'Open incidents', 'NOT_CONNECTED', 'incident-intelligence-v5.json', 'incident store (not wired)', SUPA),
  // security
  sig('security.controls', 'security', 'Security controls present', 'CONNECTED', 'security-intelligence-v5.json', null, []),
  sig('security.cross-tenant-surface', 'security', 'Cross-tenant risk surface', 'CONNECTED', 'db-intel.json:policies', null, []),
  sig('security.auth-failure-rate', 'security', 'Auth failure rate', 'NOT_CONNECTED', 'security-intelligence-v5.json', 'auth events (Supabase)', SUPA),
  sig('security.abuse-signals', 'security', 'Abuse / bot signals', 'NOT_CONNECTED', 'security-intelligence-v5.json', 'Turnstile + rate-limit', TURNSTILE),
  // forecast
  sig('forecast.order-trend', 'forecast', 'Order trend forecast', 'NOT_CONNECTED', 'revenue-intelligence-v2.json', 'orders.created_at series (Supabase)', SUPA),
  sig('forecast.merchant-growth', 'forecast', 'Merchant growth forecast', 'NOT_CONNECTED', 'merchant-growth.json', 'sites.created_at series (Supabase)', SUPA),
  sig('forecast.traffic-trend', 'forecast', 'Traffic trend forecast', 'NOT_CONNECTED', 'customer-intelligence.json', 'analytics_event_stream series (CF Analytics)', CF_AE),
  sig('forecast.queue-growth', 'forecast', 'Queue growth forecast', 'NOT_CONNECTED', 'runtime-intel.json', 'Cloudflare Queues series', CF),
];

export class LiveSignalRegistry {
  list(): readonly OperationalSignal[] {
    return SIGNALS;
  }
  byArea(area: OperationalArea): readonly OperationalSignal[] {
    return SIGNALS.filter((s) => s.area === area);
  }
  get(key: string): OperationalSignal | undefined {
    return SIGNALS.find((s) => s.key === key);
  }
  counts(): Record<OperationalStatus, number> {
    const c: Record<OperationalStatus, number> = {
      CONNECTED: 0, PARTIAL: 0, NOT_CONNECTED: 0, UNKNOWN: 0, NOT_DETECTABLE: 0,
    };
    for (const s of SIGNALS) c[s.detectability]++;
    return c;
  }
}
