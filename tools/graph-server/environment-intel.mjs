#!/usr/bin/env node
// LCIS Mission Control — Environment Intelligence (Phase 10). Models the three real environments
// (local / staging / production) DECLARED in the repo (wrangler [env.*] blocks + config/env templates
// + the secret matrix). NO live credentials are stored in the repo, so NO env is "live-connected":
// repository/declared intelligence is available in every env; LIVE data (metrics, live versions,
// ledger rows) reports "Live Data Source Not Connected". No mock values, ever.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const has = (rel) => existsSync(join(ROOT, rel));
const wrangler = (rel) => has(rel) ? readFileSync(join(ROOT, rel), 'utf8') : '';

export function buildEnvironmentIntel() {
  const wf = ['services/api-gateway/wrangler.toml', 'services/queue-workers/wrangler.toml', 'services/webhook-service/wrangler.toml', 'services/mobile-bff/wrangler.toml'].map(wrangler).join('\n');
  const cfg = has('config/env') ? readdirSync(join(ROOT, 'config/env')) : [];
  const declaredStaging = /\[env\.staging\]/.test(wf) || cfg.some((f) => /staging/.test(f));
  const declaredProd = /\[env\.production\]/.test(wf) || cfg.some((f) => /production/.test(f));
  const secretMatrix = cfg.find((f) => /secret-matrix/.test(f)) || null;

  // A live data source would require runtime credentials (Supabase DSN, CF API token, provider keys).
  // Those are deploy-time secrets (wrangler secret put) and are NOT stored in the repo — by design.
  const liveConnected = false;
  const NOT_CONNECTED = 'Live Data Source Not Connected';

  const env = (key, label, declared) => ({
    key, label, declared,
    configSource: declared ? (key === 'local' ? 'config/env templates + local dev' : `wrangler [env.${key}] + config/env/${key}.env.template`) : null,
    repositoryIntelligence: 'available (schema, domains, infra topology, ownership, readiness — all repo-derived)',
    liveData: liveConnected ? 'connected' : NOT_CONNECTED,
    liveDataKinds: ['runtime metrics (latency/errors/queue-depth)', 'live worker/Vercel versions', 'revenue/ledger rows', 'per-merchant scores'],
  });

  const environments = [
    env('local', 'Local', true),
    env('staging', 'Staging', declaredStaging),
    env('production', 'Production', declaredProd),
  ];

  return {
    summary: {
      environments: environments.length,
      declared: environments.filter((e) => e.declared).map((e) => e.key),
      anyLiveConnected: liveConnected,
      secretMatrix,
      policy: 'NO MOCK VALUES. Repository/declared intelligence renders in every environment. Live-only data renders "Live Data Source Not Connected" until a runtime adapter is wired (telemetry-intelligence defines the adapters).',
      generatedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
    },
    environments, notConnectedLabel: NOT_CONNECTED,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const intel = buildEnvironmentIntel();
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'environment-intel.json'), JSON.stringify(intel));
  console.log('\nLCIS Environment Intelligence (Mission Control)');
  console.log(`  environments: ${intel.environments.map((e) => e.label + (e.declared ? '✓' : '✗')).join(', ')}`);
  console.log(`  any live-connected: ${intel.summary.anyLiveConnected} → live data shows "${intel.notConnectedLabel}"`);
  console.log(`  secret matrix: ${intel.summary.secretMatrix || '—'}`);
  console.log(`  → graphify-out/environment-intel.json\n`);
}
