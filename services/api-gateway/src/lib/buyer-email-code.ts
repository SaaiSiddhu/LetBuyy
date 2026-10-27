import { DEFAULT_EMAIL_BRAND, renderEmailShell, eyebrow, heading, paragraph, smallPrint, verificationCode, formatEmailSender } from '@letbuyy/notification-core/email';
// APPID-P4a — delivering a buyer's one-time email code (migration 257).
//
// The database generates the code and hands it to the gateway once; this file sends it, and nothing
// returns it to any caller, identity-platform included. Whoever can both start a challenge and read
// its code can take the account over, and the internal signature identity-platform uses to call the
// buyer routes is not unique to it. So the code has one destination: the account's own inbox.
//
// Sent directly rather than through NOTIFICATION_QUEUE, as the per-store customer reset is. A queued
// message, and the dead-letter copy of a failed one, would hold the code in plaintext after the
// database has taken care to keep only its hash.

import { sendResendEmail } from '@letbuyy/infrastructure/resend-adapter';
import type { Env } from '../index';
import { isLocalSupabaseEnvironment } from './supabase';

export type BuyerEmailCodePurpose = 'verify_email' | 'reset_password' | 'connect_merchant';

export interface BuyerEmailCodeDelivery {
    email: string;
    code: string;
    purpose: BuyerEmailCodePurpose;
}

export type BuyerEmailCodeSender = (env: Env, delivery: BuyerEmailCodeDelivery) => Promise<{ sent: boolean }>;

// The same placeholder markers routes/auth.ts's isPlaceholderSecret uses.
function configuredProvider(env: Env): boolean {
    const apiKey = String(env.RESEND_API_KEY || '').toLowerCase();
    return Boolean(apiKey) && !['placeholder', 'replace-with', 'dev-only'].some((marker) => apiKey.includes(marker));
}

/// The code is kept out of the subject line: subjects show in lock-screen previews and in the
/// provider's delivery logs, and the body shows in neither.
export function buildBuyerEmailCodeMessage(delivery: BuyerEmailCodeDelivery): { subject: string; text: string; html: string } {
    const reset = delivery.purpose === 'reset_password';
    const connection = delivery.purpose === 'connect_merchant';
    const html = renderEmailShell(DEFAULT_EMAIL_BRAND,
        eyebrow('Buyer account security') + heading(connection ? 'Connect your LetBuyy account' : reset ? 'Reset your buyer password' : 'Verify your email address') +
        paragraph(connection ? 'You signed in with your existing LetBuyy account. Enter this code and confirm consent to connect your buyer profile. Your work permissions stay separate.' : reset ? 'Enter this one-time code on the LetBuyy password recovery page.' : 'Enter this one-time code to verify your LetBuyy buyer account.') + verificationCode(delivery.code) +
        smallPrint('This code expires in 10 minutes. Never share it with anyone, including LetBuyy support. ' +
            (reset ? 'Your password stays the same until you finish the reset. Resetting signs you out on every device.' : 'If you did not request this code, ignore this email.')),
        {preheader: reset ? 'A one-time code to recover your buyer account.' : 'Confirm your email address securely.', reason: 'You requested a security code for your LetBuyy buyer account.', category: 'security'});

    if (connection) return {subject:'Connect your LetBuyy buyer profile',html,
        text:`Your connection code is ${delivery.code}.\nIt expires in 10 minutes. Enter it only on the LetBuyy account connection page after signing in with your existing LetBuyy account. Your work permissions stay separate. Ignore this email if you did not request this.`};
    if (delivery.purpose === 'reset_password') {
        return {
            subject: 'Reset your LetBuyy password',
            html,
            text: [
                `Your LetBuyy password reset code is ${delivery.code}.`,
                '',
                'It expires in 10 minutes. Resetting your password signs you out on every device.',
                '',
                "If you didn't ask to reset your password, ignore this email. Your password has not changed.",
            ].join('\n'),
        };
    }
    return {
        subject: 'Verify your email for LetBuyy',
        html,
        text: [
            `Your LetBuyy verification code is ${delivery.code}.`,
            '',
            'It expires in 10 minutes.',
            '',
            "If you didn't ask for this code, you can ignore this email.",
        ].join('\n'),
    };
}

export const sendBuyerEmailCode: BuyerEmailCodeSender = async (env, delivery) => {
    const message = buildBuyerEmailCodeMessage(delivery);
    // A database on this machine holds only local accounts, so their codes go to the gateway console
    // and never through the email provider, whatever key is configured. The local env generator's key
    // ('re_local_dev_unused') looks real to any placeholder check, and until APPID-P4b's local run
    // found it, local verification tried Resend, failed and answered 503. A deployed gateway never
    // points at a database on localhost.
    if (isLocalSupabaseEnvironment(env)) {
        console.info(JSON.stringify({
            level: 'info',
            service: 'letbuyy-api',
            reason: 'local_buyer_email_code',
            to: delivery.email,
            purpose: delivery.purpose,
            code: delivery.code,
        }));
        return { sent: true };
    }
    if (!configuredProvider(env)) return { sent: false };

    const result = await sendResendEmail({
        apiKey: env.RESEND_API_KEY,
        from: formatEmailSender(env.RESEND_FROM_EMAIL),
        to: delivery.email,
        subject: message.subject,
        text: message.text,
        html: message.html,
    }).catch(() => ({ success: false }));
    return { sent: Boolean(result.success) };
};
