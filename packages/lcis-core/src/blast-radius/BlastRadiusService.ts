/**
 * BlastRadiusService — the MVP capability. Consolidates intelligence.mjs (blast/
 * dependencies/consumers/critical), cross-domain-engine.mjs (crossDomain),
 * change-impact.mjs (impact), and relationship-intel.mjs (relationships) into one
 * deterministic, evidence-cited service over the code graph + domain/db/FK artifacts.
 *
 * SQL lineage (trace*) and ownership (findOwnership/infraSummary) are intentionally
 * NOT here — they belong to DBLineageService / OwnershipService.
 */
import type { GraphNode } from '../contracts/index';
import type { GraphService } from '../graph/GraphService';
import type { ArtifactStore } from '../runtime/ArtifactStore';
import type {
  BlastResult,
  ConsumerResult,
  CriticalResult,
  CrossDomainResult,
  DependencyResult,
  DomainError,
  ImpactResult,
  NodeView,
  NodeViewRel,
  PathResult,
  RelationshipResult,
} from './types';

interface RawDomain {
  key: string;
  label?: string;
  routes?: string[];
  rpcs?: string[];
  tables?: string[];
  queues?: string[];
  apps?: string[];
  workers?: string[];
  owners?: string[];
  consumedBy?: { domain: string; strength?: number }[];
}
interface RawDomainIntel {
  domains: RawDomain[];
}
interface RawDbTable {
  name: string;
  money?: boolean;
  tenant?: boolean;
}
interface RawDbIntel {
  tables: RawDbTable[];
}
interface RawRelTable {
  name: string;
  references?: string[];
  referencedBy?: string[];
  fanIn?: number;
  fanOut?: number;
}
interface RawRelIntel {
  tables: RawRelTable[];
}

const GRAPH = 'graphify-out/graph.json' as const;
const DOMAIN_ARTIFACT = 'graphify-out/domain-intel.json' as const;
const REL_ARTIFACT = 'graphify-out/relationship-intel.json' as const;

function dedupe(xs: string[]): string[] {
  return [...new Set(xs)];
}

export class BlastRadiusService {
  constructor(
    private readonly graph: GraphService,
    private readonly store: ArtifactStore,
  ) {}

  private view(node: GraphNode): NodeView {
    return {
      id: node.id,
      label: node.label,
      file: node.sourceFile ?? '',
      loc: node.sourceLocation ?? '',
      degree: this.graph.degree(node.id),
      community: node.community ?? 0,
      provenance: node.id,
    };
  }

  private viewId(id: string): NodeView | null {
    const n = this.graph.node(id);
    return n ? this.view(n) : null;
  }

  /** Resolve a symbol to a graph node id, or null. */
  resolveId(query: string): string | null {
    return this.graph.resolve(query)?.id ?? null;
  }

