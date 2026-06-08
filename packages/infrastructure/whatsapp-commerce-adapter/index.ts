export type WhatsAppCommerceProviderMode = 'sandbox' | 'live';
export type WhatsAppCommerceProvider = 'letbuyy_sandbox' | 'twilio' | 'manual';
export type WhatsAppTemplateKey =
  | 'order_update'
  | 'order_paid'
  | 'order_shipped'
  | 'order_delivered'
  | 'shipping_update'
  | 'cod_confirmation'
  | 'abandoned_cart'
  | 'custom_message';
export type WhatsAppMessageStatus = 'queued' | 'sent' | 'failed' | 'received';

export interface WhatsAppCommerceCredentials {
  mode?: WhatsAppCommerceProviderMode | string | null;
  provider?: WhatsAppCommerceProvider | string | null;
  accountSid?: string | null;
  authToken?: string | null;
  from?: string | null;
  webhookSecret?: string | null;
  environment?: string | null;
  appEnv?: string | null;
  nodeEnv?: string | null;
}

export interface WhatsAppTemplate {
  key: WhatsAppTemplateKey;
  label: string;
  description: string;
  requiredVariables: string[];
}

export interface SendWhatsAppTemplateInput {
  storeId: string;
  customerEmail?: string | null;
  toPhone: string;
  template: WhatsAppTemplateKey;
  variables?: Record<string, string | number | boolean | null | undefined>;
  message?: string | null;
  idempotencyKey?: string | null;
}

export interface WhatsAppSendResult {
  provider: WhatsAppCommerceProvider;
  providerMode: WhatsAppCommerceProviderMode;
  providerMessageId: string;
  status: WhatsAppMessageStatus;
  toPhone: string;
  body: string;
  sandbox: boolean;
  metadata: Record<string, unknown>;
}

export interface WhatsAppInboundMessage {
  fromPhone: string;
  toPhone?: string | null;
  body: string;
  providerMessageId?: string | null;
  customerEmail?: string | null;
  storeId?: string | null;
  receivedAt: string;
  metadata: Record<string, unknown>;
}

export interface WhatsAppWebhookVerificationInput {
  url: string;
  headers: Record<string, string | undefined>;
  form: Record<string, string>;
  rawBody: string;
}

export interface WhatsAppCommerceAdapter {
  provider: WhatsAppCommerceProvider;
  mode: WhatsAppCommerceProviderMode;
  available: boolean;
  unavailableReason: string | null;
  templates: WhatsAppTemplate[];
  renderTemplate(input: SendWhatsAppTemplateInput): string;
  sendTemplate(input: SendWhatsAppTemplateInput): Promise<WhatsAppSendResult>;
  verifyInboundWebhook(input: WhatsAppWebhookVerificationInput): Promise<boolean>;
  parseInboundWebhook(form: Record<string, string>): WhatsAppInboundMessage;
}

const TEMPLATES: WhatsAppTemplate[] = [
  {
    key: 'order_update',
    label: 'Order update',
    description: 'Send a short order status update.',
    requiredVariables: ['order_number', 'status'],
  },
  {
    key: 'order_paid',
    label: 'Order paid',
    description: 'Confirm payment and order acceptance.',
    requiredVariables: ['order_number'],
  },
  {
    key: 'order_shipped',
    label: 'Order shipped',
    description: 'Send shipment handoff details.',
    requiredVariables: ['order_number', 'carrier', 'tracking_number'],
  },
  {
    key: 'order_delivered',
    label: 'Order delivered',
    description: 'Confirm delivery completion.',
    requiredVariables: ['order_number'],
  },
  {
    key: 'shipping_update',
    label: 'Shipping update',
    description: 'Send tracking information after fulfillment.',
    requiredVariables: ['order_number', 'carrier', 'tracking_number'],
  },
  {
    key: 'cod_confirmation',
    label: 'COD confirmation',
    description: 'Ask the shopper to reply YES to confirm a COD order.',
    requiredVariables: ['order_number'],
  },
  {
    key: 'abandoned_cart',
    label: 'Abandoned cart',
    description: 'Invite a customer back to checkout.',
    requiredVariables: ['store_name', 'checkout_url'],
  },
  {
    key: 'custom_message',
    label: 'Custom message',
    description: 'Send a merchant-written customer message.',
    requiredVariables: ['message'],
  },
];

