import type {SupabaseClient} from '@letbuyy/infrastructure/supabase-adapter';
import type {VerifiedRazorpayCapture} from '../lib/payment-capture-proof';
import type {PaymentJsonValue} from '../lib/payment-route-support';
import {redactReplayableSecrets} from '../lib/replayable-secret-redaction';
import {AppError} from '../lib/errors';

/** Completes the existing payments owner, not the transitional order-capture RPC.
 * The proof is obtained server-side before this transaction. All database effects
 * and the command acknowledgement either commit together or roll back together. */
export async function commitCanonicalPaymentCapture(db:SupabaseClient,input:{
    proof:VerifiedRazorpayCapture; actorId:string; claimId:string; requestHash:string;
    requestId:string; metadata?:Record<string,unknown>;
}):Promise<PaymentJsonValue>{
    const {proof}=input;
    const {data,error}=await db.rpc('commit_canonical_payment_capture_v1',{
        p_payment_id:proof.paymentId,p_actor_id:input.actorId,p_claim_id:input.claimId,p_request_hash:input.requestHash,
        p_credential_id:proof.credentialId,p_order_id:proof.orderId,p_provider_order_id:proof.providerOrderId,
        p_provider_payment_id:proof.providerPaymentId,p_amount_minor:proof.amountMinor,p_currency:proof.currency,
        p_request_id:input.requestId,p_metadata:redactReplayableSecrets((input.metadata||{}) as PaymentJsonValue),
    });
    if(error||!data){
        if(error?.message?.includes('PAYMENT_CAPTURE_CONFLICT'))throw new AppError('The payment changed during verification. Retry the same request.',409,'PAYMENT_CAPTURE_CONFLICT');
        if(error?.message?.includes('PAYMENT_CAPTURE_REVIEW'))throw new AppError('This payment already has financial history that needs reconciliation.',409,'PAYMENT_CAPTURE_REVIEW');
        if(error?.message?.includes('PAYMENT_CAPTURE_FORBIDDEN'))throw new AppError('Payment not found.',404,'NOT_FOUND');
        throw new AppError('Payment recording is temporarily unavailable. Retry the same request.',503,'PAYMENT_CAPTURE_UNAVAILABLE');
    }
    return data as PaymentJsonValue;
}
