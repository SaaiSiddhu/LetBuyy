/**
 * LCIS V2 — SelfModelBuilder
 *
 * Phase 19: LCIS models ITSELF and generates real self-model artifacts.
 *
 * Introspects tools/central-intelligence/ (scan all subsystem dirs + .mjs
 * files) and the existing graphify-out/*.json intelligence to produce five
 * structured JSON artifacts under graphify-out/self-model/.
 *
 * No external dependencies — node:fs, node:path, node:url only.
 * Imports from architecture-intelligence and context-intelligence are lazy
 * (handled gracefully when unavailable).
 *
 * @module self-model/SelfModelBuilder
 */

import {
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  existsSync,
  statSync,
} from 'node:fs';
import { join, resolve, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CI_ROOT = resolve(__dirname, '..');          // tools/central-intelligence
const REPO_ROOT = resolve(__dirname, '../../..');  // repo root
const OUT_DIR = resolve(REPO_ROOT, 'graphify-out/self-model');

// ---------------------------------------------------------------------------
// LCIS declared layers (canonical 13)
// ---------------------------------------------------------------------------
const DECLARED_LAYERS = [
  'Memory',
  'Knowledge',
  'Graph',
  'Browser',
  'Observability',
  'Agents',
  'Context',
  'Architecture',
  'Reasoning',
  'Correlation',
  'AutonomousOps',
  'SelfModel',
  'IntelligenceAPI',
];

// Subsystem directory → layer name mapping
const DIR_TO_LAYER = {
  'memory-engine':            'Memory',
  'knowledge-engine':         'Knowledge',
  'graph-engine':             'Graph',
  'browser-intelligence':     'Browser',
  'observability':            'Observability',
  'agents':                   'Agents',
  'context-intelligence':     'Context',
  'architecture-intelligence':'Architecture',
  'reasoning':                'Reasoning',
  'correlation':              'Correlation',
  'operator-platform':        'AutonomousOps',
  'self-model':               'SelfModel',
  'intelligence-api':         'IntelligenceAPI',
};

// Responsibilities per subsystem (static knowledge)
const RESPONSIBILITIES = {
  'memory-engine': [
    'Persistent fact storage and retrieval',
    'Ingestion pipeline for decisions, rules, migrations',
    'Memory freshness tracking',
    'Memory health monitoring',
  ],
  'knowledge-engine': [
    'Knowledge acquisition from codebase sources',
    'Source registry and scheduling',
    'Change detection and freshness service',
  ],
  'graph-engine': [
    'Code graph build, index, and query',
    'Graph exploration and diagnostics',
    'GraphRAG entity extraction',
  ],
  'browser-intelligence': [
    'Playwright-driven runtime evidence collection',
    'Checkout, store, theme, monitoring agents',
    'SEO validation',
    'Evidence aggregation',
  ],
  'observability': [
    'Metrics, tracing, health and anomaly detection',
    'Incident detection service',
    'OpenTelemetry instrumentation',
  ],
  'agents': [
    'Domain-specific AI agents (Knowledge, Merchant, Operations, Release, Security, Theme)',
    'Agent framework and lifecycle management',
  ],
  'context-intelligence': [
    'Architecture graph building from infra + domain intel',
    'Dependency graph building across workspace packages',
    'Repository graph building',
    'Context assembly, health, optimization',
  ],
  'architecture-intelligence': [
    'Service discovery across all runtimes',
    'Dependency and layer discovery',
    'Domain discovery and coupling analysis',
    'Architecture snapshot and drift detection',
  ],
  'reasoning': [
    'Incident reasoning and root-cause analysis',
  ],
  'correlation': [
    'Cross-signal correlation (currently minimal)',
  ],
  'operator-platform': [
    'Autonomous operations support',
    'Platform operator tooling',
  ],
  'self-model': [
    'LCIS self-introspection and self-description',
    'Platform explainer (how LetBuyy works)',
    'Self-diagnostics and completeness validation',
    'Self-model artifact generation',
  ],
  'intelligence-api': [
    'Unified HTTP API on port 3334',
    'Query routing to V1 (3333) + V2 subsystems',
    'Response synthesis and context assembly',
  ],
};

// Cross-subsystem dependencies (derived from import analysis, below)
const STATIC_DEP_MAP = {
  'intelligence-api':         ['memory-engine', 'knowledge-engine', 'graph-engine', 'browser-intelligence', 'observability', 'agents', 'context-intelligence', 'architecture-intelligence', 'reasoning', 'correlation', 'operator-platform'],
  'context-intelligence':     ['architecture-intelligence'],
  'architecture-intelligence':['context-intelligence'],
  'graph-engine':             [],
  'memory-engine':            [],
  'knowledge-engine':         [],
  'observability':            [],
  'agents':                   ['memory-engine', 'knowledge-engine', 'graph-engine'],
  'browser-intelligence':     [],
  'reasoning':                [],
  'correlation':              [],
  'operator-platform':        [],
  'self-model':               ['architecture-intelligence', 'context-intelligence'],
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function ensureOutDir() {
  if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });
}

