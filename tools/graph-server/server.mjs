#!/usr/bin/env node
// LetBuyy Graph Intelligence Platform — local viewer + query API.
// Zero dependencies (Node http only). Reads graphify-out/graph.json directly.
// Start: `pnpm graph:ui` → http://localhost:3333
import { createServer } from 'node:http';
import { readFileSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { traceTable, traceRPC, tracePolicy, findOwnership, infraSummary } from './intelligence.mjs';
import { traceDomain, listDomains, findDomainDependencies, findDomainConsumers, findDomainOwners, findDomainSecrets, findDomainWorkflows } from './domain-intel.mjs';
import { blastDomain, couplingMatrix } from './cross-domain-engine.mjs';
import { buildPaymentIntel } from './payment-intel.mjs';
import { buildSecurityGraph } from './security-intel.mjs';
import { buildDeploymentIntel } from './deployment-intel.mjs';
import { traceIncident } from './incident-intel.mjs';
import { buildMerchantIntel } from './merchant-intel.mjs';
import { buildMemoryIntel, whyBuilt, ruleWhy, migrationWhy, decisionsAffecting } from './memory-intel.mjs';
import { buildRuntimeIntel } from './runtime-intel.mjs';
import { buildDeploymentState } from './deployment-state.mjs';
import { changeImpact } from './change-impact.mjs';
import { incidentResponse } from './incident-response.mjs';
import { buildMerchantOperatingGraph } from './merchant-operating-graph.mjs';
import { buildExecutionIntel } from './execution-intel.mjs';
import { buildRuntimeObservability } from './runtime-observability-intel.mjs';
import { buildMerchantIntelligence } from './merchant-intelligence.mjs';
import { buildRevenueIntelligence } from './revenue-intelligence.mjs';
import { buildSecurityIntelligenceV5 } from './security-intelligence-v5.mjs';
import { incidentIntelligenceV5 } from './incident-intelligence-v5.mjs';
import { buildCustomerJourneyIntelligence } from './customer-journey-intelligence.mjs';
import { buildProductionReadiness } from './production-readiness-intel.mjs';
import { buildDecisionEngine } from './decision-engine-v5.mjs';
import { buildMerchantHealth } from './merchant-health-intel.mjs';
import { buildMerchantGrowth } from './merchant-growth-intel.mjs';
import { buildMerchantAdoption } from './merchant-adoption-intel.mjs';
import { buildMerchantRisk } from './merchant-risk-intel.mjs';
import { buildMerchantChurn } from './merchant-churn-intel.mjs';
import { buildCustomerIntelligenceV2 } from './customer-intelligence-v2.mjs';
import { buildRevenueIntelligenceV2 } from './revenue-intelligence-v2.mjs';
import { buildCostIntelligence } from './cost-intelligence.mjs';
import { buildTelemetryIntelligence } from './telemetry-intelligence.mjs';
import { buildMemoryV2 } from './memory-v2.mjs';
import { buildFixEngine } from './fix-engine.mjs';
import { buildUnifiedIntelligence } from './unified-intelligence-engine.mjs';
import { buildDiscoveryV2 } from './discovery-v2.mjs';
import { buildProductionReadinessV2 } from './production-readiness-v2.mjs';
import { buildDecisionEngineV2 } from './decision-engine-v2.mjs';
import { buildExplainIntel, copilot } from './explain-intel.mjs';
import { buildRelationshipIntel, relationshipsFor } from './relationship-intel.mjs';
import { buildEnvironmentIntel } from './environment-intel.mjs';
import { buildKnowledgeGraphs } from './knowledge-graphs.mjs';
import { buildOperationsCenter } from './operations-center.mjs';
import { buildConnectionsIntel } from './connections-intel.mjs';
import { buildProductionHealth } from './production-health.mjs';
import { buildAuditEngineV2 } from './audit-engine-v2.mjs';
import { buildMissionControlDashboard } from './mission-control-dashboard.mjs';
import { buildEcosystemIntel } from './ecosystem-intel.mjs';
import { searchV2 } from './search-intel.mjs';
import { ADAPTERS, probeAdapter, probeAll, summarize as adapterSummary } from './live-adapters.mjs';
import { buildEnvironmentRegistry } from './environment-registry.mjs';
import { diagnose } from './diagnosis-engine.mjs';
import { buildRunbooks, runbookOf } from './runbook-engine.mjs';
import { buildDatabaseControl, lineage } from './database-control-intel.mjs';
import { buildEnvironmentControl } from './environment-control-intel.mjs';
import { buildInfrastructureControl } from './infrastructure-control-intel.mjs';
import { buildCommerceControl } from './commerce-control-intel.mjs';
import { incidentControl } from './incident-control-intel.mjs';
import { buildPack, allPacks } from './ai-context-intel.mjs';
import { buildLaunchCommandCenter } from './launch-command-center.mjs';
import { buildFederationIntel } from './federation-intel.mjs';
import { buildLiveHealthIntel } from './live-health-intel.mjs';
import { buildBusinessFlow } from './business-flow-intel.mjs';
import { buildDetectionPrediction, incidentTimeline } from './detection-prediction-intel.mjs';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const GRAPH_PATH = join(REPO_ROOT, 'graphify-out', 'graph.json');
const PORT = Number(process.env.GRAPH_UI_PORT || 3333);

if (!existsSync(GRAPH_PATH)) {
  console.error(`\n[graph-server] graph not found at ${GRAPH_PATH}\n  Run:  pnpm graph:update  (or: graphify update .)\n`);
  process.exit(1);
}

console.log('[graph-server] loading graph…');
const raw = JSON.parse(readFileSync(GRAPH_PATH, 'utf8'));
const stat = statSync(GRAPH_PATH);
const nodes = raw.nodes || [];
const links = raw.links || raw.edges || [];
const DB_INTEL_PATH = join(REPO_ROOT, 'graphify-out', 'db-intel.json');
const dbIntel = existsSync(DB_INTEL_PATH) ? JSON.parse(readFileSync(DB_INTEL_PATH, 'utf8')) : null;
const INFRA_INTEL_PATH = join(REPO_ROOT, 'graphify-out', 'infra-intel.json');
const infraIntel = existsSync(INFRA_INTEL_PATH) ? JSON.parse(readFileSync(INFRA_INTEL_PATH, 'utf8')) : null;
const DOMAIN_INTEL_PATH = join(REPO_ROOT, 'graphify-out', 'domain-intel.json');
const domainIntel = existsSync(DOMAIN_INTEL_PATH) ? JSON.parse(readFileSync(DOMAIN_INTEL_PATH, 'utf8')) : null;

// ---- v4: runtime / memory / deployment-state / execution (built fresh at startup; cheap) ----
const safe = (fn) => { try { return fn(); } catch (e) { return { error: String(e) }; } };
const MEM_INTEL_PATH = join(REPO_ROOT, 'graphify-out', 'memory-intel.json');
const memoryIntel = safe(() => existsSync(MEM_INTEL_PATH) ? JSON.parse(readFileSync(MEM_INTEL_PATH, 'utf8')) : buildMemoryIntel());
const runtimeIntel = safe(() => buildRuntimeIntel());
const deploymentStateData = safe(() => buildDeploymentState(infraIntel));
const executionIntel = safe(() => buildExecutionIntel());

// ---- v5: live operating intelligence (built fresh at startup) ----
const runtimeObs = safe(() => buildRuntimeObservability());
const merchantIntelV5 = safe(() => buildMerchantIntelligence());
const revenueIntel = safe(() => buildRevenueIntelligence());
const securityIntelV5 = safe(() => buildSecurityIntelligenceV5());
const journeyIntel = safe(() => buildCustomerJourneyIntelligence());
const readinessIntel = safe(() => buildProductionReadiness());
const decisionEngine = safe(() => buildDecisionEngine());

// ---- Omega: prefer the pre-built JSON artifact (cheap), fall back to live build ----
const loadOrBuild = (file, fn) => { const p = join(REPO_ROOT, 'graphify-out', file); return existsSync(p) ? safe(() => JSON.parse(readFileSync(p, 'utf8'))) : safe(fn); };
const merchantHealth = loadOrBuild('merchant-health.json', buildMerchantHealth);
const merchantGrowth = loadOrBuild('merchant-growth.json', buildMerchantGrowth);
const merchantAdoption = loadOrBuild('merchant-adoption.json', buildMerchantAdoption);
const merchantRisk = loadOrBuild('merchant-risk.json', buildMerchantRisk);
const merchantChurn = loadOrBuild('merchant-churn.json', buildMerchantChurn);
const customerV2 = loadOrBuild('customer-intelligence.json', buildCustomerIntelligenceV2);
const revenueV2 = loadOrBuild('revenue-intelligence-v2.json', buildRevenueIntelligenceV2);
const costIntel = loadOrBuild('cost-intelligence.json', buildCostIntelligence);
const telemetryIntel = loadOrBuild('telemetry-intelligence.json', buildTelemetryIntelligence);
const memoryV2 = loadOrBuild('memory-v2.json', buildMemoryV2);
const fixEngine = loadOrBuild('fix-engine.json', buildFixEngine);
const unifiedIntel = loadOrBuild('unified-intelligence.json', buildUnifiedIntelligence);
const discoveryV2 = loadOrBuild('discovery-v2.json', buildDiscoveryV2);
const readinessV2 = loadOrBuild('production-readiness-v2.json', buildProductionReadinessV2);
const decisionV2 = loadOrBuild('decision-engine-v2.json', buildDecisionEngineV2);
const explainIntel = safe(() => buildExplainIntel());
const relIntel = loadOrBuild('relationship-intel.json', buildRelationshipIntel);
const envIntel = safe(() => buildEnvironmentIntel());
const knowledgeGraphs = loadOrBuild('knowledge-graphs.json', buildKnowledgeGraphs);
const opsCenter = safe(() => buildOperationsCenter());
// ---- V7: live operating system ----
const connectionsIntel = loadOrBuild('connections-intel.json', buildConnectionsIntel);
const productionHealth = safe(() => buildProductionHealth());
const auditV2 = safe(() => buildAuditEngineV2());
const missionDashboard = safe(() => buildMissionControlDashboard());
const ecosystemIntel = loadOrBuild('ecosystem-intel.json', buildEcosystemIntel);
const envRegistry = safe(() => buildEnvironmentRegistry());
const runbooksIntel = safe(() => buildRunbooks());
// ---- LCIS Genesis: control centers (composition; built at startup) ----
const envControl = safe(() => buildEnvironmentControl());
const dbControlGenesis = safe(() => buildDatabaseControl());
const infraControl = safe(() => buildInfrastructureControl());
const commerceControl = safe(() => buildCommerceControl());
const launchCenter = safe(() => buildLaunchCommandCenter());
// ---- LCIS X: live federation (Phases 1-8) + live health (Phase 9) ----
const federationIntel = safe(() => buildFederationIntel());
const liveHealth = safe(() => buildLiveHealthIntel());
// ---- LCIS V11: business flow intelligence (10 journeys + business flow graph) ----
const businessFlow = safe(() => buildBusinessFlow());
// ---- LCIS INFINITY: autonomous detection + predictive intelligence ----
const detectPredict = safe(() => buildDetectionPrediction());
// Atlas 2.0 — one-click full trace: entity → route → rpcs → tables → policies/triggers → queues → emails → analytics → merchant dashboard
function fullTrace(entity) {
  const root = lineage(entity);
  if (root.error && !root.type) return root;
  const di = domainIntel;
  const tablesOf = root.type === 'route' ? root.tables : root.type === 'rpc' ? root.tables : root.type === 'table' ? [root.entity] : [];
  const rpcsOf = root.type === 'route' ? root.rpcs : root.type === 'rpc' ? [root.entity] : (root.touchedByRpcs || []);
  const tableTraces = tablesOf.slice(0, 12).map((t) => { const l = lineage(t); return { table: t, policies: l.policies || [], triggers: l.triggers || [], indexes: l.indexes || 0 }; });
  const dom = di?.domains.find((d) => (root.type === 'route' ? d.routes.includes(entity) : d.tables.includes(tablesOf[0]) || d.rpcs.includes(entity)));
  return {
    entity, rootType: root.type || 'unknown',
    chain: ['Route', 'RPC', 'Table', 'Policy/Trigger', 'Queue', 'Email', 'Analytics', 'Merchant Dashboard'],
    route: root.type === 'route' ? root.file : (rpcsOf.length ? 'via ' + rpcsOf[0] : null),
    rpcs: rpcsOf, tables: tableTraces,
    queues: dom?.queues || [], workers: dom?.workers || [],
    emails: dom && /payment|order|refund|ship|notif/.test(dom.key) ? 'NOTIFICATION_QUEUE → Resend (transactional)' : 'n/a',
    analytics: 'ANALYTICS_QUEUE → analytics_event_stream (rollups)',
    merchantDashboard: dom ? `merchant-web → ${dom.label}` : 'merchant-web',
    owner: dom?.owners || ['@saai-sidd'],
    note: 'Structural trace (repository truth). Row-level values are live (Supabase) — NOT CONNECTED.',
  };
}
// Multi-AI context pack (Phase 26) — self-contained, < ~20k tokens, no repo scan required.
function aiPack(target) {
  if (!explainIntel || explainIntel.error) return { error: 'explain-intel missing' };
  const gs = explainIntel.gettingStarted, ex = executionIntel, di = domainIntel;
  const domains = Object.values(explainIntel.nodes).map((n) => `- ${n.label} [${n.criticality.split('—')[0].trim()}]: ${n.purpose} (owner ${n.owner.join(',')}; depends ${n.dependsOn.join('/') || 'none'}; breaks→ ${n.consumers.join('/') || 'none'})`).join('\n');
  const body = [
    `# LetBuyy — self-contained context pack for ${target}`,
    `${gs.steps[0].d}`,
    `Architecture: ${gs.steps[1].d}`,
    `Commerce flow: ${explainIntel.flows.orders.join(' → ')}`,
    `Payments flow: ${explainIntel.flows.payments.join(' → ')}`,
    `Refund flow: ${explainIntel.flows.refunds.join(' → ')}`,
    `Security: ${gs.steps[6].d}`,
    `Infrastructure: ${gs.steps[7].d}`,
    `Launch: ${ex?.summary.launchVerdict} — blockers: ${(ex?.questions.whatRemainsBeforeLaunch || []).join('; ')}`,
    `Live data: ${connectionsIntel?.summary.notConnected} sources NOT CONNECTED (adapters ready).`,
    `## Domains (${di?.summary.domains})`, domains,
    `## How to query LCIS instead of scanning the repo`,
    `/api/search-v2?q=<question> · /api/explain?node=<key> · /api/change-impact?key=<key> · /api/atlas-v2?node=<key> · /api/mission-control · /api/connections`,
  ].join('\n');
  const approxTokens = Math.round(body.length / 4);
  return { target, approxTokens, withinBudget: approxTokens < 20000, selfContained: true, repoScan: 'not required', pack: body };
}
// Atlas V2 — composed answer for a node (what breaks / who owns / tables / rpcs / queues / workers / merchants / customers / deployments)
function atlasV2(key) {
  if (!explainIntel || explainIntel.error) return { error: 'explain-intel missing' };
  const n = explainIntel.nodes[key]; if (!n) return { error: `node '${key}' not found`, nodes: Object.keys(explainIntel.nodes) };
  const blast = domainIntel ? blastDomain(domainIntel, key) : null;
  const inc = (domainIntel && dbIntel) ? traceIncident(domainIntel, dbIntel, infraIntel, key) : null;
  return {
    node: key, label: n.label, criticality: n.criticality,
    whatBreaks: blast && !blast.error ? blast.blastRadius.affected : n.consumers,
    whoOwns: n.owner,
    tables: n.technical.tables, rpcs: n.technical.rpcs, queues: n.technical.queues, workers: n.technical.workers,
    relationships: n.technical.relationships,
    merchants: inc && !inc.error ? inc.affectedMerchants : 'tenant-scoped (all merchants share schema)',
    customers: n.technical.tenant ? 'all customers of affected stores (tenant-scoped)' : 'n/a (platform-internal)',
    deployments: { workers: n.technical.workers, apps: n.technical.services },
    atlas: { search: n.atlas.search },
  };
}
function aiContextPack(pack) {
  if (!explainIntel || explainIntel.error) return { error: 'explain-intel missing' };
  const gs = explainIntel.gettingStarted, di = domainIntel, ex = executionIntel;
  if (pack === 'domain') return { pack, perDomain: Object.fromEntries(Object.entries(explainIntel.nodes).map(([k, n]) => [k, n.aiContext])) };
  const packs = {
    project: `# LetBuyy — project context\n${gs.steps[0].d} ${gs.steps[1].d}\nDomains: ${di?.summary.domains}. Workers: ${connectionsIntel?.connections.filter((c) => c.provider === 'Cloudflare').length}. Gate: 107/107. Launch: ${ex?.summary.launchVerdict}.`,
    architecture: `# LetBuyy — architecture context\n${gs.steps[1].d}\nCommerce: ${explainIntel.flows.orders.join(' → ')}\nPayments: ${explainIntel.flows.payments.join(' → ')}\nSecurity: ${gs.steps[6].d}`,
    launch: `# LetBuyy — launch context\nVerdict: ${ex?.summary.launchVerdict}. Open blockers: ${(ex?.questions.whatRemainsBeforeLaunch || []).join('; ')}.\nReadiness: ${missionDashboard?.summary.structuralReadiness}% structural. Live data: ${connectionsIntel?.summary.notConnected} sources NOT CONNECTED (adapters ready).`,
    feature: `# LetBuyy — feature context\nPer-domain packets at /api/ai-context?pack=domain or /api/explain?node=<key>.`,
  };
  return { pack, context: packs[pack] || packs.project, available: Object.keys(packs).concat('domain') };
}

// ---- V8: Domain Workspace (search → workspace) + Related Knowledge. Pure composition over existing intel. ----
function relatedKnowledge(key) {
  if (!explainIntel || explainIntel.error) return { error: 'explain-intel missing' };
  const n = explainIntel.nodes[key]; if (!n) return { error: `domain '${key}' not found` };
  const rel = (typeof relIntel !== 'undefined' && relIntel && !relIntel.error) ? relIntel : null;
  const fkNeighbors = rel ? [...new Set(n.technical.tables.flatMap((t) => { const r = rel.tables.find((x) => x.name === t); return r ? [...r.references, ...r.referencedBy] : []; }).filter((t) => !n.technical.tables.includes(t)))].slice(0, 10) : [];
  return {
    domain: key, label: n.label,
    relatedDomains: n.relatedDomains || [...new Set([...n.dependsOn, ...n.consumers])],
    relatedServices: { workers: n.technical.workers, apps: n.technical.services },
    relatedTables: n.technical.tables.slice(0, 12),
    relatedRoutes: n.technical.routes,
    relatedFkTables: fkNeighbors,
    relatedRunbooks: [`/api/runbook?domain=${key}`],
    relatedIncidents: `/api/incident-control?target=${key}`,
    relatedDocs: ['docs/operating-system/', 'docs/central-intelligence/', `/api/explain?node=${key}`],
    relatedAiPacks: ['Claude', 'Gemini', 'Codex', 'Cursor', 'OpenAI'].map((t) => ({ target: t, url: `/api/ai-context-pack?target=${t}` })),
  };
}
const GRAPH_LAYERS = ['business', 'journey', 'technical', 'database', 'infrastructure', 'security', 'ownership', 'dependency', 'revenue', 'ai'];
// V9 — Change-Impact / What-Breaks-If with impact/risk/recovery scores. Composition over change-impact + db + execution + runbook.
function impactScore(key) {
  if (!explainIntel || explainIntel.error) return { error: 'explain-intel missing' };
  const n = explainIntel.nodes[key]; if (!n) return { error: `domain '${key}' not found`, domains: Object.keys(explainIntel.nodes) };
  const ci = (domainIntel && dbIntel) ? changeImpact(domainIntel, dbIntel, infraIntel, key) : null;
  if (!ci || ci.error) return ci || { error: 'change-impact unavailable' };
  const b = ci.breaks, money = n.technical.money, tenant = n.technical.tenant;
  const totalDomains = domainIntel.summary.domains || 22;
  const blockers = (executionIntel?.blockers || []).filter((x) => !/done|resolved|complete|hidden|fixed/i.test(x.status) && new RegExp(key.replace('-', '.?').replace(/s$/, ''), 'i').test(x.title)).map((x) => x.id);
  const crossTenant = (dbIntel?.summary.tenantTablesWithoutRls || []).filter((t) => n.technical.tables.includes(t)).length;
  const impact = Math.min(100, Math.round((b.domains.count / totalDomains) * 55 + (money ? 25 : 0) + (tenant ? 20 : 0)));
  const risk = Math.min(100, Math.round((money ? 40 : 10) + (crossTenant ? 15 : 0) + blockers.length * 15 + (b.domains.count > 5 ? 20 : 0)));
  const recoveryDifficulty = money ? 'Hard — ledger reconciliation required before retry' : b.domains.count > 5 ? 'Moderate — multi-domain rollback' : 'Easy — single-worker rollback';
  const rb = runbookOf(key);
  return {
    domain: key, label: n.label,
    affected: { apis: b.routes, tables: b.tables, workers: b.workers, queues: b.queues, domains: b.domains.list,
      merchants: b.merchants, customers: n.customerImpact, revenuePaths: money ? 'impacted — quantify via /api/revenue-v2 (live; NOT CONNECTED)' : 'none',
      launchReadiness: blockers.length ? `affected — open blockers ${blockers.join(', ')}` : 'no open blocker',
      securityRules: money ? 'SECURITY DEFINER + canonical-ledger-only + step-up' : (tenant ? 'RLS + verifySiteOwnership' : 'standard'),
      rls: tenant ? `${n.technical.tables.length} tenant tables (RLS forced)` : 'n/a', fkRelationships: (n.technical.relationships ? n.technical.relationships.references.length + n.technical.relationships.referencedBy.length : 0) },
    scores: { impactScore: impact, riskScore: risk, recoveryDifficulty },
    whatBreaksIf: { immediate: [key, ...b.domains.list.slice(0, 3)], secondary: b.domains.list.slice(3), revenueImpact: money ? 'yes' : 'no',
      merchantImpact: b.merchants, customerImpact: n.customerImpact, operationalImpact: `${b.workers.length} workers, ${b.queues.length} queues` },
    recoveryPath: rb.recovery || [], rollbackPath: rb.rollback || null, runbook: `/api/runbook?domain=${key}`,
    verificationChecklist: rb.verification || ['gate 107/107', 'reconcile ledger if money', 'queue drained'],
    repoScan: 'not required',
  };
}
function workspace(key) {
  if (!explainIntel || explainIntel.error) return { error: 'explain-intel missing' };
  const n = explainIntel.nodes[key];
  if (!n) return { error: `domain '${key}' not found`, domains: Object.keys(explainIntel.nodes) };
  return {
    domain: key, label: n.label, criticality: n.criticality,
    perspectives: ['overview', 'explain', 'business', 'merchant', 'customer', 'database', 'api', 'infrastructure', 'security', 'operations', 'incidents', 'dependencies', 'impact', 'technical', 'graphs', 'trace', 'related', 'ai', 'atlas'],
    explain: { overview: n.purpose, docs: n.docs, importance: n.importance, businessValue: n.businessValue,
      customerImpact: n.customerImpact, merchantImpact: n.merchantImpact, failureImpact: n.failureImpact,
      operationalNotes: n.operationalNotes, recoveryPath: n.recoveryPath, launchRelevance: n.launchRelevance,
      flow: n.flow, owner: n.owner, dependsOn: n.dependsOn, consumers: n.consumers },
    technical: n.technical,
    graphs: GRAPH_LAYERS,
    trace: `/api/trace?entity=${key}`,
    related: relatedKnowledge(key),
    aiPacks: ['Claude', 'Gemini', 'Codex', 'Cursor', 'OpenAI'],
    aiContext: n.aiContext,
  };
}

// ====================================================================================
// LCIS X — Live Federation + Autonomous Operations (Phases 10-20). READ-ONLY composition.
// Every function reuses existing engines; live values are CONNECTED or NOT CONNECTED only.
// ====================================================================================
function resolveDomain(q) {
  const keys = explainIntel && !explainIntel.error ? Object.keys(explainIntel.nodes) : (domainIntel?.domains || []).map((d) => d.key);
  const ql = (q || '').toLowerCase();
  const direct = keys.find((k) => ql.includes(k.replace('-', ' ')) || ql.includes(k));
  if (direct) return direct;
  const hints = { checkout: 'orders', cart: 'orders', pay: 'payments', payment: 'payments', refund: 'refunds', payout: 'payouts',
    ship: 'shipping', delivery: 'shipping', tax: 'gst', gst: 'gst', login: 'authentication', signup: 'authentication', register: 'authentication',
    auth: 'authentication', theme: 'themes', store: 'storefront', email: 'notifications', notif: 'notifications', gift: 'gift-cards',
    discount: 'discounts', coupon: 'discounts', inventory: 'inventory', stock: 'inventory', product: 'products', collection: 'collections',
    order: 'orders', merchant: 'merchant', identity: 'identity' };
  for (const [kw, dom] of Object.entries(hints)) if (ql.includes(kw) && keys.includes(dom)) return dom;
  const sv = safe(() => searchV2(q, explainIntel));
  const top = sv && sv.results && sv.results[0];
  if (top && top.domain && keys.includes(top.domain)) return top.domain;
  return null;
}
function domainHealthCard(key, list) {
  const h = (list || liveHealth?.domains || []).find((d) => d.domain === key);
  if (!h) return { domain: key, live: 'NOT CONNECTED' };
  return { domain: key, healthScore: h.healthScore, riskScore: h.riskScore, openBlockers: h.incidentCount.structuralOpenBlockers, dependency: h.dependencyHealth.health, liveVolume: 'NOT CONNECTED' };
}
// Phase 10 — Autonomous Investigation.
function investigate(question) {
  const key = resolveDomain(question) || 'orders';
  const n = explainIntel?.nodes?.[key];
  const dom = domainIntel?.domains?.find((d) => d.key === key);
  const dg = safe(() => diagnose(key, ''));
  const health = (liveHealth?.domains || []).find((d) => d.domain === key) || null;
  const dep = dom ? { dependsOn: (domainIntel.edges || []).filter((e) => e.from === key).map((e) => e.to), consumedBy: (domainIntel.edges || []).filter((e) => e.to === key).map((e) => e.from) } : null;
  return {
    question, resolvedDomain: key, label: n?.label || dom?.label || key,
    found: {
      routes: dom?.routes || n?.technical?.routes || [], rpcs: dom?.rpcs || n?.technical?.rpcs || [], tables: dom?.tables || n?.technical?.tables || [],
      queues: dom?.queues || [], workers: dom?.workers || [], deployments: deploymentStateData?.targets || deploymentStateData?.declared || [],
      incidents: { live: 'NOT CONNECTED', liveRequires: 'incident feed / Cloudflare logs', structuralOpenBlockers: health?.incidentCount?.structuralOpenBlockers || 0, blockers: health?.incidentCount?.blockers || [] },
      owners: n?.owner || dom?.owners || ['@saai-sidd'],
    },
    dependencies: dep, diagnosis: dg,
    health: health ? { healthScore: health.healthScore, riskScore: health.riskScore, availability: health.availability } : null,
    liveBoundary: 'Structural findings are repository truth. Live failure signals (error rate, latency, logs) are NOT CONNECTED — wire Cloudflare/Supabase read-only tokens.',
    next: { rootCause: `/api/root-cause?domain=${key}`, runbook: `/api/runbook?domain=${key}`, impact: `/api/impact-score?domain=${key}` },
  };
}
// Phase 11 — Autonomous Root Cause.
function rootCause(target, error) {
  const key = resolveDomain(target) || target || 'payments';
  const ic = safe(() => incidentControl(key, error || ''));
  const imp = safe(() => impactScore(key));
  const health = (liveHealth?.domains || []).find((d) => d.domain === key) || null;
  const aff = imp && !imp.error ? imp.affected : {};
  return {
    incident: { target: key, error: error || null },
    rootCause: ic && !ic.error ? ic : { note: 'incident-control unavailable', raw: ic },
    affectedDomains: imp?.whatBreaksIf ? [imp.whatBreaksIf.immediate, imp.whatBreaksIf.secondary].flat().filter(Boolean) : [],
    affectedMerchants: aff.merchants || 'NOT CONNECTED (count via /api/merchant-intelligence live)',
    affectedCustomers: aff.customers || 'NOT CONNECTED', affectedRevenue: aff.revenuePaths || 'NOT CONNECTED',
    affectedInfrastructure: { workers: aff.workers || [], queues: aff.queues || [] },
    recoverySteps: imp?.recoveryPath || [], rollbackSteps: imp?.rollbackPath || null, verificationSteps: imp?.verificationChecklist || [],
    riskScore: imp?.scores?.riskScore ?? health?.riskScore ?? null,
    liveBoundary: 'Root cause + recovery are repository-truth procedures. Live blast counts (merchants/customers/revenue) are NOT CONNECTED.',
  };
}
// Phase 12 — Time Travel.
function git(cmd, fb = '') { try { return execSync('git ' + cmd, { cwd: REPO_ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString().trim(); } catch { return fb; } }
function timeTravel() {
  const head = git('log -1 --format=%h|%ci|%s'); const [h, date, ...msg] = head.split('|');
  const lastMigration = git('log -1 --format=%h|%ci -- database/supabase/migrations').split('|');
  const migFile = git('ls-files database/supabase/migrations').split('\n').filter(Boolean).sort().pop() || null;
  const lastTag = git('describe --tags --abbrev=0', '') || null;
  const lastTagDate = lastTag ? git(`log -1 --format=%ci ${lastTag}`) : null;
  return {
    points: [
      { point: 'Now', basis: 'repository HEAD', status: 'CONNECTED', commit: h, when: date, subject: msg.join('|') },
      { point: 'Last Deployment', basis: 'git (no deploy log wired)', status: 'PARTIAL', commit: h, when: date, note: 'HEAD is the deployable state; actual deploy timestamps are NOT CONNECTED (Vercel/GitHub deployments API).' },
      { point: 'Last Migration', basis: 'git history (database/supabase/migrations)', status: 'CONNECTED', commit: lastMigration[0] || null, when: lastMigration[1] || null, file: migFile },
      { point: 'Last Release', basis: 'git tag', status: lastTag ? 'CONNECTED' : 'NOT CONNECTED', tag: lastTag, when: lastTagDate, note: lastTag ? null : 'No git tags — releases are not tagged.' },
      { point: '1 Hour Ago', basis: 'live state snapshot', status: 'NOT CONNECTED', requires: 'time-series store (Analytics Engine / metrics) — no historical live state retained.' },
      { point: 'Yesterday', basis: 'live state snapshot', status: 'NOT CONNECTED', requires: 'time-series store — NOT CONNECTED.' },
    ],
    compare: 'Repository time-points (commit/migration/release) are diffable via git. Live operational time-points need a wired metrics store.',
    liveBoundary: 'CONNECTED time-points are git-derived repository truth; live snapshots (1h ago / yesterday) are NOT CONNECTED.',
  };
}
// Phase 13 — Executive Command Center.
function executiveCenter() {
  const dims = launchCenter?.readiness || [];
  const find = (re) => dims.find((d) => re.test(d.dimension)) || null;
  const hs = liveHealth?.summary || {};
  const row = (label, dim, extra) => ({ readiness: label, score: dim?.score ?? null, evidence: dim?.evidence || extra || 'repository truth', status: dim ? (dim.score >= 90 ? 'GREEN' : dim.score >= 70 ? 'AMBER' : 'RED') : 'n/a' });
  return {
    mode: 'Founder', verdict: launchCenter?.summary?.recommendation || 'NO-GO', overallReadiness: launchCenter?.summary?.overallReadiness ?? null,
    panels: [
      row('Launch Readiness', find(/launch/i)),
      row('Merchant Readiness', find(/merchant/i), `${(merchantIntelV5?.summary?.operatingStages) || 0} operating stages`),
      row('Revenue Readiness', find(/revenue|commerce|payment/i), 'canonical ledger RPCs present; live GMV NOT CONNECTED'),
      row('Operations Readiness', find(/operation|infra/i), `${(infraIntel?.summary?.workers) || 0} workers`),
      row('Risk Readiness', find(/security|risk/i), `avg domain risk ${hs.avgRisk}`),
      row('Growth Readiness', find(/growth|adoption/i), 'merchant adoption structural'),
      row('Platform Readiness', find(/platform|deployment/i), 'migrate gate + rollback present'),
    ],
    openBlockers: launchCenter?.summary?.openBlockers ?? (launchCenter?.blockers || []).length, blockers: launchCenter?.blockers || [],
    health: { avgHealth: hs.avgHealth, avgRisk: hs.avgRisk, highRisk: hs.highRisk, availability: 'NOT CONNECTED' },
    liveBoundary: 'Readiness dimensions are repository-truth scores. Live revenue/traffic/uptime are NOT CONNECTED.',
  };
}
// Phase 14 — Merchant Operations Center.
function merchantOps() {
  const moneyDomains = ['orders', 'payments', 'refunds', 'payouts', 'gift-cards'];
  const health = (liveHealth?.domains || []).filter((d) => moneyDomains.includes(d.domain));
  return {
    merchantHealth: { structural: merchantHealth?.summary || null, live: 'NOT CONNECTED (active/inactive merchant counts → Supabase)' },
    storeHealth: { tenantTables: dbIntel?.summary?.tenantTables ?? null, rlsForced: dbIntel?.summary?.forceRlsTables ?? null, live: 'NOT CONNECTED' },
    orders: domainHealthCard('orders', health), payments: domainHealthCard('payments', health), refunds: domainHealthCard('refunds', health), payouts: domainHealthCard('payouts', health),
    supportSignals: { live: 'NOT CONNECTED', requires: 'support/ticketing feed' },
    liveBoundary: 'Money-domain structure + risk are repository truth; order/payment/refund/payout volumes are NOT CONNECTED.',
  };
}
// Phase 15 — Customer Operations Center.
function customerOps() {
  return {
    journeyHealth: { stages: journeyIntel?.summary?.stages ?? (journeyIntel?.stages || []).length, criticalStages: journeyIntel?.summary?.criticalStages || ['Payment', 'Refund'], live: 'NOT CONNECTED (funnel conversion → analytics)' },
    checkoutHealth: domainHealthCard('orders'), paymentHealth: domainHealthCard('payments'),
    supportHealth: { live: 'NOT CONNECTED', requires: 'support feed' },
    liveBoundary: 'Journey structure is repository truth; conversion/drop-off/support metrics are NOT CONNECTED.',
  };
}
// Phase 16 — Autonomous Change Impact (pre-deployment).
function changeImpactLive(key) {
  const imp = safe(() => impactScore(key));
  if (!imp || imp.error) return imp || { error: 'impact unavailable' };
  return {
    preDeployment: true, domain: key, whatBreaks: imp.whatBreaksIf,
    merchantsAffected: imp.affected.merchants, customersAffected: imp.affected.customers, revenueAffected: imp.affected.revenuePaths,
    scores: imp.scores, recovery: imp.recoveryPath, rollback: imp.rollbackPath, verification: imp.verificationChecklist,
    gate: imp.scores.riskScore >= 60 ? 'HIGH RISK — require step-up review + staged rollout' : imp.scores.riskScore >= 35 ? 'MODERATE — review owner + runbook' : 'LOW — standard review',
    liveBoundary: 'Blast radius is repository truth; affected merchant/customer/revenue magnitudes are NOT CONNECTED.',
  };
}
// Phase 17 — Autonomous Release Intelligence.
function releaseIntel() {
  const lastTag = git('describe --tags --abbrev=0', '') || null;
  const headLine = git('log -1 --format=%h|%ci|%s'); const [h, date, ...msg] = headLine.split('|');
  const ahead = lastTag ? git(`rev-list --count ${lastTag}..HEAD`, '?') : null;
  return {
    deploymentSummary: { head: h, when: date, subject: msg.join('|'), lastTag, commitsSinceTag: ahead, targets: (deploymentStateData?.targets || deploymentStateData?.declared || []) },
    riskScore: { value: Math.min(100, 40 + (launchCenter?.summary?.openBlockers || 0) * 10), basis: `${launchCenter?.summary?.openBlockers || 0} open blockers, ${launchCenter?.summary?.criticalRisks || 0} critical risks` },
    rollbackScore: { value: deploymentStateData?.rollback ? 'AVAILABLE' : 'UNKNOWN', basis: 'rollback script + migrate gate (infra-intel)' },
    recoveryPlan: { gate: infraIntel?.summary?.hasMigrateGate ? 'migrate gate present' : 'no gate', rollback: deploymentStateData?.rollback || 'see infra-intel', verdict: launchCenter?.summary?.recommendation || 'NO-GO' },
    liveBoundary: 'Release structure is git + repo truth; live deployment status/traffic are NOT CONNECTED (Vercel/GitHub deployments API).',
  };
}
// Phase 19 — Observability Hub.
function observability() {
  const hs = liveHealth?.summary || {};
  return {
    logs: { live: 'NOT CONNECTED', requires: 'Cloudflare Workers logs / Logpush' },
    events: { queues: runtimeObs?.summary?.queues ?? null, telemetryEmitters: runtimeObs?.summary?.telemetryEmitters ?? null, live: 'NOT CONNECTED (event volume → Analytics Engine)' },
    deployments: { targets: deploymentStateData?.targets || deploymentStateData?.declared || [], gate: deploymentStateData?.gate || null, live: 'NOT CONNECTED' },
    incidents: { structuralOpenBlockers: launchCenter?.summary?.openBlockers ?? null, domainsWithBlockers: hs.domainsWithOpenBlockers || [], live: 'NOT CONNECTED' },
    errors: { live: 'NOT CONNECTED', requires: 'error tracking (Cloudflare / Sentry)' },
    queues: { producers: infraIntel?.summary?.queueProducers || [], consumers: infraIntel?.summary?.queueConsumers || [], deadLetters: runtimeObs?.summary?.deadLetterQueues ?? null, liveDepth: 'NOT CONNECTED' },
    workers: { count: infraIntel?.summary?.workers ?? null, list: (infraIntel?.workers || []).map((w) => w.name), liveCpu: 'NOT CONNECTED' },
    connections: connectionsIntel?.summary || null,
    liveBoundary: 'Topology (workers/queues/deployments) is repository truth; logs/events/errors/live depth are NOT CONNECTED.',
  };
}
// Phase 20 — AI Operations Copilot.
function copilotX(q) {
  const ql = (q || '').toLowerCase();
  if (/what changed|yesterday|last (deploy|release|migration)|time travel|when did/.test(ql)) return { question: q, intent: 'time-travel', answer: timeTravel() };
  if (/root cause|why did|caused|incident/.test(ql)) return { question: q, intent: 'root-cause', answer: rootCause(q, '') };
  if (/risk|breaks if|impact|blast/.test(ql)) { const k = resolveDomain(q) || 'payments'; return { question: q, intent: 'impact', domain: k, answer: changeImpactLive(k) }; }
  if (/cost|spend|bill|forecast/.test(ql)) return { question: q, intent: 'cost', answer: costIntel?.summary || costIntel };
  if (/health|status|availability|up|down/.test(ql)) { const k = resolveDomain(q); return { question: q, intent: 'health', answer: k ? (liveHealth.domains.find((d) => d.domain === k) || liveHealth.summary) : liveHealth.summary }; }
  if (/why is|failing|slow|broken|not working|error/.test(ql)) return { question: q, intent: 'investigate', answer: investigate(q) };
  return { question: q, intent: 'investigate', answer: investigate(q), note: 'Defaulted to investigation. Live values are CONNECTED or NOT CONNECTED — never fabricated.' };
}

// ====================================================================================
// LCIS V11 — Business + Operational Intelligence. READ-ONLY composition over existing engines.
// ====================================================================================
// Phase 3 — Business Impact (plain language) — composes impact-score + explain.
function businessImpact(key) {
  const imp = safe(() => impactScore(key));
  if (!imp || imp.error) return imp || { error: 'impact unavailable' };
  const n = explainIntel?.nodes?.[key];
  const money = n?.technical?.money, tenant = n?.technical?.tenant;
  const w = imp.whatBreaksIf || {};
  const label = n?.label || key;
  return {
    domain: key, label,
    merchantImpact: { plain: money
      ? `Every merchant's money flow runs through ${label}. A failure blocks orders/payments/payouts across ALL tenants (single shared Postgres + single deploy pipeline).`
      : `${label} affects merchant ${String(w.merchantImpact || 'operations')}.`, affected: imp.affected.merchants },
    customerImpact: { plain: money || tenant
      ? `Shoppers feel ${label} failures directly at ${key === 'payments' ? 'payment' : key === 'orders' || key === 'checkout' ? 'checkout' : 'their journey'} — ${String(w.customerImpact || 'degraded experience')}.`
      : `Indirect customer impact.`, affected: imp.affected.customers },
    revenueImpact: { plain: money ? 'On the money path — revenue directly at risk. Magnitude is query-bound (ledger reconciliation) — NOT CONNECTED.' : 'Indirect — no direct money mutation.', paths: imp.affected.revenuePaths },
    operationalImpact: { plain: `${imp.affected.workers.length} workers, ${imp.affected.queues.length} queues carry ${label}; ${String(w.operationalImpact || '')}.`, workers: imp.affected.workers, queues: imp.affected.queues },
    growthImpact: { plain: tenant ? 'Tenant-scoped — scales per merchant, but blast radius is all tenants on the shared schema (scaling SPOF).' : 'Platform-internal — limited growth coupling.' },
    launchImpact: { plain: String(imp.affected.launchReadiness || 'no open blocker') },
    scores: imp.scores,
    liveBoundary: 'Impact is repository-truth blast radius; magnitudes (revenue, merchant/customer counts) are NOT CONNECTED.',
  };
}
// Phase 15 — Investor Mode — plain-language platform/business/growth/revenue/risk (composition).
function investorMode() {
  const di = domainIntel?.summary || {}, db = dbIntel?.summary || {};
  const rv = readinessV2?.summary || {}, lc = launchCenter?.summary || {};
  const sec = securityIntelV5?.summary || {}, mi = merchantIntelV5?.summary || {}, rev = revenueV2?.summary || {};
  const bf = businessFlow?.summary || {};
  return {
    mode: 'Investor',
    platformOverview: { plain: `LetBuyy is a multi-tenant, India-first commerce operating system: one platform hosts many merchant stores (every row scoped by site_id). ${di.domains || 22} business domains, ${db.tables || 414} tables, ${db.functions || 156} database functions, ${db.policies || 651} row-level-security policies.`,
      domains: di.domains || 22, tables: db.tables || 0, rpcs: db.functions || 0, tenantModel: `${db.tenantTables || 0} tenant-scoped tables (RLS forced)` },
    businessModel: { plain: 'Merchants run storefronts on shared infrastructure; orders, payments (Razorpay + COD), GST invoicing, refunds, gift cards and payouts are all platform-operated. Money is server-authoritative through a canonical Postgres ledger.', moneyJourneys: bf.moneyJourneys || [], paymentMethods: ['Razorpay', 'COD'] },
    merchantLifecycle: { plain: 'Signup → store setup → catalog → inventory → orders → payments → payouts → analytics → growth.', operatingStages: mi.operatingStages || null, source: '/api/merchant + /api/business-flow?journey=merchant' },
    growthSystems: { plain: 'Growth = more merchants (multi-tenant) × more orders per merchant. Adoption/growth signals are structural; live cohort/retention is query-bound.', live: 'NOT CONNECTED', source: '/api/merchant-growth, /api/merchant-adoption' },
    revenueSystems: { plain: 'Revenue moves through a canonical ledger (SECURITY DEFINER RPCs): checkout → capture → settlement → payout; refunds and gift-card liability are ledger projections.', moneyRpcs: rev.moneyRpcs || null, giftCardLiability: rev.giftCardLiabilityModeled ?? null, liveAmounts: 'NOT CONNECTED', source: '/api/revenue-v2' },
    riskSystems: { plain: `Primary risk is concentration: a single shared Postgres + single deploy pipeline = all-merchant blast radius. Launch verdict is ${lc.recommendation || 'NO-GO'} with ${lc.openBlockers ?? '5'} open blockers. ${sec.controlsPresent ?? ''}/${sec.controls ?? ''} security controls present; ${sec.crossTenantCandidates ?? 0} cross-tenant candidates to review.`,
      launchVerdict: lc.recommendation || rv.launchVerdict || 'NO-GO', openBlockers: lc.openBlockers ?? null, securityControls: `${sec.controlsPresent ?? '?'}/${sec.controls ?? '?'}`, singleTenantSpof: true },
    readiness: { overall: rv.overall ?? lc.overallReadiness ?? null, verdict: lc.recommendation || 'NO-GO' },
    liveBoundary: 'Structural truth from the repository. All money/growth/traffic magnitudes are NOT CONNECTED (query-bound: Supabase ledger + Analytics Engine).',
  };
}
// Phase 16 — New Developer Mode (30 minutes) — composes explain.gettingStarted + flows + journeys.
function developerMode() {
  const gs = explainIntel?.gettingStarted || null;
  const flows = explainIntel?.flows || {};
  return {
    mode: 'New Developer — Understand LetBuyy in 30 minutes',
    gettingStarted: gs,
    architecture: gs?.steps || [],
    domains: Object.keys(explainIntel?.nodes || {}),
    flows: Object.fromEntries(Object.entries(flows).slice(0, 12)),
    journeys: (businessFlow?.journeys || []).filter((j) => j.status === 'IMPLEMENTED').map((j) => ({ key: j.key, label: j.label, purpose: j.purpose })),
    operations: '/api/operations', runbooks: '/api/runbook?domain=', launch: '/api/launch-command-center',
    next: { onboardingDoc: 'docs/central-intelligence/ONBOARDING.md', aiPack: '/api/ai-context-pack?target=claude' },
  };
}

// ====================================================================================
// LCIS OMEGA — Production OS. READ-ONLY composition over existing engines. No manual status.
// ====================================================================================
// Phase 1 — Launch status: per-area READY / AT RISK / BLOCKED from repository truth.
function launchStatus() {
  const dims = readinessV2?.dimensions || readinessV2?.summary?.dimensions || [];
  const dimOf = (re) => { const d = dims.find((x) => new RegExp(re, 'i').test(x.dimension)); return d ? { score: d.score, evidence: d.evidence } : { score: null, evidence: 'n/a' }; };
  const blockers = launchCenter?.blockers || [];
  // V1 blockers mapped to launch areas (repository titles).
  const BLK = { payment: ['LB-7'], tenant: [], auth: ['LB-12'], marketplace: ['LB-8', 'LB-9'], operational: ['LB-10', 'LB-7'] };
  const classify = (score, blk) => blk.length ? 'BLOCKED' : score == null ? 'AT RISK' : score >= 90 ? 'READY' : score >= 70 ? 'AT RISK' : 'BLOCKED';
  const area = (key, label, dimRe, extra) => { const d = dimOf(dimRe); const blk = blockers.filter((b) => (BLK[key] || []).includes(b.id)); return { area: label, status: classify(d.score, blk), score: d.score, evidence: `${extra} ${d.evidence}`.trim(), blockers: blk.map((b) => `${b.id} ${b.title || ''}`.trim()) }; };
  const areas = [
    area('payment', 'Payment readiness', 'Revenue', 'Canonical ledger RPCs + Razorpay HMAC + COD.'),
    area('tenant', 'Tenant readiness', 'Security', 'RLS forced on tenant tables + verifySiteOwnership.'),
    area('auth', 'Auth readiness', 'Security', 'Two issuers (HS256 customer / ES256 merchant) + step-up.'),
    area('marketplace', 'Marketplace readiness', 'Architecture', 'app/theme/developer marketplace frozen (not deploy targets).'),
    area('operational', 'Operational readiness', 'Operations', 'workers/queues + migrate gate + rollback script.'),
  ];
  const counts = areas.reduce((a, x) => (a[x.status] = (a[x.status] || 0) + 1, a), {});
  return {
    verdict: launchCenter?.summary?.recommendation || 'NO-GO',
    overallReadiness: launchCenter?.summary?.overallReadiness ?? null,
    openBlockers: launchCenter?.summary?.openBlockers ?? blockers.length,
    blockers, areas, counts, dimensions: dims,
    legend: { READY: 'score ≥ 90 and no open blocker', 'AT RISK': 'score 70–89', BLOCKED: 'open blocker or score < 70' },
    note: 'Status is generated from repository truth (production-readiness-v2 + V1 blockers). No manual status. Live readiness needs a connected environment.',
  };
}
// Phase 6 — AI Operations Center: ranked answers + evidence (composes decision-engine-v2).
function aiOps() {
  const d = decisionV2;
  if (!d || d.error) return d || { error: 'decision-v2 missing — run pnpm graph:omega' };
  const willFail = detectPredict && !detectPredict.error ? detectPredict.prediction.whatFailsNext : [];
  return {
    mode: 'AI Operations Commander',
    questions: [
      { q: 'What should I fix next?', answer: d.fixNext || [], evidence: 'ranked by blast radius + launch impact (open V1 blockers first)' },
      { q: 'What will break next?', answer: willFail, evidence: 'ranked structural predisposition (money path + degraded deps + open blockers + blast radius); confirming live signal NOT CONNECTED' },
      { q: 'What blocks launch?', answer: d.blocksLaunch || [], evidence: 'open V1 blockers + readiness gaps' },
      { q: 'What blocks 100 merchants / 1k / 10k merchants / 10k / 100k users?', answer: d.blocksScale || [], evidence: `scale tiers: ${(d.summary?.scaleTiers || []).join(', ')}` },
      { q: 'What are my highest risks?', answer: d.highestRisk || [], evidence: 'risk = money + tenant + open blockers + fan-in (blast radius)' },
    ],
    summary: d.summary, ranked: true, repoScan: 'not required',
    liveBoundary: 'Rankings are repository-truth heuristics; live incident frequency / usage magnitudes are NOT CONNECTED.',
  };
}

// ---- v3: customer-journey (Phase 5) + secret intelligence (Phase 10), computed from loaded intel ----
const JOURNEY = [
  { stage: 'Landing', domains: ['storefront'], app: 'marketing-site / customer-web' },
  { stage: 'Storefront', domains: ['storefront'], app: 'customer-web' },
  { stage: 'Product', domains: ['products', 'collections'], app: 'customer-web' },
  { stage: 'Cart', domains: ['orders'], app: 'customer-web' },
  { stage: 'Checkout', domains: ['orders', 'discounts', 'gst', 'shipping'], app: 'customer-web' },
  { stage: 'Payment', domains: ['payments', 'gift-cards'], app: 'customer-web → api-gateway' },
  { stage: 'Order', domains: ['orders', 'inventory'], app: 'api-gateway → queue-workers' },
  { stage: 'Refund', domains: ['refunds'], app: 'merchant-web' },
  { stage: 'Tracking', domains: ['shipping', 'notifications'], app: 'customer-web' },
];
function customerJourney() {
  if (!domainIntel) return { error: 'domain-intel.json missing — run pnpm graph:domain' };
  const byKey = Object.fromEntries(domainIntel.domains.map((d) => [d.key, d]));
  const stages = JOURNEY.map((s) => {
    const ds = s.domains.map((k) => byKey[k]).filter(Boolean);
    return { stage: s.stage, app: s.app, domains: s.domains,
      routes: [...new Set(ds.flatMap((d) => d.routes))], rpcs: [...new Set(ds.flatMap((d) => d.rpcs))].slice(0, 20),
      tables: [...new Set(ds.flatMap((d) => d.tables))], money: ds.some((d) => d.money) };
  });
  return { funnel: JOURNEY.map((s) => s.stage), stages };
}
function secretIntel() {
  if (!infraIntel || !domainIntel) return { error: 'infra-intel.json / domain-intel.json missing' };
  return {
    secrets: infraIntel.secrets.map((name) => {
      const domains = domainIntel.domains.filter((d) => d.secrets.includes(name));
      const workers = [...new Set(domains.flatMap((d) => d.workers))];
      return { secret: name, services: workers.length ? workers : ['letbuyy-api'],
        domains: domains.map((d) => d.key), features: domains.map((d) => d.label) };
    }),
    note: 'secrets are set via `wrangler secret put` at deploy (production-deploy.yml); never stored in the repo',
  };
}

// ---- indexes ----
const byId = new Map();
for (const n of nodes) byId.set(n.id, n);
const outAdj = new Map();
const inAdj = new Map();
const degree = new Map();
for (const e of links) {
  const s = e.source, t = e.target;
  if (!outAdj.has(s)) outAdj.set(s, []);
  if (!inAdj.has(t)) inAdj.set(t, []);
  outAdj.get(s).push({ id: t, relation: e.relation });
  inAdj.get(t).push({ id: s, relation: e.relation });
  degree.set(s, (degree.get(s) || 0) + 1);
  degree.set(t, (degree.get(t) || 0) + 1);
}

// ---- domain matchers (for dashboard tabs) ----
const DOMAINS = {
  services: (n) => /^services\//.test(n.source_file || ''),
  apps: (n) => /^apps\//.test(n.source_file || ''),
  packages: (n) => /^packages\//.test(n.source_file || ''),
  payments: (n) => /payment|razorpay|refund|ledger|checkout|cod|settlement|commission|payout|gift_card|money/i.test((n.source_file || '') + ' ' + (n.label || '')),
  identity: (n) => /auth|session|jwt|identity|\blogin\b|register|token|step.?up|oauth|turnstile|credential/i.test((n.source_file || '') + ' ' + (n.label || '')),
  database: (n) => /database\/|supabase|\.sql$|migration|rls|policy/i.test((n.source_file || '') + ' ' + (n.label || '')),
  marketplace: (n) => /app-marketplace|theme-marketplace/i.test(n.source_file || ''),
  themes: (n) => /theme-engine|theme|liquid|renderer|sanitize/i.test((n.source_file || '') + ' ' + (n.label || '')),
  developer: (n) => /developer-portal|developer/i.test(n.source_file || ''),
  security: (n) => /security|\brls\b|hmac|sign|verify|sanitize|crypto|secret|ownership/i.test((n.source_file || '') + ' ' + (n.label || '')),
  tenancy: (n) => /site_id|tenant|verifysiteownership|ownership|rls/i.test((n.source_file || '') + ' ' + (n.label || '')),
};

function workspaceOf(sf) {
  const m = (sf || '').match(/^(apps\/deferred\/[^/]+\/[^/]+|reference\/apps\/[^/]+|apps\/[^/]+\/[^/]+|services\/[^/]+|packages\/[^/]+\/[^/]+|packages\/[^/]+)/);
  return m ? m[1] : '(root)';
}

// ---- precomputed stats ----
const stats = (() => {
  const langs = {}, ws = {};
  let routes = 0, pages = 0, sqlFiles = new Set();
  for (const n of nodes) {
    const sf = n.source_file || '';
    const ext = (sf.match(/\.([a-z0-9]+)$/i) || [])[1];
    if (ext) langs[ext] = (langs[ext] || 0) + 1;
    ws[workspaceOf(sf)] = (ws[workspaceOf(sf)] || 0) + 1;
    if (/\/route\.ts$/.test(sf)) routes++;
    if (/\/page\.tsx$/.test(sf)) pages++;
    if (/database\/supabase\/migrations\/.*\.sql$/.test(sf)) sqlFiles.add(sf);
  }
  const communities = new Set(nodes.map((n) => n.community)).size;
  return {
    nodes: nodes.length, edges: links.length, communities,
    routes, pages, migrations: sqlFiles.size,
    languages: topN(langs, 12), workspaces: topN(ws, 30),
    built_at_commit: raw.built_at_commit || null,
    generated_at: stat.mtime.toISOString(),
    freshness_minutes: Math.round((Date.now() - stat.mtimeMs) / 60000),
  };
})();

function topN(obj, n) {
  return Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(([k, v]) => ({ key: k, count: v }));
}
function nodeView(id) {
  const n = byId.get(id); if (!n) return null;
  return { id, label: n.label, source_file: n.source_file, source_location: n.source_location, community: n.community, file_type: n.file_type, degree: degree.get(id) || 0 };
}

function search(q, limit = 50) {
  if (!q) return [];
  const ql = q.toLowerCase();
  const exact = [], starts = [], inc = [];
  for (const n of nodes) {
    const l = (n.label || '').toLowerCase();
    const sf = (n.source_file || '').toLowerCase();
    if (l === ql) exact.push(n);
    else if (l.startsWith(ql) || sf.includes('/' + ql)) starts.push(n);
    else if (l.includes(ql) || sf.includes(ql)) inc.push(n);
    if (exact.length + starts.length + inc.length > limit * 4) break;
  }
  return [...exact, ...starts, ...inc]
    .sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0))
    .slice(0, limit).map((n) => nodeView(n.id));
}

function neighbors(id, depth = 1, limit = 80) {
  if (!byId.has(id)) return { nodes: [], links: [] };
  const seen = new Set([id]);
  let frontier = [id];
  const edgeSet = [];
  for (let d = 0; d < depth; d++) {
    const next = [];
    for (const cur of frontier) {
      for (const e of (outAdj.get(cur) || [])) { edgeSet.push({ source: cur, target: e.id, relation: e.relation }); if (!seen.has(e.id) && seen.size < limit) { seen.add(e.id); next.push(e.id); } }
      for (const e of (inAdj.get(cur) || [])) { edgeSet.push({ source: e.id, target: cur, relation: e.relation }); if (!seen.has(e.id) && seen.size < limit) { seen.add(e.id); next.push(e.id); } }
    }
    frontier = next;
  }
  const ns = [...seen].map(nodeView).filter(Boolean);
  const idset = new Set(seen);
  const ls = edgeSet.filter((e) => idset.has(e.source) && idset.has(e.target));
  return { nodes: ns, links: dedupeLinks(ls), root: id };
}
function dedupeLinks(ls) {
  const m = new Map();
  for (const e of ls) m.set(e.source + '>' + e.target + '>' + e.relation, e);
  return [...m.values()];
}

// V10 — human verb for a typed edge relation (used in path explanations).
const RELATION_VERB = {
  imports: 'imports', imports_from: 'imports from', re_exports: 're-exports', exports: 'exports',
  calls: 'calls', method: 'calls method on', references: 'references', defines: 'defines',
  contains: 'contains', inherits: 'inherits from', extends: 'extends', implements: 'implements',
  mixes_in: 'mixes in', navigates: 'navigates to', path: 'connects to', relates_to: 'relates to',
};
function explainRelation(rel, from, to) {
  const v = RELATION_VERB[rel] || 'connects to';
  return `${from} ${v} ${to}`;
}
function shortestPath(a, b) {
  if (!byId.has(a) || !byId.has(b)) return { path: [], reason: 'unknown node' };
  const prev = new Map([[a, null]]);
  const relTo = new Map();              // node id -> relation of the edge that discovered it
  const queue = [a];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === b) break;
    const nbrs = [...(outAdj.get(cur) || []), ...(inAdj.get(cur) || [])];
    for (const e of nbrs) { if (!prev.has(e.id)) { prev.set(e.id, cur); relTo.set(e.id, e.relation || 'relates_to'); queue.push(e.id); } }
  }
  if (!prev.has(b)) return { path: [], reason: 'no path' };
  const path = []; let c = b; while (c != null) { path.unshift(c); c = prev.get(c); }
  const ns = path.map(nodeView);
  const ls = [];
  const steps = [];
  for (let i = 0; i < path.length - 1; i++) {
    const rel = relTo.get(path[i + 1]) || 'relates_to';
    ls.push({ source: path[i], target: path[i + 1], relation: rel });
    const fromL = ns[i]?.label || path[i], toL = ns[i + 1]?.label || path[i + 1];
    steps.push({ n: i + 1, from: fromL, to: toL, relation: rel, explanation: explainRelation(rel, fromL, toL) });
  }
  return { path, nodes: ns, links: ls, steps };
}

