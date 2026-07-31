/**
 * StorageAdapter — READ-ONLY observer of Cloudflare R2 object storage.
 *
 * DISTINCT FROM the existing Cloudflare adapter's 'r2' capability (which reports
 * inventory-level presence of the R2 product). This adapter provides PER-BUCKET
 * detail: names, creation dates, location hints, and per-bucket existence checks
 * across the account's R2 namespace.
 *
 * Reads:
 *   - Bucket list:  GET /accounts/{acct}/r2/buckets
 *   - Per-bucket:   GET /accounts/{acct}/r2/buckets/{name}  (best-effort; failure absorbed)
 *
 * Honesty contract:
 *   - Credentials absent → NOT_CONNECTED; names CLOUDFLARE_API_TOKEN and
 *     CLOUDFLARE_ACCOUNT_ID as the two missing vars.
 *   - Object counts / sizes / bandwidth: NOT CONNECTED — R2 usage metrics require
 *     the GraphQL Analytics API (POST-only; not reachable via the read-only GET client).
 *   - Per-bucket detail failure for any individual bucket is absorbed with honest evidence;
 *     the gather does NOT fail the whole snapshot for a single bucket error.
 *   - Confidence capped at 0.85 (bucket detail is page-1 only; per-bucket failures reduce
 *     observed surface).
 *
 * Uses the injected ReadOnlyHttpClient (GET only). No mutation is possible.
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
  R2BucketDetailResponseSchema,
  R2BucketListResponseSchema,
  type R2BucketEntry,
  type StoragePayload,
} from './types';

const CF_API = 'https://api.cloudflare.com/client/v4';
const SOURCE = 'Cloudflare R2';
const ADAPTER_NAME = 'storage';

/** Extract buckets array from either response shape (object-with-buckets or raw array). */
function extractBuckets(
  result: { buckets: Array<{ name: string; creation_date?: string; location?: string }> } | Array<{ name: string; creation_date?: string; location?: string }>,
): Array<{ name: string; creation_date?: string; location?: string }> {
  if (Array.isArray(result)) return result;
  return result.buckets;
}

export class StorageAdapter extends AdapterBase {
  constructor(deps: AdapterDeps) {
    super(deps);
  }

  metadata(): AdapterMetadata {
    return {
      name: ADAPTER_NAME,
      displayName: 'Object Storage (Cloudflare R2)',
      requiredEnv: ['CLOUDFLARE_API_TOKEN', 'CLOUDFLARE_ACCOUNT_ID'],
      capabilities: ['buckets', 'bucket-detail'],
      sourceOfTruth: SOURCE,
    };
  }

  // ── Probe ─────────────────────────────────────────────────────────────────────

