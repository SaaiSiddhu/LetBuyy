import type { SupabaseClient } from '@letbuyy/infrastructure/supabase-adapter';
import { sendResendEmail } from '@letbuyy/infrastructure/resend-adapter';
import { renderOrderLifecycleEmail, OrderEmailDeliverySchema, OrderEmailDeliveryReceiptSchema, OrderEmailMessageSchema } from '@letbuyy/notification-core';
import { formatEmailSender } from '@letbuyy/notification-core/email';

/** Only an active, exact-site job lease can disclose its private delivery snapshot. */
export async function sendOrderLifecycleEmail(db: Pick<SupabaseClient, 'rpc'>,
  env: { RESEND_API_KEY?: string; RESEND_FROM_EMAIL?: string },
  job: { id: string; site_id: string | null }, workerId: string) {
  if (!env.RESEND_API_KEY || /placeholder|replace-with|skip_needs_human/i.test(env.RESEND_API_KEY))
    throw new Error('Order email provider is not configured');
  if (!env.RESEND_FROM_EMAIL || !/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(env.RESEND_FROM_EMAIL))
    throw new Error('Order email sender is not configured');
  const { data, error } = await db.rpc('order_lifecycle_email_delivery_v1', { p_job_id: job.id, p_worker_id: workerId });
  if (error) throw new Error(error.message?.includes('ORDER_EMAIL_DELIVERY_UNCERTAIN')
    ? 'Order email delivery is uncertain; reconcile provider receipt before replay' : 'Order email delivery intent is unavailable');
  const receipt = OrderEmailDeliveryReceiptSchema.safeParse(data);
  if (receipt.success) return { processed: false, reason: receipt.data.status, provider_message_id: receipt.data.provider_message_id };
  const delivery = OrderEmailDeliverySchema.parse(data);
  if (delivery.site_id !== job.site_id || delivery.snapshot.order.store_id !== job.site_id)
    throw new Error('Order email source scope mismatch');
  const email = renderOrderLifecycleEmail(delivery.snapshot);
  const sealed = await db.rpc('seal_order_lifecycle_email_message_v1', { p_job_id: job.id, p_worker_id: workerId,
    p_log_id: delivery.log_id, p_message: { from: formatEmailSender(env.RESEND_FROM_EMAIL), ...email } });
  if(sealed.error) throw new Error('Order email message could not be retained before delivery');
  const message = OrderEmailMessageSchema.parse(sealed.data);
  const sent = await sendResendEmail({ apiKey: env.RESEND_API_KEY, to: delivery.to, ...message, idempotencyKey: delivery.idempotency_key });
  if (!sent.success || !sent.messageId) throw new Error('Order email provider did not accept the message');
  const saved = await db.rpc('complete_order_lifecycle_email_v1', { p_job_id: job.id, p_worker_id: workerId,
    p_log_id: delivery.log_id, p_provider_id: sent.messageId, p_subject: message.subject });
  if (saved.error || saved.data !== true) throw new Error('Order email accepted receipt could not be saved');
  return { processed: true, provider: 'resend', provider_message_id: sent.messageId };
}
