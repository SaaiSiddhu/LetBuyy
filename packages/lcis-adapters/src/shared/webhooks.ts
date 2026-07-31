/**
 * WebhookRegistry — read-only DESCRIPTORS of the webhook surfaces the platform exposes or
 * consumes (e.g. the Razorpay payment webhook, GitHub repo webhooks). This is descriptive
 * intelligence ONLY: no server is started, no request is received, no handler is invoked.
 * It exists so LCIS can answer "which webhook surfaces exist, who signs them, and are their
 * verification credentials present?" — the delivery values themselves stay NOT_CONNECTED
 * until a live delivery-log signal is wired through an adapter.
 */
import type { CredentialProvider } from './credentials';

export interface WebhookDescriptor {
  /** Stable key, e.g. 'razorpay.payments'. */
  readonly key: string;
  /** The external system that SENDS the webhook (the source of truth). */
  readonly provider: string;
  /** Direction relative to LetBuyy: 'inbound' (we receive) or 'outbound' (we send). */
  readonly direction: 'inbound' | 'outbound';
  /** The repo-relative handler or emitter path, when known. */
  readonly handlerPath: string | null;
  /** Signature scheme, e.g. 'HMAC-SHA256'. */
  readonly signatureScheme: string;
  /** Env vars whose PRESENCE is required to verify/sign deliveries. */
  readonly requiredEnv: readonly string[];
  /** Event kinds carried, e.g. ['payment.captured', 'refund.processed']. */
  readonly events: readonly string[];
}

export interface WebhookResolution {
  readonly webhook: WebhookDescriptor;
  /** Whether the signing/verification credentials are PRESENT (values never read). */
  readonly credentials: 'PRESENT' | 'MISSING';
  readonly missingEnv: readonly string[];
  /** Delivery history is a live value — always NOT_CONNECTED until an adapter signal provides it. */
  readonly deliveries: 'NOT_CONNECTED';
  readonly detail: string;
}

export class WebhookRegistry {
  private readonly hooks = new Map<string, WebhookDescriptor>();

  register(hook: WebhookDescriptor): void {
    if (this.hooks.has(hook.key)) {
      throw new Error(`lcis-adapters: duplicate webhook registration: '${hook.key}'`);
    }
    this.hooks.set(hook.key, hook);
  }

  registerAll(hooks: readonly WebhookDescriptor[]): void {
    for (const h of hooks) this.register(h);
  }

  get(key: string): WebhookDescriptor | null {
    return this.hooks.get(key) ?? null;
  }

  keys(): readonly string[] {
    return [...this.hooks.keys()].sort();
  }

  list(): readonly WebhookDescriptor[] {
    return this.keys().map((k) => this.hooks.get(k)!);
  }

  byProvider(provider: string): readonly WebhookDescriptor[] {
    return this.list().filter((h) => h.provider === provider);
  }

  size(): number {
    return this.hooks.size;
  }

  resolve(key: string, creds: CredentialProvider): WebhookResolution | null {
    const webhook = this.hooks.get(key);
    if (!webhook) return null;
    const presence = creds.check(webhook.requiredEnv);
    return {
      webhook,
      credentials: presence.present ? 'PRESENT' : 'MISSING',
      missingEnv: presence.missing,
      deliveries: 'NOT_CONNECTED',
      detail: presence.present
        ? `Webhook '${webhook.key}' (${webhook.provider}, ${webhook.direction}) verification credentials PRESENT; delivery history NOT_CONNECTED (needs a delivery-log signal).`
        : `Webhook '${webhook.key}' (${webhook.provider}, ${webhook.direction}) — set ${presence.missing.join(', ')} to enable signature verification.`,
    };
  }

  resolveAll(creds: CredentialProvider): readonly WebhookResolution[] {
    return this.keys().map((k) => this.resolve(k, creds)!);
  }
}
