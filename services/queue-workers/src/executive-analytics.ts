import {
  insertSupabaseRows,
  selectSupabaseRows,
  upsertSupabaseRows,
  type SupabaseServiceEnv,
} from '@letbuyy/infrastructure/supabase-adapter';
import {
  EXECUTIVE_ANALYTICS_DEFINITION_VERSION,
  EXECUTIVE_FUNNEL_STEPS,
  type JsonRecord,
} from '@letbuyy/shared-types';

export interface ExecutiveAnalyticsDelivery {
  status: 'completed' | 'dead-lettered';
  input: {
    jobType: string;
    payload: Record<string, unknown>;
    requestId: string | null;
    correlationId: string | null;
    siteId: string | null;
  };
}

export interface ExecutiveAnalyticsRollupResult {
  processed: number;
  skipped: number;
  mrrRollupsWritten: number;
  funnelStepsWritten: number;
  cohortSnapshotsWritten: number;
  metricRollupsWritten: number;
  failed: number;
}

interface SubscriptionRow extends JsonRecord {
  id: string;
  user_id?: string | null;
  store_id?: string | null;
  status?: string | null;
  amount_paid?: number | string | null;
  billing_period?: string | null;
  created_at?: string | null;
  cancelled_at?: string | null;
}

interface SiteRow extends JsonRecord {
  id: string;
  status?: string | null;
  published?: boolean | null;
  created_at?: string | null;
  published_at?: string | null;
}

