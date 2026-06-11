import type { Env } from '../index';
import { escapeHtml } from './customer-email';
import { signQueueTenantEnvelope } from './queue-tenant-envelope';

type TransactionalEmailEnv = Pick<
    Env,
    | 'NOTIFICATION_QUEUE'
    | 'INTERNAL_API_SECRET'
    | 'QUEUE_TENANT_ENVELOPE_SECRET'
    | 'NEXT_PUBLIC_ADMIN_URL'
    | 'NEXT_PUBLIC_PLATFORM_DOMAIN'
    | 'LETBUYY_PLATFORM_DOMAIN'
    | 'PLATFORM_ROOT_DOMAIN'
    | 'ENVIRONMENT'
>;

export type TransactionalEmailJobType =
    | 'email.employee_invite'
    | 'email.contact_owner_notification';

export interface TransactionalEmailEnqueueResult {
    queued: boolean;
    jobType: TransactionalEmailJobType;
    reason?: 'missing-notification-queue' | 'missing-recipient';
}

interface EmployeeInviteEmailInput {
    inviteId: string;
    storeId?: string | null;
    to: string;
    role: string;
    token: string;
    expiresAt?: string | null;
    inviterEmail?: string | null;
    requestId?: string | null;
}

interface ContactOwnerEmailInput {
    submissionId: string;
    storeId: string;
    storeName: string;
    ownerEmail?: string | null;
    customerName: string;
    customerEmail?: string | null;
    customerPhone?: string | null;
    message: string;
    requestId?: string | null;
}

function textValue(value: unknown, fallback = ''): string {
    return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function platformBaseUrl(env: TransactionalEmailEnv): string {
    const candidate = (
        env.NEXT_PUBLIC_ADMIN_URL
        || env.NEXT_PUBLIC_PLATFORM_DOMAIN
        || env.LETBUYY_PLATFORM_DOMAIN
        || env.PLATFORM_ROOT_DOMAIN
        || 'https://letbuyy.com'
    ).trim();
    const withProtocol = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
    return withProtocol.replace(/\/+$/g, '');
}

function inviteAcceptanceUrl(env: TransactionalEmailEnv, token: string): string {
    return `${platformBaseUrl(env)}/employees/auth/accept-invite?token=${encodeURIComponent(token)}`;
}

function writeTransactionalEmailLog(level: 'warn' | 'info', fields: Record<string, unknown>): void {
    const line = JSON.stringify({
        level,
        event: 'transactional_email_enqueue',
        ...fields,
    });

    if (level === 'warn') {
        console.warn(line);
        return;
    }

    console.info(line);
}

async function enqueueTransactionalEmail(
    env: TransactionalEmailEnv,
    input: {
        jobType: TransactionalEmailJobType;
        messageId: string;
        siteId?: string | null;
        idempotencyKey: string;
        requestId?: string | null;
        payload: Record<string, unknown>;
    },
): Promise<TransactionalEmailEnqueueResult> {
    if (!env.NOTIFICATION_QUEUE) {
        writeTransactionalEmailLog('warn', {
            job_type: input.jobType,
            status: 'missing-notification-queue',
            site_id: input.siteId || null,
            request_id: input.requestId || null,
        });
        return { queued: false, jobType: input.jobType, reason: 'missing-notification-queue' };
    }

    const queueBody = {
        messageId: input.messageId,
        queueName: 'email',
        jobType: input.jobType,
        siteId: input.siteId || null,
        idempotencyKey: input.idempotencyKey,
        requestId: input.requestId || input.messageId,
        correlationId: input.requestId || input.messageId,
        payload: input.payload,
    };

    await env.NOTIFICATION_QUEUE.send(await signQueueTenantEnvelope(env, queueBody));
    return { queued: true, jobType: input.jobType };
}

export async function enqueueEmployeeInviteEmail(
    env: TransactionalEmailEnv,
    input: EmployeeInviteEmailInput,
): Promise<TransactionalEmailEnqueueResult> {
    const recipient = textValue(input.to).toLowerCase();
    if (!recipient) return { queued: false, jobType: 'email.employee_invite', reason: 'missing-recipient' };

    const role = textValue(input.role, 'staff');
    const acceptUrl = inviteAcceptanceUrl(env, input.token);
    const expiresAt = input.expiresAt ? new Date(input.expiresAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'the invite expiry time';
    const text = [
        `You have been invited to join LetBuyy as ${role}.`,
        '',
        `Accept the invitation: ${acceptUrl}`,
        '',
        `This invitation expires at ${expiresAt}.`,
        input.inviterEmail ? `Invited by: ${input.inviterEmail}` : '',
    ].filter(Boolean).join('\n');

    return enqueueTransactionalEmail(env, {
        jobType: 'email.employee_invite',
        messageId: `employee-invite:${input.inviteId}`,
        siteId: input.storeId || null,
        idempotencyKey: `email.employee_invite:${input.inviteId}`,
        requestId: input.requestId || null,
        payload: {
            to: recipient,
            subject: 'You have been invited to LetBuyy',
            text,
            html: [
                '<p>You have been invited to join LetBuyy.</p>',
                `<p><strong>Role:</strong> ${escapeHtml(role)}</p>`,
                `<p><a href="${escapeHtml(acceptUrl)}">Accept invitation</a></p>`,
                `<p>This invitation expires at ${escapeHtml(expiresAt)}.</p>`,
                input.inviterEmail ? `<p>Invited by: ${escapeHtml(input.inviterEmail)}</p>` : '',
            ].join(''),
            invite_id: input.inviteId,
            store_id: input.storeId || null,
            template_key: 'employee_invite',
        },
    });
}

export async function enqueueContactOwnerNotificationEmail(
    env: TransactionalEmailEnv,
    input: ContactOwnerEmailInput,
): Promise<TransactionalEmailEnqueueResult> {
    const ownerEmail = textValue(input.ownerEmail).toLowerCase();
    if (!ownerEmail) return { queued: false, jobType: 'email.contact_owner_notification', reason: 'missing-recipient' };

    const storeName = textValue(input.storeName, 'your store');
    const customerName = textValue(input.customerName, 'Storefront visitor');
    const customerEmail = textValue(input.customerEmail, 'not provided');
    const customerPhone = textValue(input.customerPhone, 'not provided');
    const message = textValue(input.message, 'No message supplied.');
    const text = [
        `New contact submission for ${storeName}`,
        '',
        `Name: ${customerName}`,
        `Email: ${customerEmail}`,
        `Phone: ${customerPhone}`,
        '',
        message,
    ].join('\n');

    return enqueueTransactionalEmail(env, {
        jobType: 'email.contact_owner_notification',
        messageId: `contact-owner:${input.storeId}:${input.submissionId}`,
        siteId: input.storeId,
        idempotencyKey: `email.contact_owner_notification:${input.storeId}:${input.submissionId}`,
        requestId: input.requestId || null,
        payload: {
            to: ownerEmail,
            subject: `New contact submission for ${storeName}`,
            text,
            html: [
                `<p>New contact submission for <strong>${escapeHtml(storeName)}</strong>.</p>`,
                '<ul>',
                `<li>Name: ${escapeHtml(customerName)}</li>`,
                `<li>Email: ${escapeHtml(customerEmail)}</li>`,
                `<li>Phone: ${escapeHtml(customerPhone)}</li>`,
                '</ul>',
                `<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`,
            ].join(''),
            contact_submission_id: input.submissionId,
            store_id: input.storeId,
            template_key: 'contact_owner_notification',
        },
    });
}
