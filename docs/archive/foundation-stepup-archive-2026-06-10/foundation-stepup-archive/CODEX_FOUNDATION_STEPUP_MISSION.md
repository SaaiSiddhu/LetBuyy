# CODEX — FOUNDATION STEP-UP MISSION (the execution bible)

**Version:** 1.0 · **Type:** EXECUTION (Codex writes code) · **Run mode:** ONE continuous mission, all waves in order, **do not stop for human approval** — gate-and-SKIP instead (§2).
**Single authority:** `LETBUYY_FOUNDATION_AUTHORITY/LETBUYY_SINGLE_SOURCE_OF_TRUTH.md`. This mission implements that document and nothing beyond it. Where any other doc disagrees, the SSOT wins.
**Governance:** obey `AGENTS.md` → local `AGENTS.md`. **Do NOT** build: OIDC provider, marketplace, reseller, AI, extensions/app-store, analytics-pipeline, event-bus, search-service, media-service, notification-service. Those are out of scope by SSOT §5 (P2–P4).

---

## 1. PRIME DIRECTIVES (violations fail the mission)

1. **NEVER fabricate money, identity, or success.** No synthesized bank refs (`UTR…`), no `paid/released/settled` without a real provider reference + ledger post, no `mock:true` runtime payloads. If a real integration can’t be completed, **gate it OFF and SKIP (§2)** — never simulate.
2. **MONEY POSTS TO THE LEDGER, ALWAYS.** Every money state-change posts to the canonical double-entry ledger (`database/supabase/migrations/139_executable_foundation_ledger_core.sql`) atomically + idempotently. Spendable balance is READ FROM THE LEDGER, not a mutable table.
3. **TENANCY IS FAIL-CLOSED.** No tenant-table read/write without a `store_id`/`site_id` predicate; the data layer throws otherwise.
4. **DON’T TOUCH THE FROZEN CORE (§4).**
5. **PROVE IT.** A wave is “done” only when its behavioral tests pass. Name-grep validators and self-attestation do not count.
6. **SMALL, REVERSIBLE, LOGGED.** One wave per branch (`stepup/wave-<n>-<slug>`), conventional commits, append a `FOUNDATION_STEPUP_LEDGER.md` entry per wave (what changed, file:line, the proving test, SKIPs spun off).

## 2. SKIP_NEEDS_HUMAN PROTOCOL (the “continue anyway” rule)

When a task needs a human-only input (real credentials, vendor contract, DNS, KMS, paid plan, a product decision), Codex MUST, in this order:
1. **Implement everything around it** (the full code path, flag, tests against a mocked boundary).
2. **Gate the feature OFF** behind an explicit flag defaulting to disabled/sandbox — so it cannot ship live or fake success.
3. **Append a structured entry** to `FOUNDATION_STEPUP_SKIPPED.md`:
   ```
   ## SKIP-<id> · <wave> · <feature>
   BLOCKED BY: <the human input needed, exact>
   GATED AT: <file:flag that holds it OFF>
   TO RESUME: <what the human supplies + the acceptance test to run>
   ```
4. **Continue the mission.** Never block the run on a SKIP.
**Known SKIPs to expect:** RazorpayX/Cashfree payout creds; WhatsApp/Twilio secrets; KYC vendor (Signzy/HyperVerge); tax IRP/e-invoice; Supabase PITR plan/tier; Sentry DSN; Turnstile prod key; KMS for asymmetric keys; canonical-domain DNS cutover; the Liquid-in-or-out product decision. Implement around all of them; gate; log; continue.

---

## PART A — REPOSITORY IMPLEMENTATION AUTHORITY (every folder’s fate)

Disposition legend: **KEEP** (active, maintain) · **FREEZE** (do not modify without sign-off) · **REWRITE** (fix internals this mission) · **QUARANTINE** (exclude from build/deploy/topology, keep git history, no investment) · **DELETE** (remove). Codex must make the repo match this table.

