/**
 * EmailAdapter — READ-ONLY observer of Resend sending domains.
 *
 * Reads: domain list (GET /domains) — id, name, status, region, created_at.
 * Uses the injected ReadOnlyHttpClient (GET only, host-allowlisted to api.resend.com).
 * No mutation is possible — the interface exposes only this.http.get(...).
 *
 * Honesty contract:
 *  - Credentials absent  → NOT_CONNECTED, names RESEND_API_KEY.
 *  - Delivery metrics, bounce rates, open rates, click rates: NOT CONNECTED.
 *    They require the Resend Statistics / Analytics endpoints which are either
 *    POST-based or require per-domain polling beyond the first page — stated in
 *    evidence rather than fabricated.
 *  - Confidence capped at 0.85 — domain list is observed from page 1 only;
 *    record/DNS propagation state is structural (no live probe of DNS servers).
 */
import type { Evidence } from '@letbuyy/lcis-core';
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
  type EmailPayload,
  type ResendDomain,
  ResendDomainsResponseSchema,
  ResendProbeResponseSchema,
} from './types';

const RESEND_API = 'https://api.resend.com';
const SOURCE = 'Resend';

export class EmailAdapter extends AdapterBase {
  constructor(deps: AdapterDeps) {
    super(deps);
  }

  metadata(): AdapterMetadata {
    return {
      name: 'email',
      displayName: 'Email (Resend)',
      requiredEnv: ['RESEND_API_KEY'],
      capabilities: ['domains', 'verification'],
      sourceOfTruth: SOURCE,
    };
  }

  // ── Probe ─────────────────────────────────────────────────────────────────────

  protected async probe(): Promise<void> {
    const key = this.creds.value('RESEND_API_KEY');
    const raw = await this.http.get(`${RESEND_API}/domains`, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const parsed = ResendProbeResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        'Resend /domains: unexpected response shape — API key may be invalid or response format changed',
      );
    }
  }

  // ── Gather ────────────────────────────────────────────────────────────────────

  protected async gather(): Promise<GatherResult> {
    const key = this.creds.value('RESEND_API_KEY');
    const headers = { Authorization: `Bearer ${key}` };
    const ev: Evidence[] = [];

    const raw = await this.http.get(`${RESEND_API}/domains`, { headers });
    const parsed = ResendDomainsResponseSchema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(
        `Resend /domains: invalid response shape — ${parsed.error.issues[0]?.message ?? 'parse error'}`,
      );
    }

    const domains: ResendDomain[] = parsed.data.data;
    ev.push(
      EvidenceBuilder.observed(
        'resend.domains',
        `${domains.length} sending domain(s) observed`,
        SOURCE,
      ),
    );
    ev.push(
      EvidenceBuilder.observed(
        'resend.delivery-metrics',
        'Delivery rates, bounce rates, open rates, click rates: NOT CONNECTED — ' +
          'requires Resend Statistics API (separate endpoint, not accessible with domain-list scope alone)',
        SOURCE,
      ),
    );

    // ── Normalise facts for CorrelationEngine ─────────────────────────────────
    const facts: LiveFact[] = [];

    for (const domain of domains) {
      const isVerified = domain.status === 'verified';
      facts.push({
        adapter: 'email',
        kind: 'email-domain',
        subject: domain.name,
        detail:
          `Resend sending domain "${domain.name}" status=${domain.status}` +
          (domain.region ? ` region=${domain.region}` : '') +
          (isVerified ? ' — verified and usable' : ' — NOT VERIFIED; emails cannot be sent from this domain'),
        at: domain.created_at != null ? domain.created_at : null,
        evidence: [
          EvidenceBuilder.observed(
            `resend.domain.${domain.name}`,
            `id=${domain.id} status=${domain.status}${domain.region ? ` region=${domain.region}` : ''}`,
            SOURCE,
          ),
        ],
      });
    }

    const payload: EmailPayload = { domains, facts };

    return {
      payload,
      evidence: ev,
      // 0.85: domain list is from page 1 only; DNS propagation state is structural,
      // not actively probed against live DNS resolvers.
      confidence: 0.85,
    };
  }

  // ── Checks ────────────────────────────────────────────────────────────────────

  protected async checks(payload: unknown): Promise<readonly VerificationFinding[]> {
    const p = payload as EmailPayload;
    const findings: VerificationFinding[] = [];

    // ── email-no-domains: no sending domains configured (medium) ─────────────
    if (p.domains.length === 0) {
      findings.push({
        kind: 'email-no-domains',
        severity: 'medium',
        subject: 'resend',
        detail:
          'No sending domains are configured in Resend. Transactional emails cannot be sent until at least one domain is added and verified.',
        evidence: [
          EvidenceBuilder.observed('resend.domains', '0 domains observed', SOURCE),
        ],
      });
    }

    // ── email-domain-unverified: any domain whose status is not 'verified' (high) ─
    for (const domain of p.domains) {
      if (domain.status !== 'verified') {
        findings.push({
          kind: 'email-domain-unverified',
          severity: 'high',
          subject: domain.name,
          detail:
            `Resend domain "${domain.name}" is in status "${domain.status}" — it is NOT VERIFIED. ` +
            'Emails sent from this domain will fail until DNS records are confirmed.',
          evidence: [
            EvidenceBuilder.observed(
              `resend.domain.${domain.name}`,
              `id=${domain.id} status=${domain.status}`,
              SOURCE,
            ),
          ],
        });
      }
    }

    // ── email-inventory: info summary of all domains ──────────────────────────
    if (p.domains.length > 0) {
      const verified = p.domains.filter((d) => d.status === 'verified');
      const unverified = p.domains.filter((d) => d.status !== 'verified');
      findings.push({
        kind: 'email-inventory',
        severity: 'info',
        subject: 'resend',
        detail:
          `${p.domains.length} Resend sending domain(s) observed: ` +
          `${verified.length} verified, ${unverified.length} unverified. ` +
          `Domains: ${p.domains.map((d) => `${d.name}(${d.status})`).join(', ')}. ` +
          'Delivery/bounce metrics: NOT CONNECTED — requires Resend Statistics API.',
        evidence: [
          EvidenceBuilder.observed(
            'resend.domains',
            `${p.domains.length} domain(s): ${p.domains.map((d) => d.name).join(', ')}`,
            SOURCE,
          ),
        ],
      });
    }

    return findings;
  }

  protected snapshotTtlMs(): number {
    return 300_000; // 5 min — domain verification status changes infrequently
  }
}
