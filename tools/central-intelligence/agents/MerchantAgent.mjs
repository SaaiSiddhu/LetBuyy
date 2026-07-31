/**
 * LCIS V2 — MerchantAgent
 *
 * Assesses merchant health, risk, theme status, and store validation by
 * combining graph intelligence, V1 LCIS merchant endpoints, and real browser
 * validation.
 *
 * @module MerchantAgent
 */

import { AgentFramework } from './AgentFramework.mjs';
import GraphQueryEngine from '../graph-engine/GraphQueryEngine.mjs';
import BrowserIntelligenceEngine from '../browser-intelligence/BrowserIntelligenceEngine.mjs';
import MemoryRetriever from '../memory-engine/MemoryRetriever.mjs';

class MerchantAgent extends AgentFramework {
  constructor() {
    super('MerchantAgent', [
      'merchant-health',
      'store-validation',
      'merchant-risk',
      'theme-status',
      'theme-comparison',
    ]);
  }

  // ── Public domain methods ─────────────────────────────────────────────────

  /**
   * Get the health score and key indicators for a merchant site.
   * Combines graph topology, V1 LCIS merchant-health endpoint, and memory docs.
   * @param {string} siteId
   * @returns {Promise<{
   *   graphHealth: string,
   *   lcisHealth: unknown|null,
   *   memoryContext: string,
   *   siteId: string,
   * }>}
   */
  async getMerchantHealth(siteId) {
    this.log(`getMerchantHealth: siteId=${siteId}`);

    const [graphResult, lcisResult, memResult] = await Promise.allSettled([
      Promise.resolve(GraphQueryEngine.queryLocal(
        `What is the health, status, and availability of merchant site ${siteId}? ` +
        `What services, workers, and queues are running for this tenant?`
      )),
      this.useLCISV1(`/api/merchant-health?siteId=${encodeURIComponent(siteId)}`),
      MemoryRetriever.retrieve(`merchant ${siteId} health status availability tenant`, {
        limit: 5,
        minScore: 0.2,
      }),
    ]);

    const graphHealth = graphResult.status === 'fulfilled' && graphResult.value?.success
      ? graphResult.value.answer
      : '';

    const lcisHealth = lcisResult.status === 'fulfilled' ? lcisResult.value : null;

    const memCtx = memResult.status === 'fulfilled'
      ? memResult.value.map((h) => String(h.payload?.text ?? '').slice(0, 200)).join('\n')
      : '';

    return { graphHealth, lcisHealth, memoryContext: memCtx, siteId };
  }

  /**
   * Validate a store URL using the BrowserIntelligenceEngine and return a
   * structured report.
   * @param {string} storeUrl
   * @returns {Promise<{
   *   evidence: unknown,
   *   storeUrl: string,
   *   timestamp: string,
   * }>}
   */
  async getStoreValidation(storeUrl) {
    this.log(`getStoreValidation: storeUrl=${storeUrl}`);

    const label = `merchant-validate-${Date.now()}`;
    const evidence = await BrowserIntelligenceEngine.captureEvidence(storeUrl, label)
      .catch((err) => {
        this.log(`getStoreValidation: browser failed — ${err.message}`, 'warn');
        return { status: 'NOT AVAILABLE', reason: err.message };
      });

    return { evidence, storeUrl, timestamp: new Date().toISOString() };
  }

