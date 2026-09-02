/**
 * LCIS V2 — PlatformExplainer
 *
 * Explains the LetBuyy platform in structured, human-readable form.
 * Reads from self-model artifacts + architecture engine.
 *
 * Methods:
 *   explainPlatform()             — how LetBuyy works, top-level
 *   explainServiceInteraction()   — how the 8 runtimes interact
 *   explainDeploymentPropagation()— how a deploy flows CI→gate→workers→Vercel→merchants
 *   explainFailurePropagation(domain) — how a failure in X cascades
 *   explainIncidentEmergence()    — how incidents emerge from signals
 *   explainOperations()           — how ops function
 *
 * No external dependencies. Reads graphify-out/self-model/*.json when present.
 *
 * @module self-model/PlatformExplainer
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '../../..');
const SELF_MODEL_DIR = join(REPO_ROOT, 'graphify-out/self-model');
const GRAPHIFY_OUT  = join(REPO_ROOT, 'graphify-out');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function safeReadJson(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

function readSelfModel() {
  return safeReadJson(join(SELF_MODEL_DIR, 'LCIS_SELF_MODEL.json'));
}

function readOperationalModel() {
  return safeReadJson(join(SELF_MODEL_DIR, 'LCIS_OPERATIONAL_MODEL.json'));
}

function readDependencyModel() {
  return safeReadJson(join(SELF_MODEL_DIR, 'LCIS_DEPENDENCY_MODEL.json'));
}

function readInfraIntel() {
  return safeReadJson(join(GRAPHIFY_OUT, 'infra-intel.json'));
}

function readDomainIntel() {
  return safeReadJson(join(GRAPHIFY_OUT, 'domain-intel.json'));
}

// ---------------------------------------------------------------------------
// PlatformExplainer class
// ---------------------------------------------------------------------------

class PlatformExplainer {

  // -------------------------------------------------------------------------
  // explainPlatform — how LetBuyy works, top-level
  // -------------------------------------------------------------------------

  async explainPlatform() {
    const selfModel  = readSelfModel();
    const infraIntel = readInfraIntel();
    const domainIntel = readDomainIntel();

    const domainCount   = domainIntel?.summary?.domains ?? 22;
    const workerCount   = infraIntel?.summary?.workers ?? 4;
    const vercelApps    = infraIntel?.summary?.vercelApps ?? ['marketing-site', 'identity-platform', 'merchant-web', 'customer-web', 'admin-web'];
    const tableCount    = domainIntel?.summary?.classifiedTables ?? '330+';
    const rpcCount      = domainIntel?.summary?.classifiedRpcs ?? '137+';
    const providers     = infraIntel?.summary?.providers ?? ['Supabase', 'Razorpay', 'Cloudflare', 'Vercel', 'Resend', 'Turnstile'];

    return {
      topic: 'How LetBuyy Works',
      summary: `LetBuyy is a multi-tenant India-first commerce platform. Merchants create stores at {store}.letbuyy.com or on custom domains. Each store shares the same backend infrastructure but is isolated by site_id at the database layer via RLS policies. The platform handles the full commerce lifecycle: product discovery → cart → checkout → payment → fulfilment → refunds, with India-specific requirements (GST, COD, INR, GSTIN).`,
      components: {
        runtimes: [
          { name: 'customer-web',         role: 'Customer-facing store (React + optional Liquid canary)',  technology: 'Next.js on Vercel' },
          { name: 'merchant-web',      role: 'Merchant dashboard (products, orders, analytics)',        technology: 'Next.js on Vercel' },
          { name: 'identity-platform',           role: 'Auth — merchant signup/login (ES256 JWT)',               technology: 'Next.js on Vercel' },
          { name: 'marketing-site',              role: 'Public marketing site + pricing + blog',                 technology: 'Next.js on Vercel' },
          { name: 'admin-web',            role: 'Operator/admin console',                                technology: 'Next.js on Vercel' },
          { name: 'services/api-gateway',        role: 'Canonical backend API (/v1/*); all tenants share this', technology: 'Cloudflare Worker (Hono)' },
          { name: 'services/queue-workers',      role: 'Async event processing (analytics, search, notifications, crons)', technology: 'Cloudflare Worker' },
          { name: 'services/webhook-service',    role: 'Outbound webhook delivery to merchant endpoints',        technology: 'Cloudflare Worker' },
          { name: 'services/mobile-bff',         role: 'Mobile API backend-for-frontend',                       technology: 'Cloudflare Worker' },
        ],
        dataLayer: {
          database: 'Supabase (Postgres)',
          tenantIsolation: 'site_id column + RLS policies on every tenant table',
          moneyModel: 'SECURITY DEFINER Postgres RPCs — canonical ledger only (no direct table writes)',
          tableCount: String(tableCount),
          rpcCount: String(rpcCount),
          domainCount: String(domainCount),
        },
        payments: {
          providers: ['Razorpay (primary)', 'COD (cash on delivery)'],
          verification: 'Server-side HMAC-SHA256 signature check; timingSafeEqualHex',
          idempotency: 'idempotency_key + ON CONFLICT + FOR UPDATE on every money RPC',
          gst: 'GST computed server-side; invoices immutable',
        },
        auth: {
          customerAuth: 'HS256 JWT (CUSTOMER_SESSION_SECRET via issueCustomerSession)',
          merchantAuth: 'ES256 JWT from identity-platform (LETBUYY_IDENTITY_PUBLIC_JWKS)',
          stepUp: 'HMAC step-up gates refunds and payouts',
          rateLimit: 'Turnstile + rate-limit on registration/login',
        },
        externalProviders: providers,
      },
      steps: [
        'Customer visits {store}.letbuyy.com — customer-web serves the store page (React default, Liquid canary off)',
        'Customer browses products → adds to cart → reaches checkout (embedded in customer-web)',
        'Checkout calls api-gateway /v1/checkout → create_checkout_order RPC validates totals/tax/shipping from DB',
        'Customer pays via Razorpay or COD → api-gateway verifies Razorpay webhook signature server-side',
        'confirm_order_payment_with_ledger RPC credits the canonical ledger; inventory decremented; order confirmed',
        'Queue workers process analytics event, search index update, notification email (async via queues)',
        'Merchant sees the order in merchant-web dashboard',
        'Merchant fulfils → ships → optionally refunds via complete_order_refund RPC',
        'Gift cards: issued via issue_gift_card RPC; balance is a ledger projection (no mutable column)',
        'GST invoice generated server-side; immutable once created',
      ],
      sourceFacts: {
        selfModelVersion: selfModel?.version ?? 'not built yet',
        generatedAt: new Date().toISOString(),
        workerCount,
        vercelAppCount: vercelApps.length,
      },
    };
  }

  // -------------------------------------------------------------------------
  // explainServiceInteraction — how the 8 runtimes interact
  // -------------------------------------------------------------------------

  async explainServiceInteraction() {
    const infraIntel = readInfraIntel();
    const depModel   = readDependencyModel();

    const interactions = [
      {
        from: 'customer-web / merchant-web / admin-web',
        to: 'api-gateway',
        mechanism: 'HTTP proxy via /api/* same-origin routes → /v1/* on api-gateway',
        note: 'Browser never calls gateway directly (CORS + CSP path-match)',
      },
      {
        from: 'identity-platform',
        to: 'api-gateway',
        mechanism: 'ES256 JWT issued by identity-platform; verified in api-gateway middleware via LETBUYY_IDENTITY_PUBLIC_JWKS',
        note: 'Merchant auth token flows from identity → browser → api-gateway on every request',
      },
      {
        from: 'api-gateway',
        to: 'queue-workers',
        mechanism: 'Cloudflare Queue binding (EVENT_QUEUE, ANALYTICS_QUEUE, SEARCH_QUEUE, NOTIFICATION_QUEUE, RUNTIME_QUEUE)',
        note: 'api-gateway produces; queue-workers consumes; DLQ handles failures',
      },
      {
        from: 'api-gateway',
        to: 'webhook-service',
        mechanism: 'Cloudflare Service Binding (WEBHOOK_SERVICE)',
        note: 'api-gateway calls webhook-service directly for synchronous webhook dispatch',
      },
      {
        from: 'webhook-service / queue-workers',
        to: 'api-gateway',
        mechanism: 'Cloudflare Service Binding (API_GATEWAY_SERVICE)',
        note: 'Workers call back into api-gateway for internal API access',
      },
      {
        from: 'api-gateway / all workers',
        to: 'Supabase Postgres',
        mechanism: 'Hyperdrive connection pool (api-gateway) + direct pg for others',
        note: 'All DB access goes through RLS; no direct table write for money',
      },
      {
        from: 'mobile-bff',
        to: 'api-gateway',
        mechanism: 'Service Binding (API_GATEWAY_SERVICE)',
        note: 'Mobile BFF translates mobile requests to gateway API calls',
      },
      {
        from: 'customer-web',
        to: 'identity-platform',
        mechanism: 'Redirect + cookie exchange for customer auth (HS256 customer session)',
        note: 'customer-web sets customer session cookie; identity-platform issues it',
      },
    ];

    const workerBindings = infraIntel?.workers?.map(w => ({
      worker: w.name,
      bindings: w.bindings || [],
    })) || [];

    return {
      topic: 'How the LetBuyy Runtimes Interact',
      summary: `The 9 runtimes (5 Vercel Next.js apps + 4 Cloudflare Workers) interact through HTTP proxies, Cloudflare Service Bindings, Cloudflare Queues, and a shared Supabase Postgres database. The api-gateway is the central hub — all web apps proxy to it; queue-workers and webhook-service are downstream consumers.`,
      components: {
        centralHub: 'api-gateway (letbuyy-api Cloudflare Worker)',
        edgeApps: ['customer-web', 'merchant-web', 'identity-platform', 'marketing-site', 'admin-web'],
        workerServices: ['letbuyy-api', 'letbuyy-queue-workers', 'letbuyy-webhook', 'letbuyy-mobile-bff'],
        dataPlane: 'Supabase Postgres (shared schema, tenant isolation via site_id + RLS)',
      },
      steps: interactions.map((i, idx) => ({
        step: idx + 1,
        interaction: `${i.from} → ${i.to}`,
        mechanism: i.mechanism,
        note: i.note,
      })),
      sourceFacts: {
        workerBindings,
        depModelServiceCount: depModel?.stats?.serviceCount ?? null,
        depModelDepCount: depModel?.stats?.serviceDependencyCount ?? null,
      },
    };
  }

  // -------------------------------------------------------------------------
  // explainDeploymentPropagation — CI → migration gate → workers/Vercel → merchants
  // -------------------------------------------------------------------------

  async explainDeploymentPropagation() {
    const opModel = readOperationalModel();

    const steps = opModel?.deploymentPropagation?.steps ?? [
      { step: 1, name: 'CI Trigger',         description: 'GitHub Actions push to stepup/* or main' },
      { step: 2, name: 'Validation Gate',     description: 'validate-governance.mjs (107 validators) + pnpm build' },
      { step: 3, name: 'Migration Gate',      description: 'Supabase migrations applied before worker deploy' },
      { step: 4, name: 'Worker Deploy',       description: 'wrangler deploy × 4 workers' },
      { step: 5, name: 'Vercel Deploy',       description: 'Vercel deploys × 5 Next.js apps' },
      { step: 6, name: 'Health Probe',        description: 'Post-deploy health probes; deployment-state.json updated' },
      { step: 7, name: 'Merchant Visibility', description: 'All tenants see new version immediately (shared workers)' },
    ];

    const criticalConstraints = [
      'Two-lane merge rule: infra and feature lanes must not deploy simultaneously',
      'Migration gate: DB schema must be compatible before any code deploys',
      'Security review: Anthropic claude-code-security-review must pass on PR',
      '107 governance validators: validate-governance.mjs must exit 0',
      'Never skip: --no-verify or bypassing signing is forbidden without explicit ARB approval',
    ];

    const rollbackPlan = [
      '1. Worker: wrangler rollback to previous deployment (Cloudflare version history)',
      '2. Vercel: git revert + push → Vercel auto-deploys the reverted commit',
      '3. Migration: Supabase migrations are forward-only — schema rollback requires a new migration',
      '4. deployment-state.json: LCIS re-reads on next graph:v4 run',
    ];

    return {
      topic: 'How Deployments Propagate in LetBuyy',
      summary: 'A deployment flows through: GitHub CI → governance gate → migration gate → Cloudflare Worker deploy → Vercel Next.js deploy → immediate merchant visibility. All merchants share the same Workers and schema — there are no per-tenant deploys.',
      components: {
        ciSystem: 'GitHub Actions',
        workerRuntime: 'Cloudflare Workers (wrangler deploy)',
        appRuntime: 'Vercel (Next.js)',
        database: 'Supabase (migrations applied before workers)',
        governanceGate: 'validate-governance.mjs (107 validators)',
        securityGate: 'claude-code-security-review (security-review.yml)',
      },
      steps,
      criticalConstraints,
      rollbackPlan,
      sourceFacts: {
        hasMigrateGate: true,
        twoLaneMergeRule: true,
        validatorCount: 107,
        opModelPresent: !!opModel,
      },
    };
  }

  // -------------------------------------------------------------------------
  // explainFailurePropagation — how a failure in domain X cascades
  // -------------------------------------------------------------------------

  async explainFailurePropagation(domain = 'payments') {
    const opModel = readOperationalModel();
    const domainIntel = readDomainIntel();

    // Find domain-specific failure path from operational model
    const paths = opModel?.failurePropagation?.paths ?? [];
    const domainPath = paths.find(p =>
      p.domain === domain ||
      p.domain.toLowerCase().includes(domain.toLowerCase())
    );

    // Generic failure propagation principles
    const generalPrinciples = [
      'api-gateway is the single bottleneck: its failure affects ALL runtimes simultaneously',
      'Postgres outage blocks all money RPCs and RLS — platform cannot operate without it',
      'Queue failures are isolated (async): gateway stays live but analytics/notifications degrade',
      'identity-platform failure blocks new merchant auth but existing sessions (cached JWT) survive the JWT TTL',
      'RLS failures are caught at DB layer: tenant data never leaks but all queries in the affected table fail',
      'Idempotency keys prevent double-processing on retries after partial failures',
      'Gift-card ledger is append-only — no balance column to corrupt; balance is recomputed from entries',
    ];

    // Cross-domain edges for the requested domain
    const crossDomainEdges = (domainIntel?.edges || []).filter(e =>
      (e.from || '').toLowerCase().includes(domain.toLowerCase()) ||
      (e.to || '').toLowerCase().includes(domain.toLowerCase())
    );

    return {
      topic: `How a Failure in '${domain}' Propagates`,
      summary: domainPath
        ? `A failure in ${domain} cascades: ${domainPath.cascade?.join(' → ')}`
        : `Failure in '${domain}' cascades through its downstream domain dependencies. The severity depends on whether the domain owns critical RPCs called by others.`,
      components: {
        requestedDomain: domain,
        failurePoint: domainPath?.failurePoint ?? 'domain-specific failure point',
        affectedDomains: domainPath?.affectedDomains ?? crossDomainEdges.map(e => e.to ?? e.target).filter(Boolean),
        recoveryPath: domainPath?.recoveryPath ?? 'Identify failing RPC → check idempotency → replay or rollback',
      },
      steps: domainPath?.cascade?.map((c, i) => ({ step: i + 1, description: c })) ?? [
        { step: 1, description: `Failure detected in ${domain} domain (route/rpc/queue error rate spike)` },
        { step: 2, description: 'LCIS AnomalyDetectionService correlates signals across metric streams' },
        { step: 3, description: `IncidentDetectionService attributes to ${domain} domain via domain-intel.json` },
        { step: 4, description: 'Blast radius computed: which downstream domains depend on this RPC/table' },
        { step: 5, description: 'Runbook escalation chain invoked; rollback candidate identified' },
        { step: 6, description: 'Recovery applied; health probe confirms; incident closed' },
      ],
      generalPrinciples,
      crossDomainEdgesForDomain: crossDomainEdges.slice(0, 10),
      sourceFacts: {
        opModelPresent: !!opModel,
        domainPathFound: !!domainPath,
        crossDomainEdgeCount: crossDomainEdges.length,
      },
    };
  }

  // -------------------------------------------------------------------------
  // explainIncidentEmergence — how incidents emerge from signals
  // -------------------------------------------------------------------------

  async explainIncidentEmergence() {
    const opModel = readOperationalModel();

    const steps = opModel?.incidentEmergence?.steps ?? [
      { step: 1, name: 'Signal Detection',   description: 'Error rate / latency / queue depth breach' },
      { step: 2, name: 'Anomaly Correlation', description: 'AnomalyDetectionService correlates across metric streams' },
      { step: 3, name: 'Domain Attribution', description: 'LCIS maps failing signal to owning domain' },
      { step: 4, name: 'Incident Creation',  description: 'Incident object: domain, severity, blast radius, merchants affected' },
      { step: 5, name: 'Escalation',         description: 'Runbook chain invoked; rollback candidate identified' },
      { step: 6, name: 'Recovery',           description: 'Fix/rollback applied; health probe confirms; incident closed' },
    ];

    const signalSources = [
      { source: 'Cloudflare Analytics Engine', signals: ['error rate', 'p99 latency', 'CPU time', 'Worker invocations'], status: 'NOT CONNECTED — requires CF_API_TOKEN + Analytics Engine adapter' },
      { source: 'Supabase Postgres',           signals: ['connection count', 'query time', 'replication lag'],            status: 'NOT CONNECTED — requires Supabase service-role + pg_stat adapter' },
      { source: 'Cloudflare Queues',           signals: ['queue depth', 'DLQ message count', 'consumer lag'],             status: 'NOT CONNECTED — requires CF Queue API' },
      { source: 'LCIS structural analysis',    signals: ['blast radius', 'RLS gaps', 'missing auth', 'dead routes'],      status: 'CONNECTED — graphify-out/*.json + domain-intel.json' },
    ];

    const incidentClassification = [
      { severity: 'P0 (Critical)',  criteria: 'api-gateway down OR Postgres down OR payment RPC failing',   response: 'Immediate rollback + escalation' },
      { severity: 'P1 (High)',      criteria: 'identity-platform down OR checkout failing for all stores',  response: 'On-call page within 5 minutes' },
      { severity: 'P2 (Medium)',    criteria: 'Queue workers down (analytics/search degraded)',             response: 'Fix within 1 hour; non-blocking for commerce' },
      { severity: 'P3 (Low)',       criteria: 'Single tenant storefront slow OR non-critical feature down', response: 'Fix within next business day' },
    ];

    return {
      topic: 'How Incidents Emerge in LetBuyy',
      summary: `Incidents emerge from a chain: live signal breach → anomaly detection → domain attribution → incident creation → escalation → recovery. LCIS structural analysis is CONNECTED; live telemetry signals are NOT CONNECTED until provider adapters are wired.`,
      components: {
        detectionLayer: 'LCIS observability subsystem (AnomalyDetectionService, IncidentDetectionService)',
        attributionLayer: 'domain-intel.json + db-intel.json (route/rpc/table → domain mapping)',
        escalationLayer: 'runbooks.json + on-call chain',
        recoveryLayer: 'deployment-state.json + wrangler rollback + Supabase migration history',
      },
      steps,
      signalSources,
      incidentClassification,
      sourceFacts: {
        opModelPresent: !!opModel,
        generatedAt: new Date().toISOString(),
      },
    };
  }

  // -------------------------------------------------------------------------
  // explainOperations — how ops function
  // -------------------------------------------------------------------------

  async explainOperations() {
    const opModel   = readOperationalModel();
    const selfModel = readSelfModel();
    const infraIntel = readInfraIntel();

    const opsHowItWorks = opModel?.operationsHowItWorks ?? [
      'All merchant stores share the same Cloudflare Workers + Postgres schema (multi-tenant, site_id partitioned)',
      'Money mutations go exclusively through SECURITY DEFINER RPCs — never direct table writes',
      'Deployments are atomic per Cloudflare Worker — all merchants see the new version simultaneously',
      'Queue workers process async events separately from the gateway',
      'RLS policies enforce tenant isolation at the DB layer',
      'Webhooks are HMAC-signed before enqueue; verified on delivery',
      'The two-lane merge rule prevents concurrent infra and feature deploys from conflicting',
    ];

    const lcisOpsCapabilities = [
      { capability: 'Launch readiness',          endpoint: '/api/launch-command-center',    status: 'CONNECTED (structural)' },
      { capability: 'Production health',         endpoint: '/api/production-health',        status: 'CONNECTED (structural)' },
      { capability: 'Incident root cause',       endpoint: '/api/incident',                 status: 'CONNECTED (structural; live NOT CONNECTED)' },
      { capability: 'Deployment state',          endpoint: '/api/deployment-state',         status: 'CONNECTED' },
      { capability: 'Fix priority ranking',      endpoint: '/api/decision-v2',             status: 'CONNECTED' },
      { capability: 'Live metrics / telemetry',  endpoint: '/api/runtime',                  status: 'NOT CONNECTED (requires telemetry adapters)' },
      { capability: 'Live merchant health',      endpoint: '/api/merchant-intelligence',    status: 'NOT CONNECTED (requires tenant telemetry)' },
      { capability: 'Provider live status',      endpoint: '/api/live-adapters',            status: 'NOT CONNECTED (requires provider credentials)' },
    ];

    const cronJobs = infraIntel?.workers
      ?.filter(w => (w.crons || []).length > 0)
      .flatMap(w => w.crons.map(c => ({ worker: w.name, schedule: c }))) ?? [];

    return {
      topic: 'How LetBuyy Operations Function',
      summary: `LetBuyy operations are governed by: (1) a 107-validator governance gate, (2) the two-lane merge rule for safe deploys, (3) LCIS intelligence layer for structural diagnostics, (4) Cloudflare Worker auto-recovery + wrangler rollback for incidents, and (5) canonical ledger RPCs ensuring money integrity even under partial failure.`,
      components: {
        governanceGate: 'validate-governance.mjs (107 deterministic validators)',
        mergeStrategy: 'Two-lane: lane-a and lane-b; one at a time; never concurrent',
        incidentResponse: 'LCIS /api/runbook + escalation chain + wrangler rollback',
        moneyIntegrity: 'SECURITY DEFINER RPCs with idempotency_key + FOR UPDATE locks',
        tenantIsolation: 'RLS + site_id on all tenant tables; service-role behind verifySiteOwnership',
        lcis: 'Central Intelligence System on :3333 (V1) + :3334 (V2) with 13 subsystems',
      },
      steps: [
        { step: 1, name: 'Day-to-day ops',    description: 'Developers push to stepup/* branch; CI validates; two-lane merge proceeds' },
        { step: 2, name: 'Pre-deploy check',  description: 'validate-governance.mjs must exit 0; pnpm build must pass per-app' },
        { step: 3, name: 'Deploy',            description: 'Worker + Vercel deploy (see explainDeploymentPropagation)' },
        { step: 4, name: 'Monitor',           description: 'LCIS /api/production-health shows GREEN/YELLOW/RED; live telemetry NOT CONNECTED until adapters wired' },
        { step: 5, name: 'Incident',          description: 'LCIS detects structural risk; live signal NOT CONNECTED → ops queries /api/runbook + runbook escalation' },
        { step: 6, name: 'Recovery',          description: 'wrangler rollback OR git revert + push; migration gate ensures schema compatibility' },
        { step: 7, name: 'Post-incident',     description: 'Incident closed; LCIS domain model updated; decision-v2 re-ranks fix priorities' },
      ],
      opsHowItWorks,
      lcisOpsCapabilities,
      cronJobs,
      sourceFacts: {
        opModelPresent: !!opModel,
        selfModelVersion: selfModel?.version ?? null,
        subsystemCount: selfModel?.stats?.subsystemCount ?? null,
        generatedAt: new Date().toISOString(),
      },
    };
  }
}

const explainer = new PlatformExplainer();
export default explainer;

// CLI entrypoint
import { fileURLToPath as _ftu } from 'node:url';
const _self = _ftu(import.meta.url);
if (process.argv[1] && resolve(process.argv[1]) === _self) {
  const topic = process.argv[2] || 'platform';
  const methodMap = {
    platform:    () => explainer.explainPlatform(),
    services:    () => explainer.explainServiceInteraction(),
    deploy:      () => explainer.explainDeploymentPropagation(),
    failure:     () => explainer.explainFailurePropagation(process.argv[3] || 'payments'),
    incident:    () => explainer.explainIncidentEmergence(),
    operations:  () => explainer.explainOperations(),
  };
  const fn = methodMap[topic] ?? methodMap.platform;
  fn().then(r => console.log(JSON.stringify(r, null, 2))).catch(e => { console.error(e.message); process.exit(1); });
}
