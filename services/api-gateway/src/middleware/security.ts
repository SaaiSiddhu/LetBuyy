// ============================================================
// SECURITY MIDDLEWARE — Headers, input sanitization, CSRF protection
// ============================================================

import { createMiddleware } from 'hono/factory';
import type { Env } from '../index';
import { timingSafeEqualText } from '../lib/crypto';

type ErrorResponsePayload = {
    success?: boolean;
    error?: {
        code?: unknown;
        message?: unknown;
        [key: string]: unknown;
    };
    [key: string]: unknown;
};

// ── Security Headers ────────────────────────────────────────
// Adds standard security headers to every response
export const securityHeaders = createMiddleware<{ Bindings: Env }>(
    async (c, next) => {
        await next();

        // Prevent MIME sniffing
        c.header('X-Content-Type-Options', 'nosniff');

        // Prevent clickjacking
        c.header('X-Frame-Options', 'DENY');

        // XSS protection (legacy browsers)
        c.header('X-XSS-Protection', '1; mode=block');

        // Referrer policy
        c.header('Referrer-Policy', 'strict-origin-when-cross-origin');

        // Content Security Policy (API only — restrictive)
        c.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");

        // Strict Transport Security
        c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');

        // Prevent caching of sensitive API responses
        if (c.req.method !== 'GET') {
            c.header('Cache-Control', 'no-store, no-cache, must-revalidate');
            c.header('Pragma', 'no-cache');
        }
    }
);

// ── Input Sanitization ──────────────────────────────────────
// Strips potential XSS vectors from string inputs

const DANGEROUS_PATTERNS = [
    /<script[\s>]/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,             // onclick=, onerror=, etc.
    /<iframe[\s>]/gi,
    /<object[\s>]/gi,
    /<embed[\s>]/gi,
    /data:text\/html/gi,
    /vbscript:/gi,
];

export function sanitizeString(input: string): string {
    let sanitized = input;
    // Encode HTML entities for critical characters
    sanitized = sanitized
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');

    return sanitized;
}

export function hasDangerousContent(input: string): boolean {
    return DANGEROUS_PATTERNS.some(pattern => pattern.test(input));
}

// Deep sanitize an object — sanitize all string values
export function sanitizeObject<T>(obj: T): T {
    if (typeof obj === 'string') return sanitizeString(obj) as unknown as T;
    if (Array.isArray(obj)) return obj.map(item => sanitizeObject(item)) as unknown as T;
    if (obj && typeof obj === 'object') {
        const sanitized: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
            sanitized[key] = sanitizeObject(value);
        }
        return sanitized as T;
    }
    return obj;
}

// ── Error Response Sanitization ─────────────────────────────
// Normalizes known internal/provider error envelopes before they leave the worker.

const SANITIZED_ERROR_MESSAGES: Record<string, string> = {
    DB_ERROR: 'Database operation failed',
    INTERNAL_ERROR: 'An internal error occurred',
    PAYMENT_PROVIDER_ERROR: 'Payment provider request failed',
};

function sanitizeErrorPayload(payload: unknown): { payload: ErrorResponsePayload; changed: boolean; code: string | null } {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return { payload: {} as ErrorResponsePayload, changed: false, code: null };
    }

    const body = payload as ErrorResponsePayload;
    const code = typeof body.error?.code === 'string' ? body.error.code : null;
    if (!code || !body.error) {
        return { payload: body, changed: false, code: null };
    }

    const sanitizedMessage = SANITIZED_ERROR_MESSAGES[code];
    if (!sanitizedMessage) {
        return { payload: body, changed: false, code };
    }

    const changed = body.error.message !== sanitizedMessage;
    body.success = body.success === false ? false : body.success;
    body.error = {
        ...body.error,
        message: sanitizedMessage,
    };

    return { payload: body, changed, code };
}

export const errorResponseSanitizer = createMiddleware<{ Bindings: Env }>(
    async (c, next) => {
        await next();

        const contentType = c.res.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) return;
        if (c.res.status < 400) return;

        try {
            const payload = await c.res.clone().json();
            const sanitized = sanitizeErrorPayload(payload);

            if (sanitized.code) {
                c.header('X-Error-Code', sanitized.code);
            }

            if (!sanitized.changed) return;

            const headers = new Headers(c.res.headers);
            headers.set('content-type', 'application/json; charset=UTF-8');
            headers.set('X-Error-Code', sanitized.code || 'UNKNOWN_ERROR');

            return new Response(JSON.stringify(sanitized.payload), {
                status: c.res.status,
                statusText: c.res.statusText,
                headers,
            });
        } catch (error) {
            console.warn(JSON.stringify({
                level: 'warn',
                service: 'letbuyy-api',
                route: c.req.path,
                method: c.req.method,
                status_code: c.res.status,
                reason: 'error_response_sanitizer_failed',
                error: error instanceof Error ? error.message : 'Error response sanitizer failed',
            }));
        }
    }
);