  /** "What breaks if this changes?" — inbound BFS over the code graph, layered. */
  blast(symbol: string, depth = 3): BlastResult | null {
    const start = this.graph.resolve(symbol);
    if (!start) return null;
    const id = start.id;
    const seen = new Set<string>([id]);
    let frontier: string[] = [id];
    const layers: number[] = [];
    for (let d = 0; d < depth && frontier.length > 0; d++) {
      const next: string[] = [];
      for (const cur of frontier) {
        for (const e of this.graph.incoming(cur)) {
          if (!seen.has(e.source)) {
            seen.add(e.source);
            next.push(e.source);
          }
        }
      }
      if (next.length === 0) break;
      layers.push(next.length);
      frontier = next;
    }
    const impacted = [...seen].filter((x) => x !== id);
    const files = new Set<string>();
    for (const x of impacted) {
      const f = this.graph.node(x)?.sourceFile;
      if (f) files.add(f);
    }
    const topImpacted = impacted
      .map((x) => this.viewId(x))
      .filter((v): v is NodeView => v !== null)
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 12);
    return {
      node: this.view(start),
      impactedNodes: impacted.length,
      impactedFiles: files.size,
      layers,
      topImpacted,
      artifact: GRAPH,
    };
  }

  /** Direct outbound neighbours — "what does this import/call?" */
  dependencies(symbol: string): DependencyResult | null {
    const start = this.graph.resolve(symbol);
    if (!start) return null;
    const dependsOn = this.graph
      .outgoing(start.id)
      .map((e): NodeViewRel | null => {
        const v = this.viewId(e.target);
        return v ? { ...v, rel: e.relation } : null;
      })
      .filter((x): x is NodeViewRel => x !== null);
    return { node: this.view(start), dependsOn, artifact: GRAPH };
  }

  /** Direct inbound neighbours — "what imports/calls this?" */
  consumers(symbol: string): ConsumerResult | null {
    const start = this.graph.resolve(symbol);
    if (!start) return null;
    const consumedBy = this.graph
      .incoming(start.id)
      .map((e): NodeViewRel | null => {
        const v = this.viewId(e.source);
        return v ? { ...v, rel: e.relation } : null;
      })
      .filter((x): x is NodeViewRel => x !== null);
    return { node: this.view(start), consumedBy, artifact: GRAPH };
  }

  /** Shortest directed path a → b over outbound edges. */
  path(a: string, b: string): PathResult | null {
    const sa = this.graph.resolve(a);
    const sb = this.graph.resolve(b);
    if (!sa || !sb) return null;
    const idA = sa.id;
    const idB = sb.id;
    const queue: string[][] = [[idA]];
    const visited = new Set<string>([idA]);
    while (queue.length > 0) {
      const pathSoFar = queue.shift() as string[];
      const cur = pathSoFar[pathSoFar.length - 1] as string;
      if (cur === idB) {
        const nodes = pathSoFar
          .map((x) => this.viewId(x))
          .filter((v): v is NodeView => v !== null);
        return {
          from: this.view(sa),
          to: this.view(sb),
          path: nodes,
          hops: pathSoFar.length - 1,
          artifact: GRAPH,
        };
      }
      for (const e of this.graph.outgoing(cur)) {
        if (!visited.has(e.target)) {
          visited.add(e.target);
          queue.push([...pathSoFar, e.target]);
        }
      }
    }
    return { from: this.view(sa), to: this.view(sb), path: [], hops: -1, artifact: GRAPH };
  }

  /** Top-N nodes by total degree. */
  critical(n = 20): CriticalResult {
    const nodes: NodeView[] = [];
    for (const node of this.graph.nodes()) nodes.push(this.view(node));
    nodes.sort((a, b) => b.degree - a.degree);
    return { nodes: nodes.slice(0, n), artifact: GRAPH };
  }

  /** "What breaks if this domain changes?" — BFS over domain consumedBy edges. */
  crossDomain(key: string): CrossDomainResult | DomainError {
    const di = this.store.tryRead<RawDomainIntel>('domain-intel');
    if (!di) return { error: 'domain-intel.json not available' };
    const d = di.domains.find((x) => x.key === key);
    if (!d) return { error: `domain '${key}' not found in domain-intel.json` };
    const consumersOf = (k: string): string[] =>
      (di.domains.find((x) => x.key === k)?.consumedBy ?? []).map((c) => c.domain);
    const seen = new Set<string>([key]);
    let frontier: string[] = [key];
    const layers: number[] = [];
    while (frontier.length > 0) {
      const next: string[] = [];
      for (const cur of frontier) {
        for (const c of consumersOf(cur)) {
          if (!seen.has(c)) {
            seen.add(c);
            next.push(c);
          }
        }
      }
      if (next.length === 0) break;
      layers.push(next.length);
      frontier = next;
    }
    const impacted = [...seen].filter((k) => k !== key);
    const impactedDomains = impacted
      .map((k) => di.domains.find((x) => x.key === k))
      .filter((x): x is RawDomain => x !== undefined);
    return {
      domain: key,
      label: d.label ?? key,
      directConsumers: (d.consumedBy ?? []).map((c) => ({ domain: c.domain, strength: c.strength ?? 0 })),
      blastRadius: { domains: impacted.length, layers, affected: impacted },
      owners: dedupe([...impactedDomains.flatMap((x) => x.owners ?? []), ...(d.owners ?? [])]),
      services: {
        apps: dedupe([...impactedDomains.flatMap((x) => x.apps ?? []), ...(d.apps ?? [])]),
        workers: dedupe([...impactedDomains.flatMap((x) => x.workers ?? []), ...(d.workers ?? [])]),
      },
      routes: dedupe([...impactedDomains.flatMap((x) => x.routes ?? []), ...(d.routes ?? [])]),
      rpcs: dedupe([...impactedDomains.flatMap((x) => x.rpcs ?? []), ...(d.rpcs ?? [])]),
      tables: dedupe([...impactedDomains.flatMap((x) => x.tables ?? []), ...(d.tables ?? [])]),
      artifact: DOMAIN_ARTIFACT,
    };
  }

  /** Composite domain impact: crossDomain + money/tenant flags + queues + deploy gate. */
  impact(key: string): ImpactResult | DomainError {
    const b = this.crossDomain(key);
    if ('error' in b) return b;
    const db = this.store.tryRead<RawDbIntel>('db-intel');
    const di = this.store.tryRead<RawDomainIntel>('domain-intel');
    const moneyTouched = db !== null && b.tables.some((t) => db.tables.find((x) => x.name === t)?.money === true);
    const tenantTouched = db !== null && b.tables.some((t) => db.tables.find((x) => x.name === t)?.tenant === true);
    const queueDomains = [key, ...b.blastRadius.affected]
      .map((k) => di?.domains.find((x) => x.key === k))
      .filter((x): x is RawDomain => x !== undefined && x !== null);
    const queues = dedupe(queueDomains.flatMap((x) => x.queues ?? []));
    return {
      domain: key,
      label: b.label,
      breaks: {
        domains: { count: b.blastRadius.domains, list: b.blastRadius.affected, layers: b.blastRadius.layers },
        routes: b.routes,
        rpcs: b.rpcs,
        tables: b.tables,
        workers: b.services.workers,
        queues,
        deployments: {
          workers: b.services.workers,
          apps: b.services.apps,
          gate: 'production-deploy.yml: migrate-production → workers → Vercel; rollback via production-rollback.mjs',
        },
        merchants: tenantTouched
          ? 'ALL tenants — shared multi-tenant schema (RLS + verifySiteOwnership isolate, not physical separation)'
          : 'platform-internal (no tenant table touched)',
        owners: b.owners,
      },
      risk: {
        money: moneyTouched,
        tenant: tenantTouched,
        note: moneyTouched
          ? 'touches money tables — canonical-ledger-only-validator + step-up apply; run blast on the RPCs before merge'
          : 'no money table in blast radius',
      },
      artifacts: [DOMAIN_ARTIFACT, 'graphify-out/db-intel.json'],
    };
  }

  /** FK fan-in / fan-out for a table. */
  relationships(table: string): RelationshipResult | DomainError {
    const ri = this.store.tryRead<RawRelIntel>('relationship-intel');
    if (!ri) return { error: 'relationship-intel.json not available' };
    const t = ri.tables.find((x) => x.name === table);
    if (!t) return { error: `table '${table}' not in relationship graph (may have no foreign keys)` };
    const references = t.references ?? [];
    const referencedBy = t.referencedBy ?? [];
    return {
      table,
      references,
      referencedBy,
      fanIn: t.fanIn ?? referencedBy.length,
      fanOut: t.fanOut ?? references.length,
      artifact: REL_ARTIFACT,
    };
  }
}
