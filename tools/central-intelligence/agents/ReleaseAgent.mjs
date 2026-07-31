/**
 * LCIS V2 — ReleaseAgent
 *
 * Assesses release readiness, validates deployments, computes change impact,
 * drives GO/NO-GO decisions, and generates release notes — combining V1 LCIS,
 * graph blast radius, memory history, and real browser validation.
 *
 * @module ReleaseAgent
 */

import { AgentFramework } from './AgentFramework.mjs';
import GraphQueryEngine from '../graph-engine/GraphQueryEngine.mjs';
import BrowserIntelligenceEngine from '../browser-intelligence/BrowserIntelligenceEngine.mjs';
import MemoryRetriever from '../memory-engine/MemoryRetriever.mjs';

class ReleaseAgent extends AgentFramework {
  constructor() {
    super('ReleaseAgent', [
      'release-assessment',
      'deployment-validation',
      'change-impact',
      'go-no-go',
      'release-notes',
    ]);
  }

  // ── Public domain methods ─────────────────────────────────────────────────

  /**
   * Assess the risk and readiness of a branch or release tag.
   * Combines V1 LCIS blast radius, memory release history, and graph impact.
   * @param {string} branch  Git branch name or release tag
   * @returns {Promise<{
   *   blastRadius: unknown|null,
   *   graphImpact: string,
   *   releaseHistory: Array<object>,
   *   branch: string,
   * }>}
   */
  async assessRelease(branch) {
    this.log(`assessRelease: branch=${branch}`);

    const [blastResult, graphResult, histResult] = await Promise.allSettled([
      this.useLCISV1(`/api/blast?q=${encodeURIComponent(branch)}`),
      Promise.resolve(GraphQueryEngine.queryLocal(
        `What is the impact and blast radius of changes on branch "${branch}"? ` +
        `Which services, RPCs, tables, queues, workers, and merchants are affected?`
      )),
      MemoryRetriever.retrieve(
        `release ${branch} deployment migration change impact`,
        { collections: ['migrations', 'changelogs', 'architecture'], limit: 8, minScore: 0.2 }
      ),
    ]);

    return {
      blastRadius: blastResult.status === 'fulfilled' ? blastResult.value : null,
      graphImpact: graphResult.status === 'fulfilled' && graphResult.value?.success
        ? graphResult.value.answer
        : '',
      releaseHistory: histResult.status === 'fulfilled'
        ? histResult.value.map((h) => ({
            source: String(h.payload?.source ?? 'unknown'),
            text: String(h.payload?.text ?? '').slice(0, 300),
            score: h.score,
          }))
        : [],
      branch,
    };
  }

  /**
   * Validate a deployment by running real browser evidence capture against
   * the deployment URL.
   * @param {string} deploymentUrl
   * @returns {Promise<{
   *   evidence: unknown,
   *   deploymentUrl: string,
   *   validatedAt: string,
   * }>}
   */
  async validateDeployment(deploymentUrl) {
    this.log(`validateDeployment: url=${deploymentUrl}`);

    const label = `release-validate-${Date.now()}`;
    const evidence = await BrowserIntelligenceEngine.captureEvidence(deploymentUrl, label)
      .catch((err) => {
        this.log(`validateDeployment: browser failed — ${err.message}`, 'warn');
        return { status: 'NOT AVAILABLE', reason: err.message };
      });

    return { evidence, deploymentUrl, validatedAt: new Date().toISOString() };
  }

  /**
   * Compute the full change impact for a list of modified components.
   * Combines V1 LCIS change-impact endpoint with graph blast analysis.
   * @param {string[]} components  Array of component/symbol names that changed
   * @returns {Promise<{
   *   lcisImpact: unknown|null,
   *   graphImpacts: Array<{component:string,impact:string}>,
   *   affectedDomains: string[],
   * }>}
   */
  async getChangeImpact(components) {
    this.log(`getChangeImpact: components=${components.join(',')}`);

    const key = components.join(',');

    const [lcisResult, ...graphResults] = await Promise.allSettled([
      this.useLCISV1(`/api/change-impact?key=${encodeURIComponent(key)}`),
      ...components.slice(0, 5).map((c) =>
        Promise.resolve(GraphQueryEngine.getImpact(c))
      ),
    ]);

    const lcisImpact = lcisResult.status === 'fulfilled' ? lcisResult.value : null;

    const graphImpacts = graphResults.map((r, i) => ({
      component: components[i],
      impact: r.status === 'fulfilled' && r.value?.success ? r.value.answer : '',
    }));

    // Extract affected domains from LCIS response
    const affectedDomains = lcisImpact && Array.isArray(lcisImpact.affectedDomains)
      ? lcisImpact.affectedDomains
      : graphImpacts.flatMap((g) => g.impact
          .match(/\b(?:payments?|orders?|checkout|identity|themes?|merchants?|inventory)\b/gi) ?? [])
          .map((s) => s.toLowerCase())
          .filter((v, i, a) => a.indexOf(v) === i);

    return { lcisImpact, graphImpacts, affectedDomains };
  }

