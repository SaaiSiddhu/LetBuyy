import type {Context} from 'hono';
import type {Env} from '../index';
import {fetchRazorpayPayment} from '@letbuyy/infrastructure/razorpay-adapter';
import {isValidInrMinorUnits} from '@letbuyy/payments';
import {AppError} from './errors';
import {getSupabaseAdmin} from './supabase';
import {hydratePaymentCredential} from './payment-credential-history';
import {readStoreRazorpayTestCredentials} from './store-payment-config';
import type {PaymentSessionRow} from './payment-route-support';

export interface VerifiedRazorpayCapture {
    paymentId:string; siteId:string; orderId:string; credentialId:string;
    providerOrderId:string; providerPaymentId:string; amountMinor:number; currency:'INR';
}

/** A merchant may request verification, never attest that provider money exists.
 * Use this payment's frozen key, including drain after a Settings switch. */
export async function verifyCanonicalRazorpayCapture(c:Context<{Bindings:Env}>,payment:PaymentSessionRow,providerPaymentId:string):Promise<VerifiedRazorpayCapture>{
    if(payment.provider!=='razorpay')throw new AppError('This payment method requires its verified reconciliation flow.',409,'PAYMENT_CAPTURE_NOT_SUPPORTED');
    if(payment.mode!=='sandbox')throw new AppError('Live payment capture requires qualified provider onboarding.',503,'PAYMENT_LIVE_NOT_READY');
    if(!payment.credential_id || !payment.provider_order_id)throw new AppError('This payment needs its original verified connection and provider order before capture.',409,'PAYMENT_CONNECTION_REQUIRED');
    if(payment.currency!=='INR' || !isValidInrMinorUnits(payment.amount_minor) || payment.amount_minor<=0){
        throw new AppError('The saved payment amount needs review before verification.',409,'PAYMENT_AMOUNT_UNAVAILABLE');
    }
    const row=await hydratePaymentCredential(getSupabaseAdmin(c),{id:payment.site_id},{credentialId:payment.credential_id});
    const credentials=await readStoreRazorpayTestCredentials(row.payment_settings,c.env.PAYMENT_CONFIG_ENCRYPTION_KEY,payment.site_id);
    if(!credentials)throw new AppError('The original payment connection is unavailable for verification.',503,'PAYMENT_CONFIG_UNAVAILABLE');
    let observed:Awaited<ReturnType<typeof fetchRazorpayPayment>>;
    try{observed=await fetchRazorpayPayment(credentials,providerPaymentId);}
    catch{throw new AppError('Payment verification is temporarily unavailable. Retry the same request.',503,'PAYMENT_VERIFICATION_UNAVAILABLE');}
    if(observed.error)throw new AppError('Payment verification is temporarily unavailable. Retry the same request.',503,'PAYMENT_VERIFICATION_UNAVAILABLE');
    if(observed.status!=='captured' || observed.captured!==true){
        throw new AppError('The provider has not confirmed capture. Retry verification shortly.',409,'PAYMENT_NOT_CAPTURED');
    }
    if(observed.id!==providerPaymentId || observed.order_id!==payment.provider_order_id || observed.amount!==payment.amount_minor
        || typeof observed.currency!=='string' || observed.currency.toUpperCase()!==payment.currency){
        throw new AppError('The provider payment does not match this saved payment. Review it before retrying.',409,'PAYMENT_PROOF_MISMATCH');
    }
    return {paymentId:payment.id,siteId:payment.site_id,orderId:payment.order_id,credentialId:payment.credential_id,
        providerOrderId:payment.provider_order_id,providerPaymentId,amountMinor:payment.amount_minor,currency:'INR'};
}
