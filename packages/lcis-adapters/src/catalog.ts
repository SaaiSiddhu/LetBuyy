/**
 * LCAS catalog — the integration layer that assembles the 18 read-only adapters into one
 * AdapterRegistry, declares every live SIGNAL with its providing adapter + required env
 * (the honest NOT_CONNECTED → CONNECTED map), and describes the platform's webhook
 * surfaces. Pure composition: no adapter logic, no network, no mutation.
 */
import { AnalyticsEngineAdapter } from './analytics-engine/index';
import { CloudflareAdapter } from './cloudflare/index';
import { CronAdapter } from './cron/index';
import { DockerAdapter } from './docker/index';
import { EmailAdapter } from './email/index';
import { GitHubActionsAdapter } from './github-actions/index';
import { GitHubAdapter } from './github/index';
import { KubernetesAdapter } from './kubernetes/index';
import { PostgresAdapter } from './postgres/index';
import { QueuesAdapter } from './queues/index';
import { RazorpayAdapter } from './razorpay/index';
import { RealtimeAdapter } from './realtime/index';
import { RedisAdapter } from './redis/index';
import { AdapterRegistry } from './shared/registry';
import { CredentialProvider } from './shared/credentials';
import { FetchHttpClient, type ReadOnlyHttpClient } from './shared/http';
import { SignalRegistry, type SignalDescriptor } from './shared/signals';
import { WebhookRegistry, type WebhookDescriptor } from './shared/webhooks';
import { StorageAdapter } from './storage/index';
import { StripeAdapter } from './stripe/index';
import { SupabaseAdapter } from './supabase/index';
import { VercelAdapter } from './vercel/index';
import { WorkersAdapter } from './workers/index';

// ── Full adapter set ──────────────────────────────────────────────────────────

export interface FullAdapterSetOptions {
  readonly creds?: CredentialProvider;
  /** Injectable HTTP factory (tests). Defaults to GET-only FetchHttpClient per host set. */
  readonly httpFor?: (hosts: readonly string[]) => ReadOnlyHttpClient;
  readonly env?: Record<string, string | undefined>;
  readonly now?: () => string;
}

function hostOf(url: string | undefined, fallback: string): string {
  try {
    return new URL(url ?? `https://${fallback}`).host;
  } catch {
    return fallback;
  }
}

/** All 18 read-only adapters, host-allowlisted. Order is stable (registration order). */
export function createFullAdapterSet(opts: FullAdapterSetOptions = {}) {
  const env = opts.env ?? process.env;
  const creds = opts.creds ?? new CredentialProvider(env);
  const httpFor = opts.httpFor ?? ((hosts: readonly string[]) => new FetchHttpClient([...hosts]));
  const now = opts.now;
  const supa = hostOf(env['SUPABASE_URL'], 'project.supabase.co');
  const upstash = hostOf(env['UPSTASH_REDIS_REST_URL'], 'region.upstash.io');
  const docker = hostOf(env['DOCKER_API_URL'], 'localhost:2375');
  const kube = hostOf(env['KUBE_API_URL'], 'kubernetes.default.svc');
  const deps = (hosts: readonly string[]) => ({ http: httpFor(hosts), creds, now });

  return [
    new SupabaseAdapter(deps([supa, 'api.supabase.com'])),
    new GitHubAdapter(deps(['api.github.com'])),
    new CloudflareAdapter(deps(['api.cloudflare.com'])),
    new VercelAdapter(deps(['api.vercel.com'])),
    new GitHubActionsAdapter(deps(['api.github.com'])),
    new PostgresAdapter(deps(['api.supabase.com'])),
    new RedisAdapter(deps([upstash])),
    new DockerAdapter(deps([docker])),
    new KubernetesAdapter(deps([kube])),
    new StripeAdapter(deps(['api.stripe.com'])),
    new RazorpayAdapter(deps(['api.razorpay.com'])),
    new AnalyticsEngineAdapter(deps(['api.cloudflare.com'])),
    new EmailAdapter(deps(['api.resend.com'])),
    new StorageAdapter(deps(['api.cloudflare.com'])),
    new WorkersAdapter(deps(['api.cloudflare.com'])),
    new QueuesAdapter(deps(['api.cloudflare.com'])),
    new CronAdapter(deps(['api.cloudflare.com'])),
    new RealtimeAdapter(deps([supa])),
  ];
}

