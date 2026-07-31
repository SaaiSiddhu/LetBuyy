/**
 * LCIS V2 — QueryRouter
 *
 * Classifies natural-language questions and routes them to the correct
 * subsystem agents + V1 LCIS endpoints, then assembles context payloads
 * that ResponseSynthesizer can merge into a unified answer.
 *
 * Zero external dependencies — node:url only for URLSearchParams.
 *
 * @module QueryRouter
 */

const LCIS_V1_URL = process.env.LCIS_V1_URL || 'http://localhost:3333';

// ---------------------------------------------------------------------------
// Classification rule table — ordered by priority (first match wins)
// ---------------------------------------------------------------------------
const RULES = [
  {
    keywords: ['what breaks', 'blast radius', 'impact', 'breaks if', 'depends on', 'dependency'],
    agent: 'operations',
    v1Paths: ['/api/blast', '/api/cross-domain', '/api/impact-score'],
    strategy: 'impact',
  },
  {
    keywords: ['runbook', 'recover', 'recovery', 'incident', 'root cause', 'diagnose', 'failing', 'failed', 'down'],
    agent: 'operations',
    v1Paths: ['/api/runbook', '/api/incident-control', '/api/diagnose', '/api/operations'],
    strategy: 'incident',
  },
  {
    keywords: ['launch', 'go live', 'ready', 'production ready', 'go-live', 'ship', 'release', 'deploy', 'blockers'],
    agent: 'release',
    v1Paths: ['/api/launch-command-center', '/api/production-readiness-v2', '/api/decision-v2'],
    strategy: 'release',
  },
  {
    keywords: ['security', 'rls', 'row level', 'policy', 'auth', 'oauth', 'jwt', 'token', 'attack', 'vulnerability', 'xss', 'injection'],
    agent: 'security',
    v1Paths: ['/api/security-intelligence', '/api/security', '/api/audit'],
    strategy: 'security',
  },
  {
    keywords: ['theme', 'liquid', 'template', 'storefront', 'render', 'preset', 'urban kicks', 'layout'],
    agent: 'theme',
    v1Paths: ['/api/domain?key=themes', '/api/theme-intelligence', '/api/explain?node=themes'],
    strategy: 'theme',
  },
  {
    keywords: ['merchant', 'store', 'tenant', 'seller', 'onboarding', 'subscription', 'plan', 'billing'],
    agent: 'merchant',
    v1Paths: ['/api/merchant-intelligence', '/api/merchant-health', '/api/merchant-ops'],
    strategy: 'merchant',
  },
  {
    keywords: ['payment', 'razorpay', 'checkout', 'order', 'refund', 'payout', 'gst', 'invoice', 'cod', 'money', 'ledger'],
    agent: 'operations',
    v1Paths: ['/api/payment', '/api/commerce-control', '/api/revenue-v2'],
    strategy: 'payment',
  },
  {
    keywords: ['architecture', 'how does', 'explain', 'what is', 'understand', 'onboard', 'overview', 'domain'],
    agent: 'knowledge',
    v1Paths: ['/api/explain', '/api/workspace', '/api/unified-intelligence'],
    strategy: 'explain',
  },
];

const DEFAULT_ROUTE = {
  agent: 'knowledge',
  v1Paths: ['/api/explain', '/api/search-v2'],
  strategy: 'general',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch a V1 endpoint with a short timeout (2 s).
 * Returns null on any failure — never throws.
 */
async function fetchV1(path, question) {
  try {
    const url = new URL(path, LCIS_V1_URL);
    // If the path has no query param but we have a question, append as q=
    if (question && !url.search.includes('q=')) {
      url.searchParams.set('q', question);
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 2000);
    const res = await fetch(url.toString(), { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// QueryRouter
// ---------------------------------------------------------------------------

class QueryRouter {
  /**
   * Classify a question and return routing metadata.
   * @param {string} question
   * @returns {{agent:string, v1Paths:string[], strategy:string}}
   */
  classifyQuestion(question) {
    const q = question.toLowerCase();
    for (const rule of RULES) {
      if (rule.keywords.some((kw) => q.includes(kw))) {
        return { agent: rule.agent, v1Paths: rule.v1Paths, strategy: rule.strategy };
      }
    }
    return { ...DEFAULT_ROUTE };
  }

  /**
   * Route question → {agent, endpoints, strategy, question}
   * @param {string} question
   * @returns {{agent:string, endpoints:string[], strategy:string, question:string}}
   */
  route(question) {
    const { agent, v1Paths, strategy } = this.classifyQuestion(question);
    return { agent, endpoints: v1Paths, strategy, question };
  }

  /**
   * Fetch relevant V1 context for a question (parallel, fail-safe).
   * @param {string} question
   * @returns {Promise<Array<{path:string, data:unknown}>>}
   */
  async assembleV1Context(question) {
    const { v1Paths } = this.classifyQuestion(question);

    const results = await Promise.allSettled(
      v1Paths.map(async (path) => {
        const data = await fetchV1(path, question);
        return { path, data };
      }),
    );

    return results
      .filter((r) => r.status === 'fulfilled' && r.value.data !== null)
      .map((r) => r.value);
  }

  /**
   * Assemble V2 context: memory retrieval + graph query.
   * Both are imported lazily to avoid boot-time failures.
   * @param {string} question
   * @param {string} agentType
   * @returns {Promise<{memory:unknown[], graph:unknown}>}
   */
  async assembleV2Context(question, agentType) {
    const [memory, graph] = await Promise.allSettled([
      (async () => {
        try {
          const { default: MemoryRetriever } = await import(
            '../memory-engine/MemoryRetriever.mjs'
          );
          return await MemoryRetriever.retrieve(question, { limit: 5 });
        } catch {
          return [];
        }
      })(),
      (async () => {
        try {
          const { default: GraphQueryEngine } = await import(
            '../graph-engine/GraphQueryEngine.mjs'
          );
          return GraphQueryEngine.query(question, 'global');
        } catch {
          return null;
        }
      })(),
    ]);

    return {
      memory: memory.status === 'fulfilled' ? memory.value : [],
      graph: graph.status === 'fulfilled' ? graph.value : null,
    };
  }

  /**
   * Build a composite prompt context object for downstream synthesis.
   * @param {string} question
   * @returns {Promise<{question:string, classification:object, v1:object[], v2:object}>}
   */
  async buildPromptContext(question) {
    const classification = this.classifyQuestion(question);
    const [v1, v2] = await Promise.all([
      this.assembleV1Context(question),
      this.assembleV2Context(question, classification.agent),
    ]);
    return { question, classification, v1, v2 };
  }
}

export default new QueryRouter();
