/**
 * LCIS V2 — OperationsAgent
 *
 * Detects incidents, diagnoses failures, recommends fixes, and retrieves
 * operational runbooks — integrating live V1 LCIS signals, graph blast radius,
 * and memory incident history.
 *
 * @module OperationsAgent
 */

import { AgentFramework } from './AgentFramework.mjs';
import MemoryRetriever from '../memory-engine/MemoryRetriever.mjs';
import GraphQueryEngine from '../graph-engine/GraphQueryEngine.mjs';

class OperationsAgent extends AgentFramework {
  constructor() {
    super('OperationsAgent', [
      'incident-detection',
      'failure-diagnosis',
      'fix-recommendation',
      'operational-status',
      'runbook-retrieval',
    ]);
  }

  // ── Public domain methods ─────────────────────────────────────────────────

  /**
   * Detect active or emerging incidents for a domain by combining V1 LCIS
   * autonomous detection signals with graph blast-radius data.
   * @param {string} domain
   * @returns {Promise<{
   *   detection: unknown|null,
   *   graphImpact: string,
   *   incidents: Array<object>,
   *   liveTelemetry: unknown|null,
   * }>}
   */
  async detectIncident(domain) {
    this.log(`detectIncident: domain=${domain}`);

    const [detectionResult, graphResult, incidentMemResult, telemetryResult] = await Promise.allSettled([
      this.useLCISV1(`/api/detection?domain=${encodeURIComponent(domain)}`),
      Promise.resolve(GraphQueryEngine.getImpact(domain)),
      MemoryRetriever.retrieveIncidents(domain),
      this.useLCISV1(`/api/live-metrics?domain=${encodeURIComponent(domain)}`),
    ]);

    const detection = detectionResult.status === 'fulfilled' ? detectionResult.value : null;
    if (detectionResult.status === 'rejected') {
      this.log(`detectIncident: detection endpoint failed — ${detectionResult.reason?.message}`, 'warn');
    }

    const graphImpact = graphResult.status === 'fulfilled' && graphResult.value?.success
      ? graphResult.value.answer
      : '';

    const incidents = incidentMemResult.status === 'fulfilled'
      ? incidentMemResult.value.map((h) => ({
          id: h.id,
          source: String(h.payload?.source ?? 'unknown'),
          summary: String(h.payload?.text ?? '').slice(0, 400),
          score: h.score,
          collection: h.collection,
        }))
      : [];

    const liveTelemetry = telemetryResult.status === 'fulfilled' ? telemetryResult.value : null;

    return { detection, graphImpact, incidents, liveTelemetry };
  }

  /**
   * Diagnose a failure by combining memory incident history, graph impact
   * analysis, and the V1 LCIS investigate endpoint.
   * @param {string} error  Error message or symptom description
   * @param {string} domain  Domain where the failure occurred
   * @returns {Promise<{
   *   rootCause: unknown|null,
   *   relatedIncidents: Array<object>,
   *   graphDiagnosis: string,
   *   runbook: {content:string,source:string,score:number}|null,
   * }>}
   */
  async diagnoseFailure(error, domain) {
    this.log(`diagnoseFailure: error="${error}" domain=${domain}`);

    const query = `${domain} ${error}`;

    const [investigateResult, incidentResult, graphResult, runbookResult] = await Promise.allSettled([
      this.useLCISV1(`/api/investigate?q=${encodeURIComponent(query)}`),
      MemoryRetriever.retrieveIncidents(domain, { limit: 8 }),
      Promise.resolve(GraphQueryEngine.queryLocal(
        `What causes "${error}" in ${domain}? What is the root cause and which systems are affected?`
      )),
      MemoryRetriever.retrieveRunbook(domain),
    ]);

    return {
      rootCause: investigateResult.status === 'fulfilled' ? investigateResult.value : null,
      relatedIncidents: incidentResult.status === 'fulfilled'
        ? incidentResult.value.map((h) => ({
            id: h.id,
            summary: String(h.payload?.text ?? '').slice(0, 400),
            score: h.score,
          }))
        : [],
      graphDiagnosis: graphResult.status === 'fulfilled' && graphResult.value?.success
        ? graphResult.value.answer
        : '',
      runbook: runbookResult.status === 'fulfilled' ? runbookResult.value : null,
    };
  }

