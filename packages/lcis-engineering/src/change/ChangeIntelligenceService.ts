/**
 * ChangeIntelligenceService — EINS Phase 7.
 *
 * For each entity in `eis.analyze(req).affected`, emits one or more EngineeringFinding
 * records that name the exact construction gate (E001..E008) the entity triggers.
 * COMPOSES lcis-execution (eis.analyze) — never reimplements it.
 * Read-only. Deterministic. No IO. No network. No AI.
 */
import type { EisEngine } from '@letbuyy/lcis-execution';
import { createEisEngine } from '@letbuyy/lcis-execution';
import { getEngine, type LcisEngine } from '@letbuyy/lcis-core';
import {
  defaultNow,
  EngineeringEvidenceBuilder,
  EngineeringFindingBuilder,
  EngineeringRuleRegistry,
  EngineeringSeverityScorer,
  type EngineeringFinding,
  type EngineeringLayer,
  type FeatureRequest,
} from '../shared/index';

const ev = new EngineeringEvidenceBuilder();
const fb = new EngineeringFindingBuilder();
const ss = new EngineeringSeverityScorer();
const reg = new EngineeringRuleRegistry();

/** Thin read-only view of db-intel entries we need. */
interface DbTable {
  name: string;
  money?: boolean;
  tenant?: boolean;
  rls?: boolean;
}
interface DbFunction {
  name: string;
  money?: boolean;
  securityDefiner?: boolean;
}
interface DbIntel {
  tables?: DbTable[];
  functions?: DbFunction[];
}

export class ChangeIntelligenceService {
  private readonly eis: EisEngine;

  constructor(
    private readonly core: LcisEngine = getEngine(),
    private readonly now: () => string = defaultNow,
  ) {
    this.eis = createEisEngine({ core, now });
  }

