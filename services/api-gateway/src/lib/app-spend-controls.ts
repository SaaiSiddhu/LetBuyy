import { appUsageBillingPeriod } from '@letbuyy/billing-core';
import { getSupabaseAdmin } from './supabase';

export interface AppSpendSnapshot {
    control: Record<string, unknown> | null;
    period_start: string;
    period_end: string;
    current_amount_minor: number;
    projected_amount_minor: number;
    over_cap: boolean;
    over_alert_threshold: boolean;
    blocking: boolean;
}

function numberValue(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function textValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function sumAmountMinor(rows: unknown): number {
    if (!Array.isArray(rows)) return 0;
    return rows.reduce((sum, row) => {
        const record = row && typeof row === 'object' && !Array.isArray(row) ? row as Record<string, unknown> : {};
        return sum + Math.max(0, Math.round(numberValue(record.amount_minor)));
    }, 0);
}

export async function readAppSpendSnapshot(
    db: ReturnType<typeof getSupabaseAdmin>,
    input: {
        siteId: string;
        projectedAmountMinor?: number;
    },
): Promise<{ ok: true; value: AppSpendSnapshot } | { ok: false; message: string }> {
    const period = appUsageBillingPeriod();
    const { data: control, error: controlError } = await db
        .from('app_spend_controls')
        .select('*')
        .eq('site_id', input.siteId)
        .is('deleted_at', null)
        .maybeSingle();

    if (controlError) return { ok: false, message: controlError.message };

    const [chargeResult, usageResult] = await Promise.all([
        db
            .from('app_billing_charges')
            .select('amount_minor')
            .eq('site_id', input.siteId)
            .neq('billing_mode', 'usage')
            .in('status', ['pending_merchant_approval', 'approved', 'trialing', 'active'])
            .gte('created_at', period.period_start)
            .lt('created_at', period.period_end)
            .is('deleted_at', null),
        db
            .from('app_usage_meter_rollups')
            .select('amount_minor')
            .eq('site_id', input.siteId)
            .eq('period_start', period.period_start)
            .eq('period_end', period.period_end)
            .is('deleted_at', null),
    ]);

    if (chargeResult.error) return { ok: false, message: chargeResult.error.message };
    if (usageResult.error) return { ok: false, message: usageResult.error.message };

    const currentAmountMinor = sumAmountMinor(chargeResult.data) + sumAmountMinor(usageResult.data);
    const projectedAmountMinor = currentAmountMinor + Math.max(0, Math.round(numberValue(input.projectedAmountMinor)));
    const controlRecord = control as Record<string, unknown> | null;
    const controlActive = textValue(controlRecord?.status) !== 'disabled';
    const monthlyCapMinor = Math.max(0, Math.round(numberValue(controlRecord?.monthly_cap_minor)));
    const alertThresholdMinor = Math.max(0, Math.round(numberValue(controlRecord?.alert_threshold_minor)));
    const overCap = controlActive && monthlyCapMinor > 0 && projectedAmountMinor > monthlyCapMinor;
    const overAlertThreshold = controlActive
        && Boolean(controlRecord?.alerts_enabled)
        && alertThresholdMinor > 0
        && projectedAmountMinor >= alertThresholdMinor;
    const blocking = overCap && textValue(controlRecord?.enforcement_mode) !== 'alert_only';

    return {
        ok: true,
        value: {
            control: controlRecord,
            period_start: period.period_start,
            period_end: period.period_end,
            current_amount_minor: currentAmountMinor,
            projected_amount_minor: projectedAmountMinor,
            over_cap: overCap,
            over_alert_threshold: overAlertThreshold,
            blocking,
        },
    };
}
