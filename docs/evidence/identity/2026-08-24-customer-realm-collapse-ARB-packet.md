# ARB Decision Packet — Collapse the Customer Realm onto the Sole Asymmetric Issuer

**This is a decision packet, not an implementation and not a certification.** It exists so an ARB
reviewer can approve, reject, or request more evidence for an identity-issuer change — per the
Constitution's "never decide alone" list (§11.2 / `AGENT-R15`), that decision is not this worker's
to make. Zero behaviour changed to produce this document; see the Confirmation section at the end
for the `git diff` proof.

**Baseline commit:** `2e4dc449` (HEAD at the start of this phase). Re-check `git log -1` before
relying on any `path:line` citation in this packet past that commit — this repository has
concurrent, actively-committing sessions.

**Supersedes nothing; extends Phase I1.** Phase I1 (`docs/evidence/production-readiness/
2026-08-24-readiness-evidence.md`, Dimension 3) proved the deviation and its current boundary with
an executable red-team suite. This packet answers the question Phase I1 deliberately left open: what
would closing it actually require, and should the ARB approve that work.

---

## Correction to this phase's own starting brief

Before any design section, two of the "verified current-state facts" this phase was handed turned
out to be incomplete once checked against the actual call sites, not just the ones named. Recording
both here because they materially change the shape of W2 and W3 below.

**1. There are six production issuance sites across two runtimes, not three in api-gateway alone.**

| Runtime | Site | Payload shape minted |
|---|---|---|
| `services/api-gateway` | `routes/storefront/customer-registration.ts:141` | primary — `{store_id, customer_id}` via `issueCustomerSession` |
| `services/api-gateway` | `routes/storefront/customer-engagement-routes.ts:610` | primary |
| `services/api-gateway` | `routes/storefront/customer-engagement-routes.ts:770` | primary |
| `apps/storefront-runtime` | `app/api/customer/login/route.ts:92` | **legacy** — `{sub, storeId, email, name}` via `createSession` → `createHostOnlyShopperIdentityProvider` → `createCustomerSessionToken` |
| `apps/storefront-runtime` | `app/api/customer/register/route.ts:91` | legacy |
| `apps/storefront-runtime` | `app/api/customer/set-password/route.ts:73` | legacy |

`apps/storefront-runtime/src/lib/session.ts` mints and verifies the customer session cookie
**locally, in a second runtime**, using only the legacy pair (`createHostOnlyShopperIdentityProvider`'s
`verifySessionToken` calls `verifyCustomerSessionToken` exclusively — never the primary
`verifyCustomerSession`). This is *why* `services/api-gateway/src/middleware/customer-session.ts:56`
(`verifyGatewayCustomerSession`) tries the primary verifier first and falls back to the legacy one
second: it must accept both a token it minted itself and a token storefront-runtime minted. **"Legacy"
is a misleading label for that second shape** — it is what every direct storefront login/registration/
password-set mints today, not a format on its way out. All three storefront-runtime call sites were
confirmed live (not dead code) by reading each route handler in full — each calls api-gateway's
`verifyCustomerPassword`/registration RPCs for credential checking (matching the gateway-proxy rule)
but then mints the session token **locally**, independently of api-gateway.

Consequence for W2/W3: the collapse target is not "extend api-gateway's existing shape and let
storefront-runtime keep using its fallback" — it must retarget **two runtimes that currently disagree
on payload shape**, onto one new asymmetric path.

**2. `services/api-gateway/src/identity-foundation/` is a 16-file scaffold that names a `customer`
realm but is not reachable by any real customer session — checked, not assumed.**

`realm-registry.ts:34-42` defines a `customer` `RealmConfig` entry, which could look like a partial
head start. Read the whole directory (1,665 lines) to find out: `mock-key-service.ts` signs with
`DEFAULT_MOCK_IDENTITY_ORIGIN = 'http://identity.localhost'` and key IDs literally prefixed
`sandbox-`; `migration-scaffold.ts`'s own types declare `dryRun: true` and `legacyUntouched: true` as
literal types; `shadow-compare.ts`/`token-shadow.ts` are comparison/hash-planning interfaces with no
caller. Grepped for what actually gets imported outside the module: only `feature-flags.ts` and
`auth-verifier-registry.ts`, both consumed solely by `middleware/auth.ts` for the **merchant**
realm's dormant-OIDC verifier branch (`FEATURE_OIDC_CLIENT`, tied to the already-tracked
`SKIP-CAP-OIDC-REVOCATION`). Nothing in `identity-foundation/` touches the customer session cookie.
**This is prior art for a dual-write/shadow-compare migration shape — genuinely useful pattern
inspiration for W3 — not a partially-built shortcut.** Its readiness, correctness, and test coverage
were not evaluated further; do not read its existence as reducing the size of the build in W2.

