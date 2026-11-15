import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import type { StorePaymentRow, PaymentSettings } from './store-payment-config';
import { AppError } from './errors';
import type { Context } from 'hono';
import type { Env } from '../index';
import { StorePaymentConfigSchema } from '@letbuyy/shared-types';
import { z } from 'zod';
import { getSupabaseAdmin, success } from './supabase';
import { projectStorePaymentConfig, managedSandboxConfigured } from './store-payment-config';

/** The flag alone cannot advertise a connection the installed schema cannot save. */
export async function managedSandboxAvailable(c: Context<{Bindings:Env}>): Promise<boolean> {
    if (!managedSandboxConfigured(c.env)) return false;
    const {data,error}=await getSupabaseAdmin(c).rpc('store_payment_managed_sandbox_supported_v1');
    return !error && data === true;
}

/** A sites pointer contains no new secret copy. Resolve only its exact canonical
 * version, with every scope predicate repeated at this server boundary. Legacy
 * settings without a pointer remain an explicit temporary read-only bridge. */
export async function hydratePaymentCredential(db: SupabaseClient, row: StorePaymentRow,
    options: { credentialId?: string; requireSelected?: boolean } = {}): Promise<StorePaymentRow> {
    const id = options.credentialId || row.payment_settings?.razorpay?.credential_id;
    if (!id) return row;
    if (!/^[0-9a-f-]{36}$/i.test(id)) throw new AppError('Payment connection is unavailable.',503,'PAYMENT_CONFIG_UNAVAILABLE');
    let query = db.from('payment_credentials').select('id,site_id,provider,mode,status,provider_key_id,encrypted_credentials,last_verified_at,selected_for_checkout,created_at,metadata')
        .eq('id',id).eq('site_id',row.id).eq('provider','razorpay').eq('mode','sandbox').is('deleted_at',null);
    if (options.requireSelected) query = query.eq('selected_for_checkout',true);
    const {data,error} = await query.maybeSingle();
    if (error) throw new AppError('Payment connection is temporarily unavailable.',503,'PAYMENT_CONFIG_UNAVAILABLE');
    if (!data || data.status !== 'active' || !data.last_verified_at || typeof data.provider_key_id !== 'string') {
        return {...row,payment_settings:{mode:'ownAccount',gateways:[]}};
    }
    const encrypted = data.encrypted_credentials && typeof data.encrypted_credentials === 'object' && !Array.isArray(data.encrypted_credentials)
        ? data.encrypted_credentials as Record<string,unknown> : {};
    const settings: PaymentSettings = {mode:data.metadata?.account_model === 'managed_sandbox' ? 'managedSandbox' : 'ownAccount',gateways:['razorpay'],razorpay:{
        credential_id:data.id,key_id:data.provider_key_id,
        key_secret_ciphertext:typeof encrypted.key_secret_ciphertext === 'string' ? encrypted.key_secret_ciphertext : undefined,
        webhook_secret_ciphertext:typeof encrypted.webhook_secret_ciphertext === 'string' ? encrypted.webhook_secret_ciphertext : undefined,
        test_mode:true,verified:true,connected_at:data.created_at,updated_at:data.created_at,
    }};
    return {...row,payment_settings:settings};
}

/** The same canonical public projection is frozen with the configuration in SQL.
 * A lost RPC reply cannot turn its completed durable receipt into failed work. */
export async function commitPaymentConfiguration(c: Context<{Bindings:Env}>, input: {
    actorId: string; current: StorePaymentRow; proposed: StorePaymentRow;
    operation: 'save'|'methods'; payload: Record<string,unknown>; credentialsUsable: boolean;
}) {
    const claim=c.get('paymentConfigurationClaim');
    if (!claim || claim.siteId!==input.current.id) throw new AppError('Payment acknowledgement is unavailable.',503,'PAYMENT_CONFIG_UNAVAILABLE');
    const projection=success(await projectStorePaymentConfig(input.proposed,c.env.PAYMENT_CONFIG_ENCRYPTION_KEY,await managedSandboxAvailable(c),c.env.MERCHANT_RAZORPAY_WEBHOOK_ORIGIN));
    const {data,error}=await getSupabaseAdmin(c).rpc('commit_store_payment_configuration_v1',{
        p_site_id:input.current.id,p_actor_id:input.actorId,p_expected_revision:input.current.updated_at??null,
        p_claim_id:claim.id,p_request_hash:claim.requestHash,p_operation:input.operation,p_payload:input.payload,
        p_credentials_usable:input.credentialsUsable,p_public_response:projection,
    });
    if (error) {
        if (error.code==='42501') throw new AppError('Not authorized.',403,'FORBIDDEN');
        if (error.code==='22023') {
            const code=error.message==='PAYMENT_CONNECTION_OWNERSHIP_CONFLICT'?'PAYMENT_CONNECTION_OWNERSHIP_CONFLICT':
                error.message==='PAYMENT_NOT_READY'?'PAYMENT_NOT_READY':'PAYMENT_CONFIG_CONFLICT';
            throw new AppError(code==='PAYMENT_CONNECTION_OWNERSHIP_CONFLICT'
                ? 'This recorded payment connection cannot be reused by another store.'
                : 'Payment settings changed or are not ready. Reload before saving.',409,code);
        }
        throw new AppError('Payment settings could not be confirmed. Retry the same request to recover its saved outcome.',503,'PAYMENT_CONFIG_UNAVAILABLE');
    }
    const reply=z.object({success:z.literal(true),data:StorePaymentConfigSchema}).safeParse(data);
    if (!reply.success) throw new AppError('Payment acknowledgement is temporarily unavailable. Retry the same request.',503,'PAYMENT_CONFIG_UNAVAILABLE');
    c.set('atomicIdempotencyCommitted',true);
    return reply.data;
}
