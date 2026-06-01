import { z } from 'zod';
import type { RuntimeEventEnvelope } from '@letbuyy/event-core';

export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app';
export type NotificationAudience = 'shopper' | 'customer' | 'merchant' | 'platform-employee' | 'platform-operator';

export const NotificationRecipientSchema = z.object({
  actor_id: z.string().min(1).max(200).optional(),
  email: z.string().email().max(320).optional(),
  phone: z.string().max(32).optional(),
  push_token: z.string().max(500).optional(),
});

export const NotificationMessageSchema = z.object({
  channel: z.enum(['email', 'sms', 'push', 'in_app']),
  template_key: z.string().min(1).max(120),
  locale: z.string().min(2).max(12).default('en-IN'),
  subject: z.string().max(200).optional(),
  body: z.string().max(10000).optional(),
  data: z.record(z.string(), z.unknown()).default({}),
});

export const NotificationDispatchSchema = z.object({
  site_id: z.string().uuid().optional(),
  recipient: NotificationRecipientSchema,
  message: NotificationMessageSchema,
  idempotency_key: z.string().min(8).max(200),
});

export interface NotificationTemplate {
  key: string;
  channels: NotificationChannel[];
  audience: NotificationAudience;
  variables: string[];
  owner_domain: string;
}

export interface EventNotificationMapping {
  event_type: string;
  template_key: string;
  channels: NotificationChannel[];
  deriveRecipient(event: RuntimeEventEnvelope): NotificationRecipient;
}

export interface NotificationRecipient {
  actor_id?: string;
  email?: string;
  phone?: string;
  push_token?: string;
}

export type InAppNotificationType =
  | 'app_installed'
  | 'app_uninstalled'
  | 'app_review'
  | 'theme_purchased'
  | 'theme_review'
  | 'order_placed'
  | 'order_shipped'
  | 'order_delivered'
  | 'new_lead'
  | 'new_contact'
  | 'plan_upgraded'
  | 'store_published'
  | 'system';

export interface PlannedInAppNotification {
  type: InAppNotificationType;
  title: string;
  message: string;
  action_url?: string | null;
  data: Record<string, unknown>;
}

function notificationData(event: RuntimeEventEnvelope): Record<string, unknown> {
  return {
    event_id: event.event_id,
    event_type: event.event_type,
    aggregate_type: event.aggregate_type || null,
    aggregate_id: event.aggregate_id || null,
    site_id: event.site_id || null,
    payload: event.payload && typeof event.payload === 'object' ? event.payload : {},
  };
}

export function planInAppNotificationForEvent(event: RuntimeEventEnvelope): PlannedInAppNotification | null {
  const data = notificationData(event);

  switch (event.event_type) {
    case 'store.created':
      return {
        type: 'store_published',
        title: 'Store created',
        message: 'Your LetBuyy store workspace is ready.',
        action_url: event.site_id ? `/stores/${event.site_id}` : null,
        data,
      };
    case 'order.created':
      return {
        type: 'order_placed',
        title: 'New order received',
        message: 'A new storefront order needs review.',
        action_url: event.site_id && event.aggregate_id ? `/stores/${event.site_id}/orders/${event.aggregate_id}` : null,
        data,
      };
    case 'order.paid':
      return {
        type: 'order_placed',
        title: 'Order payment confirmed',
        message: 'A checkout payment was verified and the order is ready for fulfilment.',
        action_url: event.site_id && event.aggregate_id ? `/stores/${event.site_id}/orders/${event.aggregate_id}` : null,
        data,
      };
    case 'order.fulfilled':
      return {
        type: 'order_shipped',
        title: 'Order fulfilled',
        message: 'An order fulfilment was recorded.',
        action_url: event.site_id && event.aggregate_id ? `/stores/${event.site_id}/orders/${event.aggregate_id}` : null,
        data,
      };
    case 'app.installed':
      return {
        type: 'app_installed',
        title: 'App installed',
        message: 'An app was installed on this store.',
        action_url: event.site_id ? `/stores/${event.site_id}/apps` : null,
        data,
      };
    case 'app.uninstalled':
      return {
        type: 'app_uninstalled',
        title: 'App uninstalled',
        message: 'An app was removed from this store.',
        action_url: event.site_id ? `/stores/${event.site_id}/apps` : null,
        data,
      };
    case 'app.submitted':
    case 'app.approved':
    case 'app.rejected':
      return {
        type: 'app_review',
        title: event.event_type === 'app.approved'
          ? 'App approved'
          : event.event_type === 'app.rejected'
            ? 'App rejected'
            : 'App submitted',
        message: event.event_type === 'app.approved'
          ? 'A marketplace app was approved for listing.'
          : event.event_type === 'app.rejected'
            ? 'A marketplace app was rejected during review.'
            : 'A marketplace app was submitted for review.',
        data,
      };
    case 'theme.submitted':
    case 'theme.approved':
    case 'theme.rejected':
      return {
        type: 'theme_review',
        title: event.event_type === 'theme.approved'
          ? 'Theme approved'
          : event.event_type === 'theme.rejected'
            ? 'Theme rejected'
            : 'Theme submitted',
        message: event.event_type === 'theme.approved'
          ? 'A theme package was approved for marketplace listing.'
          : event.event_type === 'theme.rejected'
            ? 'A theme package was rejected during review.'
          : 'A theme package was submitted for review.',
        data,
      };
    case 'theme.installed':
      return {
        type: 'theme_purchased',
        title: 'Theme installed',
        message: 'A storefront theme was installed.',
        action_url: event.site_id ? `/stores/${event.site_id}/online-store/themes` : null,
        data,
      };
    case 'app.charge.created':
    case 'app.charge.activated':
    case 'payout.ledger_entry.created':
    case 'payout.released':
    case 'payout.failed':
      return {
        type: 'system',
        title: 'Partner billing update',
        message: 'A partner billing or payout event was recorded.',
        data,
      };
    default:
      return null;
  }
}

export function isValidWebhookTarget(targetUrl: string): boolean {
  try {
    const url = new URL(targetUrl);
    return url.protocol === 'https:' && url.hostname.length > 0;
  } catch {
    return false;
  }
}

export type NotificationRecipientInput = z.infer<typeof NotificationRecipientSchema>;
export type NotificationMessageInput = z.infer<typeof NotificationMessageSchema>;
export type NotificationDispatchInput = z.infer<typeof NotificationDispatchSchema>;