### services/
| Path | Disposition | Note |
|---|---|---|
| `services/api-gateway` | **KEEP** (REWRITE money/tenant/secret internals) | the one backend |
| `services/queue-workers` | **KEEP** | real |
| `services/webhook-service` | **KEEP** | inbound HMAC + idempotency real |
| `services/mobile-bff` | **KEEP** (REWRITE in Wave 7) | mobile auth broker |
| `services/analytics-pipeline` | **QUARANTINE** | manifest-only paper service |
| `services/checkout-runtime` | **QUARANTINE** | paper; checkout is in-monolith |
| `services/event-bus` | **QUARANTINE** | paper; outbox is the mechanism |
| `services/media-service` | **QUARANTINE** | paper; signed R2 in monolith |
| `services/notification-service` | **QUARANTINE** | paper; router in QW |
| `services/search-service` | **QUARANTINE** | paper; build at P2 scale only |

### apps/
| Path | Disposition | Note |
|---|---|---|
| `apps/merchant-control-plane` | **KEEP** | core merchant app |
| `apps/storefront-runtime` | **KEEP** (REWRITE checkout + inline styles) | Waves 1/5/7 |
| `apps/identity-platform` | **KEEP** (REWRITE auth internals) | Wave 4 |
| `apps/platform-console` | **KEEP** (REWRITE admin auth) | Wave 4 |
| `apps/platform-operations-portal` | **KEEP** (dedupe shell w/ console) | Wave 5 |
| `apps/developer-portal` | **KEEP** (fix raw tables) | Wave 5 |
| `apps/marketing-site` | **KEEP** (REWRITE: migrate parallel token system) | Wave 5 |
| `apps/app-marketplace` | **KEEP — DORMANT** (no investment; V1 P4) | design-gov only |
| `apps/theme-marketplace` | **KEEP — DORMANT** (theme-gov touches) | Wave 6 |
| `apps/mobile/merchant-app` | **KEEP** (REWRITE: login/secrets/tokens) | Wave 7 |
| `apps/mobile/operator-app` | **QUARANTINE** | reserved, not implemented |
| `apps/mobile/shopper-app` | **QUARANTINE** | reserved, not implemented |

### packages/
| Path | Disposition | Note |
|---|---|---|
| `packages/typescript/ui` | **FREEZE** token source; KEEP lib (enforce in Wave 5) | design authority |
| `packages/typescript/api-client`,`api-types`,`shared-types` | **KEEP** | contracts |
| `packages/infrastructure` | **KEEP** (REWRITE: payout adapter→real PA, supabase-adapter→tenant-scoped, logistics/kyc→gated) | Waves 1/2 |
| `packages/payments` | **KEEP** (REWRITE: wire capture→ledger) | Wave 1 |
| `packages/billing-core` | **KEEP** (REWRITE: remove reconciliation auto-plug) | Wave 1 |
| `packages/auth-core` | **KEEP** (REWRITE: isolate secret, replace HMAC trust-root) | Wave 4 |
| `packages/theme-engine` | **FREEZE** section model; REWRITE renderer↔registry | Wave 6 |
| `packages/commerce-core`,`checkout-core`,`cms-core`,`tenant-core`,`notification-core`,`search-core`,`event-core` | **KEEP** | contract/used |
| `packages/identity-core`,`session-core`,`token-core`,`permission-core`,`organization-core`,`audit-core` | **KEEP — types only** (ride with Wave 4; quarantine any with 0 importers) | identity contracts |
| `packages/dart` | **KEEP** | mobile shared |
| `packages/distributed-runtime` | **QUARANTINE** | tower; V1 §4 dormant; 0 call-sites |
| `packages/projection-runtime` | **QUARANTINE** | tower; 0 product use |
| `packages/orchestration` | **QUARANTINE** | tower |
| `packages/runtime-composition` | **QUARANTINE** | tower (verify storefront edge use first; if used, KEEP minimal) |
| `packages/application-services` | **QUARANTINE** | descriptor-only identity functions |
| `packages/app-engine`,`packages/extension-host` | **QUARANTINE** | extensions rejected (V1 P4) |

