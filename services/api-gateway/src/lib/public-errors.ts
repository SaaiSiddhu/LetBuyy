export type ErrorResponsePayload = {
    success?: boolean;
    error?: {
        code?: unknown;
        message?: unknown;
        details?: unknown;
        hint?: unknown;
        cause?: unknown;
        stack?: unknown;
        [key: string]: unknown;
    };
    [key: string]: unknown;
};

export const FIXED_PUBLIC_ERROR_MESSAGES: Record<string, string> = {
    ANALYTICS_QUEUE_ERROR: 'Analytics event queue request failed',
    APP_BILLING_PROVIDER_ERROR: 'App billing provider request failed',
    AUTH_ERROR: 'Authentication failed',
    DB_ERROR: 'Database operation failed',
    DOMAIN_EVENT_EMIT_FAILED: 'Domain event emit failed',
    EMAIL_PROVIDER_ERROR: 'Email provider request failed',
    EXPORT_UNAVAILABLE: 'Export is temporarily unavailable',
    INTERNAL_ERROR: 'An internal error occurred',
    IMPORT_UNAVAILABLE: 'Import is temporarily unavailable',
    PAYMENT_ERROR: 'Payment request failed',
    PAYMENT_PROVIDER_ERROR: 'Payment provider request failed',
    RATE_LIMIT_UNAVAILABLE: 'Rate limiting is temporarily unavailable',
    SEARCH_ERROR: 'Search operation failed',
    SERVER_MISCONFIGURED: 'Service is not configured',
};

export const CLIENT_ACTIONABLE_ERROR_CODES = new Set([
    'AMOUNT_MISMATCH',
    'APP_BILLING_PROVIDER_PROOF_REQUIRED',
    'APP_BILLING_PROVIDER_REFERENCE_MISMATCH',
    'APP_BILLING_PROVIDER_SIGNATURE_INVALID',
    'APP_BILLING_PROVIDER_UNCONFIGURED',
    'CONFLICT',
    'CUSTOMER_AUTH_RATE_LIMITED',
    'EMAIL_NOT_VERIFIED',
    'EXPIRED',
    'FEATURE_DISABLED',
    'FORBIDDEN',
    'IDEMPOTENCY_CONFLICT',
    'INVALID_CREDENTIALS',
    'INVALID_EVENT',
    'INVALID_GRANT',
    'MISSING_IDEMPOTENCY_KEY',
    'NOT_FOUND',
    'PAYLOAD_TOO_LARGE',
    'PAYMENT_CURRENCY_UNSUPPORTED',
    'PAYMENT_REFERENCE_MISMATCH',
    'PAYMENT_REQUIRED',
    'PAYMENT_SIGNATURE_INVALID',
    'PAYMENT_UNAVAILABLE',
    'PLAN_REQUIRES_SALES',
    'PRODUCT_NOT_FOUND',
    'RATE_LIMITED',
    'RATE_LIMIT_EXCEEDED',
    'SHIPPING_SCHEMA_MISSING',
    'TAX_SCHEMA_MISSING',
    // Channel listings (MKT-1 / ADM-1): the messages behind these codes are fixed, generic and free of
    // table, RPC or provider detail (routes/channel-listings.ts mapChannelListingDatabaseError), and a
    // merchant needs them verbatim to act: "a marketplace category is required before review" is not
    // "Request failed".
    'TENANT_CONTEXT_MISSING',
    'TENANT_TX_UNAVAILABLE',
    'TURNSTILE_REQUIRED',
    'UNAUTHORIZED',
    'UNPROCESSABLE',
    'VALIDATION',
    'VALIDATION_ERROR',
]);

const DEBUG_ERROR_FIELDS = new Set(['details', 'hint', 'cause', 'stack']);

function stringCode(value: unknown): string | null {
    return typeof value === 'string' && value.trim() ? value : null;
}

function publicMessageForCode(code: string, currentMessage: unknown): { message: string; preserve: boolean } {
    const fixedMessage = FIXED_PUBLIC_ERROR_MESSAGES[code];
    if (fixedMessage) return { message: fixedMessage, preserve: false };

    if (CLIENT_ACTIONABLE_ERROR_CODES.has(code) && typeof currentMessage === 'string' && currentMessage.trim()) {
        return { message: currentMessage, preserve: true };
    }

    return { message: 'Request failed', preserve: false };
}

export function sanitizePublicErrorPayload(payload: unknown): { payload: ErrorResponsePayload; changed: boolean; code: string | null } {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { payload: {} as ErrorResponsePayload, changed: false, code: null };
    }

    const body = payload as ErrorResponsePayload;
    const code = stringCode(body.error?.code);
    if (!code || !body.error) {
        return { payload: body, changed: false, code: null };
    }

    const { message, preserve } = publicMessageForCode(code, body.error.message);
    const nextError: ErrorResponsePayload['error'] = {
        ...body.error,
        message,
    };

    if (!preserve) {
        for (const field of DEBUG_ERROR_FIELDS) {
            delete nextError[field];
        }
    }

    const nextPayload: ErrorResponsePayload = {
        ...body,
        success: body.success === false ? false : body.success,
        error: nextError,
    };

    const changed =
        body.error.message !== message
        || Array.from(DEBUG_ERROR_FIELDS).some((field) => field in body.error! && !(field in nextError));

    return { payload: nextPayload, changed, code };
}
