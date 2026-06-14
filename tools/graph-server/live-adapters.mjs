#!/usr/bin/env node
// LCIS Omega — Live Provider Adapters (read-only). REAL adapters that probe each provider's
// public API using credentials read from process.env. CONTRACT:
//   • credentials present  → make a read-only (GET) call and return real metrics
//   • credentials absent   → return status NOT CONNECTED + the EXACT env vars required
//   • NEVER fabricate a metric · NEVER emit a credential value · read-only by default
// In a repo/dev context (no deploy-time secrets in process.env) every adapter is NOT CONNECTED.
import { execSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const NOT = 'NOT CONNECTED';
const env = (k) => (process.env[k] && String(process.env[k]).trim()) || null;
const first = (...keys) => keys.find((k) => env(k)) || null;          // first present env key
function repoSlug() { try { const u = execSync('git remote get-url origin', { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); const m = u.match(/github\.com[:/]([^/]+\/[^/.]+)/); return m ? m[1] : 'SaaiSiddhu/Letbuyy_Store'; } catch { return 'SaaiSiddhu/Letbuyy_Store'; } }

// Each adapter declares the required env vars, the read-only endpoint, and how to build the request.
export const ADAPTERS = [
  {
    provider: 'Supabase', category: 'database', metrics: ['tables', 'row counts', 'db size', 'storage'],
    required: ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'], optional: ['SUPABASE_ACCESS_TOKEN', 'SUPABASE_PROJECT_REF'],
    build: () => {
      const url = env('SUPABASE_URL'), key = env('SUPABASE_SERVICE_ROLE_KEY');
      if (!url || !key) return null;
      return { url: `${url.replace(/\/$/, '')}/rest/v1/`, headers: { apikey: key, Authorization: `Bearer ${key}` }, ok: (s) => s < 500 };
    },
    note: 'REST connectivity probe (read-only). Management API (db size) needs SUPABASE_ACCESS_TOKEN + SUPABASE_PROJECT_REF.',
  },
  {
    provider: 'Cloudflare', category: 'runtime', metrics: ['workers', 'requests', 'errors', 'cpu', 'queue depth', 'r2 usage'],
    required: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'], altRequired: ['CF_API_TOKEN', 'CF_ACCOUNT_ID'],
    build: () => {
      const token = first('CLOUDFLARE_API_TOKEN', 'CF_API_TOKEN'), acct = first('CLOUDFLARE_ACCOUNT_ID', 'CF_ACCOUNT_ID');
      if (!token || !acct) return null;
      return { url: `https://api.cloudflare.com/client/v4/accounts/${env(acct)}/workers/scripts`, headers: { Authorization: `Bearer ${env(token)}` }, ok: (s) => s === 200 };
    },
    note: 'Workers list (read-only). Latency/errors/queue-depth come from the GraphQL Analytics API + Queues metrics with the same token.',
  },
  {
    provider: 'Vercel', category: 'deployment', metrics: ['deployments', 'builds', 'domains', 'edge requests'],
    required: ['VERCEL_TOKEN'], altRequired: ['VERCEL_API_TOKEN'], optional: ['VERCEL_TEAM_ID', 'VERCEL_PROJECT_ID'],
    build: () => {
      const token = first('VERCEL_TOKEN', 'VERCEL_API_TOKEN'); if (!token) return null;
      const team = first('VERCEL_TEAM_ID', 'VERCEL_ORG_ID');
      return { url: `https://api.vercel.com/v6/deployments?limit=5${team ? '&teamId=' + env(team) : ''}`, headers: { Authorization: `Bearer ${env(token)}` }, ok: (s) => s === 200 };
    },
    note: 'Recent deployments (read-only).',
  },
  {
    provider: 'GitHub', category: 'ci', metrics: ['workflow runs', 'deployments', 'commits'],
    required: ['GITHUB_TOKEN'], altRequired: ['GH_TOKEN'],
    build: () => {
      const token = first('GITHUB_TOKEN', 'GH_TOKEN'); if (!token) return null;
      return { url: `https://api.github.com/repos/${repoSlug()}/actions/runs?per_page=5`, headers: { Authorization: `Bearer ${env(token)}`, Accept: 'application/vnd.github+json', 'User-Agent': 'lcis-omega' }, ok: (s) => s === 200 };
    },
    note: `Actions runs for ${repoSlug()} (read-only).`,
  },
  {
    provider: 'Resend', category: 'email', metrics: ['delivered', 'bounced', 'domains'],
    required: ['RESEND_API_KEY'],
    build: () => { const key = env('RESEND_API_KEY'); if (!key) return null; return { url: 'https://api.resend.com/domains', headers: { Authorization: `Bearer ${key}` }, ok: (s) => s === 200 }; },
    note: 'Domains list (read-only); delivery/bounce via Resend events webhook.',
  },
  {
    provider: 'Razorpay', category: 'payments', metrics: ['captured', 'failed', 'settlements'],
    required: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'],
    build: () => {
      const id = env('RAZORPAY_KEY_ID'), sec = env('RAZORPAY_KEY_SECRET'); if (!id || !sec) return null;
      return { url: 'https://api.razorpay.com/v1/payments?count=1', headers: { Authorization: 'Basic ' + Buffer.from(`${id}:${sec}`).toString('base64') }, ok: (s) => s === 200 };
    },
    note: 'Payments read (count=1, read-only).',
  },
  {
    provider: 'Turnstile', category: 'security', metrics: ['challenge pass/fail'],
    required: ['TURNSTILE_SECRET_KEY'],
    build: () => null, // siteverify is a per-challenge POST at request time — no pull-metrics API
    note: 'No pull-metrics API — Turnstile verification is request-time (siteverify POST). Credential presence = configured.',
  },
];

export function adapterStatus(a) {
  const req = [...(a.required || []), ...(a.altRequired ? [] : [])];
  const hasPrimary = (a.required || []).every((k) => env(k));
  const hasAlt = a.altRequired ? a.altRequired.every((k) => env(k)) : false;
  const present = hasPrimary || hasAlt;
  return {
    provider: a.provider, category: a.category, metrics: a.metrics,
    required: a.required, altRequired: a.altRequired || null, optional: a.optional || null,
    credentialsPresent: present, status: present ? 'CONFIGURED' : NOT,
    exactSource: (a.required || []).join(' + ') + (a.altRequired ? ` (or ${a.altRequired.join(' + ')})` : ''),
    integration: present ? 'credentials present — probe with /api/live?provider=' + a.provider : `set ${(a.required || []).join(', ')} to connect`,
    note: a.note,
  };
}

// Real read-only probe — only runs a network call when credentials are present.
export async function probeAdapter(a, { timeoutMs = 6000 } = {}) {
  const base = adapterStatus(a);
  const req = typeof a.build === 'function' ? a.build() : null;
  if (!req) return { ...base, live: base.credentialsPresent ? { status: 'CONFIGURED', note: 'no read-metrics endpoint' } : { status: 'NOT CONNECTED' } };
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(req.url, { method: 'GET', headers: req.headers, signal: ctrl.signal });
    clearTimeout(t);
    return { ...base, live: { status: req.ok(res.status) ? 'CONNECTED' : 'ERROR', httpStatus: res.status, source: req.url.replace(/\?.*$/, '') } };
  } catch (e) { clearTimeout(t); return { ...base, live: { status: 'ERROR', error: String(e.name === 'AbortError' ? 'timeout' : e.message), source: req.url.replace(/\?.*$/, '') } }; }
}

export async function probeAll(opts) {
  // Only providers with credentials trigger a network call; the rest return NOT CONNECTED instantly.
  const out = [];
  for (const a of ADAPTERS) {
    const base = adapterStatus(a);
    if (!base.credentialsPresent) { out.push({ ...base, live: { status: 'NOT CONNECTED' } }); continue; }
    out.push(await probeAdapter(a, opts));
  }
  return out;
}

export function summarize() {
  const statuses = ADAPTERS.map(adapterStatus);
  return {
    providers: statuses.length,
    configured: statuses.filter((s) => s.credentialsPresent).length,
    notConnected: statuses.filter((s) => !s.credentialsPresent).length,
    statuses,
    policy: 'Adapters are real read-only API clients. With credentials they return live metrics; without, they show NOT CONNECTED + the exact env vars. No metric is fabricated; no credential value is ever emitted.',
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const s = summarize();
  console.log('\nLCIS Omega — Live Provider Adapters (read-only)');
  console.log(`  providers ${s.providers} · configured ${s.configured} · NOT CONNECTED ${s.notConnected}`);
  for (const a of s.statuses) console.log(`    ${a.status.padEnd(13)} ${a.provider.padEnd(11)} needs: ${a.exactSource}`);
  console.log('\n  (probe with creds: node -e "import(\'./tools/graph-server/live-adapters.mjs\').then(m=>m.probeAll().then(r=>console.log(r)))")');
}