**Everything else in the prompt's stated facts was verified accurate as given**, including: the two
`IdentitySecretService.ts` line citations (confirmed inaccurate, see the LCIS Correction section
below — its "Consumers: ... merchant-control-plane customer auth" claim is *also* false: grepped
`apps/merchant-control-plane/src` for `CUSTOMER_SESSION_SECRET`/`LETBUYY_CUSTOMER_SESSION_COOKIE`/
`verifyCustomerSession`/`issueCustomerSession` and found zero matches); the two verification sites
(`middleware/customer-session.ts:58`/`:61`); `identity-platform` having no live customer-issuance
path (confirmed by reading `apps/identity-platform/src/lib/auth/cookies.ts:62` and finding no
`customer`-realm issuance function anywhere under `apps/identity-platform/src`, only the merchant
realm's real `identity-issued-session.ts`).

---

## W1 — Current-state map (full)

**Core implementation:** `packages/auth-core/src/customer-session.ts` (primary pair —
`issueCustomerSession:28`, `verifyCustomerSession:61`) and `packages/auth-core/src/index.ts`
(legacy pair — `createCustomerSessionToken:751`, `verifyCustomerSessionToken:772`; the
`createHostOnlyShopperIdentityProvider` factory at `:841` wraps the legacy pair only).

**Cookie:** `LETBUYY_CUSTOMER_SESSION_COOKIE = 'lb_customer_session'`
(`packages/auth-core/src/customer-session.ts:LETBUYY_CUSTOMER_SESSION_COOKIE`, re-exported from
`index.ts`). Set `httpOnly`, `secure` in production, `sameSite: 'lax'`, path `/`.

**TTLs — two different values for the same nominal cookie:**
- `LETBUYY_CUSTOMER_GATEWAY_SESSION_TTL_SECONDS = 30 * 60` (`customer-session.ts:4`) — governs the
  primary/api-gateway-minted shape.
- `LETBUYY_CUSTOMER_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60` (`index.ts:131`) — governs the
  legacy/storefront-runtime-minted shape, and is what `createHostOnlyShopperIdentityProvider`'s
  cookie contract (`index.ts:824-830`) actually sets as `maxAge` for every storefront-runtime login.

**Issuance:** the 6 sites in the correction table above.

**Verification:** `services/api-gateway/src/middleware/customer-session.ts:56`
(`verifyGatewayCustomerSession`, primary-then-legacy) and `apps/storefront-runtime/src/lib/session.ts:74`
(`getSession`, legacy-only, via `createHostOnlyShopperIdentityProvider`).

**Consumers of a verified session** (routes/pages that call `getCustomerSession`/`requireCustomerSession`
in api-gateway, or `getSession`/`requireSession` in storefront-runtime): storefront-runtime's
`/api/customer/{profile,addresses,orders,wishlist,wishlist/sync,session}` routes and
`lib/customer-drop.ts`, `lib/account-liquid.ts`; api-gateway's storefront-facing customer routes
(engagement, registration, and any route mounting `requireCustomerSession`/`optionalCustomerSession`
from `middleware/customer-session.ts`).

**Federation path (cross-domain SSO-style handoff, separate from direct login):**
`createCustomerFederationToken`/`redeemCustomerFederationToken`/`customerSubjectFromFederationPayload`
(`index.ts:864-960`), consumed by `apps/storefront-runtime/src/lib/session.ts:88`
(`createSessionFromFederationToken`) — this path mints a **short-lived (15 min,
`LETBUYY_CUSTOMER_FEDERATION_TTL_SECONDS`), single-redeem HS256 token**, then calls `createSession`
(legacy shape) to materialize the actual session. It is not a separate identity mechanism; it is a
front door onto the same legacy-shaped session, and Phase I1's `tests/auth/session-verifier.test.mjs`
already proves its mint-once/redeem-once behaviour (not re-proven here).

**Same secret, both shapes, both runtimes:** `CUSTOMER_SESSION_SECRET`, declared for every Next.js
app and for the Worker per the S1 (`a28d9f58`) precedent's own inventory of where
`CUSTOMER_SESSION_SECRET` is declared.

**`identity-platform`'s actual capability today** — the real, live merchant-realm template this
design mirrors: `apps/identity-platform/src/lib/auth/identity-issued-session.ts` —
`createIdentityIssuedMerchantSessionToken(userId, deviceId?)` reads `LETBUYY_IDENTITY_PRIVATE_JWK`
(a private JWK, JSON in an env var), signs with `jose`'s `SignJWT`, sets `realm: 'merchant'`,
`token_use: 'merchant_session'`, issuer/audience/subject/iat/exp/jti, TTL **30 days**
(`MERCHANT_SESSION_TTL_SECONDS = 30 * 24 * 60 * 60`, `identity-issued-session.ts:5` — this is the
real production TTL; Phase I1's red-team test fixtures used an arbitrary 300s TTL for test speed,
which should not be read as the production figure). The corresponding public key is **not** served
from a live `.well-known/jwks.json` at runtime — `LETBUYY_IDENTITY_PUBLIC_JWKS` is a static Worker
secret, provisioned at deploy time by `wrangler secret put` from the
`PRODUCTION_IDENTITY_PUBLIC_JWKS`/`STAGING_IDENTITY_PUBLIC_JWKS` GitHub Actions secrets
(`.github/workflows/production-deploy.yml:323`). Verification therefore has **no runtime network
dependency on identity-platform today** — only issuance does, and only for the merchant realm, only
from identity-platform's own process (self-issuance, no network hop).

**Validator awareness:** `scripts/validators/identity-sole-issuer-validator.mjs:12` already
allowlists `packages/auth-core/src/customer-session.ts` as a known HS256 deviation, gated on
carrying IDN-R2 drain telemetry before it can be removed from the allowlist
(`identity-sole-issuer-validator.mjs:86-96`) — the validator's shape already anticipates exactly
this kind of drain-then-delete change; it does not need a new mechanism, only a future edit to its
allowlist once the drain is proven (out of scope for this document to make).

### LCIS correction (recorded, not fixed — out of scope per this phase's explicit instruction)

`packages/lcis-security/src/identity/IdentitySecretService.ts:52` states: *"Customer session
tokens — HS256 symmetric HMAC. Issued by identity-platform via issueCustomerSession(). Consumers:
storefront-runtime, merchant-control-plane customer auth."* Both claims checked and found false:

- `issueCustomerSession` is defined in `packages/auth-core/src/customer-session.ts:28` and is
  called only from `services/api-gateway` (the 3 primary sites above) — never from
  `apps/identity-platform`, which has no import of it anywhere under `apps/identity-platform/src`.
- "merchant-control-plane customer auth" as a consumer: grepped
  `apps/merchant-control-plane/src` for `CUSTOMER_SESSION_SECRET`, `LETBUYY_CUSTOMER_SESSION_COOKIE`,
  `verifyCustomerSession`, and `issueCustomerSession` — zero matches. No coupling exists.

Anyone scoping work from this LCIS file's output starts from two false premises. **Left unfixed**,
per this phase's explicit exclusion — fixing an intelligence package is a behaviour-adjacent edit
out of scope for a zero-behaviour-change document.

---

## W2 — Target-state design

**What "customer realm on the sole asymmetric issuer" concretely means:** identity-platform gains a
new, analogous capability to `createIdentityIssuedMerchantSessionToken`, and every runtime that
currently mints a customer session locally instead calls identity-platform for one.

**New capability in `identity-platform`:** `createIdentityIssuedCustomerSessionToken(input: {
customerId: string; storeId: string; deviceId?: string | null })`, mirroring
`identity-issued-session.ts` exactly in mechanism (same `jose.SignJWT`, same
`LETBUYY_IDENTITY_PRIVATE_JWK` signing key material — **the same private key the merchant realm
already uses, or a dedicated one; see the open question in W7**), with a distinct token shape:

- `realm: 'customer'`, `token_use: 'customer_session'` (new claim values — must be distinct from
  `'merchant'`/`'merchant_session'` so `identity-session-verifier.ts`'s existing `realm !==
  'merchant' || token_use !== 'merchant_session'` check, and any new customer-side equivalent,
  continue to reject cross-realm presentation exactly as Phase I1's `IRT-2e`/`IRT-2f` proved for the
  merchant side).
- `sub`: customer id. A new claim, e.g. `store_id`, since the customer realm — unlike merchant — is
  scoped to a specific storefront, not just a user.
- `aud`: a new constant, e.g. `letbuyy:customer-session` (distinct from
  `letbuyy:merchant-session`).
- `iat`/`exp`/`jti`: same shape as the merchant token. **TTL is an open design question, not
  resolved here** — the two existing TTLs (30 min primary, 7 days legacy) disagree, and neither may
  be the right number for a bootstrap-token-into-something-else pattern (see below); the ARB or the
  implementing phase must pick one and say why.

**How api-gateway and storefront-runtime obtain it:** this is the biggest new cost and the one the
prompt's brief flagged correctly — **today, minting is a local, synchronous, zero-network-dependency
operation** (an HMAC computation in-process). After the collapse, both runtimes must call
identity-platform over the network to obtain a token, on every login/registration/password-set. This
is a **new network hop on the buyer login path that does not exist today**, in two runtimes, not
one. Candidate shapes, not chosen here:
- (a) A new `POST /api/auth/customer-session` route in `identity-platform`, called by api-gateway
  and storefront-runtime after they've independently verified credentials (mirroring how
  `POST /custom/sessions/create` already works for the merchant realm's bootstrap flow, gated the
  same way — `requireAccountsInternal`-equivalent — since this route would need to trust the
  caller's claim of "this customer id passed credential verification" without re-verifying a
  password itself).
- (b) Identity-platform owns *all* customer credential verification too, and issues the token as
  part of that flow — a substantially bigger change (moves `verifyCustomerPassword` logic, currently
  in api-gateway, into identity-platform) not recommended without a separate, narrower ARB item.

**How verification composes with the existing verify-only JWKS model:** cleanly — the merchant
realm's `LETBUYY_IDENTITY_PUBLIC_JWKS` static-secret verify-only pattern
(`identity-session-verifier.ts`) generalizes directly to a customer-realm verifier following the
same shape (`validateIdentityIssuedCustomerSessionToken`), reading the **same** `LETBUYY_IDENTITY_PUBLIC_JWKS`
if the same signing key is reused, or a second env var if a dedicated key is chosen (W7). No new
verify-only mechanism needs inventing — copy `identity-session-verifier.ts`'s shape.

**New secrets/keys named, not provisioned:** either (i) none — reuse
`LETBUYY_IDENTITY_PRIVATE_JWK`/`LETBUYY_IDENTITY_PUBLIC_JWKS` for both realms, distinguished only by
the `realm`/`token_use`/`aud` claims, or (ii) a dedicated `LETBUYY_IDENTITY_CUSTOMER_PRIVATE_JWK` /
`LETBUYY_IDENTITY_CUSTOMER_PUBLIC_JWKS` pair, mirroring how the `a28d9f58` precedent gave
`lb_accounts` its own secret rather than reusing `AUTH_SECRET`. **Not decided here — see W7.**

---

## W3 — Migration sequence (dual-read drain shape)

Modeled on `a28d9f58`'s shape — dedicated key + verify-only legacy fallback + observable drain
signal + re-issue-under-new-key-on-legacy-hit — with the three places the analogy breaks called out
at each step it matters.

**Step 1 — Build the issuer capability in identity-platform. Independently deployable; trivially
revertible (delete the new route/function; nothing else references it yet).**
Add `createIdentityIssuedCustomerSessionToken` and its route, plus JWKS publication if a dedicated
key is chosen. No caller wired yet. Signal it is safe to advance: the new endpoint's own tests pass
and manual/staging smoke shows a token mints and round-trips through a new
`validateIdentityIssuedCustomerSessionToken` verifier (built in the same step, unused elsewhere
yet).

**Step 2 — Build the new verify-only path in api-gateway and storefront-runtime, additive, called
nowhere yet.** `middleware/customer-session.ts` gains a third verification attempt (new-asymmetric →
primary-HS256 → legacy-HS256, in that order so a genuinely valid new token never falls through to a
weaker check). `apps/storefront-runtime/src/lib/session.ts`'s `getSession` gains the equivalent.
Independently revertible: delete the new branch. **Where the `lb_accounts` analogy holds:** this is
structurally identical to `decryptAccounts`'s dual-read shape. **Where it breaks #1:** `lb_accounts`
added ONE new branch to ONE verify function in ONE runtime; this step adds a new branch to **two**
verify functions in **two** runtimes that must stay behaviourally consistent with each other (today
they already disagree — this step is a chance to converge them, not diverge further).

**Step 3 — Switch issuance, one call site at a time, behind a flag. Independently revertible per
site (flip the flag back; the dual-read verifier from Step 2 still accepts the old shape).** Order
matters for blast radius: start with the lowest-traffic site (recommend `set-password`, typically a
rarer flow than `login`), not the highest. **Where the `lb_accounts` analogy breaks #2:** `lb_accounts`
had one issuance site to switch; this step has 6, across 2 runtimes, and unlike `lb_accounts` (a
pure crypto swap with the exact same call shape), each switch now makes a **live network call to
identity-platform** where none existed before — this step's advance signal must include p50/p99
latency and error-rate on that new call, not just correctness, because a slow or flaky
identity-platform now sits in the buyer login critical path for whichever sites have flipped.
**Where it breaks #3:** the two shapes have different TTLs (30 min vs 7 days) and different claim
sets (`store_id`/`customer_id` vs `sub`/`storeId`/`email`/`name`) — the new token's shape (W2) must
be chosen so that *every* current consumer of a verified session (which reads different fields
depending on which shape it expects) still gets what it needs; this was not fully re-verified
consumer-by-consumer in this packet (see W7).

**Step 4 — Drain window.** Bounded by the **longer** of the two current TTLs — 7 days
(`LETBUYY_CUSTOMER_SESSION_TTL_SECONDS`) — plus the cookie's own `maxAge`, so every already-issued
legacy-shaped cookie a buyer is still holding has naturally expired. Observable signal, mirroring
`a28d9f58`'s `verifiedWithLegacyKey` flag and structured log line exactly: both
`verifyCustomerSession` (primary) and `verifyCustomerSessionToken` (legacy) branches in the dual-read
verifier from Step 2 should emit a structured, redacted log line on every hit (`{ level: 'info',
service: ..., route: 'auth.customer-session', reason: 'legacy_hs256_verification', shape: 'primary'
| 'legacy' }`), and the drain is provably complete when zero of either fires for a full 7-day window.
This is the exact measurement `SKIP-IDN-CUSTOMER-SESSION-HS256-COLLAPSE` should be closed against —
it does not exist yet (recorded as new work in W9, not fabricated here).

**Step 5 — Delete the HS256 paths.** `issueCustomerSession`, `createCustomerSessionToken`,
`verifyCustomerSession`, `verifyCustomerSessionToken`, `createHostOnlyShopperIdentityProvider`, and
`CUSTOMER_SESSION_SECRET` itself, once Step 4's window is clean. Update
`identity-sole-issuer-validator.mjs`'s allowlist (remove the `customer-session.ts` entry) in the same
change, exactly as its own comment already anticipates. **This step is NOT independently revertible
in the simple sense** — see W4's point of no return.

---

## W4 — Rollback plan

- **Steps 1-2:** trivially revertible — delete the new, additive, unreferenced code. No data or
  cookie format was ever touched.
- **Step 3 (per site):** revertible by flipping the site's flag back to local minting. Any cookie
  already issued under the new shape during the flag's on-window remains valid, because Step 2's
  dual-read verifier still accepts it going forward too (three-way, not two-way, until Step 5) — so
  reverting Step 3 does not orphan any live session.
- **Step 4:** the drain window itself is observational, not a code change — nothing to revert beyond
  re-extending it if the signal isn't clean yet.
- **Step 5 — the point of no return.** Once `CUSTOMER_SESSION_SECRET` is deleted from the deploy
  workflows and `config/env/*` templates, and `issueCustomerSession`/`verifyCustomerSession` etc. are
  deleted from `packages/auth-core`, **any cookie still in the wild signed under the old HS256 key
  can no longer be verified by anything** — that buyer is logged out with no fallback, by design
  (this is the entire point of the drain window in Step 4 existing first). If Step 4's drain signal
  was wrong — undercounted, or measured against the wrong window — Step 5 is not revertible without
  re-adding the deleted verify-only code, which defeats the point of having deleted it. **The
  packet's explicit recommendation is that Step 5 requires its own, second, narrower sign-off after
  Step 4's evidence is in hand — not blanket-approved by this same ARB decision.**

---

## W5 — Blast radius

**Does any buyer get logged out?** Not during Steps 1-4 if executed correctly — every existing
session shape remains verifiable throughout the dual-read window. Only Step 5, and only if the drain
measurement was wrong, logs anyone out (see W4).

**Can an in-flight checkout lose its session?** The Constitution's cart-bound signed handoff and
`create_checkout_order`'s payment-method guard (migrations 201-204) are independent of which realm
issues the *customer identity* session — checkout's own session/cart binding is a separate mechanism
not touched by this design. Not re-verified in depth this phase; flagged as an assumption a
reviewer should confirm, not asserted as proven.

**What happens to `storefront-runtime` and `merchant-control-plane` customer auth?**
`storefront-runtime`: directly affected — it is one of the two runtimes with live issuance sites (3
of the 6) and must be migrated in Step 3, not just api-gateway.
`merchant-control-plane`: **no effect — confirmed zero coupling** (W1 correction). The prompt's own
brief implicitly assumed a coupling here that this packet did not find; recorded as a correction,
not silently dropped.

**What happens if identity-platform is unavailable during a buyer login after cutover?** This is the
single largest new failure mode this design introduces. **Today, api-gateway and storefront-runtime
mint sessions locally with zero external dependency** — a buyer can always log in as long as
api-gateway/storefront-runtime and the database (for credential lookup) are up. After the collapse,
issuance additionally requires identity-platform to be reachable and correctly signing. If it is
down: buyer login fails even though credentials were valid and the buyer-facing runtime is healthy.
This is a **new coupling between buyer-facing availability and a currently-separate runtime's
availability**, and the packet does not have a mitigation design for it (retry policy, circuit
breaker, or an explicit accepted-degradation statement) — that is real, unresolved design work,
recorded honestly in W7, not glossed over.

---

## W6 — IRT-4 and IRT-6 fix designs

### IRT-4 — no `jti` consumption on the `merchant_session` JWT

**Proposed change:** add a consumption store keyed by `jti`, checked-and-marked atomically on first
successful verification at the token's one call site
(`services/api-gateway/src/routes/auth.ts:1130`). Two storage options: (a) a new Postgres table
(`merchant_session_jti_consumptions` or similar, `jti PRIMARY KEY`, `expires_at`, cleaned up by TTL
or a periodic sweep — mirroring the shape `session_token_rotation_events` already uses for the
*opaque* merchant session's reuse detection); (b) a KV/Durable-Object-backed set with a TTL matching
the token's own 30-day expiry, cheaper on the request path but a new, different kind of storage
dependency for this specific check.

**Blast radius:** low — one call site, already behind `requireAccountsInternal`. Adding a
consumption check here cannot make anything MORE permissive; the only regression risk is a false
"already consumed" rejection for a legitimate retried request (e.g. a client retry after a timeout
where the first attempt actually succeeded) — worth a short grace/idempotency window rather than a
strict one-shot consume, given this endpoint's role in session bootstrap.

**Test:** extend `services/api-gateway/src/__tests__/identity-redteam.test.ts`'s own `IRT-4` case —
**note the explicit exclusion**: this phase must NOT modify that file; the fix, when implemented,
should flip `IRT-4`'s assertion from "documents the gap" to "proves the defense," which the phase
prompt that authorized Phase I1 already anticipated by design (the test comment explicitly frames
IRT-4 as documenting current behavior, not a defended property).

**Separability recommendation: YES, safely separable from the realm collapse.** This is a
narrow, additive, storage-backed check on an existing token type in an existing runtime — it changes
nothing about which realm issues what, or the sole-issuer model. **Recommend shipping this ahead of
and independently of the ARB's collapse decision**, as its own small, reviewable change.

### IRT-6 — legacy customer verifier accepts what the primary rejects

**Proposed change:** align `isCustomerSessionPayload` (`packages/auth-core/src/index.ts:1298-1310`,
the legacy path's payload validator) with `normalizeCustomerSessionId`'s guarantees
(`customer-session.ts:110-116`) — cap `sub`/`storeId` at 128 characters and reject
`[ -]` control characters, matching the primary verifier exactly.

**Blast radius:** low-to-moderate — this is a **behaviour change to a live, actively-minting path**
(storefront-runtime's login/register/set-password mint this exact shape today, per the W1
correction). If any current customer id or store id in production genuinely exceeds 128 characters
or contains a control character, tightening this check would newly reject an otherwise-valid
session for that customer — **not verified in this packet; a reviewer implementing this fix should
query production customer/store id lengths first**, the same discipline `a28d9f58` used before
touching `lb_accounts` (confirming zero non-identity-platform callers before changing behaviour).

**Test:** a new, narrowly-scoped test (not touching `identity-redteam.test.ts`) asserting the
legacy verifier now rejects the same oversized/control-character payload
`identity-redteam.test.ts`'s `IRT-6` case already proves it currently accepts — i.e., the new test
and the standing IRT-6 case should describe complementary before/after states of the same fact, not
conflict.

**Separability recommendation: YES, separable, but with one open question the implementer must
resolve first** (the production id-length audit above) — **not blocked on the ARB's realm-collapse
decision**, since it does not touch which realm issues the token, only how strictly an existing
verifier validates payload shape. Recommend shipping after the length audit, independently.

---

## W7 — What this packet does NOT establish

Recorded plainly, per the R1 evidence-doc discipline — an unmeasured item stated as unmeasured is a
successful outcome of this document, not a gap in it.

- **Whether the customer realm should share `LETBUYY_IDENTITY_PRIVATE_JWK` with the merchant realm
  or get a dedicated key.** Sharing is simpler to ship; a dedicated key gives cleaner blast-radius
  isolation if one realm's key is ever compromised (the `a28d9f58` precedent chose "dedicated" for
  exactly this reason when it de-shared `lb_accounts` from `AUTH_SECRET`). Not resolved here.
- **The new customer-session token's TTL.** Neither of the two current values (30 min, 7 days)
  was validated as correct for the new design; this needs its own reasoning about buyer session
  UX vs. exposure window, not inherited by default from either legacy number.
- **Whether every current consumer of a verified customer session reads only fields both current
  shapes already provide, or whether some consumer depends on a legacy-only field (`email`, `name`)
  that the primary shape's `{store_id, customer_id}` does not carry.** This packet did not
  enumerate every consumer's field usage; Step 3 of W3 flags this as unresolved.
- **A mitigation design for identity-platform unavailability during buyer login post-cutover**
  (W5's largest new failure mode). No retry/circuit-breaker/degraded-mode design exists in this
  packet.
- **Whether route option (a) or (b) in W2** (api-gateway/storefront-runtime call a new
  identity-platform endpoint after verifying credentials themselves, vs. identity-platform owning
  credential verification too) is the right shape. Recommended (a) as the narrower change; not
  chosen by ARB.
- **Whether `identity-foundation/`'s dead scaffold should be revived, deleted, or left alone.**
  Out of scope for this packet; flagged as a separate, smaller cleanup question worth its own
  decision, not bundled into this one.
- **Live production id-length distribution for the IRT-6 fix.** Not queried; the implementer must.
- **This packet was not reviewed by anyone but the worker that wrote it.** It is an input to the
  ARB process, not a substitute for it.

---

## W8 — Recommended decision (recommendation only — the ARB decides)

**Recommendation: approve the collapse in principle, phased exactly as W3 describes, with Step 5
(deletion) requiring a second, separate sign-off gated on Step 4's drain evidence — do not
pre-approve Step 5 today.** Reasoning: the deviation's boundary is proven safe under direct
adversarial test (Phase I1's `IRT-3`/`W3(b)`, which must keep passing throughout — see the Constraint
below), so this is not an urgent security fire; it is exactly the kind of measured, staged,
revertible-until-the-last-step change the Constitution's identity-issuer rule exists to force before
architecture drifts further from the sole-issuer invariant. The two corrected facts in this packet
(six issuance sites, not three; two disagreeing TTLs) mean the real cost is larger than the original
framing suggested — that is a reason to sequence it carefully, not a reason to defer it, since every
additional storefront-runtime login mints one more legacy-shaped, symmetric-secret-forgeable session
in the interim.

**IRT-4 and IRT-6: recommend shipping both as small, separate, standalone changes now**, ahead of
and independent of the ARB's decision on the realm collapse itself — neither touches the issuer
model, both are additive/tightening changes with their own narrow tests, and IRT-6 specifically
carries real (if bounded) exposure for every day it remains unfixed.

**Constraint that must survive any future implementation, stated explicitly for the record:**
`services/api-gateway/src/__tests__/identity-redteam.test.ts`'s `IRT-3`/`W3(b)` case is the standing
guard on this deviation's boundary. Any implementation phase must keep it passing throughout every
step of W3 — a forged customer-realm token must continue to fail the merchant verifier at every
point in the migration, including mid-drain when both old and new customer-token shapes are valid.

### The exact change that would flip this — NOT MADE

For a reviewer to see the diff shape without it existing: Step 1 would add
`apps/identity-platform/src/lib/auth/identity-issued-customer-session.ts`, near-identical to
`identity-issued-session.ts` but with `realm: 'customer'`/`token_use: 'customer_session'`/`aud:
'letbuyy:customer-session'`/`sub` as customer id/a new `store_id` claim, plus a new route calling
it. Step 2 would add one new verification branch to
`services/api-gateway/src/middleware/customer-session.ts:56` and to
`apps/storefront-runtime/src/lib/session.ts:74`, each trying the new asymmetric verifier before
falling through to the existing primary-then-legacy chain. **None of this exists in the working
tree as of this commit** — confirmed by the empty `git diff` below.

---

## Registry cross-references

- Reuses `SKIP-IDN-CUSTOMER-SESSION-HS256-COLLAPSE` (added Phase I1) as the row this packet's Step 4
  drain evidence would close.
- New rows added this phase for IRT-4 and IRT-6 (see `SKIPPED_HUMAN_DECISIONS.md`) — neither was
  previously covered under any existing row title *or* cited line numbers, cross-checked directly
  against `SKIP-IDN-R2-DRAIN-TELEMETRY` (covers the unrelated merchant/staff opaque
  gateway-session-mint drain) and `SKIP-CAP-OIDC-REVOCATION` (covers OIDC/partner SSO, not this).

---

## I5 ADDENDUM (2026-08-24) — adversarial verification pass, 34 commits after this packet's baseline.
## This section supersedes the citation line numbers below and records what has changed since. Everything
## above this line is the original packet, preserved unmodified — not overwritten, not rewritten in place.

**Baseline re-check:** written against `2e4dc449`. 34 commits have landed since (through `54c646c3` at
verification time); 3 touch identity: `acce0112` (Phase I4, IRT-6 fix) and `7caf9cf2` (Phase I3,
IRT-4 fix) both landed *after* this packet's own commit `c54cba22` — verified by both commit
timestamp (`c54cba22` 14:01:09, `7caf9cf2` 14:27:14, same day) and `git merge-base --is-ancestor`
(confirms `c54cba22` is the older commit). An earlier draft of this addendum stated the opposite —
that IRT-4 was already fixed when the packet was written — which was wrong and is corrected here,
not silently. Both closures are genuine drift that accumulated *after* the packet's baseline, exactly
as W8's own recommendation anticipated. The third identity-adjacent commit, `43a635f1` (Phase N3 W4),
is an unrelated GoTrue-allowlist edit to the same validator file this packet cites for a different
reason. A 4th commit, `806690ae` (a concurrent theme session, not identity work), incidentally
touched two of the six issuance-site files while fixing storefront routing — recorded below because
it moved two citations, not because it changed identity behaviour.

### 1. W6 is superseded — both designed fixes are now CLOSED, verified at source

- **IRT-4 (no `jti` consumption)** — CLOSED by migration `205_merchant_session_jti_consumption.sql`
  (Phase I3, `7caf9cf2`). Confirmed: the table exists, `services/api-gateway/src/routes/auth.ts` now
  calls a consumption check after `validateIdentityIssuedMerchantSessionToken` succeeds (the packet's
  own recommended Fork 1(b) shape). `SKIP-IDN-MERCHANT-SESSION-JTI-CONSUMPTION` reads **CLOSED,
  Phase I3** in `SKIPPED_HUMAN_DECISIONS.md:73`. Note for the record: `7caf9cf2` precedes this
  packet's own commit (`c54cba22`) in history — IRT-4 was *already fixed* when W6 was written
  designing a fix for it. That is a packet-authoring gap (W6 should have found this fixed and said
  so), not drift that accumulated afterward; recorded here because it means W6's IRT-4 section was
  never accurate, not that it became inaccurate.
- **IRT-6 (weak legacy predicate)** — CLOSED by Phase I4 (`acce0112`, after this packet). Confirmed:
  `packages/auth-core/src/index.ts`'s `isCustomerSessionPayload` now calls `normalizeCustomerSessionId`
  (exported from `customer-session.ts`) instead of the old bare `typeof === 'string' && length > 0`
  check — exactly the fix W6 proposed. `SKIP-IDN-CUSTOMER-LEGACY-VERIFIER-PAYLOAD-HARDENING` reads
  **CLOSED, Phase I4** in `SKIPPED_HUMAN_DECISIONS.md:74`. This one *is* drift that accumulated after
  the packet was written, exactly as W8's recommendation anticipated and asked for.
- Neither closure touches `SKIP-IDN-CUSTOMER-SESSION-HS256-COLLAPSE`, which remains open, unedited by
  this addendum, per the phase's explicit instruction.

### 2. Citation audit — every `path:line` in the packet, not a sample

30 distinct `path:line` citations found (the CTO spot-check that authorized this phase estimated 24;
this audit's count differs because it treats every distinct line number in the same file as its own
citation — e.g. `middleware/customer-session.ts:56`, `:58` and `:61` count as three, not one). **10 of
30 have drifted; 20 resolve exactly as written.** Every row below was checked directly against the
file at current `HEAD`, not inferred from a commit message.

| Citation as written | Resolves? | Accurate? | Current value |
|---|---|---|---|
| `routes/storefront/customer-registration.ts:141` | Y | Y | unchanged |
| `routes/storefront/customer-engagement-routes.ts:610` | Y | Y | unchanged |
| `routes/storefront/customer-engagement-routes.ts:770` | Y | Y | unchanged |
| `app/api/customer/login/route.ts:92` | **N** | — | `createSession(` now at **:108** (`806690ae` inserted a 16-line `accountRedirectUrl` routing helper above it) |
| `app/api/customer/register/route.ts:91` | **N** | — | `createSession(` now at **:110** (`806690ae` inserted a 19-line equivalent helper) |
| `app/api/customer/set-password/route.ts:73` | Y | Y | unchanged (file untouched since baseline) |
| `middleware/customer-session.ts:56` | Y | Y | unchanged (`verifyGatewayCustomerSession` signature) |
| `middleware/customer-session.ts:58` | Y | Y | unchanged (`verifyCustomerSession` call) |
| `middleware/customer-session.ts:61` | Y | Y | unchanged (`verifyCustomerSessionToken` call) |
| `identity-foundation/realm-registry.ts:34-42` | Y | Y | unchanged |
| `apps/identity-platform/src/lib/auth/cookies.ts:62` | Y | Y | unchanged |
| `packages/auth-core/src/customer-session.ts:4` | Y | Y | unchanged |
| `packages/auth-core/src/customer-session.ts:28` | Y | Y | unchanged |
| `packages/auth-core/src/customer-session.ts:61` | Y | Y | unchanged |
| `packages/auth-core/src/customer-session.ts:110-116` | Y | Y | unchanged in location; `acce0112` made the function `export` on the same line, no shift |
| `packages/auth-core/src/index.ts:751` (`createCustomerSessionToken`) | **N** | — | now **:752** (`acce0112` added one `import` line near the top) |
| `packages/auth-core/src/index.ts:772` (`verifyCustomerSessionToken`) | **N** | — | now **:773** |
| `packages/auth-core/src/index.ts:841` (`createHostOnlyShopperIdentityProvider`) | **N** | — | now **:842** |
| `packages/auth-core/src/index.ts:131` (`LETBUYY_CUSTOMER_SESSION_TTL_SECONDS`) | **N** | — | now **:132** |
| `packages/auth-core/src/index.ts:824-830` (`ShopperIdentityCookieContract`) | **N** | Y (content) | now **:825-831**, content unchanged |
| `packages/auth-core/src/index.ts:864-960` (federation functions) | **N** | Y (content) | now approx. **:865-961**, content unchanged |
| `packages/auth-core/src/index.ts:1298-1310` (`isCustomerSessionPayload`) | **N** | **N — substantively** | now starts **:1299**; the code AT this citation is the Phase I4-fixed version, not the weaker version the packet describes and W6 designs a fix for |
| `scripts/validators/identity-sole-issuer-validator.mjs:12` | Y | Y | unchanged |
| `scripts/validators/identity-sole-issuer-validator.mjs:86-96` | Y | Y | unchanged content (the file was edited by `43a635f1` earlier in the same file, for an unrelated GoTrue-allowlist reason; this specific range was unaffected — verified directly, not assumed) |
| `packages/lcis-security/src/identity/IdentitySecretService.ts:52` | Y | Y | unchanged — the LCIS inaccuracy the packet recorded is still present, still unfixed, exactly as the packet left it |
| `apps/identity-platform/src/lib/auth/identity-issued-session.ts:5` | Y | Y | unchanged |
| `.github/workflows/production-deploy.yml:323` | Y | Y | unchanged |
| `apps/storefront-runtime/src/lib/session.ts:74` (`getSession`) | Y | Y | unchanged (file untouched since baseline) |
| `apps/storefront-runtime/src/lib/session.ts:88` (`createSessionFromFederationToken`) | Y | Y | unchanged |
| `services/api-gateway/src/routes/auth.ts:1130` | **N** | **N — substantively** | the real `validateIdentityIssuedMerchantSessionToken(...)` call site is now **:1112**; `:1130` itself now falls inside the *new* jti-extraction code Phase I3 added to close IRT-4 — the exact fix this citation's surrounding W6 text describes as not yet built |

### 3. Load-bearing facts — all five re-verified at source, all five still hold

- **Six issuance sites across two runtimes.** Still six, still the same six files. Two of the three
  storefront-runtime sites (`login`, `register`) have drifted line citations (above); their `createSession`
  mechanism, payload shape, and runtime placement are unchanged. `set-password` is untouched.
- **`identity-platform` has no customer-realm issuance path.** Still true — no commit since baseline
  adds a `customer`-realm equivalent of `identity-issued-session.ts` anywhere under
  `apps/identity-platform/src`. The packet's "BUILD not wire-up" conclusion and its framing as the
  single biggest cost driver both stand.
- **Two TTLs (30 min primary / 7 days legacy).** Both values unchanged at source. The 7-day figure's
  citation (`index.ts:131`) drifted to `:132`; the value itself did not move.
- **Primary-then-legacy verifier fallback.** The *structure* `middleware/customer-session.ts` uses —
  try `verifyCustomerSession` (primary) first, fall back to `verifyCustomerSessionToken` (legacy) —
  is byte-for-byte unchanged (file untouched since baseline). What Phase I4 changed is what the legacy
  path's *internal* payload check accepts, not whether the fallback exists or how it's ordered. W3
  Step 2's design (a third, new-asymmetric branch tried before both) is unaffected by this — if
  anything, IRT-6's closure makes the two existing branches marginally more consistent with each
  other, which slightly reduces (does not increase) the risk W3 Step 2 was written to manage. Not a
  reason to alter the design; noted for the ARB's awareness only.
- **The `merchant_session` 30-day TTL.** Unchanged at `identity-issued-session.ts:5`, citation accurate.

**One fact worth flagging that is neither drift nor a load-bearing-fact failure:** W2 says the new
customer-session issuer should mirror `identity-issued-session.ts` "exactly in mechanism." That file
itself is unchanged since baseline (confirmed — zero commits touch it), so the claim is still literally
true. But IRT-4's fix (jti consumption) landed at the *call site* in `routes/auth.ts`, not inside
`identity-issued-session.ts` — the merchant-realm bootstrap flow this packet's design is templated on
is now more complete than the template file alone shows. An implementer building the customer-realm
equivalent should know the merchant pattern now includes route-layer jti consumption, not just token
issuance/verification. This is an observation for whoever implements W2/W3, not a redesign of them —
the packet's own text is left as written.

### 4. Does the recommendation still stand? Yes, unchanged in substance.

W8's core recommendation — approve the collapse in principle, phased per W3, with Step 5 (deleting
`CUSTOMER_SESSION_SECRET`) held for a second, separate sign-off — survives this pass with no premise
invalidated. `IRT-3`/`W3(b)`, the constraint W8 names as required to hold throughout any future
implementation, is confirmed **still passing (17/17, including both IRT-3/W3(b) cases)** at current
HEAD.

W8's *secondary* recommendation — "ship IRT-4 and IRT-6 as small, separate, standalone changes now" —
is no longer a recommendation to act on; it has been **acted on and completed**. Both shipped exactly
as separable, standalone changes, exactly as the packet predicted, with their own narrow tests, and
neither touched the issuer model or the realm-collapse design. This is confirmation the packet's own
separability judgment was correct, not a reason to revisit it.

No step in W3's five-step sequence has a premise that moved. The sequence is not rewritten here.

### 5. What this pass could NOT establish

- **Whether any commit besides the 3 identified (`acce0112`, `7caf9cf2`, `806690ae`) touches a file
  this packet reasons about but was not in the explicitly-checked path list** (`packages/auth-core`,
  `services/api-gateway/src/{middleware,lib,routes/storefront}`, `apps/identity-platform`,
  `apps/storefront-runtime/src/lib/session.ts`, the three customer route handlers, the two registry
  files, the LCIS file, the deploy workflow, and the validator). The 34-commit sweep was filtered to
  these paths via `git log -- <paths>`; a commit touching a packet-relevant fact through an unlisted
  path (for example, a new caller of `issueCustomerSession` added somewhere not yet enumerated) would
  not have been caught by this method.
- **Whether `identity-foundation/`'s scaffold status changed.** Not re-checked this pass — the
  packet's original W1 correction #2 finding (16-file dead scaffold, no live customer-session path)
  was not re-verified at current HEAD; no commit in the 34-commit log touches
  `services/api-gateway/src/identity-foundation/`, which is weak evidence it is unchanged, not
  confirmation.
- **Live production id-length distribution for IRT-6.** Moot now — IRT-6 shipped, and its own W2
  value-source audit (Phase I4) established every live writer sources from `store_customers.id/store_id`
  (native `uuid` columns), closing the exact question this packet's W6 flagged as needing a production
  query. Recorded here because the packet's own W7 still lists it as an open item; this addendum does
  not edit W7, so the correction lives here instead.
- **Whether the concurrent theme session's routing changes (`806690ae`) have any OTHER effect on the
  customer-session mechanism beyond moving two citations.** Read both diffs in full; found only
  routing-helper insertions ahead of the unchanged `createSession()` calls. Did not read the full
  commit's other ~15 files (Liquid section templates, CSS, generator changes) — none are packet-relevant
  paths, so this is a scoping choice, not an unfindable gap.

### 6. An unrelated defect found during this audit — reported, not fixed

This is out of scope for the addendum's own subject (it is not identity drift), but it was found while
grep-auditing the citations above and the phase's own rule is to report rather than silently act, so it
is recorded here rather than dropped.

**The original document (committed at `c54cba22`, unchanged by this addendum) contains one literal NUL
byte and its neighbouring raw control-character bytes**, at the point in the original W6 section that
describes rejecting `[ -]` control characters — the actual bytes `\x00`–`\x1f`/`\x7f`
appear to have been typed literally into the Markdown instead of their escaped/printable representation.
Confirmed present in the git-committed original via `git show c54cba22:<path> | python3 -c
"...find(b'\x00')"` — not introduced by this addendum's edits, and not something this addendum edits or
removes, per the explicit instruction to leave the original content untouched. Effect: `file`(1)
classifies the document as `data` (binary) rather than text, and a plain `grep` (without `-a`) silently
returns zero matches instead of an error — which is what caused most of this audit's own citation greps
to need `-a` once discovered. `git diff`/`git show` render it as a normal text diff regardless (verified
— `161 insertions`, not `Binary files differ`), so this has not corrupted history or blocked review; it
is a latent trap for any other tool that uses a binary-detection heuristic before treating this file as
text. Not registered as a `SKIP-*` row — this addendum does not touch the registry beyond
`EXECUTION_LEDGER.md`, per the phase's own scope, and a one-file Markdown typo does not rise to that
threshold; recorded here so the fact is not lost.

### Confirmation

Zero code changed to produce this addendum. `git diff --numstat -- services apps packages` at
verification time showed only pre-existing, unrelated diffs from two concurrent sibling sessions
(an identity-platform theming refactor and a Liquid/theme-engine refactor) — none authored by this
phase. No `SKIP-*` row was closed, reopened, or re-rated. `identity-redteam.test.ts` was not modified
and was re-run clean: 17/17, `IRT-3`/`W3(b)` intact.
