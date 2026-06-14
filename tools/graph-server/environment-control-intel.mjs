#!/usr/bin/env node
// LCIS Genesis — Environment Control (Phase 1). EXTENDS environment-registry + live-adapters into the
// 5 named models: Environment Graph · Health Model · Dependency Map · Ownership Map · Secrets Registry,
// plus concrete ACTIVATION STEPS per provider. No fabrication — unconnected providers show NOT CONNECTED
// + required credentials + expected data source + activation steps.
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildEnvironmentRegistry } from './environment-registry.mjs';
import { ADAPTERS, adapterStatus } from './live-adapters.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const g = (f) => existsSync(join(OUT, f)) ? JSON.parse(readFileSync(join(OUT, f), 'utf8')) : null;

// Real activation steps per provider (how to obtain a read-only token + which env var to set).
const ACTIVATION = {
  Supabase: ['Create a read-only DB role or use the service-role key (server-only).', 'Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the LCIS server env.', 'For db size/storage, add SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF (Management API).'],
  Cloudflare: ['Create an API token with Account Analytics:Read + Workers:Read.', 'Set CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID.'],
  Vercel: ['Create a Vercel access token (read scope).', 'Set VERCEL_TOKEN (+ VERCEL_TEAM_ID if a team).'],
  GitHub: ['Create a fine-grained PAT with Actions:Read for the repo.', 'Set GITHUB_TOKEN.'],
  Resend: ['Use the Resend API key.', 'Set RESEND_API_KEY.'],
  Razorpay: ['Use the Razorpay key id + secret (read).', 'Set RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET.'],
  Turnstile: ['No pull-metrics API — verification is request-time.', 'Set TURNSTILE_SECRET_KEY for completeness.'],
};
// which runtime depends on which provider
const DEPENDENCY = {
  'api-gateway': ['Supabase', 'Cloudflare', 'Razorpay', 'Resend', 'Turnstile'],
  'queue-workers': ['Supabase', 'Cloudflare', 'Resend'],
  'webhook-service': ['Supabase', 'Cloudflare', 'Razorpay'],
  'storefront/apps (Vercel)': ['Vercel', 'Cloudflare', 'Supabase'],
  'ci/cd': ['GitHub', 'Cloudflare', 'Vercel'],
};

export function buildEnvironmentControl() {
  const reg = buildEnvironmentRegistry();
  const infra = g('infra-intel.json');
  const adapters = ADAPTERS.map(adapterStatus);

  const environmentGraph = reg.environments.map((e) => ({ environment: e.environment, declared: e.declared, providers: e.providers.map((p) => ({ provider: p.provider, status: p.status })) }));
  const healthModel = reg.environments.map((e) => ({ environment: e.environment, connected: e.providers.filter((p) => p.credentialsPresent).length, total: e.providers.length, health: e.providers.some((p) => p.credentialsPresent) ? 'PARTIAL' : 'NOT CONNECTED' }));
  const dependencyMap = Object.entries(DEPENDENCY).map(([runtime, providers]) => ({ runtime, providers }));
  const ownershipMap = reg.providers.map((p) => ({ provider: p.provider, owner: '@saai-sidd', source: 'CODEOWNERS (* → @saai-sidd)' }));
  const secretsRegistry = (infra?.secrets || []).map((s) => ({ secret: s, provider: ADAPTERS.find((a) => (a.required || []).includes(s) || (a.optional || []).includes(s) || (a.altRequired || []).includes(s))?.provider || 'platform', scope: 'deploy-time (wrangler secret put)' }));

  const providers = adapters.map((a) => ({ provider: a.provider, status: a.status, requiredCredentials: a.required, expectedDataSource: a.note, activationSteps: ACTIVATION[a.provider] || [] }));

  const summary = {
    environments: environmentGraph.length, providers: adapters.length,
    connected: adapters.filter((a) => a.credentialsPresent).length, notConnected: adapters.filter((a) => !a.credentialsPresent).length,
    secrets: secretsRegistry.length,
    note: 'Every provider shows NOT CONNECTED + required credentials + expected data source + activation steps. No metric fabricated; credentials read for presence only.',
    generatedAt: reg.summary.generatedAt,
  };
  return { summary, environmentGraph, healthModel, dependencyMap, ownershipMap, secretsRegistry, providers };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const intel = buildEnvironmentControl();
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'environment-control-intel.json'), JSON.stringify(intel));
  const s = intel.summary;
  console.log('\nLCIS Genesis — Environment Control');
  console.log(`  environments ${s.environments} · providers ${s.providers} (connected ${s.connected} / NOT CONNECTED ${s.notConnected}) · secrets ${s.secrets}`);
  console.log(`  models: Environment Graph · Health · Dependency · Ownership · Secrets Registry · Activation Steps`);
  console.log('  → graphify-out/environment-control-intel.json');
}