### root dirs
| Path | Disposition | Note |
|---|---|---|
| `database/` | **KEEP**; **FREEZE** `139`,`141`,`147`; **REWRITE** `119` (integer→bigint, forward migration) | schema authority |
| `infrastructure/` | **KEEP** (DEPLOY observability + backups in Wave 3) | |
| `scripts/` | **KEEP** (split validators gate/report in Wave 0; generators KEEP) | |
| `config/` | **KEEP** (mark `*-not-live-evidence* ` manifests report-only) | |
| `tests/` | **KEEP** (**REWRITE** `money.test.ts` — it greps, doesn’t test) | |
| `docs/` | **KEEP** (reference; `docs/archive` is archive) | |
| `legacy/`,`chaos/`,`load/` | **QUARANTINE** (verify 0 imports; keep history) | dormant seams |
| `artifacts/`,`build/`,`test-results/` | **DELETE from VCS** (gitignore build outputs) | housekeeping |
| `LETBUYY_FOUNDATION_AUTHORITY/` | **KEEP — authority** | the SSOT lives here |
| `FOUNDATION_FORENSICS_2026_06_09/`,`PHASE2_ARB_CHALLENGE_2026_06_09/`,`FORENSIC_REPORT*/`,`FOUNDATION_AUTOPSY/`,`IDENTITY_PLATFORM_AUDIT/`,`IDENTITY_RECOVERY_ENHANCEMENT/` | **KEEP — reference** (do not act on; superseded by SSOT) | evidence archive |
| `founder-journey/`,`FOUNDER_CONTENT_ENGINE/`,`tasks/`,`memory/` | **KEEP** (out of foundation scope) | |

---

## PART B — THE 8 WAVES (execute in order, single run)

> Each wave: **Objective · Tasks (file-anchored) · SKIPs · Acceptance (behavioral) · Rollback.** Commit per wave. **Backups (Wave 3.1) must run before Wave 1’s destructive migrations** — Codex runs the Wave-3.1 backup setup as a Wave-0 prerequisite even though Production Safety is numbered Wave 3.

### WAVE 0 — TRUTH HARNESS
**Objective:** make “done” provable; stop theater; ensure a restore path exists before money migrations.
**Tasks:** (a) `scripts/validators/anti-fabrication-validator.mjs` as a **blocking gate** — fails CI on synthesized `UTR…`/`txn_…` without provider ref+ledger post, hardcoded money `paid/released` without ledger, `mock:true` runtime payloads, `SKIP_NEEDS_HUMAN` in prod secrets, `getSupabaseAdmin().from('<tenant table>')` outside the scoped layer. (b) `scripts/validators/validators.manifest.json` splitting the 177 validators into **`gate`** (behavioral) vs **`report`** (name-grep ~46%); CI runs only `gate` as blocking. (c) Replace `services/api-gateway/src/__tests__/money.test.ts` with a real ledger integration suite. (d) Publish `FOUNDATION_STEPUP_FLAG_TRUTH.md` (GraphQL/Extensions/Liquid are `false` in prod — `wrangler.toml:239-241`). (e) **Wave-3.1 prerequisite:** ensure continuous backup/PITR config + a restore-drill script exist before any Wave-1 migration (SKIP the paid-tier enablement; ship the config + drill).
**SKIPs:** Supabase PITR tier (config only). **Acceptance:** a planted fake UTR fails CI; money tests execute `post_ledger_transaction`; `gate`/`report` lanes split; restore-drill script present. **Rollback:** disable the new gate.

