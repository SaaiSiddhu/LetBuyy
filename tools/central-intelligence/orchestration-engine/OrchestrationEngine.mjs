/**
 * LCIS V3 — OrchestrationEngine (Phase 25)
 * Coordinates every LCIS V2 subsystem into unified, repeatable workflows.
 *
 * Workflows:
 *   health-assessment     — HealthService + V1 production-health + browser + anomalies
 *   risk-assessment       — RiskScorer + PredictionEngine + drift
 *   investigation         — InvestigationEngine + memory enrichment + recommendations
 *   deployment-review     — change impact + blast radius + deployment reasoning + risk forecast
 *   architecture-review   — ArchitectureIntelligenceEngine + drift + dependency risk + recs
 *
 * Design principles:
 *   - Lazy import: subsystem modules are imported on first use, never at module load.
 *   - Promise.allSettled for parallel steps so one failure never blocks the rest.
 *   - NOT CONNECTED honesty: every subsystem result carries `connected: boolean`.
 *   - Results persisted to graphify-out/orchestration/{workflow}-{ts}.json.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import workflowRegistry from './WorkflowRegistry.mjs';
import workflowExecutor from './WorkflowExecutor.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '../../..');
const OUTPUT_DIR = path.join(REPO_ROOT, 'graphify-out', 'orchestration');

// ─── WorkflowResult shape ────────────────────────────────────────────────────
// {
//   id, workflow, input,
//   steps: [{ step, subsystem, status, durationMs, connected }],
//   result, confidence, startedAt, completedAt, artifactPath
// }

class OrchestrationEngine {
  #results = new Map(); // id → WorkflowResult

  // ─── dispatch ─────────────────────────────────────────────────────────────

  async runWorkflow(name, input = {}) {
    const workflow = workflowRegistry.getWorkflow(name);
    if (!workflow) throw new Error(`OrchestrationEngine: unknown workflow "${name}"`);

    const id = crypto.randomUUID();
    const startedAt = new Date().toISOString();

    // Inject synthesis handler overrides into executor context
    const enrichedWorkflow = this.#injectSynthesisHandlers(workflow);

    const execution = await workflowExecutor.execute(enrichedWorkflow, input);
    const completedAt = new Date().toISOString();

    // Map executor step results to WorkflowResult.steps shape
    const steps = (execution.steps ?? []).map((s) => ({
      step: s.stepId,
      subsystem: s.subsystem,
      status: s.status,
      durationMs: s.durationMs,
      connected: s.connected,
      ...(s.error ? { error: s.error } : {}),
    }));

    const synthesisStep = execution.steps?.find((s) => s.stepId.endsWith('-synthesis'));
    const result = synthesisStep?.output ?? this.#fallbackResult(execution);
    const confidence = this.#computeConfidence(execution.steps ?? []);

    const workflowResult = {
      id,
      workflow: name,
      input,
      steps,
      result,
      confidence,
      startedAt,
      completedAt,
      artifactPath: null,
    };

    workflowResult.artifactPath = this.#persist(workflow.name, workflowResult);
    this.#results.set(id, workflowResult);
    return workflowResult;
  }

  // ─── named workflow runners ───────────────────────────────────────────────

  async runHealthAssessment() {
    return this.runWorkflow('health-assessment', {});
  }

  async runRiskAssessment() {
    return this.runWorkflow('risk-assessment', {});
  }

  async runInvestigation(incident) {
    return this.runWorkflow('investigation', { incident });
  }

  async runDeploymentReview(changedComponents = []) {
    return this.runWorkflow('deployment-review', { changedComponents });
  }

  async runArchitectureReview() {
    return this.runWorkflow('architecture-review', {});
  }

  // ─── catalogue helpers ────────────────────────────────────────────────────

  listWorkflows() {
    return workflowRegistry.listWorkflows();
  }

  getWorkflowResult(id) {
    return this.#results.get(id) ?? null;
  }

  getHealth() {
    const results = [...this.#results.values()];
    return {
      status: 'operational',
      workflowsRegistered: workflowRegistry.listWorkflows().length,
      resultsInMemory: results.length,
      lastRun: results.length > 0
        ? results.sort((a, b) => b.completedAt.localeCompare(a.completedAt))[0].completedAt
        : null,
      outputDir: OUTPUT_DIR,
    };
  }

  // ─── synthesis handlers (injected at execution time) ─────────────────────
  // These replace the 'OrchestrationEngine' subsystem steps inside the executor.

  #injectSynthesisHandlers(workflow) {
    const self = this;
    // Clone workflow so we don't mutate the registry
    return {
      ...workflow,
      steps: workflow.steps.map((s) => {
        if (s.subsystem !== 'OrchestrationEngine') return s;
        return {
          ...s,
          __synthesisHandler: async (context) => {
            return self.#dispatchSynthesis(s.method, context);
          },
        };
      }),
    };
  }

  #dispatchSynthesis(method, context) {
    switch (method) {
      case '_synthesizeHealth':    return this._synthesizeHealth(context);
      case '_synthesizeRisk':      return this._synthesizeRisk(context);
      case '_synthesizeInvestigation': return this._synthesizeInvestigation(context);
      case '_synthesizeDeployment': return this._synthesizeDeployment(context);
      case '_synthesizeArchitecture': return this._synthesizeArchitecture(context);
      default:
        return { notConnected: false, warning: `unknown synthesis method: ${method}` };
    }
  }

  _synthesizeHealth(context) {
    const subsystemHealth = context['subsystem-health'];
    const v1Health = context['v1-production-health'];
    const anomalies = context['anomaly-detection'];
    const browserSignals = context['browser-validation'];

    const connected = !!(subsystemHealth && !subsystemHealth.notConnected);
    const v1Connected = !!(v1Health && !v1Health.notConnected);

    // Determine overall status
    const statuses = [subsystemHealth?.status, v1Health?.status].filter(Boolean);
    const hasError = statuses.some((s) => s === 'error' || s === 'critical' || s === 'RED');
    const hasWarning = statuses.some((s) => s === 'warning' || s === 'degraded' || s === 'YELLOW');
    const overallStatus = hasError ? 'RED' : hasWarning ? 'YELLOW' : 'GREEN';

    return {
      healthScore: this.#healthScore(subsystemHealth, anomalies),
      status: overallStatus,
      subsystems: subsystemHealth ?? { notConnected: true },
      anomalies: anomalies ?? { notConnected: true },
      browserSignals: browserSignals ?? { notConnected: true },
      v1Health: v1Health ?? { notConnected: true },
      connected,
      v1Connected,
      generatedAt: new Date().toISOString(),
    };
  }

  _synthesizeRisk(context) {
    const domainRisks = context['domain-risk-score'];
    const driftFindings = context['drift-detection'];
    const predictions = context['failure-prediction'];
    const correlations = context['risk-correlation'];

    const overallRisk = this.#computeOverallRisk(domainRisks);

    return {
      overallRisk,
      domainRisks: domainRisks ?? { notConnected: true },
      driftFindings: driftFindings ?? { notConnected: true },
      predictions: predictions ?? { notConnected: true },
      correlations: correlations ?? { notConnected: true },
      generatedAt: new Date().toISOString(),
    };
  }

  _synthesizeInvestigation(context) {
    const investigation = context['core-investigation'];
    const memoryMatches = context['memory-enrichment'];
    const correlation = context['correlation-analysis'];
    const recommendations = context['recommendations'];

    return {
      rootCause: investigation?.rootCause ?? investigation?.root_cause ?? { notConnected: !investigation },
      timeline: investigation?.timeline ?? { notConnected: !investigation },
      affectedComponents: investigation?.affectedComponents ?? investigation?.affected_components ?? [],
      similarPastIncidents: memoryMatches?.results ?? memoryMatches ?? { notConnected: !memoryMatches },
      correlation: correlation ?? { notConnected: true },
      recommendations: recommendations?.recommendations ?? recommendations ?? { notConnected: !recommendations },
      confidence: investigation?.confidence ?? null,
      generatedAt: new Date().toISOString(),
    };
  }

  _synthesizeDeployment(context) {
    const reasoning = context['deployment-reasoning'];
    const riskForecast = context['risk-forecast'];
    const precedents = context['memory-precedents'];
    const blastRadius = context['v1-blast-radius'];
    const changeImpact = context['v1-change-impact'];

    // Derive GO/NO-GO verdict
    const riskLevel = riskForecast?.riskLevel ?? riskForecast?.level ?? 'UNKNOWN';
    const reasoningVerdict = reasoning?.verdict ?? reasoning?.recommendation ?? null;
    const verdict = this.#deploymentVerdict(riskLevel, reasoningVerdict, blastRadius);

    return {
      verdict,
      blastRadius: blastRadius ?? { notConnected: true },
      changeImpact: changeImpact ?? { notConnected: true },
      riskForecast: riskForecast ?? { notConnected: true },
      precedents: precedents ?? { notConnected: true },
      reasoning: reasoning ?? { notConnected: true },
      recommendation: reasoning?.recommendation ?? null,
      generatedAt: new Date().toISOString(),
    };
  }

  _synthesizeArchitecture(context) {
    const snapshot = context['architecture-snapshot'];
    const drift = context['drift-analysis'];
    const dependencyRisk = context['dependency-risk'];
    const reasoning = context['architecture-reasoning'];
    const recommendations = context['architecture-recommendations'];

    return {
      snapshot: snapshot ?? { notConnected: true },
      driftFindings: drift ?? { notConnected: true },
      dependencyRisks: dependencyRisk ?? { notConnected: true },
      reasoning: reasoning ?? { notConnected: true },
      recommendations: recommendations?.recommendations ?? recommendations ?? { notConnected: true },
      generatedAt: new Date().toISOString(),
    };
  }

  // ─── helpers ──────────────────────────────────────────────────────────────

  #healthScore(subsystemHealth, anomalies) {
    if (!subsystemHealth || subsystemHealth.notConnected) return null;
    // If subsystem reports a numeric score, use it
    if (typeof subsystemHealth.score === 'number') return subsystemHealth.score;
    if (typeof subsystemHealth.healthScore === 'number') return subsystemHealth.healthScore;
    // Derive from status string
    const s = (subsystemHealth.status ?? '').toUpperCase();
    if (s === 'GREEN' || s === 'HEALTHY' || s === 'OK') return 1.0;
    if (s === 'YELLOW' || s === 'DEGRADED' || s === 'WARNING') return 0.6;
    if (s === 'RED' || s === 'CRITICAL' || s === 'ERROR') return 0.2;
    return null;
  }

  #computeOverallRisk(domainRisks) {
    if (!domainRisks || domainRisks.notConnected) return 'UNKNOWN';
    if (typeof domainRisks.overallRisk === 'string') return domainRisks.overallRisk;
    if (Array.isArray(domainRisks.domains)) {
      const maxScore = Math.max(...domainRisks.domains.map((d) => d.score ?? 0));
      if (maxScore >= 0.8) return 'CRITICAL';
      if (maxScore >= 0.6) return 'HIGH';
      if (maxScore >= 0.4) return 'MEDIUM';
      return 'LOW';
    }
    return 'UNKNOWN';
  }

  #deploymentVerdict(riskLevel, reasoningVerdict, blastRadius) {
    if (reasoningVerdict) return reasoningVerdict;
    const rl = (riskLevel ?? '').toUpperCase();
    if (rl === 'CRITICAL' || rl === 'HIGH') return 'NO-GO';
    if (rl === 'LOW' || rl === 'MINIMAL') return 'GO';
    if (blastRadius?.notConnected) return 'CONDITIONAL-GO — blast radius NOT CONNECTED';
    return 'CONDITIONAL-GO';
  }

  #computeConfidence(steps) {
    if (!steps.length) return 0;
    const connected = steps.filter((s) => s.connected && s.status === 'ok').length;
    const total = steps.filter((s) => s.status !== 'skipped').length;
    if (total === 0) return 0;
    return Math.round((connected / total) * 100) / 100;
  }

  #fallbackResult(execution) {
    return {
      partial: true,
      stepsCompleted: (execution.steps ?? []).filter((s) => s.status === 'ok').length,
      stepsFailed: (execution.steps ?? []).filter((s) => s.status === 'failed').length,
    };
  }

  #persist(workflowName, result) {
    try {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
      const ts = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${workflowName}-${ts}.json`;
      const filepath = path.join(OUTPUT_DIR, filename);
      fs.writeFileSync(filepath, JSON.stringify(result, null, 2), 'utf8');
      return filepath;
    } catch {
      // Non-fatal: disk write failure should never break the workflow
      return null;
    }
  }
}

// Patch WorkflowExecutor to call synthesis handlers injected by OrchestrationEngine
// We override the OrchestrationEngine subsystem handler at import time so that
// __synthesisHandler set on step definitions is invoked correctly.
import { STEP_HANDLERS } from './WorkflowExecutor.mjs';

STEP_HANDLERS['OrchestrationEngine'] = async (step, context) => {
  if (typeof step.__synthesisHandler === 'function') {
    try {
      const output = await step.__synthesisHandler(context);
      return { output, connected: true };
    } catch (err) {
      return { output: { notConnected: true, error: err.message }, connected: false };
    }
  }
  return { output: { synthesis: 'no handler injected', step: step.id }, connected: false };
};

export default new OrchestrationEngine();
