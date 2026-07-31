/**
 * QueuesAdapter — READ-ONLY deep observer of Cloudflare Queues.
 *
 * DISTINCT from CloudflareAdapter ('cloudflare' name, 'queues' capability at list level):
 *  - CloudflareAdapter lists queues as part of a broad account inventory.
 *  - QueuesAdapter ('queues' name) goes deeper: it fetches per-queue consumer
 *    bindings via a second HTTP call per queue, emits 'queue-deep' and
 *    'queue-consumer' fact kinds, and runs consumer-coverage checks.
 *
 * Reads:
 *  - GET /accounts/{acct}/queues          → queue inventory
 *  - GET /accounts/{acct}/queues/{id}/consumers → consumer bindings per queue
 *
 * Honesty contract:
 *  - Credentials absent → NOT_CONNECTED; names both CLOUDFLARE_API_TOKEN and
 *    CLOUDFLARE_ACCOUNT_ID exactly.
 *  - Queue backlog depth / message count NOT CONNECTED: Cloudflare exposes
 *    real-time metrics only via the Analytics Engine GraphQL POST API. That
 *    requires a separate credential and a mutation-style query; neither fits the
 *    read-only GET-only contract. Stated explicitly in every queue-deep fact's
 *    evidence.
 *  - Consumer fetch failure for a single queue is absorbed; evidence states
 *    NOT CONNECTED for that queue's consumers.
 *  - Pagination: only page 1 of the queues list is fetched (the API does not
 *    offer a reliable cursor in all versions). Stated in evidence; confidence
 *    reduced accordingly.
 *  - Confidence capped at 0.88 (first page only; consumer fetch may partially fail).
 */
import { type Evidence } from '@letbuyy/lcis-core';
import {
  AdapterBase,
  type AdapterDeps,
  type AdapterMetadata,
  EvidenceBuilder,
  type GatherResult,
  type LiveFact,
  type VerificationFinding,
} from '../shared/index';
import {
  ConsumersListSchema,
  type DeepQueue,
  type QueueConsumer,
  QueuesListSchema,
  QueuesProbeSchema,
  type QueuesPayload,
} from './types';

const CF_API = 'https://api.cloudflare.com/client/v4';
const SOURCE = 'Cloudflare Queues';

export class QueuesAdapter extends AdapterBase {
  constructor(deps: AdapterDeps) {
    super(deps);
  }

  metadata(): AdapterMetadata {
    return {
      name: 'queues',
      displayName: 'Cloudflare Queues (deep)',
      requiredEnv: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
      capabilities: ['queues', 'consumers'],
      sourceOfTruth: SOURCE,
    };
  }

  // ── Probe ─────────────────────────────────────────────────────────────────────

  protected async probe(): Promise<void> {
    const token = this.creds.value('CLOUDFLARE_API_TOKEN');
    const accountId = this.creds.value('CLOUDFLARE_ACCOUNT_ID');
    const raw = await this.http.get(
      `${CF_API}/accounts/${encodeURIComponent(accountId ?? '')}/queues`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const parsed = QueuesProbeSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error('Cloudflare Queues list: unexpected response shape — token or account may be invalid');
    }
    if (!parsed.data.success) {
      throw new Error('Cloudflare Queues list: success=false — token or account may be invalid');
    }
  }

  // ── Gather ────────────────────────────────────────────────────────────────────

