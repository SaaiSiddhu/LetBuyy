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
