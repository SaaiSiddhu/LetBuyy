/**
 * LCIS V3 — WorkflowExecutor
 * Runs a workflow's step graph in topological order.
 * - Respects dependsOn: later steps see earlier outputs in context.
 * - Optional steps that throw do NOT abort the workflow.
 * - Mandatory steps that throw mark the execution as failed but still collect later optional steps.
 * - Tracks per-step: status, durationMs, connected (subsystem responded with real data).
 */

import crypto from 'node:crypto';

class WorkflowExecutor {
  #traces = new Map(); // executionId → ExecutionTrace

  // ─── public API ──────────────────────────────────────────────────────────

  /**
   * Execute a workflow definition with given input.
   * Returns { executionId, steps, context, failed, startedAt, completedAt }.
   */
  async execute(workflow, input = {}) {
    const executionId = crypto.randomUUID();
    const startedAt = new Date().toISOString();
    const stepResults = [];
    const context = { input, __executionId: executionId };
    let overallFailed = false;

    // Build execution order respecting dependsOn (topological sort)
    const orderedSteps = this.#topoSort(workflow.steps);

    for (const step of orderedSteps) {
      // Check that all mandatory dependencies succeeded
      const depsFailed = (step.dependsOn ?? []).filter((depId) => {
        const dep = stepResults.find((r) => r.stepId === depId);
        return dep && dep.status === 'failed' && !this.#isStepOptional(workflow.steps, depId);
      });

      if (depsFailed.length > 0 && !step.optional) {
        stepResults.push({
          stepId: step.id,
          subsystem: step.subsystem,
          method: step.method,
          status: 'skipped',
          reason: `mandatory dependency failed: ${depsFailed.join(', ')}`,
          durationMs: 0,
          connected: false,
          output: null,
        });
        continue;
      }

      const stepStart = Date.now();
      let stepStatus = 'ok';
      let stepConnected = false;
      let stepOutput = null;
      let stepError = null;

      try {
        const result = await this.executeStep(step, context);
        stepOutput = result?.output ?? result ?? null;
        stepConnected = result?.connected ?? this.#inferConnected(stepOutput);
        stepStatus = 'ok';
        // Merge output into shared context so downstream steps can read it
        context[step.id] = stepOutput;
      } catch (err) {
        stepError = err.message;
        stepStatus = 'failed';
        stepConnected = false;
        context[step.id] = null;
        if (!step.optional) {
          overallFailed = true;
        }
      }

      stepResults.push({
        stepId: step.id,
        subsystem: step.subsystem,
        method: step.method,
        status: stepStatus,
        durationMs: Date.now() - stepStart,
        connected: stepConnected,
        output: stepOutput,
        ...(stepError ? { error: stepError } : {}),
      });
    }

    const completedAt = new Date().toISOString();
    const trace = { executionId, workflow: workflow.name, steps: stepResults, context, failed: overallFailed, startedAt, completedAt };
    this.#traces.set(executionId, trace);
    return trace;
  }

  /**
   * Execute a single step by dispatching to the registered subsystem handler.
   * Returns { output, connected }.
   */
  async executeStep(step, context) {
    const handler = STEP_HANDLERS[step.subsystem];
    if (!handler) {
      // Unknown subsystem — produce a NOT CONNECTED placeholder
      return { output: { notConnected: true, subsystem: step.subsystem, method: step.method }, connected: false };
    }
    return handler(step, context);
  }

  getExecutionTrace(executionId) {
    return this.#traces.get(executionId) ?? null;
  }

  // ─── topological sort ────────────────────────────────────────────────────

  #topoSort(steps) {
    const byId = new Map(steps.map((s) => [s.id, s]));
    const visited = new Set();
    const result = [];

    const visit = (id) => {
      if (visited.has(id)) return;
      visited.add(id);
      const step = byId.get(id);
      if (!step) return;
      for (const dep of step.dependsOn ?? []) {
        visit(dep);
      }
      result.push(step);
    };

    for (const step of steps) {
      visit(step.id);
    }
    return result;
  }

  #isStepOptional(steps, id) {
    return steps.find((s) => s.id === id)?.optional ?? false;
  }

  #inferConnected(output) {
    if (output === null || output === undefined) return false;
    if (typeof output === 'object' && output.notConnected) return false;
    if (typeof output === 'object' && output.connected === false) return false;
    return true;
  }
}

// ─── subsystem dispatch handlers ─────────────────────────────────────────────
// Each handler receives (step, context) and must return { output, connected }.
// Lazy-import + graceful: if the subsystem module fails to load, returns NOT CONNECTED.

async function lazyImport(path) {
  try {
    const mod = await import(path);
    return mod.default ?? mod;
  } catch {
    return null;
  }
}

