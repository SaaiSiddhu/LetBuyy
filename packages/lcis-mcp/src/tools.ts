/**
 * LCIS MCP tool registry — pure, testable, side-effect-free.
 *
 * Each entry declares: name, description, inputSchema (zod raw shape),
 * and a handler that calls the lcis-core engine and returns a structured
 * ToolResult carrying evidence + confidence + source + timestamp.
 *
 * READ-ONLY CONTRACT: handlers call only read methods on the engine.
 * No fs writes, no process spawning, no network fetch, no eval.
 */
import { z } from 'zod';
import {
  type LcisEngine,
  Timer,
  envelope,
  newRequestId,
} from '@letbuyy/lcis-core';
import { createLivePlatform } from '@letbuyy/lcis-live';
import { getEisEngine, type ChangeRequest } from '@letbuyy/lcis-execution';
import { getGovernanceEngine } from '@letbuyy/lcis-governance';
import { getOperationsEngine } from '@letbuyy/lcis-operations';
import { getEngineeringEngine, type FeatureRequest } from '@letbuyy/lcis-engineering';
import { getOrchestrationEngine } from '@letbuyy/lcis-orchestration';

// ── Types ──────────────────────────────────────────────────────────────────

export type ToolResult = { content: [{ type: 'text'; text: string }] };