interface OrderRow extends JsonRecord {
  id: string;
  site_id?: string | null;
  store_id?: string | null;
  created_at?: string | null;
  payment_processed_at?: string | null;
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringField(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function numberField(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function integerField(value: unknown): number {
  return Math.round(numberField(value));
}

function periodDateFromPayload(payload: JsonRecord): string {
  const candidate = stringField(payload.period_date);
  if (candidate && /^\d{4}-\d{2}-\d{2}$/.test(candidate)) return candidate;
  return new Date().toISOString().slice(0, 10);
}

function dateOnly(value: string | null | undefined): string | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString().slice(0, 10);
}

function monthStart(value: string | null | undefined): string | null {
  const date = dateOnly(value);
  return date ? `${date.slice(0, 7)}-01` : null;
}

function monthsBetween(cohortMonth: string, periodDate: string): number {
  const cohortYear = Number(cohortMonth.slice(0, 4));
  const cohortMonthIndex = Number(cohortMonth.slice(5, 7));
  const periodYear = Number(periodDate.slice(0, 4));
  const periodMonthIndex = Number(periodDate.slice(5, 7));
  if (![cohortYear, cohortMonthIndex, periodYear, periodMonthIndex].every(Number.isFinite)) return 0;
  return Math.max(0, (periodYear - cohortYear) * 12 + (periodMonthIndex - cohortMonthIndex));
}

function monthlySubscriptionPaise(row: SubscriptionRow): number {
  const amount = integerField(row.amount_paid);
  if (amount <= 0 || row.status !== 'active') return 0;
  return row.billing_period === 'yearly' ? Math.round(amount / 12) : amount;
}

function uniqueCount(values: Array<string | null | undefined>): number {
  return new Set(values.filter((value): value is string => Boolean(value))).size;
}

async function countRows(env: SupabaseServiceEnv, table: string, params: Record<string, string>): Promise<number> {
  return (await selectSupabaseRows<JsonRecord>(env, table, {
    select: 'id',
    limit: '10000',
    ...params,
  })).length;
}

async function readRows<T>(env: SupabaseServiceEnv, table: string, params: Record<string, string>): Promise<T[]> {
  return selectSupabaseRows<T>(env, table, {
    limit: '10000',
    ...params,
  });
}

async function writeAudit(env: SupabaseServiceEnv, input: {
  action: string;
  reason: string;
  requestId: string | null;
  metadata: JsonRecord;
}): Promise<void> {
  await insertSupabaseRows(env, 'audit_logs', {
    actor_id: null,
    actor_type: 'system',
    actor_email: null,
    action: input.action,
    resource_type: 'executive_analytics',
    resource_id: null,
    metadata: {
      ...input.metadata,
      reason: input.reason,
      definition_version: EXECUTIVE_ANALYTICS_DEFINITION_VERSION,
      request_id: input.requestId,
    },
  });
}

async function writeMrrRollup(env: SupabaseServiceEnv, input: {
  periodDate: string;
  computedAt: string;
  requestId: string | null;
}): Promise<number> {
  const [subscriptions, appCharges, themePurchases, payoutRows] = await Promise.all([
    readRows<SubscriptionRow>(env, 'subscriptions', {
      select: 'id,user_id,store_id,status,amount_paid,billing_period,created_at,cancelled_at',
    }),
    readRows<JsonRecord>(env, 'app_billing_charges', {
      select: 'id,amount_minor,status,created_at,activated_at,deleted_at',
      status: 'in.(approved,active)',
      deleted_at: 'is.null',
    }),
    readRows<JsonRecord>(env, 'theme_purchases', {
      select: 'id,price_paid_inr,status,purchased_at,deleted_at',
      status: 'eq.completed',
      deleted_at: 'is.null',
    }),
    readRows<JsonRecord>(env, 'partner_payout_ledger_entries', {
      select: 'id,partner_amount_minor,status,created_at,deleted_at',
      status: 'in.(pending,processing)',
      deleted_at: 'is.null',
    }),
  ]);

  const mrrPaise = subscriptions.reduce((total, row) => total + monthlySubscriptionPaise(row), 0);
  const activeSubscriptions = subscriptions.filter((row) => row.status === 'active').length;
  const newMrrPaise = subscriptions
    .filter((row) => row.status === 'active' && monthStart(row.created_at) === `${input.periodDate.slice(0, 7)}-01`)
    .reduce((total, row) => total + monthlySubscriptionPaise(row), 0);
  const churnedRows = subscriptions.filter((row) => row.cancelled_at && monthStart(row.cancelled_at) === `${input.periodDate.slice(0, 7)}-01`);
  const churnedMrrPaise = churnedRows.reduce((total, row) => total + (row.billing_period === 'yearly' ? Math.round(integerField(row.amount_paid) / 12) : integerField(row.amount_paid)), 0);

  const appRevenuePaise = appCharges.reduce((total, row) => total + integerField(row.amount_minor), 0);
  const themeRevenuePaise = themePurchases.reduce((total, row) => total + Math.round(numberField(row.price_paid_inr) * 100), 0);
  const payoutLiabilityPaise = payoutRows.reduce((total, row) => total + integerField(row.partner_amount_minor), 0);

  await upsertSupabaseRows(env, 'mrr_arr_rollups', {
    period_date: input.periodDate,
    mrr_paise: mrrPaise,
    arr_paise: mrrPaise * 12,
    new_mrr_paise: newMrrPaise,
    expansion_mrr_paise: 0,
    contraction_mrr_paise: 0,
    churned_mrr_paise: churnedMrrPaise,
    active_subscriptions: activeSubscriptions,
    logo_churn_count: uniqueCount(churnedRows.map((row) => row.store_id || row.user_id || row.id)),
    subscription_revenue_paise: mrrPaise,
    app_revenue_paise: appRevenuePaise,
    theme_revenue_paise: themeRevenuePaise,
    partner_payout_liability_paise: payoutLiabilityPaise,
    definition_version: EXECUTIVE_ANALYTICS_DEFINITION_VERSION,
    computed_at: input.computedAt,
    request_id: input.requestId,
    actor_type: 'worker',
    metadata: {
      source_tables: ['subscriptions', 'app_billing_charges', 'theme_purchases', 'partner_payout_ledger_entries'],
      subscriptions_sampled: subscriptions.length,
      app_charges_sampled: appCharges.length,
      theme_purchases_sampled: themePurchases.length,
      payout_rows_sampled: payoutRows.length,
    },
  }, { onConflict: 'period_date,definition_version', prefer: 'resolution=merge-duplicates,return=representation' });

  return 1;
}

async function writeFunnelSteps(env: SupabaseServiceEnv, input: {
  periodDate: string;
  computedAt: string;
  requestId: string | null;
}): Promise<number> {
  const [signups, stores, publishedStores, orders, subscriptions] = await Promise.all([
    countRows(env, 'users_custom', { created_at: `lte.${input.periodDate}T23:59:59.999Z` }),
    readRows<SiteRow>(env, 'sites', {
      select: 'id,status,published,created_at,published_at,deleted_at',
      created_at: `lte.${input.periodDate}T23:59:59.999Z`,
      deleted_at: 'is.null',
    }),
    readRows<SiteRow>(env, 'sites', {
      select: 'id,status,published,created_at,published_at,deleted_at',
      published_at: `lte.${input.periodDate}T23:59:59.999Z`,
      deleted_at: 'is.null',
    }),
    readRows<OrderRow>(env, 'orders', {
      select: 'id,site_id,store_id,payment_status,created_at,payment_processed_at,deleted_at',
      payment_status: 'eq.paid',
      created_at: `lte.${input.periodDate}T23:59:59.999Z`,
      deleted_at: 'is.null',
    }),
    readRows<SubscriptionRow>(env, 'subscriptions', {
      select: 'id,store_id,status,created_at',
      status: 'eq.active',
      created_at: `lte.${input.periodDate}T23:59:59.999Z`,
    }),
  ]);

  const firstOrderSiteIds = uniqueCount(orders.map((row) => row.site_id || row.store_id));
  const payingSiteIds = uniqueCount(subscriptions.map((row) => row.store_id || row.id));
  const counts: Record<string, number> = {
    signup: signups,
    store_created: stores.length,
    store_published: publishedStores.filter((row) => row.published !== false || row.status === 'published').length,
    first_order: firstOrderSiteIds,
    paying: payingSiteIds,
  };

  const rows = EXECUTIVE_FUNNEL_STEPS.map((step) => {
    const baseline = step.step_index === 0 ? counts.signup : counts[EXECUTIVE_FUNNEL_STEPS[step.step_index - 1].step_key];
    const current = counts[step.step_key];
    return {
      period_date: input.periodDate,
      step_key: step.step_key,
      step_index: step.step_index,
      count: current,
      conversion_rate_bps: baseline > 0 ? Math.round((current / baseline) * 10000) : 0,
      definition_version: EXECUTIVE_ANALYTICS_DEFINITION_VERSION,
      computed_at: input.computedAt,
      request_id: input.requestId,
      actor_type: 'worker',
      metadata: {
        label: step.label,
        source_tables: ['users_custom', 'sites', 'orders', 'subscriptions'],
      },
    };
  });

  await upsertSupabaseRows(env, 'funnel_steps', rows, {
    onConflict: 'period_date,step_key,definition_version',
    prefer: 'resolution=merge-duplicates,return=representation',
  });

  return rows.length;
}

async function writeCohortSnapshots(env: SupabaseServiceEnv, input: {
  periodDate: string;
  computedAt: string;
  requestId: string | null;
}): Promise<number> {
  const sites = await readRows<SiteRow>(env, 'sites', {
    select: 'id,status,published,created_at,published_at,deleted_at',
    deleted_at: 'is.null',
  });

  const cohorts = new Map<string, SiteRow[]>();
  for (const site of sites) {
    const cohort = monthStart(site.created_at);
    if (!cohort) continue;
    const rows = cohorts.get(cohort) || [];
    rows.push(site);
    cohorts.set(cohort, rows);
  }

  const snapshots = Array.from(cohorts.entries()).map(([cohortMonth, cohortSites]) => {
    const retained = cohortSites.filter((site) => (
      site.status === 'published'
      || site.published === true
      || site.status === 'active'
      || site.status === 'frozen'
    ));
    const converted = cohortSites.filter((site) => dateOnly(site.published_at));
    return {
      cohort_month: cohortMonth,
      period_index: monthsBetween(cohortMonth, input.periodDate),
      metric_key: 'active_stores',
      cohort_size: cohortSites.length,
      retained_count: retained.length,
      conversion_count: converted.length,
      definition_version: EXECUTIVE_ANALYTICS_DEFINITION_VERSION,
      computed_at: input.computedAt,
      request_id: input.requestId,
      actor_type: 'worker',
      metadata: {
        source_table: 'sites',
      },
    };
  });

  if (snapshots.length === 0) return 0;

  await upsertSupabaseRows(env, 'cohort_snapshots', snapshots, {
    onConflict: 'cohort_month,period_index,metric_key,definition_version',
    prefer: 'resolution=merge-duplicates,return=representation',
  });

  return snapshots.length;
}

async function writeCompanyHealth(env: SupabaseServiceEnv, input: {
  periodDate: string;
  computedAt: string;
  requestId: string | null;
}): Promise<number> {
  const [openTickets, breachedSla, highRiskScores, openTsCases, openIncidents, errorBudgetRows] = await Promise.all([
    countRows(env, 'support_tickets', { status: 'in.(open,pending)', deleted_at: 'is.null' }).catch(() => 0),
    countRows(env, 'ticket_sla_clocks', { breached: 'eq.true', satisfied_at: 'is.null', deleted_at: 'is.null' }).catch(() => 0),
    countRows(env, 'risk_scores', { band: 'eq.high', status: 'in.(open,restricted)', deleted_at: 'is.null' }).catch(() => 0),
    countRows(env, 'ts_cases', { status: 'in.(open,in_review,enforced,appealed)', deleted_at: 'is.null' }).catch(() => 0),
    countRows(env, 'production_incidents', { status: 'in.(open,mitigating)', deleted_at: 'is.null' }).catch(() => 0),
    readRows<JsonRecord>(env, 'runtime_telemetry_metrics', {
      select: 'id,metric_name,metric_value,unit,recorded_at,deleted_at',
      metric_name: 'ilike.*error_budget*',
      deleted_at: 'is.null',
      order: 'recorded_at.desc',
      limit: '1',
    }).catch(() => []),
  ]);

  const errorBudget = errorBudgetRows[0];
  const rows = [
    { metric_key: 'support.open_tickets', value: openTickets, unit: 'count', source_table: 'support_tickets' },
    { metric_key: 'support.sla_breaches', value: breachedSla, unit: 'count', source_table: 'ticket_sla_clocks' },
    { metric_key: 'risk.high_scores', value: highRiskScores, unit: 'count', source_table: 'risk_scores' },
    { metric_key: 'trust_safety.open_cases', value: openTsCases, unit: 'count', source_table: 'ts_cases' },
    { metric_key: 'incidents.open', value: openIncidents, unit: 'count', source_table: 'production_incidents' },
    {
      metric_key: 'error_budget.latest',
      value: errorBudget ? numberField(errorBudget.metric_value) : 0,
      unit: errorBudget ? String(errorBudget.unit || 'unknown') : 'unavailable',
      source_table: 'runtime_telemetry_metrics',
      source_metric: errorBudget ? errorBudget.metric_name : null,
    },
  ].map((metric) => ({
    metric_key: metric.metric_key,
    dimension: {},
    period_date: input.periodDate,
    value: metric.value,
    unit: metric.unit,
    definition_version: EXECUTIVE_ANALYTICS_DEFINITION_VERSION,
    computed_at: input.computedAt,
    request_id: input.requestId,
    actor_type: 'worker',
    metadata: metric,
  }));

  await upsertSupabaseRows(env, 'metric_rollups', rows, {
    onConflict: 'metric_key,dimension,period_date,definition_version',
    prefer: 'resolution=merge-duplicates,return=representation',
  });

  return rows.length;
}

export function isExecutiveAnalyticsJob(jobType: string): boolean {
  return jobType === 'executive.analytics.rollup' || jobType === 'executive.analytics.rollup_nightly';
}

export async function runExecutiveAnalyticsRollup(
  env: SupabaseServiceEnv,
  input: { periodDate?: string; requestId?: string | null; reason?: string },
): Promise<Omit<ExecutiveAnalyticsRollupResult, 'processed' | 'skipped' | 'failed'>> {
  const periodDate = input.periodDate && /^\d{4}-\d{2}-\d{2}$/.test(input.periodDate)
    ? input.periodDate
    : new Date().toISOString().slice(0, 10);
  const computedAt = new Date().toISOString();
  const requestId = input.requestId || `executive-analytics:${periodDate}`;

  const [mrrRollupsWritten, funnelStepsWritten, cohortSnapshotsWritten, metricRollupsWritten] = await Promise.all([
    writeMrrRollup(env, { periodDate, computedAt, requestId }),
    writeFunnelSteps(env, { periodDate, computedAt, requestId }),
    writeCohortSnapshots(env, { periodDate, computedAt, requestId }),
    writeCompanyHealth(env, { periodDate, computedAt, requestId }),
  ]);

  await writeAudit(env, {
    action: 'executive_analytics.rollup',
    reason: input.reason || 'Executive analytics rollup computed by queue worker.',
    requestId,
    metadata: {
      period_date: periodDate,
      mrr_rollups_written: mrrRollupsWritten,
      funnel_steps_written: funnelStepsWritten,
      cohort_snapshots_written: cohortSnapshotsWritten,
      metric_rollups_written: metricRollupsWritten,
    },
  });

  return {
    mrrRollupsWritten,
    funnelStepsWritten,
    cohortSnapshotsWritten,
    metricRollupsWritten,
  };
}

export async function processExecutiveAnalyticsDeliveries(
  env: SupabaseServiceEnv,
  deliveries: ExecutiveAnalyticsDelivery[],
): Promise<ExecutiveAnalyticsRollupResult> {
  const result: ExecutiveAnalyticsRollupResult = {
    processed: 0,
    skipped: 0,
    mrrRollupsWritten: 0,
    funnelStepsWritten: 0,
    cohortSnapshotsWritten: 0,
    metricRollupsWritten: 0,
    failed: 0,
  };

  for (const delivery of deliveries) {
    if (delivery.status === 'dead-lettered' || !isExecutiveAnalyticsJob(delivery.input.jobType)) {
      result.skipped += 1;
      continue;
    }

    try {
      const payload = isRecord(delivery.input.payload) ? delivery.input.payload : {};
      const rollup = await runExecutiveAnalyticsRollup(env, {
        periodDate: periodDateFromPayload(payload),
        requestId: delivery.input.requestId,
        reason: stringField(payload.reason) || 'Executive analytics rollup requested by queue delivery.',
      });
      result.mrrRollupsWritten += rollup.mrrRollupsWritten;
      result.funnelStepsWritten += rollup.funnelStepsWritten;
      result.cohortSnapshotsWritten += rollup.cohortSnapshotsWritten;
      result.metricRollupsWritten += rollup.metricRollupsWritten;
      result.processed += 1;
    } catch {
      result.failed += 1;
    }
  }

  return result;
}
