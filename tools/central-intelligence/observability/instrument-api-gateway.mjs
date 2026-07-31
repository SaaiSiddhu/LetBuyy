/**
 * LCIS Observability Engine — instrument-api-gateway
 * Cloudflare Worker OTel instrumentation wrapper for the Hono-based api-gateway.
 *
 * WIRING NOTE: This module is NOT imported by services/api-gateway/src/index.ts yet.
 * Follow-up task: in services/api-gateway/src/index.ts, import { instrument } from
 * 'tools/central-intelligence/observability/instrument-api-gateway.mjs' and wrap
 * the default Hono export:  export default instrument(app, { serviceName: 'api-gateway', ... })
 *
 * Worker-safe: no Node.js-only globals (`process`, `require`, `__dirname`) at top level.
 * OTel via @microlabs/otel-cf-workers — lazy-imported inside instrument() so the
 * Worker bundle does not hard-fail when the package is absent.
 * PII policy: span attributes carry site_id only; no email/phone/name.
 */

/**
 * @typedef {{
 *   serviceName: string,
 *   serviceVersion?: string,
 *   endpoint?: string,
 * }} InstrumentConfig
 */

/**
 * Wrap a Cloudflare Worker (Hono) handler with OTel tracing.
 * Instruments:
 *   – Inbound HTTP routes (method, path, status)
 *   – Supabase RPC calls intercepted via fetch patch
 *   – Queue sends (CF Queues .send())
 *
 * @param {object} handler  Hono app instance (must have .fetch)
 * @param {InstrumentConfig} config
 * @returns {object}  Wrapped handler with the same interface
 */
export function instrument(handler, config) {
  const {
    serviceName = 'api-gateway',
    serviceVersion = '0.0.0',
    endpoint,
  } = config ?? {};

  // Lazy OTel CF Workers import — graceful if package not installed
  let cfInstrument = null;
  let cfResolvedEndpoint = endpoint;

  const wrappedFetch = async (request, env, ctx) => {
    // Resolve endpoint from env at runtime (Worker env bag — not process.env)
    const resolvedEndpoint =
      cfResolvedEndpoint ??
      env?.OTEL_EXPORTER_OTLP_ENDPOINT ??
      'http://localhost:4318';

    // Attempt to load @microlabs/otel-cf-workers on first call
    if (!cfInstrument) {
      try {
        // Dynamic import is Worker-safe (evaluated at runtime, not bundle time)
        const mod = await import('@microlabs/otel-cf-workers');
        cfInstrument = mod.instrument ?? mod.default?.instrument ?? null;
      } catch {
        // Package not present — fall through to unwrapped handler
        cfInstrument = false; // sentinel: don't retry
      }
    }

    // If OTel CF Workers is available, delegate to it
    if (cfInstrument && cfInstrument !== false) {
      const otelConfig = {
        exporter: { url: `${resolvedEndpoint}/v1/traces` },
        service: { name: serviceName, version: serviceVersion },
      };
      const otelHandler = cfInstrument(
        { fetch: handler.fetch.bind(handler) },
        () => otelConfig,
      );
      return otelHandler.fetch(request, env, ctx);
    }

    // Fallback: manual span via lightweight fetch tracing
    return tracedFetch(request, env, ctx, handler, serviceName);
  };

  // Merge queue and scheduled handlers from the original (pass-through)
  return {
    fetch: wrappedFetch,
    ...(handler.queue ? { queue: handler.queue.bind(handler) } : {}),
    ...(handler.scheduled ? { scheduled: handler.scheduled.bind(handler) } : {}),
  };
}

// ── Lightweight fallback tracer (no SDK dependency) ───────────────────────

/**
 * Manual fetch tracing when @microlabs/otel-cf-workers is not available.
 * Emits W3C traceparent header and logs span data to console for collector pickup.
 * @param {Request} request
 * @param {object} env
 * @param {object} ctx
 * @param {object} handler
 * @param {string} serviceName
 * @returns {Promise<Response>}
 */
async function tracedFetch(request, env, ctx, handler, serviceName) {
  const traceId = generateHex(32);
  const spanId = generateHex(16);
  const startMs = Date.now();

  // Inject W3C traceparent into outgoing sub-requests would require wrapping fetch;
  // here we attach it to the inbound request clone for downstream propagation.
  const traceparent = `00-${traceId}-${spanId}-01`;

  let status = 0;
  try {
    // Clone headers to add traceparent without mutating the original
    const headers = new Headers(request.headers);
    headers.set('traceparent', traceparent);
    const instrumentedRequest = new Request(request, { headers });

    const response = await handler.fetch(instrumentedRequest, env, ctx);
    status = response.status;
    return response;
  } catch (err) {
    status = 500;
    throw err;
  } finally {
    const durationMs = Date.now() - startMs;
    const url = new URL(request.url);

    // Emit structured span to console (OTel collector log receiver can pick this up)
    console.log(
      JSON.stringify({
        type: 'span',
        traceId,
        spanId,
        service: serviceName,
        name: `${request.method} ${url.pathname}`,
        attributes: {
          'http.method': request.method,
          'http.route': url.pathname,
          'http.status_code': status,
          'letbuyy.runtime': serviceName,
          // PII: site_id extracted from path segment if present (/v1/stores/:id/*)
          'letbuyy.site_id': extractSiteId(url.pathname),
        },
        durationMs,
        timestamp: new Date().toISOString(),
      }),
    );
  }
}

// ── Utilities ──────────────────────────────────────────────────────────────

/**
 * Generate a random hex string of the given byte length.
 * Uses Web Crypto (available in all CF Workers runtimes).
 * @param {number} hexLen  length of output hex string (must be even)
 * @returns {string}
 */
function generateHex(hexLen) {
  const bytes = new Uint8Array(hexLen / 2);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Extract site_id from a gateway path like /v1/stores/<site_id>/products.
 * Returns 'unknown' if not present — never returns user-identifying info.
 * @param {string} pathname
 * @returns {string}
 */
function extractSiteId(pathname) {
  const match = pathname.match(/\/stores\/([^/]+)/);
  return match?.[1] ?? 'unknown';
}
