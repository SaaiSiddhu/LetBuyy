/**
 * LCIS Observability Engine — TracingService
 * Distributed tracing helpers — span lifecycle, context propagation (W3C), merchant context.
 * PII policy: never set email/phone/name as span attributes; site_id only.
 * Technology primitive: OpenTelemetry — hidden behind this abstraction.
 */

import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

/** @returns {import('@opentelemetry/api')} */
function getApi() {
  return require('@opentelemetry/api');
}

class TracingService {
  // ── Span lifecycle ────────────────────────────────────────────────────────

  /**
   * Start a new span. Caller is responsible for calling endSpan().
   * @param {string} name
   * @param {Record<string,string|number|boolean>} [attributes]
   * @param {object} [options]  OTel SpanOptions
   * @returns {import('@opentelemetry/api').Span}
   */
  startSpan(name, attributes = {}, options = {}) {
    try {
      const api = getApi();
      const tracer = api.trace.getActiveSpan()
        ? api.trace.getTracer('lcis-tracing')
        : api.trace.getTracer('lcis-tracing');
      const span = tracer.startSpan(name, options);
      for (const [k, v] of Object.entries(attributes)) {
        span.setAttribute(k, v);
      }
      return span;
    } catch {
      return this.#noopSpan();
    }
  }

  /**
   * End a span, optionally recording status and error.
   * @param {import('@opentelemetry/api').Span} span
   * @param {'OK'|'ERROR'|'UNSET'} [status]
   * @param {Error} [error]
   */
  endSpan(span, status, error) {
    if (!span) return;
    try {
      const api = getApi();
      if (error) {
        span.recordException(error);
        span.setStatus({ code: api.SpanStatusCode.ERROR, message: error.message });
      } else if (status === 'OK') {
        span.setStatus({ code: api.SpanStatusCode.OK });
      } else if (status === 'ERROR') {
        span.setStatus({ code: api.SpanStatusCode.ERROR });
      }
    } catch {
      // swallow — always end the span
    } finally {
      try { span.end(); } catch { /* noop */ }
    }
  }

  /**
   * Wrap an async function in a span — automatically starts, ends, and captures errors.
   * @template T
   * @param {string} name
   * @param {(span: import('@opentelemetry/api').Span) => Promise<T>} fn
   * @param {Record<string,string|number|boolean>} [attributes]
   * @returns {Promise<T>}
   */
  async withSpan(name, fn, attributes = {}) {
    let span;
    try {
      const api = getApi();
      const tracer = api.trace.getTracer('lcis-tracing');
      let result;
      await tracer.startActiveSpan(name, async (s) => {
        span = s;
        for (const [k, v] of Object.entries(attributes)) {
          s.setAttribute(k, v);
        }
        try {
          result = await fn(s);
          this.endSpan(s, 'OK');
        } catch (err) {
          this.endSpan(s, 'ERROR', err);
          throw err;
        }
      });
      return result;
    } catch (err) {
      // If OTel is not available, execute fn with a noop span
      if (!span) return fn(this.#noopSpan());
      throw err;
    }
  }

  /**
   * Add a named event to an active span.
   * @param {import('@opentelemetry/api').Span} span
   * @param {string} name
   * @param {Record<string,string|number|boolean>} [attributes]
   */
  addEvent(span, name, attributes = {}) {
    try {
      span?.addEvent(name, attributes);
    } catch { /* noop */ }
  }

  // ── Context helpers ───────────────────────────────────────────────────────

  /**
   * Tag a span with the merchant's site_id (the only allowed tenant identifier).
   * PII: site_id only — NO name/email/phone.
   * @param {import('@opentelemetry/api').Span} span
   * @param {string} siteId
   */
  setMerchantContext(span, siteId) {
    try {
      span?.setAttribute('letbuyy.site_id', siteId);
      span?.setAttribute('letbuyy.tenant', 'merchant');
    } catch { /* noop */ }
  }

  /**
   * Tag a span with the inbound route and HTTP method.
   * @param {import('@opentelemetry/api').Span} span
   * @param {string} route  e.g. '/v1/orders/:id'
   * @param {string} method e.g. 'GET'
   */
  setRouteContext(span, route, method) {
    try {
      span?.setAttribute('http.route', route);
      span?.setAttribute('http.method', method?.toUpperCase() ?? 'UNKNOWN');
    } catch { /* noop */ }
  }

  /**
   * Inject W3C trace context headers into an outgoing headers object.
   * Mutates the passed headers map in-place and returns it.
   * @param {Record<string,string>} headers
   * @returns {Record<string,string>}
   */
  propagateContext(headers) {
    try {
      const api = getApi();
      const { propagation, context } = api;
      propagation.inject(context.active(), headers);
    } catch { /* OTel not available — headers unchanged */ }
    return headers;
  }

  /**
   * Return the currently active span, or a noop span if none.
   * @returns {import('@opentelemetry/api').Span}
   */
  getCurrentSpan() {
    try {
      const api = getApi();
      return api.trace.getActiveSpan() ?? this.#noopSpan();
    } catch {
      return this.#noopSpan();
    }
  }

  // ── Noop fallback ─────────────────────────────────────────────────────────

  #noopSpan() {
    return {
      setAttribute: () => {},
      setStatus: () => {},
      addEvent: () => {},
      recordException: () => {},
      end: () => {},
    };
  }
}

export default new TracingService();
