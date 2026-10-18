/**
 * IdentitySecretService — LSAS identity & secret posture.
 *
 * Three deterministic, read-only surfaces:
 *
 *  secrets()          — one SecretPosture per distinct security-relevant env-var group from
 *                       SIGNAL_CATALOG. Deduped by sorted(requiredEnv).join(','), ordered by
 *                       the deduped key. present = creds.check(requiredEnv).present.
 *
 *  tokens()           — FIXED list of four identity/token-signature posture families.
 *                       Includes the legacy customer-session bridge and non-user HMAC signatures.
 *
 *  identitySurfaces() — FIXED structural list of auth surfaces. Live metrics always
 *                       NOT_CONNECTED with exact liveSource naming the ops service + env vars.
 *
 * READ-ONLY contract:
 *   - No fetch / exec / fs / DB / AI.
 *   - No Date.now() or new Date() — the only clock boundary is the injected now().
 *   - Recommendations are advisory:true and live at the facade layer, not here.
 *   - Services return plain typed arrays/objects — security() wraps are for the facade only.
 *   - Honesty: structural posture CONNECTED (key presence from CredentialProvider).
 *     Live auth/rate-limit metrics always NOT_CONNECTED + exact source.
 */
import { type LcisEngine, evidence, notConnected } from '@letbuyy/lcis-core';
import { CredentialProvider, SIGNAL_CATALOG } from '@letbuyy/lcis-adapters';
import { defaultNow } from '../shared/envelope';
import type { SecretPosture, TokenPosture, IdentitySurface } from '../shared/types';

// ── helpers ───────────────────────────────────────────────────────────────────

/** Stable dedup key: sorted env var list joined by comma. */
function envKey(envVars: readonly string[]): string {
  return [...envVars].sort().join(',');
}

// ── FIXED identity/token-signature posture definitions ──────────────────────

interface IssuerDef {
  readonly issuer: TokenPosture['issuer'];
  readonly algorithm: string;
  readonly requiredEnv: readonly string[];
  readonly detail: string;
}

const ISSUER_DEFS: readonly IssuerDef[] = [
  {
    issuer: 'customer-session',
    algorithm: 'HS256',
    requiredEnv: ['CUSTOMER_SESSION_SECRET'],
    detail:
      'Legacy store-customer session bridge — HS256 symmetric HMAC using CUSTOMER_SESSION_SECRET. ' +
      'Gateway and Commerce currently issue compatible store-scoped customer cookies; ' +
      'this is not the canonical identity-platform issuer. Treat as transitional until ' +
      'consumer migration and hosted usage observation are accepted.',
  },
  {
    issuer: 'identity-platform',
    algorithm: 'EdDSA (ES256 fallback)',
    requiredEnv: ['LETBUYY_IDENTITY_PUBLIC_JWKS'],
    detail:
      'Canonical identity-platform user sessions use asymmetric signing (EdDSA with ES256 fallback) ' +
      'for merchant, buyer, and storefront realms. LETBUYY_IDENTITY_PUBLIC_JWKS is a verifier key ' +
      'configuration, not proof of a live issuer key or hosted deployment.',
  },
  {
    issuer: 'step-up',
    algorithm: 'HMAC',
    requiredEnv: ['STEP_UP_SECRET'],
    detail:
      'Step-up HMAC tokens — guard refunds and payout operations. ' +
      'Issued on confirmed identity challenge; short-lived scoped claims. ' +
      'Consumers: api-gateway refund/payout routes (step-up gate).',
  },
  {
    issuer: 'queue-envelope',
    algorithm: 'HMAC',
    requiredEnv: ['QUEUE_TENANT_ENVELOPE_SECRET'],
    detail:
      'Queue tenant envelope signing — HMAC via signQueueTenantEnvelope(). ' +
      'Every queue job envelope is signed to prevent cross-tenant poisoning. ' +
      'Consumers: queue-workers, webhook-service job dispatch.',
  },
] as const;

// ── FIXED identity surface definitions ───────────────────────────────────────

interface SurfaceDef {
  readonly surface: string;
  readonly detail: string;
  readonly liveSource: string;
}

