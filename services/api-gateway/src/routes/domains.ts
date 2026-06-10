import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import type { Env } from '../index';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { getCustomDomainCnameTarget } from '../lib/custom-domain-config';
import { createDomainRegistrarProvider } from '../lib/registrar';
import { dbErrorBody, getSupabaseAdmin, success } from '../lib/supabase';
import { attachVercelProjectDomain, readVercelDomainStatus } from '../lib/vercel-domains';

const router = new Hono<{ Bindings: Env }>();

const DomainSearchSchema = z.object({
    query: z.string().min(3).max(255),
});

const DomainPurchaseSchema = z.object({
    site_id: z.string().uuid(),
    domain: z.string().min(3).max(255),
    years: z.number().int().min(1).max(10).default(1),
    checkout_mode: z.enum(['sandbox', 'external_reference']).optional(),
    owner: z.object({
        name: z.string().min(1).max(160),
        email: z.string().email(),
        phone: z.string().max(40).optional().nullable(),
    }),
    payment_reference: z.string().min(3).max(180),
});

function normalizeDomain(input: string): string | null {
    const trimmed = input.trim().toLowerCase();
    if (!trimmed) return null;
    try {
        const url = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
        const host = url.hostname.replace(/\.$/, '');
        if (!host || host.includes('_') || host.length > 255) return null;
        return host;
    } catch {
        return null;
    }
}

async function requireOwnedSite(c: Context<{ Bindings: Env }>, siteId: string) {
    const db = getSupabaseAdmin(c);
    const auth = c.get('auth');
    const customUser = await resolveCustomUser(db, auth.user);
    if (!customUser || !(await verifySiteOwnership(db, siteId, customUser.id, auth.user.storeId))) {
        return { db, customUser: null, response: c.json({ error: { code: 'STORE_NOT_FOUND', message: 'Store not found or access denied' } }, 404) };
    }
    return { db, customUser, response: null };
}

function idempotencyKey(c: Context<{ Bindings: Env }>, domain: string, siteId: string): string {
    const header = c.req.header('X-Idempotency-Key')?.trim();
    return header || `domain-order:${siteId}:${domain}`;
}

function registrarErrorBody(error: unknown) {
    const code = error && typeof error === 'object' && 'code' in error && typeof error.code === 'string'
        ? error.code
        : 'REGISTRAR_ERROR';
    const message = code.endsWith('_REQUIRED') || code.endsWith('_FORBIDDEN')
        ? 'Domain checkout is temporarily unavailable.'
        : 'Domain registrar request could not complete.';
    return { error: { code, message } };
}

router.get('/search', async (c) => {
    const parsed = DomainSearchSchema.safeParse({ query: c.req.query('query') || c.req.query('domain') || '' });
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message || 'Invalid domain search' } }, 400);
    }
    const domain = normalizeDomain(parsed.data.query);
    if (!domain) return c.json({ error: { code: 'INVALID_DOMAIN', message: 'Domain is invalid' } }, 400);

    try {
        const provider = createDomainRegistrarProvider(c.env);
        return c.json(success(await provider.searchDomain(domain)));
    } catch (error) {
        return c.json(registrarErrorBody(error), 503);
    }
});

router.post('/purchase', async (c) => {
    const parsed = DomainPurchaseSchema.safeParse(await c.req.json().catch(() => null));
    if (!parsed.success) {
        return c.json({ error: { code: 'VALIDATION', message: parsed.error.issues[0]?.message || 'Invalid domain purchase' } }, 400);
    }
    const domain = normalizeDomain(parsed.data.domain);
    if (!domain) return c.json({ error: { code: 'INVALID_DOMAIN', message: 'Domain is invalid' } }, 400);

    let provider;
    let target: string;
    try {
        provider = createDomainRegistrarProvider(c.env);
        target = getCustomDomainCnameTarget(c.env);
    } catch (error) {
        return c.json(registrarErrorBody(error), 503);
    }

    const { db, customUser, response } = await requireOwnedSite(c, parsed.data.site_id);
    if (response) return response;

    const key = idempotencyKey(c, domain, parsed.data.site_id);
    const quote = await provider.searchDomain(domain);
    if (!quote.available) {
        return c.json({ error: { code: 'DOMAIN_UNAVAILABLE', message: 'Domain is unavailable', details: quote } }, 409);
    }
    const checkoutMode = parsed.data.checkout_mode || (provider.name === 'sandbox' ? 'sandbox' : 'external_reference');
    if (checkoutMode === 'sandbox' && provider.name !== 'sandbox') {
        return c.json({
            error: {
                code: 'DOMAIN_CHECKOUT_MODE_UNAVAILABLE',
                message: 'Domain checkout is temporarily unavailable.',
            },
        }, 409);
    }
    const checkoutStatus = checkoutMode === 'sandbox' ? 'verified' : 'reference_recorded';

    const { data: order, error: orderError } = await db
        .from('domain_orders')
        .upsert({
            site_id: parsed.data.site_id,
            domain,
            provider: provider.name,
            status: 'registering',
            years: parsed.data.years,
            currency: quote.currency,
            amount_minor: quote.amountMinor,
            payment_provider: 'razorpay',
            payment_reference: parsed.data.payment_reference,
            idempotency_key: key,
            created_by: customUser?.id || null,
            updated_by: customUser?.id || null,
        }, { onConflict: 'idempotency_key' })
        .select('id')
        .single();

    if (orderError || !order) return c.json(dbErrorBody(), 500);

    try {
        const purchase = await provider.purchaseDomain({
            domain,
            years: parsed.data.years,
            owner: parsed.data.owner,
            paymentReference: parsed.data.payment_reference,
            idempotencyKey: key,
        });
        const dns = await provider.configureDns(domain, target);
        await attachVercelProjectDomain(c.env, domain);
        const vercel = await readVercelDomainStatus(c.env, domain);

        const { error: siteError } = await db
            .from('sites')
            .update({
                custom_domain: domain,
                custom_domain_status: vercel.status,
                updated_by: customUser?.id || null,
            })
            .eq('id', parsed.data.site_id);
        if (siteError) throw new Error(siteError.message);

        await db
            .from('domain_orders')
            .update({
                status: vercel.status === 'active' ? 'active' : 'provisioning',
                registrar_order_id: purchase.registrarOrderId,
                registrar_payload: purchase.raw,
                dns_payload: dns.raw,
                vercel_payload: {
                    status: vercel.status,
                    configured_by: vercel.configuredBy,
                    misconfigured: vercel.misconfigured,
                },
                completed_at: vercel.status === 'active' ? new Date().toISOString() : null,
                updated_by: customUser?.id || null,
            })
            .eq('id', order.id);

        return c.json(success({
            order_id: order.id,
            domain,
            provider: provider.name,
            status: vercel.status,
            registrar_order_id: purchase.registrarOrderId,
            dns_configured: dns.configured,
            checkout: {
                mode: checkoutMode,
                status: checkoutStatus,
                payment_reference: parsed.data.payment_reference,
                amount_minor: quote.amountMinor,
                currency: quote.currency,
            },
        }), 201);
    } catch (error) {
        await db
            .from('domain_orders')
            .update({
                status: 'failed',
                failure_reason: error instanceof Error ? error.message : 'Domain purchase failed',
                updated_by: customUser?.id || null,
            })
            .eq('id', order.id);
        return c.json(registrarErrorBody(error), 503);
    }
});

export default router;
