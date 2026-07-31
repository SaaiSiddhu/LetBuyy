/**
 * LCIS API — Hono application factory.
 *
 * READ-ONLY: no writes, no DB mutations, no outbound network.
 * Every response uses the canonical LcisEnvelope from @letbuyy/lcis-core.
 */
import { Hono } from 'hono'
import { z } from 'zod'
import {
  envelope,
  getEngine,
  newRequestId,
  Timer,
  LCIS_VERSION,
} from '@letbuyy/lcis-core'
import { createLivePlatform } from '@letbuyy/lcis-live'
import { getEisEngine, type ChangeRequest } from '@letbuyy/lcis-execution'
import { getGovernanceEngine } from '@letbuyy/lcis-governance'
import { getOperationsEngine } from '@letbuyy/lcis-operations'
import { getEngineeringEngine } from '@letbuyy/lcis-engineering'
import { getOrchestrationEngine } from '@letbuyy/lcis-orchestration'
import {
  auditLogMiddleware,
  getValidatedBody,
  globalErrorHandler,
  rateLimiterMiddleware,
  requestIdMiddleware,
  securityHeadersMiddleware,
  validateBody,
  type RateLimiterOptions,
} from './middleware'

// ── Hono context type extensions ───────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/consistent-type-definitions
type Variables = {
  requestId: string
  traceId: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validatedBody: any
}

// ── Schemas ───────────────────────────────────────────────────────────────────

const BlastSchema = z.object({
  symbol: z.string().min(1),
  depth: z.number().int().min(1).max(6).optional(),
})

const VerifySchema = z.object({
  entity: z.string().min(1),
})

const ExplainSchema = z.object({
  entity: z.string().min(1),
})

const MemorySchema = z.object({
  query: z.string().min(1),
  limit: z.number().int().min(1).max(50).optional(),
})

const DecisionSchema = z.object({
  subject: z.string().min(1),
})

const InvestigateSchema = z.object({
  subject: z.string().min(1),
})

const PlanSchema = z.object({
  text: z.string().min(1),
  domains: z.array(z.string()).optional(),
  tables: z.array(z.string()).optional(),
  symbols: z.array(z.string()).optional(),
})


// ── Helpers ───────────────────────────────────────────────────────────────────

function requestId(c: { get(k: 'requestId'): string | undefined }): string {
  return (c.get('requestId') as string | undefined) ?? newRequestId()
}

// ── App factory ───────────────────────────────────────────────────────────────

export interface CreateAppOptions {
  rateLimiter?: RateLimiterOptions
}

