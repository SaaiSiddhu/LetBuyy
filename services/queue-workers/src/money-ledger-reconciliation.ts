import {
  createSupabaseServiceClient,
  type SupabaseServiceEnv,
} from '@letbuyy/infrastructure/supabase-adapter';

export interface MoneyLedgerReconciliationEnv extends SupabaseServiceEnv {
  MONEY_LEDGER_RECONCILIATION_BATCH_LIMIT?: string;
}

export interface MoneyLedgerReconciliationInput {
  requestId: string;
  limit?: number;
}

interface SiteRow {
  id: string;
  name?: string | null;
  store_name?: string | null;
  subdomain?: string | null;
}

interface ReconciliationRow {
  status?: 'verified' | 'mismatch' | string | null;
  variance_minor?: number | string | null;
}

function batchLimit(env: MoneyLedgerReconciliationEnv, requested?: number): number {
  const configured = requested ?? Number(env.MONEY_LEDGER_RECONCILIATION_BATCH_LIMIT || 100);
  if (!Number.isFinite(configured)) return 100;
  return Math.min(Math.max(Math.trunc(configured), 1), 500);
}

function integerValue(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value || 0);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : 0;
}

export async function runMoneyLedgerReconciliation(
  env: MoneyLedgerReconciliationEnv,
  input: MoneyLedgerReconciliationInput,
): Promise<{
  checked: number;
  verified: number;
  mismatches: number;
  failed: number;
  request_id: string;
  results: Array<{
    site_id: string;
    label: string;
    status: 'verified' | 'mismatch' | 'failed';
    variance_minor: number;
  }>;
}> {
  const db = createSupabaseServiceClient(env);
  const { data: sites, error: siteError } = await db
    .from('sites')
    .select('id, name, store_name, subdomain')
    .is('deleted_at', null)
    .order('created_at', { ascending: true })
    .limit(batchLimit(env, input.limit));

  if (siteError) {
    throw new Error(`Money ledger reconciliation site scan failed: ${siteError.message}`);
  }

  const results: Array<{
    site_id: string;
    label: string;
    status: 'verified' | 'mismatch' | 'failed';
    variance_minor: number;
  }> = [];

  for (const site of (sites || []) as SiteRow[]) {
    const label = site.store_name || site.name || site.subdomain || site.id;
    const { data, error } = await db.rpc('refresh_money_ledger_site_reconciliation', {
      p_site_id: site.id,
    });

    if (error) {
      results.push({
        site_id: site.id,
        label,
        status: 'failed',
        variance_minor: 0,
      });
      continue;
    }

    const row = data as ReconciliationRow | null;
    const status = row?.status === 'verified' ? 'verified' : 'mismatch';
    results.push({
      site_id: site.id,
      label,
      status,
      variance_minor: integerValue(row?.variance_minor),
    });
  }

  return {
    checked: results.length,
    verified: results.filter((row) => row.status === 'verified').length,
    mismatches: results.filter((row) => row.status === 'mismatch').length,
    failed: results.filter((row) => row.status === 'failed').length,
    request_id: input.requestId,
    results,
  };
}