function domain(key, limit = 60) {
  const match = DOMAINS[key]; if (!match) return null;
  const matched = nodes.filter(match);
  const files = new Set(matched.map((n) => n.source_file));
  const ws = {};
  let edgeCount = 0;
  for (const n of matched) { ws[workspaceOf(n.source_file)] = (ws[workspaceOf(n.source_file)] || 0) + 1; edgeCount += (degree.get(n.id) || 0); }
  const avgDeg = matched.length ? edgeCount / matched.length : 0;
  // heuristic attention/complexity score (NOT a vulnerability score)
  const risk = Math.min(100, Math.round((matched.length / Math.max(1, nodes.length)) * 600 + avgDeg * 4));
  const top = matched.sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0)).slice(0, limit).map((n) => nodeView(n.id));
  return { key, nodes: matched.length, files: files.size, relationships: edgeCount, avgDegree: Number(avgDeg.toFixed(1)), risk, workspaces: topN(ws, 12), top };
}

// ---- central intelligence: blast radius (inbound BFS = who breaks if this changes) ----
function blastRadius(id, depth = 3) {
  if (!byId.has(id)) return null;
  const seen = new Set([id]); let frontier = [id]; const layers = [];
  for (let d = 0; d < depth; d++) { const next = []; for (const cur of frontier) for (const e of (inAdj.get(cur) || [])) if (!seen.has(e.id)) { seen.add(e.id); next.push(e.id); } if (!next.length) break; layers.push(next.length); frontier = next; }
  const impacted = [...seen].filter((x) => x !== id);
  const files = new Set(impacted.map((x) => byId.get(x)?.source_file).filter(Boolean));
  return { node: nodeView(id), impactedNodes: impacted.length, impactedFiles: files.size, layers, top: impacted.map(nodeView).sort((a, b) => b.degree - a.degree).slice(0, 14) };
}
function dbView() {
  if (!dbIntel) return { error: 'db-intel.json missing — run pnpm graph:db' };
  const s = dbIntel.summary;
  return {
    summary: s,
    moneyRpcs: dbIntel.functions.filter((f) => f.money).map((f) => ({ rpc: f.name, securityDefiner: f.securityDefiner, idempotency: f.hasIdempotency, forUpdate: f.forUpdate, tables: f.touches.filter((t) => s.moneyTablesPresent.includes(t)), calledBy: (f.callers[0] || '').replace('services/api-gateway/src/', '') || '(internal/trigger)' })),
    topTables: dbIntel.tables.sort((a, b) => (b.policies.length + b.triggers.length + b.indexes) - (a.policies.length + a.triggers.length + a.indexes)).slice(0, 20).map((t) => ({ name: t.name, columns: t.columns, rls: t.rls, force: t.force, tenant: t.tenant, money: t.money, policies: t.policies.length, triggers: t.triggers.length, indexes: t.indexes })),
    uncalledRpcs: dbIntel.functions.filter((f) => !f.callers.length && f.securityDefiner).map((f) => f.name).slice(0, 30),
  };
}

