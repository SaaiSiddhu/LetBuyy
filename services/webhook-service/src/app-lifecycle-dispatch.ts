import { hmacSha256Hex } from "@letbuyy/auth-core";

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
    allowLocalhost?: boolean;
    nowSeconds?: number;
}

function isValidAppLifecycleTarget(targetUrl: string, allowLocalhost: boolean): boolean {
    try {
        const url = new URL(targetUrl);
        const localHttp = allowLocalhost
            && url.protocol === "http:"
            && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
        return (url.protocol === "https:" || localHttp) && url.hostname.length > 0;
    } catch {
        return false;
    }
}

async function readPreview(response: Response, maxCharacters = 2000): Promise<string | null> {
    const text = await response.text().catch(() => "");
    return text ? text.slice(0, maxCharacters) : null;
}

export async function dispatchAppLifecycleWebhook(
    input: AppLifecycleWebhookDispatchInput,
    fetcher: typeof fetch = fetch,
    options: AppLifecycleWebhookDispatchOptions = {},
): Promise<AppLifecycleWebhookDispatchResult> {
    if (!input.signing_secret) {
        return { ok: false, status: null, response_preview: null, error: "signing_secret is required" };
    }

    if (!isValidAppLifecycleTarget(input.target_url, options.allowLocalhost === true)) {
        return { ok: false, status: null, response_preview: null, error: "Webhook target URL must be HTTPS" };
    }

    const body = JSON.stringify({
        id: input.event_id,
        event_type: input.event_type,
        created_at: new Date((options.nowSeconds ?? Math.floor(Date.now() / 1000)) * 1000).toISOString(),
        payload: input.payload,
    });
    const timestamp = String(options.nowSeconds ?? Math.floor(Date.now() / 1000));
    const signature = await hmacSha256Hex(input.signing_secret, `${timestamp}.${body}`);

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
                "X-LetBuyy-Signature": `v1=${signature}`,
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
