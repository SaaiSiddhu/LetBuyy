/**
 * RecommendationService — pure, stateless advisory recommendation engine for LPAS.
 *
 * PURE constructor (no dependencies, no IO, no clock). All logic is deterministic.
 *
 * Rules implemented:
 *   PA01 — Deep dependency chain (one per deep-chain LatencyModelEntry).
 *   PA02 — High fan-in hotspot (one per FanEntry with fanIn >= 5).
 *   PA03 — Telemetry not connected (once when notConnectedMetricKeys.length > 0).
 *   PA04 — Queue without consumer (one per consumerless queue id).
 *   PA05 — Cache layer unobserved (once when !cacheObserved).
 *   PA06 — SPOF on a hot path (one per spofId that ALSO appears in fanTop with fanIn >= 3).
 *
 * HARD RULES:
 *   - advisory: true on every Recommendation (literal, never dynamic).
 *   - action uses advisory imperative wording ('Consider …').
 *   - Output sorted: severity critical>high>medium>low>info, then id lexicographic.
 *   - id format: '<rule>-<n>' where n is 1-based within the rule.
 *   - Empty input → no recommendations (never throws).
 *   - Deterministic: identical input → identical output.
 */
import { evidence as makeEvidence } from '@letbuyy/lcis-core';
import { PERFORMANCE_RULES } from '../shared/rules';
import type { LatencyModelEntry, Recommendation, Severity } from '../shared/types';

export interface RecommendationInput {
  /** Latency model entries — PA01 fires for each with band === 'deep-chain'. */
  readonly latencyModel: readonly LatencyModelEntry[];
  /** Fan report top entries — PA02 fires for each with fanIn >= 5; PA06 cross-checks. */
  readonly fanTop: readonly { id: string; fanIn: number; fanOut: number }[];
  /** SPOF node ids — PA06 fires for each that also appears in fanTop with fanIn >= 3. */
  readonly spofIds: readonly string[];
  /** Queue ids with no consumer — PA04 fires for each. */
  readonly consumerlessQueueIds: readonly string[];
  /** Metric keys with no live source connected — PA03 fires ONCE when length > 0. */
  readonly notConnectedMetricKeys: readonly string[];
  /** Whether a cache layer's hit ratio is observable — PA05 fires ONCE when false. */
  readonly cacheObserved: boolean;
}

// ── Severity sort order ────────────────────────────────────────────────────────
const SEV_ORDER: Record<Severity, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  info: 4,
};

function ruleMeta(id: string): { title: string; severity: Severity } {
  const rule = PERFORMANCE_RULES.find((r) => r.id === id);
  if (!rule) throw new Error(`Unknown rule id: ${id}`);
  return { title: rule.title, severity: rule.severity };
}

export class RecommendationService {
  /** Pure constructor — no dependencies, no IO. */
  constructor() {}