function writeArtifact(filename, data) {
  ensureOutDir();
  const path = join(OUT_DIR, filename);
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf8');
  return path;
}

function safeReadJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Recursively list .mjs files under a directory.
 */
function listMjsFiles(dir, maxDepth = 4, depth = 0) {
  if (depth > maxDepth || !existsSync(dir)) return [];
  const results = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listMjsFiles(full, maxDepth, depth + 1));
    } else if (entry.isFile() && extname(entry.name) === '.mjs') {
      results.push(full);
    }
  }
  return results;
}

/**
 * Extract class names from a .mjs file by scanning for "^class <Name>"
 */
function extractClasses(filePath) {
  try {
    const src = readFileSync(filePath, 'utf8');
    const matches = [...src.matchAll(/^class\s+([A-Z][A-Za-z0-9_]*)/gm)];
    return matches.map(m => m[1]);
  } catch {
    return [];
  }
}

/**
 * Extract import targets from a .mjs file (relative + absolute).
 * Returns array of strings like '../memory-engine/MemoryRetriever.mjs'
 */
function extractImports(filePath) {
  try {
    const src = readFileSync(filePath, 'utf8');
    const matches = [
      ...src.matchAll(/from\s+['"]([^'"]+)['"]/g),
      ...src.matchAll(/import\s*\(\s*['"]([^'"]+)['"]\s*\)/g),
    ];
    return matches.map(m => m[1]);
  } catch {
    return [];
  }
}

/**
 * Map a relative import string to a subsystem directory name.
 * E.g. '../memory-engine/Foo.mjs' → 'memory-engine'
 */
