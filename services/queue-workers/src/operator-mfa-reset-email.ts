import { sendResendEmail } from '@letbuyy/infrastructure/resend-adapter';

export interface OperatorMfaResetEmailEnv { RESEND_API_KEY?:string; RESEND_FROM_EMAIL?:string }
export interface OperatorMfaResetDelivery {approval_id:string;job_id:string;email:string;sender:string;occurred_at:string;target_actor_id:string}
/** Canonical private job source only. No factor, OTP, bypass link or reset
 * capability is included in this security notification. */
export async function sendOperatorMfaResetEmail(env:OperatorMfaResetEmailEnv,delivery:OperatorMfaResetDelivery){
  if(!env.RESEND_API_KEY||/placeholder|replace-with|skip_needs_human/i.test(env.RESEND_API_KEY))throw new Error('Operator notification provider is not configured');
  const result=await sendResendEmail({apiKey:env.RESEND_API_KEY,from:delivery.sender,to:delivery.email,
    subject:'Your LetBuyy operator authenticator was reset',
    text:['An independently approved administrator reset was applied to your LetBuyy operator account.',
      'Existing Console sessions were revoked. A newly configured per-account authenticator is required to sign in again.',
      'If you did not request this recovery, contact your platform administrator immediately.',
      'Recorded at: '+delivery.occurred_at,'Reference: '+delivery.approval_id].join('\n\n'),
    idempotencyKey:'operator-mfa-reset-email:'+delivery.approval_id});
  if(!result.success||!result.messageId)throw new Error('Operator notification provider delivery failed');
  return {processed:true,provider:'resend',provider_message_id:result.messageId};
}