/** The full set registered in one AdapterRegistry (duplicate names would throw). */
export function createDefaultRegistry(opts: FullAdapterSetOptions = {}): AdapterRegistry {
  const registry = new AdapterRegistry();
  registry.registerAll(createFullAdapterSet(opts));
  return registry;
}

// ── Signal catalog ────────────────────────────────────────────────────────────

const CF_ENV = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'] as const;
const GH_ENV = ['GITHUB_TOKEN', 'GITHUB_REPOSITORY'] as const;

/** Every live signal LCIS can consume, with its providing adapter + required env. */
export const SIGNAL_CATALOG: readonly SignalDescriptor[] = [
  { key: 'db.schema', description: 'Tables/policies/migrations drift', adapter: 'supabase', capability: 'tables', requiredEnv: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'], reachable: true },
  { key: 'db.engine-health', description: 'Postgres engine health/config', adapter: 'postgres', capability: 'database-health', requiredEnv: ['SUPABASE_MGMT_TOKEN', 'SUPABASE_PROJECT_REF'], reachable: true },
  { key: 'db.query-stats', description: 'Live query statistics (pg_stat)', adapter: 'postgres', capability: 'database-health', requiredEnv: [], reachable: false, unreachableReason: 'pg_stat requires SQL access; not exposed over the GET-only Management API' },
  { key: 'repo.events', description: 'PRs/issues/releases/deployments', adapter: 'github', capability: 'pr', requiredEnv: [...GH_ENV], reachable: true },
  { key: 'ci.workflows', description: 'CI workflows + runs + artifacts', adapter: 'github-actions', capability: 'runs', requiredEnv: [...GH_ENV], reachable: true },
  { key: 'edge.inventory', description: 'Workers/queues/KV/R2 inventory', adapter: 'cloudflare', capability: 'workers', requiredEnv: [...CF_ENV], reachable: true },
  { key: 'edge.worker-detail', description: 'Per-script settings/bindings/deployments', adapter: 'workers', capability: 'script-settings', requiredEnv: [...CF_ENV], reachable: true },
  { key: 'edge.queue-detail', description: 'Per-queue consumers', adapter: 'queues', capability: 'consumers', requiredEnv: [...CF_ENV], reachable: true },
  { key: 'edge.queue-backlog', description: 'Queue backlog depth/lag', adapter: 'queues', capability: 'consumers', requiredEnv: [], reachable: false, unreachableReason: 'Queue metrics are served by the Cloudflare GraphQL Analytics API (POST-only)' },
  { key: 'edge.cron-schedules', description: 'Cron trigger schedules per script', adapter: 'cron', capability: 'schedules', requiredEnv: [...CF_ENV], reachable: true },
  { key: 'edge.cron-runs', description: 'Cron last-run results', adapter: 'cron', capability: 'schedules', requiredEnv: [], reachable: false, unreachableReason: 'Cron run history requires Workers logs/analytics (POST-only GraphQL)' },
  { key: 'edge.ae-datasets', description: 'Analytics Engine dataset/binding inventory', adapter: 'analytics-engine', capability: 'datasets', requiredEnv: [...CF_ENV], reachable: true },
  { key: 'edge.ae-values', description: 'Analytics Engine query values', adapter: 'analytics-engine', capability: 'datasets', requiredEnv: [], reachable: false, unreachableReason: 'Analytics Engine SQL API is POST-only (POST /analytics_engine/sql); unrepresentable in the GET-only boundary' },
  { key: 'storage.buckets', description: 'R2 bucket detail', adapter: 'storage', capability: 'bucket-detail', requiredEnv: [...CF_ENV], reachable: true },
  { key: 'storage.usage', description: 'R2 object counts/sizes', adapter: 'storage', capability: 'bucket-detail', requiredEnv: [], reachable: false, unreachableReason: 'R2 usage metrics require the GraphQL Analytics API (POST-only)' },
  { key: 'deploy.vercel', description: 'Vercel projects/deployments/domains', adapter: 'vercel', capability: 'deployments', requiredEnv: ['VERCEL_TOKEN'], reachable: true },
  { key: 'cache.size', description: 'Redis key count', adapter: 'redis', capability: 'dbsize', requiredEnv: ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN'], reachable: true },
  { key: 'cache.hit-ratio', description: 'Redis memory/hit-ratio', adapter: 'redis', capability: 'dbsize', requiredEnv: [], reachable: false, unreachableReason: 'INFO is not in the read-only command allowlist (unbounded response)' },
  { key: 'containers.state', description: 'Docker containers/images/engine', adapter: 'docker', capability: 'containers', requiredEnv: ['DOCKER_API_URL'], reachable: true },
  { key: 'k8s.workloads', description: 'Kubernetes namespaces/pods/deployments', adapter: 'kubernetes', capability: 'pods', requiredEnv: ['KUBE_API_URL', 'KUBE_TOKEN'], reachable: true },
  { key: 'money.stripe-status', description: 'Stripe account/webhook status', adapter: 'stripe', capability: 'account', requiredEnv: ['STRIPE_SECRET_KEY'], reachable: true },
  { key: 'money.razorpay-status', description: 'Razorpay payments/settlements/orders status', adapter: 'razorpay', capability: 'payments', requiredEnv: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'], reachable: true },
  { key: 'email.domains', description: 'Resend domain verification', adapter: 'email', capability: 'domains', requiredEnv: ['RESEND_API_KEY'], reachable: true },
  { key: 'email.deliveries', description: 'Email delivery/bounce metrics', adapter: 'email', capability: 'domains', requiredEnv: [], reachable: false, unreachableReason: 'Delivery events require the Resend events webhook feed, not a GET endpoint' },
  { key: 'realtime.health', description: 'Supabase Realtime health', adapter: 'realtime', capability: 'health', requiredEnv: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'], reachable: true },
  { key: 'realtime.channels', description: 'Realtime channel/connection counts', adapter: 'realtime', capability: 'health', requiredEnv: [], reachable: false, unreachableReason: 'No GET metrics endpoint on Supabase Realtime' },
];

/** SIGNAL_CATALOG registered in a SignalRegistry (duplicate keys would throw). */
export function createDefaultSignalRegistry(): SignalRegistry {
  const registry = new SignalRegistry();
  registry.registerAll(SIGNAL_CATALOG);
  return registry;
}

// ── Webhook catalog ───────────────────────────────────────────────────────────

/**
 * The platform's known webhook surfaces (descriptors only — no server, no handler).
 * Handler paths are the repo's real receivers; delivery history stays NOT_CONNECTED.
 */
export const WEBHOOK_CATALOG: readonly WebhookDescriptor[] = [
  {
    key: 'razorpay.payments',
    provider: 'Razorpay',
    direction: 'inbound',
    handlerPath: 'services/webhook-service',
    signatureScheme: 'HMAC-SHA256',
    requiredEnv: ['RAZORPAY_WEBHOOK_SECRET'],
    events: ['payment.captured', 'payment.failed', 'refund.processed'],
  },
  {
    key: 'github.repository',
    provider: 'GitHub',
    direction: 'inbound',
    handlerPath: null,
    signatureScheme: 'HMAC-SHA256',
    requiredEnv: ['GITHUB_WEBHOOK_SECRET'],
    events: ['push', 'pull_request', 'deployment_status', 'workflow_run'],
  },
  {
    key: 'stripe.events',
    provider: 'Stripe',
    direction: 'inbound',
    handlerPath: null,
    signatureScheme: 'HMAC-SHA256 (Stripe-Signature)',
    requiredEnv: ['STRIPE_WEBHOOK_SECRET'],
    events: ['payment_intent.succeeded', 'payment_intent.payment_failed', 'charge.refunded'],
  },
  {
    key: 'resend.events',
    provider: 'Resend',
    direction: 'inbound',
    handlerPath: null,
    signatureScheme: 'svix (HMAC-SHA256)',
    requiredEnv: ['RESEND_WEBHOOK_SECRET'],
    events: ['email.delivered', 'email.bounced', 'email.complained'],
  },
  {
    key: 'letbuyy.queue-envelope',
    provider: 'LetBuyy',
    direction: 'outbound',
    handlerPath: 'services/queue-workers',
    signatureScheme: 'HMAC (signQueueTenantEnvelope)',
    requiredEnv: ['QUEUE_TENANT_ENVELOPE_SECRET'],
    events: ['queue.job'],
  },
];

/** WEBHOOK_CATALOG registered in a WebhookRegistry (duplicate keys would throw). */
export function createDefaultWebhookRegistry(): WebhookRegistry {
  const registry = new WebhookRegistry();
  registry.registerAll(WEBHOOK_CATALOG);
  return registry;
}
