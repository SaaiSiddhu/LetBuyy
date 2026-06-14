#!/usr/bin/env node
// LCIS Omega — Environment Registry (Phase 1). For local / staging / production, reports — per
// provider (Supabase/Cloudflare/Vercel/GitHub/Resend/Razorpay/Turnstile) — which credentials are
// present (read from process.env, presence only, never values), which resources are declared, and
// the connection/health status. Composes live-adapters + environment-intel. No fabrication.
import { readFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADAPTERS, adapterStatus } from './live-adapters.mjs';
import { buildEnvironmentIntel } from './environment-intel.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const NOT = 'NOT CONNECTED';

export function buildEnvironmentRegistry() {
  const envIntel = buildEnvironmentIntel();
  const providers = ADAPTERS.map(adapterStatus);
  // The current process environment (where the LCIS server runs). Deploy-time secrets are not here.
  const currentEnv = process.env.LCIS_ENV || process.env.NODE_ENV || 'local';

  const environments = ['local', 'staging', 'production'].map((envKey) => {
    const declared = envIntel.environments.find((e) => e.key === envKey)?.declared ?? (envKey === 'local');
    const isCurrent = envKey === currentEnv || (envKey === 'local' && currentEnv === 'development');
    return {
      environment: envKey, declared,
      // Credentials are only observable for the CURRENT process env; staging/production are deploy-time.
      providers: providers.map((p) => ({
        provider: p.provider, category: p.category,
        credentialsPresent: isCurrent ? p.credentialsPresent : false,
        status: (isCurrent && p.credentialsPresent) ? 'CONFIGURED' : NOT,
        exactSource: p.exactSource,
        resources: p.metrics,
        health: (isCurrent && p.credentialsPresent) ? 'probe via /api/live' : NOT,
      })),
      note: isCurrent
        ? 'current process environment — credential presence observed from process.env (presence only).'
        : 'declared environment — credentials are deploy-time (wrangler secret put); not observable from the repo.',
    };
  });

  const summary = {
    environments: environments.length,
    providers: providers.length,
    currentEnv,
    anyConfigured: providers.some((p) => p.credentialsPresent),
    connected: providers.filter((p) => p.credentialsPresent).length,
    notConnected: providers.filter((p) => !p.credentialsPresent).length,
    secretMatrix: envIntel.summary.secretMatrix,
    policy: 'Credential PRESENCE is read from process.env (values never read/emitted). Live metrics require a configured provider; absent ⇒ NOT CONNECTED + exact env vars. Read-only by default.',
    generatedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  };
  return { summary, environments, providers };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const intel = buildEnvironmentRegistry();
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'environment-registry.json'), JSON.stringify(intel));
  const s = intel.summary;
  console.log('\nLCIS Omega — Environment Registry');
  console.log(`  environments ${s.environments} · providers ${s.providers} · current env "${s.currentEnv}"`);
  console.log(`  configured ${s.connected} · NOT CONNECTED ${s.notConnected} (deploy-time secrets are not in the repo context)`);
  console.log('  → graphify-out/environment-registry.json');
}