// ---- atlas (full-graph community-colored layout, computed server-side + cached) ----
const PALETTE = ['#8B5CF6', '#58a6ff', '#3fb950', '#d29922', '#f85149', '#db61a2', '#39c5cf', '#bc8cff', '#e3b341', '#7ee787', '#ffa657', '#a5d6ff', '#ff7b72', '#56d364', '#e2c08d', '#79c0ff', '#f0883e', '#6ca0f6'];
const communitySizes = (() => { const m = {}; for (const n of nodes) m[n.community] = (m[n.community] || 0) + 1; return m; })();
const communityColor = (() => {
  const ranked = Object.keys(communitySizes).sort((a, b) => communitySizes[b] - communitySizes[a]);
  const map = new Map(); ranked.forEach((c, i) => map.set(c, PALETTE[i % PALETTE.length])); return map;
})();
const atlasCache = new Map();

// ---- community profiling: derive a human-readable name + what-it-is from the graph ----
const WS_NAMES = {
  'services/api-gateway': 'API Gateway', 'services/queue-workers': 'Queue Workers', 'services/webhook-service': 'Webhook Service', 'services/mobile-bff': 'Mobile BFF',
  'apps/merchant/web': 'Merchant Control Plane', 'apps/commerce/web': 'Storefront Runtime', 'apps/platform/identity': 'Identity Platform', 'apps/internal/console': 'Platform Console', 'apps/marketing/web': 'Marketing Site', 'apps/frozen/app-store': 'App Marketplace', 'apps/frozen/theme-store': 'Theme Marketplace', 'apps/frozen/developer-portal': 'Developer Portal', 'apps/frozen/operations-portal': 'Ops Portal',
  'apps/merchant/mobile': 'Merchant Mobile App',
  'packages/theme-engine': 'Theme Engine', 'packages/shared-types': 'Shared Types', 'packages/commerce-core': 'Commerce Core', 'packages/checkout-core': 'Checkout Core', 'packages/auth-core': 'Auth Core', 'packages/identity-core': 'Identity Core', 'packages/session-core': 'Session Core', 'packages/permission-core': 'Permission Core', 'packages/infrastructure': 'Infrastructure', 'packages/notification-core': 'Notification Core', 'packages/event-core': 'Event Core', 'packages/billing-core': 'Billing Core', 'packages/tenant-core': 'Tenant Core', 'packages/cms-core': 'CMS Core', 'packages/audit-core': 'Audit Core',
  'packages/typescript/ui': 'UI Design System', 'packages/typescript/api-client': 'API Client', 'packages/typescript/api-types': 'API Types',
  'packages/dart/models': 'Dart Models', 'packages/dart/core': 'Dart Core', 'packages/dart/api_client': 'Dart API Client', 'packages/dart/ui_kit': 'Dart UI Kit',
  '(root)': 'Repository root / governance',
};
function humanizeWs(ws) {
  if (WS_NAMES[ws]) return WS_NAMES[ws];
  const seg = (ws.split('/').pop() || ws).replace(/[-_]/g, ' ');
  return seg.replace(/\b\w/g, (c) => c.toUpperCase());
}
function deriveHint(ns) {
  const ext = {}; let routes = 0;
  for (const n of ns) { const sf = n.source_file || ''; const m = sf.match(/\.([a-z0-9]+)$/i); if (m) ext[m[1]] = (ext[m[1]] || 0) + 1; if (/\/route\.ts$/.test(sf)) routes++; }
  const top = Object.entries(ext).sort((a, b) => b[1] - a[1])[0]?.[0];
  if (routes > ns.length * 0.15) return 'API routes';
  if (top === 'tsx') return 'React UI';
  if (top === 'dart') return 'Flutter';
  if (top === 'sql') return 'database / migrations';
  if (top === 'mjs') return 'tooling / tests';
  if (top === 'md') return 'docs / governance';
  if (top === 'ts') return 'TypeScript';
  return top || 'mixed';
}
let nodesByCommunity = null;
const profileCache = new Map();
function communityProfile(cid) {
  cid = String(cid);
  if (profileCache.has(cid)) return profileCache.get(cid);
  if (!nodesByCommunity) { nodesByCommunity = new Map(); for (const n of nodes) { const c = String(n.community); (nodesByCommunity.get(c) || nodesByCommunity.set(c, []).get(c)).push(n); } }
  const ns = nodesByCommunity.get(cid) || [];
  const ws = {}; for (const n of ns) { const w = workspaceOf(n.source_file); ws[w] = (ws[w] || 0) + 1; }
  const topWs = Object.entries(ws).sort((a, b) => b[1] - a[1]);
  const dom = topWs[0] ? topWs[0][0] : '(root)';
  const top = [...ns].sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0)).slice(0, 5).map((n) => n.label.slice(0, 40));
  const p = { id: cid, name: humanizeWs(dom), hint: deriveHint(ns), workspace: dom, size: ns.length, share: ns.length ? Math.round((topWs[0][1] / ns.length) * 100) : 0, top };
  profileCache.set(cid, p); return p;
}

