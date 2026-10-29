import type {AppContext,PaymentSessionRow} from './payment-route-support';
import {hydratePaymentCredential} from './payment-credential-history';
import {readStoreRazorpayTestCredentials} from './store-payment-config';
import {getSupabaseAdmin} from './supabase';
import {AppError} from './errors';
import {fetchRazorpayRefund} from '@letbuyy/infrastructure/razorpay-adapter';
import type {RazorpayCredentials} from '@letbuyy/infrastructure/razorpay-adapter';

export async function originalRefundCredentials(c:AppContext,payment:PaymentSessionRow):Promise<RazorpayCredentials>{
    if(payment.mode!=='sandbox')throw new AppError('Live refunds require qualified provider authorization.',503,'REFUND_LIVE_NOT_READY');
    if(!payment.credential_id)throw new AppError('The original payment connection needs reconciliation before refunding.',409,'REFUND_CONNECTION_REQUIRED');
    const row=await hydratePaymentCredential(getSupabaseAdmin(c),{id:payment.site_id},{credentialId:payment.credential_id});
    const credentials=await readStoreRazorpayTestCredentials(row.payment_settings,c.env.PAYMENT_CONFIG_ENCRYPTION_KEY,payment.site_id);
    if(!credentials)throw new AppError('The original payment connection is unavailable. Retry after it is restored.',503,'REFUND_CONNECTION_UNAVAILABLE');
    return credentials;
}

export async function verifyRazorpayRefundProof(credentials:RazorpayCredentials,payment:PaymentSessionRow,
    refundId:string,amountMinor:number):Promise<'processed'|'created'|'failed'>{
    let observed:Awaited<ReturnType<typeof fetchRazorpayRefund>>;
    try{observed=await fetchRazorpayRefund(credentials,refundId);}
    catch{throw new AppError('Refund verification is temporarily unavailable. Retry the same request.',503,'REFUND_VERIFICATION_UNAVAILABLE');}
    if(observed.error)throw new AppError('Refund verification is temporarily unavailable. Retry the same request.',503,'REFUND_VERIFICATION_UNAVAILABLE');
    if(!payment.provider_payment_id || observed.id!==refundId || observed.payment_id!==payment.provider_payment_id
        || observed.amount!==amountMinor || observed.currency!=='INR' || !Number.isSafeInteger(amountMinor) || amountMinor<=0){
        throw new AppError('The provider refund does not match this payment and amount.',409,'REFUND_PROOF_MISMATCH');
    }
    if(observed.status!=='processed'&&observed.status!=='created'&&observed.status!=='failed'){
        throw new AppError('The provider refund status needs review before recording.',503,'REFUND_VERIFICATION_UNAVAILABLE');
    }
    return observed.status;
}