  /**
   * Analyse a feature request and return one EngineeringFinding per triggered gate.
   * Each finding cites reuse-evidence (eis.analyze) + entity-specific evidence + the rule.
   * Returns [] when unresolved — no fabrication.
   */
  analyzeChange(req: FeatureRequest): EngineeringFinding[] {
    const analysis = this.eis.analyze(req);

    // Honestly empty when nothing resolved.
    if (analysis.unresolved) return [];

    const { affected, risk } = analysis;
    const db = this.core.store.tryRead<DbIntel>('db-intel') ?? {};
    const dbTables: DbTable[] = db.tables ?? [];
    const dbFunctions: DbFunction[] = db.functions ?? [];

    const findings: EngineeringFinding[] = [];

    // ── E001: money table or money RPC → canonical SECURITY DEFINER RPC required ──
    for (const table of affected.tables) {
      const row = dbTables.find((t) => t.name === table);
      if (row?.money) {
        const rule = reg.get('E001')!;
        findings.push(
          fb.build({
            category: 'gate',
            kind: 'money-rpc-required',
            severity: ss.forFeature({ money: true }),
            subject: table,
            title: `${rule.title} — ${table}`,
            detail: `Table "${table}" is marked money in db-intel. Any mutation must route through a canonical SECURITY DEFINER RPC (idempotency + FOR UPDATE). E001 / ${rule.mapsTo}.`,
            rule: rule.id,
            evidence: [
              ev.reuse('lcis-execution', 'eis.analyze', `money table in affected.tables: ${table}`),
              ev.table(table, 'money:true in db-intel'),
            ],
          }),
        );
      }
    }

    for (const rpc of affected.rpcs) {
      const fn = dbFunctions.find((f) => f.name === rpc);
      if (fn?.money && !fn.securityDefiner) {
        const rule = reg.get('E001')!;
        findings.push(
          fb.build({
            category: 'gap',
            kind: 'money-rpc-not-security-definer',
            severity: ss.forFeature({ money: true }),
            subject: rpc,
            title: `${rule.title} — ${rpc} (missing SECURITY DEFINER)`,
            detail: `RPC "${rpc}" handles money but is not SECURITY DEFINER. Wrap in a canonical ledger function. E001 / ${rule.mapsTo}.`,
            rule: rule.id,
            evidence: [
              ev.reuse('lcis-execution', 'eis.analyze', `money rpc in affected.rpcs: ${rpc}`),
              ev.rpc(rpc, 'money:true, securityDefiner:false in db-intel'),
            ],
          }),
        );
      }
    }

    // ── E002: tenant table → RLS + site_id scoping required ────────────────────
    for (const table of affected.tables) {
      const row = dbTables.find((t) => t.name === table);
      if (row?.tenant) {
        const rule = reg.get('E002')!;
        findings.push(
          fb.build({
            category: 'gate',
            kind: 'tenant-rls-required',
            severity: ss.forFeature({ tenant: true }),
            subject: table,
            title: `${rule.title} — ${table}`,
            detail: `Table "${table}" is tenant-scoped. It must enable RLS, carry site_id, and gateway access must go behind verifySiteOwnership. E002 / ${rule.mapsTo}.`,
            rule: rule.id,
            evidence: [
              ev.reuse('lcis-execution', 'eis.analyze', `tenant table in affected.tables: ${table}`),
              ev.table(table, 'tenant:true in db-intel'),
            ],
          }),
        );
      }
    }

    // ── E003: affected API route → must be a gateway proxy ──────────────────────
    for (const api of affected.apis) {
      const rule = reg.get('E003')!;
      findings.push(
        fb.build({
          category: 'gate',
          kind: 'gateway-proxy-required',
          severity: rule.severity,
          subject: api,
          title: `${rule.title} — ${api}`,
          detail: `Route "${api}" is in the blast radius. The app /api/* must proxy api-gateway /v1 and must never write the DB locally. E003.`,
          rule: rule.id,
          evidence: [
            ev.reuse('lcis-execution', 'eis.analyze', `api in affected.apis: ${api}`),
            ev.field(`route:${api}`, 'gateway proxy gate', 'graphify-out/domain-intel.json'),
          ],
        }),
      );
    }

    // ── E004: affected domain → must declare an owner ─────────────────────────
    for (const domain of affected.domains) {
      const rule = reg.get('E004')!;
      findings.push(
        fb.build({
          category: 'gap',
          kind: 'domain-owner-required',
          severity: rule.severity,
          subject: domain,
          title: `${rule.title} — ${domain}`,
          detail: `Domain "${domain}" is in the blast radius. Confirm/declare CODEOWNERS / domain owner before merge. E004 / ${rule.mapsTo}.`,
          rule: rule.id,
          evidence: [
            ev.reuse('lcis-execution', 'eis.analyze', `domain in affected.domains: ${domain}`),
            ev.domain(domain, 'domain in blast radius'),
          ],
        }),
      );
    }

    // ── E005: affected API/RPC → must have tests ────────────────────────────────
    for (const api of affected.apis) {
      const rule = reg.get('E005')!;
      findings.push(
        fb.build({
          category: 'gap',
          kind: 'route-test-required',
          severity: rule.severity,
          subject: api,
          title: `${rule.title} — ${api}`,
          detail: `Route "${api}" must have at least one test covering the happy path and error cases. E005 / ${rule.mapsTo}.`,
          rule: rule.id,
          evidence: [
            ev.reuse('lcis-execution', 'eis.analyze', `api in affected.apis: ${api}`),
            ev.field(`route:${api}`, 'test coverage gate', 'graphify-out/domain-intel.json'),
          ],
        }),
      );
    }

    for (const rpc of affected.rpcs) {
      const rule = reg.get('E005')!;
      findings.push(
        fb.build({
          category: 'gap',
          kind: 'rpc-test-required',
          severity: rule.severity,
          subject: rpc,
          title: `${rule.title} — ${rpc}`,
          detail: `RPC "${rpc}" must have at least one integration test. E005 / ${rule.mapsTo}.`,
          rule: rule.id,
          evidence: [
            ev.reuse('lcis-execution', 'eis.analyze', `rpc in affected.rpcs: ${rpc}`),
            ev.rpc(rpc, 'test coverage gate'),
          ],
        }),
      );
    }

    // ── E006: affected migration surface → rollback path required ───────────────
    // We treat any affected table that has a tenant or money flag as a migration surface
    // (schema changes there need explicit rollback). Also fire for all explicitly named tables.
    const migrationSurface = affected.tables.filter((t) => {
      const row = dbTables.find((r) => r.name === t);
      return row?.money || row?.tenant || true; // all affected tables carry migration risk
    });
    // Deduplicate to one finding per unique table (already deduplicated by eis.analyze).
    const migrationSurfaceSet = new Set(migrationSurface);
    if (migrationSurfaceSet.size > 0) {
      const rule = reg.get('E006')!;
      const subjects = [...migrationSurfaceSet];
      findings.push(
        fb.build({
          category: 'gate',
          kind: 'migration-rollback-required',
          severity: rule.severity,
          subject: subjects.join(','),
          title: `${rule.title} — ${subjects.length} table(s)`,
          detail: `Schema changes to [${subjects.join(', ')}] must include a down-migration or documented rollback path. E006 / ${rule.mapsTo}.`,
          rule: rule.id,
          evidence: [
            ev.reuse('lcis-execution', 'eis.analyze', `${subjects.length} table(s) in affected.tables`),
            ...subjects.slice(0, 5).map((t) => ev.table(t, 'migration rollback gate')),
          ],
        }),
      );
    }

    // ── E007: affected domain → documentation required ─────────────────────────
    for (const domain of affected.domains) {
      const rule = reg.get('E007')!;
      findings.push(
        fb.build({
          category: 'gap',
          kind: 'domain-docs-required',
          severity: rule.severity,
          subject: domain,
          title: `${rule.title} — ${domain}`,
          detail: `Domain "${domain}" must have governance/architecture documentation updated or created. E007 / ${rule.mapsTo}.`,
          rule: rule.id,
          evidence: [
            ev.reuse('lcis-execution', 'eis.analyze', `domain in affected.domains: ${domain}`),
            ev.domain(domain, 'documentation gate'),
          ],
        }),
      );
    }

    // ── E008: affected worker/queue → runbook required ─────────────────────────
    for (const worker of affected.workers) {
      const rule = reg.get('E008')!;
      findings.push(
        fb.build({
          category: 'gap',
          kind: 'worker-runbook-required',
          severity: rule.severity,
          subject: worker,
          title: `${rule.title} — ${worker}`,
          detail: `Worker "${worker}" is in the blast radius. It must have an operational runbook covering detection/diagnosis/recovery/rollback. E008 / ${rule.mapsTo}.`,
          rule: rule.id,
          evidence: [
            ev.reuse('lcis-execution', 'eis.analyze', `worker in affected.workers: ${worker}`),
            ev.field(`worker:${worker}`, 'runbook gate', 'graphify-out/domain-intel.json'),
          ],
        }),
      );
    }

    for (const queue of affected.queues) {
      const rule = reg.get('E008')!;
      findings.push(
        fb.build({
          category: 'gap',
          kind: 'queue-runbook-required',
          severity: rule.severity,
          subject: queue,
          title: `${rule.title} — ${queue}`,
          detail: `Queue "${queue}" is in the blast radius. Operational runbook (dead-letter handling, retry policy, scaling) is required. E008 / ${rule.mapsTo}.`,
          rule: rule.id,
          evidence: [
            ev.reuse('lcis-execution', 'eis.analyze', `queue in affected.queues: ${queue}`),
            ev.field(`queue:${queue}`, 'runbook gate', 'graphify-out/domain-intel.json'),
          ],
        }),
      );
    }

    return findings;
  }

  /**
   * Group findings from analyzeChange by the EngineeringLayer they belong to.
   * Determined by the rule's declared layer.
   */
  changeByLayer(req: FeatureRequest): Readonly<Record<EngineeringLayer, EngineeringFinding[]>> {
    const findings = this.analyzeChange(req);
    const grouped: Record<string, EngineeringFinding[]> = {};

    for (const f of findings) {
      if (!f.rule) continue;
      const rule = reg.get(f.rule);
      if (!rule) continue;
      const layer = rule.layer as string;
      if (!grouped[layer]) grouped[layer] = [];
      grouped[layer].push(f);
    }

    return grouped as Readonly<Record<EngineeringLayer, EngineeringFinding[]>>;
  }
}
