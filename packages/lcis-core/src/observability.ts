/**
 * Observability + response shaping shared by every access-layer adapter, so CLI / MCP / API
 * emit a consistent, evidence-cited envelope and structured logs. Deterministic and dependency-free
 * (node:crypto for request ids; no external logging libs).
 */
import { randomUUID } from 'node:crypto';
import type { Evidence } from './contracts/index';

/** Engine version surfaced in every response envelope. Kept in sync with package.json. */
export const LCIS_VERSION = '0.0.0';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface Logger {
  debug(msg: string, meta?: Record<string, unknown>): void;
  info(msg: string, meta?: Record<string, unknown>): void;
  warn(msg: string, meta?: Record<string, unknown>): void;
  error(msg: string, meta?: Record<string, unknown>): void;
  child(meta: Record<string, unknown>): Logger;
}

/** Structured JSON logger writing one line per event (to stderr by default — stdout stays clean for data). */
export function createLogger(
  name: string,
  base: Record<string, unknown> = {},
  sink: (line: string) => void = (line) => process.stderr.write(line + '\n'),
): Logger {
  const emit = (level: LogLevel, msg: string, meta?: Record<string, unknown>): void => {
    sink(JSON.stringify({ ts: new Date().toISOString(), level, logger: name, msg, ...base, ...(meta ?? {}) }));
  };
  return {
    debug: (m, meta) => emit('debug', m, meta),
    info: (m, meta) => emit('info', m, meta),
    warn: (m, meta) => emit('warn', m, meta),
    error: (m, meta) => emit('error', m, meta),
    child: (meta) => createLogger(name, { ...base, ...meta }, sink),
  };
}

/** A correlation id for a request/invocation. */
export function newRequestId(): string {
  return randomUUID();
}

/** Monotonic execution timer (milliseconds, 2 dp). */
export class Timer {
  private readonly start = performance.now();
  ms(): number {
    return Math.round((performance.now() - this.start) * 100) / 100;
  }
}

/**
 * Deterministic confidence for a result:
 *  - a result that carries its own numeric `confidence` (e.g. Verification) → that value
 *  - an error / NOT-CONNECTED / null result → 0
 *  - any other evidenced structural result → 0.9 (structural cap; never claims certainty)
 */
export function confidenceFor(data: unknown): number {
  if (data === null || data === undefined) return 0;
  if (typeof data === 'object') {
    const rec = data as Record<string, unknown>;
    if (typeof rec['confidence'] === 'number') return rec['confidence'];
    if (typeof rec['error'] === 'string') return 0;
  }
  return 0.9;
}

/** The canonical access-layer response envelope (used by API; MCP reuses its fields). */
export interface LcisEnvelope<T> {
  readonly success: boolean;
  readonly data: T;
  readonly evidence: readonly Evidence[] | readonly string[];
  readonly confidence: number;
  /** The source capability that produced the data (e.g. "blast-radius", "memory"). */
  readonly source: string;
  readonly executionTime: number;
  readonly timestamp: string;
  readonly version: string;
  readonly requestId?: string;
}

export function envelope<T>(opts: {
  data: T;
  source: string;
  executionTime: number;
  evidence?: readonly Evidence[] | readonly string[];
  success?: boolean;
  requestId?: string;
}): LcisEnvelope<T> {
  const isError = typeof opts.data === 'object' && opts.data !== null && 'error' in (opts.data as object);
  return {
    success: opts.success ?? (opts.data !== null && opts.data !== undefined && !isError),
    data: opts.data,
    evidence: opts.evidence ?? [],
    confidence: confidenceFor(opts.data),
    source: opts.source,
    executionTime: opts.executionTime,
    timestamp: new Date().toISOString(),
    version: LCIS_VERSION,
    ...(opts.requestId !== undefined ? { requestId: opts.requestId } : {}),
  };
}
