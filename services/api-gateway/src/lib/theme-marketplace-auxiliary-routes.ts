import type { Context, Hono } from 'hono';
import type { Env } from '../index';
import { EventExecutionAdapter } from '../execution/event-execution.adapter';
import { resolveCustomUser } from './auth-user';
import { dbErrorBody, getSupabaseAdmin, success } from './supabase';
import { validate } from '../middleware/validation';
import {
    ThemeDeveloperListingSchema,
    ThemeMarketplaceSettingsSchema,
    ThemeSavedSearchSchema,
    type ThemeDeveloperListingInput,
    type ThemeMarketplaceSettingsInput,
    type ThemeSavedSearchInput,
} from '../schemas/theme.schema';

type ThemeRouter = Hono<{ Bindings: Env }>;

type CustomUserRecord = {
    id: string;
    email?: string | null;
    full_name?: string | null;
    avatar_url?: string | null;
};

function getRequestId(c: Context<{ Bindings: Env }>): string {
    return c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || crypto.randomUUID();
}

function recordValue(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
        ? value as Record<string, unknown>
        : {};
}

function sanitizeSearch(value: string | undefined): string | null {
    if (!value) return null;
    const cleaned = value.trim().replace(/[,%]/g, ' ').replace(/\s+/g, ' ');
    return cleaned.length > 0 ? cleaned.slice(0, 120) : null;
}

