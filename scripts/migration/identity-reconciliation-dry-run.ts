#!/usr/bin/env -S pnpm exec tsx
// Phase 2 / D03 independent preparation (Mandate 6, Section 7).
//
// READ-ONLY. Queries employees / users_custom / sites through the real local PostgREST endpoint
// (never writes), feeds them through the real reconcileMerchantStaffIdentities function (the same
// code path the unit tests in identity-reconciliation-report.test.ts exercise with synthetic
// fixtures), and prints an aggregate, redacted report -- counts by finding kind and a list of
// legacyId references, never an email address, name, or other raw field.
//
// Usage:  pnpm exec tsx scripts/migration/identity-reconciliation-dry-run.ts
// Reads SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY from services/api-gateway/.dev.vars if not
// already set in the environment -- the same local demo credentials every test in this repository
// already uses. Never accepts or requires a hosted/production URL: refuses if SUPABASE_URL does
// not look like a local address, so this cannot accidentally run against a real environment.

import { readFileSync, existsSync } from 'node:fs';
import { reconcileMerchantStaffIdentities, type LegacyEmployeeMembershipRow, type LegacyCanonicalAccountRow, type LegacySiteOwnershipRow } from '../../services/api-gateway/src/identity-foundation/reconciliation-report';

function devVar(key: string): string | undefined {
  const path = 'services/api-gateway/.dev.vars';
  if (!existsSync(path)) return undefined;
  const match = readFileSync(path, 'utf8').match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match?.[1];
}

const SUPABASE_URL = process.env.SUPABASE_URL || devVar('SUPABASE_URL');
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || devVar('SUPABASE_SERVICE_ROLE_KEY');

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not found (env or services/api-gateway/.dev.vars). Refusing to run.');
  process.exit(1);
}
const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(SUPABASE_URL);
if (!isLocal) {
  console.error(`Refusing to run against a non-local SUPABASE_URL (${SUPABASE_URL}). This tool is local-only by design (Mandate 6, Section 2).`);
  process.exit(1);
}

async function selectAll<T>(table: string, columns: string): Promise<T[]> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?select=${columns}`, {
    headers: { apikey: SERVICE_ROLE_KEY!, Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
  });
  if (!res.ok) throw new Error(`${table} query failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T[];
}

async function main() {
  const employeeRows = await selectAll<{
    id: string; store_id: string | null; user_id: string | null; email: string; role: string;
    status: string; deleted_at: string | null; created_at: string | null; role_id: string | null;
  }>('employees', 'id,store_id,user_id,email,role,status,deleted_at,created_at,role_id');

  const accountRows = await selectAll<{ id: string; email: string; email_verified: boolean }>(
    'users_custom', 'id,email,email_verified',
  );

  const siteRows = await selectAll<{ site_id: string; custom_user_id: string | null; user_id: string | null }>(
    'sites', 'id,custom_user_id,user_id',
  ).then((rows) => rows.map((r: any) => ({ site_id: r.id, custom_user_id: r.custom_user_id, user_id: r.user_id })));

  const employees: LegacyEmployeeMembershipRow[] = employeeRows.map((r) => ({
    id: r.id, store_id: r.store_id, user_id: r.user_id, email: r.email, role: r.role,
    status: r.status, deleted_at: r.deleted_at, created_at: r.created_at,
  }));
  const canonicalAccounts: LegacyCanonicalAccountRow[] = accountRows.map((r) => ({
    id: r.id, email: r.email, email_verified: r.email_verified,
  }));
  const siteOwnership: LegacySiteOwnershipRow[] = siteRows;

  const report = reconcileMerchantStaffIdentities({ employees, canonicalAccounts, siteOwnership });

  console.log(JSON.stringify({
    generatedAt: report.generatedAt,
    dryRun: report.dryRun,
    legacyUntouched: report.legacyUntouched,
    inputCounts: report.inputCounts,
    countsByKind: report.countsByKind,
    findingReferences: report.findings.map((f) => ({ kind: f.kind, legacyId: f.legacyId, siteId: f.siteId })),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