export interface ToolDef<TShape extends z.ZodRawShape | Record<string, never>> {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: TShape;
  handler(input: z.infer<z.ZodObject<TShape>>, engine: LcisEngine): Promise<ToolResult>;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function ok(text: string): ToolResult {
  return { content: [{ type: 'text', text }] };
}

function toText(data: unknown, source: string, executionTime: number): ToolResult {
  // Bubble up any evidence array embedded in the data so the envelope has it at top level.
  const dataEvidence =
    data !== null && typeof data === 'object' && 'evidence' in (data as object)
      ? ((data as Record<string, unknown>)['evidence'] as readonly unknown[])
      : [];
  const env = envelope({
    data,
    source,
    executionTime,
    evidence: dataEvidence as readonly string[],
  });
  return ok(JSON.stringify(env, null, 2));
}

function notFound(subject: string, source: string, ms: number): ToolResult {
  return toText({ found: false, subject, note: 'unknown — not in graph artifacts; run pnpm graph:omega to refresh' }, source, ms);
}

// ── Tool definitions ───────────────────────────────────────────────────────

const blastTool: ToolDef<{ symbol: z.ZodString }> = {
  name: 'lcis_blast',
  description:
    'What breaks if this symbol/function/module changes? Returns impacted nodes, files, and layers from the LCIS code graph. Cite evidence for every finding.',
  inputSchema: { symbol: z.string().min(1).describe('Symbol name, function, or module to analyse (e.g. "getSupabaseAdmin")') },
  async handler({ symbol }, engine) {
    const t = new Timer();
    const result = engine.blast.blast(symbol);
    const ms = t.ms();
    if (!result) return notFound(symbol, 'blast-radius', ms);
    const data = {
      found: true,
      symbol,
      impactedNodes: result.impactedNodes,
      impactedFiles: result.impactedFiles,
      layers: result.layers,
      topImpacted: result.topImpacted,
      artifact: result.artifact,
      evidence: [
        { source: 'code-graph', ref: `graphify-out/graph.json#${symbol}`, value: `${result.impactedNodes} nodes, ${result.impactedFiles} files` },
      ],
    };
    return toText(data, 'blast-radius', ms);
  },
};

const explainTool: ToolDef<{ entity: z.ZodString }> = {
  name: 'lcis_explain',
  description:
    'Explain a domain, service, or architecture entity in plain language — purpose, criticality, failure impact, owners, tables, RPCs, queues, secrets.',
  inputSchema: { entity: z.string().min(1).describe('Domain key (e.g. "payments"), service name (e.g. "api-gateway"), or "architecture" / "runtime"') },
  async handler({ entity }, engine) {
    const t = new Timer();
    let explanation: Awaited<ReturnType<typeof engine.architecture.explainDomain>>;
    const lower = entity.toLowerCase();
    if (lower === 'architecture') {
      explanation = await engine.architecture.explainArchitecture();
    } else if (lower === 'runtime') {
      explanation = await engine.architecture.explainRuntime();
    } else {
      // Try domain first, fall back to service
      const domainExp = await engine.architecture.explainDomain(entity);
      if (domainExp.summary.startsWith('Domain \'' + entity + '\' not found')) {
        explanation = await engine.architecture.explainService(entity);
      } else {
        explanation = domainExp;
      }
    }
    const ms = t.ms();
    const data = {
      found: true,
      entity,
      kind: explanation.kind,
      summary: explanation.summary,
      detail: explanation.detail,
      evidence: explanation.evidence,
    };
    return toText(data, 'architecture', ms);
  },
};

const verifyTool: ToolDef<{ entity: z.ZodString }> = {
  name: 'lcis_verify',
  description:
    'Verify the architecture, production readiness, or runtime of LetBuyy. Returns VERIFIED/PARTIAL/UNVERIFIED/REFUTED with weighted confidence and evidence gaps.',
  inputSchema: { entity: z.string().min(1).describe('What to verify: "architecture", "production-readiness", "runtime", or "security"') },
  async handler({ entity }, engine) {
    const t = new Timer();
    let result: Awaited<ReturnType<typeof engine.verification.verifyArchitecture>>;
    const lower = entity.toLowerCase();
    if (lower === 'production-readiness' || lower === 'readiness') {
      result = await engine.verification.verifyProductionReadiness();
    } else if (lower === 'runtime') {
      result = await engine.verification.verifyRuntime();
    } else if (lower === 'security' || lower === 'domains') {
      result = await engine.verification.verifyDomains();
    } else {
      result = await engine.verification.verifyArchitecture();
    }
    const ms = t.ms();
    const data = {
      found: true,
      entity,
      status: result.status,
      confidence: result.confidence,
      evidence: result.evidence,
      gaps: result.gaps,
    };
    return toText(data, 'verification', ms);
  },
};

const memoryTool: ToolDef<{ query: z.ZodString }> = {
  name: 'lcis_memory',
  description:
    'Search the LCIS governance/decision corpus with BM25. Returns decisions, architecture rules, runbooks, and migration notes relevant to your query.',
  inputSchema: { query: z.string().min(1).describe('Natural language or keyword query (e.g. "canonical ledger money RPC", "step-up auth refund")') },
  async handler({ query }, engine) {
    const t = new Timer();
    const requestId = newRequestId();
    const hits = engine.memory.search(query, { limit: 8 });
    const citations = engine.memory.cite(query, 5);
    const ms = t.ms();
    const found = hits.length > 0;
    const data = {
      found,
      query,
      hits,
      citations,
      evidence: found
        ? hits.map((h) => ({ source: h.type, ref: h.source, value: h.section }))
        : [{ source: 'memory-corpus', ref: 'BM25 index', value: 'no results — corpus may be empty or query too narrow' }],
      requestId,
    };
    return toText(data, 'memory', ms);
  },
};

const decisionTool: ToolDef<{ subject: z.ZodString }> = {
  name: 'lcis_decision',
  description:
    'Rank risks, fixes, or trace a specific decision. Subject can be: "risks", "fixes", "launch", "scale", or a decision/blocker id like "LB-7".',
  inputSchema: { subject: z.string().min(1).describe('What to query: "risks", "fixes", "launch", "scale", or a specific id like "LB-7" or "payments"') },
  async handler({ subject }, engine) {
    const t = new Timer();
    const lower = subject.toLowerCase();
    let data: Record<string, unknown>;

    if (lower === 'launch') {
      const verdict = engine.decision.launchVerdict();
      data = {
        found: true,
        subject,
        kind: 'launch-verdict',
        verdict,
        evidence: [{ source: 'execution-intel', ref: 'launchVerdict', value: String(verdict.verdict ?? 'unknown') }],
      };
    } else if (lower === 'scale') {
      const tiers = engine.decision.scaleTiers();
      data = {
        found: true,
        subject,
        kind: 'scale-tiers',
        tiers,
        evidence: [{ source: 'decision-engine-v2', ref: 'blocksScale', value: 'structural observations; capacity requires load test' }],
      };
    } else if (lower === 'risks') {
      const risks = engine.decision.rankRisks();
      data = {
        found: risks.length > 0,
        subject,
        kind: 'ranked-risks',
        count: risks.length,
        risks: risks.slice(0, 10),
        evidence: risks.slice(0, 3).flatMap((r) => r.evidence),
      };
    } else if (lower === 'fixes') {
      const fixes = engine.decision.rankFixes();
      data = {
        found: fixes.length > 0,
        subject,
        kind: 'ranked-fixes',
        count: fixes.length,
        fixes: fixes.slice(0, 10),
        evidence: fixes.slice(0, 3).flatMap((f) => f.evidence),
      };
    } else {
      // Try trace by id
      const trace = engine.decision.trace(subject);
      const found = trace.score > 0 || trace.rank !== -1;
      data = {
        found,
        subject,
        kind: 'trace',
        trace,
        evidence: trace.evidence,
        note: found ? undefined : 'not found in ranked risks — may not be a known blocker id',
      };
    }

    const ms = t.ms();
    return toText(data, 'decision', ms);
  },
};

const healthTool: ToolDef<Record<string, never>> = {
  name: 'lcis_health',
  description:
    'Report overall LCIS engine health: graph stats, artifact availability, cache stats, and engine version.',
  inputSchema: {},
  async handler(_input, engine) {
    const t = new Timer();
    const nodeCount = engine.graph.nodeCount();
    const edgeCount = engine.graph.edgeCount();
    const commit = engine.graph.commit();
    const cache = engine.store.cacheStats();
    const ms = t.ms();
    const data = {
      found: true,
      status: nodeCount > 0 ? 'healthy' : 'degraded — graph not loaded',
      graph: { nodeCount, edgeCount, commit },
      cache,
      evidence: [
        { source: 'code-graph', ref: 'graphify-out/graph.json', value: `${nodeCount} nodes, ${edgeCount} edges` },
        { source: 'artifact-store', ref: 'ArtifactStore.cacheStats()', value: `hits=${cache.hits} misses=${cache.misses} size=${cache.size}` },
      ],
    };
    return toText(data, 'health', ms);
  },
};

const graphStatsTool: ToolDef<Record<string, never>> = {
  name: 'lcis_graph_stats',
  description:
    'Return graph node count, edge count, and git commit of the current LCIS code graph artifact.',
  inputSchema: {},
  async handler(_input, engine) {
    const t = new Timer();
    const nodeCount = engine.graph.nodeCount();
    const edgeCount = engine.graph.edgeCount();
    const commit = engine.graph.commit();
    const ms = t.ms();
    const data = {
      found: nodeCount > 0,
      nodeCount,
      edgeCount,
      commit,
      evidence: [
        { source: 'code-graph', ref: 'graphify-out/graph.json#metadata', value: `nodes=${nodeCount} edges=${edgeCount} commit=${commit ?? 'unknown'}` },
      ],
    };
    return toText(data, 'graph', ms);
  },
};

// ── Live tools ─────────────────────────────────────────────────────────────

const liveStatusTool: ToolDef<Record<string, never>> = {
  name: 'lcis_live_status',
  description:
    'Return the current operational status of all live adapters (Supabase, GitHub, Cloudflare, Vercel). Reports NOT_CONNECTED with the exact missing env vars when no credentials are present — honest, never fabricated.',
  inputSchema: {},
  async handler(_input, _engine) {
    const t = new Timer();
    const p = createLivePlatform();
    const liveStatus = await p.status();
    const ms = t.ms();
    const notConnected = liveStatus.adapters.filter((a) => a.status === 'NOT_CONNECTED').map((a) => a.adapter);
    const connected = liveStatus.adapters.filter((a) => a.status === 'CONNECTED').map((a) => a.adapter);
    const data = {
      found: true,
      generatedAt: liveStatus.generatedAt,
      adapters: liveStatus.adapters.map((a) => ({
        name: a.adapter,
        status: a.status,
        notConnectedReason: a.status === 'NOT_CONNECTED' ? 'Live data not available — provider credentials not configured' : undefined,
      })),
      connected,
      notConnected,
      evidence: [
        {
          source: 'lcis-live',
          ref: 'LivePlatform.status()',
          value: `${connected.length} CONNECTED, ${notConnected.length} NOT_CONNECTED`,
        },
      ],
    };
    return toText(data, 'live-status', ms);
  },
};

const liveInvestigateTool: ToolDef<{ subject: z.ZodString }> = {
  name: 'lcis_live_investigate',
  description:
    'Correlate a subject (e.g. "payments", "checkout", "auth") against live adapter facts + the LCIS blast radius graph. Returns contributing adapters, NOT_CONNECTED adapters with exact env var requirements, and structural correlation evidence.',
  inputSchema: { subject: z.string().min(1).describe('Subject to investigate — domain key, workflow, or keyword (e.g. "payments", "checkout", "database")') },
  async handler({ subject }, _engine) {
    const t = new Timer();
    const p = createLivePlatform();
    const result = await p.investigate(subject);
    const ms = t.ms();
    const data = {
      found: true,
      subject: result.subject,
      generatedAt: result.generatedAt,
      correlation: result.correlation,
      contributingAdapters: result.contributingAdapters,
      notConnected: result.notConnected,
      notConnectedNote: result.notConnected.length > 0
        ? `${result.notConnected.join(', ')}: live signals NOT_CONNECTED — structural blast radius only`
        : undefined,
      evidence: result.evidence,
    };
    return toText(data, 'live-investigate', ms);
  },
};

const dbHealthTool: ToolDef<Record<string, never>> = {
  name: 'lcis_db_health',
  description:
    'Check the health and verification status of the Supabase/database adapter. Returns NOT_CONNECTED with the exact env vars needed (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) when credentials are absent.',
  inputSchema: {},
  async handler(_input, _engine) {
    const t = new Timer();
    const p = createLivePlatform();
    const adapter = p.adapter('supabase');
    if (!adapter) {
      const ms = t.ms();
      return toText(
        { found: false, note: 'supabase adapter not registered in live platform', evidence: [] },
        'db-health',
        ms,
      );
    }
    const [healthResult, verification] = await Promise.all([
      adapter.health(),
      adapter.verify(),
    ]);
    const ms = t.ms();
    const data = {
      found: true,
      adapter: healthResult.adapter,
      status: healthResult.status,
      latencyMs: healthResult.latencyMs,
      checkedAt: healthResult.checkedAt,
      missingEnvVars: healthResult.missingEnvVars,
      notConnectedNote: healthResult.status === 'NOT_CONNECTED'
        ? `Database live data NOT_CONNECTED — set ${(healthResult.missingEnvVars ?? []).join(', ')} to connect`
        : undefined,
      verification: { status: verification.status, findings: verification.findings },
      evidence: [
        {
          source: 'supabase-adapter',
          ref: 'AdapterHealthMonitor',
          value: `status=${healthResult.status} latency=${healthResult.latencyMs ?? 'N/A'}ms`,
        },
      ],
    };
    return toText(data, 'db-health', ms);
  },
};

const recentChangesTool: ToolDef<Record<string, never>> = {
  name: 'lcis_recent_changes',
  description:
    'Return recent deployment and commit facts from the GitHub adapter. Reports NOT_CONNECTED when GITHUB_TOKEN is absent — structural last-commit info from lcis-core graph metadata is always available.',
  inputSchema: {},
  async handler(_input, engine) {
    const t = new Timer();
    const p = createLivePlatform();
    const liveStatus = await p.status();
    const ms = t.ms();

    // Structural commit info always available from graph artifact
    const commit = engine.graph.commit();

    const githubSnap = liveStatus.adapters.find((a) => a.adapter === 'github');
    const liveFacts =
      githubSnap?.status === 'CONNECTED' &&
      Array.isArray((githubSnap.payload as { facts?: unknown[] } | null)?.facts)
        ? (githubSnap.payload as { facts: unknown[] }).facts
        : [];

    const data = {
      found: true,
      structuralCommit: commit ?? 'unknown — run pnpm graph:omega to refresh',
      githubStatus: githubSnap?.status ?? 'NOT_CONNECTED',
      notConnectedNote: githubSnap?.status !== 'CONNECTED'
        ? 'Live GitHub deployment facts NOT_CONNECTED — set GITHUB_TOKEN to connect'
        : undefined,
      liveFacts,
      evidence: [
        { source: 'code-graph', ref: 'graphify-out/graph.json#metadata.commit', value: commit ?? 'unknown' },
        { source: 'github-adapter', ref: 'LivePlatform.status()', value: githubSnap?.status ?? 'NOT_CONNECTED' },
      ],
    };
    return toText(data, 'recent-changes', ms);
  },
};

const deploymentStatusTool: ToolDef<Record<string, never>> = {
  name: 'lcis_deployment_status',
  description:
    'Return deployment status from the GitHub and Vercel adapters. Reports NOT_CONNECTED for each provider when credentials are absent (GITHUB_TOKEN, VERCEL_TOKEN), with exact env var names.',
  inputSchema: {},
  async handler(_input, _engine) {
    const t = new Timer();
    const p = createLivePlatform();
    const liveStatus = await p.status();
    const ms = t.ms();

    const githubSnap = liveStatus.adapters.find((a) => a.adapter === 'github');
    const vercelSnap = liveStatus.adapters.find((a) => a.adapter === 'vercel');

    const providers = [githubSnap, vercelSnap].filter(Boolean).map((snap) => ({
      name: snap!.adapter,
      status: snap!.status,
      notConnectedNote: snap!.status === 'NOT_CONNECTED'
        ? `${snap!.adapter} live deployment data NOT_CONNECTED — provider credentials not configured`
        : undefined,
      facts:
        snap!.status === 'CONNECTED' &&
        Array.isArray((snap!.payload as { facts?: unknown[] } | null)?.facts)
          ? (snap!.payload as { facts: unknown[] }).facts
          : [],
    }));

    const allNotConnected = providers.every((pr) => pr.status === 'NOT_CONNECTED');
    const data = {
      found: true,
      generatedAt: liveStatus.generatedAt,
      providers,
      allNotConnected,
      note: allNotConnected
        ? 'All deployment providers NOT_CONNECTED — structural topology from code graph is available via lcis_blast'
        : undefined,
      evidence: providers.map((pr) => ({
        source: `${pr.name}-adapter`,
        ref: 'LivePlatform.status()',
        value: `status=${pr.status}`,
      })),
    };
    return toText(data, 'deployment-status', ms);
  },
};

// ── Plan tools (Phase 4) — EIS read-only planning ─────────────────────────

/** Shared input shape for all plan tools. */
const planInputShape = {
  request: z.string().min(1).describe('Natural-language description of the change (e.g. "Add GST filing", "Migrate checkout")'),
  domains: z.array(z.string()).optional().describe('Explicit domain seeds (e.g. ["payments", "orders"])'),
  tables: z.array(z.string()).optional().describe('Explicit table seeds (e.g. ["orders", "payment_transactions"])'),
  symbols: z.array(z.string()).optional().describe('Explicit symbol/function seeds (e.g. ["create_checkout_order"])'),
};

function buildEisRequest(input: { request: string; domains?: string[]; tables?: string[]; symbols?: string[] }): ChangeRequest {
  return { text: input.request, domains: input.domains, tables: input.tables, symbols: input.symbols };
}

const planChangeTool: ToolDef<typeof planInputShape> = {
  name: 'lcis_plan_change',
  description:
    'Analyse a proposed change: resolve affected domains/tables/symbols, assess complexity + risk, derive blast radius, and return a full ChangeAnalysis with evidence + confidence. READ-ONLY — no execution, no mutations.',
  inputSchema: planInputShape,
  async handler(input, _engine) {
    const t = new Timer();
    const eis = getEisEngine();
    const result = eis.analyze(buildEisRequest(input));
    const ms = t.ms();
    return toText(result, 'plan-change', ms);
  },
};

const planExecutionTool: ToolDef<typeof planInputShape> = {
  name: 'lcis_plan_execution',
  description:
    'Produce an execution plan for a change: work breakdown, milestones, dependency graph, checklist, and ordered implementation steps. READ-ONLY — plans only, never executes.',
  inputSchema: planInputShape,
  async handler(input, _engine) {
    const t = new Timer();
    const eis = getEisEngine();
    const result = eis.execution.planImplementation(buildEisRequest(input));
    const ms = t.ms();
    return toText(result, 'plan-execution', ms);
  },
};

const planMigrationTool: ToolDef<typeof planInputShape> = {
  name: 'lcis_plan_migration',
  description:
    'Analyse the database/schema/worker migration required for a change: targets, ordered steps, data-loss risks, reversibility, and readiness. READ-ONLY — never runs migrations.',
  inputSchema: planInputShape,
  async handler(input, _engine) {
    const t = new Timer();
    const eis = getEisEngine();
    const result = eis.migration.analyzeMigration(buildEisRequest(input));
    const ms = t.ms();
    return toText(result, 'plan-migration', ms);
  },
};

const planTestsTool: ToolDef<typeof planInputShape> = {
  name: 'lcis_plan_tests',
  description:
    'Generate a test plan for a change: required tests, missing coverage gaps, regression/smoke/load/security/acceptance plans, and coverage confidence. READ-ONLY.',
  inputSchema: planInputShape,
  async handler(input, _engine) {
    const t = new Timer();
    const eis = getEisEngine();
    const result = eis.testing.generateTestPlan(buildEisRequest(input));
    const ms = t.ms();
    return toText(result, 'plan-tests', ms);
  },
};

const planRollbackTool: ToolDef<typeof planInputShape> = {
  name: 'lcis_plan_rollback',
  description:
    'Generate a rollback plan for a change: ordered rollback steps, irreversible changes, readiness verdict, complexity, and estimated recovery. READ-ONLY — never executes rollbacks.',
  inputSchema: planInputShape,
  async handler(input, _engine) {
    const t = new Timer();
    const eis = getEisEngine();
    const result = eis.rollback.generateRollbackPlan(buildEisRequest(input));
    const ms = t.ms();
    return toText(result, 'plan-rollback', ms);
  },
};

const planLaunchTool: ToolDef<typeof planInputShape> = {
  name: 'lcis_plan_launch',
  description:
    'Evaluate launch readiness for a change: GO/CONDITIONAL_GO/NO_GO decision, blockers, checklist items, unknowns, and structural readiness score. READ-ONLY.',
  inputSchema: planInputShape,
  async handler(input, _engine) {
    const t = new Timer();
    const eis = getEisEngine();
    const result = await eis.launch.evaluateLaunch(buildEisRequest(input));
    const ms = t.ms();
    return toText(result, 'plan-launch', ms);
  },
};

const planReleaseTool: ToolDef<typeof planInputShape> = {
  name: 'lcis_plan_release',
  description:
    'Produce the full release plan for a change: change analysis + execution + migration + tests + rollback + launch + verification plans in a single structured response. READ-ONLY.',
  inputSchema: planInputShape,
  async handler(input, _engine) {
    const t = new Timer();
    const eis = getEisEngine();
    const result = await eis.planAll(buildEisRequest(input));
    const ms = t.ms();
    return toText(result, 'plan-release', ms);
  },
};

// ── Governance tools (Phase 5 / GDIS) ─────────────────────────────────────

const driftTool: ToolDef<Record<string, never>> = {
  name: 'lcis_drift',
  description:
    'Generate an architecture drift report: structural drift findings (table/rpc/worker/queue/event/runbook/test/docs/migration/validator/ownership/security), by-kind summary, confidence, and evidence. READ-ONLY.',
  inputSchema: {},
  async handler(_input, _engine) {
    const t = new Timer();
    const gov = getGovernanceEngine();
    const report = gov.drift.generateDriftReport();
    const ms = t.ms();
    const data = {
      found: true,
      scope: report.scope,
      summary: report.summary,
      findingCount: report.findings.length,
      findings: report.findings.slice(0, 20),
      byKind: report.byKind,
      confidence: report.confidence,
      sources: report.sources,
      timestamp: report.timestamp,
      evidence: report.evidence,
    };
    return toText(data, 'governance-drift', ms);
  },
};

const complianceTool: ToolDef<Record<string, never>> = {
  name: 'lcis_compliance',
  description:
    'Generate a constitutional compliance report (rules R001–R008): compliance score 0–100, per-rule evaluations, violations with severity and evidence. READ-ONLY.',
  inputSchema: {},
  async handler(_input, _engine) {
    const t = new Timer();
    const gov = getGovernanceEngine();
    const report = gov.compliance.generateComplianceReport();
    const ms = t.ms();
    const data = {
      found: true,
      score: report.score,
      summary: report.summary,
      violationCount: report.violations.length,
      violations: report.violations.slice(0, 20),
      evaluations: report.evaluations,
      confidence: report.confidence,
      sources: report.sources,
      timestamp: report.timestamp,
      evidence: report.evidence,
    };
    return toText(data, 'governance-compliance', ms);
  },
};

const governanceTool: ToolDef<Record<string, never>> = {
  name: 'lcis_governance',
  description:
    'Generate the full constitutional governance report: healthScore 0–100, drift + compliance + ownership + security + readiness sub-reports, and a single governance summary. READ-ONLY.',
  inputSchema: {},
  async handler(_input, _engine) {
    const t = new Timer();
    const gov = getGovernanceEngine();
    const report = await gov.generateGovernanceReport();
    const ms = t.ms();
    const data = {
      found: true,
      healthScore: report.healthScore,
      summary: report.summary,
      drift: { findingCount: report.drift.findings.length, score: undefined, summary: report.drift.summary },
      compliance: { score: report.compliance.score, violationCount: report.compliance.violations.length, summary: report.compliance.summary },
      ownership: { summary: report.ownership.summary },
      security: { findingCount: report.security.findings.length, summary: report.security.summary },
      readiness: { overall: report.readiness.overall, summary: report.readiness.summary },
      confidence: report.confidence,
      sources: report.sources,
      timestamp: report.timestamp,
      evidence: report.evidence,
    };
    return toText(data, 'governance-full', ms);
  },
};

const readinessTool: ToolDef<Record<string, never>> = {
  name: 'lcis_readiness',
  description:
    'Generate a production readiness report: per-domain readiness score (0–100) across 10 factors, overall readiness, band classification (ready/conditional/not-ready/unknown), unknowns surfaced. READ-ONLY.',
  inputSchema: {},
  async handler(_input, _engine) {
    const t = new Timer();
    const gov = getGovernanceEngine();
    const report = await gov.readiness.generateReadinessReport();
    const ms = t.ms();
    const data = {
      found: true,
      overall: report.overall,
      summary: report.summary,
      scoreCount: report.scores.length,
      scores: report.scores,
      confidence: report.confidence,
      sources: report.sources,
      timestamp: report.timestamp,
      evidence: report.evidence,
    };
    return toText(data, 'governance-readiness', ms);
  },
};

const ownershipTool: ToolDef<Record<string, never>> = {
  name: 'lcis_ownership',
  description:
    'Generate an ownership coverage report: gaps (unowned domains/services/workers/queues/rpcs/tables/runbooks), per-entity-type coverage, and overall ownership summary. READ-ONLY.',
  inputSchema: {},
  async handler(_input, _engine) {
    const t = new Timer();
    const gov = getGovernanceEngine();
    const report = gov.ownership.generateOwnershipReport();
    const ms = t.ms();
    const data = {
      found: true,
      summary: report.summary,
      gapCount: report.gaps.length,
      gaps: report.gaps.slice(0, 20),
      coverage: report.coverage,
      confidence: report.confidence,
      sources: report.sources,
      timestamp: report.timestamp,
      evidence: report.evidence,
    };
    return toText(data, 'governance-ownership', ms);
  },
};

const securityDriftTool: ToolDef<Record<string, never>> = {
  name: 'lcis_security_drift',
  description:
    'Generate a security drift report: static security findings (missing-rls, jwt-drift, webhook-auth, step-up, cross-tenant, etc.), by-kind summary, severity, evidence. READ-ONLY.',
  inputSchema: {},
  async handler(_input, _engine) {
    const t = new Timer();
    const gov = getGovernanceEngine();
    const report = gov.security.generateSecurityDriftReport();
    const ms = t.ms();
    const data = {
      found: true,
      summary: report.summary,
      findingCount: report.findings.length,
      findings: report.findings.slice(0, 20),
      byKind: report.byKind,
      confidence: report.confidence,
      sources: report.sources,
      timestamp: report.timestamp,
      evidence: report.evidence,
    };
    return toText(data, 'governance-security-drift', ms);
  },
};

const architectureHealthTool: ToolDef<Record<string, never>> = {
  name: 'lcis_architecture_health',
  description:
    'Generate an architecture health view: composite score (0–100) from structural drift + compliance, findings, and health summary. READ-ONLY.',
  inputSchema: {},
  async handler(_input, _engine) {
    const t = new Timer();
    const gov = getGovernanceEngine();
    const view = gov.generateArchitectureHealth();
    const ms = t.ms();
    const data = {
      found: true,
      area: view.area,
      score: view.score,
      summary: view.summary,
      findingCount: view.findings.length,
      findings: view.findings.slice(0, 20),
      confidence: view.confidence,
      sources: view.sources,
      timestamp: view.timestamp,
      evidence: view.evidence,
    };
    return toText(data, 'governance-architecture-health', ms);
  },
};

// ── Operations tools (Phase 6 / LCOS) ─────────────────────────────────────

const runtimeOpsTool: ToolDef<Record<string, never>> = {
  name: 'lcis_runtime',
  description:
    'Generate a runtime operations report: workers, queues, cron jobs, API health, DB connectivity — what is running right now and what is degraded. Every live value is honestly NOT_CONNECTED until adapters are credentialed. READ-ONLY.',
  inputSchema: {},
  async handler(_input, _engine) {
    const t = new Timer();
    const ops = getOperationsEngine();
    const report = ops.runtime();
    const ms = t.ms();
    const data = {
      found: true,
      area: report.area,
      summary: report.summary,
      health: report.health,
      findingCount: report.findings.length,
      findings: report.findings.slice(0, 20),
      signalCount: report.signals.length,
      signals: report.signals.slice(0, 12),
      liveConnected: report.liveConnected,
      confidence: report.confidence,
      sources: report.sources,
      timestamp: report.timestamp,
      evidence: report.evidence,
    };
    return toText(data, 'lcos-runtime', ms);
  },
};

const commerceOpsTool: ToolDef<Record<string, never>> = {
  name: 'lcis_commerce',
  description:
    'Generate a commerce operations report: orders, checkout, payment transactions, refunds, gift-cards, COD, inventory — what is flowing through the commerce pipeline right now. READ-ONLY.',
  inputSchema: {},
  async handler(_input, _engine) {
    const t = new Timer();
    const ops = getOperationsEngine();
    const report = ops.commerce();
    const ms = t.ms();
    const data = {
      found: true,
      area: report.area,
      summary: report.summary,
      health: report.health,
      findingCount: report.findings.length,
      findings: report.findings.slice(0, 20),
      signalCount: report.signals.length,
      signals: report.signals.slice(0, 12),
      liveConnected: report.liveConnected,
      confidence: report.confidence,
      sources: report.sources,
      timestamp: report.timestamp,
      evidence: report.evidence,
    };
    return toText(data, 'lcos-commerce', ms);
  },
};

const merchantOpsTool: ToolDef<Record<string, never>> = {
  name: 'lcis_merchant',
  description:
    'Generate a merchant operations report: active stores, onboarding state, subscription tiers, merchant health — which tenants are healthy vs at-risk right now. READ-ONLY.',
  inputSchema: {},
  async handler(_input, _engine) {
    const t = new Timer();
    const ops = getOperationsEngine();
    const report = ops.merchant();
    const ms = t.ms();
    const data = {
      found: true,
      area: report.area,
      summary: report.summary,
      health: report.health,
      findingCount: report.findings.length,
      findings: report.findings.slice(0, 20),
      signalCount: report.signals.length,
      signals: report.signals.slice(0, 12),
      liveConnected: report.liveConnected,
      confidence: report.confidence,
      sources: report.sources,
      timestamp: report.timestamp,
      evidence: report.evidence,
    };
    return toText(data, 'lcos-merchant', ms);
  },
};

const customerOpsTool: ToolDef<Record<string, never>> = {
  name: 'lcis_customer',
  description:
    'Generate a customer operations report: active sessions, conversion funnel, cart abandonment, customer support signals — what customers are experiencing right now. READ-ONLY.',
  inputSchema: {},
  async handler(_input, _engine) {
    const t = new Timer();
    const ops = getOperationsEngine();
    const report = ops.customer();
    const ms = t.ms();
    const data = {
      found: true,
      area: report.area,
      summary: report.summary,
      health: report.health,
      findingCount: report.findings.length,
      findings: report.findings.slice(0, 20),
      signalCount: report.signals.length,
      signals: report.signals.slice(0, 12),
      liveConnected: report.liveConnected,
      confidence: report.confidence,
      sources: report.sources,
      timestamp: report.timestamp,
      evidence: report.evidence,
    };
    return toText(data, 'lcos-customer', ms);
  },
};

const deploymentOpsTool: ToolDef<Record<string, never>> = {
  name: 'lcis_deployment',
  description:
    'Generate a deployment operations report: HEAD commit, migration state, Vercel targets, Cloudflare workers — what version is deployed right now vs what the repository declares. READ-ONLY.',
  inputSchema: {},
  async handler(_input, _engine) {
    const t = new Timer();
    const ops = getOperationsEngine();
    const report = ops.deployment();
    const ms = t.ms();
    const data = {
      found: true,
      area: report.area,
      summary: report.summary,
      health: report.health,
      findingCount: report.findings.length,
      findings: report.findings.slice(0, 20),
      signalCount: report.signals.length,
      signals: report.signals.slice(0, 12),
      liveConnected: report.liveConnected,
      confidence: report.confidence,
      sources: report.sources,
      timestamp: report.timestamp,
      evidence: report.evidence,
    };
    return toText(data, 'lcos-deployment', ms);
  },
};

const incidentOpsTool: ToolDef<Record<string, never>> = {
  name: 'lcis_incident',
  description:
    'Generate an incident operations report: active/recent incidents, affected domains, blast radius, root-cause candidates, escalation paths — what is failing and who is affected. READ-ONLY.',
  inputSchema: {},
  async handler(_input, _engine) {
    const t = new Timer();
    const ops = getOperationsEngine();
    const report = ops.incident();
    const ms = t.ms();
    const data = {
      found: true,
      area: report.area,
      summary: report.summary,
      health: report.health,
      findingCount: report.findings.length,
      findings: report.findings.slice(0, 20),
      signalCount: report.signals.length,
      signals: report.signals.slice(0, 12),
      liveConnected: report.liveConnected,
      confidence: report.confidence,
      sources: report.sources,
      timestamp: report.timestamp,
      evidence: report.evidence,
    };
    return toText(data, 'lcos-incident', ms);
  },
};

const securityOpsTool: ToolDef<Record<string, never>> = {
  name: 'lcis_security_ops',
  description:
    'Generate a live security operations report: auth anomalies, RLS coverage gaps, JWT drift, webhook integrity, rate-limit bypass risk — operational security posture right now. Distinct from lcis_security_drift (governance static scan). READ-ONLY.',
  inputSchema: {},
  async handler(_input, _engine) {
    const t = new Timer();
    const ops = getOperationsEngine();
    const report = ops.security();
    const ms = t.ms();
    const data = {
      found: true,
      area: report.area,
      summary: report.summary,
      health: report.health,
      findingCount: report.findings.length,
      findings: report.findings.slice(0, 20),
      signalCount: report.signals.length,
      signals: report.signals.slice(0, 12),
      liveConnected: report.liveConnected,
      confidence: report.confidence,
      sources: report.sources,
      timestamp: report.timestamp,
      evidence: report.evidence,
    };
    return toText(data, 'lcos-security-ops', ms);
  },
};

const forecastOpsTool: ToolDef<Record<string, never>> = {
  name: 'lcis_forecast',
  description:
    'Generate an operations forecast report: trend predictions across runtime, commerce, merchant, customer, and deployment areas — what is likely to fail next or degrade. READ-ONLY.',
  inputSchema: {},
  async handler(_input, _engine) {
    const t = new Timer();
    const ops = getOperationsEngine();
    const report = ops.forecast();
    const ms = t.ms();
    const data = {
      found: true,
      area: report.area,
      summary: report.summary,
      health: report.health,
      findingCount: report.findings.length,
      findings: report.findings.slice(0, 20),
      signalCount: report.signals.length,
      signals: report.signals.slice(0, 12),
      liveConnected: report.liveConnected,
      confidence: report.confidence,
      sources: report.sources,
      timestamp: report.timestamp,
      evidence: report.evidence,
    };
    return toText(data, 'lcos-forecast', ms);
  },
};

const operationsReportTool: ToolDef<Record<string, never>> = {
  name: 'lcis_operations',
  description:
    'Generate the composite LCOS operations report: answers "what is healthy / degraded / failing / changed / at-risk / to investigate?" across all 8 areas (runtime/commerce/merchant/customer/deployment/incident/security/forecast) in one response. READ-ONLY.',
  inputSchema: {},
  async handler(_input, _engine) {
    const t = new Timer();
    const ops = getOperationsEngine();
    const report = ops.operationsReport();
    const ms = t.ms();
    const data = {
      found: true,
      summary: report.summary,
      health: report.health,
      answers: report.answers,
      areas: {
        runtime: { area: report.runtime.area, health: report.runtime.health, findingCount: report.runtime.findings.length },
        commerce: { area: report.commerce.area, health: report.commerce.health, findingCount: report.commerce.findings.length },
        merchant: { area: report.merchant.area, health: report.merchant.health, findingCount: report.merchant.findings.length },
        customer: { area: report.customer.area, health: report.customer.health, findingCount: report.customer.findings.length },
        deployment: { area: report.deployment.area, health: report.deployment.health, findingCount: report.deployment.findings.length },
        incident: { area: report.incident.area, health: report.incident.health, findingCount: report.incident.findings.length },
        security: { area: report.security.area, health: report.security.health, findingCount: report.security.findings.length },
        forecast: { area: report.forecast.area, health: report.forecast.health, findingCount: report.forecast.findings.length },
      },
      liveConnected: report.liveConnected,
      confidence: report.confidence,
      sources: report.sources,
      timestamp: report.timestamp,
      evidence: report.evidence,
    };
    return toText(data, 'lcos-operations', ms);
  },
};

// ── Engineering tools (Phase 7 / EINS) ────────────────────────────────────

/** Shared input shape for all EINS engineering tools. */
const einsInputShape = {
  request: z.string().min(1).describe('Natural-language description of the feature/change to engineer (e.g. "Add GST filing", "Implement cart abandonment recovery")'),
  domains: z.array(z.string()).optional().describe('Explicit domain seeds (e.g. ["payments", "orders"])'),
  tables: z.array(z.string()).optional().describe('Explicit table seeds (e.g. ["orders", "payment_transactions"])'),
  symbols: z.array(z.string()).optional().describe('Explicit symbol/function seeds (e.g. ["create_checkout_order"])'),
};

function buildEinsRequest(input: { request: string; domains?: string[]; tables?: string[]; symbols?: string[] }): FeatureRequest {
  return { text: input.request, domains: input.domains, tables: input.tables, symbols: input.symbols };
}

const engineeringBlueprintTool: ToolDef<typeof einsInputShape> = {
  name: 'lcis_engineering_blueprint',
  description:
    'Generate a full engineering blueprint for a feature: impact analysis, change surface, migration plan, test plan, verification plan, rollback plan, launch decision, and governance gates. Composes all LCIS layers. READ-ONLY.',
  inputSchema: einsInputShape,
  async handler(input, _engine) {
    const t = new Timer();
    const eins = getEngineeringEngine();
    const result = await eins.generateBlueprint(buildEinsRequest(input));
    const ms = t.ms();
    return toText(result, 'engineering-blueprint', ms);
  },
};

const engineeringTasksTool: ToolDef<typeof einsInputShape> = {
  name: 'lcis_engineering_tasks',
  description:
    'Generate ordered engineering tasks for a feature: migration → rpc → gateway → proxy → ui → worker → queue → event → test → docs → verification → launch layers. Each task carries layer, dependencies, owner, and evidence. READ-ONLY.',
  inputSchema: einsInputShape,
  async handler(input, _engine) {
    const t = new Timer();
    const eins = getEngineeringEngine();
    const tasks = eins.generateTasks(buildEinsRequest(input));
    const ms = t.ms();
    const data = {
      found: true,
      request: input.request,
      taskCount: tasks.length,
      tasks,
      evidence: [
        { source: 'lcis-engineering', ref: 'TaskIntelligenceService.generateTasks', value: `${tasks.length} ordered engineering tasks` },
      ],
    };
    return toText(data, 'engineering-tasks', ms);
  },
};

const engineeringRolloutTool: ToolDef<typeof einsInputShape> = {
  name: 'lcis_engineering_rollout',
  description:
    'Generate a launch plan (rollout plan) for a feature: GO/CONDITIONAL_GO/NO_GO decision, ordered rollout phases, blockers, launch gates, unknowns, and structural readiness score. READ-ONLY.',
  inputSchema: einsInputShape,
  async handler(input, _engine) {
    const t = new Timer();
    const eins = getEngineeringEngine();
    const result = await eins.generateLaunchPlan(buildEinsRequest(input));
    const ms = t.ms();
    return toText(result, 'engineering-rollout', ms);
  },
};

const engineeringVerificationTool: ToolDef<typeof einsInputShape> = {
  name: 'lcis_engineering_verification',
  description:
    'Generate a verification plan for a feature: required checks, acceptance criteria, smoke/regression/security/performance tests, coverage gaps, and confidence assessment. READ-ONLY.',
  inputSchema: einsInputShape,
  async handler(input, _engine) {
    const t = new Timer();
    const eins = getEngineeringEngine();
    const result = eins.generateVerificationPlan(buildEinsRequest(input));
    const ms = t.ms();
    return toText(result, 'engineering-verification', ms);
  },
};

const engineeringRollbackTool: ToolDef<typeof einsInputShape> = {
  name: 'lcis_engineering_rollback',
  description:
    'Generate a rollback plan for a feature: ordered rollback steps, irreversible changes identified, data safety assessment, readiness verdict, and estimated recovery time. READ-ONLY.',
  inputSchema: einsInputShape,
  async handler(input, _engine) {
    const t = new Timer();
    const eins = getEngineeringEngine();
    const result = eins.generateRollbackPlan(buildEinsRequest(input));
    const ms = t.ms();
    return toText(result, 'engineering-rollback', ms);
  },
};

const engineeringAgentPlanTool: ToolDef<typeof einsInputShape> = {
  name: 'lcis_engineering_agent_plan',
  description:
    'Generate an agent task graph for a feature: parallel/sequential agent assignments (backend/database/frontend/testing/documentation/verification/devops), milestones, parallelism analysis, and task ownership. READ-ONLY.',
  inputSchema: einsInputShape,
  async handler(input, _engine) {
    const t = new Timer();
    const eins = getEngineeringEngine();
    const result = eins.generateAgentPlan(buildEinsRequest(input));
    const ms = t.ms();
    return toText(result, 'engineering-agent-plan', ms);
  },
};

const engineeringPackageTool: ToolDef<typeof einsInputShape> = {
  name: 'lcis_engineering_package',
  description:
    'Generate the full engineering package (flagship): blueprint + ordered tasks + agent task graph + engineering dependency graph + GO/CONDITIONAL_GO/NO_GO decision with blockers. The single unified answer to "what exactly must be done to safely ship this feature?". READ-ONLY.',
  inputSchema: einsInputShape,
  async handler(input, _engine) {
    const t = new Timer();
    const eins = getEngineeringEngine();
    const result = await eins.generateFullEngineeringPackage(buildEinsRequest(input));
    const ms = t.ms();
    return toText(result, 'engineering-package', ms);
  },
};

// ── Execution tools (Phase 8 / EAOS) ───────────────────────────────────────
// EAOS TRACKS execution; humans/agents execute. Every output is read-only and
// honest: live execution progress is NOT_CONNECTED until a tracker is wired.

/** Shared input shape for all EAOS execution tools (mirrors einsInputShape). */
const eaosInputShape = {
  request: z.string().min(1).describe('Natural-language description of the feature/change whose execution to track (e.g. "Add GST filing")'),
  domains: z.array(z.string()).optional().describe('Explicit domain seeds (e.g. ["payments", "orders"])'),
  tables: z.array(z.string()).optional().describe('Explicit table seeds (e.g. ["orders", "payment_transactions"])'),
  symbols: z.array(z.string()).optional().describe('Explicit symbol/function seeds (e.g. ["create_checkout_order"])'),
};

function buildEaosRequest(input: { request: string; domains?: string[]; tables?: string[]; symbols?: string[] }): FeatureRequest {
  return { text: input.request, domains: input.domains, tables: input.tables, symbols: input.symbols };
}

const executionReportTool: ToolDef<typeof eaosInputShape> = {
  name: 'lcis_execution_report',
  description:
    'Generate the full EAOS execution package (flagship): execution graph state + agent assignments + artifact tracking + validation status + progress + rollout + timeline with merged overall health. EAOS tracks execution — it never executes. Live progress is honestly NOT_CONNECTED. READ-ONLY.',
  inputSchema: eaosInputShape,
  async handler(input, _engine) {
    const t = new Timer();
    const eaos = getOrchestrationEngine();
    const result = await eaos.generateFullExecutionPackage(buildEaosRequest(input));
    return toText(result, 'execution-report', t.ms());
  },
};

const executionGraphTool: ToolDef<typeof eaosInputShape> = {
  name: 'lcis_execution_graph',
  description:
    'Generate the EAOS execution graph for a feature: nodes with structurally-derived PLANNED/READY/BLOCKED status, dependency edges, critical path, parallelizable work, and blocked-task findings (EO02). Live run-state is NOT_CONNECTED. READ-ONLY.',
  inputSchema: eaosInputShape,
  async handler(input, _engine) {
    const t = new Timer();
    const eaos = getOrchestrationEngine();
    const result = await eaos.generateExecutionReport(buildEaosRequest(input));
    return toText(result, 'execution-graph', t.ms());
  },
};

const executionStatusTool: ToolDef<typeof eaosInputShape> = {
  name: 'lcis_execution_status',
  description:
    'Generate the EAOS status report: per-dimension progress metrics (tasks/agents/artifacts/validations), overall progress, blocked reasons, and an honestly NOT_CONNECTED ETA (never a fabricated date). READ-ONLY.',
  inputSchema: eaosInputShape,
  async handler(input, _engine) {
    const t = new Timer();
    const eaos = getOrchestrationEngine();
    const result = await eaos.generateStatusReport(buildEaosRequest(input));
    return toText(result, 'execution-status', t.ms());
  },
};

const executionBlockersTool: ToolDef<typeof eaosInputShape> = {
  name: 'lcis_execution_blockers',
  description:
    'List what cannot proceed and why: blocked tasks (EO02 findings), launch blockers, and blocked reasons — composed from the execution graph, rollout intelligence, and status intelligence. READ-ONLY.',
  inputSchema: eaosInputShape,
  async handler(input, _engine) {
    const t = new Timer();
    const eaos = getOrchestrationEngine();
    const result = await eaos.generateBlockersReport(buildEaosRequest(input));
    return toText(result, 'execution-blockers', t.ms());
  },
};

const executionTimelineTool: ToolDef<typeof eaosInputShape> = {
  name: 'lcis_execution_timeline',
  description:
    'Generate the EAOS timeline: milestones, critical moments, and planned state transitions. Actual start/end timestamps and durations are honestly NOT_CONNECTED (no execution history store). READ-ONLY.',
  inputSchema: eaosInputShape,
  async handler(input, _engine) {
    const t = new Timer();
    const eaos = getOrchestrationEngine();
    const result = await eaos.generateTimelineReport(buildEaosRequest(input));
    return toText(result, 'execution-timeline', t.ms());
  },
};

const executionRolloutTool: ToolDef<typeof eaosInputShape> = {
  name: 'lcis_execution_rollout',
  description:
    'Generate the EAOS rollout report: GO/CONDITIONAL_GO/NO_GO launch verdict, READY/CONDITIONAL/NOT_READY rollback readiness, launch blockers, and rollout health — tracked, never performed. READ-ONLY.',
  inputSchema: eaosInputShape,
  async handler(input, _engine) {
    const t = new Timer();
    const eaos = getOrchestrationEngine();
    const result = await eaos.generateRolloutReport(buildEaosRequest(input));
    return toText(result, 'execution-rollout', t.ms());
  },
};

const executionHealthTool: ToolDef<typeof eaosInputShape> = {
  name: 'lcis_execution_health',
  description:
    'Generate the EAOS health report: execution/agent/validation/rollout area healths (0-100 + band, honest null when indeterminable) merged into an overall band, with connected vs NOT_CONNECTED signal counts. READ-ONLY.',
  inputSchema: eaosInputShape,
  async handler(input, _engine) {
    const t = new Timer();
    const eaos = getOrchestrationEngine();
    const result = await eaos.generateHealthReport(buildEaosRequest(input));
    return toText(result, 'execution-health', t.ms());
  },
};

// ── Registry ───────────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const TOOLS: readonly ToolDef<any>[] = [
  blastTool,
  explainTool,
  verifyTool,
  memoryTool,
  decisionTool,
  healthTool,
  graphStatsTool,
  liveStatusTool,
  liveInvestigateTool,
  dbHealthTool,
  recentChangesTool,
  deploymentStatusTool,
  // Phase 4: EIS planning tools
  planChangeTool,
  planExecutionTool,
  planMigrationTool,
  planTestsTool,
  planRollbackTool,
  planLaunchTool,
  planReleaseTool,
  // Phase 5: GDIS governance tools
  driftTool,
  complianceTool,
  governanceTool,
  readinessTool,
  ownershipTool,
  securityDriftTool,
  architectureHealthTool,
  // Phase 6: LCOS operations tools
  runtimeOpsTool,
  commerceOpsTool,
  merchantOpsTool,
  customerOpsTool,
  deploymentOpsTool,
  incidentOpsTool,
  securityOpsTool,
  forecastOpsTool,
  operationsReportTool,
  // Phase 7: EINS engineering tools
  engineeringBlueprintTool,
  engineeringTasksTool,
  engineeringRolloutTool,
  engineeringVerificationTool,
  engineeringRollbackTool,
  engineeringAgentPlanTool,
  engineeringPackageTool,
  // Phase 8: EAOS execution tools
  executionReportTool,
  executionGraphTool,
  executionStatusTool,
  executionBlockersTool,
  executionTimelineTool,
  executionRolloutTool,
  executionHealthTool,
] as const;
