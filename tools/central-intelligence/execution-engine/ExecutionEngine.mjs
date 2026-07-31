/**
 * ExecutionEngine — LCIS V3 Phase 26.
 *
 * ABSOLUTE SAFETY CONTRACT (enforced in code):
 *  - Only whitelisted, read-only actions may execute.
 *  - Every execution is audited, observable, and trivially reversible
 *    (all actions are read-only → no state changes → undo = noop).
 *  - Mutating actions are REJECTED before any subsystem import is attempted.
 *
 * Subsystems are lazy-imported so the engine boots even when a subsystem
 * dependency is unavailable; failures are gracefully downgraded to DEGRADED.
 */

import { randomUUID } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import SafetyGuard from './SafetyGuard.mjs';
import ExecutionAuditor from './ExecutionAuditor.mjs';
import ActionRegistry from './ActionRegistry.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CI_ROOT = join(__dirname, '..');

const V1_BASE = 'http://localhost:3333';

/** In-memory result store (bounded). */
const MAX_RESULT_CACHE = 500;

/**
 * @typedef {Object} ExecutionResult
 * @property {string}  id
 * @property {string}  action
 * @property {object}  params
 * @property {'SUCCESS'|'FAILED'|'REJECTED'} status
 * @property {true}    safe
 * @property {false}   mutating
 * @property {true}    reversible
 * @property {any}     output
 * @property {number}  durationMs
 * @property {string}  auditId
 * @property {string}  timestamp
 * @property {string|null} error
 */

class ExecutionEngine {
  constructor() {
    /** @type {Map<string, ExecutionResult>} */
    this._results = new Map();
    this._log = (level, msg, meta = {}) => {
      const entry = { level, msg, ...meta, ts: new Date().toISOString() };
      if (process.env.LCIS_QUIET !== '1') {
        const prefix = { info: '[EE]', warn: '[EE:WARN]', error: '[EE:ERR]' }[level] ?? '[EE]';
        // eslint-disable-next-line no-console
        console.log(`${prefix} ${msg}`, Object.keys(meta).length ? meta : '');
      }
      return entry;
    };
  }

  // ---------------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------------

  /**
   * Execute a whitelisted read-only action.
   * Any action not on the whitelist or containing a mutating verb is REJECTED
   * immediately — no subsystem code is called.
   *
   * @param {string} action
   * @param {object} [params]
   * @returns {Promise<ExecutionResult>}
   */
  async execute(action, params = {}) {
    const id = randomUUID();
    const start = Date.now();
    const timestamp = new Date().toISOString();

    // --- Safety gate (first, before anything else) ---
    const safety = SafetyGuard.validate(action, params);
    if (!safety.safe) {
      const result = this._makeResult({
        id, action, params, timestamp,
        status: 'REJECTED',
        output: null,
        durationMs: Date.now() - start,
        error: safety.reason,
      });
      this._log('warn', `REJECTED action "${action}"`, { reason: safety.reason });
      await this._audit(result);
      return result;
    }

    this._log('info', `Executing "${action}"`, { id, params });

    let output = null;
    let error = null;
    let status = 'SUCCESS';

    try {
      output = await this._dispatch(action, params);
    } catch (err) {
      status = 'FAILED';
      error = err?.message ?? String(err);
      this._log('error', `Action "${action}" failed`, { id, error });
    }

    const result = this._makeResult({
      id, action, params, timestamp,
      status, output, durationMs: Date.now() - start, error,
    });
    this._storeResult(result);
    await this._audit(result);
    this._log('info', `Completed "${action}" → ${status}`, { id, durationMs: result.durationMs });
    return result;
  }

  /**
   * Browser-based storefront validation (no payment paths).
   * @param {string} storeUrl
   */
  async runValidation(storeUrl) {
    return this.execute('run_validation', { storeUrl });
  }

  /**
   * Run HealthService health check.
   */
  async runHealthCheck() {
    return this.execute('run_health_check', {});
  }

  /**
   * Run diagnostics for a subsystem.
   * @param {'context'|'memory'|'graph'} subsystem
   */
  async runDiagnostics(subsystem) {
    return this.execute('run_diagnostics', { subsystem });
  }

  /**
   * Run context-intelligence repository analysis.
   */
  async runRepositoryAnalysis() {
    return this.execute('run_repository_analysis', {});
  }

  /**
   * Run architecture-intelligence scan.
   */
  async runArchitectureScan() {
    return this.execute('run_architecture_scan', {});
  }

  /**
   * Run read-only security scan via SecurityReasoner + V1 LCIS.
   */
  async runSecurityScan() {
    return this.execute('run_security_scan', {});
  }

  /**
   * Retrieve the audit log (proxied from ExecutionAuditor).
   * @param {object} [filter]
   */
  async getAuditLog(filter = {}) {
    return this.execute('get_audit_log', filter);
  }