const STEP_HANDLERS = {
  HealthService: async (step, context) => {
    const svc = await lazyImport('../observability/HealthService.mjs');
    if (!svc) return { output: { notConnected: true, reason: 'HealthService not available' }, connected: false };
    try {
      let output;
      if (step.method === 'getSystemHealth') {
        output = typeof svc.getSystemHealth === 'function'
          ? await svc.getSystemHealth()
          : await svc.checkHealth?.();
      } else if (step.method === 'detectAnomalies') {
        output = typeof svc.detectAnomalies === 'function'
          ? await svc.detectAnomalies()
          : { anomalies: [], notConnected: false };
      } else {
        output = await svc[step.method]?.();
      }
      return { output, connected: output != null && !output.notConnected };
    } catch (err) {
      return { output: { notConnected: true, error: err.message }, connected: false };
    }
  },

  MemoryRetriever: async (step, context) => {
    const svc = await lazyImport('../memory-engine/MemoryRetriever.mjs');
    if (!svc) return { output: { notConnected: true, reason: 'MemoryRetriever not available' }, connected: false };
    try {
      let output;
      const incident = context['core-investigation'] ?? context.input?.incident ?? context.input;
      if (step.method === 'retrieveRelated') {
        const query = typeof incident === 'string' ? incident : JSON.stringify(incident);
        output = typeof svc.retrieveRelated === 'function'
          ? await svc.retrieveRelated(query)
          : await svc.retrieve?.({ query });
      } else if (step.method === 'retrieveDeploymentPrecedents') {
        const components = context.input?.changedComponents ?? [];
        output = typeof svc.retrieveDeploymentPrecedents === 'function'
          ? await svc.retrieveDeploymentPrecedents(components)
          : await svc.retrieve?.({ query: `deployment ${components.join(' ')}`, collection: 'deployments' });
      } else {
        output = await svc[step.method]?.(context.input);
      }
      return { output: output ?? { notConnected: true, reason: 'no data returned' }, connected: output != null };
    } catch (err) {
      return { output: { notConnected: true, error: err.message }, connected: false };
    }
  },

  KnowledgeAcquisitionService: async (step, context) => {
    const svc = await lazyImport('../knowledge-engine/KnowledgeAcquisitionService.mjs');
    if (!svc) return { output: { notConnected: true, reason: 'KnowledgeAcquisitionService not available' }, connected: false };
    try {
      const output = await svc[step.method]?.(context.input) ?? { notConnected: true };
      return { output, connected: output && !output.notConnected };
    } catch (err) {
      return { output: { notConnected: true, error: err.message }, connected: false };
    }
  },

  GraphExplorer: async (step, context) => {
    const svc = await lazyImport('../graph-engine/GraphExplorer.mjs');
    if (!svc) return { output: { notConnected: true, reason: 'GraphExplorer not available' }, connected: false };
    try {
      const output = await svc[step.method]?.(context.input) ?? { notConnected: true };
      return { output, connected: output && !output.notConnected };
    } catch (err) {
      return { output: { notConnected: true, error: err.message }, connected: false };
    }
  },

  ContextAssembler: async (step, context) => {
    const svc = await lazyImport('../context-intelligence/ContextAssembler.mjs');
    if (!svc) return { output: { notConnected: true, reason: 'ContextAssembler not available' }, connected: false };
    try {
      const output = await svc[step.method]?.(context.input) ?? { notConnected: true };
      return { output, connected: output && !output.notConnected };
    } catch (err) {
      return { output: { notConnected: true, error: err.message }, connected: false };
    }
  },

  BrowserIntelligenceEngine: async (step, context) => {
    const svc = await lazyImport('../browser-intelligence/BrowserIntelligenceEngine.mjs');
    if (!svc) return { output: { notConnected: true, reason: 'BrowserIntelligenceEngine not available' }, connected: false };
    try {
      let output;
      if (step.method === 'validateSystem') {
        output = typeof svc.validateSystem === 'function'
          ? await svc.validateSystem()
          : { notConnected: true, reason: 'validateSystem not exported' };
      } else {
        output = await svc[step.method]?.(context.input) ?? { notConnected: true };
      }
      return { output, connected: output && !output.notConnected };
    } catch (err) {
      return { output: { notConnected: true, error: err.message }, connected: false };
    }
  },

  ReasoningEngine: async (step, context) => {
    const svc = await lazyImport('../reasoning/ReasoningEngine.mjs');
    if (!svc) return { output: { notConnected: true, reason: 'ReasoningEngine not available' }, connected: false };
    try {
      let output;
      if (step.method === 'reasonDeployment') {
        const payload = {
          blastRadius: context['v1-blast-radius'],
          changeImpact: context['v1-change-impact'],
          components: context.input?.changedComponents ?? [],
        };
        output = typeof svc.reasonDeployment === 'function'
          ? await svc.reasonDeployment(payload)
          : await svc.reason?.({ type: 'deployment', ...payload });
      } else if (step.method === 'reasonArchitecture') {
        output = typeof svc.reasonArchitecture === 'function'
          ? await svc.reasonArchitecture({ snapshot: context['architecture-snapshot'], drift: context['drift-analysis'] })
          : await svc.reason?.({ type: 'architecture', snapshot: context['architecture-snapshot'] });
      } else {
        output = await svc[step.method]?.(context.input) ?? { notConnected: true };
      }
      return { output: output ?? { notConnected: true }, connected: output != null && !output?.notConnected };
    } catch (err) {
      return { output: { notConnected: true, error: err.message }, connected: false };
    }
  },

  IntelligenceCorrelationEngine: async (step, context) => {
    const svc = await lazyImport('../correlation/IntelligenceCorrelationEngine.mjs');
    if (!svc) return { output: { notConnected: true, reason: 'IntelligenceCorrelationEngine not available' }, connected: false };
    try {
      let output;
      if (step.method === 'correlateRisks') {
        output = typeof svc.correlateRisks === 'function'
          ? await svc.correlateRisks({ domainRisks: context['domain-risk-score'], drift: context['drift-detection'] })
          : await svc.correlate?.({ type: 'risks', context });
      } else if (step.method === 'correlateIncident') {
        output = typeof svc.correlateIncident === 'function'
          ? await svc.correlateIncident(context['core-investigation'])
          : await svc.correlate?.({ type: 'incident', incident: context['core-investigation'] });
      } else if (step.method === 'assessDependencyRisk') {
        output = typeof svc.assessDependencyRisk === 'function'
          ? await svc.assessDependencyRisk({ snapshot: context['architecture-snapshot'] })
          : await svc.correlate?.({ type: 'dependency', snapshot: context['architecture-snapshot'] });
      } else {
        output = await svc[step.method]?.(context.input) ?? { notConnected: true };
      }
      return { output: output ?? { notConnected: true }, connected: output != null && !output?.notConnected };
    } catch (err) {
      return { output: { notConnected: true, error: err.message }, connected: false };
    }
  },

  ExecutiveRecommendationEngine: async (step, context) => {
    const svc = await lazyImport('../recommendation-engine/ExecutiveRecommendationEngine.mjs');
    if (!svc) return { output: { notConnected: true, reason: 'ExecutiveRecommendationEngine not available' }, connected: false };
    try {
      let output;
      if (step.method === 'recommendForIncident') {
        output = typeof svc.recommendForIncident === 'function'
          ? await svc.recommendForIncident({
              investigation: context['core-investigation'],
              memory: context['memory-enrichment'],
              correlation: context['correlation-analysis'],
            })
          : await svc.recommend?.({ type: 'incident', context });
      } else if (step.method === 'recommendArchitectureImprovements') {
        output = typeof svc.recommendArchitectureImprovements === 'function'
          ? await svc.recommendArchitectureImprovements({
              snapshot: context['architecture-snapshot'],
              drift: context['drift-analysis'],
              dependencyRisk: context['dependency-risk'],
            })
          : await svc.recommend?.({ type: 'architecture', context });
      } else {
        output = await svc[step.method]?.(context.input) ?? { notConnected: true };
      }
      return { output: output ?? { notConnected: true }, connected: output != null && !output?.notConnected };
    } catch (err) {
      return { output: { notConnected: true, error: err.message }, connected: false };
    }
  },

  PredictionEngine: async (step, context) => {
    const svc = await lazyImport('../prediction-engine/PredictionEngine.mjs');
    if (!svc) return { output: { notConnected: true, reason: 'PredictionEngine not available' }, connected: false };
    try {
      let output;
      if (step.method === 'predictFailures') {
        output = typeof svc.predictFailures === 'function'
          ? await svc.predictFailures({ domainRisks: context['domain-risk-score'] })
          : await svc.predict?.({ type: 'failures', context });
      } else if (step.method === 'forecastDeploymentRisk') {
        output = typeof svc.forecastDeploymentRisk === 'function'
          ? await svc.forecastDeploymentRisk({
              blastRadius: context['v1-blast-radius'],
              changeImpact: context['v1-change-impact'],
              components: context.input?.changedComponents ?? [],
            })
          : await svc.predict?.({ type: 'deployment', context });
      } else {
        output = await svc[step.method]?.(context.input) ?? { notConnected: true };
      }
      return { output: output ?? { notConnected: true }, connected: output != null && !output?.notConnected };
    } catch (err) {
      return { output: { notConnected: true, error: err.message }, connected: false };
    }
  },

  InvestigationEngine: async (step, context) => {
    const svc = await lazyImport('../investigation-engine/InvestigationEngine.mjs');
    if (!svc) return { output: { notConnected: true, reason: 'InvestigationEngine not available' }, connected: false };
    try {
      const incident = context.input?.incident ?? context.input ?? {};
      let output;
      if (step.method === 'investigate') {
        output = typeof svc.investigate === 'function'
          ? await svc.investigate(incident)
          : await svc.run?.(incident);
      } else {
        output = await svc[step.method]?.(context.input) ?? { notConnected: true };
      }
      return { output: output ?? { notConnected: true }, connected: output != null && !output?.notConnected };
    } catch (err) {
      return { output: { notConnected: true, error: err.message }, connected: false };
    }
  },

  ArchitectureIntelligenceEngine: async (step, context) => {
    const svc = await lazyImport('../architecture-intelligence/ArchitectureIntelligenceEngine.mjs');
    if (!svc) return { output: { notConnected: true, reason: 'ArchitectureIntelligenceEngine not available' }, connected: false };
    try {
      let output;
      if (step.method === 'buildSnapshot') {
        output = typeof svc.buildSnapshot === 'function'
          ? await svc.buildSnapshot()
          : await svc.analyze?.();
      } else if (step.method === 'detectDrift') {
        output = typeof svc.detectDrift === 'function'
          ? await svc.detectDrift(context['architecture-snapshot'])
          : await svc.drift?.();
      } else {
        output = await svc[step.method]?.(context.input) ?? { notConnected: true };
      }
      return { output: output ?? { notConnected: true }, connected: output != null && !output?.notConnected };
    } catch (err) {
      return { output: { notConnected: true, error: err.message }, connected: false };
    }
  },

  RiskScorer: async (step, context) => {
    const svc = await lazyImport('../correlation/RiskScorer.mjs');
    if (!svc) return { output: { notConnected: true, reason: 'RiskScorer not available' }, connected: false };
    try {
      let output;
      if (step.method === 'scoreAllDomains') {
        output = typeof svc.scoreAllDomains === 'function'
          ? await svc.scoreAllDomains()
          : await svc.score?.() ?? { notConnected: true };
      } else {
        output = await svc[step.method]?.(context.input) ?? { notConnected: true };
      }
      return { output, connected: output && !output.notConnected };
    } catch (err) {
      return { output: { notConnected: true, error: err.message }, connected: false };
    }
  },

  ExecutiveIntelligenceEngine: async (step, context) => {
    const svc = await lazyImport('../executive-intelligence/ExecutiveIntelligenceEngine.mjs');
    if (!svc) return { output: { notConnected: true, reason: 'ExecutiveIntelligenceEngine not available' }, connected: false };
    try {
      const output = await svc[step.method]?.(context.input) ?? { notConnected: true };
      return { output, connected: output && !output.notConnected };
    } catch (err) {
      return { output: { notConnected: true, error: err.message }, connected: false };
    }
  },

  V1Lcis: async (step, context) => {
    // HTTP calls to V1 LCIS at http://localhost:3333
    const base = 'http://localhost:3333';
    const methodStr = step.method; // e.g. "GET /api/production-health"
    const [, path] = methodStr.split(' ');
    if (!path) return { output: { notConnected: true, reason: 'no path in method' }, connected: false };

    // Build URL: inject query params from context where relevant
    let url = `${base}${path}`;
    if (path === '/api/blast') {
      const components = context.input?.changedComponents ?? [];
      if (components.length > 0) url += `?q=${encodeURIComponent(components[0])}`;
    } else if (path === '/api/change-impact-live') {
      const components = context.input?.changedComponents ?? [];
      if (components.length > 0) url += `?domain=${encodeURIComponent(components[0])}`;
    }

    try {
      const { default: fetch } = await import('node:module').then(() => import('node-fetch')).catch(() => ({ default: globalThis.fetch }));
      const res = await (fetch ?? globalThis.fetch)(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return { output: { notConnected: true, httpStatus: res.status, url }, connected: false };
      const output = await res.json();
      return { output, connected: true };
    } catch (err) {
      return { output: { notConnected: true, reason: `V1 LCIS not reachable: ${err.message}`, url }, connected: false };
    }
  },

  // OrchestrationEngine synthesis steps are handled directly in OrchestrationEngine._runSynthesisStep
  OrchestrationEngine: async (step, context) => {
    // Synthesis steps are injected at execution time by OrchestrationEngine.
    // When called standalone through WorkflowExecutor, return the accumulated context.
    return { output: { synthesis: 'pending — run via OrchestrationEngine', context: Object.keys(context) }, connected: false };
  },
};

export default new WorkflowExecutor();
export { WorkflowExecutor, STEP_HANDLERS };