function buildLayout(pool, edgeList) {
  const N = pool.length;
  const radius = 420 + Math.sqrt(N) * 4;
  const pos = pool.map((_, i) => ({ x: Math.cos((i / N) * 6.283) * radius + (Math.random() * 80 - 40), y: Math.sin((i / N) * 6.283) * radius + (Math.random() * 80 - 40), vx: 0, vy: 0 }));
  const iters = N > 30000 ? 15 : N > 10000 ? 30 : N > 5000 ? 60 : N > 1200 ? 180 : 280;
  const cell = N > 20000 ? 160 : N > 5000 ? 100 : 70, R2 = (cell * 3) ** 2;
  for (let it = 0; it < iters; it++) {
    const cool = 1 - (it / iters) * 0.6;
    const grid = new Map();
    for (let i = 0; i < N; i++) { const k = Math.floor(pos[i].x / cell) + ',' + Math.floor(pos[i].y / cell); (grid.get(k) || grid.set(k, []).get(k)).push(i); }
    for (let i = 0; i < N; i++) {
      const a = pos[i], gx = Math.floor(a.x / cell), gy = Math.floor(a.y / cell);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) {
        const arr = grid.get((gx + dx) + ',' + (gy + dy)); if (!arr) continue;
        for (const j of arr) { if (j <= i) continue; const b = pos[j]; let ddx = a.x - b.x, ddy = a.y - b.y; let d2 = ddx * ddx + ddy * ddy || 0.01; if (d2 > R2) continue; const f = 1100 / d2, d = Math.sqrt(d2); ddx /= d; ddy /= d; a.vx += ddx * f; a.vy += ddy * f; b.vx -= ddx * f; b.vy -= ddy * f; }
      }
    }
    for (const [s, t] of edgeList) { const a = pos[s], b = pos[t]; let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 0.01; const f = (d - 45) * 0.012; dx /= d; dy /= d; a.vx += dx * f; a.vy += dy * f; b.vx -= dx * f; b.vy -= dy * f; }
    for (let i = 0; i < N; i++) { const p = pos[i]; p.vx += -p.x * 0.0007; p.vy += -p.y * 0.0007; p.x += Math.max(-34, Math.min(34, p.vx * cool)); p.y += Math.max(-34, Math.min(34, p.vy * cool)); p.vx *= 0.86; p.vy *= 0.86; }
  }
  return pos;
}

