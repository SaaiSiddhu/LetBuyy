/**
 * TwinBuilderService — composes the TwinGraph from the three structural artifacts
 * (domain-intel, db-intel, infra-intel).  Pure, deterministic, read-only.
 *
 * Honesty rules (strictly enforced):
 *   - Edges come ONLY from real artifact fields; no relation is invented.
 *   - Absent artifacts -> missingSources entry + notConnected evidence; never a throw.
 *   - Unreadable / malformed artifact fields -> loose-zod fallback; affected entries skipped.
 *   - No Date.now() or argless new Date() — clock injected via constructor `now` param.
 *   - No fetch / exec / fs access; the ArtifactStore is the single IO boundary.
 */
import { type Evidence, type LcisEngine, evidence, notConnected } from '@letbuyy/lcis-core';
import { z } from 'zod';
import { type TwinEdge, type TwinGraph, type TwinLayer, type TwinNode, type TwinView } from '../shared/types';
import { twin } from '../shared/envelope';

// ── Zod schemas (loose: every field optional, unknown fields tolerated) ───────

/** A domain entry inside domain-intel.json `domains[]`. */
const DomainEntrySchema = z.object({
  key: z.string().optional(),
  label: z.string().optional(),
  tables: z.array(z.string()).optional(),
  rpcs: z.array(z.string()).optional(),
  owners: z.array(z.string()).optional(),
  routes: z.array(z.string()).optional(),
  /** Cross-domain dependency edges.  Two shapes coexist in the wild:
   *  1. string[] (just keys)
   *  2. Array<{ domain: string, strength: number }>
   */
  dependsOn: z
    .array(z.union([z.string(), z.object({ domain: z.string().optional() }).passthrough()]))
    .optional(),
}).passthrough();

const DomainIntelSchema = z.object({
  domains: z.array(DomainEntrySchema).optional(),
}).passthrough();

/** A table entry inside db-intel.json `tables[]`. */
const DbTableEntrySchema = z.object({
  name: z.string().optional(),
}).passthrough();

/** A policy entry inside db-intel.json `policies[]`. */
const DbPolicyEntrySchema = z.object({
  name: z.string().optional(),
  /** The table this policy is attached to. */
  table: z.string().optional(),
}).passthrough();

/** A trigger entry inside db-intel.json `triggers[]`. */
const DbTriggerEntrySchema = z.object({
  name: z.string().optional(),
  /** The table this trigger fires on. */
  table: z.string().optional(),
}).passthrough();

/** A function/rpc entry inside db-intel.json `functions[]` or `rpcs[]`. */
const DbFunctionEntrySchema = z.object({
  name: z.string().optional(),
}).passthrough();

const DbIntelSchema = z.object({
  tables: z.array(DbTableEntrySchema).optional(),
  policies: z.array(DbPolicyEntrySchema).optional(),
  triggers: z.array(DbTriggerEntrySchema).optional(),
  /** The real artifact uses "functions"; test stubs may use "rpcs". */
  functions: z.array(DbFunctionEntrySchema).optional(),
  rpcs: z.array(DbFunctionEntrySchema).optional(),
}).passthrough();

/** A worker entry inside infra-intel.json `workers[]`. */
const InfraWorkerEntrySchema = z.object({
  name: z.string().optional(),
  /** Queues this worker consumes from (binding names). */
  queueConsumers: z.array(z.string()).optional(),
  /** Queues this worker produces to (binding names). */
  queueProducers: z.array(z.string()).optional(),
}).passthrough();

/** A queue entry (test stub only — real artifact exposes queues via summary). */
const InfraQueueEntrySchema = z.object({
  name: z.string().optional(),
}).passthrough();

/** A route entry (test stub only — real artifact has no top-level routes[]). */
const InfraRouteEntrySchema = z.object({
  path: z.string().optional(),
  /** Some stubs may use `name` instead of `path`. */
  name: z.string().optional(),
}).passthrough();

