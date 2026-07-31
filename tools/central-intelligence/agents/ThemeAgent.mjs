/**
 * LCIS V2 — ThemeAgent (LCIS orchestration layer)
 *
 * DISTINCT from browser-intelligence/agents/ThemeAgent.mjs — this agent
 * orchestrates across memory docs, V1 LCIS theme intelligence, and the browser
 * ThemeAgent for a complete theme intelligence picture.
 *
 * @module ThemeAgent
 */

import { AgentFramework } from './AgentFramework.mjs';
import MemoryRetriever from '../memory-engine/MemoryRetriever.mjs';
import GraphQueryEngine from '../graph-engine/GraphQueryEngine.mjs';

class ThemeAgent extends AgentFramework {
  constructor() {
    super('ThemeAgent', [
      'theme-validation',
      'theme-documentation',
      'theme-version-diff',
      'liquid-issues',
    ]);
  }

  // ── Lazy browser ThemeAgent accessor ────────────────────────────────────

  /**
   * Returns the browser-intelligence ThemeAgent singleton.
   * Lazy import prevents circular dependencies at module load time.
   * @returns {Promise<import('../browser-intelligence/agents/ThemeAgent.mjs').default>}
   */
  async _getBrowserThemeAgent() {
    const mod = await import('../browser-intelligence/agents/ThemeAgent.mjs');
    return mod.default;
  }

  // ── Public domain methods ─────────────────────────────────────────────────

  /**
   * Validate a theme by combining browser rendering checks, memory theme docs,
   * and V1 LCIS theme intelligence.
   * @param {string} themeId    Theme identifier (slug or ID)
   * @param {string} storeUrl   Store URL to validate rendering against
   * @returns {Promise<{
   *   browserValidation: unknown,
   *   memoryDocs: Array<object>,
   *   lcisTheme: unknown|null,
   *   themeId: string,
   *   storeUrl: string,
   * }>}
   */
  async validateTheme(themeId, storeUrl) {
    this.log(`validateTheme: themeId=${themeId} storeUrl=${storeUrl}`);

    const [browserAgent, memResult, lcisResult] = await Promise.allSettled([
      this._getBrowserThemeAgent(),
      MemoryRetriever.retrieve(
        `theme ${themeId} validation rendering Liquid React layout tokens`,
        { limit: 8, minScore: 0.2 }
      ),
      this.useLCISV1(`/api/domain?key=themes`),
    ]);

    // Run browser validation if browser agent loaded
    let browserValidation = { status: 'NOT AVAILABLE', reason: 'browser agent failed to load' };
    if (browserAgent.status === 'fulfilled') {
      browserValidation = await browserAgent.value.validateRendering(storeUrl).catch((err) => ({
        status: 'NOT AVAILABLE',
        reason: err.message,
      }));
    } else {
      this.log(`validateTheme: browser agent load failed — ${browserAgent.reason?.message}`, 'warn');
    }

    const memoryDocs = memResult.status === 'fulfilled'
      ? memResult.value.map((h) => ({
          source: String(h.payload?.source ?? 'unknown'),
          text: String(h.payload?.text ?? '').slice(0, 350),
          score: h.score,
        }))
      : [];

    return {
      browserValidation,
      memoryDocs,
      lcisTheme: lcisResult.status === 'fulfilled' ? lcisResult.value : null,
      themeId,
      storeUrl,
    };
  }

  /**
   * Return documentation for a theme from memory and V1 LCIS.
   * @param {string} themeId
   * @returns {Promise<{
   *   docs: Array<object>,
   *   lcisThemeDomain: unknown|null,
   *   graphDescription: string,
   * }>}
   */
  async getThemeDocumentation(themeId) {
    this.log(`getThemeDocumentation: themeId=${themeId}`);

    const [memResult, lcisResult, graphResult] = await Promise.allSettled([
      MemoryRetriever.retrieve(
        `theme ${themeId} documentation design tokens preset sections Liquid`,
        { limit: 12, minScore: 0.2 }
      ),
      this.useLCISV1('/api/theme-intelligence'),
      Promise.resolve(GraphQueryEngine.queryLocal(
        `Describe theme ${themeId}: its purpose, design tokens, Liquid sections, ` +
        `preset options, and which stores use it.`
      )),
    ]);

    return {
      docs: memResult.status === 'fulfilled'
        ? memResult.value.map((h) => ({
            source: String(h.payload?.source ?? 'unknown'),
            text: String(h.payload?.text ?? '').slice(0, 500),
            score: h.score,
          }))
        : [],
      lcisThemeDomain: lcisResult.status === 'fulfilled' ? lcisResult.value : null,
      graphDescription: graphResult.status === 'fulfilled' && graphResult.value?.success
        ? graphResult.value.answer
        : '',
    };
  }

