/**
 * RealtimeAdapter — READ-ONLY observer of Supabase Realtime health.
 *
 * Reads: /realtime/v1/api/health (apikey auth via SUPABASE_ANON_KEY).
 * Uses the injected ReadOnlyHttpClient (GET only). No mutation is possible.
 *
 * Honesty contract:
 *  - Credentials absent → NOT_CONNECTED; names SUPABASE_URL and SUPABASE_ANON_KEY.
 *  - The health endpoint returns either { status: string } or a bare string; both are tolerated.
 *  - Channel/connection counts: NOT CONNECTED — no GET metrics endpoint exists on the
 *    Supabase Realtime API without a separate management credential. This is stated
 *    explicitly in the payload and evidence, never mocked.
 *  - Confidence: 0.7 — health is structural only; live channel/subscription metrics absent.
 */
import {
  AdapterBase,
  type AdapterDeps,
  type AdapterMetadata,
  EvidenceBuilder,
  type GatherResult,
  type VerificationFinding,
} from '../shared/index';
import type { LiveFact } from '../shared/contracts';
import { RealtimeHealthSchema, type RealtimePayload } from './types';

const SOURCE = 'Supabase Realtime';

/** Known healthy status values (case-insensitive normalisation applied below). */
const HEALTHY_STATUSES = new Set(['ok', 'healthy', 'up']);

/** Extract a normalised lower-case status string from the health response. */
function extractStatus(raw: unknown): string | null {
  if (typeof raw === 'string') return raw.trim().toLowerCase();
  if (raw !== null && typeof raw === 'object' && 'status' in raw) {
    const s = (raw as Record<string, unknown>)['status'];
    if (typeof s === 'string') return s.trim().toLowerCase();
  }
  return null;
}

export class RealtimeAdapter extends AdapterBase {
  constructor(deps: AdapterDeps) {
    super(deps);
  }

  metadata(): AdapterMetadata {
    return {
      name: 'realtime',
      displayName: 'Supabase Realtime',
      requiredEnv: ['SUPABASE_URL', 'SUPABASE_ANON_KEY'],
      capabilities: ['health'],
      sourceOfTruth: SOURCE,
    };
  }

  // ── Probe ─────────────────────────────────────────────────────────────────────

  protected async probe(): Promise<void> {
    const base = this.creds.value('SUPABASE_URL');
    const apiKey = this.creds.value('SUPABASE_ANON_KEY');
    const raw = await this.http.get(`${base}/realtime/v1/api/health`, {
      headers: { apikey: apiKey ?? '' },
    });
    const parsed = RealtimeHealthSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Supabase Realtime health endpoint: unexpected response shape — ${parsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }
  }

  // ── Gather ────────────────────────────────────────────────────────────────────

  protected async gather(): Promise<GatherResult> {
    const base = this.creds.value('SUPABASE_URL');
    const apiKey = this.creds.value('SUPABASE_ANON_KEY');
    const now = this.now();

    const raw = await this.http.get(`${base}/realtime/v1/api/health`, {
      headers: { apikey: apiKey ?? '' },
    });

    const parsed = RealtimeHealthSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Supabase Realtime /realtime/v1/api/health: invalid response shape — ${parsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }

    const rawHealth = parsed.data;
    const parsedStatus = extractStatus(rawHealth);

    const ev = [
      EvidenceBuilder.observed(
        'realtime.health',
        parsedStatus !== null
          ? `status=${parsedStatus}`
          : 'health response received but no status field extracted',
        SOURCE,
      ),
      EvidenceBuilder.observed(
        'realtime.channel-counts',
        'NOT CONNECTED — no GET metrics endpoint available on Supabase Realtime API; channel/connection counts require a separate management credential',
        SOURCE,
      ),
    ];

    const facts: LiveFact[] = [
      {
        adapter: 'realtime',
        kind: 'realtime-health',
        subject: 'realtime',
        detail:
          parsedStatus !== null
            ? `Supabase Realtime health status=${parsedStatus}`
            : 'Supabase Realtime health endpoint reachable but status not parseable',
        at: now,
        evidence: [
          EvidenceBuilder.observed(
            'realtime.health',
            parsedStatus !== null ? `status=${parsedStatus}` : 'response shape ambiguous',
            SOURCE,
          ),
        ],
      },
    ];

    const payload: RealtimePayload = {
      parsedStatus,
      rawHealth,
      channelCountsNotConnected:
        'NOT CONNECTED — no GET metrics endpoint available on Supabase Realtime API',
      facts,
    };

    return {
      payload,
      evidence: ev,
      // 0.7: health structural only; channel/subscription metrics NOT CONNECTED.
      confidence: 0.7,
    };
  }

  // ── Checks ────────────────────────────────────────────────────────────────────

  protected async checks(payload: unknown): Promise<readonly VerificationFinding[]> {
    const p = payload as RealtimePayload;
    const findings: VerificationFinding[] = [];

    // ── realtime-unhealthy: status present but not in the known-healthy set ────
    if (p.parsedStatus !== null && !HEALTHY_STATUSES.has(p.parsedStatus)) {
      findings.push({
        kind: 'realtime-unhealthy',
        severity: 'high',
        subject: 'realtime',
        detail: `Supabase Realtime health returned status="${p.parsedStatus}" which is not in the expected healthy set (ok, healthy, up). Realtime subscriptions may be degraded.`,
        evidence: [
          EvidenceBuilder.observed(
            'realtime.health',
            `status=${p.parsedStatus}`,
            SOURCE,
          ),
        ],
      });
    }

    // ── realtime-inventory: info summary ──────────────────────────────────────
    findings.push({
      kind: 'realtime-inventory',
      severity: 'info',
      subject: 'realtime',
      detail: [
        `Supabase Realtime health observed: status=${p.parsedStatus ?? 'unknown'}.`,
        'Channel/connection counts: NOT CONNECTED — no GET metrics endpoint available on Supabase Realtime API.',
      ].join(' '),
      evidence: [
        EvidenceBuilder.observed(
          'realtime.health',
          p.parsedStatus !== null ? `status=${p.parsedStatus}` : 'status=unknown',
          SOURCE,
        ),
        EvidenceBuilder.observed(
          'realtime.channel-counts',
          'NOT CONNECTED — no GET metrics endpoint available on Supabase Realtime API',
          SOURCE,
        ),
      ],
    });

    return findings;
  }

  protected snapshotTtlMs(): number {
    return 30_000; // 30 s — health checks are lightweight and can be polled frequently
  }
}