### WAVE 1 — MONEY FIXES
**Objective:** one ledger that reconciles; money cannot be faked, double-paid, or lost.
**Tasks:**
1. **Ledger = balance source:** `services/api-gateway/src/routes/wallet.ts:66-92` — derive spendable balance from canonical `ledger_entries`, not the mutable `wallet_ledger_entries`; add an invariant test (wallet view ≡ ledger).
2. **Capture→ledger:** call `buildPaymentCaptureLedgerPosting` (`packages/payments/src/index.ts:420`) at real capture success in `routes/payments.ts`, atomically posting to `pa_clearing`.
3. **Payout release safety:** `routes/payouts.ts:505-521` — add `SELECT … FOR UPDATE` on the statement/wallet, a **balance check** before transfer, an **idempotency key**, and a state-guard so a statement can’t be released twice; move **maker-checker to the live `payout_statements`** path (not the orphan `payouts` table `migrations/151`).
4. **Real PA adapter:** `packages/infrastructure/payout-transfer-adapter/index.ts` — implement RazorpayX/Cashfree transfer; persist the **real** UTR; **no creds ⇒ feature OFF + SKIP** (no wallet debit, no ledger “release”). Delete the fabricated-UTR path.
5. **Refunds→ledger:** `routes/payments.ts:763-855` — post to `refund_clearing`; fix partial-refund state.
6. **Remove revenue double-booking:** `routes/payouts.ts:404-426` vs `routes/commission.ts:288-342`.
7. **Stop reconciliation auto-plug:** `packages/billing-core/src/index.ts:558,601-615` — surface real breaks + alert; never absorb into `reserve`.
8. **`integer→bigint`:** forward migration for all `*_minor` columns in `database/supabase/migrations/119_*`.
9. **Kill `mock` default:** `routes/payments.ts:130` — require explicit mode; reject `mock` in a production runtime.
**SKIPs:** PA creds, KYC/tax vendors (gate those features OFF). **Acceptance:** capture→settle→payout lifecycle test green; a duplicate/unfunded payout is rejected by lock+balance+idempotency; refunds post to ledger; reconciliation reports a *planted* break instead of absorbing it; no money column is `integer`; `mock` rejected in prod; `ledger_balance_breaks()` empty after lifecycle. **Rollback:** PA→sandbox; restore from Wave-3.1 backup for the bigint migration; ledger writes are append-only.

### WAVE 2 — TENANT ISOLATION
**Objective:** correct-by-construction tenancy; zero cross-tenant IDOR.
**Tasks:** introduce a **tenant-scoped data layer** that throws on unscoped tenant-table access; migrate hot routes first (`orders, customers, payouts, settlements, products, wallet, contacts, kyc`); ESLint-ban `getSupabaseAdmin().from('<tenant table>')` outside it; **drop `USING(true)` policies**; **remove the static `super_admin` token** (`services/api-gateway/src/middleware/auth.ts:216-231`); make `requireRole` resolve server-side, not from a JWT claim.
**SKIPs:** none. **Acceptance:** parameterized IDOR test (tenant A → tenant B `:id` ⇒ 403/404) green for every resource; `tenantScoped` throws on unscoped access; god-token no longer authenticates. **Rollback:** per-route revert.

### WAVE 3 — PRODUCTION SAFETY
**Objective:** survivable, no placeholder secrets, fail-closed.
**Tasks:** **(3.1, already staged in Wave 0)** continuous backups + PITR + restore drill; **secret preflight** in `production-deploy.yml` that hard-fails on any `SKIP_NEEDS_HUMAN*` (`wrangler.toml:253-262`) and gates dependent features OFF; **rate-limit fail-closed** (`middleware/rateLimit.ts:884-888`) + a deploy assertion the limiter is live; **deploy observability** (otel/metrics/logs/traces with real datasources + structured logging + PII redaction + alerts incl. reconciliation-break); unify `letbuyy.com`/`letbuyy.com` via one env var.
**SKIPs:** PITR paid tier, Sentry DSN, DNS cutover (config + gates; log). **Acceptance:** restore drill passes in staging; a deploy carrying `SKIP_NEEDS_HUMAN` fails; a missing limiter secret fails the deploy; dashboards show live api-gateway metrics; a planted reconciliation break alerts. **Rollback:** additive; overrides audited.

