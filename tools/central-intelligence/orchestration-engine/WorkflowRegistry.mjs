/**
 * LCIS V3 — WorkflowRegistry
 * Declares the 5 canonical workflows with their step graphs.
 * Each step carries: id, subsystem, method, dependsOn (ids), optional flag.
 */

class WorkflowRegistry {
  #workflows = new Map();

  constructor() {
    this.#seed();
  }

  // ─── seed ────────────────────────────────────────────────────────────────

  #seed() {
    this.register({
      name: 'health-assessment',
      description:
        'Unified health report: HealthService + V1 production-health + browser checks + anomaly detection.',
      steps: [
        {
          id: 'subsystem-health',
          subsystem: 'HealthService',
          method: 'getSystemHealth',
          dependsOn: [],
          optional: false,
        },
        {
          id: 'v1-production-health',
          subsystem: 'V1Lcis',
          method: 'GET /api/production-health',
          dependsOn: [],
          optional: true,
        },
        {
          id: 'anomaly-detection',
          subsystem: 'HealthService',
          method: 'detectAnomalies',
          dependsOn: ['subsystem-health'],
          optional: true,
        },
        {
          id: 'browser-validation',
          subsystem: 'BrowserIntelligenceEngine',
          method: 'validateSystem',
          dependsOn: ['v1-production-health'],
          optional: true,
        },
        {
          id: 'health-synthesis',
          subsystem: 'OrchestrationEngine',
          method: '_synthesizeHealth',
          dependsOn: ['subsystem-health', 'v1-production-health', 'anomaly-detection', 'browser-validation'],
          optional: false,
        },
      ],
      outputs: ['healthScore', 'status', 'subsystems', 'anomalies', 'browserSignals', 'v1Health'],
    });

    this.register({
      name: 'risk-assessment',
      description:
        'Risk report: RiskScorer across domains + PredictionEngine + drift detection.',
      steps: [
        {
          id: 'domain-risk-score',
          subsystem: 'RiskScorer',
          method: 'scoreAllDomains',
          dependsOn: [],
          optional: false,
        },
        {
          id: 'drift-detection',
          subsystem: 'ArchitectureIntelligenceEngine',
          method: 'detectDrift',
          dependsOn: [],
          optional: true,
        },
        {
          id: 'failure-prediction',
          subsystem: 'PredictionEngine',
          method: 'predictFailures',
          dependsOn: ['domain-risk-score'],
          optional: true,
        },
        {
          id: 'risk-correlation',
          subsystem: 'IntelligenceCorrelationEngine',
          method: 'correlateRisks',
          dependsOn: ['domain-risk-score', 'drift-detection'],
          optional: true,
        },
        {
          id: 'risk-synthesis',
          subsystem: 'OrchestrationEngine',
          method: '_synthesizeRisk',
          dependsOn: ['domain-risk-score', 'drift-detection', 'failure-prediction', 'risk-correlation'],
          optional: false,
        },
      ],
      outputs: ['overallRisk', 'domainRisks', 'driftFindings', 'predictions', 'correlations'],
    });

    this.register({
      name: 'investigation',
      description:
        'Incident investigation: InvestigationEngine + memory enrichment + executive recommendations.',
      steps: [
        {
          id: 'core-investigation',
          subsystem: 'InvestigationEngine',
          method: 'investigate',
          dependsOn: [],
          optional: false,
        },
        {
          id: 'memory-enrichment',
          subsystem: 'MemoryRetriever',
          method: 'retrieveRelated',
          dependsOn: ['core-investigation'],
          optional: true,
        },
        {
          id: 'correlation-analysis',
          subsystem: 'IntelligenceCorrelationEngine',
          method: 'correlateIncident',
          dependsOn: ['core-investigation'],
          optional: true,
        },
        {
          id: 'recommendations',
          subsystem: 'ExecutiveRecommendationEngine',
          method: 'recommendForIncident',
          dependsOn: ['core-investigation', 'memory-enrichment', 'correlation-analysis'],
          optional: true,
        },
        {
          id: 'investigation-synthesis',
          subsystem: 'OrchestrationEngine',
          method: '_synthesizeInvestigation',
          dependsOn: ['core-investigation', 'memory-enrichment', 'correlation-analysis', 'recommendations'],
          optional: false,
        },
      ],
      outputs: ['rootCause', 'timeline', 'affectedComponents', 'similarPastIncidents', 'recommendations'],
    });

