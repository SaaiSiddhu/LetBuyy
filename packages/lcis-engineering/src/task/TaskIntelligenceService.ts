/**
 * TaskIntelligenceService — EINS Phase 7: ordered engineering task generation.
 *
 * Given a FeatureRequest, COMPOSES lcis-execution (eis.analyze + eis.migration) to
 * discover the affected structural surface, then emits an ordered list of EngineeringTask
 * records that mirror the REAL LetBuyy build order:
 *
 *   migration → rpc → gateway → proxy → ui → worker/queue → test → docs → verification
 *
 * One task per affected entity (table/rpc/route/worker/queue) + one test task + one docs
 * task + one verification task per domain. Dependency edges are set so the graph is acyclic
 * and respects the build order. Priority increases with layer depth.
 *
 * READ-ONLY. Deterministic. No IO. No network. No AI. No placeholders.
 * Every output is evidence-cited via ev.reuse('lcis-execution', ...).
 */
import type { EisEngine } from '@letbuyy/lcis-execution';
import { createEisEngine } from '@letbuyy/lcis-execution';
import { type LcisEngine, getEngine } from '@letbuyy/lcis-core';
import {
  defaultNow,
  EngineeringEvidenceBuilder,
  type EngineeringTask,
  type EngineeringLayer,
  type AgentType,
  type FeatureRequest,
} from '../shared/index';

// ── Layer order: lower number → earlier in the build ────────────────────────

const LAYER_PRIORITY: Record<EngineeringLayer, number> = {
  migration:    10,
  rpc:          20,
  gateway:      30,
  proxy:        40,
  ui:           50,
  worker:       60,
  queue:        65,
  event:        70,
  test:         80,
  docs:         90,
  verification: 100,
  launch:       110,
};

const LAYER_AGENT: Record<EngineeringLayer, AgentType> = {
  migration:    'database',
  rpc:          'database',
  gateway:      'backend',
  proxy:        'backend',
  ui:           'frontend',
  worker:       'backend',
  queue:        'backend',
  event:        'backend',
  test:         'testing',
  docs:         'documentation',
  verification: 'verification',
  launch:       'devops',
};

/** Per-layer validation gate (the authoritative validator name). */
const LAYER_GATE: Record<EngineeringLayer, string> = {
  migration:    'rollback-integrity-validator',
  rpc:          'canonical-ledger-only-validator',
  gateway:      'route-ownership lockstep',
  proxy:        'route-ownership lockstep',
  ui:           'design-system ratchet',
  worker:       'worker-runbook-gate',
  queue:        'worker-runbook-gate',
  event:        'worker-runbook-gate',
  test:         '107+ validator gate',
  docs:         'governance-memory-validator',
  verification: '107+ validator gate',
  launch:       'production-readiness-v2',
};

// ── Stable id helpers ────────────────────────────────────────────────────────