const InfraIntelSchema = z.object({
  workers: z.array(InfraWorkerEntrySchema).optional(),
  /** Test stubs provide explicit queue entries; real artifact encodes queues in summary. */
  queues: z.array(InfraQueueEntrySchema).optional(),
  /** Test stubs provide explicit route entries. */
  routes: z.array(InfraRouteEntrySchema).optional(),
  summary: z.object({
    queueProducers: z.array(z.string()).optional(),
    queueConsumers: z.array(z.string()).optional(),
  }).passthrough().optional(),
}).passthrough();

// ── Helpers ──────────────────────────────────────────────────────────────────

type MutableNode = {
  id: string;
  layer: TwinLayer;
  label: string;
  domain: string | null;
  evidence: Evidence[];
};

type MutableEdge = {
  from: string;
  to: string;
  relation: TwinEdge['relation'];
  views: TwinView[];
  evidence: Evidence[];
};

/** Extract a domain key string from a dependsOn entry (handles both shapes). */
function parseDependsOnKey(entry: string | Record<string, unknown>): string | null {
  if (typeof entry === 'string') return entry.trim() || null;
  if (typeof entry === 'object' && entry !== null) {
    const d = entry['domain'];
    if (typeof d === 'string' && d.trim()) return d.trim();
  }
  return null;
}

/** Deduplicate nodes by id; keep first occurrence. */
function dedupeNodes(nodes: MutableNode[]): MutableNode[] {
  const seen = new Set<string>();
  const result: MutableNode[] = [];
  for (const n of nodes) {
    if (!seen.has(n.id)) {
      seen.add(n.id);
      result.push(n);
    }
  }
  return result;
}