function importToSubsystem(importStr) {
  // Match patterns like '../<subsystem>/' or './<subsystem>/'
  const m = importStr.match(/\.\.?\/?([a-z-]+)\//);
  if (!m) return null;
  const candidate = m[1];
  return DIR_TO_LAYER[candidate] ? candidate : null;
}

// ---------------------------------------------------------------------------
// Subsystem introspection
// ---------------------------------------------------------------------------

function introspectSubsystems() {
  const subsystems = [];

  for (const [dirName, layerName] of Object.entries(DIR_TO_LAYER)) {
    const subsysPath = join(CI_ROOT, dirName);
    const exists = existsSync(subsysPath);
    const files = exists ? listMjsFiles(subsysPath).map(f => f.replace(CI_ROOT + '/', '')) : [];

    // Extract classes from each file
    const allClasses = [];
    for (const relFile of files) {
      const abs = join(CI_ROOT, relFile);
      allClasses.push(...extractClasses(abs));
    }

    // Derive inter-subsystem dependencies from imports
    const importedSubsystems = new Set();
    for (const relFile of files) {
      const abs = join(CI_ROOT, relFile);
      for (const imp of extractImports(abs)) {
        const sub = importToSubsystem(imp);
        if (sub && sub !== dirName) importedSubsystems.add(sub);
      }
    }

    subsystems.push({
      name: dirName,
      layer: layerName,
      path: `tools/central-intelligence/${dirName}`,
      exists,
      files: files.sort(),
      fileCount: files.length,
      classes: [...new Set(allClasses)],
      responsibilities: RESPONSIBILITIES[dirName] || [],
      dependsOnSubsystems: [...importedSubsystems].sort(),
      staticDependsOn: (STATIC_DEP_MAP[dirName] || []).sort(),
    });
  }

  return subsystems;
}

// ---------------------------------------------------------------------------
// Endpoint extraction
// ---------------------------------------------------------------------------

function extractEndpoints() {
  const serverPath = join(CI_ROOT, 'intelligence-api/server.mjs');
  if (!existsSync(serverPath)) return [];

  try {
    const src = readFileSync(serverPath, 'utf8');
    const seen = new Set();
    const endpoints = [];

    // Match path === '/intelligence/...' or path === '/api/...'
    // Covers: exact equality, startsWith, and case patterns
    const patterns = [
      /path\s*===\s*['"](\/?(?:intelligence|api)\/[^'"]+)['"]/g,
      /pathname\s*===?\s*['"](\/?(?:intelligence|api)\/[^'"]+)['"]/g,
      /path\.startsWith\s*\(\s*['"](\/?(?:intelligence|api)\/[^'"]+)['"]\s*\)/g,
      /pathname\.startsWith\s*\(\s*['"](\/?(?:intelligence|api)\/[^'"]+)['"]\s*\)/g,
      /case\s+['"](\/?(?:intelligence|api)\/[^'"]+)['"]/g,
    ];

    for (const pattern of patterns) {
      for (const m of src.matchAll(pattern)) {
        const ep = m[1].startsWith('/') ? m[1] : '/' + m[1];
        if (!seen.has(ep)) {
          seen.add(ep);
          endpoints.push(ep);
        }
      }
    }

    return endpoints.sort();
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Platform capabilities (derived from subsystems + graphify intel)
// ---------------------------------------------------------------------------

function derivePlatformCapabilities(subsystems, domainIntel, infraIntel) {
  const capabilities = [
    'Code graph traversal (blast-radius, dependency, consumer, critical-path)',
    'Business domain intelligence (22 domains, cross-domain edges)',
    'DB intelligence (tables, RPCs, policies, triggers, indexes)',
    'Architecture discovery (services, layers, coupling, drift)',
    'Memory retrieval (decisions, rules, migrations, architecture history)',
    'Knowledge acquisition and freshness tracking',
    'Browser-driven runtime evidence collection',
    'Incident detection and root-cause reasoning',
    'Metrics, tracing and anomaly detection',
    'Agent framework with domain-specific AI agents',
    'Dependency graph across workspace packages',
    'Context assembly for AI models',
    'Self-model and platform explanation',
    'Unified HTTP intelligence API (V2 :3334 → V1 :3333)',
    'Query routing across all intelligence subsystems',
  ];

  if (domainIntel?.summary) {
    capabilities.push(`Domain coverage: ${domainIntel.summary.domains} domains, ${domainIntel.summary.classifiedRoutes} classified routes`);
  }

  if (infraIntel?.summary) {
    capabilities.push(`Infrastructure: ${infraIntel.summary.workers} Cloudflare Workers, ${infraIntel.summary.vercelApps?.length || 0} Vercel apps`);
  }

  return capabilities;
}

// ---------------------------------------------------------------------------
// SelfModelBuilder class
// ---------------------------------------------------------------------------

class SelfModelBuilder {
  constructor() {
    this._subsystems = null;
    this._selfModel = null;
  }

  getArtifactPaths() {
    return {
      selfModel:         join(OUT_DIR, 'LCIS_SELF_MODEL.json'),
      systemGraph:       join(OUT_DIR, 'LCIS_SYSTEM_GRAPH.json'),
      dependencyModel:   join(OUT_DIR, 'LCIS_DEPENDENCY_MODEL.json'),
      operationalModel:  join(OUT_DIR, 'LCIS_OPERATIONAL_MODEL.json'),
      intelligenceModel: join(OUT_DIR, 'LCIS_INTELLIGENCE_MODEL.json'),
    };
  }

  _getSubsystems() {
    if (!this._subsystems) {
      this._subsystems = introspectSubsystems();
    }
    return this._subsystems;
  }

  // -------------------------------------------------------------------------
  // generateSelfModel
  // -------------------------------------------------------------------------

  async generateSelfModel() {
    const subsystems = this._getSubsystems();
    const domainIntel = safeReadJson(resolve(REPO_ROOT, 'graphify-out/domain-intel.json'));
    const infraIntel  = safeReadJson(resolve(REPO_ROOT, 'graphify-out/infra-intel.json'));

    const endpoints = extractEndpoints();
    const capabilities = derivePlatformCapabilities(subsystems, domainIntel, infraIntel);

    const totalFiles   = subsystems.reduce((s, sub) => s + sub.fileCount, 0);
    const totalClasses = subsystems.reduce((s, sub) => s + sub.classes.length, 0);
    const presentSubs  = subsystems.filter(s => s.exists);

    // Canonical runtime topology from CLAUDE.md
    const canonicalRuntimes = [
      'apps/customer_web',
      'apps/merchant_web',
      'apps/identity-platform',
      'apps/marketing-site',
      'apps/admin_web',
      'apps/merchant_app',
      'services/api-gateway',
      'services/mobile-bff',
      'services/webhook-service',
      'services/queue-workers',
    ];

    const artifact = {
      version: '2.0',
      generatedAt: new Date().toISOString(),
      description: 'LCIS V2 Self-Model — LCIS models itself and the LetBuyy platform',
      platform: {
        name: 'LetBuyy',
        type: 'Multi-tenant India-first commerce platform',
        tenantRoot: 'site_id',
        canonicalRuntimes,
        moneyModel: 'Canonical ledger via SECURITY DEFINER Postgres RPCs',
        authIssuers: ['customer (HS256)', 'merchant (ES256 via identity-platform)'],
        deployTargets: ['Cloudflare Workers', 'Vercel'],
      },
      layers: DECLARED_LAYERS,
      subsystems,
      capabilities,
      endpoints: {
        v2Port: 3334,
        v1Port: 3333,
        routes: endpoints,
        count: endpoints.length,
      },
      stats: {
        subsystemCount: subsystems.length,
        presentSubsystemCount: presentSubs.length,
        totalMjsFiles: totalFiles,
        totalClasses,
        declaredLayers: DECLARED_LAYERS.length,
        endpointCount: endpoints.length,
        domainCount: domainIntel?.summary?.domains ?? null,
        tableCount: domainIntel?.summary?.classifiedTables ?? null,
        rpcCount: domainIntel?.summary?.classifiedRpcs ?? null,
      },
    };

    this._selfModel = artifact;
    const path = writeArtifact('LCIS_SELF_MODEL.json', artifact);
    return { path, subsystemCount: subsystems.length, presentCount: presentSubs.length };
  }

  // -------------------------------------------------------------------------
  // generateSystemGraph
  // -------------------------------------------------------------------------

  async generateSystemGraph() {
    const subsystems = this._getSubsystems();

    // Nodes: one per subsystem + a V1 node
    const nodes = [
      {
        id: 'lcis-v1',
        label: 'LCIS V1 (Atlas)',
        type: 'external',
        port: 3333,
        description: 'The original graphify-powered intelligence layer',
      },
      {
        id: 'lcis-v2-api',
        label: 'LCIS V2 API',
        type: 'gateway',
        port: 3334,
        description: 'Unified HTTP intelligence API bridging V1 + V2',
      },
      ...subsystems.map(sub => ({
        id: sub.name,
        label: sub.name,
        layer: sub.layer,
        type: 'subsystem',
        fileCount: sub.fileCount,
        classCount: sub.classes.length,
        exists: sub.exists,
        path: sub.path,
      })),
    ];

    // Edges: derived from actual import scanning + static map
    const edgeSet = new Set();
    const edges = [];

    function addEdge(from, to, kind) {
      const key = `${from}→${to}`;
      if (!edgeSet.has(key)) {
        edgeSet.add(key);
        edges.push({ from, to, kind });
      }
    }

    // intelligence-api calls V1
    addEdge('intelligence-api', 'lcis-v1', 'proxies');
    // intelligence-api is the gateway for the API
    addEdge('lcis-v2-api', 'intelligence-api', 'exposes');

    for (const sub of subsystems) {
      // From actual import scanning
      for (const dep of sub.dependsOnSubsystems) {
        addEdge(sub.name, dep, 'imports');
      }
      // From static dep map (catches lazy dynamic imports)
      for (const dep of sub.staticDependsOn) {
        addEdge(sub.name, dep, 'depends-on');
      }
    }

    const artifact = {
      generatedAt: new Date().toISOString(),
      description: 'LCIS V2 System Graph — subsystem interaction topology',
      nodeCount: nodes.length,
      edgeCount: edges.length,
      nodes,
      edges,
    };

    const path = writeArtifact('LCIS_SYSTEM_GRAPH.json', artifact);
    return { path, nodeCount: nodes.length, edgeCount: edges.length };
  }

  // -------------------------------------------------------------------------
  // generateDependencyModel
  // -------------------------------------------------------------------------

  async generateDependencyModel() {
    // Load from architecture engine lazily
    let architectureData = null;
    try {
      const mod = await import('../architecture-intelligence/ArchitectureIntelligenceEngine.mjs');
      const engine = mod.default;
      architectureData = await engine.getArchitecture();
    } catch {
      // Not available — fall back to infra-intel.json
    }

    const infraIntel  = safeReadJson(resolve(REPO_ROOT, 'graphify-out/infra-intel.json'));
    const domainIntel = safeReadJson(resolve(REPO_ROOT, 'graphify-out/domain-intel.json'));

    // Build service→service dependency model from infra
    const services = {};
    const deps = [];

    if (infraIntel?.workers) {
      for (const w of infraIntel.workers) {
        services[w.name] = {
          type: 'cloudflare-worker',
          bindings: w.bindings || [],
          queuesProduced: w.queueProducers || [],
          queuesConsumed: w.queueConsumers || [],
          hasCron: (w.crons || []).length > 0,
        };
      }
    }

    if (infraIntel?.summary?.vercelApps) {
      for (const app of infraIntel.summary.vercelApps) {
        services[app] = {
          type: 'vercel-nextjs',
          callsGateway: true,
          gatewayPath: '/v1',
        };
        deps.push({ from: app, to: 'letbuyy-api', kind: 'http-proxy' });
      }
    }

    // Worker service bindings = service dependencies
    if (infraIntel?.workers) {
      for (const w of infraIntel.workers) {
        for (const b of (w.bindings || [])) {
          if (b.endsWith('_SERVICE')) {
            const target = b.replace('_SERVICE', '').toLowerCase().replace(/_/g, '-');
            deps.push({ from: w.name, to: target, kind: 'service-binding' });
          }
        }
        // Queue producers → consumers
        for (const q of (w.queueProducers || [])) {
          deps.push({ from: w.name, to: q, kind: 'queue-produce' });
        }
        for (const q of (w.queueConsumers || [])) {
          deps.push({ from: q, to: w.name, kind: 'queue-consume' });
        }
      }
    }

    // Cross-domain edges from domain intel
    const crossDomainEdges = domainIntel?.edges || [];
    const domainDeps = crossDomainEdges.map(e => ({
      from: e.from || e.source,
      to: e.to || e.target,
      kind: 'cross-domain-rpc',
      rpc: e.rpc || e.edge,
    })).filter(e => e.from && e.to);

    // From architecture engine if available
    const architectureDeps = architectureData
      ? {
          services: Object.keys(architectureData.services || {}),
          crossDomainEdgeCount: (architectureData.crossDomainEdges || []).length,
          layerViolationCount: architectureData.layerValidation?.violationCount || 0,
          moneyDomains: architectureData.moneyDomains || [],
        }
      : { note: 'Architecture engine not loaded — using infra-intel.json only' };

    const artifact = {
      generatedAt: new Date().toISOString(),
      description: 'LCIS V2 Dependency Model — platform service and domain dependencies',
      services,
      serviceDependencies: deps,
      crossDomainDependencies: domainDeps,
      architectureSummary: architectureDeps,
      stats: {
        serviceCount: Object.keys(services).length,
        serviceDependencyCount: deps.length,
        crossDomainDependencyCount: domainDeps.length,
      },
    };

    const path = writeArtifact('LCIS_DEPENDENCY_MODEL.json', artifact);
    return { path, serviceCount: Object.keys(services).length, depCount: deps.length + domainDeps.length };
  }

  // -------------------------------------------------------------------------
  // generateOperationalModel
  // -------------------------------------------------------------------------

  async generateOperationalModel() {
    const infraIntel   = safeReadJson(resolve(REPO_ROOT, 'graphify-out/infra-intel.json'));
    const domainIntel  = safeReadJson(resolve(REPO_ROOT, 'graphify-out/domain-intel.json'));
    const runtimeIntel = safeReadJson(resolve(REPO_ROOT, 'graphify-out/runtime-intel.json'));

    // Load context architecture graph lazily
    let archGraph = null;
    try {
      const mod = await import('../context-intelligence/ArchitectureGraphBuilder.mjs');
      const builder = mod.default;
      await builder.build();
      archGraph = { nodes: builder.getNodes(), edges: builder.getEdges() };
    } catch {
      // fall back
    }

    // ---- Incident emergence model ----
    const incidentEmergenceSteps = [
      { step: 1, name: 'Signal Detection',    description: 'Cloudflare Analytics Engine emits error rate spike or latency p99 breach; queue depth exceeds threshold; RPC error count rises' },
      { step: 2, name: 'Anomaly Correlation', description: 'AnomalyDetectionService correlates across metric streams; IncidentDetectionService classifies severity' },
      { step: 3, name: 'Domain Attribution',  description: 'LCIS maps the failing route/rpc/table to its owning domain (domain-intel.json); blast radius computed' },
      { step: 4, name: 'Incident Creation',   description: 'Incident object created with: domain, severity, affected RPCs/routes, affected merchants, evidence, timestamp' },
      { step: 5, name: 'Escalation',          description: 'Runbook escalation chain invoked; on-call paged; rollback candidate identified from deployment-state.json' },
      { step: 6, name: 'Recovery',            description: 'Rollback or fix applied; migration gate re-evaluated; health probe confirms green; incident closed' },
    ];

    // ---- Deployment propagation model ----
    const deploymentPropagationSteps = [
      { step: 1, name: 'CI Trigger',           description: 'GitHub Actions push to stepup/* or main; security-review.yml runs (Anthropic claude-code-security-review)' },
      { step: 2, name: 'Validation Gate',      description: 'validate-governance.mjs runs (107 validators); build gate (pnpm --filter <app> build); two-lane merge rule checked' },
      { step: 3, name: 'Migration Gate',       description: 'hasMigrateGate=true: Supabase migrations applied before worker deploy; schema validated against RLS policies' },
      { step: 4, name: 'Worker Deploy',        description: 'wrangler deploy for letbuyy-api, letbuyy-queue-workers, letbuyy-webhook, letbuyy-mobile-bff via GitHub Actions' },
      { step: 5, name: 'Vercel Deploy',        description: 'Vercel deploys: marketing-site, identity-platform, merchant-web, customer-web, admin-web' },
      { step: 6, name: 'Health Probe',         description: 'Post-deploy health probes; deployment-state.json updated; LCIS re-reads runtime topology' },
      { step: 7, name: 'Merchant Visibility',  description: 'All tenants share the same schema/workers — a deploy is instant for all merchants simultaneously' },
    ];

    // ---- Failure propagation paths ----
    const failurePropagationPaths = [
      {
        domain: 'payments',
        failurePoint: 'Razorpay webhook delivery failure or HMAC mismatch',
        cascade: ['confirm_order_payment_with_ledger not called', 'order stuck in PENDING_PAYMENT', 'inventory not decremented', 'gift-card not applied', 'customer sees no confirmation'],
        affectedDomains: ['orders', 'inventory', 'gift-cards', 'customers'],
        recoveryPath: 'Replay webhook from Razorpay dashboard; idempotency_key prevents double-credit',
      },
      {
        domain: 'api-gateway',
        failurePoint: 'letbuyy-api worker crash / CPU limit',
        cascade: ['All /v1/* routes 503', 'merchant-web loses all data APIs', 'storefront checkout fails', 'queue producers fail (EVENT_QUEUE, ANALYTICS_QUEUE)', 'webhook-service cannot call gateway'],
        affectedDomains: ['all — gateway is single bottleneck'],
        recoveryPath: 'Cloudflare auto-restarts Worker; wrangler rollback to prior version',
      },
      {
        domain: 'database',
        failurePoint: 'Supabase Postgres outage or connection exhaustion',
        cascade: ['All SECURITY DEFINER RPCs fail', 'money mutations blocked', 'RLS policies unevaluatable', 'auth token verification may fail'],
        affectedDomains: ['all — single Postgres instance'],
        recoveryPath: 'Supabase failover (managed); pgbouncer pooler reset; retry logic in db.rpc',
      },
      {
        domain: 'queue-workers',
        failurePoint: 'letbuyy-queue-workers crash or DLQ saturation',
        cascade: ['EVENT_QUEUE messages back-fill', 'analytics events lost', 'search index stale', 'notification emails delayed or lost', 'cron (17 */6 * * *) misses'],
        affectedDomains: ['analytics', 'search', 'notifications', 'events'],
        recoveryPath: 'wrangler rollback; DLQ replay; analytics backfill from ledger',
      },
      {
        domain: 'identity-platform',
        failurePoint: 'ES256 JWK endpoint down',
        cascade: ['Merchant JWT verification fails in api-gateway', 'All authenticated merchant routes 401', 'Merchant cannot manage store', 'New merchant onboarding blocked'],
        affectedDomains: ['auth', 'merchants', 'products', 'orders', 'settings'],
        recoveryPath: 'Vercel redeploy identity-platform; JWK cached in gateway (short TTL)',
      },
    ];

    // ---- Operational topology ----
    const operationalTopology = {
      workers: infraIntel?.workers?.map(w => ({
        name: w.name,
        queuesProduced: w.queueProducers || [],
        queuesConsumed: w.queueConsumers || [],
        hasCron: (w.crons || []).length > 0,
        cronSchedules: w.crons || [],
      })) || [],
      vercelApps: infraIntel?.summary?.vercelApps || [],
      queueDepth: {
        producers: infraIntel?.summary?.queueProducers || [],
        consumers: infraIntel?.summary?.queueConsumers || [],
      },
      providers: infraIntel?.summary?.providers || [],
    };

    // ---- Ops how-it-works ----
    const operationsHowItWorks = [
      'All merchant stores share the same Cloudflare Workers + Postgres schema (multi-tenant, site_id partitioned)',
      'Money mutations go exclusively through SECURITY DEFINER RPCs — never direct table writes',
      'Deployments are atomic per Cloudflare Worker — all merchants see the new version simultaneously',
      'Queue workers process async events (analytics, search, notifications) separately from the gateway',
      'RLS policies enforce tenant isolation at the DB layer — service-role access only through verifySiteOwnership',
      'Webhooks are HMAC-signed (signQueueTenantEnvelope) before enqueue; verified on delivery',
      'The two-lane merge rule prevents concurrent infra and feature deploys from conflicting',
      'LCIS monitors the operational state via /api/runtime, /api/operations, /api/deployment-state',
    ];

    const artifact = {
      generatedAt: new Date().toISOString(),
      description: 'LCIS V2 Operational Model — how operations function, incidents emerge, failures propagate, deployments propagate',
      operationalTopology,
      incidentEmergence: {
        summary: 'Incidents emerge from signal → anomaly → domain attribution → escalation → recovery',
        steps: incidentEmergenceSteps,
      },
      deploymentPropagation: {
        summary: 'CI → validate → migrate → worker deploy → Vercel deploy → health probe',
        steps: deploymentPropagationSteps,
      },
      failurePropagation: {
        summary: 'Failure in any critical path cascades through the dependency chain',
        paths: failurePropagationPaths,
      },
      operationsHowItWorks,
      archGraphNodeCount: archGraph?.nodes?.length ?? null,
      archGraphEdgeCount: archGraph?.edges?.length ?? null,
      runtimeIntelPresent: !!runtimeIntel,
    };

    const path = writeArtifact('LCIS_OPERATIONAL_MODEL.json', artifact);
    return { path, failurePathCount: failurePropagationPaths.length, deployStepCount: deploymentPropagationSteps.length };
  }

  // -------------------------------------------------------------------------
  // generateIntelligenceModel
  // -------------------------------------------------------------------------

  async generateIntelligenceModel() {
    // Questions LCIS can answer and their connection status
    const questionAnswerMap = [
      { question: 'Where is X implemented?',                      endpoint: '/api/search',            connected: true,  connectedNote: 'code graph + domain-intel.json' },
      { question: 'What breaks if I change X?',                   endpoint: '/api/blast',             connected: true,  connectedNote: 'graphify blast-radius' },
      { question: 'Who owns X?',                                   endpoint: '/api/owner',             connected: true,  connectedNote: 'CODEOWNERS + domain-intel.json' },
      { question: 'What tables/policies/triggers affect table T?', endpoint: '/api/table',             connected: true,  connectedNote: 'db-intel.json' },
      { question: 'What does RPC R touch / who calls it?',        endpoint: '/api/rpc',               connected: true,  connectedNote: 'db-intel.json' },
      { question: 'What policies are on table T?',                 endpoint: '/api/policy',            connected: true,  connectedNote: 'db-intel.json' },
      { question: 'What is live / currently failing?',             endpoint: '/api/runtime',           connected: false, notConnectedNote: 'Requires Cloudflare Analytics Engine telemetry adapter' },
      { question: 'How much revenue / money risk?',                endpoint: '/api/revenue-v2',        connected: false, notConnectedNote: 'Requires ledger reconciliation RPC queries' },
      { question: 'Which merchants are affected?',                  endpoint: '/api/merchant-intelligence', connected: false, notConnectedNote: 'Requires live tenant telemetry' },
      { question: 'Security posture / attack surface?',            endpoint: '/api/security',          connected: true,  connectedNote: 'db-intel.json + infra-intel.json' },
      { question: 'Is it production-ready?',                       endpoint: '/api/production-readiness-v2', connected: true, connectedNote: 'structural analysis from graphify' },
      { question: 'What should be fixed next?',                    endpoint: '/api/decision-v2',       connected: true,  connectedNote: 'fix-engine.json + production-readiness-v2.json' },
      { question: 'What are the business domains?',               endpoint: '/api/domains',           connected: true,  connectedNote: 'domain-intel.json' },
      { question: 'What breaks if domain D changes?',             endpoint: '/api/cross-domain',      connected: true,  connectedNote: 'domain-intel.json cross-domain edges' },
      { question: 'What infrastructure deploys X?',               endpoint: '/api/deployment',        connected: true,  connectedNote: 'infra-intel.json + deployment-state.json' },
      { question: 'How do incidents emerge?',                      endpoint: '/api/incident',          connected: true,  connectedNote: 'incident-intelligence-v5.json + topology' },
      { question: 'What are the current memory/decisions?',        endpoint: '/api/memory-v2',         connected: true,  connectedNote: 'memory-intel.json' },
      { question: 'Explain a domain in plain language',            endpoint: '/api/explain',           connected: true,  connectedNote: 'domain-intel.json + capabilities model' },
      { question: 'What is the full lineage of entity X?',        endpoint: '/api/lineage',           connected: true,  connectedNote: 'db-intel.json + graph.json' },
      { question: 'What are live provider statuses?',             endpoint: '/api/live-adapters',     connected: false, notConnectedNote: 'Requires provider credentials (SUPABASE_URL, CF_API_TOKEN, etc.)' },
      { question: 'How does LetBuyy work?',                        endpoint: '/api/self-model/platform', connected: true, connectedNote: 'SelfModelBuilder + PlatformExplainer' },
      { question: 'How does LCIS work?',                           endpoint: '/api/self-model/lcis',  connected: true,  connectedNote: 'LCIS_SELF_MODEL.json + LCIS_SYSTEM_GRAPH.json' },
    ];

    // Load available graphify-out artifacts
    const outDir = resolve(REPO_ROOT, 'graphify-out');
    let availableArtifacts = [];
    try {
      availableArtifacts = readdirSync(outDir)
        .filter(f => f.endsWith('.json'))
        .map(f => {
          const full = join(outDir, f);
          try {
            const stat = statSync(full);
            return { file: f, bytes: stat.size, mtime: stat.mtime.toISOString() };
          } catch {
            return { file: f };
          }
        });
    } catch {
      // graphify-out not readable
    }

    // Query routing map: natural-language question pattern → subsystem → endpoint
    const queryRoutingMap = [
      { pattern: 'what breaks if|blast radius|impact of',          subsystem: 'graph-engine',              endpoint: '/api/blast',              v1Delegate: true },
      { pattern: 'who owns|ownership',                             subsystem: 'architecture-intelligence',  endpoint: '/api/owner',              v1Delegate: true },
      { pattern: 'security|rls|policy|attack surface|jwt|hmac',   subsystem: 'graph-engine',              endpoint: '/api/security',           v1Delegate: true },
      { pattern: 'incident|failing|down|error rate|outage',        subsystem: 'observability',             endpoint: '/api/incident',           v1Delegate: false },
      { pattern: 'domain|business domain|cross-domain',           subsystem: 'architecture-intelligence',  endpoint: '/api/domain',             v1Delegate: true },
      { pattern: 'deploy|release|vercel|worker|ci|migration',     subsystem: 'architecture-intelligence',  endpoint: '/api/deployment',         v1Delegate: true },
      { pattern: 'memory|decision|rule|why was|history',           subsystem: 'memory-engine',             endpoint: '/api/memory-v2',          v1Delegate: false },
      { pattern: 'how does letbuyy|platform|explain|onboard',      subsystem: 'self-model',                endpoint: '/api/explain',            v1Delegate: false },
      { pattern: 'fix next|production ready|blockers|launch',      subsystem: 'reasoning',                 endpoint: '/api/decision-v2',        v1Delegate: true },
      { pattern: 'live|real-time|metrics|telemetry|current traffic', subsystem: 'observability',           endpoint: '/api/runtime',            v1Delegate: false },
      { pattern: 'dependency|imports|uses|depends on|package',     subsystem: 'context-intelligence',      endpoint: '/api/dependencies',       v1Delegate: false },
      { pattern: 'table|rpc|trigger|index|policy|db|database',    subsystem: 'graph-engine',              endpoint: '/api/table',              v1Delegate: true },
    ];

    // Connected vs NOT CONNECTED summary
    const connected    = questionAnswerMap.filter(q => q.connected);
    const notConnected = questionAnswerMap.filter(q => !q.connected);

    const artifact = {
      generatedAt: new Date().toISOString(),
      description: 'LCIS V2 Intelligence Model — what LCIS knows, what it answers, and how queries route',
      availableArtifacts,
      questionAnswerMap,
      queryRoutingMap,
      summary: {
        totalQuestions: questionAnswerMap.length,
        connectedCount: connected.length,
        notConnectedCount: notConnected.length,
        connectedQuestions: connected.map(q => q.question),
        notConnectedQuestions: notConnected.map(q => ({
          question: q.question,
          requiredFor: q.notConnectedNote,
        })),
        artifactCount: availableArtifacts.length,
      },
    };

    const path = writeArtifact('LCIS_INTELLIGENCE_MODEL.json', artifact);
    return { path, questionCount: questionAnswerMap.length, connectedCount: connected.length };
  }

  // -------------------------------------------------------------------------
  // build() — orchestrates all generators
  // -------------------------------------------------------------------------

  async build() {
    const t0 = Date.now();
    ensureOutDir();

    const results = {};
    const errors = [];

    const tasks = [
      ['selfModel',         () => this.generateSelfModel()],
      ['systemGraph',       () => this.generateSystemGraph()],
      ['dependencyModel',   () => this.generateDependencyModel()],
      ['operationalModel',  () => this.generateOperationalModel()],
      ['intelligenceModel', () => this.generateIntelligenceModel()],
    ];

    for (const [key, fn] of tasks) {
      try {
        results[key] = await fn();
      } catch (err) {
        errors.push({ artifact: key, error: err.message });
        results[key] = { error: err.message };
      }
    }

    const elapsed = Date.now() - t0;
    const subsystems = this._getSubsystems();

    const stats = {
      success: errors.length === 0,
      elapsed_ms: elapsed,
      subsystemsDetected: subsystems.length,
      subsystemsPresent: subsystems.filter(s => s.exists).length,
      totalMjsFiles: subsystems.reduce((s, sub) => s + sub.fileCount, 0),
      totalClasses: subsystems.reduce((s, sub) => s + sub.classes.length, 0),
      artifactsWritten: Object.keys(results).filter(k => !results[k]?.error).length,
      outputDir: OUT_DIR,
      errors,
    };

    return {
      success: errors.length === 0,
      artifacts: results,
      stats,
    };
  }
}

const builder = new SelfModelBuilder();
export default builder;

// CLI entrypoint
if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  builder.build()
    .then(r => {
      console.log(JSON.stringify(r.stats, null, 2));
      if (!r.success) process.exit(1);
    })
    .catch(err => {
      console.error('SelfModelBuilder fatal:', err.message);
      process.exit(1);
    });
}
