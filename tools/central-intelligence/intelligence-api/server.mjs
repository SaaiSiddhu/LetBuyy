/**
 * LCIS V2 — Intelligence API Server
 *
 * Unified Intelligence API on port 3334.
 * Integrates V1 LCIS (http://localhost:3333) with all Batch-1 V2 subsystems.
 *
 * Zero external dependencies — node:http, node:url, node:path, node:fs only.
 *
 * @module intelligence-api/server
 */

import http from 'node:http';
import { URL } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..', '..', '..');

const PORT = Number(process.env.LCIS_V2_PORT) || 3334;
const LCIS_V1_URL = process.env.LCIS_V1_URL || 'http://localhost:3333';

// CORS allowed origins
const ALLOWED_ORIGINS = new Set([
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3333',
  'http://localhost:3334',
]);

// ---------------------------------------------------------------------------
// Lazy subsystem loader (never throws at import time)
// ---------------------------------------------------------------------------

const cache = new Map();

async function loadModule(relPath) {
  if (cache.has(relPath)) return cache.get(relPath);
  try {
    const mod = await import(relPath);
    const resolved = mod.default ?? mod;
    cache.set(relPath, resolved);
    return resolved;
  } catch (err) {
    console.warn(`[LCIS-V2] Module unavailable: ${relPath} — ${err.message}`);
    return null;
  }
}

// Convenience wrappers
const mem = () => loadModule('../memory-engine/MemoryRetriever.mjs');
const pip = () => loadModule('../memory-engine/MemoryIngestionPipeline.mjs');
const mhm = () => loadModule('../memory-engine/MemoryHealthMonitor.mjs');
const kas = () => loadModule('../knowledge-engine/KnowledgeAcquisitionService.mjs');
const ksr = () => loadModule('../knowledge-engine/KnowledgeSourceRegistry.mjs');
const kfs = () => loadModule('../knowledge-engine/KnowledgeFreshnessService.mjs');
const gqe = () => loadModule('../graph-engine/GraphQueryEngine.mjs');
const gex = () => loadModule('../graph-engine/GraphExplorer.mjs');
const gdi = () => loadModule('../graph-engine/GraphDiagnostics.mjs');
const bie = () => loadModule('../browser-intelligence/BrowserIntelligenceEngine.mjs');
const bta = () => loadModule('../browser-intelligence/agents/ThemeAgent.mjs');
const bca = () => loadModule('../browser-intelligence/agents/CheckoutAgent.mjs');
const hss = () => loadModule('../observability/HealthService.mjs');
const ads = () => loadModule('../observability/AnomalyDetectionService.mjs');

// V2 subsystem lazy loaders
const ctx  = () => loadModule('../context-intelligence/ContextAssembler.mjs');
const ccp  = () => loadModule('../context-intelligence/ContextCompressionPipeline.mjs');
const cdi  = () => loadModule('../context-intelligence/ContextDiagnostics.mjs');
const aie  = () => loadModule('../architecture-intelligence/ArchitectureIntelligenceEngine.mjs');
const rse  = () => loadModule('../reasoning/ReasoningEngine.mjs');
const ice  = () => loadModule('../correlation/IntelligenceCorrelationEngine.mjs');
const ore  = () => loadModule('../autonomous-operations/OperationsReasoningEngine.mjs');
const irg  = () => loadModule('../autonomous-operations/IntelligenceReportGenerator.mjs');
const smb  = () => loadModule('../self-model/SelfModelBuilder.mjs');
const pex  = () => loadModule('../self-model/PlatformExplainer.mjs');

// V3 Executive subsystem lazy loaders
const exe_intel  = () => loadModule('../executive-intelligence/ExecutiveIntelligenceEngine.mjs');
const goal_eng   = () => loadModule('../goal-engine/GoalEngine.mjs');
const mission_eng= () => loadModule('../goal-engine/MissionEngine.mjs');
const pred_eng   = () => loadModule('../prediction-engine/PredictionEngine.mjs');
const rec_eng    = () => loadModule('../recommendation-engine/ExecutiveRecommendationEngine.mjs');
const inv_eng    = () => loadModule('../investigation-engine/InvestigationEngine.mjs');
const orch_eng   = () => loadModule('../orchestration-engine/OrchestrationEngine.mjs');
const exec_eng   = () => loadModule('../execution-engine/ExecutionEngine.mjs');
const act_reg    = () => loadModule('../execution-engine/ActionRegistry.mjs');
const ver_eng    = () => loadModule('../verification-engine/VerificationEngine.mjs');
const daily_sys  = () => loadModule('../daily-intelligence/DailyIntelligenceSystem.mjs');
const exec_sum   = () => loadModule('../daily-intelligence/ExecutiveSummaryGenerator.mjs');
const loop_eng   = () => loadModule('../operating-loop/LCISOperatingLoop.mjs');

// Dynamic agent loader — these may not exist yet
const AGENT_MAP = {
  knowledge:  () => loadModule('../agents/KnowledgeAgent.mjs'),
  security:   () => loadModule('../agents/SecurityAgent.mjs'),
  operations: () => loadModule('../agents/OperationsAgent.mjs'),
  merchant:   () => loadModule('../agents/MerchantAgent.mjs'),
  release:    () => loadModule('../agents/ReleaseAgent.mjs'),
};

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function cors(res, origin) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : 'http://localhost:3333';
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Max-Age', '86400');
}

// Circular-safe serializer — a single bad endpoint (circular ref, BigInt, etc.)
// must never throw out of json() and crash the process.
function safeStringify(obj) {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'bigint') return value.toString();
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return '[Circular]';
      seen.add(value);
    }
    return value;
  }, 2);
}

function json(res, obj, status = 200) {
  // Never write headers twice — if the response was already started (e.g. an
  // error after a partial write), silently no-op instead of throwing
  // ERR_HTTP_HEADERS_SENT and taking down the whole server.
  if (res.headersSent || res.writableEnded) return;
  let body;
  try {
    body = safeStringify(obj);
  } catch (e) {
    body = `{"error":"serialization failed","detail":${JSON.stringify(String((e && e.message) || e))}}`;
    status = 500;
  }
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body);
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch (e) {
        reject(e);
      }
    });
    req.on('error', reject);
  });
}

