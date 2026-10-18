// Phase 2 / D04.8 independent preparation (Mandate 6, Section 10).
//
// A dependency-injected delivery BOUNDARY for the console's magic-link email, separated into the
// four distinct things Mandate 6 explicitly asks to keep apart:
//   1. adapter wiring       -- this file (the interface + a local capture adapter)
//   2. sender configuration -- NOT decided here (no "from" address is chosen)
//   3. provider credentials -- NOT touched here (no RESEND_API_KEY read, no live send)
//   4. production activation -- NOT done here (getConfiguredDeliveryAdapter returns null until a
//      real adapter is wired in, which is D04.8's own decision, not this file's)
//
// packages/infrastructure/resend-adapter already exists and is reusable (SECURITY_ACCEPTANCE.md
// Section 8) -- a real ResendConsoleMagicLinkDeliveryAdapter would call `sendResendEmail` from that
// package. It is not implemented here because doing so requires choosing a sender address and
// delivery-failure ownership, both D04.8 policy questions. This file is the part that does NOT
// require that decision: the interface every real adapter must satisfy, and a local, no-network
// capture adapter that lets the rest of the login flow (and its tests) be written and exercised
// today, against this exact contract, without waiting for it.

export interface ConsoleMagicLinkDeliveryInput {
  email: string;
  magicLinkUrl: string;
}

export interface ConsoleMagicLinkDeliveryResult {
  success: boolean;
  /** A stable identifier for this delivery ATTEMPT (never the token, never the link) -- safe to log
   *  or audit; correlates a failure back to a specific send without ever exposing what would let
   *  someone complete the login. */
  attemptId: string;
  error?: string;
}

export interface ConsoleMagicLinkDeliveryAdapter {
  send(input: ConsoleMagicLinkDeliveryInput): Promise<ConsoleMagicLinkDeliveryResult>;
}

/**
 * Local-only capture transport. Sends nothing over any network -- stores what WOULD have been sent
 * in memory, for a test (or a local dev tool) to inspect. This is what Mandate 6 calls a
 * "capture-transport test": it proves the delivery BOUNDARY (the shape of what a real adapter
 * receives and must return) without sending an external message, and without assuming any sender
 * identity.
 */
export class CaptureConsoleMagicLinkDeliveryAdapter implements ConsoleMagicLinkDeliveryAdapter {
  public readonly captured: ConsoleMagicLinkDeliveryInput[] = [];
  private nextAttemptId = 1;

  async send(input: ConsoleMagicLinkDeliveryInput): Promise<ConsoleMagicLinkDeliveryResult> {
    this.captured.push(input);
    return { success: true, attemptId: `capture-${this.nextAttemptId++}` };
  }
}

/**
 * A capture adapter that always reports failure, for exercising the failure path without a real
 * provider outage.
 */
export class AlwaysFailingConsoleMagicLinkDeliveryAdapter implements ConsoleMagicLinkDeliveryAdapter {
  constructor(private readonly reason: string = 'simulated provider failure') {}
  async send(): Promise<ConsoleMagicLinkDeliveryResult> {
    return { success: false, attemptId: 'failing-adapter', error: this.reason };
  }
}

/**
 * The production wiring point. Returns null today -- deliberately, not as an oversight. A real
 * adapter (backed by packages/infrastructure/resend-adapter) can only be returned here once D04.8
 * (sender address, delivery-failure ownership) is answered; until then, null is the honest answer,
 * and every caller of this function MUST treat null as "delivery unavailable", never substitute a
 * default sender or silently no-op as if a message had gone out.
 */
export function getConfiguredConsoleMagicLinkDeliveryAdapter(): ConsoleMagicLinkDeliveryAdapter | null {
  return null;
}

/**
 * The fail-closed contract every caller of the delivery boundary must follow: no adapter configured
 * means the login attempt is refused, never silently treated as sent. Exists as its own function so
 * "what happens when there is no adapter" is one tested, callable thing, not a scattered null-check.
 */
export async function attemptConsoleMagicLinkDelivery(
  adapter: ConsoleMagicLinkDeliveryAdapter | null,
  input: ConsoleMagicLinkDeliveryInput,
): Promise<{ delivered: boolean; reason?: string }> {
  if (!adapter) {
    return { delivered: false, reason: 'delivery_not_configured' };
  }
  const result = await adapter.send(input);
  if (!result.success) {
    return { delivered: false, reason: 'delivery_failed' };
  }
  return { delivered: true };
}
