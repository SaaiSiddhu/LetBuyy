import { DEFAULT_EMAIL_BRAND, renderEmailShell, heading, paragraph, smallPrint, verificationCode, escapeHtml, safeSubject, formatEmailSender } from '@letbuyy/notification-core/email';
import { sendResendEmail } from '@letbuyy/infrastructure/resend-adapter';
import type { Env } from '../index';
import { signQueueTenantEnvelope } from './queue-tenant-envelope';

// LB-11 — gift card issued email. When a card is issued with a recipient email,
// the plaintext code is sent to them once. Mirrors enqueueOrderConfirmationEmail:
// render then enqueue an email.gift_card_issued job (or send directly when no
// queue is bound). The plaintext code is never persisted by the gateway.

function configuredResend(env: Pick<Env, 'RESEND_API_KEY'>): boolean {
    const value = env.RESEND_API_KEY;
    return Boolean(value && !value.toLowerCase().includes('placeholder') && !value.toLowerCase().includes('skip_needs_human'));
}

function money(value: number, currency: string): string {
    return `${currency} ${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
}

export interface GiftCardIssuedEmailInput {
    storeId: string;
    requestId: string;
    accountId: string;
    code: string;
    recipientEmail: string;
    recipientName?: string | null;
    senderNote?: string | null;
    value: number;
    currency: string;
    storeName?: string | null;
    expiresAt?: string | null;
}

export function buildGiftCardIssuedEmail(input: GiftCardIssuedEmailInput) {
    const recipient = (input.recipientEmail || '').trim();
    if (!recipient) return null;

    const currency = (input.currency || 'INR').toUpperCase();
    const amount = money(input.value, currency);
    const greetingName = (input.recipientName || '').trim() || 'there';
    const fromStore = (input.storeName || '').trim() || 'a LetBuyy store';
    const note = (input.senderNote || '').trim();
    const expiryLine = input.expiresAt
        ? `This gift card is valid until ${new Date(input.expiresAt).toLocaleDateString('en-IN')}.`
        : '';

    const text = [
        `Hi ${greetingName},`,
        '',
        `You have received a ${amount} gift card from ${fromStore}.`,
        '',
        `Gift card code: ${input.code}`,
        '',
        ...(note ? [`Message: ${note}`, ''] : []),
        'Enter this code at checkout to redeem your balance.',
        ...(expiryLine ? ['', expiryLine] : []),
    ].join('\n');

    const html = renderEmailShell(DEFAULT_EMAIL_BRAND,
        heading('A gift, chosen for you') + paragraph(`Hi ${escapeHtml(greetingName)}, you received a ${escapeHtml(amount)} gift card from ${escapeHtml(fromStore)}.`) +
        verificationCode(input.code) + (note ? paragraph(`Message: ${escapeHtml(note)}`) : '') +
        paragraph('Enter this code at checkout to redeem your balance.') + (expiryLine ? smallPrint(escapeHtml(expiryLine)) : ''),
        {preheader:'Your gift card and redemption instructions.',reason:'This gift card was issued to your email address.',category:'transactional'});

    return {
        to: recipient,
        subject: `You have received a ${amount} gift card`,
        text,
        html,
        store_id: input.storeId,
        gift_card_account_id: input.accountId,
    };
}

export async function enqueueGiftCardIssuedEmail(
    env: Pick<Env, 'NOTIFICATION_QUEUE' | 'RESEND_API_KEY' | 'RESEND_FROM_EMAIL' | 'ENVIRONMENT' | 'INTERNAL_API_SECRET' | 'QUEUE_TENANT_ENVELOPE_SECRET'>,
    input: GiftCardIssuedEmailInput,
): Promise<void> {
    const email = buildGiftCardIssuedEmail(input);
    if (!email) return;

    const queueBody = {
        messageId: `gift-card-issued:${input.storeId}:${input.accountId}`,
        queueName: 'email',
        jobType: 'email.gift_card_issued',
        siteId: input.storeId,
        idempotencyKey: `email.gift_card_issued:${input.storeId}:${input.accountId}`,
        requestId: input.requestId,
        correlationId: input.requestId,
        payload: email,
    };

    if (env.NOTIFICATION_QUEUE) {
        await env.NOTIFICATION_QUEUE.send(await signQueueTenantEnvelope(env, queueBody));
        return;
    }

    if (!configuredResend(env)) {
        console.warn(JSON.stringify({
            level: 'warn',
            event: 'gift_card_issued_email_skipped',
            reason: 'missing-notification-queue-and-resend',
            environment: env.ENVIRONMENT,
            store_id: input.storeId,
            request_id: input.requestId,
        }));
        return;
    }

    await sendResendEmail({
        apiKey: env.RESEND_API_KEY,
        from: formatEmailSender(env.RESEND_FROM_EMAIL),
        to: email.to,
        subject: email.subject,
        text: email.text,
        html: email.html,
    });
}