function taskId(layer: EngineeringLayer, entity: string): string {
  const slug = entity.replace(/[^a-z0-9]+/gi, '-').toLowerCase();
  return `TASK-${layer.toUpperCase()}-${slug}`;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class TaskIntelligenceService {
  private readonly eis: EisEngine;
  private readonly ev: EngineeringEvidenceBuilder;

  constructor(
    private readonly core: LcisEngine = getEngine(),
    private readonly now: () => string = defaultNow,
  ) {
    this.eis = createEisEngine({ core, now });
    this.ev = new EngineeringEvidenceBuilder();
  }

  /**
   * Generate ORDERED EngineeringTasks for the request.
   * Calls eis.analyze (+ eis.migration) once; emits one task per affected entity.
   * Returns [] when the request is unresolved — no fabrication.
   */
  generateTasks(req: FeatureRequest): EngineeringTask[] {
    const analysis = this.eis.analyze(req);

    // Honest: unresolved → empty (nothing to fabricate)
    if (analysis.unresolved) return [];

    const migration = this.eis.migration.analyzeMigration(analysis);
    const { affected, risk } = analysis;
    const isMoney = risk.money;
    const domains = affected.domains;

    const tasks: EngineeringTask[] = [];

    // ── 1: migration — one task per affected table (ordered by dependency order) ──
    const tableOrder = migration.steps.length > 0
      ? this.eis.migration.detectDependencyOrder(analysis)
      : affected.tables.slice();

    // de-duplicate while preserving order
    const seenTables = new Set<string>();
    const orderedTables: string[] = [];
    for (const t of [...tableOrder, ...affected.tables]) {
      if (!seenTables.has(t)) {
        seenTables.add(t);
        orderedTables.push(t);
      }
    }

    const migTaskIds: string[] = [];
    for (const table of orderedTables) {
      const id = taskId('migration', table);
      migTaskIds.push(id);
      tasks.push({
        id,
        title: `Migration: create/alter table "${table}"`,
        layer: 'migration',
        domain: domains[0] ?? null,
        dependsOn: [],
        priority: LAYER_PRIORITY.migration,
        gate: LAYER_GATE.migration,
        agentType: LAYER_AGENT.migration,
        evidence: [
          this.ev.reuse('lcis-execution', 'eis.analyze', `table in affected.tables: ${table}`),
          this.ev.table(table, 'migration task — schema layer'),
        ],
      });
    }

    // ── 2: rpc — one task per affected rpc; depends on all migration tasks ───────
    const rpcTaskIds: string[] = [];
    for (const rpc of affected.rpcs) {
      const id = taskId('rpc', rpc);
      rpcTaskIds.push(id);
      const gate = isMoney ? 'canonical-ledger-only-validator' : LAYER_GATE.rpc;
      tasks.push({
        id,
        title: `RPC: implement "${rpc}"${isMoney ? ' (SECURITY DEFINER — canonical ledger)' : ''}`,
        layer: 'rpc',
        domain: domains[0] ?? null,
        dependsOn: [...migTaskIds],
        priority: LAYER_PRIORITY.rpc,
        gate,
        agentType: LAYER_AGENT.rpc,
        evidence: [
          this.ev.reuse('lcis-execution', 'eis.analyze', `rpc in affected.rpcs: ${rpc}`),
          this.ev.rpc(rpc, isMoney ? 'money rpc — SECURITY DEFINER required' : 'rpc task — backend layer'),
        ],
      });
    }

    // ── 3: gateway — one task per affected API route; depends on rpc tasks ───────
    const gatewayTaskIds: string[] = [];
    for (const api of affected.apis) {
      const id = taskId('gateway', api);
      gatewayTaskIds.push(id);
      tasks.push({
        id,
        title: `Gateway route: ${api} (Hono /v1 proxy → db.rpc behind verifySiteOwnership)`,
        layer: 'gateway',
        domain: domains[0] ?? null,
        dependsOn: [...rpcTaskIds.length > 0 ? rpcTaskIds : migTaskIds],
        priority: LAYER_PRIORITY.gateway,
        gate: LAYER_GATE.gateway,
        agentType: LAYER_AGENT.gateway,
        evidence: [
          this.ev.reuse('lcis-execution', 'eis.analyze', `api in affected.apis: ${api}`),
          this.ev.field(`route:${api}`, 'gateway proxy task — never writes DB locally', 'graphify-out/domain-intel.json'),
        ],
      });
    }

    // ── 4: proxy — one task per domain (one proxy per app per gateway route) ─────
    const proxyTaskIds: string[] = [];
    for (const domain of domains) {
      const id = taskId('proxy', domain);
      proxyTaskIds.push(id);
      tasks.push({
        id,
        title: `App proxy: /api/* → gateway /v1 for domain "${domain}"`,
        layer: 'proxy',
        domain,
        dependsOn: [...gatewayTaskIds.length > 0 ? gatewayTaskIds : (rpcTaskIds.length > 0 ? rpcTaskIds : migTaskIds)],
        priority: LAYER_PRIORITY.proxy,
        gate: LAYER_GATE.proxy,
        agentType: LAYER_AGENT.proxy,
        evidence: [
          this.ev.reuse('lcis-execution', 'eis.analyze', `domain in affected.domains: ${domain}`),
          this.ev.domain(domain, 'proxy task — app-level same-origin route'),
        ],
      });
    }

    // ── 5: ui — one task per domain (merchant-web screen) ──────────────
    const uiTaskIds: string[] = [];
    for (const domain of domains) {
      const id = taskId('ui', domain);
      uiTaskIds.push(id);
      tasks.push({
        id,
        title: `UI: merchant-web screen for domain "${domain}" (@letbuyy/ui + --lb-* tokens)`,
        layer: 'ui',
        domain,
        dependsOn: [taskId('proxy', domain)],
        priority: LAYER_PRIORITY.ui,
        gate: LAYER_GATE.ui,
        agentType: LAYER_AGENT.ui,
        evidence: [
          this.ev.reuse('lcis-execution', 'eis.analyze', `domain in affected.domains: ${domain}`),
          this.ev.domain(domain, 'ui task — merchant-web layer'),
        ],
      });
    }

    // ── 6a: worker — one task per affected worker; depends on migration tasks ────
    const workerTaskIds: string[] = [];
    for (const worker of affected.workers) {
      const id = taskId('worker', worker);
      workerTaskIds.push(id);
      tasks.push({
        id,
        title: `Worker: deploy/update "${worker}" with schema awareness`,
        layer: 'worker',
        domain: domains[0] ?? null,
        dependsOn: [...migTaskIds],
        priority: LAYER_PRIORITY.worker,
        gate: LAYER_GATE.worker,
        agentType: LAYER_AGENT.worker,
        evidence: [
          this.ev.reuse('lcis-execution', 'eis.analyze', `worker in affected.workers: ${worker}`),
          this.ev.field(`worker:${worker}`, 'worker task — async layer', 'graphify-out/domain-intel.json'),
        ],
      });
    }

    // ── 6b: queue — one task per affected queue ───────────────────────────────────
    const queueTaskIds: string[] = [];
    for (const queue of affected.queues) {
      const id = taskId('queue', queue);
      queueTaskIds.push(id);
      tasks.push({
        id,
        title: `Queue: drain and verify "${queue}" during schema cutover`,
        layer: 'queue',
        domain: domains[0] ?? null,
        dependsOn: [...migTaskIds],
        priority: LAYER_PRIORITY.queue,
        gate: LAYER_GATE.queue,
        agentType: LAYER_AGENT.queue,
        evidence: [
          this.ev.reuse('lcis-execution', 'eis.analyze', `queue in affected.queues: ${queue}`),
          this.ev.field(`queue:${queue}`, 'queue task — async layer', 'graphify-out/domain-intel.json'),
        ],
      });
    }

    // ── 7: test — one task per domain; depends on gateway + ui ───────────────────
    const testTaskIds: string[] = [];
    const testDependsOn = [
      ...gatewayTaskIds,
      ...uiTaskIds,
    ];
    // Always emit at least one test task (per domain)
    for (const domain of domains) {
      const id = taskId('test', domain);
      testTaskIds.push(id);
      tasks.push({
        id,
        title: `Tests: unit + integration + acceptance for domain "${domain}" (107+ validator gate)`,
        layer: 'test',
        domain,
        dependsOn: testDependsOn.length > 0 ? testDependsOn : migTaskIds,
        priority: LAYER_PRIORITY.test,
        gate: LAYER_GATE.test,
        agentType: LAYER_AGENT.test,
        evidence: [
          this.ev.reuse('lcis-execution', 'eis.analyze', `domain in affected.domains: ${domain}`),
          this.ev.domain(domain, 'test task — coverage gate'),
        ],
      });
    }

    // ── 8: docs — one task per domain; depends on implementation tasks ────────────
    const docsTaskIds: string[] = [];
    const implTaskIds = [
      ...migTaskIds, ...rpcTaskIds, ...gatewayTaskIds, ...proxyTaskIds,
      ...uiTaskIds, ...workerTaskIds, ...queueTaskIds,
    ];
    for (const domain of domains) {
      const id = taskId('docs', domain);
      docsTaskIds.push(id);
      tasks.push({
        id,
        title: `Docs: update governance/architecture documentation for domain "${domain}"`,
        layer: 'docs',
        domain,
        dependsOn: implTaskIds.length > 0 ? implTaskIds : migTaskIds,
        priority: LAYER_PRIORITY.docs,
        gate: LAYER_GATE.docs,
        agentType: LAYER_AGENT.docs,
        evidence: [
          this.ev.reuse('lcis-execution', 'eis.analyze', `domain in affected.domains: ${domain}`),
          this.ev.domain(domain, 'docs task — governance-memory gate'),
        ],
      });
    }

    // ── 9: verification — one task per domain; depends on everything ─────────────
    const allPriorIds = [
      ...migTaskIds, ...rpcTaskIds, ...gatewayTaskIds, ...proxyTaskIds,
      ...uiTaskIds, ...workerTaskIds, ...queueTaskIds, ...testTaskIds, ...docsTaskIds,
    ];
    for (const domain of domains) {
      const id = taskId('verification', domain);
      tasks.push({
        id,
        title: `Verification: typecheck + 107-validator gate + production-readiness for domain "${domain}"`,
        layer: 'verification',
        domain,
        dependsOn: allPriorIds.length > 0 ? allPriorIds : migTaskIds,
        priority: LAYER_PRIORITY.verification,
        gate: LAYER_GATE.verification,
        agentType: LAYER_AGENT.verification,
        evidence: [
          this.ev.reuse('lcis-execution', 'eis.analyze', `domain in affected.domains: ${domain}`),
          this.ev.reuse('lcis-execution', 'eis.migration.analyzeMigration', `migration readiness for: ${domain}`),
          this.ev.domain(domain, 'verification task — final gate'),
        ],
      });
    }

    // ── Stable sort: primary = priority (layer order), secondary = id (alpha) ───
    return tasks.slice().sort((a, b) =>
      a.priority !== b.priority ? a.priority - b.priority : a.id.localeCompare(b.id),
    );
  }
}