function qp(u, name, fallback = undefined) {
  return u.searchParams.get(name) ?? fallback;
}

/** Fetch a V1 endpoint, returns parsed JSON or error object. */
async function fetchV1(path) {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`${LCIS_V1_URL}${path}`, { signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) return { error: `V1 HTTP ${res.status}`, path };
    return await res.json();
  } catch (err) {
    return { error: `V1 unavailable: ${err.message}`, path };
  }
}

// ---------------------------------------------------------------------------
// All registered endpoints — used for 404 fallback and startup log
// ---------------------------------------------------------------------------
const ENDPOINTS = [
  // ── V1 subsystems ──────────────────────────────────────────────────────────
  'GET  /intelligence/health',
  'GET  /intelligence/status',
  'GET  /intelligence/memory/search?q=&collection=&limit=',
  'POST /intelligence/memory/ingest',
  'GET  /intelligence/memory/health',
  'GET  /intelligence/memory/stats',
  'GET  /intelligence/knowledge/search?q=',
  'POST /intelligence/knowledge/crawl',
  'GET  /intelligence/knowledge/sources',
  'GET  /intelligence/knowledge/freshness',
  'GET  /intelligence/graph/query?q=&method=',
  'GET  /intelligence/graph/impact?entity=',
  'GET  /intelligence/graph/entities?name=',
  'GET  /intelligence/graph/health',
  'GET  /intelligence/browser/validate?url=',
  'GET  /intelligence/browser/theme?url=&themeId=',
  'GET  /intelligence/browser/checkout?url=',
  'GET  /intelligence/browser/status',
  'GET  /intelligence/observability/health',
  'GET  /intelligence/observability/incidents',
  'GET  /intelligence/observability/anomalies',
  'GET  /intelligence/agents/execute?agent=&q=',
  'GET  /intelligence/agents/status',
  'GET  /intelligence/ask?q=',
  // ── V2 Context Intelligence ────────────────────────────────────────────────
  'GET  /intelligence/context/assemble?q=&budget=',
  'GET  /intelligence/context/map',
  'POST /intelligence/context/build',
  'GET  /intelligence/context/health',
  'GET  /intelligence/context/compression',
  // ── V2 Architecture Intelligence ───────────────────────────────────────────
  'GET  /intelligence/architecture',
  'GET  /intelligence/architecture/drift',
  'GET  /intelligence/architecture/risks',
  'GET  /intelligence/architecture/depends?component=',
  // ── V2 Reasoning Engine ────────────────────────────────────────────────────
  'GET  /intelligence/reason?q=',
  'GET  /intelligence/reason/why?incident=',
  'GET  /intelligence/reason/affected?component=',
  'GET  /intelligence/reason/risk-dependency',
  // ── V2 Correlation Engine ──────────────────────────────────────────────────
  'POST /intelligence/correlate',
  'GET  /intelligence/correlate/root-cause?domain=',
  'GET  /intelligence/correlate/impact?component=',
  'GET  /intelligence/correlate/risk?target=',
  // ── V2 Autonomous Operations ───────────────────────────────────────────────
  'GET  /intelligence/operations/assess',
  'GET  /intelligence/operations/recommendations',
  'GET  /intelligence/operations/insights',
  'GET  /intelligence/operations/daily',
  'POST /intelligence/operations/daily',
  // ── V2 Self Model ──────────────────────────────────────────────────────────
  'GET  /intelligence/self/model',
  'POST /intelligence/self/build',
  'GET  /intelligence/self/explain?topic=',
  // ── V2 Command Center ─────────────────────────────────────────────────────
  'GET  /intelligence/command-center',
  // ── V3 Executive Intelligence ──────────────────────────────────────────────
  'GET  /intelligence/executive/briefing',
  'GET  /intelligence/executive/next',
  'POST /intelligence/executive/decide',
  'POST /intelligence/executive/plan',
  'GET  /intelligence/executive/synthesize?topic=',
  // ── V3 Goals & Missions ───────────────────────────────────────────────────
  'GET  /intelligence/goals?category=',
  'GET  /intelligence/goals/at-risk',
  'GET  /intelligence/missions',
  // ── V3 Predictions ────────────────────────────────────────────────────────
  'GET  /intelligence/predict?target=',
  'GET  /intelligence/predict/all',
  'GET  /intelligence/predict/incidents',
  // ── V3 Recommendations ────────────────────────────────────────────────────
  'GET  /intelligence/recommend',
  'GET  /intelligence/recommend/domain?domain=engineering|operational|security|architecture|merchant',
  // ── V3 Investigation ──────────────────────────────────────────────────────
  'GET  /intelligence/investigate/domain?domain=',
  'POST /intelligence/investigate',
  // ── V3 Orchestration ──────────────────────────────────────────────────────
  'GET  /intelligence/orchestrate/health',
  'GET  /intelligence/orchestrate/risk',
  'GET  /intelligence/orchestrate/architecture',
  'GET  /intelligence/orchestrate/workflows',
  // ── V3 Execution ──────────────────────────────────────────────────────────
  'POST /intelligence/execute',
  'GET  /intelligence/execute/actions',
  'GET  /intelligence/execute/audit',
  // ── V3 Verification ───────────────────────────────────────────────────────
  'POST /intelligence/verify',
  'GET  /intelligence/verify/report',
  // ── V3 Daily Briefings ────────────────────────────────────────────────────
  'GET  /intelligence/brief/daily',
  'POST /intelligence/brief/generate',
  'GET  /intelligence/brief/executive',
  // ── V3 Operating Loop ─────────────────────────────────────────────────────
  'GET  /intelligence/loop/state',
  'POST /intelligence/loop/run-once',
  'GET  /intelligence/loop/history',
];

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

