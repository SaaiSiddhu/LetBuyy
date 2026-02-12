import { Hono } from 'hono';
import type { Env } from '../index';
import { getSupabaseAdmin } from '../lib/supabase';

const router = new Hono<{ Bindings: Env }>();

// POST /payments/razorpay/order — Create a Razorpay order
router.post('/razorpay/order', async (c) => {
    const auth = c.get('auth');
    const { amount, currency, order_id } = await c.req.json();

    if (!amount || !order_id) {
        return c.json({ error: { code: 'VALIDATION', message: 'amount and order_id required' } }, 400);
    }

    try {
        // Create Razorpay order via REST API
        const response = await fetch('https://api.razorpay.com/v1/orders', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Basic ${btoa(`${c.env.RAZORPAY_KEY_ID}:${c.env.RAZORPAY_KEY_SECRET}`)}`,
            },
            body: JSON.stringify({
                amount: Math.round(amount * 100), // Razorpay expects paise
                currency: currency || 'INR',
                receipt: order_id,
            }),
        });

        const razorpayOrder = await response.json() as Record<string, unknown>;

        if (!response.ok) {
            return c.json({ error: { code: 'PAYMENT_ERROR', message: 'Failed to create payment order' } }, 500);
        }

        return c.json({
            data: {
                razorpay_order_id: razorpayOrder.id,
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                key_id: c.env.RAZORPAY_KEY_ID,
            },
        });
    } catch (err) {
        return c.json({ error: { code: 'PAYMENT_ERROR', message: 'Payment service unavailable' } }, 503);
    }
});

// POST /payments/razorpay/verify — Verify payment signature
router.post('/razorpay/verify', async (c) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, order_id } = await c.req.json();

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
        return c.json({ error: { code: 'VALIDATION', message: 'Missing payment verification params' } }, 400);
    }

    // Verify HMAC-SHA256 signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(c.env.RAZORPAY_KEY_SECRET),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['sign']
    );

    const payload = `${razorpay_order_id}|${razorpay_payment_id}`;
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const expectedSig = Array.from(new Uint8Array(signatureBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    if (expectedSig !== razorpay_signature) {
        return c.json({ error: { code: 'PAYMENT_ERROR', message: 'Invalid payment signature' } }, 400);
    }

    // Update order payment status
    if (order_id) {
        const db = getSupabaseAdmin(c);
        await db.from('orders').update({
            payment_status: 'paid',
            payment_id: razorpay_payment_id,
            status: 'confirmed',
        }).eq('id', order_id);
    }

    return c.json({ data: { verified: true } });
});

// POST /payments/stripe/checkout — Create a Stripe checkout session
router.post('/stripe/checkout', async (c) => {
    const auth = c.get('auth');
    const { order_id, line_items, success_url, cancel_url } = await c.req.json();

    if (!line_items || !Array.isArray(line_items) || line_items.length === 0) {
        return c.json({ error: { code: 'VALIDATION', message: 'line_items[] required' } }, 400);
    }

    try {
        const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Authorization: `Bearer ${c.env.STRIPE_SECRET_KEY}`,
            },
            body: new URLSearchParams({
                'mode': 'payment',
                'success_url': success_url || 'https://letbuyy.store/checkout/success?session_id={CHECKOUT_SESSION_ID}',
                'cancel_url': cancel_url || 'https://letbuyy.store/checkout/cancel',
                ...(order_id && { 'metadata[order_id]': order_id }),
                ...line_items.reduce((acc: Record<string, string>, item: any, i: number) => {
                    acc[`line_items[${i}][price_data][currency]`] = item.currency || 'inr';
                    acc[`line_items[${i}][price_data][product_data][name]`] = item.name;
                    acc[`line_items[${i}][price_data][unit_amount]`] = String(Math.round((item.price || 0) * 100));
                    acc[`line_items[${i}][quantity]`] = String(item.quantity || 1);
                    return acc;
                }, {}),
            }),
        });

        const session = await response.json() as Record<string, unknown>;

        if (!response.ok) {
            return c.json({ error: { code: 'PAYMENT_ERROR', message: (session as any).error?.message || 'Stripe error' } }, 500);
        }

        // Update order with Stripe session ID
        if (order_id) {
            const db = getSupabaseAdmin(c);
            await db.from('orders').update({
                payment_id: session.id,
            }).eq('id', order_id);
        }

        return c.json({
            data: {
                session_id: session.id,
                session_url: session.url,
            },
        });
    } catch (err) {
        return c.json({ error: { code: 'PAYMENT_ERROR', message: 'Stripe service unavailable' } }, 503);
    }
});

export default router;
