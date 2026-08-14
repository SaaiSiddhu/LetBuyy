// ──────────────────────────────────────────────────────────────────────────────
// Theme Purchase & Receipt Routes
//
// Extracted from themes.ts into dedicated sub-router module.
// Mounted via mountThemePurchaseRoutes(router) in themes.ts.
//
// Routes registered:
//   POST /themes/:slug/purchase
//   POST /themes/:slug/purchase/verify
// ──────────────────────────────────────────────────────────────────────────────

import type { Context, Hono } from 'hono';
import type { Env } from '../../index';
import { EventExecutionAdapter } from '../../execution/event-execution.adapter';
import { resolveCustomUser } from '../../lib/auth-user';
import { hmacSha256Hex, timingSafeEqualHex } from '../../lib/crypto';
import { errorBody, getSupabaseAdmin, success } from '../../lib/supabase';
import { validate } from '../../middleware/validation';
import {
    ThemePurchaseOrderSchema,
    ThemePurchaseVerifySchema,
    type ThemePurchaseOrderInput,
    type ThemePurchaseVerifyInput,
} from '../../schemas/theme.schema';
import { createRazorpayOrder } from '@letbuyy/infrastructure/razorpay-adapter';

type ThemePurchaseTheme = {
    id: string;
    slug: string;
    name: string;
    is_premium?: boolean | null;
    letbuyy_pricing_type?: string | null;
    letbuyy_price_inr?: number | null;
    letbuyy_price_usd?: number | null;
};

type ThemePurchaseRecord = {
    id: string;
    status?: string | null;
    provider_order_id?: string | null;
    provider_payment_id?: string | null;
    payment_idempotency_key?: string | null;
};

const THEME_MARKETPLACE_GST_RATE = 18;
const THEME_MARKETPLACE_DEV_GSTIN = '27ABCDE1234F1Z5';

function getRequestId(c: Context<{ Bindings: Env }>): string {
    return c.res.headers.get('X-Request-ID') || c.req.header('X-Request-ID') || crypto.randomUUID();
}

function licenseKey(): string {
    return `LB-THEME-${crypto.randomUUID().replace(/-/g, '').slice(0, 16).toUpperCase()}`;
}