  /**
   * Retrieve a previous execution result by ID.
   * @param {string} id
   */
  async getExecutionResult(id) {
    return this.execute('get_execution_result', { id });
  }

  // ---------------------------------------------------------------------------
  // Dispatch
  // ---------------------------------------------------------------------------

  /**
   * Internal dispatcher. Called only after the safety gate has passed.
   * Each branch lazy-imports its subsystem — failures are caught by the caller.
   */
  async _dispatch(action, params) {
    switch (action) {
      case 'run_validation':
        return this._execValidation(params);
      case 'run_health_check':
        return this._execHealthCheck();
      case 'run_diagnostics':
        return this._execDiagnostics(params);
      case 'run_repository_analysis':
        return this._execRepositoryAnalysis();
      case 'run_architecture_scan':
        return this._execArchitectureScan();
      case 'run_security_scan':
        return this._execSecurityScan();
      case 'get_audit_log':
        return ExecutionAuditor.getAuditLog(params);
      case 'get_execution_result': {
        const stored = this._results.get(params.id);
        return stored ?? { found: false, id: params.id };
      }
      case 'get_actions':
        return ActionRegistry.getActions();
      case 'get_action':
        return ActionRegistry.getAction(params.name);
      default:
        throw new Error(`Unhandled safe action "${action}" — should have been caught by SafetyGuard.`);
    }
  }

  // ---------------------------------------------------------------------------
  // Subsystem executors (lazy import + graceful degradation)
  // ---------------------------------------------------------------------------

  async _execValidation({ storeUrl }) {
    if (!storeUrl) throw new Error('storeUrl is required for run_validation.');

    let engine;
    try {
      const mod = await import(`${CI_ROOT}/browser-intelligence/BrowserIntelligenceEngine.mjs`);
      engine = mod.default ?? mod;
    } catch (importErr) {
      return {
        status: 'DEGRADED',
        reason: 'BrowserIntelligenceEngine unavailable.',
        detail: importErr.message,
        storeUrl,
        readOnly: true,
        paymentExecuted: false,
      };
    }

    // Safety: never call any payment or mutation method.
    const validateFn =
      engine.validateStorefront?.bind(engine) ??
      engine.validate?.bind(engine) ??
      engine.runValidation?.bind(engine);

    if (typeof validateFn !== 'function') {
      return {
        status: 'DEGRADED',
        reason: 'No read-only validate method found on BrowserIntelligenceEngine.',
        storeUrl,
      };
    }

    const raw = await validateFn(storeUrl);
    return { ...raw, readOnly: true, paymentExecuted: false };
  }

  async _execHealthCheck() {
    let svc;
    try {
      const mod = await import(`${CI_ROOT}/observability/HealthService.mjs`);
      svc = mod.default ?? mod;
    } catch (importErr) {
      return { status: 'DEGRADED', reason: 'HealthService unavailable.', detail: importErr.message };
    }

    const checkFn =
      svc.check?.bind(svc) ??
      svc.runHealthCheck?.bind(svc) ??
      svc.getHealth?.bind(svc);

    if (typeof checkFn !== 'function') {
      return { status: 'DEGRADED', reason: 'No check method on HealthService.' };
    }
    return checkFn();
  }

  async _execDiagnostics({ subsystem }) {
    const SUB = (subsystem ?? '').toLowerCase();

    if (SUB === 'context') {
      return this._execContextDiagnostics();
    }
    if (SUB === 'memory') {
      return this._execMemoryDiagnostics();
    }
    if (SUB === 'graph') {
      return this._execGraphDiagnostics();
    }
    throw new Error(`Unknown subsystem "${subsystem}". Must be one of: context, memory, graph.`);
  }

  async _execContextDiagnostics() {
    let diag;
    try {
      const mod = await import(`${CI_ROOT}/context-intelligence/ContextDiagnostics.mjs`);
      diag = mod.default ?? mod;
    } catch (err) {
      return { status: 'DEGRADED', subsystem: 'context', reason: err.message };
    }
    const fn = diag.diagnose?.bind(diag) ?? diag.run?.bind(diag) ?? diag.runDiagnostics?.bind(diag);
    if (typeof fn !== 'function') return { status: 'DEGRADED', subsystem: 'context', reason: 'No diagnose method.' };
    return fn();
  }

  async _execMemoryDiagnostics() {
    let monitor;
    try {
      const mod = await import(`${CI_ROOT}/memory-engine/MemoryHealthMonitor.mjs`);
      monitor = mod.default ?? mod;
    } catch (err) {
      return { status: 'DEGRADED', subsystem: 'memory', reason: err.message };
    }
    const fn =
      monitor.check?.bind(monitor) ??
      monitor.monitor?.bind(monitor) ??
      monitor.runHealthCheck?.bind(monitor);
    if (typeof fn !== 'function') return { status: 'DEGRADED', subsystem: 'memory', reason: 'No check method.' };
    return fn();
  }

