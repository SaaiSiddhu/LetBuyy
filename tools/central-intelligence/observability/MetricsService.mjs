/**
 * LCIS Observability Engine — MetricsService
 * Domain-scoped metric recording in the letbuyy.* namespace.
 * PII policy: NO email/phone/name in labels; site_id is the only tenant identifier.
 */

import process from 'node:process';

const RUNTIME = process.env.OTEL_SERVICE_NAME ?? 'lcis';
const ENVIRONMENT = process.env.OTEL_ENVIRONMENT ?? 'development';

class MetricsService {
  #meter = null;

  // Instruments — lazily created on first record call if init() is called.
  #httpRequestDuration = null;
  #httpRequestTotal = null;
  #queueMessageDuration = null;
  #queueMessageTotal = null;
  #paymentAttemptTotal = null;
  #paymentAmountHistogram = null;
  #orderCreatedTotal = null;
  #workerExecutionDuration = null;
  #workerExecutionTotal = null;
  #merchantActionTotal = null;
  #dbQueryDuration = null;
  #dbQueryTotal = null;

  /**
   * Wire up metric instruments from an OTel Meter.
   * Call this after TelemetryService.init() completes.
   * @param {import('@opentelemetry/api').Meter} meter
   */
  init(meter) {
    if (!meter) {
      console.warn('[MetricsService] No meter provided — metrics will be no-ops.');
      return;
    }
    this.#meter = meter;
    this.#createInstruments();
    console.log('[MetricsService] Instruments registered.');
  }

  #createInstruments() {
    const m = this.#meter;