function isConfigured(value: string | null | undefined): value is string {
  const trimmed = value?.trim();
  return Boolean(trimmed && !trimmed.startsWith('SKIP_NEEDS_HUMAN_') && !trimmed.includes('replace-with'));
}

function isProductionRuntime(credentials: WhatsAppCommerceCredentials): boolean {
  return [credentials.environment, credentials.appEnv, credentials.nodeEnv]
    .some((value) => value?.toLowerCase() === 'production');
}

function normalizeMode(credentials: WhatsAppCommerceCredentials): WhatsAppCommerceProviderMode {
  if (credentials.mode === 'sandbox' || credentials.mode === 'live') return credentials.mode;
  return isProductionRuntime(credentials) ? 'live' : 'sandbox';
}

function normalizeProvider(provider: WhatsAppCommerceCredentials['provider']): WhatsAppCommerceProvider {
  return provider === 'twilio' || provider === 'manual' ? provider : 'letbuyy_sandbox';
}

function normalizePhone(value: string): string {
  return value
    .replace(/^whatsapp:/i, '')
    .replace(/[^\d+]/g, '')
    .trim();
}

function valueForVariable(input: SendWhatsAppTemplateInput, key: string): string {
  if (key === 'message' && input.message?.trim()) return input.message.trim();
  const value = input.variables?.[key];
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

function renderTemplate(input: SendWhatsAppTemplateInput): string {
  const template = input.template;
  if (template === 'custom_message') return valueForVariable(input, 'message').slice(0, 1200);
  if (template === 'shipping_update' || template === 'order_shipped') {
    const tracking = valueForVariable(input, 'tracking_number') || 'pending';
    return `Order ${valueForVariable(input, 'order_number')} shipped via ${valueForVariable(input, 'carrier') || 'your carrier'}. Tracking: ${tracking}.`.slice(0, 1200);
  }
  if (template === 'order_paid') {
    return `Payment received for order ${valueForVariable(input, 'order_number')}. We will send fulfilment updates here.`.slice(0, 1200);
  }
  if (template === 'order_delivered') {
    return `Order ${valueForVariable(input, 'order_number')} has been delivered. Thank you for shopping with us.`.slice(0, 1200);
  }
  if (template === 'cod_confirmation') {
    return `Reply YES to confirm COD order ${valueForVariable(input, 'order_number')}. Reply NO to cancel.`.slice(0, 1200);
  }
  if (template === 'abandoned_cart') {
    return `You still have items waiting at ${valueForVariable(input, 'store_name') || 'this store'}. Complete checkout: ${valueForVariable(input, 'checkout_url')}`.slice(0, 1200);
  }
  return `Order ${valueForVariable(input, 'order_number')} is ${valueForVariable(input, 'status') || 'updated'}. ${valueForVariable(input, 'total')}`.trim().slice(0, 1200);
}

function configuredBasicAuth(accountSid: string, authToken: string): string {
  const encoded = `${accountSid}:${authToken}`;
  if (typeof btoa === 'function') return btoa(encoded);
  const maybeBuffer = (globalThis as unknown as {
    Buffer?: { from(value: string): { toString(encoding: 'base64'): string } };
  }).Buffer;
  return maybeBuffer?.from(encoded).toString('base64') || encoded;
}

function base64FromBytes(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  if (typeof btoa === 'function') return btoa(binary);
  const maybeBuffer = (globalThis as unknown as {
    Buffer?: { from(value: Uint8Array): { toString(encoding: 'base64'): string } };
  }).Buffer;
  return maybeBuffer?.from(bytes).toString('base64') || binary;
}

function timingSafeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return diff === 0;
}

async function twilioSignature(authToken: string, url: string, form: Record<string, string>): Promise<string | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;
  const sortedPayload = Object.keys(form)
    .sort()
    .reduce((acc, key) => `${acc}${key}${form[key]}`, url);
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(authToken),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(sortedPayload));
  return base64FromBytes(new Uint8Array(signature));
}