async function handleRequest(req, res) {
  const origin = req.headers.origin;
  cors(res, origin);

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const u = new URL(req.url, `http://localhost:${PORT}`);
  const path = u.pathname;
  const method = req.method;

  // Wrap every handler in a unified try/catch
  try {
    // ── Health ─────────────────────────────────────────────────────────────
    if (path === '/intelligence/health' && method === 'GET') {
      const hs = await hss();
      const health = hs ? await hs.getHealth() : { status: 'HealthService unavailable' };
      return json(res, health);
    }

    // ── Status ─────────────────────────────────────────────────────────────
    if (path === '/intelligence/status' && method === 'GET') {
      const [hs, gd, mhm_] = await Promise.all([hss(), gdi(), mhm()]);

      const [hsHealth, gdHealth, memHealth, v1Stats] = await Promise.allSettled([
        hs ? hs.getHealth() : Promise.resolve({ status: 'unavailable' }),
        gd ? gd.getHealth() : Promise.resolve({ status: 'unavailable' }),
        mhm_ ? mhm_.getHealth() : Promise.resolve({ status: 'unavailable' }),
        fetchV1('/api/stats'),
      ]);

      return json(res, {
        version: '2.0',
        port: PORT,
        layers: [
          { name: 'memory-engine',      status: hsHealth.value?.memory ?? 'unknown' },
          { name: 'knowledge-engine',   status: 'loaded' },
          { name: 'graph-engine',       status: gdHealth.value?.status ?? 'unknown' },
          { name: 'browser-intelligence', status: 'loaded' },
          { name: 'observability',      status: hsHealth.value?.status ?? 'unknown' },
          { name: 'agents',             status: 'lazy-loaded' },
        ],
        v1: v1Stats.value ?? { status: 'V1 NOT RUNNING' },
        timestamp: new Date().toISOString(),
      });
    }

    // ── Memory ─────────────────────────────────────────────────────────────
    if (path === '/intelligence/memory/search' && method === 'GET') {
      const retriever = await mem();
      if (!retriever) return json(res, { error: 'MemoryRetriever unavailable' }, 503);
      const q = qp(u, 'q', '');
      const collection = qp(u, 'collection');
      const limit = Number(qp(u, 'limit', '10'));
      const results = await retriever.retrieve(q, {
        collections: collection ? [collection] : undefined,
        limit,
      });
      return json(res, { query: q, results, count: results.length });
    }

    if (path === '/intelligence/memory/ingest' && method === 'POST') {
      const body = await readBody(req);
      const pipeline = await pip();
      if (!pipeline) return json(res, { error: 'MemoryIngestionPipeline unavailable' }, 503);
      const result = await pipeline.runFromText(
        body.text,
        body.collection || 'knowledge',
        body.metadata || {},
      );
      return json(res, { ingested: true, result });
    }

    if (path === '/intelligence/memory/health' && method === 'GET') {
      const monitor = await mhm();
      if (!monitor) return json(res, { error: 'MemoryHealthMonitor unavailable' }, 503);
      return json(res, await monitor.getHealth());
    }

    if (path === '/intelligence/memory/stats' && method === 'GET') {
      const monitor = await mhm();
      if (!monitor) return json(res, { error: 'MemoryHealthMonitor unavailable' }, 503);
      return json(res, await monitor.getMetrics());
    }

    // ── Knowledge ──────────────────────────────────────────────────────────
    if (path === '/intelligence/knowledge/search' && method === 'GET') {
      const retriever = await mem();
      if (!retriever) return json(res, { error: 'MemoryRetriever unavailable' }, 503);
      const q = qp(u, 'q', '');
      const results = await retriever.retrieve(q, { collections: ['knowledge'], limit: 10 });
      return json(res, { query: q, results, count: results.length });
    }

    if (path === '/intelligence/knowledge/crawl' && method === 'POST') {
      const body = await readBody(req);
      const acq = await kas();
      if (!acq) return json(res, { error: 'KnowledgeAcquisitionService unavailable' }, 503);
      const result = await acq.crawlSource(body.sourceKey);
      return json(res, { crawled: true, result });
    }

    if (path === '/intelligence/knowledge/sources' && method === 'GET') {
      const registry = await ksr();
      if (!registry) return json(res, { error: 'KnowledgeSourceRegistry unavailable' }, 503);
      return json(res, { sources: registry.getSources() });
    }

    if (path === '/intelligence/knowledge/freshness' && method === 'GET') {
      const freshness = await kfs();
      if (!freshness) return json(res, { error: 'KnowledgeFreshnessService unavailable' }, 503);
      return json(res, freshness.checkFreshness());
    }

    // ── Graph ──────────────────────────────────────────────────────────────
    if (path === '/intelligence/graph/query' && method === 'GET') {
      const engine = await gqe();
      if (!engine) return json(res, { error: 'GraphQueryEngine unavailable' }, 503);
      const q = qp(u, 'q', '');
      const method_ = qp(u, 'method', 'global');
      const result = engine.query(q, method_);
      return json(res, { query: q, method: method_, result });
    }

    if (path === '/intelligence/graph/impact' && method === 'GET') {
      const explorer = await gex();
      if (!explorer) return json(res, { error: 'GraphExplorer unavailable' }, 503);
      const entity = qp(u, 'entity', '');
      const result = explorer.whatBreaksIf(entity);
      return json(res, { entity, impact: result });
    }

    if (path === '/intelligence/graph/entities' && method === 'GET') {
      const explorer = await gex();
      if (!explorer) return json(res, { error: 'GraphExplorer unavailable' }, 503);
      const name = qp(u, 'name', '');
      const result = explorer.explainEntity(name);
      return json(res, { name, entity: result });
    }

    if (path === '/intelligence/graph/health' && method === 'GET') {
      const diag = await gdi();
      if (!diag) return json(res, { error: 'GraphDiagnostics unavailable' }, 503);
      return json(res, await diag.getHealth());
    }

    // ── Browser Intelligence ───────────────────────────────────────────────
    if (path === '/intelligence/browser/validate' && method === 'GET') {
      const engine = await bie();
      if (!engine) return json(res, { error: 'BrowserIntelligenceEngine unavailable' }, 503);
      const url = qp(u, 'url', '');
      const result = await engine.validateStore(url);
      return json(res, { url, result });
    }

    if (path === '/intelligence/browser/theme' && method === 'GET') {
      const agent = await bta();
      if (!agent) return json(res, { error: 'ThemeAgent unavailable' }, 503);
      const url = qp(u, 'url', '');
      const themeId = qp(u, 'themeId', '');
      const result = await agent.runFull(url, themeId);
      return json(res, { url, themeId, result });
    }

    if (path === '/intelligence/browser/checkout' && method === 'GET') {
      const agent = await bca();
      if (!agent) return json(res, { error: 'CheckoutAgent unavailable' }, 503);
      const url = qp(u, 'url', '');
      const result = await agent.runFlow(url);
      return json(res, { url, result });
    }

    if (path === '/intelligence/browser/status' && method === 'GET') {
      const engine = await bie();
      if (!engine) return json(res, { error: 'BrowserIntelligenceEngine unavailable' }, 503);
      return json(res, await engine.getStatus());
    }

    // ── Observability ─────────────────────────────────────────────────────
    if (path === '/intelligence/observability/health' && method === 'GET') {
      const hs = await hss();
      if (!hs) return json(res, { error: 'HealthService unavailable' }, 503);
      return json(res, await hs.getHealth());
    }

    if (path === '/intelligence/observability/incidents' && method === 'GET') {
      const incidentsPath = join(REPO_ROOT, 'graphify-out', 'incidents.jsonl');
      if (!existsSync(incidentsPath)) {
        return json(res, { incidents: [], note: 'incidents.jsonl not found' });
      }
      const raw = readFileSync(incidentsPath, 'utf8');
      const lines = raw.split('\n').filter(Boolean);
      const incidents = lines
        .slice(-50)
        .map((l) => { try { return JSON.parse(l); } catch { return null; } })
        .filter(Boolean)
        .reverse();
      return json(res, { incidents, count: incidents.length });
    }

    if (path === '/intelligence/observability/anomalies' && method === 'GET') {
      const anomaly = await ads();
      if (!anomaly) return json(res, { error: 'AnomalyDetectionService unavailable' }, 503);
      return json(res, { anomalies: anomaly.getAllAnomalies() });
    }

    // ── Agents ─────────────────────────────────────────────────────────────
    if (path === '/intelligence/agents/execute' && method === 'GET') {
      const agentName = qp(u, 'agent', 'knowledge');
      const q = qp(u, 'q', '');
      const loader = AGENT_MAP[agentName];
      if (!loader) return json(res, { error: `Unknown agent: ${agentName}` }, 400);
      const agent = await loader();
      if (!agent) return json(res, { error: `Agent '${agentName}' not available yet` }, 503);
      if (typeof agent.execute !== 'function') {
        return json(res, { error: `Agent '${agentName}' has no execute() method` }, 500);
      }
      const result = await agent.execute(q);
      return json(res, { agent: agentName, query: q, result });
    }

    if (path === '/intelligence/agents/status' && method === 'GET') {
      const statuses = await Promise.all(
        Object.entries(AGENT_MAP).map(async ([name, loader]) => {
          const agent = await loader();
          return {
            name,
            available: agent !== null,
            capabilities: agent?.capabilities ?? agent?.CAPABILITIES ?? [],
          };
        }),
      );
      return json(res, { agents: statuses });
    }

    // ── FLAGSHIP: /intelligence/ask ─────────────────────────────────────────
    if (path === '/intelligence/ask' && method === 'GET') {
      const question = qp(u, 'q', '');
      if (!question) return json(res, { error: 'q parameter required' }, 400);

      // Lazy-load router and synthesizer
      const [routerMod, synthMod] = await Promise.all([
        import('./QueryRouter.mjs'),
        import('./ResponseSynthesizer.mjs'),
      ]);
      const router = routerMod.default;
      const synth = synthMod.default;

      // Route and gather context
      const routing = router.route(question);

      // Try to run the agent for this question type
      let agentResult = null;
      const agentLoader = AGENT_MAP[routing.agent];
      if (agentLoader) {
        try {
          const agent = await agentLoader();
          if (agent && typeof agent.execute === 'function') {
            agentResult = await agent.execute(question);
          }
        } catch {
          // non-fatal
        }
      }

      // Assemble V1 + V2 context in parallel
      const [v1Context, v2Context] = await Promise.all([
        router.assembleV1Context(question),
        router.assembleV2Context(question, routing.agent),
      ]);

      const answer = synth.synthesize(question, {
        v1: v1Context,
        v2: v2Context,
        agent: routing.agent,
        agentResult,
      });

      return json(res, { routing, ...answer });
    }

    // ── V2: Context Intelligence ───────────────────────────────────────────

    if (path === '/intelligence/context/assemble' && method === 'GET') {
      const assembler = await ctx();
      if (!assembler) return json(res, { error: 'ContextAssembler unavailable' }, 503);
      const q = qp(u, 'q', '');
      const budget = Number(qp(u, 'budget', '8000'));
      if (!q) return json(res, { error: 'q parameter required' }, 400);
      const result = assembler.assemble(q, { tokenBudget: budget });
      return json(res, { query: q, tokenBudget: budget, ...result });
    }

    if (path === '/intelligence/context/map' && method === 'GET') {
      const mapPath = join(REPO_ROOT, 'graphify-out', 'context-intelligence', 'LCIS_CONTEXT_MAP.json');
      if (!existsSync(mapPath)) {
        return json(res, {
          error: 'LCIS_CONTEXT_MAP.json not found — run POST /intelligence/context/build first',
          path: mapPath,
        }, 404);
      }
      try {
        const data = JSON.parse(readFileSync(mapPath, 'utf8'));
        return json(res, data);
      } catch (err) {
        return json(res, { error: `Failed to parse context map: ${err.message}` }, 500);
      }
    }

    if (path === '/intelligence/context/build' && method === 'POST') {
      const pipeline = await ccp();
      if (!pipeline) return json(res, { error: 'ContextCompressionPipeline unavailable' }, 503);
      const result = await pipeline.run();
      return json(res, { built: true, result });
    }

    if (path === '/intelligence/context/health' && method === 'GET') {
      const diag = await cdi();
      if (!diag) return json(res, { error: 'ContextDiagnostics unavailable' }, 503);
      return json(res, diag.getHealth());
    }

    if (path === '/intelligence/context/compression' && method === 'GET') {
      const diag = await cdi();
      if (!diag) return json(res, { error: 'ContextDiagnostics unavailable' }, 503);
      return json(res, diag.getCompressionStats());
    }

    // ── V2: Architecture Intelligence ──────────────────────────────────────

    if (path === '/intelligence/architecture' && method === 'GET') {
      const engine = await aie();
      if (!engine) return json(res, { error: 'ArchitectureIntelligenceEngine unavailable' }, 503);
      return json(res, await engine.getArchitecture());
    }

    if (path === '/intelligence/architecture/drift' && method === 'GET') {
      const engine = await aie();
      if (!engine) return json(res, { error: 'ArchitectureIntelligenceEngine unavailable' }, 503);
      return json(res, await engine.whatChanged());
    }

    if (path === '/intelligence/architecture/risks' && method === 'GET') {
      const engine = await aie();
      if (!engine) return json(res, { error: 'ArchitectureIntelligenceEngine unavailable' }, 503);
      return json(res, await engine.getRisks());
    }

    if (path === '/intelligence/architecture/depends' && method === 'GET') {
      const engine = await aie();
      if (!engine) return json(res, { error: 'ArchitectureIntelligenceEngine unavailable' }, 503);
      const component = qp(u, 'component', '');
      if (!component) return json(res, { error: 'component parameter required' }, 400);
      return json(res, await engine.whatDependsOn(component));
    }

    // ── V2: Reasoning Engine ───────────────────────────────────────────────

    if (path === '/intelligence/reason' && method === 'GET') {
      const engine = await rse();
      if (!engine) return json(res, { error: 'ReasoningEngine unavailable' }, 503);
      const q = qp(u, 'q', '');
      if (!q) return json(res, { error: 'q parameter required' }, 400);
      return json(res, await engine.reason(q));
    }

    if (path === '/intelligence/reason/why' && method === 'GET') {
      const engine = await rse();
      if (!engine) return json(res, { error: 'ReasoningEngine unavailable' }, 503);
      const incident = qp(u, 'incident', '');
      if (!incident) return json(res, { error: 'incident parameter required' }, 400);
      return json(res, await engine.whyDidThisHappen(incident));
    }

    if (path === '/intelligence/reason/affected' && method === 'GET') {
      const engine = await rse();
      if (!engine) return json(res, { error: 'ReasoningEngine unavailable' }, 503);
      const component = qp(u, 'component', '');
      if (!component) return json(res, { error: 'component parameter required' }, 400);
      return json(res, await engine.whatIsAffected(component));
    }

    if (path === '/intelligence/reason/risk-dependency' && method === 'GET') {
      const engine = await rse();
      if (!engine) return json(res, { error: 'ReasoningEngine unavailable' }, 503);
      return json(res, await engine.highestRiskDependency());
    }

    // ── V2: Correlation Engine ─────────────────────────────────────────────

    if (path === '/intelligence/correlate' && method === 'POST') {
      const body = await readBody(req);
      const engine = await ice();
      if (!engine) return json(res, { error: 'IntelligenceCorrelationEngine unavailable' }, 503);
      if (!body.event) return json(res, { error: 'event field required in body' }, 400);
      return json(res, await engine.correlate(body.event));
    }

    if (path === '/intelligence/correlate/root-cause' && method === 'GET') {
      const engine = await ice();
      if (!engine) return json(res, { error: 'IntelligenceCorrelationEngine unavailable' }, 503);
      const domain = qp(u, 'domain', '');
      if (!domain) return json(res, { error: 'domain parameter required' }, 400);
      return json(res, await engine.correlateIncident({ domain }));
    }

    if (path === '/intelligence/correlate/impact' && method === 'GET') {
      const engine = await ice();
      if (!engine) return json(res, { error: 'IntelligenceCorrelationEngine unavailable' }, 503);
      const component = qp(u, 'component', '');
      if (!component) return json(res, { error: 'component parameter required' }, 400);
      return json(res, await engine.predictImpact({ component }));
    }

    if (path === '/intelligence/correlate/risk' && method === 'GET') {
      const engine = await ice();
      if (!engine) return json(res, { error: 'IntelligenceCorrelationEngine unavailable' }, 503);
      const target = qp(u, 'target', '');
      if (!target) return json(res, { error: 'target parameter required' }, 400);
      return json(res, await engine.getRiskScore(target));
    }

    // ── V2: Autonomous Operations ──────────────────────────────────────────

    if (path === '/intelligence/operations/assess' && method === 'GET') {
      const engine = await ore();
      if (!engine) return json(res, { error: 'OperationsReasoningEngine unavailable' }, 503);
      return json(res, await engine.assess());
    }

    if (path === '/intelligence/operations/recommendations' && method === 'GET') {
      const engine = await ore();
      if (!engine) return json(res, { error: 'OperationsReasoningEngine unavailable' }, 503);
      return json(res, await engine.getEngineeringRecommendations());
    }

    if (path === '/intelligence/operations/insights' && method === 'GET') {
      const engine = await ore();
      if (!engine) return json(res, { error: 'OperationsReasoningEngine unavailable' }, 503);
      return json(res, await engine.getOperationalInsights());
    }

    if (path === '/intelligence/operations/daily' && method === 'GET') {
      const generator = await irg();
      if (!generator) return json(res, { error: 'IntelligenceReportGenerator unavailable' }, 503);
      return json(res, generator.getLatestReport());
    }

    if (path === '/intelligence/operations/daily' && method === 'POST') {
      const generator = await irg();
      if (!generator) return json(res, { error: 'IntelligenceReportGenerator unavailable' }, 503);
      const report = await generator.generateDailyReport();
      return json(res, { generated: true, report });
    }

    // ── V2: Self Model ─────────────────────────────────────────────────────

    if (path === '/intelligence/self/model' && method === 'GET') {
      const modelPath = join(REPO_ROOT, 'graphify-out', 'self-model', 'LCIS_SELF_MODEL.json');
      if (!existsSync(modelPath)) {
        return json(res, {
          error: 'LCIS_SELF_MODEL.json not found — run POST /intelligence/self/build first',
          path: modelPath,
        }, 404);
      }
      try {
        const data = JSON.parse(readFileSync(modelPath, 'utf8'));
        return json(res, data);
      } catch (err) {
        return json(res, { error: `Failed to parse self model: ${err.message}` }, 500);
      }
    }

    if (path === '/intelligence/self/build' && method === 'POST') {
      const builder = await smb();
      if (!builder) return json(res, { error: 'SelfModelBuilder unavailable' }, 503);
      const result = await builder.build();
      return json(res, { built: true, result });
    }

    if (path === '/intelligence/self/explain' && method === 'GET') {
      const explainer = await pex();
      if (!explainer) return json(res, { error: 'PlatformExplainer unavailable' }, 503);
      const topic = qp(u, 'topic', 'platform');
      const topicMap = {
        platform:    () => explainer.explainPlatform(),
        services:    () => explainer.explainServiceInteraction(),
        deploy:      () => explainer.explainDeploymentPropagation(),
        failure:     () => explainer.explainFailurePropagation(qp(u, 'domain', 'payments')),
        incident:    () => explainer.explainIncidentEmergence(),
        operations:  () => explainer.explainOperations(),
      };
      const handler = topicMap[topic];
      if (!handler) {
        return json(res, {
          error: `Unknown topic: ${topic}`,
          availableTopics: Object.keys(topicMap),
        }, 400);
      }
      return json(res, await handler());
    }

    // ── V2: Command Center — operator overview dashboard ───────────────────

    if (path === '/intelligence/command-center' && method === 'GET') {
      const [hsInst, diagInst, archInst, opsInst] = await Promise.all([
        hss(), cdi(), aie(), ore(),
      ]);

      const [health, compressionStats, archRisks, opsPosture, incidents] = await Promise.allSettled([
        hsInst   ? hsInst.getHealth()           : Promise.resolve({ status: 'NOT CONNECTED' }),
        diagInst ? diagInst.getCompressionStats(): Promise.resolve({ status: 'NOT CONNECTED' }),
        archInst ? archInst.getRisks()           : Promise.resolve({ status: 'NOT CONNECTED' }),
        opsInst  ? opsInst.assess()              : Promise.resolve({ status: 'NOT CONNECTED' }),
        (async () => {
          const incPath = join(REPO_ROOT, 'graphify-out', 'incidents.jsonl');
          if (!existsSync(incPath)) return [];
          const lines = readFileSync(incPath, 'utf8').split('\n').filter(Boolean);
          return lines
            .slice(-10)
            .map((l) => { try { return JSON.parse(l); } catch { return null; } })
            .filter(Boolean)
            .reverse();
        })(),
      ]);

      // Derive self-model subsystem count from artifact if present
      let subsystemCount = 0;
      try {
        const smPath = join(REPO_ROOT, 'graphify-out', 'self-model', 'LCIS_SELF_MODEL.json');
        if (existsSync(smPath)) {
          const sm = JSON.parse(readFileSync(smPath, 'utf8'));
          subsystemCount = sm?.subsystems?.length ?? sm?.layers?.length ?? 0;
        }
      } catch { /* non-fatal */ }

      // V3 enrichments: executive briefing summary, goals-at-risk, top predictions, top recommendations, loop state, verification stats
      const [exeInst, goalInst, predInst, recInst, loopInst, verInst] = await Promise.all([
        exe_intel(), goal_eng(), pred_eng(), rec_eng(), loop_eng(), ver_eng(),
      ]);

      const [exeBriefing, goalsAtRisk, topPredictions, topRecs, loopState, verReport] = await Promise.allSettled([
        exeInst  ? exeInst.getExecutiveBriefing()    : Promise.resolve({ status: 'NOT CONNECTED' }),
        goalInst ? goalInst.getGoalsAtRisk()          : Promise.resolve([]),
        predInst ? predInst.predictAll()              : Promise.resolve([]),
        recInst  ? recInst.recommendAll()             : Promise.resolve([]),
        loopInst ? loopInst.getLoopState()            : Promise.resolve({ status: 'NOT CONNECTED' }),
        verInst  ? verInst.getVerificationReport()    : Promise.resolve({ status: 'NOT CONNECTED' }),
      ]);

      return json(res, {
        timestamp:    new Date().toISOString(),
        version:      '3.0',
        health:       health.value            ?? { status: 'NOT CONNECTED' },
        context:      compressionStats.value  ?? { status: 'NOT CONNECTED' },
        architecture: archRisks.value         ?? { status: 'NOT CONNECTED' },
        operations:   opsPosture.value        ?? { status: 'NOT CONNECTED' },
        selfModel:    { subsystemCount },
        incidents:    { recent: incidents.value ?? [], note: incidents.value ? null : 'NOT CONNECTED' },
        // V3 additions
        executive: {
          briefing:    exeBriefing.status === 'fulfilled'   ? exeBriefing.value  : { status: 'NOT CONNECTED' },
        },
        goals: {
          atRisk:      goalsAtRisk.status === 'fulfilled'   ? goalsAtRisk.value  : [],
          atRiskCount: goalsAtRisk.status === 'fulfilled'   ? (goalsAtRisk.value?.length ?? 0) : 'NOT CONNECTED',
        },
        predictions: {
          top:   topPredictions.status === 'fulfilled' ? (topPredictions.value?.slice?.(0, 3) ?? []) : [],
          count: topPredictions.status === 'fulfilled' ? (topPredictions.value?.length ?? 0) : 'NOT CONNECTED',
        },
        recommendations: {
          top:   topRecs.status === 'fulfilled' ? (topRecs.value?.slice?.(0, 3) ?? []) : [],
          count: topRecs.status === 'fulfilled' ? (topRecs.value?.length ?? 0)         : 'NOT CONNECTED',
        },
        loop:         loopState.status  === 'fulfilled' ? loopState.value  : { status: 'NOT CONNECTED' },
        verification: verReport.status  === 'fulfilled' ? verReport.value  : { status: 'NOT CONNECTED' },
      });
    }

    // ── V3: Executive Intelligence ─────────────────────────────────────────

    if (path === '/intelligence/executive/briefing' && method === 'GET') {
      const engine = await exe_intel();
      if (!engine) return json(res, { error: 'ExecutiveIntelligenceEngine unavailable' }, 503);
      return json(res, await engine.getExecutiveBriefing());
    }

    if (path === '/intelligence/executive/next' && method === 'GET') {
      const engine = await exe_intel();
      if (!engine) return json(res, { error: 'ExecutiveIntelligenceEngine unavailable' }, 503);
      return json(res, await engine.whatShouldHappenNext());
    }

    if (path === '/intelligence/executive/decide' && method === 'POST') {
      const body = await readBody(req);
      if (!body.situation) return json(res, { error: 'situation field required in body' }, 400);
      const engine = await exe_intel();
      if (!engine) return json(res, { error: 'ExecutiveIntelligenceEngine unavailable' }, 503);
      return json(res, await engine.decide(body.situation));
    }

    if (path === '/intelligence/executive/plan' && method === 'POST') {
      const body = await readBody(req);
      if (!body.goal) return json(res, { error: 'goal field required in body' }, 400);
      const engine = await exe_intel();
      if (!engine) return json(res, { error: 'ExecutiveIntelligenceEngine unavailable' }, 503);
      return json(res, await engine.plan(body.goal));
    }

    if (path === '/intelligence/executive/synthesize' && method === 'GET') {
      const topic = qp(u, 'topic', 'platform_state');
      const engine = await exe_intel();
      if (!engine) return json(res, { error: 'ExecutiveIntelligenceEngine unavailable' }, 503);
      return json(res, await engine.synthesize(topic));
    }

    // ── V3: Goals & Missions ───────────────────────────────────────────────

    if (path === '/intelligence/goals' && method === 'GET') {
      const engine = await goal_eng();
      if (!engine) return json(res, { error: 'GoalEngine unavailable' }, 503);
      const category = qp(u, 'category', null);
      const goals = engine.getGoals(category);
      return json(res, { goals, count: goals.length, category: category ?? 'all' });
    }

    if (path === '/intelligence/goals/at-risk' && method === 'GET') {
      const engine = await goal_eng();
      if (!engine) return json(res, { error: 'GoalEngine unavailable' }, 503);
      const goals = engine.getGoalsAtRisk();
      return json(res, { goals, count: goals.length });
    }

    if (path === '/intelligence/missions' && method === 'GET') {
      const engine = await mission_eng();
      if (!engine) return json(res, { error: 'MissionEngine unavailable' }, 503);
      const missions = engine.getMissions();
      return json(res, { missions, count: missions.length });
    }

    // ── V3: Predictions ────────────────────────────────────────────────────

    if (path === '/intelligence/predict' && method === 'GET') {
      const target = qp(u, 'target', '');
      if (!target) return json(res, { error: 'target parameter required' }, 400);
      const engine = await pred_eng();
      if (!engine) return json(res, { error: 'PredictionEngine unavailable' }, 503);
      return json(res, await engine.predict(target));
    }

    if (path === '/intelligence/predict/all' && method === 'GET') {
      const engine = await pred_eng();
      if (!engine) return json(res, { error: 'PredictionEngine unavailable' }, 503);
      const predictions = await engine.predictAll();
      return json(res, { predictions, count: predictions?.length ?? 0 });
    }

    if (path === '/intelligence/predict/incidents' && method === 'GET') {
      const engine = await pred_eng();
      if (!engine) return json(res, { error: 'PredictionEngine unavailable' }, 503);
      // Route through PredictionEngine using 'incidents' target
      const result = await engine.predict('incidents');
      return json(res, result);
    }

    // ── V3: Recommendations ────────────────────────────────────────────────

    if (path === '/intelligence/recommend' && method === 'GET') {
      const engine = await rec_eng();
      if (!engine) return json(res, { error: 'ExecutiveRecommendationEngine unavailable' }, 503);
      const recs = await engine.recommendAll();
      return json(res, { recommendations: recs, count: recs?.length ?? 0 });
    }

    if (path === '/intelligence/recommend/domain' && method === 'GET') {
      const domain = qp(u, 'domain', '');
      if (!domain) return json(res, { error: 'domain query parameter required' }, 400);
      const engine = await rec_eng();
      if (!engine) return json(res, { error: 'ExecutiveRecommendationEngine unavailable' }, 503);
      const DOMAIN_MAP = {
        engineering:  () => engine.recommendEngineering(),
        operational:  () => engine.recommendOperational(),
        security:     () => engine.recommendSecurity(),
        architecture: () => engine.recommendArchitecture(),
        merchant:     () => engine.recommendMerchant(),
      };
      const handler = DOMAIN_MAP[domain];
      if (!handler) {
        return json(res, { error: `Unknown domain: ${domain}`, available: Object.keys(DOMAIN_MAP) }, 400);
      }
      const recs = await handler();
      return json(res, { domain, recommendations: recs, count: recs?.length ?? 0 });
    }

    // ── V3: Investigation ──────────────────────────────────────────────────

    if (path === '/intelligence/investigate/domain' && method === 'GET') {
      const domain = qp(u, 'domain', '');
      if (!domain) return json(res, { error: 'domain parameter required' }, 400);
      const engine = await inv_eng();
      if (!engine) return json(res, { error: 'InvestigationEngine unavailable' }, 503);
      return json(res, await engine.investigateDomain(domain));
    }

    if (path === '/intelligence/investigate' && method === 'POST') {
      const body = await readBody(req);
      if (!body.incident) return json(res, { error: 'incident field required in body' }, 400);
      const engine = await inv_eng();
      if (!engine) return json(res, { error: 'InvestigationEngine unavailable' }, 503);
      return json(res, await engine.investigate(body.incident));
    }

    // ── V3: Orchestration ──────────────────────────────────────────────────

    if (path === '/intelligence/orchestrate/health' && method === 'GET') {
      const engine = await orch_eng();
      if (!engine) return json(res, { error: 'OrchestrationEngine unavailable' }, 503);
      return json(res, await engine.runHealthAssessment());
    }

    if (path === '/intelligence/orchestrate/risk' && method === 'GET') {
      const engine = await orch_eng();
      if (!engine) return json(res, { error: 'OrchestrationEngine unavailable' }, 503);
      return json(res, await engine.runRiskAssessment());
    }

    if (path === '/intelligence/orchestrate/architecture' && method === 'GET') {
      const engine = await orch_eng();
      if (!engine) return json(res, { error: 'OrchestrationEngine unavailable' }, 503);
      return json(res, await engine.runArchitectureReview());
    }

    if (path === '/intelligence/orchestrate/workflows' && method === 'GET') {
      const engine = await orch_eng();
      if (!engine) return json(res, { error: 'OrchestrationEngine unavailable' }, 503);
      return json(res, { workflows: engine.listWorkflows() });
    }

    // ── V3: Execution ──────────────────────────────────────────────────────

    if (path === '/intelligence/execute' && method === 'POST') {
      const body = await readBody(req);
      if (!body.action) return json(res, { error: 'action field required in body' }, 400);
      const engine = await exec_eng();
      if (!engine) return json(res, { error: 'ExecutionEngine unavailable' }, 503);
      // Safe whitelist enforced inside ExecutionEngine (SafetyGuard)
      return json(res, await engine.execute(body.action, body.params ?? {}));
    }

    if (path === '/intelligence/execute/actions' && method === 'GET') {
      const registry = await act_reg();
      if (!registry) return json(res, { error: 'ActionRegistry unavailable' }, 503);
      return json(res, { actions: registry.getActions() });
    }

    if (path === '/intelligence/execute/audit' && method === 'GET') {
      const engine = await exec_eng();
      if (!engine) return json(res, { error: 'ExecutionEngine unavailable' }, 503);
      return json(res, await engine.getAuditLog());
    }

    // ── V3: Verification ───────────────────────────────────────────────────

    if (path === '/intelligence/verify' && method === 'POST') {
      const body = await readBody(req);
      if (!body.conclusion) return json(res, { error: 'conclusion field required in body' }, 400);
      const engine = await ver_eng();
      if (!engine) return json(res, { error: 'VerificationEngine unavailable' }, 503);
      return json(res, await engine.verify(body.conclusion));
    }

    if (path === '/intelligence/verify/report' && method === 'GET') {
      const engine = await ver_eng();
      if (!engine) return json(res, { error: 'VerificationEngine unavailable' }, 503);
      return json(res, await engine.getVerificationReport());
    }

    // ── V3: Daily Briefings ────────────────────────────────────────────────

    if (path === '/intelligence/brief/daily' && method === 'GET') {
      const system = await daily_sys();
      if (!system) return json(res, { error: 'DailyIntelligenceSystem unavailable' }, 503);
      return json(res, system.getLatestBrief('daily'));
    }

    if (path === '/intelligence/brief/generate' && method === 'POST') {
      const system = await daily_sys();
      if (!system) return json(res, { error: 'DailyIntelligenceSystem unavailable' }, 503);
      const result = await system.generateAll();
      return json(res, { generated: true, result });
    }

    if (path === '/intelligence/brief/executive' && method === 'GET') {
      const generator = await exec_sum();
      if (!generator) return json(res, { error: 'ExecutiveSummaryGenerator unavailable' }, 503);
      return json(res, await generator.generate());
    }

    // ── V3: Operating Loop ─────────────────────────────────────────────────

    if (path === '/intelligence/loop/state' && method === 'GET') {
      const loop = await loop_eng();
      if (!loop) return json(res, { error: 'LCISOperatingLoop unavailable' }, 503);
      return json(res, loop.getLoopState());
    }

    if (path === '/intelligence/loop/run-once' && method === 'POST') {
      const loop = await loop_eng();
      if (!loop) return json(res, { error: 'LCISOperatingLoop unavailable' }, 503);
      const result = await loop.runOnce();
      return json(res, result);
    }

    if (path === '/intelligence/loop/history' && method === 'GET') {
      const loop = await loop_eng();
      if (!loop) return json(res, { error: 'LCISOperatingLoop unavailable' }, 503);
      return json(res, { history: loop.getHistory(10) });
    }

    // ── 404 fallback ───────────────────────────────────────────────────────
    return json(res, { error: 'unknown endpoint', endpoints: ENDPOINTS }, 404);
  } catch (err) {
    console.error(`[LCIS-V2] Handler error on ${method} ${path}:`, err);
    return json(res, { error: err.message || 'Internal server error' }, 500);
  }
}

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------