function atlas({ limit = 1400, domain = '', community = '' } = {}) {
  limit = Math.max(100, Math.min(75000, limit));
  const key = `${limit}|${domain}|${community}`;
  if (atlasCache.has(key)) return atlasCache.get(key);
  let pool = nodes;
  if (domain && DOMAINS[domain]) pool = pool.filter(DOMAINS[domain]);
  if (community) pool = pool.filter((n) => String(n.community) === String(community));
  const total = pool.length;
  pool = [...pool].sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0)).slice(0, limit);
  const idx = new Map(pool.map((n, i) => [n.id, i]));
  const edgeList = [];
  for (const e of links) { const s = idx.get(e.source), t = idx.get(e.target); if (s !== undefined && t !== undefined && s !== t) edgeList.push([s, t]); }
  const pos = buildLayout(pool, edgeList);
  const outNodes = pool.map((n, i) => ({ id: n.id, label: (n.label || '').slice(0, 60), x: Math.round(pos[i].x), y: Math.round(pos[i].y), c: String(n.community), d: degree.get(n.id) || 0, color: communityColor.get(String(n.community)) || '#8b949e' }));
  const cc = {};
  for (const n of pool) cc[n.community] = (cc[n.community] || 0) + 1;
  const comms = Object.entries(cc).sort((a, b) => b[1] - a[1]).slice(0, 18).map(([id, count]) => {
    const pr = communityProfile(id);
    return { id, count, color: communityColor.get(String(id)) || '#8b949e', name: pr.name, hint: pr.hint, workspace: pr.workspace, share: pr.share, size: pr.size, top: pr.top.slice(0, 3) };
  });
  const result = { total, shown: outNodes.length, nodes: outNodes, links: edgeList, communities: comms };
  atlasCache.set(key, result);
  return result;
}