function receiptNumber(purchaseId: string): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `LBTH-${date}-${purchaseId.replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

function invoiceNumber(purchaseId: string): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `LBTH-GST-${date}-${purchaseId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

function licenseKey(): string {
    return `LB-THEME-${crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
}

const THEME_MARKETPLACE_GST_RATE = 18;
const THEME_MARKETPLACE_DEV_GSTIN = '27ABCDE1234F1Z5';

function envString(c: Context<{ Bindings: Env }>, key: string): string | null {
    const value = (c.env as unknown as Record<string, string | undefined>)[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function themeMarketplaceSellerGstin(c: Context<{ Bindings: Env }>): string {
    return envString(c, 'THEME_MARKETPLACE_GSTIN') || envString(c, 'GSTIN') || THEME_MARKETPLACE_DEV_GSTIN;
}

function themeMarketplaceGstAmount(amountInr: number): number {
    if (!Number.isFinite(amountInr) || amountInr <= 0) return 0;
    return Number((amountInr * THEME_MARKETPLACE_GST_RATE / (100 + THEME_MARKETPLACE_GST_RATE)).toFixed(2));
}

function themeMarketplaceInvoiceJson(
    c: Context<{ Bindings: Env }>,
    input: {
        purchaseId: string;
        themeSlug: unknown;
        provider?: unknown;
        providerPaymentId?: unknown;
        amountInr: number;
    }
): Record<string, unknown> {
    const sellerGstin = themeMarketplaceSellerGstin(c);
    return {
        purchase_id: input.purchaseId,
        theme_slug: typeof input.themeSlug === 'string' ? input.themeSlug : null,
        provider: typeof input.provider === 'string' ? input.provider : 'local',
        provider_payment_id: typeof input.providerPaymentId === 'string' ? input.providerPaymentId : null,
        seller_gstin: sellerGstin,
        gstin_source: sellerGstin === THEME_MARKETPLACE_DEV_GSTIN ? 'dev_placeholder' : 'environment',
        gst_rate: THEME_MARKETPLACE_GST_RATE,
        gst_amount_inr: themeMarketplaceGstAmount(input.amountInr),
        tax_treatment: 'gst_inclusive',
        invoice_mode: 'local_dev_default',
    };
}

function localThemeArtifactContent(theme: Record<string, unknown>, artifact: Record<string, unknown>): string {
    return [
        'LetBuyy local theme artifact',
        `theme=${String(theme.slug || theme.name || 'theme')}`,
        `platform=${String(artifact.platform || 'letbuyy')}`,
        `artifact_key=${String(artifact.artifact_key || '')}`,
        `checksum=${String(artifact.checksum_sha256 || 'local-dev-checksum')}`,
        'This local package proves entitlement, size, and signed-url delivery in development.',
    ].join('\n');
}

function localThemeArtifactSizeBytes(content: string): number {
    return new TextEncoder().encode(content).length;
}

function localThemeArtifactSignedUrl(content: string): string {
    return `data:application/zip;charset=utf-8,${encodeURIComponent(content)}`;
}

function localThemeAssetScan(input: ThemeDeveloperListingInput): {
    status: 'passed' | 'failed';
    metadata: Record<string, unknown>;
} {
    const serialized = JSON.stringify({
        name: input.name,
        slug: input.slug,
        screenshots: input.screenshots,
        bundle_manifest: input.bundle_manifest,
        tags: input.tags,
    }).toLowerCase();
    const suspiciousPattern = /(eicar|malware|virus|trojan|eval\(|<script)/i;
    const failed = suspiciousPattern.test(serialized);
    return {
        status: failed ? 'failed' : 'passed',
        metadata: {
            scanner: 'local-theme-asset-scanner',
            scanned_at: new Date().toISOString(),
            checks: ['manifest-json', 'screenshot-url-list', 'basic-malware-keywords'],
        },
    };
}

async function requireCustomUser(c: Context<{ Bindings: Env }>): Promise<CustomUserRecord | Response> {
    const auth = c.get('auth');
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user) as CustomUserRecord | null;

    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }

    return customUser;
}

export function mountThemeMarketplaceAuxiliaryRoutes(router: ThemeRouter): void {
    router.get('/suggest', async (c) => {
        const queryText = sanitizeSearch(c.req.query('q'));
        const db = getSupabaseAdmin(c);

        if (!queryText) {
            return c.json(success({ themes: [], tags: [], industries: [], features: [] }));
        }

        const { data, error } = await db
            .from('themes')
            .select('slug, name, category, tags, industry, features')
            .eq('is_active', true)
            .or(`name.ilike.%${queryText}%,description.ilike.%${queryText}%`)
            .limit(12);

        if (error) return c.json(dbErrorBody(), 500);

        const records = data || [];
        const lower = queryText.toLowerCase();
        const pickMatches = (values: unknown[]): string[] => [
            ...new Set(
                values
                    .flatMap((value) => Array.isArray(value) ? value : [])
                    .filter((value): value is string => typeof value === 'string' && value.toLowerCase().includes(lower))
            ),
        ].slice(0, 10);

        return c.json(success({
            themes: records.map((theme) => ({
                slug: theme.slug,
                name: theme.name,
                category: theme.category,
            })),
            tags: pickMatches(records.map((theme) => theme.tags)),
            industries: pickMatches(records.map((theme) => theme.industry)),
            features: pickMatches(records.map((theme) => theme.features)),
        }));
    });

    router.get('/collections', async (c) => {
        const db = getSupabaseAdmin(c);
        const { data, error } = await db
            .from('theme_collections')
            .select('*')
            .eq('is_published', true)
            .is('deleted_at', null)
            .order('sort_order', { ascending: true });

        if (error) return c.json(dbErrorBody(), 500);
        return c.json(success(data || []));
    });

    router.get('/collections/:slug', async (c) => {
        const db = getSupabaseAdmin(c);
        const slug = c.req.param('slug');

        const { data: collection, error } = await db
            .from('theme_collections')
            .select('*')
            .eq('slug', slug)
            .eq('is_published', true)
            .is('deleted_at', null)
            .maybeSingle();

        if (error) return c.json(dbErrorBody(), 500);
        if (!collection) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'Theme collection not found' } }, 404);
        }

        const rule = recordValue(collection.rule);
        let themesQuery = db
            .from('themes')
            .select('*')
            .eq('is_active', true);

        if (typeof rule.pricing === 'string') themesQuery = themesQuery.eq('letbuyy_pricing_type', rule.pricing);
        if (typeof rule.category === 'string') themesQuery = themesQuery.eq('category', rule.category);

        if (collection.collection_type === 'manual') {
            const { data: items, error: itemsError } = await db
                .from('theme_collection_items')
                .select('sort_order, themes(*)')
                .eq('collection_id', collection.id)
                .is('deleted_at', null)
                .order('sort_order', { ascending: true });

            if (itemsError) return c.json(dbErrorBody(), 500);
            const themes = (items || []).map((item) => item.themes).filter(Boolean);
            return c.json(success({ ...collection, themes }));
        }

        const sort = typeof rule.sort === 'string' ? rule.sort : 'popular';
        if (sort === 'recent') {
            themesQuery = themesQuery.order('created_at', { ascending: false });
        } else {
            themesQuery = themesQuery
                .order('rating_avg', { ascending: false })
                .order('install_count', { ascending: false })
                .order('created_at', { ascending: false });
        }

        const { data: themes, error: themesError } = await themesQuery.limit(12);
        if (themesError) return c.json(dbErrorBody(), 500);

        return c.json(success({ ...collection, themes: themes || [] }));
    });

    router.get('/authors/:handle', async (c) => {
        const db = getSupabaseAdmin(c);
        const handle = c.req.param('handle');

        const { data: profile, error } = await db
            .from('developer_profiles')
            .select('*')
            .eq('handle', handle)
            .is('deleted_at', null)
            .maybeSingle();

        if (error) return c.json(dbErrorBody(), 500);
        if (!profile) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'Author profile not found' } }, 404);
        }

        const { data: themes } = await db
            .from('themes')
            .select('*')
            .eq('author_handle', handle)
            .eq('is_active', true)
            .order('created_at', { ascending: false });

        return c.json(success({ ...profile, themes: themes || [] }));
    });

    router.get('/purchases/list', async (c) => {
        const auth = c.get('auth');
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const { data, error } = await db
            .from('theme_purchases')
            .select('*, themes(*), theme_purchase_receipts(*)')
            .eq('user_id', customUser.id)
            .order('purchased_at', { ascending: false });

        if (error) return c.json(dbErrorBody(), 500);
        return c.json(success(data || []));
    });

    router.get('/purchases/:purchaseId/receipt', async (c) => {
        const db = getSupabaseAdmin(c);
        const customUser = await requireCustomUser(c);
        if (customUser instanceof Response) return customUser;
        const purchaseId = c.req.param('purchaseId');

        const { data: purchase, error } = await db
            .from('theme_purchases')
            .select('*, themes(*)')
            .eq('id', purchaseId)
            .eq('user_id', customUser.id)
            .is('deleted_at', null)
            .maybeSingle();

        if (error) return c.json(dbErrorBody(), 500);
        if (!purchase) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'Theme purchase not found' } }, 404);
        }

        const { data: existingReceipt } = await db
            .from('theme_purchase_receipts')
            .select('*')
            .eq('purchase_id', purchaseId)
            .is('deleted_at', null)
            .maybeSingle();

        if (existingReceipt) {
            return c.json(success({ ...existingReceipt, purchase }));
        }

        if (purchase.status !== 'completed') {
            return c.json(success({
                purchase,
                receipt_status: 'pending_payment_completion',
                receipt_number: null,
                license_key: purchase.license_key || null,
            }));
        }

        const amountInr = Number(purchase.price_paid_inr || 0);
        const gstAmountInr = themeMarketplaceGstAmount(amountInr);
        const { data: receipt, error: receiptError } = await db
            .from('theme_purchase_receipts')
            .insert({
                purchase_id: purchaseId,
                receipt_number: receiptNumber(purchaseId),
                invoice_number: invoiceNumber(purchaseId),
                license_key: purchase.license_key || licenseKey(),
                amount_inr: amountInr,
                currency: purchase.currency || 'INR',
                gst_rate: THEME_MARKETPLACE_GST_RATE,
                gst_amount_inr: gstAmountInr,
                seller_gstin: themeMarketplaceSellerGstin(c),
                invoice_json: themeMarketplaceInvoiceJson(c, {
                    purchaseId,
                    themeSlug: recordValue(purchase.themes).slug,
                    provider: purchase.payment_provider,
                    providerPaymentId: purchase.provider_payment_id,
                    amountInr,
                }),
                created_by: customUser.id,
                updated_by: customUser.id,
            })
            .select('*')
            .single();

        if (receiptError || !receipt) return c.json(dbErrorBody(), 500);
        return c.json(success({ ...receipt, purchase }), 201);
    });

    router.get('/installations/list', async (c) => {
        const auth = c.get('auth');
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const { data: sites, error: sitesError } = await db
            .from('sites')
            .select('id')
            .or(`custom_user_id.eq.${customUser.id},user_id.eq.${customUser.id}`)
            .is('deleted_at', null);

        if (sitesError) return c.json(dbErrorBody(), 500);

        const siteIds = (sites || []).map((site) => site.id as string);
        if (siteIds.length === 0) return c.json(success([]));

        const { data, error } = await db
            .from('store_themes')
            .select('*, themes(*), sites(subdomain, custom_domain)')
            .in('store_id', siteIds)
            .order('installed_at', { ascending: false });

        if (error) return c.json(dbErrorBody(), 500);
        return c.json(success(data || []));
    });

    router.get('/downloads/list', async (c) => {
        const db = getSupabaseAdmin(c);
        const customUser = await requireCustomUser(c);
        if (customUser instanceof Response) return customUser;

        const { data: purchases, error } = await db
            .from('theme_purchases')
            .select('*, themes(*)')
            .eq('user_id', customUser.id)
            .eq('status', 'completed')
            .is('deleted_at', null)
            .order('purchased_at', { ascending: false });

        if (error) return c.json(dbErrorBody(), 500);

        const themeIds = [...new Set((purchases || []).map((purchase) => recordValue(purchase.themes).id).filter((id): id is string => typeof id === 'string'))];
        const artifactsByTheme = new Map<string, unknown[]>();

        if (themeIds.length > 0) {
            const { data: artifacts, error: artifactError } = await db
                .from('theme_download_artifacts')
                .select('*')
                .in('theme_id', themeIds)
                .is('deleted_at', null)
                .order('platform', { ascending: true });

            if (artifactError) return c.json(dbErrorBody(), 500);

            for (const artifact of artifacts || []) {
                const themeId = String(artifact.theme_id);
                artifactsByTheme.set(themeId, [...(artifactsByTheme.get(themeId) || []), artifact]);
            }
        }

        return c.json(success((purchases || []).map((purchase) => {
            const theme = recordValue(purchase.themes);
            const artifacts = (artifactsByTheme.get(String(theme.id)) || []).map((artifact) => {
                const artifactRecord = recordValue(artifact);
                const content = localThemeArtifactContent(theme, artifactRecord);
                return {
                    ...artifactRecord,
                    size_bytes: typeof artifactRecord.size_bytes === 'number'
                        ? artifactRecord.size_bytes
                        : localThemeArtifactSizeBytes(content),
                    delivery_status: artifactRecord.delivery_status === 'disabled' ? 'disabled' : 'available',
                    storage_provider: artifactRecord.storage_provider || 'local-object-store',
                    signed_url: artifactRecord.delivery_status === 'disabled' ? null : localThemeArtifactSignedUrl(content),
                    expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
                };
            });
            return {
                purchase,
                theme,
                artifacts,
            };
        })));
    });

    router.get('/settings', async (c) => {
        const db = getSupabaseAdmin(c);
        const customUser = await requireCustomUser(c);
        if (customUser instanceof Response) return customUser;

        const { data, error } = await db
            .from('theme_marketplace_settings')
            .select('*')
            .eq('user_id', customUser.id)
            .is('deleted_at', null)
            .maybeSingle();

        if (error) return c.json(dbErrorBody(), 500);

        return c.json(success(data || {
            user_id: customUser.id,
            display_name: customUser.full_name || '',
            support_email: customUser.email || '',
            notification_preferences: {},
            saved_filters: {},
            plan_snapshot: { plan: 'not_configured' },
        }));
    });

    router.put('/settings', validate('json', ThemeMarketplaceSettingsSchema), async (c) => {
        const db = getSupabaseAdmin(c);
        const customUser = await requireCustomUser(c);
        if (customUser instanceof Response) return customUser;
        const body = c.get('validatedBody') as ThemeMarketplaceSettingsInput;

        const { data, error } = await db
            .from('theme_marketplace_settings')
            .upsert(
                {
                    user_id: customUser.id,
                    display_name: body.display_name || customUser.full_name || null,
                    support_email: body.support_email || customUser.email || null,
                    notification_preferences: body.notification_preferences || {},
                    saved_filters: body.saved_filters || {},
                    updated_by: customUser.id,
                    created_by: customUser.id,
                },
                { onConflict: 'user_id' }
            )
            .select('*')
            .single();

        if (error || !data) return c.json(dbErrorBody(), 500);
        return c.json(success(data));
    });

    router.get('/saved-searches', async (c) => {
        const db = getSupabaseAdmin(c);
        const customUser = await requireCustomUser(c);
        if (customUser instanceof Response) return customUser;

        const { data, error } = await db
            .from('theme_saved_searches')
            .select('*')
            .eq('user_id', customUser.id)
            .is('deleted_at', null)
            .order('created_at', { ascending: false });

        if (error) return c.json(dbErrorBody(), 500);
        return c.json(success(data || []));
    });

    router.post('/saved-searches', validate('json', ThemeSavedSearchSchema), async (c) => {
        const db = getSupabaseAdmin(c);
        const customUser = await requireCustomUser(c);
        if (customUser instanceof Response) return customUser;
        const body = c.get('validatedBody') as ThemeSavedSearchInput;

        const { data, error } = await db
            .from('theme_saved_searches')
            .upsert(
                {
                    user_id: customUser.id,
                    name: body.name,
                    query: body.query,
                    alerts_enabled: body.alerts_enabled,
                    created_by: customUser.id,
                    updated_by: customUser.id,
                },
                { onConflict: 'user_id,name' }
            )
            .select('*')
            .single();

        if (error || !data) return c.json(dbErrorBody(), 500);
        return c.json(success(data), 201);
    });

    router.get('/developer/dashboard', async (c) => {
        const db = getSupabaseAdmin(c);
        const customUser = await requireCustomUser(c);
        if (customUser instanceof Response) return customUser;

        const [{ data: listings }, { data: payoutAccount }] = await Promise.all([
            db
                .from('theme_developer_listings')
                .select('*')
                .eq('developer_user_id', customUser.id)
                .is('deleted_at', null)
                .order('created_at', { ascending: false }),
            db
                .from('theme_developer_payout_accounts')
                .select('*')
                .eq('developer_user_id', customUser.id)
                .is('deleted_at', null)
                .maybeSingle(),
        ]);

        return c.json(success({
            listings: listings || [],
            payout_account: payoutAccount || {
                onboarding_status: 'active',
                revenue_share_rate: 15,
                payout_schedule: 'monthly',
                payout_provider: 'manual',
                metadata: {
                    dev_default: true,
                    payout_provider_cutover: 'operator chooses razorpay_route, upi, or manual at go-live',
                },
            },
        }));
    });

    router.post('/developer/listings', validate('json', ThemeDeveloperListingSchema), async (c) => {
        const db = getSupabaseAdmin(c);
        const customUser = await requireCustomUser(c);
        if (customUser instanceof Response) return customUser;
        const body = c.get('validatedBody') as ThemeDeveloperListingInput;

        if (body.submit && !body.agreement_accepted) {
            return c.json({ error: { code: 'AGREEMENT_REQUIRED', message: 'Developer agreement acceptance is required before submission' } }, 400);
        }

        const scan = localThemeAssetScan(body);
        if (scan.status === 'failed') {
            return c.json({ error: { code: 'ASSET_SCAN_FAILED', message: 'Theme package scan failed local safety checks' } }, 422);
        }

        const { data, error } = await db
            .from('theme_developer_listings')
            .upsert(
                {
                    developer_user_id: customUser.id,
                    slug: body.slug,
                    name: body.name,
                    short_description: body.short_description,
                    long_description: body.long_description || null,
                    category: body.category,
                    industries: body.industries,
                    tags: body.tags,
                    supported_platforms: body.supported_platforms,
                    screenshots: body.screenshots,
                    pricing: body.pricing,
                    license_tiers: body.license_tiers,
                    bundle_manifest: {
                        ...recordValue(body.bundle_manifest),
                        asset_scan: scan.metadata,
                    },
                    asset_scan_status: scan.status,
                    agreement_accepted_at: body.agreement_accepted ? new Date().toISOString() : null,
                    submission_status: body.submit ? 'submitted' : 'draft',
                    created_by: customUser.id,
                    updated_by: customUser.id,
                },
                { onConflict: 'developer_user_id,slug' }
            )
            .select('*')
            .single();

        if (error || !data) return c.json(dbErrorBody(), 500);

        if (body.submit) {
            await new EventExecutionAdapter(db).emitDomainEvent({
                storeId: null,
                aggregateType: 'theme_developer_listing',
                aggregateId: String(data.id),
                eventType: 'theme.developer_listing.submitted',
                idempotencyKey: `theme.developer_listing.submitted:${data.id}:${data.updated_at}`,
                requestId: getRequestId(c),
                actorId: customUser.id,
                payload: {
                    listing_id: data.id,
                    slug: data.slug,
                    asset_scan_status: data.asset_scan_status,
                },
            });
        }

        return c.json(success(data), body.submit ? 201 : 200);
    });
}