  protected async gather(): Promise<GatherResult> {
    const token = this.creds.value('CLOUDFLARE_API_TOKEN');
    const accountId = this.creds.value('CLOUDFLARE_ACCOUNT_ID');
    const headers = { Authorization: `Bearer ${token}` };
    const ev: Evidence[] = [];

    // ── Queue list ────────────────────────────────────────────────────────────
    const queuesRaw = await this.http.get(
      `${CF_API}/accounts/${encodeURIComponent(accountId ?? '')}/queues`,
      { headers },
    );
    const queuesParsed = QueuesListSchema.safeParse(queuesRaw);
    if (!queuesParsed.success) {
      throw new Error(
        `Cloudflare Queues list: invalid response shape — ${queuesParsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }
    const queueItems = queuesParsed.data.result ?? [];
    ev.push(
      EvidenceBuilder.observed(
        'queues.list',
        `${queueItems.length} queue(s) observed — page 1 only; full inventory NOT CONNECTED if paginated`,
        SOURCE,
      ),
    );
    ev.push(
      EvidenceBuilder.observed(
        'queues.backlog',
        'Backlog depth / message count NOT CONNECTED — requires Cloudflare Analytics Engine GraphQL POST API (separate credential, not a GET endpoint)',
        SOURCE,
      ),
    );

    // ── Per-queue consumer fetch ───────────────────────────────────────────────
    const deepQueues: DeepQueue[] = [];
    for (const q of queueItems) {
      let consumers: readonly QueueConsumer[] = [];
      let consumersResolved = false;
      try {
        const consumersRaw = await this.http.get(
          `${CF_API}/accounts/${encodeURIComponent(accountId ?? '')}/queues/${encodeURIComponent(q.queue_id)}/consumers`,
          { headers },
        );
        const consumersParsed = ConsumersListSchema.safeParse(consumersRaw);
        if (consumersParsed.success) {
          consumers = consumersParsed.data.result ?? [];
          consumersResolved = true;
          ev.push(
            EvidenceBuilder.observed(
              `queues.consumers.${q.queue_name}`,
              `${consumers.length} consumer(s) on queue "${q.queue_name}"`,
              SOURCE,
            ),
          );
        } else {
          ev.push(
            EvidenceBuilder.observed(
              `queues.consumers.${q.queue_name}`,
              `consumers parse error for queue "${q.queue_name}" — consumers NOT CONNECTED`,
              SOURCE,
            ),
          );
        }
      } catch {
        // Consumer fetch failure for one queue must not abort the whole gather.
        ev.push(
          EvidenceBuilder.observed(
            `queues.consumers.${q.queue_name}`,
            `consumers fetch failed for queue "${q.queue_name}" — NOT CONNECTED`,
            SOURCE,
          ),
        );
      }
      deepQueues.push({
        queue_id: q.queue_id,
        queue_name: q.queue_name,
        created_on: q.created_on,
        producers_total: q.producers_total,
        consumers_total: q.consumers_total,
        consumers,
        consumersResolved,
      });
    }

    // ── Normalise facts ────────────────────────────────────────────────────────
    const facts: LiveFact[] = [];

    for (const dq of deepQueues) {
      // queue-deep fact: one per queue; distinct from CloudflareAdapter's 'queues' list-level fact
      facts.push({
        adapter: 'queues',
        kind: 'queue-deep',
        subject: dq.queue_name,
        detail: [
          `Cloudflare Queue "${dq.queue_name}" (id=${dq.queue_id})`,
          dq.producers_total !== undefined ? `producers=${dq.producers_total}` : null,
          dq.consumers_total !== undefined ? `consumers_total=${dq.consumers_total}` : null,
          `consumers_resolved=${dq.consumersResolved}`,
          'backlog=NOT CONNECTED (Analytics Engine GraphQL required)',
        ]
          .filter(Boolean)
          .join(', '),
        at: dq.created_on ?? null,
        evidence: [
          EvidenceBuilder.observed(
            `queues.queue.${dq.queue_name}`,
            `id=${dq.queue_id} consumers=${dq.consumers.length}`,
            SOURCE,
          ),
        ],
      });

      // queue-consumer facts: one per consumer binding
      for (const consumer of dq.consumers) {
        const scriptLabel = consumer.script_name ?? 'unknown-script';
        facts.push({
          adapter: 'queues',
          kind: 'queue-consumer',
          subject: `${dq.queue_name}/${scriptLabel}`,
          detail: `Consumer "${scriptLabel}" (type=${consumer.type ?? 'unknown'}) on queue "${dq.queue_name}"`,
          at: consumer.created_on ?? null,
          evidence: [
            EvidenceBuilder.observed(
              `queues.consumer.${dq.queue_name}.${scriptLabel}`,
              `queue=${dq.queue_name} script=${scriptLabel} type=${consumer.type ?? 'unknown'}`,
              SOURCE,
            ),
          ],
        });
      }
    }

    const payload: QueuesPayload = { queues: deepQueues, facts };

    return {
      payload,
      evidence: ev,
      // 0.88: page 1 only; consumer fetch may partially fail for individual queues
      confidence: 0.88,
    };
  }

  // ── Checks ────────────────────────────────────────────────────────────────────

  protected async checks(payload: unknown): Promise<readonly VerificationFinding[]> {
    const p = payload as QueuesPayload;
    const findings: VerificationFinding[] = [];

    // ── queue-no-consumer (high): queue has zero successfully resolved consumers ─
    for (const dq of p.queues) {
      // We only flag queues whose consumers were successfully fetched and came back empty.
      // A fetch failure (consumersResolved=false) means we cannot make an assertion.
      if (dq.consumersResolved && dq.consumers.length === 0) {
        findings.push({
          kind: 'queue-no-consumer',
          severity: 'high',
          subject: dq.queue_name,
          detail: `Queue "${dq.queue_name}" (id=${dq.queue_id}) has no consumer bindings. Messages published to this queue will accumulate and be unprocessed — potential data loss or silent backlog growth.`,
          evidence: [
            EvidenceBuilder.observed(
              `queues.queue.${dq.queue_name}`,
              `id=${dq.queue_id} consumers=0 consumersResolved=true`,
              SOURCE,
            ),
          ],
        });
      }
    }

    // ── queues-inventory (info): summary of observed queues ───────────────────
    if (p.queues.length > 0) {
      const totalConsumers = p.queues.reduce((sum, q) => sum + q.consumers.length, 0);
      const unresolvedCount = p.queues.filter((q) => !q.consumersResolved).length;
      findings.push({
        kind: 'queues-inventory',
        severity: 'info',
        subject: 'cloudflare-queues',
        detail: [
          `${p.queues.length} Cloudflare Queue(s) observed: ${p.queues.map((q) => q.queue_name).join(', ')}.`,
          `Total consumer bindings resolved: ${totalConsumers}.`,
          unresolvedCount > 0
            ? `Consumer resolution failed for ${unresolvedCount} queue(s) — consumers NOT CONNECTED for those queues.`
            : null,
          'Backlog depth NOT CONNECTED — requires Cloudflare Analytics Engine GraphQL POST API.',
        ]
          .filter(Boolean)
          .join(' '),
        evidence: [
          EvidenceBuilder.observed(
            'queues.inventory',
            `${p.queues.length} queue(s) ${totalConsumers} consumer(s)`,
            SOURCE,
          ),
        ],
      });
    }

    return findings;
  }

  protected snapshotTtlMs(): number {
    return 90_000; // 90 s — queue topology changes infrequently
  }
}
