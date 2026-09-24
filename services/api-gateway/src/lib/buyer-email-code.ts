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

export type BuyerEmailCodePurpose = 'verify_email' | 'reset_password';

export interface BuyerEmailCodeDelivery {
    email: string;
    code: string;
    purpose: BuyerEmailCodePurpose;
}

export type BuyerEmailCodeSender = (env: Env, delivery: BuyerEmailCodeDelivery) => Promise<{ sent: boolean }>;

function configuredProvider(env: Env): boolean {
    const apiKey = env.RESEND_API_KEY;
    return Boolean(apiKey && !apiKey.toLowerCase().includes('replace-with') && !apiKey.toLowerCase().includes('placeholder'));
}

/// The code is kept out of the subject line: subjects show in lock-screen previews and in the
/// provider's delivery logs, and the body shows in neither.
export function buildBuyerEmailCodeMessage(delivery: BuyerEmailCodeDelivery): { subject: string; text: string } {
    if (delivery.purpose === 'reset_password') {
        return {
            subject: 'Reset your LetBuyy password',
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
    if (!configuredProvider(env)) {
        // Local development only. With no email provider AND a database on this machine, the code is
        // written to the gateway console so the flow can be exercised end to end. It unlocks an
        // account in that local database and nothing else; a deployed gateway meets neither condition.
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
        return { sent: false };
    }

    const result = await sendResendEmail({
        apiKey: env.RESEND_API_KEY,
        from: env.RESEND_FROM_EMAIL || 'LetBuyy <noreply@letbuyy.com>',
        to: delivery.email,
        subject: message.subject,
        text: message.text,
    }).catch(() => ({ success: false }));
    return { sent: Boolean(result.success) };
};
