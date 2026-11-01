import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import {
    CalculateTaxSchema,
    generateGstInvoice,
    type CalculateTaxInput,
} from '@letbuyy/checkout-core';
import type { Env } from '../index';
import { AppError, HumanRequiredError } from '../lib/errors';
import { resolveTenantContextForOrder } from '../lib/tenant-context';
import { resolveCustomUser, verifySiteOwnership } from '../lib/auth-user';
import { getSupabaseAdmin, success } from '../lib/supabase';
import { validate } from '../middleware/validation';

const router = new Hono<{ Bindings: Env }>();

type DatabaseErrorLike = {
    message?: string;
    details?: string;
    hint?: string;
} | null | undefined;

interface OrderTaxRow {
    id: string;
    store_id?: string | null;
    site_id?: string | null;
    gst_invoice_number?: string | null;
    gst_invoice?: Record<string, unknown> | null;
}

interface GstInvoiceRow {
    id: string;
    site_id: string;
    order_id: string;
    invoice_number: string;
    invoice: Record<string, unknown>;
    irn: string;
    qr_payload: string;
    provider_ack?: Record<string, unknown> | null;
    status: string;
}

function databaseErrorText(error: DatabaseErrorLike): string {
    return [error?.message, error?.details, error?.hint].filter(Boolean).join(' ').toLowerCase();
}

function isMissingTaxSchemaError(error: DatabaseErrorLike): boolean {
    const text = databaseErrorText(error);
    return text.includes('gst_invoices') && (
        text.includes('does not exist') ||
        text.includes('schema cache') ||
        text.includes('could not find')
    );
}

function taxSetupError(c: Context<{ Bindings: Env }>) {
    return c.json({
        error: {
            code: 'TAX_IRP_SETUP_REQUIRED',
            message: 'GST e-invoice provider setup is not enabled for this environment.',
        },
    }, 503);
}

function assertSandboxIrpMode(env: Env) {
    const mode = env.LETBUYY_GST_IRP_MODE || 'sandbox';
    if (mode === 'live') {
        // [HUMAN-REQUIRED] HR-GST-IRP-LIVE: install IRP/e-way credentials and approve legal/provider policy before live e-invoice calls.
        throw new HumanRequiredError('[HUMAN-REQUIRED] GST IRP live credentials and policy approval are required.');
    }
}

function normalizeInvoiceRow(row: GstInvoiceRow) {
    return {
        id: row.id,
        site_id: row.site_id,
        order_id: row.order_id,
        invoice_number: row.invoice_number,
        status: row.status,
        irn: row.irn,
        qr_payload: row.qr_payload,
        provider_ack: row.provider_ack || {},
        invoice: row.invoice,
        source: 'gst_invoices',
    };
}

router.post('/calculate', validate('json', CalculateTaxSchema), async (c) => {
    try {
        assertSandboxIrpMode(c.env);
    } catch (error) {
        if (error instanceof HumanRequiredError) return taxSetupError(c);
        throw error;
    }

    const auth = c.get('auth');
    const body = c.get('validatedBody') as CalculateTaxInput;
    const db = getSupabaseAdmin(c);
    const customUser = await resolveCustomUser(db, auth.user);

    if (!body.store_id) {
        return c.json({ error: { code: 'VALIDATION', message: 'store_id required' } }, 400);
    }
    if (!customUser) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'User profile not found' } }, 403);
    }
    if (!(await verifySiteOwnership(db, body.store_id, customUser.id, auth.user.storeId))) {
        return c.json({ error: { code: 'FORBIDDEN', message: 'Not authorized' } }, 403);
    }

    const invoice = generateGstInvoice(body);
    return c.json(success({
        calculation: invoice,
        irp_mode: 'sandbox',
        irn: invoice.irp.irn,
        qr_payload: invoice.irp.qr_payload,
    }));
});

router.get('/invoice/:orderId', async (c) => {
    const orderId = c.req.param('orderId');
    if (!z.string().uuid().safeParse(orderId).success) {
        return c.json({ error: { code: 'VALIDATION', message: 'A valid order reference is required.' } }, 400);
    }
    const tenant = await resolveTenantContextForOrder(c, orderId);
    const siteId = tenant.siteId;
    const db = getSupabaseAdmin(c);

    const { data: orderData, error: orderError } = await db
        .from('orders')
        .select('id, store_id, site_id, gst_invoice_number, gst_invoice')
        .eq('id', orderId)
        .eq('store_id', siteId)
        .is('deleted_at', null)
        .maybeSingle();

    if (orderError) throw new AppError('The tax invoice could not be loaded. Please retry.', 503, 'TAX_INVOICE_UNAVAILABLE');

    const order = orderData as OrderTaxRow | null;
    if (!order) {
        return c.json({ error: { code: 'NOT_FOUND', message: 'Order not found' } }, 404);
    }

    const { data: invoiceData, error: invoiceError } = await db
        .from('gst_invoices')
        .select('id, site_id, order_id, invoice_number, invoice, irn, qr_payload, provider_ack, status')
        .eq('site_id', siteId)
        .eq('order_id', orderId)
        .is('deleted_at', null)
        .maybeSingle();

    if (invoiceError) {
        if (isMissingTaxSchemaError(invoiceError) && order.gst_invoice && order.gst_invoice_number) {
            return c.json(success({
                order_id: order.id,
                invoice_number: order.gst_invoice_number,
                invoice: order.gst_invoice,
                source: 'orders.gst_invoice',
            }));
        }
        if (isMissingTaxSchemaError(invoiceError)) {
            return c.json({ error: { code: 'TAX_SCHEMA_MISSING', message: 'Tax invoice tables are not available in this environment.' } }, 503);
        }
        throw new AppError('The tax invoice could not be loaded. Please retry.', 503, 'TAX_INVOICE_UNAVAILABLE');
    }

    const invoice = invoiceData as GstInvoiceRow | null;
    if (!invoice) {
        if (order.gst_invoice && order.gst_invoice_number) {
            return c.json(success({
                order_id: order.id,
                invoice_number: order.gst_invoice_number,
                invoice: order.gst_invoice,
                source: 'orders.gst_invoice',
            }));
        }
        return c.json({ error: { code: 'NOT_FOUND', message: 'GST invoice not found' } }, 404);
    }

    return c.json(success(normalizeInvoiceRow(invoice)));
});

export default router;