async function sendTwilioMessage(
  credentials: { accountSid: string; authToken: string; from: string },
  input: SendWhatsAppTemplateInput,
  body: string,
): Promise<WhatsAppSendResult> {
  const form = new URLSearchParams({
    From: `whatsapp:${normalizePhone(credentials.from)}`,
    To: `whatsapp:${normalizePhone(input.toPhone)}`,
    Body: body,
  });
  const response = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(credentials.accountSid)}/Messages.json`, {
    method: 'POST',
    headers: {
      authorization: `Basic ${configuredBasicAuth(credentials.accountSid, credentials.authToken)}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });

  const payload = await response.json() as { sid?: string; status?: string; error_message?: string };
  if (!response.ok || !payload.sid) {
    throw new Error(payload.error_message || `WhatsApp provider request failed with ${response.status}`);
  }

  return {
    provider: 'twilio',
    providerMode: 'live',
    providerMessageId: payload.sid,
    status: payload.status === 'failed' ? 'failed' : 'queued',
    toPhone: normalizePhone(input.toPhone),
    body,
    sandbox: false,
    metadata: {
      twilio_status: payload.status || 'queued',
    },
  };
}

export function createWhatsAppCommerceAdapter(credentials: WhatsAppCommerceCredentials): WhatsAppCommerceAdapter {
  const mode = normalizeMode(credentials);
  const provider = normalizeProvider(credentials.provider);
  const twilioLiveConfigured = mode === 'live'
    && provider === 'twilio'
    && isConfigured(credentials.accountSid)
    && isConfigured(credentials.authToken)
    && isConfigured(credentials.from);
  const available = mode === 'sandbox' || twilioLiveConfigured;
  const unavailableReason = available ? null : 'WhatsApp provider credentials must be configured before live sends';

  return {
    provider,
    mode,
    available,
    unavailableReason,
    templates: TEMPLATES,
    renderTemplate,

    async sendTemplate(input) {
      const toPhone = normalizePhone(input.toPhone);
      const body = renderTemplate({ ...input, toPhone });
      if (!toPhone) throw new Error('Customer phone number is required');
      if (!body) throw new Error('WhatsApp message body is required');

      if (mode === 'sandbox') {
        return {
          provider: 'letbuyy_sandbox',
          providerMode: 'sandbox',
          providerMessageId: `wa_sandbox_${input.storeId}_${Math.abs(body.length + toPhone.length)}`,
          status: 'queued',
          toPhone,
          body,
          sandbox: true,
          metadata: {
            sandbox: true,
            template: input.template,
          },
        };
      }

      if (!twilioLiveConfigured) {
        throw new Error(unavailableReason || 'WhatsApp provider is not configured');
      }

      return sendTwilioMessage({
        accountSid: credentials.accountSid as string,
        authToken: credentials.authToken as string,
        from: credentials.from as string,
      }, { ...input, toPhone }, body);
    },

    async verifyInboundWebhook(input) {
      if (mode === 'sandbox') {
        const expected = credentials.webhookSecret;
        if (!isConfigured(expected)) return !isProductionRuntime(credentials);
        return input.headers['x-letbuyy-whatsapp-webhook-secret'] === expected;
      }

      if (!isConfigured(credentials.authToken)) return false;
      const provided = input.headers['x-twilio-signature'];
      if (!provided) return false;
      const expected = await twilioSignature(credentials.authToken, input.url, input.form);
      return Boolean(expected && timingSafeEqual(expected, provided));
    },

    parseInboundWebhook(form) {
      const body = form.Body || form.body || form.message || '';
      return {
        fromPhone: normalizePhone(form.From || form.from || form.customer_phone || ''),
        toPhone: normalizePhone(form.To || form.to || '') || null,
        body,
        providerMessageId: form.MessageSid || form.SmsSid || form.message_sid || null,
        customerEmail: form.customer_email || form.CustomerEmail || null,
        storeId: form.store_id || form.StoreId || null,
        receivedAt: new Date().toISOString(),
        metadata: {
          wa_id: form.WaId || null,
          profile_name: form.ProfileName || null,
          raw_provider: provider,
        },
      };
    },
  };
}
