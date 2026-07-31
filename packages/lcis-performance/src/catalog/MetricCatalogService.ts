/**
 * MetricCatalogService — deterministic per-entity metric catalog for LPAS.
 *
 * Composes MetricDescriptor records from the dependency twin (one descriptor per
 * relevant node per metric kind) plus two twin-independent infrastructure entries
 * that are always present. No values are synthesized — resolveSeries() maps a
 * descriptor to a MetricSeries that is CONNECTED only when the caller provides a
 * non-empty array of real measurements.
 *
 * Hard rules (enforced here):
 * - No Date.now() / argless new Date() — clock is injected via `now`.
 * - No fetch / exec / fs access; twin is the single structural source.
 * - Never fabricate a measurement. MetricSeries without provided values → NOT_CONNECTED,
 *   values: null.
 * - advisory / mutation: none.
 */
import { type Evidence, type LcisEngine, evidence, notConnected } from '@letbuyy/lcis-core';
import { createTwinEngine, type TwinEngine } from '@letbuyy/lcis-twin';
import { type MetricDescriptor, type MetricKind, type MetricSeries } from '../shared/types';

// ── Live-source constants (exact, non-fabricated) ─────────────────────────────

const AE_SOURCE = 'Analytics Engine SQL API (POST /analytics_engine/sql)';
const AE_UNREACHABLE = 'AE SQL API is POST-only — unreachable via the GET boundary';
const PG_STAT_SOURCE = 'pg_stat_statements (SQL access)';
const PG_STAT_UNREACHABLE = 'pg_stat_statements requires SQL access — not exposed over the GET-only Management API';
const CF_GRAPHQL_SOURCE = 'Cloudflare GraphQL Analytics API (POST-only)';
const CF_GRAPHQL_UNREACHABLE = 'Queue metrics are served by the Cloudflare GraphQL Analytics API (POST-only)';
const CF_QUEUES_SOURCE = 'Cloudflare Queues REST API (queues adapter — per-queue consumers)';
const CF_ENV = ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'] as const;
const REDIS_SOURCE = 'redis INFO (not in the read-only command allowlist)';
const REDIS_UNREACHABLE = 'INFO is not in the read-only command allowlist (unbounded response)';
const PG_MGMT_SOURCE = 'postgres adapter (Supabase Management API)';
const PG_MGMT_ENV = ['SUPABASE_MGMT_TOKEN', 'SUPABASE_PROJECT_REF'] as const;

// ── Twin-independent fixed metrics (always emitted, dedup-safe) ───────────────

const REDIS_RATIO_DESCRIPTOR: MetricDescriptor = {
  key: 'ratio.cache.redis',
  kind: 'ratio' as MetricKind,
  entity: 'infrastructure:redis',
  unit: 'ratio',
  liveSource: REDIS_SOURCE,
  requiredEnv: [],
  reachable: false,
  unreachableReason: REDIS_UNREACHABLE,
};

const POSTGRES_RESOURCE_DESCRIPTOR: MetricDescriptor = {
  key: 'resource.db.postgres',
  kind: 'resource' as MetricKind,
  entity: 'database:postgres',
  unit: 'percent',
  liveSource: PG_MGMT_SOURCE,
  requiredEnv: [...PG_MGMT_ENV],
  reachable: true,
};

// ── MetricCatalogService ──────────────────────────────────────────────────────

export class MetricCatalogService {
  private readonly twin: TwinEngine;

  constructor(
    private readonly core: LcisEngine,
    _now: () => string,
  ) {
    // Build the twin engine once; buildTwin() is lazily cached by DependencyTwinEngineImpl.
    this.twin = createTwinEngine({ core, now: _now });
  }

