/**
 * LCIS Observability Engine — TelemetryService
 * Manages OpenTelemetry SDK lifecycle (traces, metrics, logs).
 * Technology primitive: OpenTelemetry + SigNoz — hidden behind this abstraction.
 * PII policy: never emit email/phone/name in spans or metric labels; site_id only.
 */

import { createRequire } from 'node:module';
import process from 'node:process';

const require = createRequire(import.meta.url);

const OTEL_ENDPOINT = process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? 'http://localhost:4318';
const OTEL_ENVIRONMENT = process.env.OTEL_ENVIRONMENT ?? 'development';

class TelemetryService {
  #sdk = null;
  #tracer = null;
  #meter = null;
  #logger = null;
  #initialized = false;
  #serviceName = 'lcis-unknown';
  #serviceVersion = '0.0.0';

  /**
   * Initialize the OTel SDK for the given service.
   * Idempotent — safe to call multiple times; only the first call takes effect.
   * @param {string} serviceName
   * @param {string} [serviceVersion]
   */
  async init(serviceName, serviceVersion = '0.0.0') {
    if (this.#initialized) return;

    this.#serviceName = serviceName;
    this.#serviceVersion = serviceVersion;

    try {
      const { NodeSDK } = require('@opentelemetry/sdk-node');
      const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
      const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');
      const { Resource } = require('@opentelemetry/resources');
      const {
        SEMRESATTRS_SERVICE_NAME,
        SEMRESATTRS_SERVICE_VERSION,
        SEMRESATTRS_DEPLOYMENT_ENVIRONMENT,
      } = require('@opentelemetry/semantic-conventions');

      const resource = new Resource({
        [SEMRESATTRS_SERVICE_NAME]: serviceName,
        [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
        [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: OTEL_ENVIRONMENT,
        'letbuyy.runtime': 'node',
      });

      const traceExporter = new OTLPTraceExporter({
        url: `${OTEL_ENDPOINT}/v1/traces`,
      });

      this.#sdk = new NodeSDK({
        resource,
        traceExporter,
        instrumentations: [
          getNodeAutoInstrumentations({
            '@opentelemetry/instrumentation-fs': { enabled: false },
          }),
        ],
      });

      this.#sdk.start();
      this.#initialized = true;

      const api = require('@opentelemetry/api');
      this.#tracer = api.trace.getTracer(serviceName, serviceVersion);
      this.#meter = api.metrics.getMeter(serviceName, serviceVersion);

      // Logger via @opentelemetry/api-logs if present; else noop
      try {
        const logsApi = require('@opentelemetry/api-logs');
        this.#logger = logsApi.logs.getLogger(serviceName, serviceVersion);
      } catch {
        this.#logger = null;
      }

      console.log(`[TelemetryService] CONNECTED — ${serviceName}@${serviceVersion} → ${OTEL_ENDPOINT}`);
    } catch (err) {
      console.warn(`[TelemetryService] NOT AVAILABLE — ${err.message}`);
      this.#initialized = false;
    }
  }

  /** Flush and shut down the SDK gracefully. */
  async shutdown() {
    if (this.#sdk) {
      try {
        await this.#sdk.shutdown();
        console.log('[TelemetryService] SDK shut down cleanly.');
      } catch (err) {
        console.error('[TelemetryService] Shutdown error:', err.message);
      } finally {
        this.#sdk = null;
        this.#initialized = false;
      }
    }
  }

  /**
   * Return a Tracer bound to the given instrumentation scope.
   * @param {string} name
   */
  getTracer(name) {
    if (!this.#initialized) return this.#noopTracer();
    try {
      const api = require('@opentelemetry/api');
      return api.trace.getTracer(name ?? this.#serviceName, this.#serviceVersion);
    } catch {
      return this.#noopTracer();
    }
  }

  /**
   * Return a Meter bound to the given instrumentation scope.
   * @param {string} name
   */
  getMeter(name) {
    if (!this.#initialized) return this.#noopMeter();
    try {
      const api = require('@opentelemetry/api');
      return api.metrics.getMeter(name ?? this.#serviceName, this.#serviceVersion);
    } catch {
      return this.#noopMeter();
    }
  }

  /**
   * Return a Logger bound to the given instrumentation scope.
   * @param {string} name
   */
  getLogger(name) {
    if (!this.#logger) return this.#noopLogger();
    try {
      const logsApi = require('@opentelemetry/api-logs');
      return logsApi.logs.getLogger(name ?? this.#serviceName, this.#serviceVersion);
    } catch {
      return this.#noopLogger();
    }
  }

  /** @returns {boolean} */
  isInitialized() {
    return this.#initialized;
  }

  // ── Noop fallbacks (never throw) ──────────────────────────────────────────

  #noopTracer() {
    return {
      startSpan: () => ({ end: () => {}, setAttribute: () => {}, addEvent: () => {}, setStatus: () => {} }),
      startActiveSpan: (_name, fn) => fn({ end: () => {}, setAttribute: () => {}, addEvent: () => {}, setStatus: () => {} }),
    };
  }

  #noopMeter() {
    const noop = { add: () => {}, record: () => {} };
    return {
      createCounter: () => noop,
      createHistogram: () => noop,
      createUpDownCounter: () => noop,
      createObservableGauge: () => ({ addCallback: () => {} }),
    };
  }

  #noopLogger() {
    return { emit: () => {} };
  }
}

export default new TelemetryService();
