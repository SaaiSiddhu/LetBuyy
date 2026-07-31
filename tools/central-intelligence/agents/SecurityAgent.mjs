/**
 * LCIS V2 — SecurityAgent
 *
 * Assesses risk, checks vulnerabilities, reviews RLS coverage, detects anomalies,
 * and returns a holistic security posture for the platform.
 *
 * @module SecurityAgent
 */

import { AgentFramework } from './AgentFramework.mjs';
import MemoryRetriever from '../memory-engine/MemoryRetriever.mjs';
import AnomalyDetectionService from '../observability/AnomalyDetectionService.mjs';

class SecurityAgent extends AgentFramework {
  constructor() {
    super('SecurityAgent', [
      'risk-assessment',
      'vulnerability-check',
      'rls-coverage',
      'anomaly-detection',
      'security-posture',
    ]);
  }

  // ── Public domain methods ─────────────────────────────────────────────────

  /**
   * Assess the security risk for a platform component.
   * @param {string} component
   * @returns {Promise<{
   *   riskLevel: 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL',
   *   findings: Array<{source:string,text:string,score:number}>,
   *   graphRisk: string,
   *   lcisRisk: unknown|null,
   * }>}
   */
  async assessRisk(component) {
    this.log(`assessRisk: component=${component}`);

    const [secCtx, graphResult, lcisResult] = await Promise.allSettled([
      MemoryRetriever.retrieveSecurityContext(component),
      Promise.resolve(this.useGraph(
        `What are the security risks, attack surfaces, and vulnerabilities of ${component}?`
      )),
      this.useLCISV1(`/api/security-intelligence`),
    ]);

    const secContext = secCtx.status === 'fulfilled' ? secCtx.value : { hits: [], summary: '' };
    const graph = graphResult.status === 'fulfilled' ? graphResult.value : null;
    const lcis = lcisResult.status === 'fulfilled' ? lcisResult.value : null;

    // Derive risk level from hit scores
    const topScore = secContext.hits.length > 0
      ? Math.max(...secContext.hits.map((h) => h.score))
      : 0;
    const riskLevel =
      topScore >= 0.8 ? 'CRITICAL'
      : topScore >= 0.6 ? 'HIGH'
      : topScore >= 0.4 ? 'MEDIUM'
      : 'LOW';

    const findings = secContext.hits.map((h) => ({
      source: String(h.payload?.source ?? 'unknown'),
      text: String(h.payload?.text ?? '').slice(0, 400),
      score: h.score,
    }));

    return {
      riskLevel,
      findings,
      graphRisk: graph?.success ? graph.answer : '',
      lcisRisk: lcis,
    };
  }

  /**
   * Check known vulnerabilities for a component by querying the security
   * memory collection and graph.
   * @param {string} component
   * @returns {Promise<{
   *   vulnerabilities: Array<object>,
   *   graphFindings: string,
   * }>}
   */
  async checkVulnerabilities(component) {
    this.log(`checkVulnerabilities: component=${component}`);

    const [memResult, graphResult] = await Promise.allSettled([
      MemoryRetriever.retrieve(
        `${component} vulnerability CVE injection XSS CSRF auth bypass exploit`,
        { collections: ['security'], limit: 10, minScore: 0.25 }
      ),
      Promise.resolve(this.useGraph(
        `List all known vulnerabilities, security issues, and attack vectors for ${component}.`
      )),
    ]);

    const vulnerabilities = memResult.status === 'fulfilled'
      ? memResult.value.map((h) => ({
          id: h.id,
          source: String(h.payload?.source ?? 'unknown'),
          summary: String(h.payload?.text ?? '').slice(0, 300),
          score: h.score,
        }))
      : [];

    const graphFindings = graphResult.status === 'fulfilled' && graphResult.value?.success
      ? graphResult.value.answer
      : '';

    return { vulnerabilities, graphFindings };
  }