  /**
   * Run the GO/NO-GO assessment using V1 LCIS launch command center, memory
   * blockers, and graph critical-path analysis.
   * @returns {Promise<{
   *   verdict: 'GO'|'NO-GO'|'AT_RISK'|'UNKNOWN',
   *   launchCenter: unknown|null,
   *   memoryBlockers: Array<object>,
   *   graphCritical: string,
   * }>}
   */
  async goNoGo() {
    this.log('goNoGo');

    const [lcisResult, memResult, graphResult] = await Promise.allSettled([
      this.useLCISV1('/api/launch-command-center'),
      MemoryRetriever.retrieve('blocker launch readiness NO-GO risk critical', {
        collections: ['architecture', 'incidents', 'runbooks'],
        limit: 8,
        minScore: 0.25,
      }),
      Promise.resolve(GraphQueryEngine.queryLocal(
        'What are the critical blockers for production launch? ' +
        'What systems are not ready? What would cause a NO-GO decision?'
      )),
    ]);

    const launchCenter = lcisResult.status === 'fulfilled' ? lcisResult.value : null;
    const memBlockers = memResult.status === 'fulfilled'
      ? memResult.value.map((h) => ({
          source: String(h.payload?.source ?? 'unknown'),
          text: String(h.payload?.text ?? '').slice(0, 300),
          score: h.score,
        }))
      : [];
    const graphCritical = graphResult.status === 'fulfilled' && graphResult.value?.success
      ? graphResult.value.answer
      : '';

    // Derive verdict
    let verdict = 'UNKNOWN';
    if (launchCenter && typeof launchCenter === 'object') {
      if (launchCenter.verdict) {
        verdict = launchCenter.verdict;
      } else if (launchCenter.blockers && launchCenter.blockers.length > 0) {
        verdict = 'NO-GO';
      } else if (launchCenter.status === 'READY') {
        verdict = 'GO';
      }
    }
    if (verdict === 'UNKNOWN' && memBlockers.length > 0) {
      verdict = 'AT_RISK';
    }

    return { verdict, launchCenter, memoryBlockers: memBlockers, graphCritical };
  }

  /**
   * Generate release notes by querying memory changelog/migration collections
   * and the V1 LCIS time-travel endpoint.
   * @param {string} since  ISO date string or git ref to look back from
   * @returns {Promise<{
   *   changes: Array<object>,
   *   lcisTimeTravel: unknown|null,
   *   generatedAt: string,
   * }>}
   */
  async generateReleaseNotes(since) {
    this.log(`generateReleaseNotes: since=${since}`);

    const [memResult, lcisResult] = await Promise.allSettled([
      MemoryRetriever.retrieve(
        `changelog migration release deployment feature fix since ${since}`,
        {
          collections: ['migrations', 'changelogs', 'architecture'],
          limit: 15,
          minScore: 0.15,
        }
      ),
      this.useLCISV1(`/api/time-travel?since=${encodeURIComponent(since)}`),
    ]);

    const changes = memResult.status === 'fulfilled'
      ? memResult.value.map((h) => ({
          id: h.id,
          source: String(h.payload?.source ?? 'unknown'),
          text: String(h.payload?.text ?? '').slice(0, 400),
          collection: h.collection,
          score: h.score,
        }))
      : [];

    return {
      changes,
      lcisTimeTravel: lcisResult.status === 'fulfilled' ? lcisResult.value : null,
      generatedAt: new Date().toISOString(),
    };
  }
}

export default new ReleaseAgent();
