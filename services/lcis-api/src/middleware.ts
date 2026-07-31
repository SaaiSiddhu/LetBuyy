/**
 * LCIS API middleware — request-id/trace-id, security headers, rate limiting,
 * Zod request validation, structured audit logging, and catch-all error handling.
 * All are composable Hono middleware factories.
 */
import type { Context, MiddlewareHandler } from 'hono'
import { z } from 'zod'
import { createLogger, newRequestId } from '@letbuyy/lcis-core'

// ── Logger ────────────────────────────────────────────────────────────────────

const auditLog = createLogger('lcis-api')

// ── 1. Request-id + trace-id ──────────────────────────────────────────────────

export function requestIdMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const incoming = c.req.header('x-request-id') ?? newRequestId()
    const traceId = c.req.header('x-trace-id') ?? newRequestId()
    c.set('requestId', incoming)
    c.set('traceId', traceId)
    c.header('x-request-id', incoming)
    c.header('x-trace-id', traceId)
    await next()
  }
}

// ── 2. Security headers ───────────────────────────────────────────────────────

export function securityHeadersMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    await next()
    c.header('X-Content-Type-Options', 'nosniff')
    c.header('X-Frame-Options', 'DENY')
    c.header('Referrer-Policy', 'no-referrer')
    c.header('Cache-Control', 'no-store')
  }
}

// ── 3. Rate limiter (token bucket, per-IP) ────────────────────────────────────

interface BucketState {
  tokens: number
  lastRefill: number
}

export interface RateLimiterOptions {
  /** Maximum burst (bucket capacity). Default: 60 */
  capacity?: number
  /** Refill rate: tokens added per second. Default: 10 */
  refillRate?: number
}

export function rateLimiterMiddleware(opts: RateLimiterOptions = {}): MiddlewareHandler {
  const capacity = opts.capacity ?? 60
  const refillRate = opts.refillRate ?? 10
  const buckets = new Map<string, BucketState>()

  return async (c, next) => {
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      'unknown'

    const now = Date.now()
    let bucket = buckets.get(ip)
    if (!bucket) {
      bucket = { tokens: capacity, lastRefill: now }
      buckets.set(ip, bucket)
    }

    // Refill
    const elapsed = (now - bucket.lastRefill) / 1000
    bucket.tokens = Math.min(capacity, bucket.tokens + elapsed * refillRate)
    bucket.lastRefill = now

    if (bucket.tokens < 1) {
      const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
      return c.json(
        {
          success: false,
          error: { code: 'RATE_LIMITED', message: 'Too many requests. Please slow down.' },
          requestId,
        },
        429,
      )
    }

    bucket.tokens -= 1
    await next()
  }
}

// ── 4. Zod body validation ────────────────────────────────────────────────────

export function validateBody<S extends z.ZodTypeAny>(schema: S): MiddlewareHandler {
  return async (c, next) => {
    const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
    let body: unknown
    try {
      body = await c.req.json()
    } catch {
      return c.json(
        {
          success: false,
          error: { code: 'INVALID_JSON', message: 'Request body must be valid JSON.' },
          requestId,
        },
        400,
      )
    }
    const result = schema.safeParse(body)
    if (!result.success) {
      return c.json(
        {
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request body failed validation.',
            issues: result.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
          requestId,
        },
        400,
      )
    }
    c.set('validatedBody', result.data)
    await next()
  }
}

export function getValidatedBody<T>(c: Context): T {
  return c.get('validatedBody') as T
}

// ── 5. Audit log ──────────────────────────────────────────────────────────────

export function auditLogMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const start = performance.now()
    await next()
    const ms = Math.round((performance.now() - start) * 100) / 100
    const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
    auditLog.info('request', {
      method: c.req.method,
      path: new URL(c.req.url).pathname,
      status: c.res.status,
      ms,
      requestId,
    })
  }
}

// ── 6. Catch-all error handler ────────────────────────────────────────────────

export function globalErrorHandler(
  err: Error,
  c: Context,
): Response {
  const requestId = (c.get('requestId') as string | undefined) ?? 'unknown'
  auditLog.error('unhandled-error', {
    name: err.name,
    message: err.message,
    requestId,
  })
  return c.json(
    {
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'An internal error occurred.' },
      requestId,
    },
    500,
  )
}