  recommend(input: RecommendationInput): readonly Recommendation[] {
    const recs: Recommendation[] = [];

    // ── PA01: Deep dependency chain ────────────────────────────────────────────
    {
      const { severity } = ruleMeta('PA01');
      let n = 0;
      for (const entry of input.latencyModel) {
        if (entry.band !== 'deep-chain') continue;
        n++;
        recs.push({
          id: `PA01-${n}`,
          rule: 'PA01',
          advisory: true,
          action:
            `Consider reducing the hop depth for '${entry.entity}' ` +
            `(currently ${entry.hops} hops: ${entry.chain.join(' → ')}). ` +
            `Introduce caching, aggregation, or service consolidation to shorten the chain.`,
          rationale:
            `Structural deep dependency chain (${entry.hops} hops) is the primary driver of latency budget exhaustion for '${entry.entity}'.`,
          severity,
          evidence: [
            makeEvidence(
              'graph-node',
              entry.entity,
              `deep-chain band; hops=${entry.hops}; chain=[${entry.chain.join(', ')}]`,
              'LatencyModelEntry (caller-provided)',
            ),
            ...entry.evidence,
          ],
        });
      }
    }

    // ── PA02: High fan-in hotspot ──────────────────────────────────────────────
    {
      const { severity } = ruleMeta('PA02');
      let n = 0;
      for (const fan of input.fanTop) {
        if (fan.fanIn < 5) continue;
        n++;
        recs.push({
          id: `PA02-${n}`,
          rule: 'PA02',
          advisory: true,
          action:
            `Consider reducing fan-in on '${fan.id}' (fanIn=${fan.fanIn}). ` +
            `Introduce an intermediate aggregator, load balancer, or queue to distribute load and reduce blast radius.`,
          rationale:
            `'${fan.id}' has ${fan.fanIn} inbound dependencies, concentrating load and failure blast. ` +
            `High fan-in nodes are performance and reliability single points of pressure.`,
          severity,
          evidence: [
            makeEvidence(
              'graph-node',
              fan.id,
              `fanIn=${fan.fanIn}, fanOut=${fan.fanOut}`,
              'FanReport.top (caller-provided)',
            ),
          ],
        });
      }
    }

    // ── PA03: Telemetry not connected (ONCE) ───────────────────────────────────
    if (input.notConnectedMetricKeys.length > 0) {
      const { severity } = ruleMeta('PA03');
      const shown = input.notConnectedMetricKeys.slice(0, 5);
      const more = input.notConnectedMetricKeys.length - shown.length;
      const keyList = shown.join(', ') + (more > 0 ? `, … (+${more} more)` : '');
      recs.push({
        id: 'PA03-1',
        rule: 'PA03',
        advisory: true,
        action:
          `Consider connecting live telemetry sources for the ${input.notConnectedMetricKeys.length} ` +
          `unconnected metric(s): ${keyList}. Wire the required env vars and telemetry adapters before optimizing.`,
        rationale:
          `${input.notConnectedMetricKeys.length} catalogued metric(s) have no live source connected. ` +
          `Without measurements, any performance optimization is unverified.`,
        severity,
        evidence: shown.map((k) =>
          makeEvidence(
            'not-connected',
            k,
            'Metric has no live source connected.',
            'MetricCatalog (caller-provided)',
          ),
        ),
      });
    }

    // ── PA04: Queue without consumer ───────────────────────────────────────────
    {
      const { severity } = ruleMeta('PA04');
      let n = 0;
      for (const queueId of input.consumerlessQueueIds) {
        n++;
        recs.push({
          id: `PA04-${n}`,
          rule: 'PA04',
          advisory: true,
          action:
            `Consider attaching a consumer to queue '${queueId}'. ` +
            `Without a consumer, the backlog grows unbounded and messages may expire or be dropped.`,
          rationale:
            `Queue '${queueId}' has no registered consumer. Unconsumed queues accumulate backlog and risk data loss at high throughput.`,
          severity,
          evidence: [
            makeEvidence(
              'graph-node',
              queueId,
              'No consumer registered for this queue.',
              'consumerlessQueueIds (caller-provided)',
            ),
          ],
        });
      }
    }

    // ── PA05: Cache layer unobserved (ONCE) ────────────────────────────────────
    if (!input.cacheObserved) {
      const { severity } = ruleMeta('PA05');
      recs.push({
        id: 'PA05-1',
        rule: 'PA05',
        advisory: true,
        action:
          `Consider instrumenting cache hit-ratio metrics. ` +
          `Without observability, cache sizing and eviction policy cannot be validated.`,
        rationale:
          `A cache layer exists but its hit ratio is not observable. ` +
          `Cache sizing decisions made without measurements may introduce hidden performance risk.`,
        severity,
        evidence: [
          makeEvidence(
            'not-connected',
            'cache.hit-ratio',
            'Cache hit ratio metric not connected.',
            'cacheObserved=false (caller-provided)',
          ),
        ],
      });
    }

    // ── PA06: SPOF on a hot path ───────────────────────────────────────────────
    {
      const { severity } = ruleMeta('PA06');
      // Build a fanIn lookup from fanTop
      const fanInMap = new Map<string, number>();
      for (const fan of input.fanTop) {
        fanInMap.set(fan.id, fan.fanIn);
      }
      let n = 0;
      for (const spofId of input.spofIds) {
        const fanIn = fanInMap.get(spofId) ?? 0;
        if (fanIn < 3) continue;
        n++;
        recs.push({
          id: `PA06-${n}`,
          rule: 'PA06',
          advisory: true,
          action:
            `Consider eliminating the single point of failure at '${spofId}' ` +
            `(fanIn=${fanIn}). Introduce redundancy, circuit-breakers, or failover so that ` +
            `${fanIn} dependent nodes are not all affected by a single failure.`,
          rationale:
            `'${spofId}' is both a structural SPOF (articulation point) and a high-fan-in node (${fanIn}). ` +
            `A failure here propagates to all ${fanIn} inbound dependents simultaneously.`,
          severity,
          evidence: [
            makeEvidence(
              'graph-node',
              spofId,
              `SPOF articulation point with fanIn=${fanIn} on a hot path.`,
              'SpofReport + FanReport (caller-provided)',
            ),
          ],
        });
      }
    }

    // ── Sort: severity desc, then id asc ──────────────────────────────────────
    recs.sort((a, b) => {
      const sd = SEV_ORDER[a.severity] - SEV_ORDER[b.severity];
      if (sd !== 0) return sd;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });

    return recs;
  }
}
