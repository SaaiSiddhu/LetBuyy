import type { Context } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin } from './supabase';

export type DeveloperOpsDb = ReturnType<typeof getSupabaseAdmin>;
export type JsonRecord = Record<string, unknown>;

export interface DeveloperOverviewOptions {
    actorId?: string | null;
    actorEmail?: string | null;
    actorType?: 'employee' | 'super_admin' | 'system';
    reason?: string | null;
    auditRead?: boolean;
}

const DEVELOPER_COLUMNS = 'id, user_id, company_name, slug, website_url, support_email, logo_url, description, verified, status, country, created_at, updated_at';
const APP_COLUMNS = 'id, developer_id, slug, name, tagline, description, type, status, icon_url, pricing_model, price_inr, install_count, rating_avg, review_count, api_scopes, webhook_url, version, app_url, metadata, created_at, updated_at';
const CHARGE_COLUMNS = 'id, site_id, app_id, partner_id, installation_id, billing_mode, status, name, amount_minor, currency, revenue_share_bps, partner_amount_minor, platform_fee_minor, partner_gst_minor, payout_rail, provider, provider_mode, approved_at, activated_at, metadata, created_at, updated_at';
const PAYOUT_COLUMNS = 'id, partner_id, site_id, app_id, installation_id, charge_id, billing_mode, amount_minor, currency, revenue_share_bps, partner_amount_minor, platform_fee_minor, status, rail, held_at, hold_reason, hold_actor_id, hold_metadata, metadata, created_at, updated_at';
const REVIEW_COLUMNS = 'id, submission_type, resource_id, resource_slug, resource_name, partner_user_id, app_developer_id, status, automated_checks, submitted_at, reviewed_by, reviewed_at, review_notes, metadata, created_at, updated_at';

