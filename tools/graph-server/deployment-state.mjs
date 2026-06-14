#!/usr/bin/env node
// LetBuyy Deployment-State Intelligence (LCIS v4, Phase 3) — the DECLARED deploy state:
// latest migration, HEAD commit/branch, configured workers + Vercel apps, deploy gate, rollback.
//
// HONESTY: the actually-LIVE version/migration requires the Cloudflare + Vercel + Supabase
// deploy APIs, which are not in the repo. This reports what the repo DECLARES is intended to be
// live (HEAD + latest migration + configured targets) and marks the live-state gap explicitly.
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');
const MIG = join(ROOT, 'database/supabase/migrations');

function git(cmd) { try { return execSync(`git ${cmd}`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return null; } }

export function buildDeploymentState(infra) {
  const migs = existsSync(MIG) ? readdirSync(MIG).filter((f) => /^\d+.*\.sql$/.test(f)).sort((a, b) => (parseInt(a) || 0) - (parseInt(b) || 0)) : [];
  const latest = migs[migs.length - 1];
  const head = git('rev-parse --short HEAD');
  const branch = git('rev-parse --abbrev-ref HEAD');
  const lastTag = git('describe --tags --abbrev=0');
  const headSubject = git('log -1 --format=%s');

  const rollbackScript = 'infrastructure/scripts/deploy/production-rollback.mjs';
  const deployScripts = ['production-deploy.mjs', 'production-rollback.mjs', 'deploy-worker-runtime.mjs', 'verify-health-gates.mjs']
    .filter((f) => existsSync(join(ROOT, 'infrastructure/scripts/deploy', f)));

  return {
    declared: {
      headCommit: head, branch, lastTag, headSubject,
      latestMigration: latest ? { n: parseInt(latest), file: latest } : null,
      totalMigrations: migs.length,
    },
    targets: {
      workers: infra ? infra.workers.map((w) => w.name) : [],
      vercelApps: infra ? infra.summary.vercelApps : [],
      secretsRequired: infra ? infra.summary.secretsRequired : 0,
    },
    gate: { migrateGate: infra?.summary.hasMigrateGate ?? null, appliesMigrations: infra?.summary.appliesMigrations ?? null,
      order: ['migrate-production', 'deploy-workers-production', 'deploy-apps (Vercel)'] },
    rollback: { script: rollbackScript, present: existsSync(join(ROOT, rollbackScript)), scripts: deployScripts },
    liveStateGap: 'Actual live versions require the Cloudflare (worker versions), Vercel (build ids) and Supabase (applied migration) APIs — not stored in-repo. The above is the repository-DECLARED intended state at HEAD.',
    generatedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const infra = existsSync(join(OUT, 'infra-intel.json')) ? JSON.parse(readFileSync(join(OUT, 'infra-intel.json'), 'utf8')) : null;
  const st = buildDeploymentState(infra);
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'deployment-state.json'), JSON.stringify(st));
  console.log('\nLetBuyy Deployment-State Intelligence (LCIS v4)');
  console.log(`  HEAD ${st.declared.headCommit} (${st.declared.branch})${st.declared.lastTag ? ' tag ' + st.declared.lastTag : ''}`);
  console.log(`  latest migration: ${st.declared.latestMigration?.file} of ${st.declared.totalMigrations}`);
  console.log(`  targets: workers ${st.targets.workers.join(', ')} · vercel ${st.targets.vercelApps.length} · secrets ${st.targets.secretsRequired}`);
  console.log(`  rollback: ${st.rollback.present ? '✓ ' + st.rollback.script : 'missing'}`);
  console.log(`  ⚠ live-state gap: ${st.liveStateGap.slice(0, 80)}…`);
  console.log(`  → graphify-out/deployment-state.json\n`);
}
