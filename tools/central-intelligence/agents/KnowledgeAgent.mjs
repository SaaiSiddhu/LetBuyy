/**
 * LCIS V2 — KnowledgeAgent
 *
 * Answers documentation, architecture, runbook, security, and change-history
 * questions by combining MemoryRetriever + V1 LCIS endpoints.
 *
 * @module KnowledgeAgent
 */

import { AgentFramework } from './AgentFramework.mjs';
import MemoryRetriever from '../memory-engine/MemoryRetriever.mjs';

class KnowledgeAgent extends AgentFramework {
  constructor() {
    super('KnowledgeAgent', [
      'runbook-lookup',
      'architecture-query',
      'security-docs',
      'documentation-qa',
      'change-history',
    ]);
  }

  // ── Public domain methods ─────────────────────────────────────────────────

  /**
   * Find the runbook for a domain from memory and V1 LCIS.
   * @param {string} domain
   * @returns {Promise<{
   *   memoryRunbook: {content:string,source:string,score:number}|null,
   *   lcisRunbook: unknown|null,
   *   sources: string[],
   * }>}
   */
  async findRunbook(domain) {
    this.log(`findRunbook: domain=${domain}`);

    const [memRunbook, lcisRunbook] = await Promise.allSettled([
      MemoryRetriever.retrieveRunbook(domain),
      this.useLCISV1(`/api/runbook?domain=${encodeURIComponent(domain)}`),
    ]);

    const memResult = memRunbook.status === 'fulfilled'
      ? memRunbook.value
      : (this.log(`findRunbook: memory failed — ${memRunbook.reason?.message}`, 'warn'), null);

    const lcisResult = lcisRunbook.status === 'fulfilled'
      ? lcisRunbook.value
      : (this.log(`findRunbook: lcis failed — ${lcisRunbook.reason?.message}`, 'warn'), null);

    const sources = [];
    if (memResult) sources.push(memResult.source);
    if (lcisResult) sources.push(`${process.env.LCIS_V1_URL || 'http://localhost:3333'}/api/runbook?domain=${domain}`);

    return { memoryRunbook: memResult, lcisRunbook: lcisResult, sources };
  }

  /**
   * Find architecture documentation for a topic.
   * @param {string} topic
   * @returns {Promise<{hits: Array<object>, graphAnswer: string, lcisAnswer: unknown|null}>}
   */
  async findArchitecture(topic) {
    this.log(`findArchitecture: topic=${topic}`);

    const [hitsResult, graphResult, lcisResult] = await Promise.allSettled([
      MemoryRetriever.retrieve(`${topic} architecture design pattern service`, {
        collections: ['architecture', 'docs'],
        limit: 8,
        minScore: 0.25,
      }),
      Promise.resolve(this.useGraph(`What is the architecture of ${topic}? How is it designed?`)),
      this.useLCISV1(`/api/explain?node=${encodeURIComponent(topic)}`),
    ]);

    return {
      hits: hitsResult.status === 'fulfilled' ? hitsResult.value : [],
      graphAnswer: graphResult.status === 'fulfilled' && graphResult.value?.success
        ? graphResult.value.answer
        : '',
      lcisAnswer: lcisResult.status === 'fulfilled' ? lcisResult.value : null,
    };
  }

  /**
   * Find security documentation for a component.
   * @param {string} component
   * @returns {Promise<{hits: Array<object>, summary: string, lcisAnswer: unknown|null}>}
   */
  async findSecurity(component) {
    this.log(`findSecurity: component=${component}`);

    const [secCtxResult, lcisResult] = await Promise.allSettled([
      MemoryRetriever.retrieveSecurityContext(component),
      this.useLCISV1(`/api/security-intelligence`),
    ]);

    const secCtx = secCtxResult.status === 'fulfilled'
      ? secCtxResult.value
      : { hits: [], summary: '' };

    return {
      hits: secCtx.hits,
      summary: secCtx.summary,
      lcisAnswer: lcisResult.status === 'fulfilled' ? lcisResult.value : null,
    };
  }

  /**
   * Answer a general documentation question.
   * @param {string} question
   * @returns {Promise<AgentResponse>}
   */
  async answerDocQuestion(question) {
    this.log(`answerDocQuestion: ${question}`);
    return this.execute(question);
  }

  /**
   * Return what changed for a domain since a given date or ref.
   * Queries memory change-history collection + V1 LCIS time-travel endpoint.
   * @param {string} domain
   * @param {string} since  ISO date string or git ref
   * @returns {Promise<{changes: Array<object>, lcisTimeTravel: unknown|null}>}
   */
  async whatChanged(domain, since) {
    this.log(`whatChanged: domain=${domain} since=${since}`);

    const [memResult, lcisResult] = await Promise.allSettled([
      MemoryRetriever.retrieve(
        `${domain} change migration release deployment since ${since}`,
        { collections: ['migrations', 'changelogs', 'architecture'], limit: 10, minScore: 0.2 }
      ),
      this.useLCISV1(`/api/time-travel?domain=${encodeURIComponent(domain)}&since=${encodeURIComponent(since)}`),
    ]);

    return {
      changes: memResult.status === 'fulfilled' ? memResult.value : [],
      lcisTimeTravel: lcisResult.status === 'fulfilled' ? lcisResult.value : null,
    };
  }
}

export default new KnowledgeAgent();
