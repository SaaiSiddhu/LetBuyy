import { hmacSha256Hex, timingSafeEqualHex } from "@letbuyy/auth-core";

export const LETBUYY_WEBHOOK_HMAC_HEADER = "X-LetBuyy-Hmac-SHA256";
export const LETBUYY_WEBHOOK_LEGACY_SIGNATURE_HEADER = "X-LetBuyy-Signature";

export interface AppLifecycleWebhookDispatchInput {
    target_url: string;
    event_id: string;
    event_type: string;
    payload: Record<string, unknown>;
    signing_secret: string;
    request_id?: string | null;
    trace_id?: string | null;
}

export interface AppLifecycleWebhookDispatchResult {
    ok: boolean;
    status: number | null;
    response_preview: string | null;
    error: string | null;
}

export interface AppLifecycleWebhookDispatchOptions {
    nowSeconds?: number;
}

export interface LetBuyyWebhookHmacVerificationInput {
    rawBody: string;
    timestamp: string | null | undefined;
    signature: string | null | undefined;
    signingSecret: string;
}

function isValidAppLifecycleTarget(targetUrl: string): boolean {
    try {
        const url = new URL(targetUrl);
        return url.protocol === "https:" && url.hostname.length > 0;
    } catch {
        return false;
    }
}

async function readPreview(response: Response, maxCharacters = 2000): Promise<string | null> {
    const text = await response.text().catch(() => "");
    return text ? text.slice(0, maxCharacters) : null;
}

function normalizeVersionedSignature(signature: string | null | undefined): string {
    if (!signature) return "";
    return signature.startsWith("v1=") ? signature.slice(3) : signature;
}

export function letbuyyWebhookSigningPayload(timestamp: string, rawBody: string): string {
    return `${timestamp}.${rawBody}`;
}

export async function verifyLetBuyyWebhookHmac(input: LetBuyyWebhookHmacVerificationInput): Promise<boolean> {
    if (!input.timestamp || !input.signature || !input.signingSecret) return false;
    const expected = await hmacSha256Hex(
        input.signingSecret,
        letbuyyWebhookSigningPayload(input.timestamp, input.rawBody),
    );
    return timingSafeEqualHex(expected, normalizeVersionedSignature(input.signature));
}

export async function dispatchLetBuyyWebhook(
    input: AppLifecycleWebhookDispatchInput,
    fetcher: typeof fetch = fetch,
    options: AppLifecycleWebhookDispatchOptions = {},
): Promise<AppLifecycleWebhookDispatchResult> {
    if (!input.signing_secret) {
        return { ok: false, status: null, response_preview: null, error: "signing_secret is required" };
    }

    if (!isValidAppLifecycleTarget(input.target_url)) {
        return { ok: false, status: null, response_preview: null, error: "Webhook target URL must be HTTPS" };
    }

    const body = JSON.stringify({
        id: input.event_id,
        event_type: input.event_type,
        created_at: new Date((options.nowSeconds ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        payload: input.payload,
    });
    const timestamp = String(options.nowSeconds ?? Math.floor(Date.now() / 1000));
    const signature = await hmacSha256Hex(input.signing_secret, letbuyyWebhookSigningPayload(timestamp, body));
    const versionedSignature = `v1=${signature}`;

    try {
        const response = await fetcher(input.target_url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "User-Agent": "LetBuyy-App-Webhooks/1.0",
                "X-LetBuyy-Event-ID": input.event_id,
                "X-LetBuyy-Event-Type": input.event_type,
                "X-LetBuyy-Request-ID": input.request_id || "",
                "X-LetBuyy-Trace-ID": input.trace_id || "",
                "X-LetBuyy-Timestamp": timestamp,
                [LETBUYY_WEBHOOK_HMAC_HEADER]: versionedSignature,
                [LETBUYY_WEBHOOK_LEGACY_SIGNATURE_HEADER]: versionedSignature,
            },
            body,
        });
        const responsePreview = await readPreview(response);

        if (response.ok) {
            return { ok: true, status: response.status, response_preview: responsePreview, error: null };
        }

        return {
            ok: false,
            status: response.status,
            response_preview: responsePreview,
            error: `Webhook endpoint returned HTTP ${response.status}`,
        };
    } catch (error) {
        return {
            ok: false,
            status: null,
            response_preview: null,
            error: error instanceof Error ? error.message : "Webhook request failed",
        };
    }
}

export const dispatchAppLifecycleWebhook = dispatchLetBuyyWebhook;
