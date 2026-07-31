/**
 * ChangeAnalyzer — the ChangePlanner (Deliverable 2). Given a request, it resolves
 * seeds, then COMPOSES lcis-core's blast radius (impact / relationships / blast) +
 * BM25 memory into the aggregated structural footprint of the change. It reasons by
 * delegation: every affected set comes from an existing lcis-core query, evidence-cited.
 *
 * It is the single source feeding every downstream plan (execution / migration / test /
 * rollback / launch / verification). It computes; it never changes anything.
 */
import { type Evidence, type LcisEngine, evidence } from '@letbuyy/lcis-core';
import { defaultNow, plan } from './envelope';
import { assessComplexity, assessRisk } from './scoring';
import { SeedResolver } from './seed-resolver';
import type { AffectedSets, ChangeAnalysis, ChangeRequest, PlanArtifact, ResolvedSeed } from './types';

// Minimal local views of the blast results we consume (the full types live in lcis-core).
interface ImpactBreaks {
  domains: { count: number; list: string[]; layers: number[] };
  routes: string[];
  rpcs: string[];
  tables: string[];
  workers: string[];
  queues: string[];
  owners: string[];
}
interface ImpactResult {
  domain: string;
  label: string;
  breaks: ImpactBreaks;
  risk: { money: boolean; tenant: boolean };
}
interface RelationshipResult {
  table: string;
  references: string[];
  referencedBy: string[];
  fanIn: number;
  fanOut: number;
}
interface BlastResult {
  impactedNodes: number;
  impactedFiles: number;
  topImpacted: { file: string }[];
}
interface DbTable {
  name: string;
  money?: boolean;
  tenant?: boolean;
}
interface DbIntel {
  tables: DbTable[];
}

const isErr = (x: unknown): x is { error: string } =>
  typeof x === 'object' && x !== null && 'error' in x;

const TEST_RE = /\.(test|spec)\.[tj]sx?$|\/tests?\//i;

/** Top service (app/service root) for a source file path, for affected-services rollup. */
function topService(file: string): string | null {
  const m = file.match(/^(?:apps|services|packages)\/[^/]+/);
  return m ? m[0] : null;
}

function dedupeSeq(seq: string[]): string[] {
  return [...new Set(seq)];
}

export class ChangeAnalyzer {
  private readonly resolver: SeedResolver;

  constructor(
    private readonly engine: LcisEngine,
    private readonly now: () => string = defaultNow,
  ) {
    this.resolver = new SeedResolver(engine);
  }