/** Sort nodes by id (deterministic). */
function sortNodes(nodes: MutableNode[]): MutableNode[] {
  return [...nodes].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Sort edges by from, then to, then relation (deterministic). */
function sortEdges(edges: MutableEdge[]): MutableEdge[] {
  return [...edges].sort((a, b) => {
    if (a.from < b.from) return -1;
    if (a.from > b.from) return 1;
    if (a.to < b.to) return -1;
    if (a.to > b.to) return 1;
    return a.relation < b.relation ? -1 : a.relation > b.relation ? 1 : 0;
  });
}

/** Compute byLayer counts from a node list. */
function byLayerCounts(nodes: MutableNode[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const n of nodes) {
    counts[n.layer] = (counts[n.layer] ?? 0) + 1;
  }
  return counts;
}

// ── Service ──────────────────────────────────────────────────────────────────

export class TwinBuilderService {
  constructor(
    private readonly core: LcisEngine,
    private readonly now: () => string,
  ) {}

  buildTwin(): TwinGraph {
    const allEvidence: Evidence[] = [];
    const missingSources: string[] = [];
    const nodes: MutableNode[] = [];
    const edges: MutableEdge[] = [];

    // ── 1. domain-intel ──────────────────────────────────────────────────────
    const domainRaw = this.core.store.tryRead('domain-intel.json');
    if (domainRaw === null) {
      missingSources.push('domain-intel.json');
      allEvidence.push(notConnected('domain-intel.json', 'GRAPHIFY_DOMAIN_INTEL'));
    } else {
      const parsed = DomainIntelSchema.safeParse(domainRaw);
      const domainData = parsed.success ? parsed.data : DomainIntelSchema.parse({});
      const domainEvidence = evidence(
        'artifact-field',
        'domain-intel.json',
        `domain-intel read: ${domainData.domains?.length ?? 0} domain(s)`,
        'graphify-out/domain-intel.json',
      );
      allEvidence.push(domainEvidence);

      for (const d of domainData.domains ?? []) {
        const key = d.key?.trim();
        if (!key) continue;

        // domain node
        nodes.push({
          id: `domain:${key}`,
          layer: 'domain',
          label: d.label ?? key,
          domain: null,
          evidence: [evidence('artifact-field', `domain-intel.domains[${key}]`, 'domain entry', 'graphify-out/domain-intel.json')],
        });

        // contains edges: domain -> table:<t> for each table
        for (const t of d.tables ?? []) {
          edges.push({
            from: `domain:${key}`,
            to: `table:${t}`,
            relation: 'contains',
            views: ['dependency', 'data-flow'],
            evidence: [evidence('artifact-field', `domain-intel.domains[${key}].tables`, `domain ${key} contains table ${t}`, 'graphify-out/domain-intel.json')],
          });
        }

        // contains edges: domain -> rpc:<r> for each rpc
        for (const r of d.rpcs ?? []) {
          edges.push({
            from: `domain:${key}`,
            to: `rpc:${r}`,
            relation: 'contains',
            views: ['dependency', 'data-flow'],
            evidence: [evidence('artifact-field', `domain-intel.domains[${key}].rpcs`, `domain ${key} contains rpc ${r}`, 'graphify-out/domain-intel.json')],
          });
        }

        // owned-by edges: domain -> owner:<o> for each owner
        for (const o of d.owners ?? []) {
          const ownerKey = o.trim();
          if (!ownerKey) continue;
          nodes.push({
            id: `owner:${ownerKey}`,
            layer: 'owner',
            label: ownerKey,
            domain: null,
            evidence: [evidence('artifact-field', `domain-intel.domains[${key}].owners`, `owner ${ownerKey}`, 'graphify-out/domain-intel.json')],
          });
          edges.push({
            from: `domain:${key}`,
            to: `owner:${ownerKey}`,
            relation: 'owned-by',
            views: ['ownership'],
            evidence: [evidence('artifact-field', `domain-intel.domains[${key}].owners`, `domain ${key} owned by ${ownerKey}`, 'graphify-out/domain-intel.json')],
          });
        }

        // depends-on edges: domain -> domain for each dependsOn entry
        for (const depEntry of d.dependsOn ?? []) {
          const depKey = parseDependsOnKey(depEntry as string | Record<string, unknown>);
          if (!depKey) continue;
          edges.push({
            from: `domain:${key}`,
            to: `domain:${depKey}`,
            relation: 'depends-on',
            views: ['dependency'],
            evidence: [evidence('artifact-field', `domain-intel.domains[${key}].dependsOn`, `domain ${key} depends on ${depKey}`, 'graphify-out/domain-intel.json')],
          });
        }
      }
    }

    // ── 2. db-intel ─────────────────────────────────────────────────────────
    const dbRaw = this.core.store.tryRead('db-intel.json');
    if (dbRaw === null) {
      missingSources.push('db-intel.json');
      allEvidence.push(notConnected('db-intel.json', 'GRAPHIFY_DB_INTEL'));
    } else {
      const parsed = DbIntelSchema.safeParse(dbRaw);
      const dbData = parsed.success ? parsed.data : DbIntelSchema.parse({});
      const dbEvidence = evidence(
        'artifact-field',
        'db-intel.json',
        `db-intel read: ${dbData.tables?.length ?? 0} table(s), ${(dbData.functions ?? dbData.rpcs ?? []).length} function(s), ${dbData.policies?.length ?? 0} policy/policies, ${dbData.triggers?.length ?? 0} trigger(s)`,
        'graphify-out/db-intel.json',
      );
      allEvidence.push(dbEvidence);

      // Build a reverse map: table name -> domain key (from domain-intel contains info)
      // We'll populate this from the nodes we already have
      const tableDomainMap = new Map<string, string>();
      for (const e of edges) {
        if (e.relation === 'contains' && e.from.startsWith('domain:') && e.to.startsWith('table:')) {
          const tableName = e.to.slice('table:'.length);
          const domainKey = e.from.slice('domain:'.length);
          tableDomainMap.set(tableName, domainKey);
        }
      }

      // table nodes
      for (const t of dbData.tables ?? []) {
        const name = t.name?.trim();
        if (!name) continue;
        nodes.push({
          id: `table:${name}`,
          layer: 'table',
          label: name,
          domain: tableDomainMap.get(name) ?? null,
          evidence: [evidence('table', `db-intel.tables[${name}]`, `table ${name}`, 'graphify-out/db-intel.json')],
        });
      }

      // rpc/function nodes — real artifact uses "functions", test stubs may use "rpcs"
      const rpcDomainMap = new Map<string, string>();
      for (const e of edges) {
        if (e.relation === 'contains' && e.from.startsWith('domain:') && e.to.startsWith('rpc:')) {
          const rpcName = e.to.slice('rpc:'.length);
          const domainKey = e.from.slice('domain:'.length);
          rpcDomainMap.set(rpcName, domainKey);
        }
      }

      const fnList = dbData.functions ?? dbData.rpcs ?? [];
      for (const fn of fnList) {
        const name = fn.name?.trim();
        if (!name) continue;
        nodes.push({
          id: `rpc:${name}`,
          layer: 'rpc',
          label: name,
          domain: rpcDomainMap.get(name) ?? null,
          evidence: [evidence('rpc', `db-intel.functions[${name}]`, `rpc/function ${name}`, 'graphify-out/db-intel.json')],
        });
      }

      // policy nodes + policy->table 'secures' edges
      for (const p of dbData.policies ?? []) {
        const name = p.name?.trim();
        if (!name) continue;
        nodes.push({
          id: `policy:${name}`,
          layer: 'policy',
          label: name,
          domain: p.table ? (tableDomainMap.get(p.table.trim()) ?? null) : null,
          evidence: [evidence('policy', `db-intel.policies[${name}]`, `policy ${name}`, 'graphify-out/db-intel.json')],
        });
        // Only add edge when the policy entry itself names a table (field present and non-empty)
        const targetTable = p.table?.trim();
        if (targetTable) {
          edges.push({
            from: `policy:${name}`,
            to: `table:${targetTable}`,
            relation: 'secures',
            views: ['infrastructure'],
            evidence: [evidence('policy', `db-intel.policies[${name}].table`, `policy ${name} secures table ${targetTable}`, 'graphify-out/db-intel.json')],
          });
        }
      }

      // trigger nodes + trigger->table 'triggers' edges
      for (const tr of dbData.triggers ?? []) {
        const name = tr.name?.trim();
        if (!name) continue;
        nodes.push({
          id: `trigger:${name}`,
          layer: 'trigger',
          label: name,
          domain: tr.table ? (tableDomainMap.get(tr.table.trim()) ?? null) : null,
          evidence: [evidence('artifact-field', `db-intel.triggers[${name}]`, `trigger ${name}`, 'graphify-out/db-intel.json')],
        });
        // Only add edge when the trigger entry itself names a table (field present and non-empty)
        const targetTable = tr.table?.trim();
        if (targetTable) {
          edges.push({
            from: `trigger:${name}`,
            to: `table:${targetTable}`,
            relation: 'triggers',
            views: ['execution', 'data-flow'],
            evidence: [evidence('artifact-field', `db-intel.triggers[${name}].table`, `trigger ${name} fires on table ${targetTable}`, 'graphify-out/db-intel.json')],
          });
        }
      }
    }

    // ── 3. infra-intel ──────────────────────────────────────────────────────
    const infraRaw = this.core.store.tryRead('infra-intel.json');
    if (infraRaw === null) {
      missingSources.push('infra-intel.json');
      allEvidence.push(notConnected('infra-intel.json', 'GRAPHIFY_INFRA_INTEL'));
    } else {
      const parsed = InfraIntelSchema.safeParse(infraRaw);
      const infraData = parsed.success ? parsed.data : InfraIntelSchema.parse({});
      const infraEvidence = evidence(
        'artifact-field',
        'infra-intel.json',
        `infra-intel read: ${infraData.workers?.length ?? 0} worker(s)`,
        'graphify-out/infra-intel.json',
      );
      allEvidence.push(infraEvidence);

      // ── worker nodes ──
      for (const w of infraData.workers ?? []) {
        const name = w.name?.trim();
        if (!name) continue;
        nodes.push({
          id: `worker:${name}`,
          layer: 'worker',
          label: name,
          domain: null,
          evidence: [evidence('worker', `infra-intel.workers[${name}]`, `worker ${name}`, 'graphify-out/infra-intel.json')],
        });
      }

      // ── queue nodes ──
      // Gather queue names from two sources (both may be present):
      //   a) explicit `queues[]` array (test stubs)
      //   b) summary.queueProducers union summary.queueConsumers (real artifact)
      const queueNames = new Set<string>();
      for (const q of infraData.queues ?? []) {
        const name = q.name?.trim();
        if (name) queueNames.add(name);
      }
      for (const qp of infraData.summary?.queueProducers ?? []) {
        if (qp.trim()) queueNames.add(qp.trim());
      }
      for (const qc of infraData.summary?.queueConsumers ?? []) {
        if (qc.trim()) queueNames.add(qc.trim());
      }
      for (const qName of queueNames) {
        nodes.push({
          id: `queue:${qName}`,
          layer: 'queue',
          label: qName,
          domain: null,
          evidence: [evidence('artifact-field', `infra-intel:queue:${qName}`, `queue ${qName}`, 'graphify-out/infra-intel.json')],
        });
      }

      // ── api (route) nodes ──
      // Only from explicit `routes[]` (test stubs); the real infra-intel has no top-level
      // routes array. If absent, note in evidence but do NOT invent nodes.
      if (infraData.routes && infraData.routes.length > 0) {
        for (const r of infraData.routes) {
          const path = r.path?.trim() ?? r.name?.trim();
          if (!path) continue;
          nodes.push({
            id: `api:${path}`,
            layer: 'api',
            label: path,
            domain: null,
            evidence: [evidence('route', `infra-intel.routes[${path}]`, `api route ${path}`, 'graphify-out/infra-intel.json')],
          });
        }
      } else {
        // Real artifact: consumer topology for api routes needs a dedicated routes field
        // that is not present in infra-intel.json — honest absence.
        allEvidence.push(
          evidence(
            'not-connected',
            'infra-intel.routes',
            'API route nodes not emitted — infra-intel.json has no top-level routes[]; route nodes derive from domain-intel routes[] which are route group names, not HTTP paths',
            'graphify-out/infra-intel.json',
          ),
        );
      }

      // ── worker->queue 'consumes' edges ──
      // ONLY when the worker entry itself lists the queue in queueConsumers[].
      // Do NOT invent this relation from queueProducers or domain data.
      for (const w of infraData.workers ?? []) {
        const workerName = w.name?.trim();
        if (!workerName) continue;
        for (const queueName of w.queueConsumers ?? []) {
          const q = queueName.trim();
          if (!q) continue;
          // Only add the edge if the queue node exists (it was added above)
          if (queueNames.has(q)) {
            edges.push({
              from: `worker:${workerName}`,
              to: `queue:${q}`,
              relation: 'consumes',
              views: ['communication', 'infrastructure'],
              evidence: [evidence('worker', `infra-intel.workers[${workerName}].queueConsumers`, `worker ${workerName} consumes queue ${q}`, 'graphify-out/infra-intel.json')],
            });
          }
        }
      }

      // Note: if no worker has queueConsumers referencing a known queue, add honest evidence
      const hasConsumesEdge = edges.some((e) => e.relation === 'consumes');
      if (!hasConsumesEdge && (infraData.workers?.length ?? 0) > 0) {
        allEvidence.push(
          evidence(
            'not-connected',
            'infra-intel:worker-queue-consumes',
            'No worker→queue consumes edges: worker entries have no queueConsumers referencing known queue nodes; consumer topology needs infra fields',
            'graphify-out/infra-intel.json',
          ),
        );
      }
    }

    // ── Finalize: dedup, sort, compute byLayer ──────────────────────────────
    const dedupedNodes = sortNodes(dedupeNodes(nodes));
    const sortedEdges = sortEdges(edges);

    const byLayer = byLayerCounts(dedupedNodes);

    const summary =
      `Dependency twin: ${dedupedNodes.length} node(s), ${sortedEdges.length} edge(s) across ` +
      `${Object.keys(byLayer).length} layer(s).` +
      (missingSources.length > 0
        ? ` ${missingSources.length} structural source(s) missing — twin is partial.`
        : ' All structural sources read.') +
      ' Runtime edge weights NOT_CONNECTED — topology only.';

    return twin(
      {
        nodes: dedupedNodes as readonly TwinNode[],
        edges: sortedEdges as readonly TwinEdge[],
        byLayer,
        missingSources,
        summary,
      },
      {
        evidence: allEvidence,
        liveConnected: false,
        now: this.now,
      },
    );
  }
}