  /**
   * Diff two theme versions by querying memory for both versions and
   * surfacing structural differences.
   * @param {string} v1  Version identifier (e.g. '1.0.0' or git ref)
   * @param {string} v2  Version identifier (e.g. '2.0.0' or git ref)
   * @returns {Promise<{
   *   v1Docs: Array<object>,
   *   v2Docs: Array<object>,
   *   differences: string[],
   * }>}
   */
  async compareThemeVersions(v1, v2) {
    this.log(`compareThemeVersions: v1=${v1} v2=${v2}`);

    const [v1Result, v2Result] = await Promise.allSettled([
      MemoryRetriever.retrieve(
        `theme version ${v1} changelog migration changes`,
        { limit: 6, minScore: 0.15 }
      ),
      MemoryRetriever.retrieve(
        `theme version ${v2} changelog migration changes`,
        { limit: 6, minScore: 0.15 }
      ),
    ]);

    const v1Docs = v1Result.status === 'fulfilled'
      ? v1Result.value.map((h) => ({
          source: String(h.payload?.source ?? 'unknown'),
          text: String(h.payload?.text ?? '').slice(0, 400),
          score: h.score,
        }))
      : [];

    const v2Docs = v2Result.status === 'fulfilled'
      ? v2Result.value.map((h) => ({
          source: String(h.payload?.source ?? 'unknown'),
          text: String(h.payload?.text ?? '').slice(0, 400),
          score: h.score,
        }))
      : [];

    // Surface-level source diff
    const v1Sources = new Set(v1Docs.map((d) => d.source));
    const v2Sources = new Set(v2Docs.map((d) => d.source));
    const differences = [];
    for (const s of v2Sources) {
      if (!v1Sources.has(s)) differences.push(`NEW in v${v2}: ${s}`);
    }
    for (const s of v1Sources) {
      if (!v2Sources.has(s)) differences.push(`REMOVED in v${v2} (was in v${v1}): ${s}`);
    }
    if (differences.length === 0) {
      differences.push(`No structural document differences detected between ${v1} and ${v2}`);
    }

    return { v1Docs, v2Docs, differences };
  }

  /**
   * Find known Liquid template issues for a theme by querying V1 LCIS and
   * memory for Liquid-specific problems.
   * @param {string} themeId
   * @returns {Promise<{
   *   lcisThemeDomain: unknown|null,
   *   liquidIssues: Array<object>,
   *   graphIssues: string,
   * }>}
   */
  async getLiquidIssues(themeId) {
    this.log(`getLiquidIssues: themeId=${themeId}`);

    const [lcisResult, memResult, graphResult] = await Promise.allSettled([
      this.useLCISV1(`/api/domain?key=themes`),
      MemoryRetriever.retrieve(
        `Liquid template issue error ${themeId} sanitizer escape XSS forbid render`,
        { collections: ['security', 'architecture'], limit: 8, minScore: 0.2 }
      ),
      Promise.resolve(GraphQueryEngine.queryLocal(
        `What Liquid template issues, security problems, or rendering errors exist for theme ${themeId}?`
      )),
    ]);

    return {
      lcisThemeDomain: lcisResult.status === 'fulfilled' ? lcisResult.value : null,
      liquidIssues: memResult.status === 'fulfilled'
        ? memResult.value.map((h) => ({
            source: String(h.payload?.source ?? 'unknown'),
            text: String(h.payload?.text ?? '').slice(0, 400),
            score: h.score,
          }))
        : [],
      graphIssues: graphResult.status === 'fulfilled' && graphResult.value?.success
        ? graphResult.value.answer
        : '',
    };
  }
}

export default new ThemeAgent();