  /**
   * Build the full metric catalog over the current twin graph.
   *
   * For each relevant twin node layer, one or more MetricDescriptor records are emitted:
   *
   *   api / route → latency.api.<name>          (AE SQL, POST-only, unreachable)
   *   rpc         → latency.rpc.<name>           (AE SQL, POST-only, unreachable)
   *   table       → latency.db.<name>            (pg_stat_statements, unreachable)
   *   queue       → throughput.queue.<name>      (CF GraphQL, POST-only, unreachable)
   *               → scaling.queue.<name>         (CF Queues REST API, reachable)
   *   worker      → cold-start.worker.<name>     (AE SQL, POST-only, unreachable)
   *               → resource.worker.<name>       (AE SQL, POST-only, unreachable)
   *
   * Plus two twin-independent entries that are always present:
   *   ratio.cache.redis
   *   resource.db.postgres
   *
   * The result is sorted by key and deduplicated (first occurrence wins).
   */
  buildCatalog(): readonly MetricDescriptor[] {
    const graph = this.twin.buildTwin();
    const descriptors: MetricDescriptor[] = [];

    for (const node of graph.nodes) {
      const name = node.id.includes(':') ? node.id.slice(node.id.indexOf(':') + 1) : node.id;

      if (node.layer === 'api' || node.layer === 'route' as string) {
        descriptors.push({
          key: `latency.api.${name}`,
          kind: 'latency',
          entity: node.id,
          unit: 'ms',
          liveSource: AE_SOURCE,
          requiredEnv: [],
          reachable: false,
          unreachableReason: AE_UNREACHABLE,
        });
        continue;
      }

      if (node.layer === 'rpc') {
        descriptors.push({
          key: `latency.rpc.${name}`,
          kind: 'latency',
          entity: node.id,
          unit: 'ms',
          liveSource: AE_SOURCE,
          requiredEnv: [],
          reachable: false,
          unreachableReason: AE_UNREACHABLE,
        });
        continue;
      }

      if (node.layer === 'table') {
        descriptors.push({
          key: `latency.db.${name}`,
          kind: 'latency',
          entity: node.id,
          unit: 'ms',
          liveSource: PG_STAT_SOURCE,
          requiredEnv: [],
          reachable: false,
          unreachableReason: PG_STAT_UNREACHABLE,
        });
        continue;
      }

      if (node.layer === 'queue') {
        // Throughput metric — AE GraphQL, POST-only, unreachable
        descriptors.push({
          key: `throughput.queue.${name}`,
          kind: 'throughput',
          entity: node.id,
          unit: 'messages/s',
          liveSource: CF_GRAPHQL_SOURCE,
          requiredEnv: [],
          reachable: false,
          unreachableReason: CF_GRAPHQL_UNREACHABLE,
        });
        // Scaling metric — CF Queues REST API, reachable
        descriptors.push({
          key: `scaling.queue.${name}`,
          kind: 'scaling',
          entity: node.id,
          unit: 'consumers',
          liveSource: CF_QUEUES_SOURCE,
          requiredEnv: [...CF_ENV],
          reachable: true,
        });
        continue;
      }

      if (node.layer === 'worker') {
        // Cold-start — AE unreachable
        descriptors.push({
          key: `cold-start.worker.${name}`,
          kind: 'cold-start',
          entity: node.id,
          unit: 'ms',
          liveSource: AE_SOURCE,
          requiredEnv: [],
          reachable: false,
          unreachableReason: AE_UNREACHABLE,
        });
        // Resource — AE unreachable
        descriptors.push({
          key: `resource.worker.${name}`,
          kind: 'resource',
          entity: node.id,
          unit: 'percent',
          liveSource: AE_SOURCE,
          requiredEnv: [],
          reachable: false,
          unreachableReason: AE_UNREACHABLE,
        });
        continue;
      }
    }

    // Always-present twin-independent metrics
    descriptors.push(REDIS_RATIO_DESCRIPTOR);
    descriptors.push(POSTGRES_RESOURCE_DESCRIPTOR);

    // Sort by key, then dedup (first occurrence wins)
    descriptors.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
    return dedup(descriptors);
  }

  /**
   * Resolve a MetricDescriptor to a MetricSeries.
   *
   * - provided non-empty → CONNECTED, values = provided, evidence cites 'caller-provided series'.
   * - provided absent or empty → NOT_CONNECTED, values null, evidence cites the live source.
   *
   * No values are synthesized under any path.
   */
  resolveSeries(descriptor: MetricDescriptor, provided?: readonly number[]): MetricSeries {
    if (provided !== undefined && provided.length > 0) {
      return {
        descriptor,
        connection: 'CONNECTED',
        values: provided,
        evidence: [
          evidence(
            'artifact-field',
            descriptor.key,
            'caller-provided series — CONNECTED',
            'caller-provided series',
          ),
        ],
      };
    }

    const ncEvidence: Evidence = notConnected(descriptor.key, descriptor.liveSource);
    return {
      descriptor,
      connection: 'NOT_CONNECTED',
      values: null,
      evidence: [ncEvidence],
    };
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Dedup a pre-sorted array of MetricDescriptor by key; first occurrence wins. */
function dedup(descriptors: MetricDescriptor[]): readonly MetricDescriptor[] {
  const seen = new Set<string>();
  const result: MetricDescriptor[] = [];
  for (const d of descriptors) {
    if (!seen.has(d.key)) {
      seen.add(d.key);
      result.push(d);
    }
  }
  return result;
}