  /**
   * Review Row Level Security coverage by querying V1 LCIS security endpoint
   * and the security memory collection.
   * @returns {Promise<{
   *   lcisSecurityIntelligence: unknown|null,
   *   rlsDocs: Array<object>,
   *   coverage: string,
   * }>}
   */
  async reviewRLSCoverage() {
    this.log('reviewRLSCoverage');

    const [lcisResult, memResult] = await Promise.allSettled([
      this.useLCISV1('/api/security-intelligence'),
      MemoryRetriever.retrieve(
        'RLS row level security policy tenant isolation multi-tenant',
        { collections: ['security', 'architecture'], limit: 10, minScore: 0.2 }
      ),
    ]);

    const lcis = lcisResult.status === 'fulfilled' ? lcisResult.value : null;
    const rlsDocs = memResult.status === 'fulfilled'
      ? memResult.value.map((h) => ({
          source: String(h.payload?.source ?? 'unknown'),
          text: String(h.payload?.text ?? '').slice(0, 350),
          score: h.score,
        }))
      : [];

    // Extract coverage summary from LCIS if available
    const coverage = lcis && typeof lcis === 'object' && lcis.rlsCoverage
      ? JSON.stringify(lcis.rlsCoverage)
      : rlsDocs.length > 0
        ? `Found ${rlsDocs.length} RLS-related documents in memory`
        : 'NOT CONNECTED — RLS coverage requires live DB graph';

    return { lcisSecurityIntelligence: lcis, rlsDocs, coverage };
  }

  /**
   * Detect statistical anomalies across all tracked metrics and cross-reference
   * with memory to identify security-relevant patterns.
   * @returns {Promise<{
   *   anomalies: Array<object>,
   *   securityCorrelations: Array<object>,
   * }>}
   */
  async detectAnomalies() {
    this.log('detectAnomalies');

    // Pull all recorded anomalies from the in-process detector
    const allAnomalies = AnomalyDetectionService.getAllAnomalies();

    // For each anomaly, query memory for security context
    const correlations = [];
    for (const anomaly of allAnomalies.slice(0, 5)) {
      const memResult = await MemoryRetriever.retrieve(
        `${anomaly.metricName} security threat attack unusual behaviour`,
        { collections: ['security', 'incidents'], limit: 3, minScore: 0.2 }
      ).catch(() => []);

      if (memResult.length > 0) {
        correlations.push({
          anomaly,
          relatedDocs: memResult.map((h) => ({
            source: String(h.payload?.source ?? 'unknown'),
            text: String(h.payload?.text ?? '').slice(0, 200),
          })),
        });
      }
    }

    return { anomalies: allAnomalies, securityCorrelations: correlations };
  }

  /**
   * Return the overall platform security posture by aggregating all security
   * intelligence sources.
   * @returns {Promise<{
   *   posture: 'SECURE'|'AT_RISK'|'COMPROMISED'|'UNKNOWN',
   *   lcisPosture: unknown|null,
   *   anomalyCount: number,
   *   topFindings: Array<object>,
   * }>}
   */
  async getSecurityPosture() {
    this.log('getSecurityPosture');

    const [lcisResult, memResult] = await Promise.allSettled([
      this.useLCISV1('/api/security-intelligence'),
      MemoryRetriever.retrieveSecurityContext('platform'),
    ]);

    const lcis = lcisResult.status === 'fulfilled' ? lcisResult.value : null;
    const secCtx = memResult.status === 'fulfilled' ? memResult.value : { hits: [], summary: '' };
    const allAnomalies = AnomalyDetectionService.getAllAnomalies();

    // Derive posture
    const criticalHits = secCtx.hits.filter((h) => h.score >= 0.75).length;
    const posture =
      allAnomalies.length > 5 || criticalHits > 3 ? 'COMPROMISED'
      : allAnomalies.length > 0 || criticalHits > 0 ? 'AT_RISK'
      : lcis ? 'SECURE'
      : 'UNKNOWN';

    const topFindings = secCtx.hits.slice(0, 5).map((h) => ({
      source: String(h.payload?.source ?? 'unknown'),
      text: String(h.payload?.text ?? '').slice(0, 300),
      score: h.score,
    }));

    return {
      posture,
      lcisPosture: lcis,
      anomalyCount: allAnomalies.length,
      topFindings,
    };
  }
}

export default new SecurityAgent();
