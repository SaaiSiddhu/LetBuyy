import { DEFAULT_EMAIL_BRAND, renderEmailShell, heading, paragraph, smallPrint, verificationCode, escapeHtml, safeSubject, formatEmailSender } from '@letbuyy/notification-core/email';
import { sendResendEmail } from '@letbuyy/infrastructure/resend-adapter';
import type { Env } from '../index';

// Founding Merchant transactional emails. Sent best-effort directly via Resend
// (low volume — ≤100 founders; no queue consumer exists for founding events yet,
// so enqueuing would never deliver). Never throws into the caller (best-effort).

type EmailEnv = Pick<Env, 'RESEND_API_KEY' | 'RESEND_FROM_EMAIL' | 'ENVIRONMENT'>;

function configuredResend(env: EmailEnv): boolean {
    const value = env.RESEND_API_KEY;
    return Boolean(value && !value.toLowerCase().includes('placeholder') && !value.toLowerCase().includes('skip_needs_human'));
}

export interface FoundingWelcomeEmailInput {
    to: string;
    foundingNumber: number;
    allocationSource: string;
    planName: string;
    lockedMonthlyInr: number; // rupees
}

// Welcome + price-lock confirmation in one transactional email.
export function buildFoundingWelcomeEmail(input: FoundingWelcomeEmailInput) {
    const to = (input.to || '').trim();
    if (!to) return null;
    const price = `₹${(Number.isFinite(input.lockedMonthlyInr) ? input.lockedMonthlyInr : 0).toLocaleString('en-IN')}`;
    const subject = `🏆 You're Founding Merchant #${input.foundingNumber} — price locked forever`;
    const text = [
        `Congratulations — you are LetBuyy Founding Merchant #${input.foundingNumber}!`,
        '',
        `Your ${input.planName} plan price of ${price}/month is now LOCKED FOR LIFE.`,
        'Future price changes will never affect you.',
        '',
        'Your founding benefits:',
        '• Lifetime price lock',
        `• Founding Merchant #${input.foundingNumber} badge`,
        '• Priority support',
        '• Early access to new features',
        '• Feature previews',
        '',
        'Thank you for backing LetBuyy early.',
    ].join('\n');
    const html = renderEmailShell(DEFAULT_EMAIL_BRAND,heading(`Welcome, Founding Merchant #${input.foundingNumber}`) +
        paragraph(`Your ${escapeHtml(input.planName)} plan price of ${escapeHtml(price)}/month is locked for life. Future price changes will not affect this price.`) +
        paragraph('Your founding benefits include your numbered badge, lifetime price lock, priority support, early access to new features and feature previews.') +
        paragraph('Thank you for backing LetBuyy early.'),
        {preheader:'Your founding allocation and plan price are confirmed.',reason:'You received a founding merchant allocation on LetBuyy.',category:'onboarding'});
    return { to, subject, text, html };
}

export function buildFoundingProgramFullEmail(totalSlots: number) {
    return {
        subject: `Founding Merchant Program is now FULL (${totalSlots}/${totalSlots})`,
        text: `All ${totalSlots} founding merchant slots have been allocated. The program is now full.`,
        html: renderEmailShell(DEFAULT_EMAIL_BRAND,heading('Founding allocations are complete') + paragraph(`All ${totalSlots} founding merchant slots have been allocated. The program is now full.`), {preheader:'An update about founding merchant availability.',reason:'This message concerns the LetBuyy founding merchant program.',category:'transactional'}),
    };
}

export async function sendFoundingMerchantWelcomeEmail(env: EmailEnv, input: FoundingWelcomeEmailInput): Promise<void> {
    const email = buildFoundingWelcomeEmail(input);
    if (!email) return;
    if (!configuredResend(env)) {
        console.warn(JSON.stringify({ level: 'warn', event: 'founding_welcome_email_skipped', reason: 'resend-not-configured', environment: env.ENVIRONMENT }));
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

export async function sendFoundingProgramFullEmail(env: EmailEnv, input: { to: string; totalSlots: number }): Promise<void> {
    const to = (input.to || '').trim();
    if (!to || !configuredResend(env)) return;
    const email = buildFoundingProgramFullEmail(input.totalSlots);
    await sendResendEmail({
        apiKey: env.RESEND_API_KEY,
        from: formatEmailSender(env.RESEND_FROM_EMAIL),
        to,
        subject: email.subject,
        text: email.text,
        html: email.html,
    });
}