  /**
   * Recommend a fix for an incident descriptor by querying V1 LCIS fix engine
   * and the knowledge corpus.
   * @param {{ domain?: string, error?: string, summary?: string }} incident
   * @returns {Promise<{
   *   fixPlan: unknown|null,
   *   knowledgeHits: Array<object>,
   *   graphRecommendation: string,
   * }>}
   */
  async recommendFix(incident) {
    const domain = incident?.domain ?? '';
    const error = incident?.error ?? incident?.summary ?? '';
    this.log(`recommendFix: domain=${domain} error=${error}`);

    const fixQuery = `${domain} ${error} fix repair recover mitigation resolution`;

    const [fixEngineResult, knowledgeResult, graphResult] = await Promise.allSettled([
      this.useLCISV1(`/api/fix-engine?domain=${encodeURIComponent(domain)}`),
      MemoryRetriever.retrieve(fixQuery, {
        collections: ['runbooks', 'architecture', 'incidents'],
        limit: 8,
        minScore: 0.2,
      }),
      Promise.resolve(GraphQueryEngine.queryLocal(
        `How do you fix "${error}" in ${domain}? What is the recovery procedure?`
      )),
    ]);

    return {
      fixPlan: fixEngineResult.status === 'fulfilled' ? fixEngineResult.value : null,
      knowledgeHits: knowledgeResult.status === 'fulfilled'
        ? knowledgeResult.value.map((h) => ({
            source: String(h.payload?.source ?? 'unknown'),
            text: String(h.payload?.text ?? '').slice(0, 400),
            score: h.score,
          }))
        : [],
      graphRecommendation: graphResult.status === 'fulfilled' && graphResult.value?.success
        ? graphResult.value.answer
        : '',
    };
  }

  /**
   * Return current operational status across all domains from V1 LCIS.
   * @returns {Promise<{
   *   observability: unknown|null,
   *   aiOps: unknown|null,
   *   launchStatus: unknown|null,
   * }>}
   */
  async getOperationalStatus() {
    this.log('getOperationalStatus');

    const [obsResult, aiOpsResult, launchResult] = await Promise.allSettled([
      this.useLCISV1('/api/observability'),
      this.useLCISV1('/api/ai-ops'),
      this.useLCISV1('/api/launch-status'),
    ]);

    return {
      observability: obsResult.status === 'fulfilled' ? obsResult.value : null,
      aiOps: aiOpsResult.status === 'fulfilled' ? aiOpsResult.value : null,
      launchStatus: launchResult.status === 'fulfilled' ? launchResult.value : null,
    };
  }

  /**
   * Retrieve and synthesise the full runbook for a domain.
   * @param {string} domain
   * @returns {Promise<{
   *   lcisRunbook: unknown|null,
   *   memoryRunbook: {content:string,source:string,score:number}|null,
   *   escalation: string,
   * }>}
   */
  async runbookForDomain(domain) {
    this.log(`runbookForDomain: domain=${domain}`);

    const [lcisResult, memResult] = await Promise.allSettled([
      this.useLCISV1(`/api/runbook?domain=${encodeURIComponent(domain)}`),
      MemoryRetriever.retrieveRunbook(domain),
    ]);

    const lcisRunbook = lcisResult.status === 'fulfilled' ? lcisResult.value : null;
    const memRunbook = memResult.status === 'fulfilled' ? memResult.value : null;

    // Extract escalation chain from LCIS response if present
    const escalation = lcisRunbook && typeof lcisRunbook === 'object' && lcisRunbook.escalation
      ? JSON.stringify(lcisRunbook.escalation)
      : 'Escalation chain: NOT CONNECTED — requires live LCIS V1 runbook endpoint';

    return { lcisRunbook, memoryRunbook: memRunbook, escalation };
  }
}

export default new OperationsAgent();
