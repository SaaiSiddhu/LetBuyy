import {
  createSupabaseServiceClient,
  type SupabaseServiceEnv,
} from '@letbuyy/infrastructure/supabase-adapter';

export interface MoneyLedgerReconciliationEnv extends SupabaseServiceEnv {
  MONEY_LEDGER_RECONCILIATION_BATCH_LIMIT?: string;
}
export interface MoneyLedgerReconciliationInput { requestId: string; limit?: number }
interface Counts { checked: number; verified: number; mismatches: number; failed: number }
interface Position { created_at: string | null; site_id: string | null }
interface SiteResult {
  site_id: string;
  label: string;
  status: 'verified' | 'mismatch' | 'failed';
  variance_minor: number | null;
  failure_code: string | null;
  attempted_at: string;
}
export interface MoneyLedgerReconciliationResult extends Counts {
  version: 1;
  request_id: string;
  pass_id: string;
  revision: number;
  pass_started_at: string;
  pass_completed_at: string | null;
  pass_completed: boolean;
  status: 'partial' | 'pass_completed' | 'mismatch' | 'failed';
  limit: number;
  replayed: boolean;
  pass_counts: Counts;
  cursor: Position;
  watermark: Position;
  results: SiteResult[];
}
function batchLimit(env: MoneyLedgerReconciliationEnv, requested?: number): number {
  const configured = requested ?? Number(env.MONEY_LEDGER_RECONCILIATION_BATCH_LIMIT || 100);
  if (!Number.isFinite(configured)) return 100;
  return Math.min(Math.max(Math.trunc(configured), 1), 500);
}
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const count = (value: unknown): value is number => typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function invalid(): never { throw new Error('Invalid money ledger reconciliation batch response'); }
function exactPaise(value: unknown): number {
  if (typeof value === 'number' && Number.isSafeInteger(value)) return value;
  if (typeof value === 'string' && value.length <= 17 && /^-?(0|[1-9][0-9]*)$/.test(value)) {
    const parsed = BigInt(value);
    if (parsed >= BigInt(Number.MIN_SAFE_INTEGER) && parsed <= BigInt(Number.MAX_SAFE_INTEGER)) return Number(parsed);
  }
  return invalid();
}
function counts(value: unknown): Counts {
  if (!record(value) || !count(value.checked) || !count(value.verified) || !count(value.mismatches) || !count(value.failed)
      || value.checked !== value.verified + value.mismatches + value.failed) return invalid();
  return { checked: value.checked, verified: value.verified, mismatches: value.mismatches, failed: value.failed };
}
function position(value: unknown): Position {
  if (!record(value)) return invalid();
  if (value.created_at === null && value.site_id === null) return { created_at: null, site_id: null };
  if (!text(value.created_at) || !text(value.site_id) || !uuid.test(value.site_id)) return invalid();
  return { created_at: value.created_at, site_id: value.site_id };
}
function parseResult(data: unknown, requestId: string, limit: number): MoneyLedgerReconciliationResult {
  if (!record(data) || data.version !== 1 || data.request_id !== requestId || data.limit !== limit
      || !text(data.pass_id) || !uuid.test(data.pass_id) || !count(data.revision) || data.revision < 1
      || typeof data.replayed !== 'boolean' || typeof data.pass_completed !== 'boolean' || !text(data.pass_started_at)
      || (data.pass_completed ? !text(data.pass_completed_at) : data.pass_completed_at !== null)
      || !Array.isArray(data.results) || data.results.length > limit) return invalid();
  const batch = counts(data), pass = counts(data.pass_counts);
  if (batch.checked !== data.results.length || pass.checked < batch.checked || pass.verified < batch.verified
      || pass.mismatches < batch.mismatches || pass.failed < batch.failed) return invalid();
  const expectedStatus = pass.failed > 0 ? 'failed' : pass.mismatches > 0 ? 'mismatch' : data.pass_completed ? 'pass_completed' : 'partial';
  if (data.status !== expectedStatus) return invalid();
  const ids = new Set<string>();
  const results: SiteResult[] = data.results.map((row: unknown) => {
    if (!record(row) || !text(row.site_id) || !uuid.test(row.site_id) || ids.has(row.site_id)
        || !text(row.label) || !text(row.attempted_at)) return invalid();
    ids.add(row.site_id);
    if (row.status === 'failed') {
      if (row.variance_minor !== null || typeof row.failure_code !== 'string' || !/^[0-9A-Z]{5}$/.test(row.failure_code)) return invalid();
      return { site_id: row.site_id, label: row.label, status: row.status, variance_minor: null, failure_code: row.failure_code, attempted_at: row.attempted_at };
    }
    if ((row.status !== 'verified' && row.status !== 'mismatch') || row.failure_code !== null) return invalid();
    const variance = exactPaise(row.variance_minor);
    if ((row.status === 'verified') !== (variance === 0)) return invalid();
    return { site_id: row.site_id, label: row.label, status: row.status, variance_minor: variance, failure_code: null, attempted_at: row.attempted_at };
  });
  if (batch.verified !== results.filter(row => row.status === 'verified').length
      || batch.mismatches !== results.filter(row => row.status === 'mismatch').length
      || batch.failed !== results.filter(row => row.status === 'failed').length) return invalid();
  return {
    ...batch, version: 1, request_id: requestId, pass_id: data.pass_id, revision: data.revision,
    pass_started_at: data.pass_started_at, pass_completed_at: data.pass_completed_at as string | null,
    pass_completed: data.pass_completed, status: expectedStatus, limit, replayed: data.replayed,
    pass_counts: pass, cursor: position(data.cursor), watermark: position(data.watermark), results,
  };
}
export async function runMoneyLedgerReconciliation(
  env: MoneyLedgerReconciliationEnv,
  input: MoneyLedgerReconciliationInput,
): Promise<MoneyLedgerReconciliationResult> {
  if (!text(input.requestId) || input.requestId.trim() !== input.requestId || input.requestId.length > 200) {
    throw new Error('A reconciliation request key is required');
  }
  const db = createSupabaseServiceClient(env), limit = batchLimit(env, input.limit);
  // The bounded RPC owns strict ordering, pass watermark, live row lock/revision
  // and atomic refresh/outcome/request receipt. A lost response replays that
  // receipt; the worker never invents a cursor or treats a failed amount as zero.
  const { data, error } = await db.rpc('run_money_ledger_reconciliation_batch_v1', {
    p_request_key: input.requestId, p_limit: limit,
  });
  if (error) throw new Error('Money ledger reconciliation batch unavailable');
  return parseResult(data, input.requestId, limit);
}
