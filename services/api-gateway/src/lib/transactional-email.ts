import { DEFAULT_EMAIL_BRAND, renderEmailShell, heading } from '@letbuyy/notification-core/email';
import type { Env } from '../index';
import { escapeHtml } from './customer-email';
import { signQueueTenantEnvelope } from './queue-tenant-envelope';

type TransactionalEmailEnv = Pick<
    Env,
    | 'NOTIFICATION_QUEUE'
    | 'INTERNAL_API_SECRET'
    | 'QUEUE_TENANT_ENVELOPE_SECRET'
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
            html: renderEmailShell(DEFAULT_EMAIL_BRAND, heading('A new customer message') + [
                `<p>New contact submission for <strong>${escapeHtml(storeName)}</strong>.</p>`,
                '<ul>',
                `<li>Name: ${escapeHtml(customerName)}</li>`,
                `<li>Email: ${escapeHtml(customerEmail)}</li>`,
                `<li>Phone: ${escapeHtml(customerPhone)}</li>`,
                '</ul>',
                `<p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>`,
            ].join(''),{preheader:'A visitor has contacted your store.',reason:'You received this message as the owner of the contacted store.',category:'transactional'}),
            contact_submission_id: input.submissionId,
            store_id: input.storeId,
            template_key: 'contact_owner_notification',
        },
    });
}
