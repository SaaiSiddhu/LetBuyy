#!/usr/bin/env node
// LetBuyy Deployment Intelligence (LCIS v3, Phase 8) — maps GitHub Actions →
// Workers / Vercel apps / migrations / queues / secrets / domains / subdomains.
// Reuses infra-intel.json (workers, secrets, vercel apps) + parses .github/workflows.
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const WF_DIR = join(ROOT, '.github/workflows');

export function buildDeploymentIntel(infra, di) {
  if (!infra) return { error: 'infra-intel.json missing — run pnpm graph:infra' };
  const s = infra.summary;
  const workflows = existsSync(WF_DIR) ? readdirSync(WF_DIR).filter((f) => /\.ya?ml$/.test(f)) : [];
  const wf = workflows.map((f) => {
    const txt = readFileSync(join(WF_DIR, f), 'utf8');
    const on = [...txt.matchAll(/^on:\s*$|^\s*(push|pull_request|workflow_dispatch|schedule|workflow_call):/gm)].map((m) => m[1]).filter(Boolean);
    return {
      file: f,
      deploysWorkers: /wrangler (deploy|secret)/.test(txt),
      deploysVercel: /vercel|--prod/.test(txt),
      runsMigrations: /db push|supabase.*migrat/i.test(txt),
      triggers: [...new Set(on)],
      gates: [...new Set([...txt.matchAll(/(branch[_-]lag|migrate-production|rollback|validate-governance)/g)].map((m) => m[1]))],
    };
  });

  // subdomains derived from the proxy host-routing model + Vercel app topology (CLAUDE.md).
  const subdomains = [
    { host: '{store}.letbuyy.com + custom domains', app: 'customer-web', via: 'proxy.ts host routing' },
    { host: 'merchant / app console', app: 'merchant-web', via: 'Vercel' },
    { host: 'identity / auth', app: 'identity-platform', via: 'Vercel' },
    { host: 'platform ops', app: 'admin-web', via: 'Vercel' },
    { host: 'marketing (www)', app: 'marketing-site', via: 'Vercel' },
    { host: 'api gateway (/v1)', app: 'services/api-gateway', via: 'Cloudflare Worker (letbuyy-api)' },
  ].filter((x) => s.vercelApps.includes(x.app) || /worker|gateway/i.test(x.via));

  return {
    pipeline: {
      order: ['migrate-production (db push --include-all, gated)', 'deploy-workers-production', 'deploy-apps (Vercel)'],
      migrateGate: s.hasMigrateGate, appliesMigrations: s.appliesMigrations,
    },
    workflows: wf,
    workers: infra.workers.map((w) => ({ name: w.name, file: w.file, bindings: w.bindings, queues: w.queueProducers, consumers: w.queueConsumers })),
    vercelApps: s.vercelApps,
    queues: { producers: s.queueProducers, consumers: s.queueConsumers, crons: s.crons },
    secrets: { required: s.secretsRequired, names: infra.secrets },
    domainsDeployed: di ? di.domains.map((d) => ({ domain: d.key, apps: d.apps, workers: d.workers })) : [],
    subdomains,
    rollback: { script: 'infrastructure/scripts/deploy/production-rollback.mjs', requires: ['--worker', '--version-id', '--reason'], policy: 'fail-closed (rollback-integrity-validator); migrations forward-fix-only' },
    providers: s.providers,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const g = (f) => existsSync(join(ROOT, 'graphify-out', f)) ? JSON.parse(readFileSync(join(ROOT, 'graphify-out', f), 'utf8')) : null;
  console.log(JSON.stringify(buildDeploymentIntel(g('infra-intel.json'), g('domain-intel.json')), null, 2));
}
