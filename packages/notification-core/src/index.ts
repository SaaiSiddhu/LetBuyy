import { z } from 'zod';
import type { RuntimeEventEnvelope } from '@letbuyy/event-core';

export type NotificationChannel = 'whatsapp' | 'sms' | 'email' | 'push' | 'in_app';
export type NotificationAudience = 'shopper' | 'customer' | 'merchant' | 'platform-employee' | 'platform-operator';

export const NotificationChannelSchema = z.enum(['whatsapp', 'sms', 'email', 'push', 'in_app']);

export const NotificationRecipientSchema = z.object({
  actor_id: z.string().min(1).max(200).optional(),
  email: z.string().email().max(320).optional(),
  phone: z.string().max(32).optional(),
  push_token: z.string().max(500).optional(),
});

export const NotificationMessageSchema = z.object({
  channel: NotificationChannelSchema,
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

export const NotificationSendSchema = z.object({
  site_id: z.string().uuid(),
  category: z.string().trim().min(1).max(80).default('system'),
  event_type: z.string().trim().min(1).max(120).optional(),
  recipient: NotificationRecipientSchema,
  message: NotificationMessageSchema.omit({ channel: true }).extend({
    channel: NotificationChannelSchema.optional(),
  }),
  preferred_channels: z.array(NotificationChannelSchema).min(1).max(5).optional(),
  idempotency_key: z.string().min(8).max(200),
  metadata: z.record(z.string(), z.unknown()).default({}),
});

const EmailProviderSchema = z.enum(['sandbox_resend', 'sandbox_ses', 'sandbox_sendgrid', 'resend', 'ses', 'sendgrid']);

const EmailContextSchema = z.record(z.string(), z.unknown()).default({});

export const EmailRenderSchema = z.object({
  template_key: z.string().trim().min(1).max(160),
  locale: z.string().trim().min(2).max(12).default('en-IN'),
  subject: z.string().trim().min(1).max(240).optional(),
  body: z.string().trim().min(1).max(20000).optional(),
  context: EmailContextSchema,
});

export const EmailSendSchema = z.object({
  site_id: z.string().uuid(),
  to: z.string().email().max(320),
  from: z.string().email().max(320).optional(),
  sender_domain: z.string().trim().min(3).max(253).optional(),
  template_key: z.string().trim().min(1).max(160),
  locale: z.string().trim().min(2).max(12).default('en-IN'),
  subject: z.string().trim().min(1).max(240).optional(),
  body: z.string().trim().min(1).max(20000).optional(),
  context: EmailContextSchema,
  provider_preference: EmailProviderSchema.optional(),
  idempotency_key: z.string().min(8).max(200),
  metadata: z.record(z.string(), z.unknown()).default({}),
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

export interface NotificationRoutePlan {
  selected_channel: NotificationChannel | null;
  candidates: NotificationChannel[];
  reason: 'explicit' | 'whatsapp_first' | 'no_reachable_channel';
}

export type EmailProvider = z.infer<typeof EmailProviderSchema>;
export type EmailMode = 'sandbox' | 'live';

export interface RenderedEmailTemplate {
  template_key: string;
  locale: string;
  subject: string;
  html: string;
  text: string;
}

export interface EmailProviderFailoverPlan {
  mode: EmailMode;
  providers: EmailProvider[];
  preferred_provider: EmailProvider | null;
}

const SANDBOX_EMAIL_PROVIDERS: EmailProvider[] = ['sandbox_resend', 'sandbox_ses', 'sandbox_sendgrid'];
const LIVE_EMAIL_PROVIDERS: EmailProvider[] = ['resend', 'ses', 'sendgrid'];

const DEFAULT_EMAIL_TEMPLATES: Record<string, { subject: string; body: string }> = {
  order_confirmation: {
    subject: 'Order {{ order_number }} confirmed',
    body: '<mjml><mj-body><mj-section><mj-column><mj-text>Hello {{ customer.name }}, your order {{ order_number }} is confirmed.</mj-text></mj-column></mj-section></mj-body></mjml>',
  },
  passwordless_otp: {
    subject: 'Your LetBuyy sign-in code',
    body: '<mjml><mj-body><mj-section><mj-column><mj-text>Your sign-in code is {{ otp }}.</mj-text></mj-column></mj-section></mj-body></mjml>',
  },
  billing_invoice: {
    subject: 'LetBuyy invoice {{ invoice_number }}',
    body: '<mjml><mj-body><mj-section><mj-column><mj-text>Your invoice {{ invoice_number }} for {{ amount }} is ready.</mj-text></mj-column></mj-section></mj-body></mjml>',
  },
  shipment_update: {
    subject: 'Shipment update for {{ order_number }}',
    body: '<mjml><mj-body><mj-section><mj-column><mj-text>Your order {{ order_number }} is now {{ shipment_status }}.</mj-text></mj-column></mj-section></mj-body></mjml>',
  },
  cart_abandoned: {
    subject: 'Your LetBuyy cart is waiting',
    body: '<mjml><mj-body><mj-section><mj-column><mj-text>Complete your cart at {{ checkout_url }}.</mj-text></mj-column></mj-section></mj-body></mjml>',
  },
};

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function lookupContextPath(context: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (!current || typeof current !== 'object' || Array.isArray(current)) return undefined;
    return (current as Record<string, unknown>)[key];
  }, context);
}

function renderLiquidLike(template: string, context: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_match, path: string) => (
    escapeHtml(lookupContextPath(context, path))
  ));
}