const SURFACE_DEFS: readonly SurfaceDef[] = [
  {
    surface: 'customer-login',
    detail:
      'Legacy store-customer email/password login issues an HS256 compatibility session. ' +
      'The canonical buyer sign-in is the identity-platform asymmetric flow; these are distinct paths. ' +
      'Protected by Turnstile bot gate and Upstash Redis rate-limit. ' +
      'Hosted traffic and live enforcement metrics are not connected here.',
    liveSource:
      'lcis-operations SecurityOperationsService (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)',
  },
  {
    surface: 'merchant-oauth',
    detail:
      'Canonical merchant identity sessions are issued by identity-platform using asymmetric signing ' +
      '(EdDSA with ES256 fallback). PKCE client flow; verifier configuration is not proof of hosted key presence.',
    liveSource:
      'lcis-operations SecurityOperationsService (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)',
  },
  {
    surface: 'step-up',
    detail:
      'Step-up challenge gate — HMAC-scoped short-lived token required before refund/payout RPCs. ' +
      'Issued on secondary identity confirmation; gates destructive money operations. ' +
      'Structural: STEP_UP_SECRET declared in api-gateway.',
    liveSource:
      'lcis-operations SecurityOperationsService (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)',
  },
  {
    surface: 'turnstile-gate',
    detail:
      'Cloudflare Turnstile bot-detection gate on customer registration and login routes. ' +
      'Challenges non-human clients before credential submission. ' +
      'Structural: TURNSTILE_SECRET_KEY declared on auth routes in identity-platform.',
    liveSource:
      'lcis-operations SecurityOperationsService (TURNSTILE_SECRET_KEY)',
  },
  {
    surface: 'rate-limit',
    detail:
      'Upstash Redis rate-limit on auth routes — per-IP request throttling on registration, ' +
      'login, and password-reset endpoints. Structural: UPSTASH_REDIS_REST_URL + ' +
      'UPSTASH_REDIS_REST_TOKEN declared in identity-platform.',
    liveSource:
      'lcis-operations SecurityOperationsService (UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN)',
  },
] as const;

// ── Service ───────────────────────────────────────────────────────────────────

export class IdentitySecretService {
  constructor(
    // core is held for compositional parity with all LSAS services (facade uses it)
    private readonly core: LcisEngine,
    private readonly now: () => string = defaultNow,
    private readonly creds: CredentialProvider = new CredentialProvider(),
  ) {}

  /**
   * One SecretPosture per distinct security-relevant env-var group from SIGNAL_CATALOG.
   * Groups are deduped by sorted(requiredEnv).join(',') and ordered deterministically by that key.
   * Empty/no-env entries (unreachable signals, db.query-stats etc.) are skipped — they carry no
   * security-relevant credential requirement.
   */
  secrets(): readonly SecretPosture[] {
    // Collect unique (envKey → first matching signal) entries
    const seen = new Map<string, { key: string; requiredEnv: readonly string[]; usedBy: string }>();

    for (const sig of SIGNAL_CATALOG) {
      if (sig.requiredEnv.length === 0) continue; // no credential requirement — skip
      const k = envKey(sig.requiredEnv);
      if (!seen.has(k)) {
        seen.set(k, {
          key: k,
          requiredEnv: sig.requiredEnv,
          usedBy: sig.key,
        });
      }
    }

    // Sort by the dedup key for determinism
    const entries = [...seen.values()].sort((a, b) => a.key.localeCompare(b.key));

    return entries.map((entry): SecretPosture => {
      const presence = this.creds.check(entry.requiredEnv);
      const connected = presence.present;
      return {
        key: entry.key,
        requiredEnv: [...entry.requiredEnv].sort(),
        present: connected,
        usedBy: entry.usedBy,
        connection: connected ? 'CONNECTED' : 'NOT_CONNECTED',
        evidence: connected
          ? entry.requiredEnv.map((v) =>
              evidence('artifact-field', v, `env var present — secret group for ${entry.usedBy}`, 'packages/lcis-adapters/src/catalog.ts'),
            )
          : entry.requiredEnv.map((v) =>
              notConnected(v, v),
            ),
      };
    });
  }

  /**
   * Fixed list of identity/token-signature posture families.
   * Step-up and queue-envelope entries are signatures, not user identity issuers.
   */
  tokens(): readonly TokenPosture[] {
    return ISSUER_DEFS.map((def): TokenPosture => {
      const presence = this.creds.check(def.requiredEnv);
      const connected = presence.present;
      return {
        issuer: def.issuer,
        algorithm: def.algorithm,
        requiredEnv: def.requiredEnv,
        present: connected,
        detail: def.detail,
        connection: connected ? 'CONNECTED' : 'NOT_CONNECTED',
        evidence: connected
          ? def.requiredEnv.map((v) =>
              evidence('artifact-field', v, `env var present — ${def.issuer} (${def.algorithm})`, 'CLAUDE.md'),
            )
          : def.requiredEnv.map((v) =>
              notConnected(v, v),
            ),
      };
    });
  }

  /**
   * FIXED structural list of identity surfaces.
   * Live metrics (failure rate, challenge pass rate) are always NOT_CONNECTED.
   * liveSource names the ops service and the exact env vars required to connect it.
   */
  identitySurfaces(): readonly IdentitySurface[] {
    return SURFACE_DEFS.map((def): IdentitySurface => ({
      surface: def.surface,
      detail: def.detail,
      connection: 'NOT_CONNECTED',
      liveSource: def.liveSource,
      evidence: [
        notConnected(def.surface, 'SUPABASE_URL'),
        notConnected(`${def.surface}-live-metrics`, 'SUPABASE_SERVICE_ROLE_KEY'),
      ],
    }));
  }
}
