import { DEFAULT_EMAIL_BRAND, renderEmailShell, eyebrow, heading, paragraph, detailTable, detailRow, ctaRow, ctaButton, smallPrint, escapeHtml, safeSubject, formatEmailSender } from '@letbuyy/notification-core/email';
import { bytesToHex, createMerchantStaffInvitationToken, timingSafeEqualHex } from '@letbuyy/auth-core';
import { sendResendEmail } from '@letbuyy/infrastructure/resend-adapter';

export interface StaffInvitationEmailEnv {
  STAFF_INVITATION_SIGNING_SECRET?: string;
  RESEND_API_KEY?: string;
}
export interface StaffInvitationDelivery {
  id: string; store_id: string; email: string; role: string; token_hash: string;
  store_name: string; accept_origin: string; sender: string; expires_at: string;
}
/** A configured provider is required for a sent verdict. No missing-key success. */
export async function sendStaffInvitationEmail(env: StaffInvitationEmailEnv, invitation: StaffInvitationDelivery) {
  const secret=env.STAFF_INVITATION_SIGNING_SECRET || '';
  if(secret.length<32 || /placeholder|replace-with|skip_needs_human/i.test(secret)) throw new Error('Staff invitation signing is not configured');
  if(!env.RESEND_API_KEY || /placeholder|replace-with|skip_needs_human/i.test(env.RESEND_API_KEY)) throw new Error('Staff invitation email provider is not configured');
  const token=await createMerchantStaffInvitationToken(invitation.id,secret);
  const hash=bytesToHex(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)));
  if(!timingSafeEqualHex(hash,invitation.token_hash)) throw new Error('Staff invitation signing does not match retained intent');
  const accept=new URL('/accept-invite',invitation.accept_origin);
  accept.searchParams.set('token',token);
  // All message fields come from the immutable invitation snapshot. Do not
  // interpolate mutable store metadata or timestamps into a provider retry.
  const result=await sendResendEmail({apiKey:env.RESEND_API_KEY,from:formatEmailSender(invitation.sender),to:invitation.email,
    subject:safeSubject(`You are invited to ${invitation.store_name} on LetBuyy`),
    html:renderEmailShell(DEFAULT_EMAIL_BRAND,eyebrow('Team invitation')+heading('You are invited to join the team')+
      paragraph(`Join ${escapeHtml(invitation.store_name)} on LetBuyy. Sign in with the email address that received this invitation and accept to activate access.`)+
      detailTable([detailRow('Role',escapeHtml(invitation.role))])+ctaRow([ctaButton(accept.toString(),'Review invitation')])+
      smallPrint(`Expires at ${escapeHtml(invitation.expires_at)}. If you did not expect this invitation, ignore it.`),
      {preheader:'Review an invitation to work on a LetBuyy store.',reason:'A store administrator invited this email address to their team.',category:'security'}),
    text:[`You have been invited to ${invitation.store_name} as ${invitation.role}.`,
      'Sign in with this verified email address and explicitly accept to activate access.',
      accept.toString(),`This invitation expires at ${invitation.expires_at}.`,
      'If you did not expect this invitation, you can ignore it.'].join('\n\n'),
    idempotencyKey:'staff-invite-email:'+invitation.id});
  if(!result.success || !result.messageId) throw new Error('Staff invitation provider delivery failed');
  return {processed:true,provider:'resend',provider_message_id:result.messageId};
}
