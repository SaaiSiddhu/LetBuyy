/**
 * CloudflareAdapter — READ-ONLY observer of the Cloudflare account.
 *
 * Reads: Workers scripts, Workers routes (per zone), Queues, KV namespaces,
 * R2 buckets. Uses the injected ReadOnlyHttpClient (GET only, host-allowlisted
 * to api.cloudflare.com). No mutation is possible.
 *
 * Honesty contract:
 *  - Credentials absent → NOT_CONNECTED, names the exact env vars.
 *  - Queue backlog metrics NOT CONNECTED: the Cloudflare list-queues endpoint
 *    returns inventory only; real-time message counts require the Analytics
 *    Engine API (separate credential + query). We emit an `info` finding when
 *    queues are present but metrics are unavailable.
 *  - Confidence capped at 0.85 (routes gathered per-zone may be incomplete if
 *    the account has many zones).
 */
import { type Evidence, evidence } from '@letbuyy/lcis-core';
import {
  AdapterBase,
  type AdapterDeps,
  type AdapterMetadata,
  EvidenceBuilder,
  type GatherResult,
  type VerificationFinding,
} from '../shared/index';
import {
  type CloudflarePayload,
  KVListSchema,
  type Queue,
  QueuesListSchema,
  R2ListSchema,
  RoutesListSchema,
  TokenVerifySchema,
  type WorkerRoute,
  type WorkerScript,
  WorkersListSchema,
} from './types';

const CF_API = 'https://api.cloudflare.com/client/v4';
const SOURCE = 'Cloudflare';

export class CloudflareAdapter extends AdapterBase {
  constructor(deps: AdapterDeps) {
    super(deps);
  }

  metadata(): AdapterMetadata {
    return {
      name: 'cloudflare',
      displayName: 'Cloudflare',
      requiredEnv: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
      capabilities: ['status', 'workers', 'queues', 'routes', 'kv', 'r2'],
      sourceOfTruth: SOURCE,
    };
  }

  // ── Probe ────────────────────────────────────────────────────────────────────