  /**
   * Assess the risk profile of a merchant site.
   * @param {string} siteId
   * @returns {Promise<{
   *   lcisRisk: unknown|null,
   *   graphRisk: string,
   *   memoryRisk: Array<object>,
   *   riskLevel: 'LOW'|'MEDIUM'|'HIGH'|'CRITICAL'|'UNKNOWN',
   * }>}
   */
  async getMerchantRisk(siteId) {
    this.log(`getMerchantRisk: siteId=${siteId}`);

    const [lcisResult, graphResult, memResult] = await Promise.allSettled([
      this.useLCISV1(`/api/merchant-risk?siteId=${encodeURIComponent(siteId)}`),
      Promise.resolve(GraphQueryEngine.queryLocal(
        `What are the risks, failure modes, and vulnerabilities for merchant site ${siteId}?`
      )),
      MemoryRetriever.retrieve(`merchant ${siteId} risk fraud payment failure`, {
        collections: ['incidents', 'security'],
        limit: 6,
        minScore: 0.2,
      }),
    ]);

    const lcisRisk = lcisResult.status === 'fulfilled' ? lcisResult.value : null;
    const graphRisk = graphResult.status === 'fulfilled' && graphResult.value?.success
      ? graphResult.value.answer
      : '';
    const memRisk = memResult.status === 'fulfilled'
      ? memResult.value.map((h) => ({
          source: String(h.payload?.source ?? 'unknown'),
          text: String(h.payload?.text ?? '').slice(0, 300),
          score: h.score,
        }))
      : [];

    // Derive risk level from available signals
    let riskLevel = 'UNKNOWN';
    if (lcisRisk && typeof lcisRisk === 'object' && lcisRisk.riskLevel) {
      riskLevel = lcisRisk.riskLevel;
    } else {
      const topScore = memRisk.length > 0 ? Math.max(...memRisk.map((h) => h.score)) : 0;
      riskLevel = topScore >= 0.7 ? 'HIGH' : topScore >= 0.4 ? 'MEDIUM' : graphRisk ? 'LOW' : 'UNKNOWN';
    }

    return { lcisRisk, graphRisk, memoryRisk: memRisk, riskLevel };
  }

  /**
   * Get the current theme status for a store URL.
   * Uses browser validation and V1 LCIS theme intelligence.
   * @param {string} storeUrl
   * @returns {Promise<{
   *   browserTheme: unknown,
   *   lcisTheme: unknown|null,
   *   storeUrl: string,
   * }>}
   */
  async getThemeStatus(storeUrl) {
    this.log(`getThemeStatus: storeUrl=${storeUrl}`);

    // Lazy import to avoid circular — browser ThemeAgent is the browser layer
    const [browserResult, lcisResult] = await Promise.allSettled([
      import('../browser-intelligence/agents/ThemeAgent.mjs').then(
        (m) => m.default.validateRendering(storeUrl)
      ),
      this.useLCISV1('/api/theme-intelligence'),
    ]);

    return {
      browserTheme: browserResult.status === 'fulfilled'
        ? browserResult.value
        : { status: 'NOT AVAILABLE', reason: browserResult.reason?.message },
      lcisTheme: lcisResult.status === 'fulfilled' ? lcisResult.value : null,
      storeUrl,
    };
  }

  /**
   * Compare the theme rendering and characteristics of two store URLs.
   * @param {string} storeUrl1
   * @param {string} storeUrl2
   * @returns {Promise<{
   *   store1: object,
   *   store2: object,
   *   differences: string[],
   * }>}
   */
  async compareThemes(storeUrl1, storeUrl2) {
    this.log(`compareThemes: ${storeUrl1} vs ${storeUrl2}`);

    const [result1, result2] = await Promise.allSettled([
      this.getThemeStatus(storeUrl1),
      this.getThemeStatus(storeUrl2),
    ]);

    const store1 = result1.status === 'fulfilled' ? result1.value : { error: result1.reason?.message };
    const store2 = result2.status === 'fulfilled' ? result2.value : { error: result2.reason?.message };

    // Surface-level structural diff on the browser result keys
    const differences = [];
    const b1 = store1.browserTheme ?? {};
    const b2 = store2.browserTheme ?? {};
    const allKeys = new Set([...Object.keys(b1), ...Object.keys(b2)]);
    for (const key of allKeys) {
      const v1 = JSON.stringify(b1[key] ?? null);
      const v2 = JSON.stringify(b2[key] ?? null);
      if (v1 !== v2) {
        differences.push(`${key}: store1=${v1.slice(0, 100)} | store2=${v2.slice(0, 100)}`);
      }
    }

    return { store1, store2, differences };
  }
}

export default new MerchantAgent();
