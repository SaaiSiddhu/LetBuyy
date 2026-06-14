#!/usr/bin/env node
// LetBuyy Infrastructure Intelligence — parses wrangler.toml (Workers + bindings),
// the production deploy workflow (deploy targets + secret matrix + migration gate),
// and .github/CODEOWNERS (ownership). Output: graphify-out/infra-intel.json.
// Run: pnpm graph:infra
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const OUT = join(ROOT, 'graphify-out');

function parseWrangler(path) {
  if (!existsSync(path)) return null;
  const t = readFileSync(path, 'utf8');
  const name = (t.match(/^name\s*=\s*"([^"]+)"/m) || [])[1] || null;
  const grab = (re) => [...t.matchAll(re)].map((m) => m[1]);
  return {
    file: path.replace(ROOT + '/', ''),
    name,
    queueProducers: grab(/\[\[queues\.producers\]\][\s\S]*?binding\s*=\s*"([^"]+)"/g),
    queueConsumers: grab(/\[\[queues\.consumers\]\][\s\S]*?queue\s*=\s*"([^"]+)"/g),
    kv: grab(/\[\[kv_namespaces\]\][\s\S]*?binding\s*=\s*"([^"]+)"/g),
    r2: grab(/\[\[r2_buckets\]\][\s\S]*?binding\s*=\s*"([^"]+)"/g),
    d1: grab(/\[\[d1_databases\]\][\s\S]*?binding\s*=\s*"([^"]+)"/g),
    hyperdrive: /HYPERDRIVE/.test(t) || /\[\[hyperdrive\]\]/.test(t),
    durableObjects: grab(/\[\[durable_objects\.bindings\]\][\s\S]*?name\s*=\s*"([^"]+)"/g),
    crons: (t.match(/crons\s*=\s*\[([^\]]*)\]/) || [, ''])[1].split(',').map((s) => s.trim().replace(/"/g, '')).filter(Boolean),
    bindings: [...new Set(grab(/^\s*binding\s*=\s*"([^"]+)"/gm))],
  };
}

export function buildInfraIntel() {
  const workers = ['services/api-gateway', 'services/queue-workers', 'services/webhook-service', 'services/mobile-bff']
    .map((d) => parseWrangler(join(ROOT, d, 'wrangler.toml'))).filter(Boolean);

  // production deploy workflow
  const wfPath = join(ROOT, '.github/workflows/production-deploy.yml');
  const wf = existsSync(wfPath) ? readFileSync(wfPath, 'utf8') : '';
  const secrets = [...new Set([...wf.matchAll(/wrangler secret put (\w+)/g)].map((m) => m[1]))];
  const vercelApps = [...new Set([...wf.matchAll(/^\s*-\s*app:\s*([\w-]+)/gm)].map((m) => m[1]))];
  const appliesMigrations = /supabase@latest db push --include-all/.test(wf);
  const hasMigrateGate = /migrate-production:/.test(wf);

  // CODEOWNERS
  const coPath = join(ROOT, '.github/CODEOWNERS');
  const ownership = existsSync(coPath)
    ? readFileSync(coPath, 'utf8').split('\n').filter((l) => l.trim() && !l.trim().startsWith('#')).map((l) => { const [path, ...owners] = l.trim().split(/\s+/); return { path, owners }; })
    : [];

  // external providers referenced (env reads)
  const providers = [];
  for (const [name, re] of [['Resend', /RESEND_API_KEY/], ['Razorpay', /RAZORPAY_KEY_SECRET/], ['Turnstile', /TURNSTILE_SECRET_KEY/], ['Supabase', /SUPABASE_(URL|SERVICE_ROLE_KEY)/], ['Upstash Redis', /UPSTASH_REDIS/]]) if (re.test(wf)) providers.push(name);

  const summary = {
    workers: workers.length,
    queueProducers: [...new Set(workers.flatMap((w) => w.queueProducers))],
    queueConsumers: [...new Set(workers.flatMap((w) => w.queueConsumers))],
    kv: [...new Set(workers.flatMap((w) => w.kv))],
    r2: [...new Set(workers.flatMap((w) => w.r2))],
    d1: [...new Set(workers.flatMap((w) => w.d1))],
    hyperdrive: workers.some((w) => w.hyperdrive),
    durableObjects: [...new Set(workers.flatMap((w) => w.durableObjects))],
    crons: [...new Set(workers.flatMap((w) => w.crons))],
    vercelApps,
    secretsRequired: secrets.length,
    appliesMigrations,
    hasMigrateGate,
    providers,
    ownerRules: ownership.length,
    generatedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z'),
  };
  return { summary, workers, secrets, ownership };
}

export function findOwnership(infra, path) {
  // longest-prefix match against CODEOWNERS (Git semantics: last match wins, but specificity ~ length)
  if (!infra || !infra.ownership.length) return null;
  let best = null, blen = -1;
  for (const r of infra.ownership) {
    const pat = r.path === '*' ? '' : r.path.replace(/^\//, '').replace(/\/$/, '');
    if (pat === '' || path.includes(pat)) { if (pat.length >= blen) { blen = pat.length; best = r; } }
  }
  return best ? { path, rule: best.path, owners: best.owners } : null;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const intel = buildInfraIntel();
  if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, 'infra-intel.json'), JSON.stringify(intel));
  const s = intel.summary;
  console.log('\nLetBuyy Infrastructure Intelligence');
  console.log(`  Cloudflare Workers: ${s.workers} (${intel.workers.map((w) => w.name).join(', ')})`);
  console.log(`  Queues: producers ${s.queueProducers.length} [${s.queueProducers.join(', ')}] · consumers ${s.queueConsumers.length}`);
  console.log(`  KV ${s.kv.join(',') || '—'} · R2 ${s.r2.join(',') || '—'} · D1 ${s.d1.join(',') || '—'} · Hyperdrive ${s.hyperdrive ? '✓' : '—'} · crons ${s.crons.length}`);
  console.log(`  Vercel apps: ${s.vercelApps.length} [${s.vercelApps.join(', ')}]`);
  console.log(`  Production secrets required: ${s.secretsRequired} · migrate gate: ${s.hasMigrateGate ? '✓' : '—'} · providers: ${s.providers.join(', ')}`);
  console.log(`  CODEOWNERS rules: ${s.ownerRules}`);
  console.log(`  → graphify-out/infra-intel.json\n`);
}