    this.register({
      name: 'deployment-review',
      description:
        'GO/NO-GO deployment review: change impact + blast radius + deployment reasoning + risk forecast.',
      steps: [
        {
          id: 'v1-blast-radius',
          subsystem: 'V1Lcis',
          method: 'GET /api/blast',
          dependsOn: [],
          optional: true,
        },
        {
          id: 'v1-change-impact',
          subsystem: 'V1Lcis',
          method: 'GET /api/change-impact-live',
          dependsOn: [],
          optional: true,
        },
        {
          id: 'deployment-reasoning',
          subsystem: 'ReasoningEngine',
          method: 'reasonDeployment',
          dependsOn: ['v1-blast-radius', 'v1-change-impact'],
          optional: false,
        },
        {
          id: 'risk-forecast',
          subsystem: 'PredictionEngine',
          method: 'forecastDeploymentRisk',
          dependsOn: ['v1-blast-radius', 'v1-change-impact'],
          optional: true,
        },
        {
          id: 'memory-precedents',
          subsystem: 'MemoryRetriever',
          method: 'retrieveDeploymentPrecedents',
          dependsOn: [],
          optional: true,
        },
        {
          id: 'deployment-synthesis',
          subsystem: 'OrchestrationEngine',
          method: '_synthesizeDeployment',
          dependsOn: ['deployment-reasoning', 'risk-forecast', 'memory-precedents'],
          optional: false,
        },
      ],
      outputs: ['verdict', 'blastRadius', 'changeImpact', 'riskForecast', 'precedents', 'recommendation'],
    });

    this.register({
      name: 'architecture-review',
      description:
        'Architecture review: ArchitectureIntelligenceEngine + drift + dependency risk + recommendations.',
      steps: [
        {
          id: 'architecture-snapshot',
          subsystem: 'ArchitectureIntelligenceEngine',
          method: 'buildSnapshot',
          dependsOn: [],
          optional: false,
        },
        {
          id: 'drift-analysis',
          subsystem: 'ArchitectureIntelligenceEngine',
          method: 'detectDrift',
          dependsOn: ['architecture-snapshot'],
          optional: true,
        },
        {
          id: 'dependency-risk',
          subsystem: 'IntelligenceCorrelationEngine',
          method: 'assessDependencyRisk',
          dependsOn: ['architecture-snapshot'],
          optional: true,
        },
        {
          id: 'architecture-reasoning',
          subsystem: 'ReasoningEngine',
          method: 'reasonArchitecture',
          dependsOn: ['architecture-snapshot', 'drift-analysis'],
          optional: true,
        },
        {
          id: 'architecture-recommendations',
          subsystem: 'ExecutiveRecommendationEngine',
          method: 'recommendArchitectureImprovements',
          dependsOn: ['architecture-snapshot', 'drift-analysis', 'dependency-risk'],
          optional: true,
        },
        {
          id: 'architecture-synthesis',
          subsystem: 'OrchestrationEngine',
          method: '_synthesizeArchitecture',
          dependsOn: [
            'architecture-snapshot',
            'drift-analysis',
            'dependency-risk',
            'architecture-reasoning',
            'architecture-recommendations',
          ],
          optional: false,
        },
      ],
      outputs: ['snapshot', 'driftFindings', 'dependencyRisks', 'reasoning', 'recommendations'],
    });
  }

  // ─── public API ──────────────────────────────────────────────────────────

  register(workflow) {
    if (!workflow?.name || !Array.isArray(workflow.steps)) {
      throw new Error('WorkflowRegistry.register: workflow must have name and steps[]');
    }
    this.#workflows.set(workflow.name, {
      name: workflow.name,
      description: workflow.description ?? '',
      steps: workflow.steps,
      outputs: workflow.outputs ?? [],
      registeredAt: new Date().toISOString(),
    });
    return this;
  }

  getWorkflow(name) {
    return this.#workflows.get(name) ?? null;
  }

  listWorkflows() {
    return [...this.#workflows.values()].map((w) => ({
      name: w.name,
      description: w.description,
      stepCount: w.steps.length,
      outputs: w.outputs,
      registeredAt: w.registeredAt,
    }));
  }

  getWorkflowSteps(name) {
    const wf = this.#workflows.get(name);
    if (!wf) return null;
    return wf.steps;
  }
}

export default new WorkflowRegistry();