function normalizeMjml(input: string): string {
  return input
    .replace(/<\/?mjml[^>]*>/gi, '')
    .replace(/<mj-body([^>]*)>/gi, '<div$1>')
    .replace(/<\/mj-body>/gi, '</div>')
    .replace(/<mj-section([^>]*)>/gi, '<section$1>')
    .replace(/<\/mj-section>/gi, '</section>')
    .replace(/<mj-column([^>]*)>/gi, '<div$1>')
    .replace(/<\/mj-column>/gi, '</div>')
    .replace(/<mj-text([^>]*)>/gi, '<p$1>')
    .replace(/<\/mj-text>/gi, '</p>')
    .replace(/<mj-button([^>]*)>/gi, '<a$1>')
    .replace(/<\/mj-button>/gi, '</a>');
}

function htmlToText(input: string): string {
  return input
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function renderEmailTemplate(input: z.infer<typeof EmailRenderSchema>): RenderedEmailTemplate {
  const parsed = EmailRenderSchema.parse(input);
  const fallback = DEFAULT_EMAIL_TEMPLATES[parsed.template_key] || {
    subject: parsed.subject || parsed.template_key,
    body: parsed.body || '<mjml><mj-body><mj-section><mj-column><mj-text>{{ message }}</mj-text></mj-column></mj-section></mj-body></mjml>',
  };
  const subject = renderLiquidLike(parsed.subject || fallback.subject, parsed.context);
  const rawBody = renderLiquidLike(parsed.body || fallback.body, parsed.context);
  const html = normalizeMjml(rawBody);

  return {
    template_key: parsed.template_key,
    locale: parsed.locale,
    subject,
    html,
    text: htmlToText(html),
  };
}

export function planEmailProviderFailover(input: {
  mode?: EmailMode | null;
  preferredProvider?: EmailProvider | null;
  availableProviders?: EmailProvider[] | null;
} = {}): EmailProviderFailoverPlan {
  const mode = input.mode || 'sandbox';
  const baseline = input.availableProviders?.length
    ? input.availableProviders
    : mode === 'live'
      ? LIVE_EMAIL_PROVIDERS
      : SANDBOX_EMAIL_PROVIDERS;
  const providers = baseline.filter((provider, index) => baseline.indexOf(provider) === index);
  const preferred = input.preferredProvider && providers.includes(input.preferredProvider)
    ? input.preferredProvider
    : null;

  return {
    mode,
    providers: preferred
      ? [preferred, ...providers.filter((provider) => provider !== preferred)]
      : providers,
    preferred_provider: preferred,
  };
}

const WHATSAPP_FIRST_ORDER: NotificationChannel[] = ['whatsapp', 'sms', 'email', 'push', 'in_app'];

function canReachChannel(channel: NotificationChannel, recipient: NotificationRecipient): boolean {
  if (channel === 'whatsapp' || channel === 'sms') return Boolean(recipient.phone);
  if (channel === 'email') return Boolean(recipient.email);
  if (channel === 'push') return Boolean(recipient.push_token || recipient.actor_id);
  if (channel === 'in_app') return Boolean(recipient.actor_id);
  return false;
}

export function planNotificationRoute(input: {
  recipient: NotificationRecipient;
  explicitChannel?: NotificationChannel | null;
  preferredChannels?: NotificationChannel[] | null;
}): NotificationRoutePlan {
  const ordered = input.explicitChannel
    ? [input.explicitChannel]
    : (input.preferredChannels?.length ? input.preferredChannels : WHATSAPP_FIRST_ORDER);
  const candidates = ordered.filter((channel, index) => ordered.indexOf(channel) === index);
  const selected = candidates.find((channel) => canReachChannel(channel, input.recipient)) || null;

  return {
    selected_channel: selected,
    candidates,
    reason: input.explicitChannel ? 'explicit' : selected ? 'whatsapp_first' : 'no_reachable_channel',
  };
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

export type WhatsAppOrderLifecycleTemplateKey =
  | 'order_paid'
  | 'order_shipped'
  | 'order_delivered'
  | 'cod_confirmation';

export type WhatsAppNotificationCategory = 'order_lifecycle' | 'cod_confirmation';

export interface PlannedWhatsAppNotification {
  template_key: WhatsAppOrderLifecycleTemplateKey;
  category: WhatsAppNotificationCategory;
  session_type: 'lifecycle' | 'cod_confirmation';
  event_status: 'paid' | 'shipped' | 'delivered' | 'cod_confirmation_requested';
  consent_required: true;
  fail_closed_without_consent: true;
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

export function planWhatsAppNotificationForEvent(event: RuntimeEventEnvelope): PlannedWhatsAppNotification | null {
  const data = notificationData(event);

  switch (event.event_type) {
    case 'order.paid':
      return {
        template_key: 'order_paid',
        category: 'order_lifecycle',
        session_type: 'lifecycle',
        event_status: 'paid',
        consent_required: true,
        fail_closed_without_consent: true,
        data,
      };
    case 'order.fulfilled':
      return {
        template_key: 'order_shipped',
        category: 'order_lifecycle',
        session_type: 'lifecycle',
        event_status: 'shipped',
        consent_required: true,
        fail_closed_without_consent: true,
        data,
      };
    case 'order.delivered':
      return {
        template_key: 'order_delivered',
        category: 'order_lifecycle',
        session_type: 'lifecycle',
        event_status: 'delivered',
        consent_required: true,
        fail_closed_without_consent: true,
        data,
      };
    case 'cod.confirmation_requested':
      return {
        template_key: 'cod_confirmation',
        category: 'cod_confirmation',
        session_type: 'cod_confirmation',
        event_status: 'cod_confirmation_requested',
        consent_required: true,
        fail_closed_without_consent: true,
        data,
      };
    default:
      return null;
  }
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
export type NotificationSendInput = z.infer<typeof NotificationSendSchema>;
export type EmailRenderInput = z.infer<typeof EmailRenderSchema>;
export type EmailSendInput = z.infer<typeof EmailSendSchema>;