// ── Request Validation ──────────────────────────────────────
// Validates that request body doesn't contain dangerous payloads

export const inputValidation = createMiddleware<{ Bindings: Env }>(
    async (c, next) => {
        // Only validate mutating requests with JSON bodies
        if (['POST', 'PUT', 'PATCH'].includes(c.req.method)) {
            const contentType = c.req.header('content-type');
            if (contentType?.includes('application/json')) {
                try {
                    const body = await c.req.text();

                    // Reject excessively large payloads (1MB limit)
                    if (body.length > 1_048_576) {
                        return c.json(
                            { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Request body exceeds maximum size' } },
                            413
                        );
                    }

                    // Check for dangerous content in raw body
                    if (hasDangerousContent(body)) {
                        console.warn(JSON.stringify({
                            level: 'warn',
                            service: 'letbuyy-api',
                            route: c.req.path,
                            method: c.req.method,
                            status_code: 200,
                            reason: 'dangerous_input_pattern_detected',
                            ip_address: c.req.header('CF-Connecting-IP') || null,
                        }));
                        // Don't block — just log. The output sanitization in responses handles the XSS.
                    }
                } catch (error) {
                    console.warn(JSON.stringify({
                        level: 'warn',
                        service: 'letbuyy-api',
                        route: c.req.path,
                        method: c.req.method,
                        status_code: 400,
                        reason: 'request_body_prefilter_failed',
                        error: error instanceof Error ? error.message : 'Request body prefilter failed',
                    }));
                }
            }
        }

        await next();
    }
);

function parseCookie(header: string | undefined, name: string): string | null {
    if (!header) return null;

    for (const part of header.split(';')) {
        const [rawKey, ...rawValue] = part.trim().split('=');
        if (rawKey === name) return decodeURIComponent(rawValue.join('=') || '');
    }

    return null;
}

type TurnstileEnv = Pick<Env, 'TURNSTILE_SECRET_KEY' | 'ENVIRONMENT' | 'APP_ENV' | 'NODE_ENV'>;

type TurnstileVerificationResponse = {
    success?: boolean;
};

function isLocalTurnstileRuntime(env: TurnstileEnv): boolean {
    const values = [env.ENVIRONMENT, env.APP_ENV, env.NODE_ENV]
        .filter((value): value is string => typeof value === 'string')
        .map((value) => value.toLowerCase());

    return values.includes('local') || values.includes('development');
}

export function extractTurnstileToken(input: unknown): string | null {
    if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

    const body = input as Record<string, unknown>;
    const token = body.turnstile_token
        ?? body.turnstileToken
        ?? body.cf_turnstile_response
        ?? body['cf-turnstile-response'];

    return typeof token === 'string' && token.trim() ? token.trim() : null;
}

export async function verifyTurnstileToken(env: TurnstileEnv, token: string | null, ip?: string): Promise<boolean> {
    if (!token) return false;

    if (token === 'dev-bypass-token') {
        return isLocalTurnstileRuntime(env);
    }

    if (!env.TURNSTILE_SECRET_KEY) {
        return false;
    }

    try {
        const body = new URLSearchParams({
            secret: env.TURNSTILE_SECRET_KEY,
            response: token,
        });
        if (ip) body.set('remoteip', ip);

        const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
            method: 'POST',
            body,
        });

        if (!response.ok) return false;

        const data = await response.json() as TurnstileVerificationResponse;
        return data.success === true;
    } catch {
        return false;
    }
}

export const csrfProtection = createMiddleware<{ Bindings: Env }>(
    async (c, next) => {
        if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(c.req.method)) {
            await next();
            return;
        }

        if (c.req.header('Authorization')?.startsWith('Bearer ')) {
            await next();
            return;
        }

        if (c.req.header('X-LetBuyy-Internal-Signature')) {
            await next();
            return;
        }

        const cookieToken = parseCookie(c.req.header('cookie'), 'letbuyy_csrf')
            || parseCookie(c.req.header('cookie'), 'lb_csrf');
        const headerToken = c.req.header('X-CSRF-Token') || c.req.header('X-LetBuyy-CSRF-Token');

        if (!cookieToken || !headerToken || !timingSafeEqualText(cookieToken, headerToken)) {
            return c.json(
                {
                    error: {
                        code: 'CSRF_TOKEN_INVALID',
                        message: 'CSRF token validation failed',
                    },
                },
                403
            );
        }

        await next();
    }
);

// ── Request ID ──────────────────────────────────────────────
// Assigns a unique request ID for tracing
export const requestId = createMiddleware<{ Bindings: Env }>(
    async (c, next) => {
        const id = c.req.header('X-Request-ID') || crypto.randomUUID();
        c.header('X-Request-ID', id);
        await next();
    }
);