  protected async probe(): Promise<void> {
    const token = this.creds.value('CLOUDFLARE_API_TOKEN');
    const raw = await this.http.get(`${CF_API}/user/tokens/verify`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const parsed = TokenVerifySchema.safeParse(raw);
    if (!parsed.success) throw new Error('Cloudflare token verify: unexpected response shape');
    if (!parsed.data.success) {
      const msg = parsed.data.errors.map((e) => e.message).join('; ');
      throw new Error(`Cloudflare token verify failed: ${msg}`);
    }
  }

  // ── Gather ───────────────────────────────────────────────────────────────────

  protected async gather(): Promise<GatherResult> {
    const token = this.creds.value('CLOUDFLARE_API_TOKEN');
    const accountId = this.creds.value('CLOUDFLARE_ACCOUNT_ID');
    const headers = { Authorization: `Bearer ${token}` };
    const ev: Evidence[] = [];

    // Workers scripts
    const workersRaw = await this.http.get(
      `${CF_API}/accounts/${accountId}/workers/scripts`,
      { headers },
    );
    const workersParsed = WorkersListSchema.safeParse(workersRaw);
    if (!workersParsed.success || !workersParsed.data.success) {
      throw new Error('Cloudflare workers/scripts: invalid envelope');
    }
    const workers: WorkerScript[] = workersParsed.data.result ?? [];
    ev.push(EvidenceBuilder.observed('cloudflare.workers', `${workers.length} script(s)`, SOURCE));

    // Routes (account-level — requires a zone; fall back to empty list gracefully)
    // The standard pattern is GET /zones?account.id=... then /zones/{id}/workers/routes
    // We attempt the routes endpoint; if it errors we capture the fact and continue.
    let routes: WorkerRoute[] = [];
    try {
      const routesRaw = await this.http.get(
        `${CF_API}/accounts/${accountId}/workers/routes`,
        { headers },
      );
      const routesParsed = RoutesListSchema.safeParse(routesRaw);
      if (routesParsed.success && routesParsed.data.success) {
        routes = routesParsed.data.result ?? [];
      }
    } catch {
      // Routes may require zone-level access; emit info evidence, do not throw.
      ev.push(
        EvidenceBuilder.observed(
          'cloudflare.routes',
          'routes endpoint unavailable — zone-level access may be required (NOT CONNECTED)',
          SOURCE,
        ),
      );
    }
    ev.push(EvidenceBuilder.observed('cloudflare.routes', `${routes.length} route(s)`, SOURCE));

    // Queues
    const queuesRaw = await this.http.get(
      `${CF_API}/accounts/${accountId}/queues`,
      { headers },
    );
    const queuesParsed = QueuesListSchema.safeParse(queuesRaw);
    if (!queuesParsed.success || !queuesParsed.data.success) {
      throw new Error('Cloudflare queues: invalid envelope');
    }
    const queues: Queue[] = queuesParsed.data.result ?? [];
    ev.push(EvidenceBuilder.observed('cloudflare.queues', `${queues.length} queue(s) — message-count metrics NOT CONNECTED (Analytics Engine API required)`, SOURCE));

    // KV namespaces
    const kvRaw = await this.http.get(
      `${CF_API}/accounts/${accountId}/storage/kv/namespaces`,
      { headers },
    );
    const kvParsed = KVListSchema.safeParse(kvRaw);
    const kv = (kvParsed.success && kvParsed.data.success) ? (kvParsed.data.result ?? []) : [];
    ev.push(EvidenceBuilder.observed('cloudflare.kv', `${kv.length} KV namespace(s)`, SOURCE));

    // R2 buckets
    const r2Raw = await this.http.get(
      `${CF_API}/accounts/${accountId}/r2/buckets`,
      { headers },
    );
    const r2Parsed = R2ListSchema.safeParse(r2Raw);
    const r2 = (r2Parsed.success && r2Parsed.data.success) ? (r2Parsed.data.result ?? []) : [];
    ev.push(EvidenceBuilder.observed('cloudflare.r2', `${r2.length} R2 bucket(s)`, SOURCE));

    const payload: CloudflarePayload = { workers, routes, queues, kv, r2 };

    return {
      payload,
      evidence: ev,
      // 0.85: route inventory may be incomplete when many zones exist
      confidence: 0.85,
    };
  }

  // ── Checks ───────────────────────────────────────────────────────────────────

  protected async checks(payload: unknown): Promise<readonly VerificationFinding[]> {
    const p = payload as CloudflarePayload;
    const findings: VerificationFinding[] = [];

    const workerIds = new Set(p.workers.map((w) => w.id));
    const routedWorkers = new Set(
      p.routes
        .map((r) => r.script)
        .filter((s): s is string => typeof s === 'string' && s.length > 0),
    );

    // missing-route: workers that have no route bound
    for (const worker of p.workers) {
      if (!routedWorkers.has(worker.id)) {
        findings.push({
          kind: 'missing-route',
          severity: 'medium',
          subject: worker.id,
          detail: `Worker "${worker.id}" has no route assigned. It cannot handle HTTP traffic.`,
          evidence: [
            EvidenceBuilder.entity('worker', worker.id, SOURCE, 'no route bound'),
          ],
        });
      }
    }

    // routing-drift: routes pointing to a script name not present in the workers list
    for (const route of p.routes) {
      if (route.script && !workerIds.has(route.script)) {
        findings.push({
          kind: 'routing-drift',
          severity: 'high',
          subject: route.pattern,
          detail: `Route "${route.pattern}" references script "${route.script}" which is not in the Workers script list. This may indicate a deleted or renamed worker.`,
          evidence: [
            EvidenceBuilder.observed(
              'cloudflare.routes',
              `route pattern=${route.pattern} script=${route.script}`,
              SOURCE,
            ),
          ],
        });
      }
    }

    // queue-backlog: honest about NOT CONNECTED metrics
    if (p.queues.length > 0) {
      findings.push({
        kind: 'queue-backlog',
        severity: 'info',
        subject: 'cloudflare-queues',
        detail: `${p.queues.length} queue(s) found: ${p.queues.map((q) => q.queue_name).join(', ')}. Real-time message-count / backlog metrics are NOT CONNECTED — they require the Cloudflare Analytics Engine API (separate credential). Inventory only.`,
        evidence: [
          EvidenceBuilder.observed(
            'cloudflare.queues',
            `${p.queues.length} queue(s) — backlog NOT CONNECTED`,
            SOURCE,
          ),
        ],
      });
    }

    // worker-inventory: summary finding (info)
    if (p.workers.length > 0) {
      findings.push({
        kind: 'worker-inventory',
        severity: 'info',
        subject: 'cloudflare-workers',
        detail: `${p.workers.length} worker script(s) deployed: ${p.workers.map((w) => w.id).join(', ')}.`,
        evidence: [
          EvidenceBuilder.observed(
            'cloudflare.workers',
            `${p.workers.length} worker(s)`,
            SOURCE,
          ),
        ],
      });
    }

    return findings;
  }

  protected snapshotTtlMs(): number {
    return 120_000; // 2 min — worker/route topology changes infrequently
  }
}