### WAVE 4 — SESSION SECURITY
**Objective:** retire the shared-secret forgery surface; sessions revocable + rotating; one merchant auth path.
**Tasks:** **isolate + rotate** the internal trust secret so `INTERNAL_API_SECRET` ≠ `AUTH_SECRET`/cookie/OAuth/TOTP/money-header (`packages/auth-core/src/index.ts:447`); **lock the gateway perimeter** (mTLS or CF-Access/IP-allowlist — `wrangler.toml:212-215`) so `X-LetBuyy-Internal-*` can’t be injected externally; add nonce/jti replay protection; add **idle timeout + refresh rotation + reuse-detection + real revocation** to merchant sessions; **enforce MFA** at login (`routes/auth.ts:411-480`); **per-principal admin TOTP** (retire shared `admin-mfa-scaffold.ts:8`); collapse `users`+`users_custom` → one store; remove dual GoTrue/custom acceptance. *(This is Wave 0–4 of `IDENTITY_MIGRATION_PLAN.md`; the full IdP/OIDC build stays DEFERRED.)*
**SKIPs:** KMS for asymmetric keys (use a rotated symmetric internal secret in the interim, gated; log the KMS SKIP); perimeter mechanism if it needs an infra decision (implement allowlist as default). **Acceptance:** secret-reuse grep = 0; a forged internal header from outside the perimeter is rejected; idle session expires; rotated token invalidates predecessor; enrolled-MFA login is challenged; two admins can’t share a TOTP; only one credential type accepted. **Rollback:** dual-accept window behind a flag.

### WAVE 5 — DESIGN GOVERNANCE
**Objective:** one design authority, enforced.
**Tasks:** wire `scripts/validators/design-system-baseline.json` ratchet + stylelint as **blocking** gates; lint-ban `#hex`/`rounded-[`/`shadow-[`/inline `style={{}}` on themable surfaces; migrate `apps/marketing-site` onto canonical tokens (or formally exile + exclude from score); **generate** mobile Dart tokens (`scripts/generators/generate-mobile-tokens.mjs`), delete the 5 hand-authored color files (334 literals); unify `ConsoleWorkspace`/`OpsWorkspace`→one `AppShell` + consolidate 4 `Header`s/2 `Sidebar`s/8 `IndexTable`s into `@letbuyy/ui`; developer-portal raw tables → `<Table>`; burn down storefront’s 574 inline styles under a shrinking cap.
**SKIPs:** none. **Acceptance:** CI fails on a planted hex/arbitrary radius; `generate-mobile-tokens.mjs --check` green; no workspace duplication; storefront inline-style count below cap. **Rollback:** per-app revert.

### WAVE 6 — THEME GOVERNANCE
**Objective:** themes can’t silently fail; schema evolves safely.
**Tasks:** couple **renderer↔registry** — the storefront renderer validates section types against the live registry at render (`packages/theme-engine/src/theme-registry.ts` consumed by `apps/storefront-runtime` template-resolver); never silently drop a saved section. Finish the **12 of 24** unschemaed `BuiltInSectionType`. Build a **schema-migration runner** for deployed template JSONB. **App-block injection** (`theme-renderer.ts:505-526`): make real or remove the stub + keep `FEATURE_EXTENSIONS=false`. **Liquid decision (SKIP — product call):** default to keep `FEATURE_LIQUID=false` and serve honestly; log the decision SKIP. Collapse the dual-draft system to one.
**SKIPs:** Liquid in-or-out product decision (default OFF). **Acceptance:** a saved section with no renderer fails validation at save, never silently renders nothing; all 24 built-ins have schemas; a section-schema change migrates existing stores in a test. **Rollback:** feature-flag the new render-validation.