  protected async probe(): Promise<void> {
    const token = this.creds.value('CLOUDFLARE_API_TOKEN');
    const acct = this.creds.value('CLOUDFLARE_ACCOUNT_ID');
    const raw = await this.http.get(`${CF_API}/accounts/${encodeURIComponent(acct!)}/r2/buckets`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });
    const parsed = R2BucketListResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Cloudflare R2 /r2/buckets: unexpected response shape — ${parsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }
    if (!parsed.data.success) {
      const firstError = parsed.data.errors?.[0]?.message ?? 'unknown error';
      throw new Error(`Cloudflare R2 /r2/buckets returned success=false: ${firstError}`);
    }
  }

  // ── Gather ────────────────────────────────────────────────────────────────────

  protected async gather(): Promise<GatherResult> {
    const token = this.creds.value('CLOUDFLARE_API_TOKEN');
    const acct = this.creds.value('CLOUDFLARE_ACCOUNT_ID');
    const headers = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
    const ev: Evidence[] = [];

    // ── Bucket list ──────────────────────────────────────────────────────────
    const listRaw = await this.http.get(
      `${CF_API}/accounts/${encodeURIComponent(acct!)}/r2/buckets`,
      { headers },
    );
    const listParsed = R2BucketListResponseSchema.safeParse(listRaw);
    if (!listParsed.success) {
      throw new Error(
        `Cloudflare R2 /r2/buckets: invalid response shape — ${listParsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }
    if (!listParsed.data.success) {
      const firstError = listParsed.data.errors?.[0]?.message ?? 'unknown error';
      throw new Error(`Cloudflare R2 /r2/buckets returned success=false: ${firstError}`);
    }

    const rawBuckets = extractBuckets(listParsed.data.result);
    ev.push(
      EvidenceBuilder.observed(
        'r2.buckets',
        `${rawBuckets.length} bucket(s) observed — page 1 only; full history NOT CONNECTED (paginated API)`,
        SOURCE,
      ),
    );

    // ── Per-bucket detail (best-effort) ──────────────────────────────────────
    const buckets: R2BucketEntry[] = [];
    for (const b of rawBuckets) {
      let detailFetched = false;
      let location: string | null = b.location ?? null;
      let creationDate: string | null = b.creation_date ?? null;

      try {
        const detailRaw = await this.http.get(
          `${CF_API}/accounts/${encodeURIComponent(acct!)}/r2/buckets/${encodeURIComponent(b.name)}`,
          { headers },
        );
        const detailParsed = R2BucketDetailResponseSchema.safeParse(detailRaw);
        if (detailParsed.success && detailParsed.data.success) {
          const d = detailParsed.data.result;
          location = d.location ?? location;
          creationDate = d.creation_date ?? creationDate;
          detailFetched = true;
          ev.push(
            EvidenceBuilder.observed(
              `r2.bucket.${b.name}`,
              `detail ok — location=${location ?? 'NOT CONNECTED (not returned)'} created=${creationDate ?? 'unknown'}`,
              SOURCE,
            ),
          );
        } else if (detailParsed.success) {
          // success=false from the API
          const firstError = detailParsed.data.errors?.[0]?.message ?? 'unknown error';
          ev.push(
            EvidenceBuilder.observed(
              `r2.bucket.${b.name}`,
              `detail returned success=false: ${firstError} — using list-level data`,
              SOURCE,
            ),
          );
        } else {
          // Zod parse failed
          ev.push(
            EvidenceBuilder.observed(
              `r2.bucket.${b.name}`,
              `detail response shape mismatch — ${detailParsed.error.issues[0]?.message ?? 'parse error'} — using list-level data`,
              SOURCE,
            ),
          );
        }
      } catch (err) {
        // Per-bucket fetch failure is absorbed; the whole gather must not fail
        const msg = err instanceof Error ? err.message : String(err);
        ev.push(
          EvidenceBuilder.observed(
            `r2.bucket.${b.name}`,
            `detail fetch failed: ${msg} — NOT CONNECTED for this bucket's detail`,
            SOURCE,
          ),
        );
      }

      buckets.push({ name: b.name, creationDate, location, detailFetched });
    }

    ev.push(
      EvidenceBuilder.observed(
        'r2.object-counts',
        'Object counts/sizes: NOT CONNECTED — R2 usage metrics require GraphQL Analytics API (POST-only; not available via read-only GET adapter)',
        SOURCE,
      ),
    );

    // ── Normalise LiveFacts ───────────────────────────────────────────────────
    const facts: LiveFact[] = [];
    for (const b of buckets) {
      facts.push({
        adapter: ADAPTER_NAME,
        kind: 'r2-bucket',
        subject: b.name,
        detail: [
          `R2 bucket "${b.name}"`,
          b.location ? `location=${b.location}` : 'location=NOT CONNECTED (not returned by API)',
          b.creationDate ? `created=${b.creationDate}` : 'created=unknown',
          `detail-fetched=${b.detailFetched}`,
          'object-count=NOT CONNECTED (requires GraphQL Analytics — POST-only)',
        ].join(' '),
        at: b.creationDate ?? null,
        evidence: [
          EvidenceBuilder.observed(
            `r2.bucket.${b.name}`,
            `location=${b.location ?? 'unknown'} created=${b.creationDate ?? 'unknown'}`,
            SOURCE,
          ),
        ],
      });
    }

    const payload: StoragePayload = { buckets, bucketCount: buckets.length, facts };

    return {
      payload,
      evidence: ev,
      // 0.85: bucket list is paginated (first page only); per-bucket detail may be
      // partially unavailable; object counts are structurally NOT CONNECTED.
      confidence: 0.85,
    };
  }

  // ── Checks ────────────────────────────────────────────────────────────────────

  protected async checks(payload: unknown): Promise<readonly VerificationFinding[]> {
    const p = payload as StoragePayload;
    const findings: VerificationFinding[] = [];

    // ── bucket-unlocated: buckets with no location hint (info) ───────────────
    const unlocated = p.buckets.filter((b) => b.location === null || b.location === undefined || b.location === '');
    for (const b of unlocated) {
      findings.push({
        kind: 'bucket-unlocated',
        severity: 'info',
        subject: b.name,
        detail: `R2 bucket "${b.name}" has no location hint. The API did not return a location for this bucket — it may use the default global routing or the field was not included in the response.`,
        evidence: [
          EvidenceBuilder.observed(
            `r2.bucket.${b.name}`,
            'location=NOT CONNECTED (not returned by API)',
            SOURCE,
          ),
        ],
      });
    }

    // ── storage-inventory: summary of observed buckets (info) ────────────────
    if (p.buckets.length > 0) {
      const located = p.buckets.filter((b) => b.location !== null && b.location !== undefined && b.location !== '');
      findings.push({
        kind: 'storage-inventory',
        severity: 'info',
        subject: 'r2-buckets',
        detail: [
          `${p.bucketCount} R2 bucket(s) observed.`,
          `${located.length} with location hint, ${unlocated.length} without.`,
          'Object counts/sizes: NOT CONNECTED (R2 usage metrics require GraphQL Analytics — POST-only).',
        ].join(' '),
        evidence: [
          EvidenceBuilder.observed(
            'r2.buckets',
            `${p.bucketCount} bucket(s) — page 1 only`,
            SOURCE,
          ),
        ],
      });
    }

    return findings;
  }

  protected snapshotTtlMs(): number {
    return 120_000; // 2 min — bucket topology changes infrequently
  }
}
