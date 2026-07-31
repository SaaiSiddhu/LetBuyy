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
    const html = [
        `<h2>You're Founding Merchant #${input.foundingNumber} 🏆</h2>`,
        `<p>Your <strong>${input.planName}</strong> plan price of <strong>${price}/month</strong> is now <strong>locked for life</strong>. Future price changes will never affect you.</p>`,
        '<p><strong>Your founding benefits:</strong></p>',
        '<ul><li>Lifetime price lock</li>' +
        `<li>Founding Merchant #${input.foundingNumber} badge</li>` +
        '<li>Priority support</li><li>Early access to new features</li><li>Feature previews</li></ul>',
        '<p>Thank you for backing LetBuyy early.</p>',
    ].join('');
    return { to, subject, text, html };
}

export function buildFoundingProgramFullEmail(totalSlots: number) {
    return {
        subject: `Founding Merchant Program is now FULL (${totalSlots}/${totalSlots})`,
        text: `All ${totalSlots} founding merchant slots have been allocated. The program is now full.`,
        html: `<p>All <strong>${totalSlots}</strong> founding merchant slots have been allocated. The program is now full.</p>`,
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
        from: env.RESEND_FROM_EMAIL || 'LetBuyy <noreply@letbuyy.com>',
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
        from: env.RESEND_FROM_EMAIL || 'LetBuyy <noreply@letbuyy.com>',
        to,
        subject: email.subject,
        text: email.text,
        html: email.html,
    });
}
