# KEY ROTATION & CRYPTOGRAPHY (enhancement)
### 2026-06-09 · ANALYSIS-ONLY · enhancement-delta over `docs/auth/2026-06-08-identity-platform-transformation/KEY_MANAGEMENT_ARCHITECTURE.md`

> **Relationship to the corpus.** `KEY_MANAGEMENT_ARCHITECTURE.md` already decides ES256 for HSM custody (K-1), the root-KEK→per-realm-key hierarchy, the two custody patterns (KMS-as-signer vs envelope-keystore), per-realm JWKS, 90-day rotation with publish-ahead, the compromise runbook, and the symmetric-secret retirement map. **Strong; not rebuilt.** This document fills the five gaps that turn this from "good single-region key management" into "world-class": **multi-region residency + failover, JWKS offline-validation window + endpoint HA, KMS-outage degradation, per-tenant BYOK/CMEK, and client-secret/API-key rotation at population scale** — plus the dual-signing-window and grace-period mechanics the corpus states only abstractly.

---

## 1. Algorithm & rotation (reaffirm corpus)
ES256 per realm (K-1), 90-day scheduled rotation, publish-ahead → promote → retire → drain → remove. Emergency path and compromise runbook per corpus §4/§6. This doc does not change these.

## 2. Dual-signing window & grace periods (CLARIFY — make the mechanics precise)
The corpus says "overlap ≥ max token lifetime"; specify it:
- **Dual-publish:** the next `kid` is published in JWKS **before** it signs anything (verifiers learn it during their cache TTL).
- **Promote:** signing switches to the new `kid`; the old `kid` **remains in JWKS** (verify-only) for **`grace = max(access_TTL, refresh_TTL_if_AT-bound) + JWKS_cache_TTL + safety`** — concretely for merchant realm ≈ 8m + 24h + 1h ≈ **~25h** minimum; round to **48h** for safety.
- **Retire/remove:** after grace, drop the old `kid` from JWKS. Removing a `kid` is also the **emergency kill switch** (compromise → remove immediately, accept that tokens signed by it fail closed).
- **Token revocation impact:** because access tokens are short-lived and sessions are server-revocable (`SESSION_MANAGEMENT`), a key retirement never strands a long-lived token; the revoked-sid cache covers the gap.

## 3. Multi-region residency & failover (NEW — closes the SPOF, readiness C-1 at the key layer)
The corpus pins everything to `ap-south-1` → a regional KMS outage halts all signing. Design:
- **Add `region` to `signing_keys`** (the schema gap noted in `IDENTITY_DATA_MODEL §8`): keys are `(realm, region, kid)`.
- **Region-scoped key sets:** an India-resident merchant realm signs with an `ap-south-1` key; an EU customer realm (future) signs with an `eu-*` key (GDPR data-residency for the signing material + the PII it protects).
- **Active-active verify, region-pinned sign:** verifiers (gateways/Workers, in every region) hold **all** regions' public keys via a **multi-region JWKS** (union), so a token signed in region A verifies in region B. Signing is pinned to the principal's residency region.
- **Failover:** each realm has a **standby signing key in a second region** (published in JWKS, `state=standby`). On a primary-region KMS outage, signing **fails over to the standby region's key** (automated, alarmed) — issuance continues; verification is unaffected because the standby `kid` was already in JWKS. This is the key-layer answer to the IdP-HA blocker (C-1).

## 4. JWKS availability & offline-validation window (NEW — closes the readiness C-1 ask the corpus left to OPS)
The corpus has verifier cache + fetch-on-unknown-kid but no HA/offline story:
- **JWKS endpoint is served from cache/CDN** (it is public, immutable per `kid`), multi-region, with a stale-while-revalidate policy.
- **Offline-validation window:** verifiers retain the last-good JWKS for a defined window (e.g. **24h**) and **continue validating** if the JWKS endpoint is unreachable — so a JWKS outage during an active `kid` does **not** cause mass token rejection (the corpus's fetch-on-unknown-kid alone fails exactly here).
- **Unknown-kid safety:** fetch-on-unknown-kid remains, but is rate-limited + circuit-broken so a flood of bad `kid`s can't DDoS the JWKS endpoint.

## 5. KMS-outage degradation ladder (NEW)
Explicit, so it isn't improvised during an incident:
1. **Verify-only continues** always (public keys cached) — logins-in-progress and API calls keep working.
2. **New issuance** fails over to standby region (§3).
3. **If both regions' KMS down** (P1 custody): the realm using P2 envelope-keystore (merchant/customer) can still sign from in-memory DEK-unwrapped keys (degraded, alarmed); P1 admin realm **fails closed** (no admin login) — the correct trade (admin is the smallest, highest-value realm).
4. **Recovery:** re-wrap/re-sync per §6.

## 6. P2 envelope key distribution across instances (NEW)
The corpus's "unwrapped into memory at boot" doesn't address a multi-instance Hydra fleet:
- Each instance unwraps the **same** DEK-wrapped signing key at boot via KMS `Decrypt` (the DEK never persists unencrypted).
- **Rotation propagation:** a new `kid` is written wrapped to the keystore; instances poll/subscribe and unwrap the new key into memory **before** promote (coordinated by the `state` column: `pending`→`active`). No instance signs with a `kid` until all instances have it loaded (barrier on `state=active`).

## 7. Per-tenant BYOK / CMEK (NEW — enterprise requirement)
Keys are per-realm today; regulated enterprise/B2B customers often require customer-managed keys:
- **Optional per-org CMEK** for **data-at-rest envelope** (field encryption of that org's PII), referenced by `org.cmek_key_ref` → the org's own KMS key. (Token *signing* stays platform per-realm — relying parties can't verify per-tenant signing keys; only data-encryption is BYOK-able.)
- **Revocation = crypto-shred:** an enterprise revoking its CMEK renders its at-rest PII unreadable (a contractual exit guarantee). Audit anchors use the platform key, so the audit trail survives a tenant CMEK revocation.

## 8. Client-secret & API-key rotation at population scale (NEW — closes the matrix #27 gap)
`KEY_MANAGEMENT` covers signing keys only; at 100k merchants there are far more **client secrets / API keys**:
- **Hashed at rest** (`oauth_clients.client_secret_hash`, `site_api_clients.key_hash` — already exist); rotation = issue new, dual-accept window, revoke old.
- **Self-serve rotation** per merchant/app with a **dual-active grace** (old + new valid for a configurable window so integrations don't break), audited (`security.client_secret.rotated`).
- **Bulk/forced rotation** (on suspected provider compromise) is an admin operation with staggered execution + tenant notification — never a synchronous mass-revoke.

## 9. Audit-anchor key (CLARIFY)
The audit Merkle-anchor signing key (`AUDIT_ARCHITECTURE §2`) uses **P1 KMS-as-signer custody in a separate key set and separate region from the realm keys** (so a realm-key compromise can't forge audit anchors), rotated on its own cadence (annually, longer than token keys), with old anchor public keys retained indefinitely so historical anchors remain verifiable.