    this.#httpRequestDuration = m.createHistogram('letbuyy.http.request.duration_ms', {
      description: 'HTTP request duration in milliseconds',
      unit: 'ms',
    });

    this.#httpRequestTotal = m.createCounter('letbuyy.http.request.total', {
      description: 'Total HTTP requests by method, route, and status',
    });

    this.#queueMessageDuration = m.createHistogram('letbuyy.queue.message.duration_ms', {
      description: 'Queue message processing duration in milliseconds',
      unit: 'ms',
    });

    this.#queueMessageTotal = m.createCounter('letbuyy.queue.message.total', {
      description: 'Total queue messages processed',
    });

    this.#paymentAttemptTotal = m.createCounter('letbuyy.payment.attempt.total', {
      description: 'Total payment attempts by provider and status',
    });

    this.#paymentAmountHistogram = m.createHistogram('letbuyy.payment.amount_inr_minor', {
      description: 'Payment amounts in INR minor units (paise)',
      unit: 'paise',
    });

    this.#orderCreatedTotal = m.createCounter('letbuyy.order.created.total', {
      description: 'Total orders created by status',
    });

    this.#workerExecutionDuration = m.createHistogram('letbuyy.worker.execution.duration_ms', {
      description: 'Queue worker execution duration in milliseconds',
      unit: 'ms',
    });

    this.#workerExecutionTotal = m.createCounter('letbuyy.worker.execution.total', {
      description: 'Total worker executions by worker name and outcome',
    });

    this.#merchantActionTotal = m.createCounter('letbuyy.merchant.action.total', {
      description: 'Total merchant actions by site_id and action type',
    });

    this.#dbQueryDuration = m.createHistogram('letbuyy.db.query.duration_ms', {
      description: 'Database query duration in milliseconds',
      unit: 'ms',
    });

    this.#dbQueryTotal = m.createCounter('letbuyy.db.query.total', {
      description: 'Total database queries by operation, table, and outcome',
    });
  }

  // ── Public recording methods ──────────────────────────────────────────────

  /**
   * Record an HTTP request.
   * @param {string} method   GET / POST / …
   * @param {string} route    e.g. '/v1/orders/:id'
   * @param {number} statusCode
   * @param {number} durationMs
   */
  recordHttpRequest(method, route, statusCode, durationMs) {
    const attrs = {
      'http.method': method?.toUpperCase() ?? 'UNKNOWN',
      'http.route': route ?? 'unknown',
      'http.status_code': String(statusCode ?? 0),
      'letbuyy.runtime': RUNTIME,
      'letbuyy.environment': ENVIRONMENT,
    };
    this.#httpRequestDuration?.record(durationMs, attrs);
    this.#httpRequestTotal?.add(1, attrs);
  }

  /**
   * Record a queue message processing outcome.
   * @param {string} queueName
   * @param {'success'|'failure'|'retry'} status
   * @param {number} durationMs
   */
  recordQueueMessage(queueName, status, durationMs) {
    const attrs = {
      'letbuyy.queue.name': queueName ?? 'unknown',
      'letbuyy.queue.status': status ?? 'unknown',
      'letbuyy.runtime': RUNTIME,
      'letbuyy.environment': ENVIRONMENT,
    };
    this.#queueMessageDuration?.record(durationMs, attrs);
    this.#queueMessageTotal?.add(1, attrs);
  }

  /**
   * Record a payment attempt.
   * PII: amount is fine (a number); no customer identity.
   * @param {'razorpay'|'cod'|string} provider
   * @param {'initiated'|'success'|'failure'|'refunded'} status
   * @param {number} amount  INR minor units (paise)
   */
  recordPaymentAttempt(provider, status, amount) {
    const attrs = {
      'letbuyy.payment.provider': provider ?? 'unknown',
      'letbuyy.payment.status': status ?? 'unknown',
      'letbuyy.runtime': RUNTIME,
      'letbuyy.environment': ENVIRONMENT,
    };
    this.#paymentAttemptTotal?.add(1, attrs);
    if (typeof amount === 'number' && amount >= 0) {
      this.#paymentAmountHistogram?.record(amount, attrs);
    }
  }

  /**
   * Record an order creation event.
   * @param {'confirmed'|'cod_pending'|'failed'} status
   */
  recordOrderCreated(status) {
    this.#orderCreatedTotal?.add(1, {
      'letbuyy.order.status': status ?? 'unknown',
      'letbuyy.runtime': RUNTIME,
      'letbuyy.environment': ENVIRONMENT,
    });
  }

  /**
   * Record a queue worker execution.
   * @param {string} workerName
   * @param {boolean} success
   * @param {number} durationMs
   */
  recordWorkerExecution(workerName, success, durationMs) {
    const attrs = {
      'letbuyy.worker.name': workerName ?? 'unknown',
      'letbuyy.worker.success': String(Boolean(success)),
      'letbuyy.runtime': RUNTIME,
      'letbuyy.environment': ENVIRONMENT,
    };
    this.#workerExecutionDuration?.record(durationMs, attrs);
    this.#workerExecutionTotal?.add(1, attrs);
  }

  /**
   * Record a merchant action.
   * PII: only site_id — NO name/email/phone.
   * @param {string} siteId
   * @param {string} action  e.g. 'product_created', 'order_refunded'
   */
  recordMerchantAction(siteId, action) {
    this.#merchantActionTotal?.add(1, {
      'letbuyy.site_id': siteId ?? 'unknown',
      'letbuyy.merchant.action': action ?? 'unknown',
      'letbuyy.runtime': RUNTIME,
      'letbuyy.environment': ENVIRONMENT,
    });
  }

  /**
   * Record a database query.
   * @param {'select'|'insert'|'update'|'delete'|'rpc'} operation
   * @param {string} table
   * @param {number} durationMs
   * @param {boolean} success
   */
  recordDatabaseQuery(operation, table, durationMs, success) {
    const attrs = {
      'letbuyy.db.operation': operation ?? 'unknown',
      'letbuyy.db.table': table ?? 'unknown',
      'letbuyy.db.success': String(Boolean(success)),
      'letbuyy.runtime': RUNTIME,
      'letbuyy.environment': ENVIRONMENT,
    };
    this.#dbQueryDuration?.record(durationMs, attrs);
    this.#dbQueryTotal?.add(1, attrs);
  }
}

export default new MetricsService();