// ---- http ----
const indexHtml = readFileSync(join(__dirname, 'index.html'), 'utf8');
function json(res, obj, code = 200) { const b = JSON.stringify(obj); res.writeHead(code, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(b) }); res.end(b); }

const server = createServer((req, res) => {
  const u = new URL(req.url, `http://localhost:${PORT}`);
  const p = u.pathname;
  try {
    if (p === '/' || p === '/index.html') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(indexHtml); }
    if (p === '/logo.svg' || p === '/mark.svg') {
      const file = p === '/mark.svg' ? 'letbuyy-mark.svg' : 'letbuyy-logo-dark.svg';
      const fp = join(REPO_ROOT, 'apps/marketing/web/public/icons', file);
      if (existsSync(fp)) { res.writeHead(200, { 'content-type': 'image/svg+xml', 'cache-control': 'max-age=3600' }); return res.end(readFileSync(fp)); }
      res.writeHead(404); return res.end();
    }
    if (p === '/api/stats') return json(res, stats);
    if (p === '/api/search') return json(res, search(u.searchParams.get('q') || '', Number(u.searchParams.get('limit') || 50)));
    if (p === '/api/node') { const v = neighbors(u.searchParams.get('id'), 1, 60); const n = byId.get(u.searchParams.get('id')); return json(res, { node: nodeView(u.searchParams.get('id')), graph: v, raw: n || null }); }
    if (p === '/api/neighbors') return json(res, neighbors(u.searchParams.get('id'), Number(u.searchParams.get('depth') || 1), Number(u.searchParams.get('limit') || 80)));
    if (p === '/api/path') return json(res, shortestPath(u.searchParams.get('a'), u.searchParams.get('b')));
    if (p === '/api/graph-domain') return json(res, domain(u.searchParams.get('key') || 'services'));
    if (p === '/api/atlas') return json(res, atlas({ limit: Number(u.searchParams.get('limit') || 1400), domain: u.searchParams.get('domain') || '', community: u.searchParams.get('community') || '' }));
    if (p === '/api/community') {
      const cid = String(u.searchParams.get('id') || '');
      const pr = communityProfile(cid);
      const ns = (nodesByCommunity.get(cid) || []);
      const ws = {}; const files = new Set();
      for (const n of ns) { ws[workspaceOf(n.source_file)] = (ws[workspaceOf(n.source_file)] || 0) + 1; if (n.source_file) files.add(n.source_file); }
      const top = [...ns].sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0)).slice(0, 12).map((n) => nodeView(n.id));
      return json(res, { ...pr, files: files.size, color: communityColor.get(cid) || '#8b949e', workspaces: topN(ws, 6), top });
    }
    if (p === '/api/db') return json(res, dbView());
    if (p === '/api/infra') return json(res, infraIntel ? infraIntel.summary : { error: 'infra-intel.json missing — run pnpm graph:infra' });
    if (p === '/api/table') return json(res, traceTable({ db: dbIntel }, u.searchParams.get('name') || ''));
    if (p === '/api/rpc') return json(res, traceRPC({ db: dbIntel }, u.searchParams.get('name') || ''));
    if (p === '/api/policy') return json(res, tracePolicy({ db: dbIntel }, u.searchParams.get('table') || ''));
    if (p === '/api/owner') return json(res, findOwnership({ nodes, byId, deg: degree, infra: infraIntel }, u.searchParams.get('q') || ''));
    // ---- v3 domain / cross-domain / payment / security / deployment / incident / merchant / journey / secrets ----
    if (p === '/api/domains') return json(res, domainIntel ? listDomains(domainIntel) : { error: 'domain-intel.json missing — run pnpm graph:domain' });
    if (p === '/api/domain') {
      if (!domainIntel) return json(res, { error: 'domain-intel.json missing — run pnpm graph:domain' });
      const key = u.searchParams.get('key') || '';
      return json(res, key ? traceDomain(domainIntel, key) : { summary: domainIntel.summary, domains: listDomains(domainIntel), edges: domainIntel.edges });
    }
    if (p === '/api/cross-domain') return json(res, domainIntel ? (u.searchParams.get('key') ? blastDomain(domainIntel, u.searchParams.get('key')) : { edges: couplingMatrix(domainIntel) }) : { error: 'domain-intel.json missing' });
    if (p === '/api/payment') return json(res, buildPaymentIntel(dbIntel, domainIntel));
    if (p === '/api/security') return json(res, buildSecurityGraph(dbIntel, infraIntel, domainIntel));
    if (p === '/api/deployment') return json(res, buildDeploymentIntel(infraIntel, domainIntel));
    if (p === '/api/incident') return json(res, traceIncident(domainIntel, dbIntel, infraIntel, u.searchParams.get('domain') || u.searchParams.get('q') || 'payments'));
    if (p === '/api/merchant') return json(res, buildMerchantIntel(domainIntel));
    if (p === '/api/customer-journey') return json(res, customerJourney());
    if (p === '/api/secrets') return json(res, secretIntel());
    // ---- v4: runtime / deployment-state / change-impact / execution / memory / merchant-operating ----
    if (p === '/api/runtime') return json(res, runtimeIntel);
    if (p === '/api/deployment-state') return json(res, deploymentStateData);
    if (p === '/api/change-impact') return json(res, domainIntel ? changeImpact(domainIntel, dbIntel, infraIntel, u.searchParams.get('key') || 'payments') : { error: 'domain-intel.json missing — run pnpm graph:domain' });
    if (p === '/api/execution') return json(res, executionIntel);
    if (p === '/api/merchant-operating') return json(res, buildMerchantOperatingGraph(domainIntel, dbIntel));
    if (p === '/api/incident-response') return json(res, incidentResponse(domainIntel, dbIntel, infraIntel, u.searchParams.get('domain') || u.searchParams.get('q') || 'payments'));
    // ---- v5: live operating intelligence ----
    if (p === '/api/runtime-intelligence') return json(res, runtimeObs);
    if (p === '/api/merchant-intelligence') return json(res, merchantIntelV5);
    if (p === '/api/founding-program') return json(res, (merchantIntelV5 && merchantIntelV5.foundingProgram) || { error: 'merchant-intelligence not built — run pnpm graph:merchant-intel' });
    if (p === '/api/revenue-intelligence') return json(res, revenueIntel);
    if (p === '/api/security-intelligence') return json(res, securityIntelV5);
    if (p === '/api/incident-intelligence') return json(res, incidentIntelligenceV5(u.searchParams.get('domain') || u.searchParams.get('q') || 'payments'));
    if (p === '/api/customer-intelligence') return json(res, journeyIntel);
    if (p === '/api/production-readiness') return json(res, readinessIntel);
    if (p === '/api/decision-engine') return json(res, decisionEngine);
    // ---- Omega: merchant / customer / revenue / cost / telemetry / memory / fix / unified ----
    if (p === '/api/merchant-health') return json(res, merchantHealth);
    if (p === '/api/merchant-growth') return json(res, merchantGrowth);
    if (p === '/api/merchant-adoption') return json(res, merchantAdoption);
    if (p === '/api/merchant-risk') return json(res, merchantRisk);
    if (p === '/api/merchant-churn') return json(res, merchantChurn);
    if (p === '/api/customer-intelligence-v2') return json(res, customerV2);
    if (p === '/api/revenue-v2') return json(res, revenueV2);
    if (p === '/api/cost-intelligence') return json(res, costIntel);
    if (p === '/api/telemetry') return json(res, telemetryIntel);
    if (p === '/api/memory-v2') return json(res, memoryV2);
    if (p === '/api/fix-engine') return json(res, fixEngine);
    if (p === '/api/unified-intelligence') return json(res, unifiedIntel);
    if (p === '/api/discovery-v2') return json(res, discoveryV2);
    // ---- v6: explain (dual-mode operating system) + copilot ----
    if (p === '/api/explain') {
      if (!explainIntel || explainIntel.error) return json(res, explainIntel || { error: 'explain-intel missing' });
      const node = u.searchParams.get('node');
      return json(res, node ? (explainIntel.nodes[node] || { error: `node '${node}' not found` }) : explainIntel);
    }
    if (p === '/api/copilot') return json(res, safe(() => copilot(u.searchParams.get('q') || '')));
    // ---- Mission Control: relationships / environment / knowledge graphs / operations / database control ----
    if (p === '/api/relationships') { const t = u.searchParams.get('table'); return json(res, !relIntel || relIntel.error ? { error: 'relationship-intel missing — run pnpm graph:relationships' } : (t ? relationshipsFor(relIntel, t) : relIntel)); }
    if (p === '/api/environment') return json(res, envIntel);
    if (p === '/api/graph') { if (!knowledgeGraphs || knowledgeGraphs.error) return json(res, { error: 'knowledge-graphs missing' }); const kind = u.searchParams.get('kind'); return json(res, kind ? (knowledgeGraphs.graphs[kind] || { error: `unknown kind '${kind}'`, kinds: knowledgeGraphs.summary.kinds }) : knowledgeGraphs); }
    if (p === '/api/operations') return json(res, opsCenter);
    // ---- V7: connections / health / audit / mission-control / atlas-v2 / ai-context ----
    if (p === '/api/connections') return json(res, connectionsIntel);
    if (p === '/api/production-health') return json(res, productionHealth);
    if (p === '/api/audit') return json(res, auditV2);
    if (p === '/api/mission-control') return json(res, missionDashboard);
    if (p === '/api/atlas-v2') return json(res, atlasV2(u.searchParams.get('node') || 'payments'));
    if (p === '/api/ai-context') return json(res, aiContextPack(u.searchParams.get('pack') || 'project'));
    // ---- V7 master (OS): semantic search / ecosystem layers / multi-AI packs ----
    if (p === '/api/search-v2') return json(res, safe(() => searchV2(u.searchParams.get('q') || '', explainIntel)));
    if (p === '/api/theme-intelligence') return json(res, ecosystemIntel && !ecosystemIntel.error ? ecosystemIntel.layers.themes : { error: 'ecosystem-intel missing' });
    if (p === '/api/apps-intelligence') return json(res, ecosystemIntel && !ecosystemIntel.error ? ecosystemIntel.layers.apps : { error: 'ecosystem-intel missing' });
    if (p === '/api/developer-intelligence') return json(res, ecosystemIntel && !ecosystemIntel.error ? ecosystemIntel.layers.developer : { error: 'ecosystem-intel missing' });
    if (p === '/api/ecosystem') return json(res, ecosystemIntel);
    if (p === '/api/ai-pack') return json(res, aiPack(u.searchParams.get('target') || 'claude'));
    // ---- LCIS Omega: live integrations / environment registry / diagnosis / runbooks ----
    if (p === '/api/live-adapters') return json(res, adapterSummary());
    if (p === '/api/environment-registry') return json(res, envRegistry);
    if (p === '/api/diagnose') return json(res, safe(() => diagnose(u.searchParams.get('target') || 'payments', u.searchParams.get('error') || '')));
    if (p === '/api/runbook') return json(res, u.searchParams.get('domain') ? safe(() => runbookOf(u.searchParams.get('domain'))) : runbooksIntel);
    // ---- LCIS Genesis: control centers + lineage + full trace + launch + AI packs ----
    if (p === '/api/lineage') return json(res, safe(() => lineage(u.searchParams.get('entity') || 'orders')));
    if (p === '/api/database-control-genesis') return json(res, dbControlGenesis);
    if (p === '/api/environment-control') return json(res, envControl);
    if (p === '/api/infrastructure-control') return json(res, infraControl);
    if (p === '/api/commerce-control') return json(res, commerceControl);
    if (p === '/api/incident-control') return json(res, safe(() => incidentControl(u.searchParams.get('target') || 'payments', u.searchParams.get('error') || '')));
    if (p === '/api/launch-command-center') return json(res, launchCenter);
    if (p === '/api/trace') return json(res, safe(() => fullTrace(u.searchParams.get('entity') || 'checkout')));
    if (p === '/api/ai-context-pack') { const t = u.searchParams.get('target'); return json(res, t ? safe(() => buildPack(t)) : safe(() => allPacks())); }
    // ---- V8: domain workspace (search → workspace) + related knowledge ----
    if (p === '/api/workspace') return json(res, safe(() => workspace(u.searchParams.get('domain') || 'orders')));
    if (p === '/api/related') return json(res, safe(() => relatedKnowledge(u.searchParams.get('domain') || 'orders')));
    if (p === '/api/impact-score') return json(res, safe(() => impactScore(u.searchParams.get('domain') || 'payments')));
    // ---- LCIS X: live federation + autonomous operations (Phases 1-20). READ-ONLY. ----
    if (p === '/api/federation') { const prov = u.searchParams.get('provider'); if (!federationIntel || federationIntel.error) return json(res, federationIntel || { error: 'federation-intel missing' }); return json(res, prov ? (federationIntel.providers.find((x) => x.provider.toLowerCase() === prov.toLowerCase()) || { error: `provider '${prov}' not found`, providers: federationIntel.providers.map((x) => x.provider) }) : federationIntel); }
    if (p === '/api/live-graph') return json(res, federationIntel && !federationIntel.error ? federationIntel.unifiedGraph : { error: 'federation-intel missing' });
    if (p === '/api/live-health') { const dom = u.searchParams.get('domain'); if (!liveHealth || liveHealth.error) return json(res, liveHealth || { error: 'live-health-intel missing' }); return json(res, dom ? (liveHealth.domains.find((d) => d.domain === dom) || { error: `domain '${dom}' not found`, domains: liveHealth.domains.map((d) => d.domain) }) : liveHealth); }
    if (p === '/api/investigate') return json(res, safe(() => investigate(u.searchParams.get('q') || u.searchParams.get('question') || 'why is checkout failing')));
    if (p === '/api/root-cause') return json(res, safe(() => rootCause(u.searchParams.get('domain') || u.searchParams.get('target') || 'payments', u.searchParams.get('error') || '')));
    if (p === '/api/time-travel') return json(res, safe(() => timeTravel()));
    if (p === '/api/executive-center') return json(res, safe(() => executiveCenter()));
    if (p === '/api/merchant-ops') return json(res, safe(() => merchantOps()));
    if (p === '/api/customer-ops') return json(res, safe(() => customerOps()));
    if (p === '/api/change-impact-live') return json(res, safe(() => changeImpactLive(u.searchParams.get('domain') || 'payments')));
    if (p === '/api/release-intel') return json(res, safe(() => releaseIntel()));
    if (p === '/api/observability') return json(res, safe(() => observability()));
    if (p === '/api/ops-copilot') return json(res, safe(() => copilotX(u.searchParams.get('q') || u.searchParams.get('question') || '')));
    // ---- LCIS V11: business + operational intelligence. READ-ONLY composition. ----
    if (p === '/api/business-flow') { const jk = u.searchParams.get('journey'); if (!businessFlow || businessFlow.error) return json(res, businessFlow || { error: 'business-flow missing' }); return json(res, jk ? (businessFlow.journeys.find((x) => x.key === jk) || { error: `journey '${jk}' not found`, journeys: businessFlow.journeys.map((x) => x.key) }) : businessFlow); }
    if (p === '/api/business-impact') return json(res, safe(() => businessImpact(u.searchParams.get('domain') || 'payments')));
    if (p === '/api/investor') return json(res, safe(() => investorMode()));
    if (p === '/api/developer') return json(res, safe(() => developerMode()));
    if (p === '/api/founder') return json(res, safe(() => executiveCenter()));
    // ---- LCIS OMEGA: production-OS connective surfaces ----
    if (p === '/api/launch-status') return json(res, safe(() => launchStatus()));
    if (p === '/api/ai-ops') return json(res, safe(() => aiOps()));
    // ---- LCIS INFINITY: autonomous detection + predictive intelligence ----
    if (p === '/api/detection') return json(res, detectPredict && !detectPredict.error ? detectPredict.detection : (detectPredict || { error: 'detection missing' }));
    if (p === '/api/live-metrics') return json(res, detectPredict && !detectPredict.error ? detectPredict.liveMetrics : (detectPredict || { error: 'live-metrics missing' }));
    if (p === '/api/predict') return json(res, detectPredict && !detectPredict.error ? detectPredict.prediction : (detectPredict || { error: 'predict missing' }));
    if (p === '/api/detection-prediction') return json(res, detectPredict);
    if (p === '/api/incident-timeline') return json(res, safe(() => incidentTimeline(u.searchParams.get('domain') || 'payments')));
    if (p === '/api/live') {
      // Real read-only probe — only credentialed providers trigger a network call; the rest are NOT CONNECTED.
      const prov = u.searchParams.get('provider');
      const match = prov ? ADAPTERS.filter((a) => a.provider.toLowerCase() === prov.toLowerCase()) : null;
      const run = match && match.length ? probeAdapter(match[0]) : probeAll();
      run.then((r) => json(res, prov ? { provider: prov, result: r } : { summary: adapterSummary(), probes: r }))
        .catch((e) => json(res, { error: String(e) }, 500));
      return;
    }
    if (p === '/api/database-control') return json(res, dbIntel ? { summary: dbIntel.summary, relationships: relIntel && !relIntel.error ? relIntel.summary : null, topTables: dbIntel.tables.sort((a, b) => (b.policies.length + b.triggers.length + b.indexes) - (a.policies.length + a.triggers.length + a.indexes)).slice(0, 25).map((t) => ({ name: t.name, columns: t.columns, rls: t.rls, force: t.force, tenant: t.tenant, money: t.money, policies: t.policies.length, triggers: t.triggers.length, indexes: t.indexes })), functions: dbIntel.functions.filter((f) => f.securityDefiner).slice(0, 30).map((f) => ({ name: f.name, money: f.money, idempotency: f.hasIdempotency, forUpdate: f.forUpdate, tables: f.touches.length })) } : { error: 'db-intel missing' });
    if (p === '/api/production-readiness-v2') return json(res, readinessV2);
    if (p === '/api/decision-v2') return json(res, decisionV2);
    if (p === '/api/memory') {
      if (!memoryIntel || memoryIntel.error) return json(res, memoryIntel || { error: 'memory-intel missing' });
      const q = u.searchParams.get('q') || '', mig = u.searchParams.get('migration'), mode = u.searchParams.get('mode');
      if (mig) return json(res, migrationWhy(memoryIntel, mig));
      if (mode === 'rule') return json(res, ruleWhy(memoryIntel, q));
      if (mode === 'affecting') return json(res, decisionsAffecting(memoryIntel, q));
      return json(res, q ? whyBuilt(memoryIntel, q) : { summary: memoryIntel.summary, decisions: memoryIntel.decisions.slice(0, 40), migrations: memoryIntel.migrations.slice(-12), sources: memoryIntel.sources });
    }
    if (p === '/api/blast') { const id = u.searchParams.get('id'); const q = u.searchParams.get('q'); let nid = id; if (!nid && q) { const r = search(q, 1); nid = r[0] && r[0].id; } return json(res, nid ? blastRadius(nid, Number(u.searchParams.get('depth') || 3)) : { error: 'not found' }); }
    if (p === '/api/health') return json(res, { ok: true, nodes: nodes.length, dbIntel: !!dbIntel });
    // V10 — SPA fallback: deep links like /domain/orders/impact, /page/launch serve the app shell
    // so a refresh / shared URL restores state client-side. Only /api/* paths 404 as JSON.
    if (!p.startsWith('/api/')) { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); return res.end(indexHtml); }
    res.writeHead(404, { 'content-type': 'application/json' }); res.end('{"error":"not found"}');
  } catch (err) { json(res, { error: String(err) }, 500); }
});

server.listen(PORT, () => {
  console.log(`\n  LetBuyy Graph Intelligence Platform`);
  console.log(`  ${stats.nodes.toLocaleString()} nodes · ${stats.edges.toLocaleString()} edges · ${stats.communities.toLocaleString()} communities`);
  console.log(`  graph built ${stats.freshness_minutes} min ago${stats.built_at_commit ? ' @ ' + stats.built_at_commit.slice(0, 8) : ''}`);
  console.log(`\n  ▶  http://localhost:${PORT}\n`);
});
