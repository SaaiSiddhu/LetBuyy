/**
 * ActionRegistry — catalogue of every whitelisted safe read-only action.
 * Each entry is immutable metadata; the registry is the single registry-of-record
 * for what the Execution Engine can execute.
 */

const ACTIONS = Object.freeze([
  {
    name: 'run_validation',
    subsystem: 'browser-intelligence',
    description:
      'Run Playwright-based storefront validations (read-only, no payment flows triggered).',
    readOnly: true,
    reversible: true,
    params: [
      { name: 'storeUrl', type: 'string', required: true, description: 'Store URL to validate.' },
    ],
  },
  {
    name: 'run_health_check',
    subsystem: 'observability',
    description: 'Run HealthService health checks across all connected LCIS subsystems.',
    readOnly: true,
    reversible: true,
    params: [],
  },
  {
    name: 'run_diagnostics',
    subsystem: 'multi',
    description:
      'Run diagnostics for a named subsystem (context | memory | graph). No mutations performed.',
    readOnly: true,
    reversible: true,
    params: [
      {
        name: 'subsystem',
        type: 'string',
        required: true,
        description: 'One of: context, memory, graph.',
        enum: ['context', 'memory', 'graph'],
      },
    ],
  },
  {
    name: 'run_repository_analysis',
    subsystem: 'context-intelligence',
    description:
      'Analyse the repository via ContextDiagnostics and ContextCompressionPipeline (read-only scan).',
    readOnly: true,
    reversible: true,
    params: [],
  },
  {
    name: 'run_architecture_scan',
    subsystem: 'architecture-intelligence',
    description: 'Scan architecture topology via ArchitectureIntelligenceEngine (read-only).',
    readOnly: true,
    reversible: true,
    params: [],
  },
  {
    name: 'run_security_scan',
    subsystem: 'reasoning',
    description:
      'Run read-only security analysis via SecurityReasoner and V1 LCIS /api/security-intelligence.',
    readOnly: true,
    reversible: true,
    params: [],
  },
  {
    name: 'get_audit_log',
    subsystem: 'execution-engine',
    description: 'Retrieve the execution audit log (optionally filtered).',
    readOnly: true,
    reversible: true,
    params: [
      { name: 'limit', type: 'number', required: false, description: 'Max entries to return.' },
      { name: 'action', type: 'string', required: false, description: 'Filter by action name.' },
      { name: 'status', type: 'string', required: false, description: 'Filter by status.' },
    ],
  },
  {
    name: 'get_execution_result',
    subsystem: 'execution-engine',
    description: 'Retrieve a previous ExecutionResult by its ID.',
    readOnly: true,
    reversible: true,
    params: [
      { name: 'id', type: 'string', required: true, description: 'Execution result ID.' },
    ],
  },
  {
    name: 'get_actions',
    subsystem: 'execution-engine',
    description: 'Return metadata for all registered safe actions.',
    readOnly: true,
    reversible: true,
    params: [],
  },
  {
    name: 'get_action',
    subsystem: 'execution-engine',
    description: 'Return metadata for a single action by name.',
    readOnly: true,
    reversible: true,
    params: [
      { name: 'name', type: 'string', required: true, description: 'Action name to look up.' },
    ],
  },
]);

// Index for O(1) lookup.
const INDEX = new Map(ACTIONS.map((a) => [a.name, a]));

class ActionRegistry {
  /** Return all registered actions. */
  getActions() {
    return ACTIONS;
  }

  /** Return a single action by name, or null. */
  getAction(name) {
    return INDEX.get(name) ?? null;
  }

  /** True if an action is registered. */
  isRegistered(name) {
    return INDEX.has(name);
  }
}

export default new ActionRegistry();
