import { Resend } from 'resend';

/**
 * One client per API key, not one client per isolate.
 *
 * A single module-level client would be constructed by whichever caller
 * happened to send first and would then serve every later call regardless of
 * the key they passed. That silently defeats the point of the scoped keys
 * (DEMO_RESEND_API_KEY, CONTACT_RESEND_API_KEY): a public marketing form and
 * order-confirmation mail share this Worker, and the whole reason those keys
 * are separate is so a quota problem on one cannot stop the other.
 *
 * Keyed by the resolved key, so the isolation is real and clients are still
 * reused across requests in the same isolate.
 */
const resendClients = new Map<string, Resend>();

function readProcessEnv(name: string): string | undefined {
  const processLike = (globalThis as typeof globalThis & {
    process?: { env?: Record<string, string | undefined> };
  }).process;
  return processLike?.env?.[name];
}

export interface ResendEmailInput {
  apiKey?: string;
  from: string;
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  /**
   * Where a reply should land when it is not the From address.
   *
   * An internal lead alert is sent from noreply@ to a team inbox; without this
   * header, hitting Reply answers the robot. With it, it answers the customer.
   */
  replyTo?: string | string[];
  /** Stable provider key for ambiguous delivery retries; keep the message unchanged. */
  idempotencyKey?: string;
}

export function getResendClient(apiKey = readProcessEnv('RESEND_API_KEY')): Resend {
  if (!apiKey) throw new Error('[Resend] RESEND_API_KEY is not configured.');

  const cached = resendClients.get(apiKey);
  if (cached) return cached;

  const client = new Resend(apiKey);
  resendClients.set(apiKey, client);
  return client;
}

export async function sendResendEmail(input: ResendEmailInput): Promise<{ success: boolean; error?: string; messageId?: string }> {
  /* Send BOTH parts whenever the caller has both. A multipart message with a
     text/plain alternative scores materially better with spam filters than
     HTML alone, and an acknowledgement that lands in spam is the same as no
     acknowledgement. HTML-only and text-only callers are unaffected. */
  const message = {
    from: input.from,
    to: input.to,
    subject: input.subject,
    ...(input.html ? { html: input.html } : {}),
    ...(input.text ? { text: input.text } : {}),
    ...(input.html || input.text ? {} : { text: '' }),
    ...(input.replyTo ? { replyTo: input.replyTo } : {}),
  } as Parameters<Resend['emails']['send']>[0];

  const response = await getResendClient(input.apiKey).emails.send(message, input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : undefined) as {
    data?: { id?: string | null } | null;
    error?: { message?: string | null } | null;
  };
  const { data, error } = response;

  if (error) return { success: false, error: error.message || 'Resend email send failed' };
  return { success: true, messageId: data?.id || undefined };
}
