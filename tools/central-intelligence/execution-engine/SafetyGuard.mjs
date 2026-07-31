/**
 * SafetyGuard — single source of truth for the read-only action whitelist.
 * Default-deny: any action not explicitly whitelisted is REJECTED.
 * Mutating verbs are banned regardless of whitelist status.
 */

const WHITELIST = new Set([
  'run_validation',
  'run_health_check',
  'run_diagnostics',
  'run_repository_analysis',
  'run_architecture_scan',
  'run_security_scan',
  'get_audit_log',
  'get_execution_result',
  'get_actions',
  'get_action',
]);

// Any action whose name contains one of these substrings is MUTATING and rejected.
const MUTATING_VERBS = [
  'deploy',
  'write',
  'insert',
  'update',
  'delete',
  'mutate',
  'pay',
  'charge',
  'refund',
  'push',
  'commit',
  'merge',
  'create',
  'drop',
  'truncate',
  'execute_payment',
  'send',
  'publish',
  'migrate',
  'rollback',
  'reset',
  'remove',
  'destroy',
  'overwrite',
  'patch',
  'put',
  'post',
];

class SafetyGuard {
  /**
   * Returns true only if the action is on the whitelist.
   */
  isSafe(action) {
    if (typeof action !== 'string') return false;
    return WHITELIST.has(action.toLowerCase().trim());
  }

  /**
   * Validates the action + params combo.
   * Returns { safe: true } or { safe: false, reason: string }.
   */
  validate(action, params = {}) {
    if (typeof action !== 'string' || !action.trim()) {
      return { safe: false, reason: 'Action must be a non-empty string.' };
    }

    const normalised = action.toLowerCase().trim();

    // Check for mutating verbs first — banned even if accidentally whitelisted.
    const foundVerb = MUTATING_VERBS.find((verb) => normalised.includes(verb));
    if (foundVerb) {
      return {
        safe: false,
        reason: `Action "${action}" contains mutating verb "${foundVerb}". Only read-only actions are permitted.`,
      };
    }

    if (!WHITELIST.has(normalised)) {
      return {
        safe: false,
        reason: `Action "${action}" is not in the safe read-only whitelist. ${this.explainRejection(action)}`,
      };
    }

    // Param-level safety: reject if any param value looks like a mutation trigger.
    if (params && typeof params === 'object') {
      for (const [key, val] of Object.entries(params)) {
        if (typeof val === 'string') {
          const lv = val.toLowerCase();
          const vVerb = MUTATING_VERBS.find((v) => lv.includes(v));
          if (vVerb) {
            return {
              safe: false,
              reason: `Parameter "${key}" contains mutating keyword "${vVerb}".`,
            };
          }
        }
      }
    }

    return { safe: true };
  }

  /**
   * Throws if the action is not read-only. Use as a guard assertion.
   */
  assertReadOnly(action) {
    const result = this.validate(action, {});
    if (!result.safe) {
      const err = new Error(`[SafetyGuard] REJECTED: ${result.reason}`);
      err.code = 'SAFETY_REJECTED';
      throw err;
    }
  }

  /**
   * Returns the full whitelist as a sorted array.
   */
  getWhitelist() {
    return [...WHITELIST].sort();
  }

  /**
   * Returns a human-readable explanation of why an action would be rejected.
   */
  explainRejection(action) {
    const normalised = (action || '').toLowerCase().trim();
    const foundVerb = MUTATING_VERBS.find((verb) => normalised.includes(verb));
    if (foundVerb) {
      return `It contains the mutating verb "${foundVerb}". Execution Engine only executes safe, read-only operations.`;
    }
    if (!WHITELIST.has(normalised)) {
      return `"${action}" is unknown. Permitted actions: ${[...WHITELIST].sort().join(', ')}.`;
    }
    return 'Action is permitted.';
  }
}

export default new SafetyGuard();