  analyze(request: ChangeRequest): ChangeAnalysis {
    const seeds = this.resolver.resolve(request);
    const ev: Evidence[] = [];
    const domains = new Set<string>();
    const services = new Set<string>();
    const apis = new Set<string>();
    const rpcs = new Set<string>();
    const tables = new Set<string>();
    const workers = new Set<string>();
    const queues = new Set<string>();
    const events = new Set<string>();
    const tests = new Set<string>();
    const docs = new Set<string>();
    let money = false;
    let tenant = false;
    let maxLayers = 0;
    const sequence: string[] = [];

    for (const seed of seeds) {
      ev.push(...seed.evidence);
      if (seed.kind === 'domain') {
        const imp = this.engine.blast.impact(seed.ref) as ImpactResult | { error: string };
        if (!isErr(imp)) {
          domains.add(seed.ref);
          for (const d of imp.breaks.domains.list) domains.add(d);
          for (const r of imp.breaks.routes) apis.add(r);
          for (const r of imp.breaks.rpcs) rpcs.add(r);
          for (const t of imp.breaks.tables) tables.add(t);
          for (const w of imp.breaks.workers) {
            workers.add(w);
            services.add(w);
          }
          for (const q of imp.breaks.queues) {
            queues.add(q);
            events.add(q); // queue-backed async event channel
          }
          money = money || imp.risk.money;
          tenant = tenant || imp.risk.tenant;
          maxLayers = Math.max(maxLayers, imp.breaks.domains.layers.length);
          sequence.push(...imp.breaks.domains.list);
          ev.push(
            evidence(
              'artifact-field',
              `impact:${seed.ref}`,
              `${imp.breaks.domains.count} domain(s), ${imp.breaks.tables.length} table(s), ${imp.breaks.rpcs.length} rpc(s)`,
              'graphify-out/domain-intel.json',
            ),
          );
        }
      } else if (seed.kind === 'table') {
        tables.add(seed.ref);
        const rel = this.engine.blast.relationships(seed.ref) as RelationshipResult | { error: string };
        if (!isErr(rel)) {
          for (const t of rel.referencedBy) tables.add(t);
          ev.push(
            evidence('table', seed.ref, `FK fan-in ${rel.fanIn} / fan-out ${rel.fanOut}`, 'graphify-out/relationship-intel.json'),
          );
        }
      } else if (seed.kind === 'symbol') {
        const b = this.engine.blast.blast(seed.ref) as BlastResult | null;
        if (b) {
          for (const n of b.topImpacted) {
            const svc = topService(n.file);
            if (svc) services.add(svc);
          }
          ev.push(
            evidence('graph-node', seed.ref, `${b.impactedNodes} node(s) / ${b.impactedFiles} file(s) impacted`, 'graphify-out/graph.json'),
          );
        }
      } else {
        // file seed — the service that owns it is affected
        const svc = topService(seed.ref);
        if (svc) services.add(svc);
      }
    }

    // money/tenant flags for table seeds (blast.relationships doesn't carry them).
    const db = this.engine.store.tryRead<DbIntel>('db-intel');
    if (db) {
      for (const t of tables) {
        const row = db.tables.find((x) => x.name === t);
        if (row?.money) money = true;
        if (row?.tenant) tenant = true;
      }
    }

    // Affected tests (bounded graph search over affected domain/table terms).
    for (const f of this.discoverTests([...domains].slice(0, 4), [...tables].slice(0, 6))) tests.add(f);
    if (tests.size > 0) ev.push(evidence('file', `${tests.size} test file(s)`, 'tests referencing affected domains/tables', 'graphify-out/graph.json'));

    // Affected docs (BM25 governance/architecture/runbook corpus).
    for (const d of this.discoverDocs(request)) docs.add(d.source);
    for (const d of this.discoverDocs(request)) ev.push(evidence('doc', d.id, d.section, d.source));

    const affected: AffectedSets = {
      domains: [...domains],
      services: [...services],
      apis: [...apis],
      rpcs: [...rpcs],
      tables: [...tables],
      workers: [...workers],
      queues: [...queues],
      events: [...events],
      tests: [...tests],
      docs: [...docs],
    };
    const complexity = assessComplexity(affected, maxLayers);
    const risk = assessRisk(affected, money, tenant, complexity.score);
    const unresolved = seeds.length === 0;
    if (unresolved) {
      ev.push(
        evidence(
          'artifact-field',
          'unresolved',
          `no domain/table/symbol matched "${request.text}" — analysis is honestly empty, not fabricated`,
          'graphify-out/domain-intel.json',
        ),
      );
    }

    const body: Omit<ChangeAnalysis, keyof PlanArtifact> = {
      request,
      seeds,
      affected,
      complexity,
      risk,
      suggestedSequence: dedupeSeq(sequence),
      dependencies: [...domains].filter((d) => !seeds.some((s) => s.kind === 'domain' && s.ref === d)),
      rollbackStrategy: money
        ? 'ledger-safe reversal via canonical refund/restore RPCs (complete_order_refund / restore_gift_card_on_refund); gift-card balance is a ledger projection'
        : 'standard revert + migration-down where reversible; redeploy prior worker version',
      verificationStrategy: `typecheck + affected tests (${tests.size}) + blast re-check on ${money ? 'money RPCs' : 'changed symbols'}; production-readiness verify before merge`,
      launchImpact: tenant
        ? 'tenant-facing — affects all merchants on the shared schema; gate behind launch readiness'
        : 'platform-internal — no tenant table in the blast radius',
      unresolved,
    };
    return plan(body, { evidence: ev, now: this.now });
  }

  /** Real test files whose graph node references an affected domain/table term. Bounded + honest. */
  private discoverTests(domainKeys: string[], tableNames: string[]): string[] {
    const out = new Set<string>();
    for (const term of [...domainKeys, ...tableNames]) {
      for (const n of this.engine.graph.search(term, 40)) {
        const f = n.sourceFile;
        if (f && TEST_RE.test(f)) out.add(f);
        if (out.size >= 30) return [...out];
      }
    }
    return [...out];
  }

  /** Governance/architecture/runbook docs grounding the request (BM25). */
  private discoverDocs(request: ChangeRequest): { id: string; section: string; source: string }[] {
    return this.engine.memory
      .search(request.text, { limit: 6 })
      .map((h) => ({ id: h.id, section: h.section, source: h.source }));
  }
}

/** Resolve a service input that may already be a computed analysis (facade reuse) or a raw request. */
export function toAnalysis(analyzer: ChangeAnalyzer, input: ChangeRequest | ChangeAnalysis): ChangeAnalysis {
  if ('affected' in input && 'seeds' in input) return input;
  return analyzer.analyze(input);
}