export async function start() {
  // Non-fatal startup health ping
  try {
    const monitor = await mhm();
    if (monitor) {
      const h = await monitor.getHealth();
      console.log(`[LCIS-V2] Memory engine health: ${h?.status ?? 'unknown'}`);
    }
  } catch (err) {
    console.warn(`[LCIS-V2] Memory health check skipped: ${err.message}`);
  }

  const server = http.createServer(handleRequest);

  server.listen(PORT, () => {
    console.log(`[LCIS-V3] Intelligence API running on http://localhost:${PORT}`);
    console.log(`[LCIS-V3] V1 proxy target: ${LCIS_V1_URL}`);
    console.log(`[LCIS-V3] ${ENDPOINTS.length} registered endpoints:`);
    const v3Keywords = ['/executive/', '/goals', '/missions', '/predict', '/recommend', '/investigate', '/orchestrate', '/execute', '/verify', '/brief/', '/loop/'];
    const v3eps = ENDPOINTS.filter((e) => v3Keywords.some(k => e.includes(k)));
    const v2Keywords = ['/context/', '/architecture', '/reason', '/correlate', '/operations/', '/self/'];
    const v2eps = ENDPOINTS.filter((e) => !v3eps.includes(e) && v2Keywords.some(k => e.includes(k)));
    const v1eps = ENDPOINTS.filter((e) => !v3eps.includes(e) && !v2eps.includes(e));
    console.log(`  V1 subsystems: ${v1eps.length} endpoints`);
    console.log(`  V2 subsystems: ${v2eps.length} endpoints (context/architecture/reasoning/correlation/operations/self-model/command-center)`);
    console.log(`  V3 subsystems: ${v3eps.length} endpoints (executive/goals/missions/predictions/recommendations/investigation/orchestration/execution/verification/briefings/loop)`);
    for (const ep of ENDPOINTS) {
      console.log(`  ${ep}`);
    }
  });

  server.on('error', (err) => {
    console.error('[LCIS-V2] Server error:', err);
    process.exit(1);
  });

  return server;
}

// Auto-start when run directly
const isMain = process.argv[1] && import.meta.url === new URL(process.argv[1], import.meta.url).href;
if (isMain) {
  start().catch((err) => {
    console.error('[LCIS-V2] Fatal startup error:', err);
    process.exit(1);
  });
}