function receiptNumber(purchaseId: string): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `LBTH-${date}-${purchaseId.replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

function invoiceNumber(purchaseId: string): string {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    return `LBTH-GST-${date}-${purchaseId.replace(/-/g, '').slice(0, 8).toUpperCase()}`;
}

function envString(c: Context<{ Bindings: Env }>, key: string): string | null {
    const value = (c.env as unknown as Record<string, string | undefined>)[key];
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

function isProductionLikeRuntime(c: Context<{ Bindings: Env }>): boolean {
    return ['ENVIRONMENT', 'APP_ENV', 'NODE_ENV', 'VERCEL_ENV']
        .some((key) => envString(c, key)?.toLowerCase() === 'production');
}

function configuredThemeMarketplaceSellerGstin(c: Context<{ Bindings: Env }>): string | null {
    return envString(c, 'THEME_MARKETPLACE_GSTIN') || envString(c, 'GSTIN');
}

function themeMarketplaceSellerGstin(c: Context<{ Bindings: Env }>): string {
    return configuredThemeMarketplaceSellerGstin(c) || THEME_MARKETPLACE_DEV_GSTIN;
}

function themeMarketplaceGstinSource(c: Context<{ Bindings: Env }>): 'environment' | 'local_dev_default' {
    return configuredThemeMarketplaceSellerGstin(c) ? 'environment' : 'local_dev_default';
}

function requireThemeMarketplaceSellerGstin(c: Context<{ Bindings: Env }>): string | Response {
    const configured = configuredThemeMarketplaceSellerGstin(c);
    if (configured) return configured;
    if (!isProductionLikeRuntime(c)) return THEME_MARKETPLACE_DEV_GSTIN;

    return c.json(
        { error: { code: 'THEME_MARKETPLACE_GSTIN_REQUIRED', message: 'Theme marketplace GSTIN must be configured before production receipts can be issued.' } },
        503,
    );
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
        gstin_source: themeMarketplaceGstinSource(c),
        gst_rate: THEME_MARKETPLACE_GST_RATE,
        gst_amount_inr: themeMarketplaceGstAmount(input.amountInr),
        tax_treatment: 'gst_inclusive',
        invoice_mode: themeMarketplaceGstinSource(c) === 'environment' ? 'live' : 'local_dev_default',
    };
}

export function mountThemePurchaseRoutes(router: Hono<{ Bindings: Env }>): void {
    // POST /themes/:slug/purchase — Create a server-priced Razorpay order for a paid theme
    router.post('/:slug/purchase', validate('json', ThemePurchaseOrderSchema), async (c) => {
        const auth = c.get('auth');
        const slug = c.req.param('slug');
        const body = c.get('validatedBody') as ThemePurchaseOrderInput;
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        const { data: theme, error: themeError } = await db
            .from('themes')
            .select('id, slug, name, is_premium, letbuyy_pricing_type, letbuyy_price_inr, letbuyy_price_usd')
            .eq('slug', slug)
            .single();

        if (themeError || !theme) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'Theme not found' } }, 404);
        }

        const purchasableTheme = theme as ThemePurchaseTheme;
        const pricingType = purchasableTheme.letbuyy_pricing_type || (purchasableTheme.is_premium ? 'one_time' : 'free');
        const priceInr = Number(purchasableTheme.letbuyy_price_inr || 0);
        const amountPaise = Math.round(priceInr * 100);

        const { data: existingPurchase } = await db
            .from('theme_purchases')
            .select('id, status, provider_order_id, provider_payment_id, payment_idempotency_key')
            .eq('user_id', customUser.id)
            .eq('theme_id', purchasableTheme.id)
            .maybeSingle();

        const existing = existingPurchase as ThemePurchaseRecord | null;
        if (existing?.status === 'completed') {
            return c.json(success({
                purchase_id: existing.id,
                theme: purchasableTheme.name,
                status: 'completed',
                already_purchased: true,
            }));
        }

        if (pricingType === 'free' || amountPaise <= 0) {
            const { data: freePurchase, error } = await db
                .from('theme_purchases')
                .upsert(
                    {
                        user_id: customUser.id,
                        theme_id: purchasableTheme.id,
                        price_paid_inr: 0,
                        price_paid_usd: 0,
                        currency: body.currency,
                        payment_method: 'free',
                        payment_provider: 'free',
                        status: 'completed',
                        payment_processed_at: new Date().toISOString(),
                        license_key: licenseKey(),
                    },
                    { onConflict: 'user_id,theme_id' }
                )
                .select('id, status, license_key')
                .single();

            if (error || !freePurchase) {
                throw new Error('Unable to record free theme purchase');
            }

            const { count: completedPurchaseCount } = await db
                .from('theme_purchases')
                .select('id', { count: 'exact', head: true })
                .eq('theme_id', purchasableTheme.id)
                .eq('status', 'completed')
                .is('deleted_at', null);

            if (typeof completedPurchaseCount === 'number') {
                await db
                    .from('themes')
                    .update({ purchase_count: completedPurchaseCount })
                    .eq('id', purchasableTheme.id);
            }

            return c.json(success({
                purchase_id: freePurchase.id,
                theme: purchasableTheme.name,
                status: 'completed',
                payment_required: false,
                license_key: freePurchase.license_key,
            }), 201);
        }

        const paymentProviderMode = envString(c, 'PAYMENTS_PROVIDER') || 'sandbox';
        const hasRazorpayKeys = Boolean(c.env.RAZORPAY_KEY_ID && c.env.RAZORPAY_KEY_SECRET);
        const productionLike = isProductionLikeRuntime(c);
        const shouldUseSandboxPayment = !productionLike && (paymentProviderMode === 'sandbox' || !hasRazorpayKeys);

        if (shouldUseSandboxPayment) {
            const issuedLicenseKey = licenseKey();
            const sandboxPaymentId = `theme_sandbox_${crypto.randomUUID().replace(/-/g, '').slice(0, 18)}`;
            const { data: sandboxPurchase, error } = await db
                .from('theme_purchases')
                .upsert(
                    {
                        user_id: customUser.id,
                        theme_id: purchasableTheme.id,
                        price_paid_inr: priceInr,
                        price_paid_usd: purchasableTheme.letbuyy_price_usd || 0,
                        currency: body.currency,
                        payment_method: 'sandbox',
                        payment_provider: 'sandbox',
                        payment_id: sandboxPaymentId,
                        provider_order_id: `theme_sandbox_order_${purchasableTheme.id.slice(0, 8)}`,
                        provider_payment_id: sandboxPaymentId,
                        payment_idempotency_key: body.idempotency_key || null,
                        status: 'completed',
                        payment_processed_at: new Date().toISOString(),
                        license_key: issuedLicenseKey,
                    },
                    { onConflict: 'user_id,theme_id' }
                )
                .select('id, status, provider_payment_id, price_paid_inr, currency, license_key')
                .single();

            if (error || !sandboxPurchase) {
                throw new Error('Unable to record sandbox theme purchase');
            }

            const amountInr = Number(sandboxPurchase.price_paid_inr || 0);
            const gstAmountInr = themeMarketplaceGstAmount(amountInr);
            const sellerGstin = themeMarketplaceSellerGstin(c);
            const { data: receipt } = await db
                .from('theme_purchase_receipts')
                .upsert(
                    {
                        purchase_id: sandboxPurchase.id,
                        receipt_number: receiptNumber(String(sandboxPurchase.id)),
                        invoice_number: invoiceNumber(String(sandboxPurchase.id)),
                        license_key: sandboxPurchase.license_key || issuedLicenseKey,
                        amount_inr: amountInr,
                        currency: sandboxPurchase.currency || 'INR',
                        gst_rate: THEME_MARKETPLACE_GST_RATE,
                        gst_amount_inr: gstAmountInr,
                        seller_gstin: sellerGstin,
                        invoice_json: themeMarketplaceInvoiceJson(c, {
                            purchaseId: String(sandboxPurchase.id),
                            themeSlug: slug,
                            provider: 'sandbox',
                            providerPaymentId: String(sandboxPurchase.provider_payment_id || sandboxPaymentId),
                            amountInr,
                        }),
                        created_by: customUser.id,
                        updated_by: customUser.id,
                    },
                    { onConflict: 'purchase_id' }
                )
                .select('*')
                .maybeSingle();

            const { count: completedPurchaseCount } = await db
                .from('theme_purchases')
                .select('id', { count: 'exact', head: true })
                .eq('theme_id', purchasableTheme.id)
                .eq('status', 'completed')
                .is('deleted_at', null);

            if (typeof completedPurchaseCount === 'number') {
                await db
                    .from('themes')
                    .update({ purchase_count: completedPurchaseCount })
                    .eq('id', purchasableTheme.id);
            }

            const requestId = getRequestId(c);
            await new EventExecutionAdapter(db).emitDomainEvent({
                storeId: null,
                aggregateType: 'theme_purchase',
                aggregateId: String(sandboxPurchase.id),
                eventType: 'theme.purchase.completed',
                idempotencyKey: `theme.purchase.completed:sandbox:${sandboxPurchase.id}`,
                requestId,
                actorId: customUser.id,
                payload: {
                    theme_id: purchasableTheme.id,
                    theme_slug: slug,
                    provider: 'sandbox',
                    provider_payment_id: sandboxPurchase.provider_payment_id || sandboxPaymentId,
                    dev_default: true,
                },
            });

            return c.json(success({
                purchase_id: sandboxPurchase.id,
                theme: purchasableTheme.name,
                status: 'completed',
                provider: 'sandbox',
                payment_required: false,
                license_key: sandboxPurchase.license_key || issuedLicenseKey,
                receipt,
            }), 201);
        }

        if (!hasRazorpayKeys) {
            return c.json({ error: { code: 'PAYMENT_UNAVAILABLE', message: 'Razorpay keys are required when theme payments are not sandbox.' } }, 503);
        }

        if (
            existing?.status === 'pending' &&
            existing.provider_order_id &&
            body.idempotency_key &&
            existing.payment_idempotency_key === body.idempotency_key
        ) {
            return c.json(success({
                purchase_id: existing.id,
                theme: purchasableTheme.name,
                status: 'pending',
                provider: 'razorpay',
                razorpay_order_id: existing.provider_order_id,
                amount: amountPaise,
                currency: body.currency,
                key_id: c.env.RAZORPAY_KEY_ID,
                idempotent_replay: true,
            }));
        }

        const requestId = getRequestId(c);
        const razorpayOrder = await createRazorpayOrder(
            { keyId: c.env.RAZORPAY_KEY_ID, keySecret: c.env.RAZORPAY_KEY_SECRET },
            {
                amount: amountPaise,
                currency: body.currency,
                receipt: `theme_${purchasableTheme.id.slice(0, 8)}_${Date.now()}`,
                notes: {
                    theme_id: purchasableTheme.id,
                    theme_slug: slug,
                    user_id: customUser.id,
                    idempotency_key: body.idempotency_key || '',
                    request_id: requestId,
                },
            }
        );

        if (!razorpayOrder.id) {
            return c.json(
                errorBody('PAYMENT_PROVIDER_ERROR', 'Failed to create theme payment order'),
                502
            );
        }

        const { data: purchase, error } = await db
            .from('theme_purchases')
            .upsert(
                {
                    user_id: customUser.id,
                    theme_id: purchasableTheme.id,
                    price_paid_inr: priceInr,
                    price_paid_usd: purchasableTheme.letbuyy_price_usd || 0,
                    currency: body.currency,
                    payment_method: 'razorpay',
                    payment_provider: 'razorpay',
                    payment_id: razorpayOrder.id,
                    provider_order_id: razorpayOrder.id,
                    payment_idempotency_key: body.idempotency_key || null,
                    status: 'pending',
                },
                { onConflict: 'user_id,theme_id' }
            )
            .select('id, status, provider_order_id')
            .single();

        if (error || !purchase) {
            throw new Error('Unable to record pending theme purchase');
        }

        const events = new EventExecutionAdapter(db);
        await events.emitDomainEvent({
            storeId: null,
            aggregateType: 'theme_purchase',
            aggregateId: String(purchase.id),
            eventType: 'theme.purchase.payment_order_created',
            idempotencyKey: `theme.purchase.order:${razorpayOrder.id}`,
            requestId,
            actorId: customUser.id,
            payload: {
                theme_id: purchasableTheme.id,
                theme_slug: slug,
                provider: 'razorpay',
                provider_order_id: razorpayOrder.id,
                amount: razorpayOrder.amount ?? amountPaise,
                currency: razorpayOrder.currency || body.currency,
            },
        });

        return c.json(success({
            purchase_id: purchase.id,
            theme: purchasableTheme.name,
            status: 'pending',
            provider: 'razorpay',
            razorpay_order_id: razorpayOrder.id,
            amount: razorpayOrder.amount ?? amountPaise,
            currency: razorpayOrder.currency || body.currency,
            key_id: c.env.RAZORPAY_KEY_ID,
        }), 201);
    });

    // POST /themes/:slug/purchase/verify — Verify Razorpay signature and complete purchase
    router.post('/:slug/purchase/verify', validate('json', ThemePurchaseVerifySchema), async (c) => {
        const auth = c.get('auth');
        const slug = c.req.param('slug');
        const body = c.get('validatedBody') as ThemePurchaseVerifyInput;
        const db = getSupabaseAdmin(c);
        const customUser = await resolveCustomUser(db, auth.user);

        if (!customUser) {
            return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
        }

        if (!c.env.RAZORPAY_KEY_SECRET) {
            return c.json({ error: { code: 'PAYMENT_UNAVAILABLE', message: 'Razorpay test secret is required for Razorpay verification' } }, 503);
        }

        const expected = await hmacSha256Hex(
            c.env.RAZORPAY_KEY_SECRET,
            `${body.razorpay_order_id}|${body.razorpay_payment_id}`
        );

        if (!timingSafeEqualHex(expected, body.razorpay_signature)) {
            return c.json({ error: { code: 'PAYMENT_SIGNATURE_INVALID', message: 'Payment verification failed' } }, 400);
        }

        const { data: theme, error: themeError } = await db
            .from('themes')
            .select('id, slug, name')
            .eq('slug', slug)
            .single();

        if (themeError || !theme) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'Theme not found' } }, 404);
        }

        const issuedLicenseKey = licenseKey();
        const { data: purchase, error } = await db
            .from('theme_purchases')
            .update({
                status: 'completed',
                payment_method: 'razorpay',
                payment_provider: 'razorpay',
                payment_id: body.razorpay_payment_id,
                provider_payment_id: body.razorpay_payment_id,
                payment_signature: body.razorpay_signature,
                payment_processed_at: new Date().toISOString(),
                license_key: issuedLicenseKey,
            })
            .eq('user_id', customUser.id)
            .eq('theme_id', theme.id)
            .eq('provider_order_id', body.razorpay_order_id)
            .select('id, status, provider_payment_id, price_paid_inr, currency, license_key')
            .single();

        if (error || !purchase) {
            return c.json({ error: { code: 'NOT_FOUND', message: 'Pending theme purchase not found' } }, 404);
        }

        const requestId = getRequestId(c);
        const events = new EventExecutionAdapter(db);
        await events.emitDomainEvent({
            storeId: null,
            aggregateType: 'theme_purchase',
            aggregateId: String(purchase.id),
            eventType: 'theme.purchase.completed',
            idempotencyKey: `theme.purchase.completed:razorpay:${body.razorpay_payment_id}`,
            requestId,
            actorId: customUser.id,
            payload: {
                theme_id: theme.id,
                theme_slug: slug,
                provider: 'razorpay',
                provider_order_id: body.razorpay_order_id,
                provider_payment_id: body.razorpay_payment_id,
            },
        });

        await events.emitAuditEvent({
            actorId: customUser.id,
            action: 'theme.purchase.complete',
            resourceType: 'theme_purchase',
            resourceId: String(purchase.id),
            requestId,
            afterState: {
                theme_id: theme.id,
                theme_slug: slug,
                status: 'completed',
                provider: 'razorpay',
            },
        });

        const amountInr = Number(purchase.price_paid_inr || 0);
        const gstAmountInr = themeMarketplaceGstAmount(amountInr);
        const sellerGstin = requireThemeMarketplaceSellerGstin(c);
        if (sellerGstin instanceof Response) return sellerGstin;

        const { data: receipt } = await db
            .from('theme_purchase_receipts')
            .upsert(
                {
                    purchase_id: purchase.id,
                    receipt_number: receiptNumber(String(purchase.id)),
                    invoice_number: invoiceNumber(String(purchase.id)),
                    license_key: purchase.license_key || issuedLicenseKey,
                    amount_inr: amountInr,
                    currency: purchase.currency || 'INR',
                    gst_rate: THEME_MARKETPLACE_GST_RATE,
                    gst_amount_inr: gstAmountInr,
                    seller_gstin: sellerGstin,
                    invoice_json: themeMarketplaceInvoiceJson(c, {
                        purchaseId: String(purchase.id),
                        themeSlug: slug,
                        provider: 'razorpay',
                        providerPaymentId: body.razorpay_payment_id,
                        amountInr,
                    }),
                    created_by: customUser.id,
                    updated_by: customUser.id,
                },
                { onConflict: 'purchase_id' }
            )
            .select('*')
            .maybeSingle();

        const { count: completedPurchaseCount } = await db
            .from('theme_purchases')
            .select('id', { count: 'exact', head: true })
            .eq('theme_id', theme.id)
            .eq('status', 'completed')
            .is('deleted_at', null);

        if (typeof completedPurchaseCount === 'number') {
            await db
                .from('themes')
                .update({ purchase_count: completedPurchaseCount })
                .eq('id', theme.id);
        }

        return c.json(success({
            purchase_id: purchase.id,
            theme: theme.name,
            status: purchase.status,
            provider_payment_id: purchase.provider_payment_id,
            license_key: purchase.license_key || issuedLicenseKey,
            receipt,
        }));
    });
}