export function stringValue(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

export function numberValue(value: unknown): number {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim()) {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return 0;
}

export function recordValue(value: unknown): JsonRecord {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonRecord : {};
}

export function isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function sumMinor(rows: JsonRecord[], key: string): number {
    return rows.reduce((total, row) => total + numberValue(row[key]), 0);
}

export function rangeFor(page: number, limit: number) {
    const from = (page - 1) * limit;
    return { from, to: from + limit - 1 };
}

function appIdsFromRows(rows: JsonRecord[]): string[] {
    return rows.map((row) => stringValue(row.id)).filter((id): id is string => Boolean(id));
}

function latestRows(rows: JsonRecord[], limit: number): JsonRecord[] {
    return rows.slice(0, limit);
}

function byStatus(rows: JsonRecord[], key = 'status'): Record<string, number> {
    return rows.reduce<Record<string, number>>((acc, row) => {
        const status = stringValue(row[key]) || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});
}

function byRail(rows: JsonRecord[]): Record<string, { count: number; partner_amount_minor: number }> {
    return rows.reduce<Record<string, { count: number; partner_amount_minor: number }>>((acc, row) => {
        const rail = stringValue(row.rail) || stringValue(row.payout_rail) || 'manual';
        const current = acc[rail] || { count: 0, partner_amount_minor: 0 };
        acc[rail] = {
            count: current.count + 1,
            partner_amount_minor: current.partner_amount_minor + numberValue(row.partner_amount_minor),
        };
        return acc;
    }, {});
}

export async function writeDeveloperAudit(
    db: DeveloperOpsDb,
    input: {
        actorId?: string | null;
        actorEmail?: string | null;
        actorType?: 'employee' | 'super_admin' | 'system';
        action: string;
        resourceType: string;
        resourceId?: string | null;
        reason?: string | null;
        metadata?: JsonRecord;
    },
) {
    await db.from('audit_logs').insert({
        actor_id: input.actorId || null,
        actor_type: input.actorType || 'employee',
        actor_email: input.actorEmail || null,
        action: input.action,
        resource_type: input.resourceType,
        resource_id: input.resourceId || null,
        metadata: {
            ...(input.metadata || {}),
            reason: input.reason || null,
        },
    });
}

export async function readDeveloperByIdOrSlug(db: DeveloperOpsDb, idOrSlug: string): Promise<JsonRecord | null> {
    const value = idOrSlug.trim();
    const query = db
        .from('app_developers')
        .select(DEVELOPER_COLUMNS)
        .limit(1);

    const { data, error } = isUuid(value)
        ? await query.eq('id', value).maybeSingle()
        : await query.eq('slug', value).maybeSingle();

    if (error) throw new Error(`Developer lookup failed: ${error.message}`);
    return data ? data as JsonRecord : null;
}

export async function searchDeveloperProfiles(
    db: DeveloperOpsDb,
    input: { q?: string; status?: string; page: number; limit: number },
): Promise<{ rows: JsonRecord[]; total: number }> {
    const { from, to } = rangeFor(input.page, input.limit);
    let query = db
        .from('app_developers')
        .select(DEVELOPER_COLUMNS, { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to);

    if (input.status && input.status !== 'all') query = query.eq('status', input.status);

    const q = input.q?.trim();
    if (q) {
        if (isUuid(q)) {
            query = query.or(`id.eq.${q},user_id.eq.${q}`);
        } else {
            const escaped = q.replace(/[%_,]/g, '').slice(0, 80);
            query = query.or(`company_name.ilike.%${escaped}%,slug.ilike.%${escaped}%,support_email.ilike.%${escaped}%`);
        }
    }

    const { data, error, count } = await query;
    if (error) throw new Error(`Developer search failed: ${error.message}`);
    return { rows: (data || []) as JsonRecord[], total: count || 0 };
}

export async function buildDeveloperOverview(
    db: DeveloperOpsDb,
    developerIdOrSlug: string,
    options: DeveloperOverviewOptions = {},
): Promise<JsonRecord | null> {
    const developer = await readDeveloperByIdOrSlug(db, developerIdOrSlug);
    if (!developer) return null;

    const developerId = stringValue(developer.id) || '';
    const ownerId = stringValue(developer.user_id);

    const [
        ownerResult,
        appsResult,
        chargesResult,
        payoutsResult,
        reviewsResult,
        reconciliationResult,
        disputesResult,
        auditResult,
    ] = await Promise.all([
        ownerId
            ? db.from('users_custom').select('id, email, email_verified, full_name, avatar_url, auth_provider, created_at, updated_at').eq('id', ownerId).maybeSingle()
            : Promise.resolve({ data: null, error: null }),
        db.from('marketplace_apps').select(APP_COLUMNS).eq('developer_id', developerId).order('created_at', { ascending: false }),
        db.from('app_billing_charges').select(CHARGE_COLUMNS).eq('partner_id', developerId).is('deleted_at', null).order('created_at', { ascending: false }).limit(200),
        db.from('partner_payout_ledger_entries').select(PAYOUT_COLUMNS).eq('partner_id', developerId).is('deleted_at', null).order('created_at', { ascending: false }).limit(200),
        db.from('marketplace_review_records').select(REVIEW_COLUMNS).eq('app_developer_id', developerId).is('deleted_at', null).order('submitted_at', { ascending: false }).limit(50),
        db.from('payout_reconciliation_records').select('*').eq('partner_id', developerId).is('deleted_at', null).order('checked_at', { ascending: false }).limit(50),
        db.from('payout_disputes').select('*').eq('partner_id', developerId).is('deleted_at', null).order('opened_at', { ascending: false }).limit(50),
        db.from('audit_logs').select('id, actor_id, actor_type, actor_email, action, resource_type, resource_id, metadata, created_at')
            .eq('resource_id', developerId)
            .in('resource_type', ['app_developer', 'developer', 'partner_payout'])
            .order('created_at', { ascending: false })
            .limit(25),
    ]);

    const dbError = ownerResult.error || appsResult.error || chargesResult.error || payoutsResult.error
        || reviewsResult.error || reconciliationResult.error || disputesResult.error || auditResult.error;
    if (dbError) throw new Error(`Developer overview query failed: ${dbError.message}`);

    const apps = (appsResult.data || []) as JsonRecord[];
    const appIds = appIdsFromRows(apps);

    const [
        installationsResult,
        webhooksResult,
        developerCasesResult,
        appCasesResult,
    ] = await Promise.all([
        appIds.length > 0
            ? db.from('app_installations').select('id, app_id, store_id, site_id, status, installed_at, uninstalled_at, scopes_granted').in('app_id', appIds).limit(300)
            : Promise.resolve({ data: [], error: null }),
        appIds.length > 0
            ? db.from('app_webhooks').select('id, app_id, event, url, is_active, created_at').in('app_id', appIds)
            : Promise.resolve({ data: [], error: null }),
        db.from('ts_cases').select('id, subject_type, subject_id, category, severity, status, title, assignee_id, created_at, updated_at').eq('subject_type', 'developer').eq('subject_id', developerId).is('deleted_at', null).order('created_at', { ascending: false }).limit(25),
        appIds.length > 0
            ? db.from('ts_cases').select('id, subject_type, subject_id, category, severity, status, title, assignee_id, created_at, updated_at').eq('subject_type', 'app').in('subject_id', appIds).is('deleted_at', null).order('created_at', { ascending: false }).limit(25)
            : Promise.resolve({ data: [], error: null }),
    ]);

    const relatedError = installationsResult.error || webhooksResult.error || developerCasesResult.error || appCasesResult.error;
    if (relatedError) throw new Error(`Developer related context query failed: ${relatedError.message}`);

    const charges = (chargesResult.data || []) as JsonRecord[];
    const payouts = (payoutsResult.data || []) as JsonRecord[];
    const installations = (installationsResult.data || []) as JsonRecord[];
    const webhooks = (webhooksResult.data || []) as JsonRecord[];
    const reconciliationRecords = (reconciliationResult.data || []) as JsonRecord[];
    const disputes = (disputesResult.data || []) as JsonRecord[];
    const billableCharges = charges.filter((row) => ['approved', 'active'].includes(String(row.status)));
    const pendingPayouts = payouts.filter((row) => ['pending', 'processing'].includes(String(row.status)));
    const heldPayouts = payouts.filter((row) => stringValue(row.held_at));
    const expectedPartnerAmount = sumMinor(billableCharges, 'partner_amount_minor');
    const ledgerPartnerAmount = sumMinor(payouts, 'partner_amount_minor');
    const releasedPartnerAmount = sumMinor(payouts.filter((row) => row.status === 'released'), 'partner_amount_minor');
    const pendingPartnerAmount = sumMinor(pendingPayouts, 'partner_amount_minor');
    const mismatchAmount = sumMinor(reconciliationRecords.filter((row) => row.status === 'mismatch'), 'delta_minor');

    if (options.auditRead) {
        await writeDeveloperAudit(db, {
            actorId: options.actorId,
            actorEmail: options.actorEmail,
            actorType: options.actorType || 'employee',
            action: 'developer.view',
            resourceType: 'app_developer',
            resourceId: developerId,
            reason: options.reason || null,
            metadata: { audit_kind: 'sensitive_read', surface: 'developer_360' },
        });
    }

    return {
        developer,
        owner: ownerResult.data ? ownerResult.data as JsonRecord : null,
        apps,
        installations,
        webhooks,
        review_records: (reviewsResult.data || []) as JsonRecord[],
        charges,
        payouts,
        trust_safety_cases: [
            ...((developerCasesResult.data || []) as JsonRecord[]),
            ...((appCasesResult.data || []) as JsonRecord[]),
        ],
        reconciliation_records: reconciliationRecords,
        disputes,
        audit_events: (auditResult.data || []) as JsonRecord[],
        analytics: {
            total_apps: apps.length,
            published_apps: apps.filter((app) => app.status === 'published').length,
            suspended_apps: apps.filter((app) => app.status === 'suspended').length,
            active_installations: installations.filter((row) => row.status === 'active').length,
            gross_amount_minor: sumMinor(billableCharges, 'amount_minor'),
            expected_partner_amount_minor: expectedPartnerAmount,
            ledger_partner_amount_minor: ledgerPartnerAmount,
            released_partner_amount_minor: releasedPartnerAmount,
            pending_partner_amount_minor: pendingPartnerAmount,
            held_partner_amount_minor: sumMinor(heldPayouts, 'partner_amount_minor'),
            reconciliation_delta_minor: expectedPartnerAmount - ledgerPartnerAmount,
            open_mismatch_amount_minor: mismatchAmount,
            open_disputes: disputes.filter((row) => ['open', 'in_review', 'waiting_partner'].includes(String(row.status))).length,
            open_trust_safety_cases: [...((developerCasesResult.data || []) as JsonRecord[]), ...((appCasesResult.data || []) as JsonRecord[])]
                .filter((row) => ['open', 'under_review', 'actioned', 'appealed'].includes(String(row.status))).length,
            currency: 'INR',
            apps_by_status: byStatus(apps),
            payouts_by_status: byStatus(payouts),
            payout_rail_breakdown: byRail(payouts),
            webhook_health: {
                total: webhooks.length,
                active: webhooks.filter((row) => row.is_active === true).length,
                inactive: webhooks.filter((row) => row.is_active !== true).length,
            },
        },
        recent: {
            charges: latestRows(charges, 10),
            payouts: latestRows(payouts, 10),
            reviews: latestRows((reviewsResult.data || []) as JsonRecord[], 10),
            reconciliation: latestRows(reconciliationRecords, 10),
            disputes: latestRows(disputes, 10),
        },
    };
}

export async function reconcileDeveloperPayouts(
    db: DeveloperOpsDb,
    input: {
        developerId: string;
        actorId: string | null;
        reason: string;
        requestId?: string | null;
        limit?: number;
    },
): Promise<{ records: JsonRecord[]; summary: JsonRecord }> {
    const limit = Math.max(1, Math.min(500, input.limit || 250));
    const [{ data: charges, error: chargesError }, { data: payouts, error: payoutsError }] = await Promise.all([
        db.from('app_billing_charges')
            .select(CHARGE_COLUMNS)
            .eq('partner_id', input.developerId)
            .in('status', ['approved', 'active'])
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(limit),
        db.from('partner_payout_ledger_entries')
            .select(PAYOUT_COLUMNS)
            .eq('partner_id', input.developerId)
            .is('deleted_at', null)
            .limit(limit * 2),
    ]);

    if (chargesError || payoutsError) {
        throw new Error(`Payout reconciliation query failed: ${chargesError?.message || payoutsError?.message || 'unknown error'}`);
    }

    const payoutRows = (payouts || []) as JsonRecord[];
    const records: JsonRecord[] = [];
    let matched = 0;
    let mismatched = 0;
    let totalDelta = 0;

    for (const charge of (charges || []) as JsonRecord[]) {
        const chargeId = stringValue(charge.id);
        if (!chargeId) continue;

        const linkedPayouts = payoutRows.filter((payout) => stringValue(payout.charge_id) === chargeId);
        const ledgerPartnerAmount = sumMinor(linkedPayouts, 'partner_amount_minor');
        const expectedPartnerAmount = numberValue(charge.partner_amount_minor);
        const delta = expectedPartnerAmount - ledgerPartnerAmount;
        const status = delta === 0 && linkedPayouts.length > 0 ? 'matched' : 'mismatch';
        const reconciliationKey = `app-charge:${chargeId}`;
        const row = {
            partner_id: input.developerId,
            payout_ledger_entry_id: stringValue(linkedPayouts[0]?.id),
            charge_id: chargeId,
            app_id: stringValue(charge.app_id),
            site_id: stringValue(charge.site_id),
            reconciliation_key: reconciliationKey,
            expected_partner_amount_minor: expectedPartnerAmount,
            ledger_partner_amount_minor: ledgerPartnerAmount,
            delta_minor: delta,
            currency: stringValue(charge.currency) || 'INR',
            status,
            reason: input.reason,
            checked_at: new Date().toISOString(),
            metadata: {
                charge_status: stringValue(charge.status),
                payout_count: linkedPayouts.length,
                payout_ids: linkedPayouts.map((payout) => stringValue(payout.id)).filter(Boolean),
            },
            actor_type: 'employee',
            actor_id: input.actorId,
            request_id: input.requestId || null,
            created_by: input.actorId,
            updated_by: input.actorId,
        };

        const { data: existing, error: existingError } = await db
            .from('payout_reconciliation_records')
            .select('id')
            .eq('reconciliation_key', reconciliationKey)
            .is('deleted_at', null)
            .maybeSingle();
        if (existingError) throw new Error(`Payout reconciliation lookup failed: ${existingError.message}`);

        const updateRow = {
            partner_id: row.partner_id,
            payout_ledger_entry_id: row.payout_ledger_entry_id,
            charge_id: row.charge_id,
            app_id: row.app_id,
            site_id: row.site_id,
            reconciliation_key: row.reconciliation_key,
            expected_partner_amount_minor: row.expected_partner_amount_minor,
            ledger_partner_amount_minor: row.ledger_partner_amount_minor,
            delta_minor: row.delta_minor,
            currency: row.currency,
            status: row.status,
            reason: row.reason,
            checked_at: row.checked_at,
            metadata: row.metadata,
            actor_type: row.actor_type,
            actor_id: row.actor_id,
            request_id: row.request_id,
            updated_by: row.updated_by,
        };

        const { data: persisted, error: persistError } = existing
            ? await db
                .from('payout_reconciliation_records')
                .update(updateRow)
                .eq('id', existing.id)
                .select('*')
                .single()
            : await db
                .from('payout_reconciliation_records')
                .insert(row)
                .select('*')
                .single();

        if (persistError) throw new Error(`Payout reconciliation write failed: ${persistError.message}`);
        if (persisted) records.push(persisted as JsonRecord);
        if (status === 'matched') matched += 1;
        if (status === 'mismatch') mismatched += 1;
        totalDelta += delta;
    }

    return {
        records,
        summary: {
            checked: records.length,
            matched,
            mismatched,
            total_delta_minor: totalDelta,
            currency: 'INR',
        },
    };
}

export function requestIdFromContext(c: Context<{ Bindings: Env }>): string | null {
    return c.req.header('X-Request-ID') || null;
}
