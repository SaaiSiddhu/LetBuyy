#!/usr/bin/env node
// Shared library for Document 5 scenario harnesses.
// Targets the staging environment only; never touches production.
// All harnesses import from this file.

import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

export function requireStagingEnv() {
  const url = process.env.STAGING_SUPABASE_URL;
  const key = process.env.STAGING_SUPABASE_SERVICE_ROLE_KEY;
  const apiUrl = process.env.STAGING_API_URL;
  const internalSecret = process.env.STAGING_INTERNAL_API_SECRET;
  if (!url || !key) {
    console.error('STAGING_SUPABASE_URL and STAGING_SUPABASE_SERVICE_ROLE_KEY are required');
    process.exit(1);
  }
  if (!apiUrl) {
    console.error('STAGING_API_URL is required (e.g. https://api.staging.letbuyy.com)');
    process.exit(1);
  }
  return { url, key, apiUrl, internalSecret };
}

export function supabaseHeaders(key) {
  return {
    'Content-Type': 'application/json',
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Prefer': 'return=representation',
  };
}

export async function supabaseRpc(url, key, fnName, args = {}) {
  const res = await fetch(`${url}/rest/v1/rpc/${fnName}`, {
    method: 'POST',
    headers: supabaseHeaders(key),
    body: JSON.stringify(args),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`supabase rpc ${fnName} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function supabaseSelect(url, key, table, params = '') {
  const res = await fetch(`${url}/rest/v1/${table}?${params}`, {
    headers: { ...supabaseHeaders(key), 'Prefer': 'return=representation' },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`supabase select ${table} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function supabaseInsert(url, key, table, row) {
  const res = await fetch(`${url}/rest/v1/${table}`, {
    method: 'POST',
    headers: supabaseHeaders(key),
    body: JSON.stringify(row),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`supabase insert ${table} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function supabaseUpdate(url, key, table, match, patch) {
  const params = Object.entries(match).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join('&');
  const res = await fetch(`${url}/rest/v1/${table}?${params}`, {
    method: 'PATCH',
    headers: supabaseHeaders(key),
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`supabase update ${table} failed (${res.status}): ${text}`);
  }
  return res.json();
}

export async function apiCall(apiUrl, internalSecret, path, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...(internalSecret ? { 'X-Internal-Secret': internalSecret } : {}),
    ...(options.headers || {}),
  };
  const res = await fetch(`${apiUrl}${path}`, { ...options, headers });
  const body = await res.text();
  let json;
  try { json = JSON.parse(body); } catch { json = { raw: body }; }
  return { status: res.status, ok: res.ok, body: json };
}

export function generateUuid(scenario, step) {
  // Deterministic UUID v4-shaped from scenario+step+timestamp for test isolation.
  // Uses a known-good seeded pattern so each harness run gets fresh but reproducible IDs.
  const base = `${scenario}-${step}-${Date.now()}`;
  const hash = Array.from(base).reduce((acc, c) => acc * 31 + c.charCodeAt(0), 0x12345678);
  const h = Math.abs(hash).toString(16).padStart(8, '0');
  const ts = Date.now().toString(16).padStart(12, '0');
  return `${h.slice(0, 8)}-${ts.slice(0, 4)}-4${ts.slice(4, 7)}-8${ts.slice(7, 10)}-${ts.slice(10)}${h.slice(4)}`;
}

export function recordEvidence(scenario, evidence) {
  const dir = join(REPO_ROOT, 'LAUNCH_READINESS_2026_06_12', 'evidence', 'd-money-certification');
  mkdirSync(dir, { recursive: true });
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const file = join(dir, `${scenario}-${ts}.json`);
  writeFileSync(file, JSON.stringify(evidence, null, 2));
  console.log(`  evidence → ${file.replace(REPO_ROOT + '/', '')}`);
  return file;
}

export function pass(msg) {
  console.log(`  ✓ ${msg}`);
}

export function fail(msg) {
  console.error(`  ✗ ${msg}`);
  throw new Error(`HARNESS FAIL: ${msg}`);
}

export function step(msg) {
  console.log(`\n[step] ${msg}`);
}

export async function verifyI1Balance(url, key, transactionId) {
  const entries = await supabaseSelect(url, key, 'ledger_entries',
    `transaction_id=eq.${transactionId}&deleted_at=is.null&select=side,amount_minor`);
  const debits = entries.filter(e => e.side === 'debit').reduce((s, e) => s + BigInt(e.amount_minor), 0n);
  const credits = entries.filter(e => e.side === 'credit').reduce((s, e) => s + BigInt(e.amount_minor), 0n);
  if (debits !== credits) fail(`I1 double-entry violated: debits=${debits} credits=${credits} txn=${transactionId}`);
  pass(`I1 double-entry: debits=${debits} credits=${credits}`);
}

export async function verifyI5ZeroRake(url, key, transactionId) {
  const entries = await supabaseSelect(url, key, 'ledger_entries',
    `transaction_id=eq.${transactionId}&deleted_at=is.null&select=account_id,amount_minor`);
  const accountIds = [...new Set(entries.map(e => e.account_id))];
  for (const accountId of accountIds) {
    const accts = await supabaseSelect(url, key, 'ledger_accounts',
      `id=eq.${accountId}&select=account_code`);
    const code = accts[0]?.account_code;
    if (code === 'platform_revenue') {
      fail(`I5 zero-rake violated: platform_revenue entry in txn ${transactionId}`);
    }
  }
  pass('I5 zero rake: no platform_revenue entries in this transaction');
}

export async function verifyI6Idempotency(url, key, siteId, sourceType, idempotencyKey) {
  const txns = await supabaseSelect(url, key, 'ledger_transactions',
    `site_id=eq.${siteId}&source_type=eq.${sourceType}&idempotency_key=eq.${encodeURIComponent(idempotencyKey)}&deleted_at=is.null&select=id`);
  if (txns.length > 1) fail(`I6 idempotency violated: ${txns.length} entries for key=${idempotencyKey}`);
  pass(`I6 idempotency: exactly ${txns.length} entry for key=${idempotencyKey}`);
}