  async _execGraphDiagnostics() {
    let diag;
    try {
      const mod = await import(`${CI_ROOT}/graph-engine/GraphDiagnostics.mjs`);
      diag = mod.default ?? mod;
    } catch (err) {
      return { status: 'DEGRADED', subsystem: 'graph', reason: err.message };
    }
    const fn = diag.diagnose?.bind(diag) ?? diag.run?.bind(diag) ?? diag.runDiagnostics?.bind(diag);
    if (typeof fn !== 'function') return { status: 'DEGRADED', subsystem: 'graph', reason: 'No diagnose method.' };
    return fn();
  }

  async _execRepositoryAnalysis() {
    const results = {};

    // ContextDiagnostics
    try {
      const mod = await import(`${CI_ROOT}/context-intelligence/ContextDiagnostics.mjs`);
      const d = mod.default ?? mod;
      const fn = d.diagnose?.bind(d) ?? d.run?.bind(d);
      results.contextDiagnostics = typeof fn === 'function' ? await fn() : { status: 'DEGRADED', reason: 'No run method.' };
    } catch (err) {
      results.contextDiagnostics = { status: 'DEGRADED', reason: err.message };
    }

    // ContextCompressionPipeline
    try {
      const mod = await import(`${CI_ROOT}/context-intelligence/ContextCompressionPipeline.mjs`);
      const p = mod.default ?? mod;
      const fn =
        p.compress?.bind(p) ??
        p.run?.bind(p) ??
        p.runPipeline?.bind(p) ??
        p.getStats?.bind(p);
      results.compressionPipeline = typeof fn === 'function' ? await fn() : { status: 'DEGRADED', reason: 'No run method.' };
    } catch (err) {
      results.compressionPipeline = { status: 'DEGRADED', reason: err.message };
    }

    return { readOnly: true, results };
  }

  async _execArchitectureScan() {
    let engine;
    try {
      const mod = await import(`${CI_ROOT}/architecture-intelligence/ArchitectureIntelligenceEngine.mjs`);
      engine = mod.default ?? mod;
    } catch (err) {
      return { status: 'DEGRADED', reason: 'ArchitectureIntelligenceEngine unavailable.', detail: err.message };
    }

    const fn =
      engine.analyze?.bind(engine) ??
      engine.scan?.bind(engine) ??
      engine.run?.bind(engine) ??
      engine.getArchitecture?.bind(engine);

    if (typeof fn !== 'function') {
      return { status: 'DEGRADED', reason: 'No scan method on ArchitectureIntelligenceEngine.' };
    }
    return { ...(await fn()), readOnly: true };
  }

  async _execSecurityScan() {
    const results = {};

    // SecurityReasoner (local)
    try {
      const mod = await import(`${CI_ROOT}/reasoning/SecurityReasoner.mjs`);
      const sr = mod.default ?? mod;
      const fn =
        sr.reason?.bind(sr) ??
        sr.analyze?.bind(sr) ??
        sr.scan?.bind(sr) ??
        sr.run?.bind(sr);
      results.securityReasoner =
        typeof fn === 'function' ? await fn() : { status: 'DEGRADED', reason: 'No run method.' };
    } catch (err) {
      results.securityReasoner = { status: 'DEGRADED', reason: err.message };
    }

    // V1 LCIS /api/security-intelligence (read-only HTTP GET)
    try {
      const resp = await fetch(`${V1_BASE}/api/security-intelligence`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      });
      if (resp.ok) {
        results.v1SecurityIntelligence = await resp.json();
      } else {
        results.v1SecurityIntelligence = { status: 'DEGRADED', httpStatus: resp.status };
      }
    } catch (err) {
      results.v1SecurityIntelligence = { status: 'NOT_CONNECTED', reason: err.message };
    }

    return { readOnly: true, mutating: false, results };
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  _makeResult({ id, action, params, timestamp, status, output, durationMs, error }) {
    /** @type {ExecutionResult} */
    return {
      id,
      action,
      params,
      status,
      safe: true,
      mutating: false,
      reversible: true,
      output,
      durationMs,
      auditId: null, // filled in after auditing
      timestamp,
      error: error ?? null,
    };
  }

  _storeResult(result) {
    this._results.set(result.id, result);
    if (this._results.size > MAX_RESULT_CACHE) {
      // Evict oldest.
      const oldest = this._results.keys().next().value;
      this._results.delete(oldest);
    }
  }

  async _audit(result) {
    try {
      const auditId = await ExecutionAuditor.record(result);
      result.auditId = auditId;
    } catch (auditErr) {
      // Audit failure must never prevent execution result return.
      this._log('warn', 'Audit write failed (non-fatal)', { error: auditErr.message });
    }
  }
}

export default new ExecutionEngine();
