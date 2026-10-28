import type { Context } from 'hono';
import type { RazorpayCredentials } from '@letbuyy/infrastructure/razorpay-adapter';
import type { Env } from '../index';
import { getSupabaseAdmin } from './supabase';
import { hydratePaymentCredential } from './payment-credential-history';
import { readStoreRazorpayTestCredentials, type PaymentSettings } from './store-payment-config';

type StorePaymentRow = { id: string; payment_settings?: PaymentSettings | null; online_payment_enabled?: boolean | null };

/** The verified cart's tenant chooses its saved Merchant account, never a buyer payload. */
export async function hostedRazorpayTestCredentials(c: Context<{ Bindings: Env }>, siteId: string, snapshot?: StorePaymentRow): Promise<RazorpayCredentials | null> {
    const { data, error } = snapshot ? { data: snapshot, error: null } : await getSupabaseAdmin(c).from('sites').select('id,payment_settings,online_payment_enabled')
        .eq('id', siteId).is('deleted_at', null).maybeSingle();
    if (error || !data || data.id !== siteId || data.online_payment_enabled !== true) return null;
    const hydrated = data.payment_settings?.razorpay?.credential_id
        ? await hydratePaymentCredential(getSupabaseAdmin(c), data, { requireSelected: true }) : data;
    const configured = await readStoreRazorpayTestCredentials(hydrated.payment_settings, c.env.PAYMENT_CONFIG_ENCRYPTION_KEY, siteId);
    if (configured) return configured;
    // Existing disposable provider fixtures use process-local keys. Production never shares those
    // keys between merchants, or falls back when a merchant's encrypted configuration is invalid.
    if (['test', 'local', 'development'].includes(c.env.ENVIRONMENT) && !data.payment_settings?.razorpay
        && c.env.RAZORPAY_KEY_ID?.startsWith('rzp_test_') && c.env.RAZORPAY_KEY_SECRET) {
        return { keyId: c.env.RAZORPAY_KEY_ID, keySecret: c.env.RAZORPAY_KEY_SECRET };
    }
    return null;
}