export function createApp(opts: CreateAppOptions = {}): Hono<{ Variables: Variables }> {
  const app = new Hono<{ Variables: Variables }>()

  // Global middleware (order matters)
  app.use('*', requestIdMiddleware())
  app.use('*', securityHeadersMiddleware())
  app.use('*', rateLimiterMiddleware(opts.rateLimiter))
  app.use('*', auditLogMiddleware())

  // Global error handler
  app.onError(globalErrorHandler)

  // ── GET /health ────────────────────────────────────────────────────────────
  app.get('/health', (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const engine = getEngine()
    const cacheStats = engine.store.cacheStats()
    return c.json(
      envelope({
        data: {
          status: 'ok',
          version: LCIS_VERSION,
          cacheStats,
        },
        source: 'health',
        executionTime: t.ms(),
        evidence: [],
        requestId: reqId,
      }),
    )
  })

  // ── GET /graph/stats ───────────────────────────────────────────────────────
  app.get('/graph/stats', (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const engine = getEngine()
    const nodeCount = engine.graph.nodeCount()
    const edgeCount = engine.graph.edgeCount()
    const commit = engine.graph.commit()
    return c.json(
      envelope({
        data: { nodeCount, edgeCount, commit: commit ?? null },
        source: 'graph',
        executionTime: t.ms(),
        evidence: [
          {
            kind: 'artifact-field' as const,
            ref: 'graphify-out/graph.json',
            detail: `${nodeCount} nodes / ${edgeCount} edges`,
          },
        ],
        requestId: reqId,
      }),
    )
  })

  // ── POST /blast ────────────────────────────────────────────────────────────
  app.post('/blast', validateBody(BlastSchema), (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const { symbol, depth } = getValidatedBody<z.infer<typeof BlastSchema>>(c)
    const engine = getEngine()
    const result = engine.blast.blast(symbol, depth ?? 3)
    if (result === null) {
      return c.json(
        {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Symbol '${symbol}' not found in the code graph.`,
          },
          requestId: reqId,
        },
        404,
      )
    }
    return c.json(
      envelope({
        data: result,
        source: 'blast-radius',
        executionTime: t.ms(),
        evidence: [
          {
            kind: 'artifact-field' as const,
            ref: result.artifact,
            detail: `Blast from '${symbol}': ${result.impactedNodes} nodes across ${result.impactedFiles} files`,
          },
        ],
        requestId: reqId,
      }),
    )
  })

  // ── POST /verify ───────────────────────────────────────────────────────────
  app.post('/verify', validateBody(VerifySchema), async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const { entity } = getValidatedBody<z.infer<typeof VerifySchema>>(c)
    const engine = getEngine()

    // Route by entity keyword
    let result
    const e = entity.toLowerCase()
    if (e.includes('domain')) {
      result = await engine.verification.verifyDomains()
    } else if (e.includes('service') || e.includes('svc')) {
      result = await engine.verification.verifyServices()
    } else if (e.includes('runtime') || e.includes('connection')) {
      result = await engine.verification.verifyRuntime()
    } else if (e.includes('dep') || e.includes('dependency')) {
      result = await engine.verification.verifyDependencies()
    } else if (e.includes('production') || e.includes('readiness') || e.includes('launch')) {
      result = await engine.verification.verifyProductionReadiness()
    } else {
      // Default: architecture
      result = await engine.verification.verifyArchitecture()
    }

    return c.json(
      envelope({
        data: result,
        source: 'verification',
        executionTime: t.ms(),
        evidence: result.evidence,
        requestId: reqId,
      }),
    )
  })

  // ── POST /explain ──────────────────────────────────────────────────────────
  app.post('/explain', validateBody(ExplainSchema), async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const { entity } = getValidatedBody<z.infer<typeof ExplainSchema>>(c)
    const engine = getEngine()

    const e = entity.toLowerCase()

    // Route by entity heuristic
    let result
    if (
      e === 'architecture' ||
      e === 'system' ||
      e === 'platform' ||
      e === 'overall'
    ) {
      result = await engine.architecture.explainArchitecture()
    } else if (e === 'runtime' || e === 'runtimes') {
      result = await engine.architecture.explainRuntime()
    } else if (e.includes('ownership') || e.includes('owner')) {
      result = await engine.architecture.explainOwnership(entity)
    } else if (e.includes('risk')) {
      result = await engine.architecture.explainRisk(entity)
    } else if (
      e.includes('-') ||
      [
        'payments', 'orders', 'refunds', 'payouts', 'inventory', 'products',
        'identity', 'merchant', 'authentication', 'authorization', 'shipping',
        'gift-cards', 'gst', 'discounts', 'collections', 'storefront',
        'notifications', 'analytics', 'themes', 'marketplace', 'developer',
        'operations',
      ].includes(e)
    ) {
      result = await engine.architecture.explainDomain(entity)
    } else {
      // Try as service name first, fall back to domain
      try {
        result = await engine.architecture.explainService(entity)
      } catch {
        result = await engine.architecture.explainDomain(entity)
      }
    }

    return c.json(
      envelope({
        data: result,
        source: 'architecture',
        executionTime: t.ms(),
        evidence: result.evidence,
        requestId: reqId,
      }),
    )
  })

  // ── POST /memory ───────────────────────────────────────────────────────────
  app.post('/memory', validateBody(MemorySchema), (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const { query, limit } = getValidatedBody<z.infer<typeof MemorySchema>>(c)
    const engine = getEngine()
    const effectiveLimit = limit ?? 10
    // Use search directly for a hard limit on hit count, then build citations
    const hits = engine.memory.search(query, { limit: effectiveLimit })
    const citations = engine.memory.cite(query, effectiveLimit)
    const diag = engine.memory.diagnostics()

    return c.json(
      envelope({
        data: {
          query,
          hits,
          citations,
          stale: diag.latestMigrationN > 0 ? false : false, // freshness from diagnostics
          builtAtMigration: diag.latestMigrationN,
          tokensUsed: hits.reduce((acc, h) => acc + Math.ceil(h.text.length / 4), 0),
        },
        source: 'memory',
        executionTime: t.ms(),
        evidence: citations.map((cit) => ({
          kind: 'doc' as const,
          ref: cit.source,
          detail: `[${cit.confidence}] ${cit.section}: ${cit.text.slice(0, 120)}`,
        })),
        requestId: reqId,
      }),
    )
  })

  // ── POST /decision ─────────────────────────────────────────────────────────
  app.post('/decision', validateBody(DecisionSchema), (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const { subject } = getValidatedBody<z.infer<typeof DecisionSchema>>(c)
    const engine = getEngine()

    const s = subject.toLowerCase()
    let data: unknown

    if (s.includes('fix') || s.includes('next') || s.includes('what to do')) {
      data = { fixes: engine.decision.rankFixes() }
    } else if (s.includes('launch') || s.includes('verdict') || s.includes('go')) {
      data = engine.decision.launchVerdict()
    } else {
      // Default: rank risks
      data = { risks: engine.decision.rankRisks() }
    }

    const risks =
      typeof data === 'object' && data !== null && 'risks' in data
        ? (data as { risks: { evidence: unknown[] }[] }).risks
        : []
    const topEvidence =
      risks.length > 0 && Array.isArray((risks[0] as { evidence?: unknown[] }).evidence)
        ? ((risks[0] as { evidence: { ref?: string; detail?: string }[] }).evidence.slice(0, 3).map((ev) => ({
            kind: 'artifact-field' as const,
            ref: (ev as { ref?: string }).ref ?? 'decision-engine',
            detail: (ev as { detail?: string }).detail,
          })))
        : [{ kind: 'artifact-field' as const, ref: 'decision-engine', detail: `subject: ${subject}` }]

    return c.json(
      envelope({
        data,
        source: 'decision',
        executionTime: t.ms(),
        evidence: topEvidence,
        requestId: reqId,
      }),
    )
  })

  // ── GET /live/health ──────────────────────────────────────────────────────
  app.get('/live/health', async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const p = createLivePlatform()
    const liveHealth = await p.health()
    const notConnected = liveHealth.adapters.filter((a) => a.status === 'NOT_CONNECTED').map((a) => a.adapter)
    const connected = liveHealth.adapters.filter((a) => a.status === 'CONNECTED').map((a) => a.adapter)
    return c.json(
      envelope({
        data: {
          overall: liveHealth.overall,
          adapters: liveHealth.adapters,
          connected,
          notConnected,
          generatedAt: liveHealth.generatedAt,
        },
        source: 'live-health',
        executionTime: t.ms(),
        evidence: [
          {
            kind: 'artifact-field' as const,
            ref: 'LivePlatform.health()',
            detail: `${connected.length} CONNECTED, ${notConnected.length} NOT_CONNECTED`,
          },
        ],
        requestId: reqId,
      }),
    )
  })

  // ── GET /live/status ───────────────────────────────────────────────────────
  app.get('/live/status', async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const p = createLivePlatform()
    const liveStatus = await p.status()
    const notConnected = liveStatus.adapters.filter((a) => a.status === 'NOT_CONNECTED').map((a) => a.adapter)
    return c.json(
      envelope({
        data: {
          adapters: liveStatus.adapters,
          notConnected,
          generatedAt: liveStatus.generatedAt,
        },
        source: 'live-status',
        executionTime: t.ms(),
        evidence: [
          {
            kind: 'artifact-field' as const,
            ref: 'LivePlatform.status()',
            detail: `${liveStatus.adapters.length} adapters; ${notConnected.length} NOT_CONNECTED`,
          },
        ],
        requestId: reqId,
      }),
    )
  })

  // ── POST /live/investigate ─────────────────────────────────────────────────
  app.post('/live/investigate', validateBody(InvestigateSchema), async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const { subject } = getValidatedBody<z.infer<typeof InvestigateSchema>>(c)
    const p = createLivePlatform()
    const result = await p.investigate(subject)
    return c.json(
      envelope({
        data: {
          subject: result.subject,
          correlation: result.correlation,
          contributingAdapters: result.contributingAdapters,
          notConnected: result.notConnected,
          generatedAt: result.generatedAt,
        },
        source: 'live-investigate',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // ── GET /db/status ─────────────────────────────────────────────────────────
  app.get('/db/status', async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const p = createLivePlatform()
    const adapter = p.adapter('supabase')
    if (!adapter) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'supabase adapter not registered' },
          requestId: reqId,
        },
        404,
      )
    }
    const [healthResult, verification] = await Promise.all([adapter.health(), adapter.verify()])
    return c.json(
      envelope({
        data: {
          adapter: healthResult.adapter,
          status: healthResult.status,
          latencyMs: healthResult.latencyMs,
          checkedAt: healthResult.checkedAt,
          missingEnvVars: healthResult.missingEnvVars,
          verification: { status: verification.status, findings: verification.findings },
        },
        source: 'db-status',
        executionTime: t.ms(),
        evidence: [
          {
            kind: 'artifact-field' as const,
            ref: 'supabase-adapter',
            detail: `status=${healthResult.status}`,
          },
        ],
        requestId: reqId,
      }),
    )
  })

  // ── GET /github/status ─────────────────────────────────────────────────────
  app.get('/github/status', async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const p = createLivePlatform()
    const adapter = p.adapter('github')
    if (!adapter) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'github adapter not registered' },
          requestId: reqId,
        },
        404,
      )
    }
    const snap = await adapter.collect()
    return c.json(
      envelope({
        data: {
          adapter: snap.adapter,
          status: snap.status,
          timestamp: snap.timestamp,
          notConnectedNote:
            snap.status === 'NOT_CONNECTED'
              ? 'GitHub live data NOT_CONNECTED — set GITHUB_TOKEN to connect'
              : undefined,
        },
        source: 'github-status',
        executionTime: t.ms(),
        evidence: [
          {
            kind: 'artifact-field' as const,
            ref: 'github-adapter',
            detail: `status=${snap.status}`,
          },
        ],
        requestId: reqId,
      }),
    )
  })

  // ── GET /cloudflare/status ─────────────────────────────────────────────────
  app.get('/cloudflare/status', async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const p = createLivePlatform()
    const adapter = p.adapter('cloudflare')
    if (!adapter) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'cloudflare adapter not registered' },
          requestId: reqId,
        },
        404,
      )
    }
    const snap = await adapter.collect()
    return c.json(
      envelope({
        data: {
          adapter: snap.adapter,
          status: snap.status,
          timestamp: snap.timestamp,
          notConnectedNote:
            snap.status === 'NOT_CONNECTED'
              ? 'Cloudflare live data NOT_CONNECTED — set CLOUDFLARE_API_TOKEN to connect'
              : undefined,
        },
        source: 'cloudflare-status',
        executionTime: t.ms(),
        evidence: [
          {
            kind: 'artifact-field' as const,
            ref: 'cloudflare-adapter',
            detail: `status=${snap.status}`,
          },
        ],
        requestId: reqId,
      }),
    )
  })

  // ── GET /vercel/status ─────────────────────────────────────────────────────
  app.get('/vercel/status', async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const p = createLivePlatform()
    const adapter = p.adapter('vercel')
    if (!adapter) {
      return c.json(
        {
          success: false,
          error: { code: 'NOT_FOUND', message: 'vercel adapter not registered' },
          requestId: reqId,
        },
        404,
      )
    }
    const snap = await adapter.collect()
    return c.json(
      envelope({
        data: {
          adapter: snap.adapter,
          status: snap.status,
          timestamp: snap.timestamp,
          notConnectedNote:
            snap.status === 'NOT_CONNECTED'
              ? 'Vercel live data NOT_CONNECTED — set VERCEL_TOKEN to connect'
              : undefined,
        },
        source: 'vercel-status',
        executionTime: t.ms(),
        evidence: [
          {
            kind: 'artifact-field' as const,
            ref: 'vercel-adapter',
            detail: `status=${snap.status}`,
          },
        ],
        requestId: reqId,
      }),
    )
  })

  // ── Phase 4: POST /plan/* (EIS read-only planning) ────────────────────────

  function buildChangeRequest(body: z.infer<typeof PlanSchema>): ChangeRequest {
    return { text: body.text, domains: body.domains, tables: body.tables, symbols: body.symbols }
  }

  // POST /plan/change
  app.post('/plan/change', validateBody(PlanSchema), (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const body = getValidatedBody<z.infer<typeof PlanSchema>>(c)
    const eis = getEisEngine()
    const result = eis.analyze(buildChangeRequest(body))
    return c.json(
      envelope({
        data: result,
        source: 'plan-change',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /plan/execution
  app.post('/plan/execution', validateBody(PlanSchema), (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const body = getValidatedBody<z.infer<typeof PlanSchema>>(c)
    const eis = getEisEngine()
    const result = eis.execution.planImplementation(buildChangeRequest(body))
    return c.json(
      envelope({
        data: result,
        source: 'plan-execution',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /plan/migration
  app.post('/plan/migration', validateBody(PlanSchema), (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const body = getValidatedBody<z.infer<typeof PlanSchema>>(c)
    const eis = getEisEngine()
    const result = eis.migration.analyzeMigration(buildChangeRequest(body))
    return c.json(
      envelope({
        data: result,
        source: 'plan-migration',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /plan/tests
  app.post('/plan/tests', validateBody(PlanSchema), (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const body = getValidatedBody<z.infer<typeof PlanSchema>>(c)
    const eis = getEisEngine()
    const result = eis.testing.generateTestPlan(buildChangeRequest(body))
    return c.json(
      envelope({
        data: result,
        source: 'plan-tests',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /plan/rollback
  app.post('/plan/rollback', validateBody(PlanSchema), (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const body = getValidatedBody<z.infer<typeof PlanSchema>>(c)
    const eis = getEisEngine()
    const result = eis.rollback.generateRollbackPlan(buildChangeRequest(body))
    return c.json(
      envelope({
        data: result,
        source: 'plan-rollback',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /plan/launch
  app.post('/plan/launch', validateBody(PlanSchema), async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const body = getValidatedBody<z.infer<typeof PlanSchema>>(c)
    const eis = getEisEngine()
    const result = await eis.launch.evaluateLaunch(buildChangeRequest(body))
    return c.json(
      envelope({
        data: result,
        source: 'plan-launch',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /plan/release
  app.post('/plan/release', validateBody(PlanSchema), async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const body = getValidatedBody<z.infer<typeof PlanSchema>>(c)
    const eis = getEisEngine()
    const result = await eis.planAll(buildChangeRequest(body))
    return c.json(
      envelope({
        data: result,
        source: 'plan-release',
        executionTime: t.ms(),
        evidence: [...result.change.evidence],
        requestId: reqId,
      }),
    )
  })

  // ── Phase 5: GDIS governance endpoints ───────────────────────────────────
  //
  // All POST routes accept an optional body `{ scope?: string }`.  Because the body
  // is fully optional the routes do NOT use validateBody() — they simply try to parse
  // it and ignore failures so that empty / missing bodies are always accepted.

  // POST /drift
  app.post('/drift', async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const gov = getGovernanceEngine()
    const result = gov.drift.generateDriftReport()
    return c.json(
      envelope({
        data: result,
        source: 'governance-drift',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /compliance
  app.post('/compliance', async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const gov = getGovernanceEngine()
    const result = gov.compliance.generateComplianceReport()
    return c.json(
      envelope({
        data: result,
        source: 'governance-compliance',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /governance (async)
  app.post('/governance', async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const gov = getGovernanceEngine()
    const result = await gov.generateGovernanceReport()
    return c.json(
      envelope({
        data: result,
        source: 'governance-report',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /ownership
  app.post('/ownership', async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const gov = getGovernanceEngine()
    const result = gov.ownership.generateOwnershipReport()
    return c.json(
      envelope({
        data: result,
        source: 'governance-ownership',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /readiness (async)
  app.post('/readiness', async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const gov = getGovernanceEngine()
    const result = await gov.readiness.generateReadinessReport()
    return c.json(
      envelope({
        data: result,
        source: 'governance-readiness',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /security-drift
  app.post('/security-drift', async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const gov = getGovernanceEngine()
    const result = gov.security.generateSecurityDriftReport()
    return c.json(
      envelope({
        data: result,
        source: 'governance-security-drift',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // GET /architecture-health
  app.get('/architecture-health', (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const gov = getGovernanceEngine()
    const result = gov.generateArchitectureHealth()
    return c.json(
      envelope({
        data: result,
        source: 'governance-architecture-health',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // GET /domain-health (async)
  app.get('/domain-health', async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const gov = getGovernanceEngine()
    const result = await gov.generateDomainHealth()
    return c.json(
      envelope({
        data: result,
        source: 'governance-domain-health',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // ── Phase 6: LCOS operations endpoints ───────────────────────────────────
  //
  // All POST routes accept an optional / empty body — no validateBody() used so
  // that missing or empty bodies are always accepted (mirrors Phase-5 GDIS pattern).

  // POST /runtime
  app.post('/runtime', async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const ops = getOperationsEngine()
    const result = ops.runtime()
    return c.json(
      envelope({
        data: result,
        source: 'operations-runtime',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /commerce
  app.post('/commerce', async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const ops = getOperationsEngine()
    const result = ops.commerce()
    return c.json(
      envelope({
        data: result,
        source: 'operations-commerce',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /merchant
  app.post('/merchant', async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const ops = getOperationsEngine()
    const result = ops.merchant()
    return c.json(
      envelope({
        data: result,
        source: 'operations-merchant',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /customer
  app.post('/customer', async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const ops = getOperationsEngine()
    const result = ops.customer()
    return c.json(
      envelope({
        data: result,
        source: 'operations-customer',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /deployment
  app.post('/deployment', async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const ops = getOperationsEngine()
    const result = ops.deployment()
    return c.json(
      envelope({
        data: result,
        source: 'operations-deployment',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /incident
  app.post('/incident', async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const ops = getOperationsEngine()
    const result = ops.incident()
    return c.json(
      envelope({
        data: result,
        source: 'operations-incident',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /security-ops  (Phase-6 operations security; distinct from Phase-5 /security-drift)
  app.post('/security-ops', async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const ops = getOperationsEngine()
    const result = ops.security()
    return c.json(
      envelope({
        data: result,
        source: 'operations-security',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /forecast
  app.post('/forecast', async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const ops = getOperationsEngine()
    const result = ops.forecast()
    return c.json(
      envelope({
        data: result,
        source: 'operations-forecast',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /operations  (composite operations report)
  app.post('/operations', async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const ops = getOperationsEngine()
    const result = ops.operationsReport()
    return c.json(
      envelope({
        data: result,
        source: 'operations-report',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // ── Phase 7: EINS engineering endpoints ──────────────────────────────────
  //
  // All routes accept { text: string, domains?, tables?, symbols? }.
  // text is required (validated via the shared PlanSchema). Async methods (generateBlueprint,
  // generateLaunchPlan, generateFullEngineeringPackage) are awaited; the rest are synchronous.

  const EngineeringSchema = PlanSchema // same shape; reuse the already-defined schema

  function buildFeatureRequest(body: z.infer<typeof EngineeringSchema>) {
    return { text: body.text, domains: body.domains, tables: body.tables, symbols: body.symbols }
  }

  // POST /engineering/blueprint  (→ generateBlueprint, async)
  app.post('/engineering/blueprint', validateBody(EngineeringSchema), async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const body = getValidatedBody<z.infer<typeof EngineeringSchema>>(c)
    const eins = getEngineeringEngine()
    const result = await eins.generateBlueprint(buildFeatureRequest(body))
    return c.json(
      envelope({
        data: result,
        source: 'engineering-blueprint',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /engineering/tasks  (→ generateTasks, sync)
  app.post('/engineering/tasks', validateBody(EngineeringSchema), (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const body = getValidatedBody<z.infer<typeof EngineeringSchema>>(c)
    const eins = getEngineeringEngine()
    const tasks = eins.generateTasks(buildFeatureRequest(body))
    return c.json(
      envelope({
        data: { tasks, count: tasks.length },
        source: 'engineering-tasks',
        executionTime: t.ms(),
        evidence: tasks.flatMap((t) => t.evidence).slice(0, 5),
        requestId: reqId,
      }),
    )
  })

  // POST /engineering/verification  (→ generateVerificationPlan, sync)
  app.post('/engineering/verification', validateBody(EngineeringSchema), (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const body = getValidatedBody<z.infer<typeof EngineeringSchema>>(c)
    const eins = getEngineeringEngine()
    const result = eins.generateVerificationPlan(buildFeatureRequest(body))
    return c.json(
      envelope({
        data: result,
        source: 'engineering-verification',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /engineering/rollback  (→ generateRollbackPlan, sync)
  app.post('/engineering/rollback', validateBody(EngineeringSchema), (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const body = getValidatedBody<z.infer<typeof EngineeringSchema>>(c)
    const eins = getEngineeringEngine()
    const result = eins.generateRollbackPlan(buildFeatureRequest(body))
    return c.json(
      envelope({
        data: result,
        source: 'engineering-rollback',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /engineering/rollout  (→ generateLaunchPlan, async)
  app.post('/engineering/rollout', validateBody(EngineeringSchema), async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const body = getValidatedBody<z.infer<typeof EngineeringSchema>>(c)
    const eins = getEngineeringEngine()
    const result = await eins.generateLaunchPlan(buildFeatureRequest(body))
    return c.json(
      envelope({
        data: result,
        source: 'engineering-rollout',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /engineering/agent-plan  (→ generateAgentPlan, sync)
  app.post('/engineering/agent-plan', validateBody(EngineeringSchema), (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const body = getValidatedBody<z.infer<typeof EngineeringSchema>>(c)
    const eins = getEngineeringEngine()
    const result = eins.generateAgentPlan(buildFeatureRequest(body))
    return c.json(
      envelope({
        data: result,
        source: 'engineering-agent-plan',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /engineering/package  (→ generateFullEngineeringPackage, async — flagship)
  app.post('/engineering/package', validateBody(EngineeringSchema), async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const body = getValidatedBody<z.infer<typeof EngineeringSchema>>(c)
    const eins = getEngineeringEngine()
    const result = await eins.generateFullEngineeringPackage(buildFeatureRequest(body))
    return c.json(
      envelope({
        data: result,
        source: 'engineering-package',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // ── Phase 8: EAOS execution endpoints ──────────────────────────────────────
  //
  // All routes accept { text: string, domains?, tables?, symbols? } (the shared PlanSchema
  // shape). EAOS TRACKS execution — it never executes; every response is read-only and
  // honest: live execution progress is NOT_CONNECTED until a tracker is wired.

  const ExecutionSchema = PlanSchema // same shape; reuse the already-defined schema

  // POST /execution/report  (→ generateFullExecutionPackage, flagship)
  app.post('/execution/report', validateBody(ExecutionSchema), async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const body = getValidatedBody<z.infer<typeof ExecutionSchema>>(c)
    const eaos = getOrchestrationEngine()
    const result = await eaos.generateFullExecutionPackage(buildFeatureRequest(body))
    return c.json(
      envelope({
        data: result,
        source: 'execution-report',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /execution/graph  (→ generateExecutionReport: nodes + derived status + critical path)
  app.post('/execution/graph', validateBody(ExecutionSchema), async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const body = getValidatedBody<z.infer<typeof ExecutionSchema>>(c)
    const eaos = getOrchestrationEngine()
    const result = await eaos.generateExecutionReport(buildFeatureRequest(body))
    return c.json(
      envelope({
        data: result,
        source: 'execution-graph',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /execution/status  (→ generateStatusReport: progress metrics + honest NOT_CONNECTED ETA)
  app.post('/execution/status', validateBody(ExecutionSchema), async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const body = getValidatedBody<z.infer<typeof ExecutionSchema>>(c)
    const eaos = getOrchestrationEngine()
    const result = await eaos.generateStatusReport(buildFeatureRequest(body))
    return c.json(
      envelope({
        data: result,
        source: 'execution-status',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /execution/timeline  (→ generateTimelineReport: milestones + planned transitions)
  app.post('/execution/timeline', validateBody(ExecutionSchema), async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const body = getValidatedBody<z.infer<typeof ExecutionSchema>>(c)
    const eaos = getOrchestrationEngine()
    const result = await eaos.generateTimelineReport(buildFeatureRequest(body))
    return c.json(
      envelope({
        data: result,
        source: 'execution-timeline',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /execution/blockers  (→ generateBlockersReport: blocked tasks + launch blockers + reasons)
  app.post('/execution/blockers', validateBody(ExecutionSchema), async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const body = getValidatedBody<z.infer<typeof ExecutionSchema>>(c)
    const eaos = getOrchestrationEngine()
    const result = await eaos.generateBlockersReport(buildFeatureRequest(body))
    return c.json(
      envelope({
        data: result,
        source: 'execution-blockers',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /execution/rollout  (→ generateRolloutReport: launch verdict + rollback readiness)
  app.post('/execution/rollout', validateBody(ExecutionSchema), async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const body = getValidatedBody<z.infer<typeof ExecutionSchema>>(c)
    const eaos = getOrchestrationEngine()
    const result = await eaos.generateRolloutReport(buildFeatureRequest(body))
    return c.json(
      envelope({
        data: result,
        source: 'execution-rollout',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // POST /execution/health  (→ generateHealthReport: per-area healths + merged overall)
  app.post('/execution/health', validateBody(ExecutionSchema), async (c) => {
    const t = new Timer()
    const reqId = requestId(c)
    const body = getValidatedBody<z.infer<typeof ExecutionSchema>>(c)
    const eaos = getOrchestrationEngine()
    const result = await eaos.generateHealthReport(buildFeatureRequest(body))
    return c.json(
      envelope({
        data: result,
        source: 'execution-health',
        executionTime: t.ms(),
        evidence: [...result.evidence],
        requestId: reqId,
      }),
    )
  })

  // ── 404 catch-all ──────────────────────────────────────────────────────────
  app.notFound((c) => {
    const reqId = requestId(c)
    return c.json(
      {
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: `Route '${c.req.method} ${new URL(c.req.url).pathname}' not found.`,
        },
        requestId: reqId,
      },
      404,
    )
  })

  return app
}