### WAVE 7 — BETA READINESS
**Objective:** a real merchant can log in, transact, and be notified.
**Tasks:** **mobile login** — replace the Turnstile placeholder (`apps/mobile/merchant-app` + BFF); **SKIP** the prod Turnstile key (gate, log). **Server-authoritative checkout** — `routes/checkout.ts:454-509` confirm MUST create an order + capture payment (today it only flips state); server cart. **WhatsApp lifecycle + COD** wired to `order.paid`/`order.shipped`; **SKIP** WhatsApp/Twilio secrets (gate). **Quarantine the theater** — remove `distributed-runtime`/`projection-runtime`/`orchestration`/`application-services`/`app-engine`/`extension-host` from `tsconfig.workspace.json` + build/deploy filters into `quarantine/` (verify 0 importers first); ensure the 6 paper services + `apps/mobile/operator-app`/`shopper-app` are excluded from deploy; make OIDC return an honest 501. **Final acceptance gate** (below).
**SKIPs:** Turnstile key, WhatsApp/Twilio secrets. **Acceptance:** checkout confirm creates an order + posts capture to ledger; mobile login works against a (mocked) Turnstile in test; build closure shrinks (0 imports of quarantined pkgs); deploy excludes reserved services. **Rollback:** quarantine is `git mv` (reversible); per-task revert.

---

## PART C — FINAL MISSION ACCEPTANCE GATE (all must pass)
1. Anti-fabrication harness green; no fabricated identifiers/statuses on any prod path.
2. Money: capture→ledger; payout lock+balance+idempotency+maker-checker on `payout_statements`; refunds→ledger; no revenue double-book; reconciliation surfaces (not absorbs) breaks; all money `bigint`; `mock` rejected in prod; `ledger_balance_breaks()` empty after a full lifecycle.
3. Tenancy: IDOR test green for every resource; `tenantScoped` throws on unscoped access; no `USING(true)`; no static `super_admin`.
4. Production: restore drill passes; `SKIP_NEEDS_HUMAN` blocks deploy; rate-limit fail-closed; observability live; one canonical domain.
5. Session: internal secret isolated + perimeter locked; idle+rotation+revocation; MFA enforced; per-principal admin TOTP; one merchant auth path.
6. Design: ratchet blocks regressions; mobile tokens generated; no parallel token system; shells unified.
7. Theme: saved sections can’t silently fail; schema migration exists.
8. Cleanup: the tower + paper services + reserved mobile apps are quarantined out of build/deploy; OIDC honest 501.
9. `pnpm run validate:dependencies` + `pnpm run test` + all new behavioral suites green.
10. `FOUNDATION_STEPUP_SKIPPED.md` lists every human-blocked item, each gated OFF — **zero fakes shipped.**

## PART D — FROZEN (do not modify without human sign-off)
Ledger kernel `migrations/139`; inventory `141`; order state machine `147`; `packages/theme-engine` section/block model; `packages/typescript/ui/src/tokens.ts`; package-boundary acyclicity (no app↔app, no package→app, no `createClient` in app `src/`); the auth primitives (bcrypt-12, AES-GCM TOTP, opaque revocable sessions, SEC-H3 weak-key refusal, the `/api/auth/switch` device-proof fix); cross-realm cookie isolation; the “never custody money / rent rails” regulatory decision.

## PART E — ANTI-FABRICATION HARNESS (the guardrail that keeps theater out)
`scripts/validators/anti-fabrication-validator.mjs` (Wave 0) fails CI on: string-built financial identifiers without a provider ref + ledger post; hardcoded money status without a ledger entry; `mock:true`/`mock-x-coordinate` from a non-test runtime; `SKIP_NEEDS_HUMAN*` in a production secret; tenant-table access via `getSupabaseAdmin()` outside `tenantScoped`. Pair each rule with a real test; grep is the backstop, not the proof.

---

> **Run it end-to-end in one mission. Gate-and-SKIP every human-blocked item, log it, and keep going. Ship zero fakes. When the Final Acceptance Gate is green, LetBuyy is fundamentally strong: money is true, tenants are isolated, production is observable and recoverable, identity can’t be forged, and the build contains only code that runs.** Build the road.
