/**
 * AuditLogger — structured audit trail of adapter operations. Never logs credential values.
 */
import { type Logger, createLogger } from '@letbuyy/lcis-core';

export type AdapterOp = 'health' | 'collect' | 'verify' | 'investigate';

export class AuditLogger {
  private readonly log: Logger;

  constructor(name = 'lcis-adapters', sink?: (line: string) => void) {
    this.log = createLogger(name, {}, sink);
  }

  record(adapter: string, op: AdapterOp, meta: Record<string, unknown> = {}): void {
    // meta must never contain credential values — callers pass status/latency/counts only.
    this.log.info(`${adapter}.${op}`, { adapter, op, ...meta });
  }
}
