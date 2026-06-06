# CODEX FOUNDATION-HARDENING MISSION — V2 (Phase 4b: Close the Regression, Finish the Foundation)

**Supersedes:** `CODEX_FOUNDATION_HARDENING_MISSION.md` (V1). V1's phases **F0 + F1.1–F1.5 are DONE** (verified in code, second forensic pass); V2 carries forward F1.6 + F2–F8 **and adds a mandatory regression gate (P‑1) for issues the V1 remediation itself introduced.** Continue the SAME ledger: `CODEX_FOUNDATION_HARDENING_LEDGER.md` + `CODEX_FOUNDATION_HARDENING_STATUS.md`.
**Driver:** GPT‑5.5 in Codex, `xhigh` for security/app‑platform/theme‑runtime/money work, `high` for migrations + tests, `medium` for mechanical edits.
**Mode:** Continuous, autonomous. Run as long as it takes (24h+). Never stop while an unblocked task remains.
**Branch:** continue `stream/letbuyy-remediation` (or a fresh `stream/letbuyy-foundation-v2` off current `develop`).
**Issue source of truth (canonical):** the **second‑pass** `FORENSIC_REPORT/` (post‑remediation, HEAD `127a850e`). Read these first, in order: `FORENSIC_REPORT/16-critical-findings-summary.md` (resolution scoreboard + the new N‑findings), `FORENSIC_REPORT/00-EXECUTIVE-SUMMARY.md`, `FORENSIC_REPORT/15-production-readiness.md`. Finding IDs `C‑*/H‑*` map to report 16; `N‑1…N‑6` are the new issues introduced by V1's remediation. Trust the cited file:line evidence; verify only at the point of edit.
**Governance posture (non‑negotiable):** KEEP ALL VALIDATORS GREEN at every commit (`node scripts/validate-governance.mjs` — currently **129**, never fewer; add validators when this mission establishes a new invariant). Never delete/weaken a validator to pass. Human policy/credential/irreversible‑infra/architecture‑direction calls → `[SKIP — NEEDS HUMAN]` and continue.

> **This mission changes code.** It is the build counterpart to the read‑only forensic engagement. You are authorized and required to modify source to close the findings below — under the Operating Contract.

---

## 0. PRIME DIRECTIVE

The second forensic pass confirmed V1 did its scoped work well: runtime inventories reconciled + validator‑locked, phantom services made honest, **single‑writer ownership enforced** (new `single-writer-ownership-validator.mjs`), events contracted, an app‑marketplace integrity batch landed, and real multi‑template theme editing shipped. Governance is green at 129.

Two truths remain, and they define this mission:

1. **Every hard product Critical is still open** (app API, compliance webhooks, app billing, theme‑editor preview, server cart, observability, theme‑marketplace checkout) — V1's later phases never ran.
2. **V1's single‑writer refactor introduced a payment‑path security regression** (`N‑1`: internal payment routes fail **open** by default off‑production) and persisted plaintext app secrets (`N‑2`), with the one test that touches that surface wired into **no runner** (`N‑3`).

**Your job, in strict order:** first close the regressions V1 created (P‑1 — these are the highest‑severity items and the cheapest to fix), then finish the god‑file split (F1.6), then make the foundation *capable and honest* across the remaining phases. Same disposition rule as V1: make it **real** when no live credential/money‑rail/human‑policy is required; **reconcile the doc to truth** when a manifest/doc overstates; **`[SKIP — NEEDS HUMAN]`** the rest and continue.

**SUCCESS CRITERIA — COMPLETE only when all are proven with recorded command evidence:**

1. **No regression remains from V1.** N‑1 internal payment routes fail **closed** like their siblings; N‑2 no plaintext app `access_token`/`signing_secret` persisted anywhere replayable; N‑3 every test file (incl. `tests/contracts/*.test.ts`) runs in CI and the internal‑payment test covers the off‑prod branch; N‑4/N‑5/N‑6 resolved or recorded.
2. **God‑files split.** No route file >1,500 lines (`storefront.ts` is the headline); behavior‑preserving, proven by characterization tests written first.
3. **App platform honest end‑to‑end.** Scope‑enforced app API (C‑3), OAuth client auth + PKCE + refresh (H‑6), compliance webhooks actually published (C‑4), Wasm limits enforced (H‑5), app billing real‑sandbox or honest‑unconfigured — never fake (C‑5).
4. **Theme/storefront real or honestly gated.** Editor previews real output (C‑6), preview/publish separation + `base_version` + the multi‑template preview‑session bug fixed (C‑8/B‑6), data‑driven section registry (C‑7), embeds + bounded Liquid commerce drops (C‑9), server‑side cart (C‑10), real theme‑marketplace checkout (H‑4), demo store isolated (H‑14).
5. **Security hardened.** Single merchant credential authority (H‑7), per‑operator ops identity + timing‑safe compares (H‑16), storefront login rate‑limited + internal secret required in all envs (H‑17, overlaps N‑1), scoped CORS, raw‑error sanitizer (122 sites), no reachable dev bypass in prod.
6. **Tests prove behavior.** All 12 deployable workspaces run real tests (C‑11); security‑critical packages have units; one behavioral CI path on a real/ephemeral stack; the inherited `tests/auth/rbac-categories.test.mjs` failure fixed.
7. **Observability emits** (C‑14) or its SLO/dashboard contracts are reconciled to reality; **one gated prod deploy path** (H‑15); one migration root + partition driver; environment honesty (no silent staging defaults).
8. **Legacy & dead weight handled.** Portfolio/resume gated+documented (H‑2); `@letbuyy/utils` service‑role edge removed (H‑8); duplication single‑sourced (crypto incl. `storefront.ts` copies, `gateway-events.ts` twins/N‑5, `formatDate`, api‑client wrappers); confirmed dead code archived; agent‑ledger residue out of source trees (N‑6); `AGENTS.md` regenerated not hand‑patched (AV‑M8).
9. **Mobile topology honest** (H‑3).
10. **Every gate green on real evidence.** typecheck / `validate:governance` (≥129) / lint / build (no network) / `pnpm turbo test` (all 12 real) / behavioral journeys all pass; the ledger TRACEABILITY MATRIX shows every `C‑*/H‑*/N‑*` as DONE or SKIPPED — NEEDS HUMAN; `CODEX_FOUNDATION_HARDENING_STATUS.md` summarizes with every human‑gated remainder + exact commands.

---

## 1. OPERATING CONTRACT (unchanged from V1, plus one law)

1. **Continuous execution.** Finish → update ledger → next unblocked task. Never pause to ask. Never end while unblocked tasks remain.
2. **The Green Law.** Tree green after every commit: area validators + `pnpm turbo typecheck` + `pnpm lint` each increment; full `validate:governance` (≥129) at every phase gate. Never commit red. 3 failed attempts → revert, log `BLOCKED` + diagnosis, move on.
3. **The Honesty Law.** Never pass a governance artifact by asserting something untrue; never "pass" a feature by faking it. Manifest overstates → correct it. Provider needs live keys → honest "configure credentials" state, never fake success. Test must exercise real behavior, never assert a string.
4. **The Single‑Writer Law.** One writing runtime per table; cross‑runtime mutation goes through the owner or an event it consumes; the existing `single-writer-ownership-validator.mjs` stays green and is extended when you assign new owners.
5. **The Regression‑First Law (NEW).** Do **not** start any feature phase (F2+) while a P‑1 regression is open. A security regression introduced by prior remediation outranks every new capability. P‑1 ships first, fully, green.
6. **DATABASE SAFETY.** Never mutate a production DB. New migrations append‑only, forward‑safe, fresh‑replay‑safe (continue `088+` on top of `000_baseline.sql`). Archive historical intent, don't delete. Applying to a provisioned env is human‑gated.
7. **The REAL‑Evidence Law.** Behavioral/UI/cross‑app proof runs against staging Supabase + staging gateway or a disposable local Postgres. Mocks are forbidden as proof. No staging creds → produce code + local proof and record only the live proof as `[SKIP — NEEDS HUMAN: staging deploy + secrets]` with exact commands.
8. **Small reversible increments.** One logical change → validate → commit. Behavior‑preserving refactors (god‑file split) proven by tests written *before* the move.
9. **Human‑skip ledger (mark and continue).** Live secrets (Razorpay/Cashfree live, Supabase service‑role, Cloudflare, Vercel, Resend, OAuth creds, Gemini), prod DB apply, remote git, paid signups, payout rails, policy/pricing/legal/architecture‑direction → append to `CODEX_FOUNDATION_HARDENING_LEDGER.md` under `## SKIPPED — NEEDS HUMAN` with exact command/decision + findings it unblocks, then continue.
10. **No fabrication.** Every `DONE` needs command + result evidence. Never fake a test, never claim a provider works when it throws, never call a mock run end‑to‑end. Self‑verify UI in a real browser with screenshots.
11. **Anti‑thrash.** Max 3 attempts/task → `BLOCKED` + diagnosis → next.
12. **Respect existing law.** Obey `AGENTS.md`, `CLAUDE.md`, `docs/governance/`, Deprecated Runtime Policy, migration governance, §3 invariants. Update governance memory in the same commit when a change requires it.
13. **Anti‑ceremony.** No new top‑level docs beyond this ledger/status. New validators only for real invariants this mission establishes (fail‑closed internal routes, no‑secret‑persistence, no‑no‑op‑test, single‑source‑crypto). No new microservices unless a phase authorizes it. Reuse existing packages.
14. **Traceability.** Every `C‑*/H‑*/N‑*` in §6 ends DONE or SKIPPED — NEEDS HUMAN in the ledger. Nothing disappears silently.

---

## 2. ARCHITECTURE-DIRECTION FORKS (carried from V1 — decided, do not re‑litigate)

- **C‑1 Monolith:** DEFAULT modular‑monolith. Modularize god‑files (F1.6), keep Single‑Writer, do **not** extract the 6 reserved services. Extraction = `[SKIP — NEEDS HUMAN]`.
- **C‑7 Section runtime:** DEFAULT data‑driven first‑party registry + safe fallback. Third‑party section‑upload runtime = `[SKIP — NEEDS HUMAN]`.
- **C‑9 Liquid/Embeds:** DEFAULT bounded documented commerce drop set + embed injection points, **sandbox/sanitization preserved**. Anything relaxing the sandbox = `[SKIP — NEEDS HUMAN]`.

---

## 3. ARCHITECTURE INVARIANTS (never violate)

One backend (`api-gateway`), one contract (`shared-types`/`api-client`), one identity verifier (`auth-core`), async via the event spine, **outbound webhooks only from `webhook-service`**, themes data‑only, one design system (`@letbuyy/ui`). Single‑Writer per table. Every subscribed topic has a producer; every produced topic has a contract. **Internal endpoints fail closed in every environment.** No secret persisted in a replayable/readable store. Migrations fresh‑replay; append‑only `088+`. No build‑time network. No fake success. INR‑first; COD + GST first‑class.

---

## 4. LEDGER — continue `CODEX_FOUNDATION_HARDENING_LEDGER.md`

Append a `## V2` section. Keep the existing matrix; add `N‑1…N‑6` rows and flip statuses as you go. Update `## SINGLE-WRITER LEDGER`, `## SKIPPED — NEEDS HUMAN`, `## VALIDATOR LEDGER`. Record the P‑1 regression closure with before/after evidence (the fail‑open guard, the secret‑persistence diff, the test‑runner wiring).

---

## 5. THE WORK — P‑1 → F8 (P‑1 first and complete; then in order)

### P‑1 — REGRESSION GATE (V1‑introduced; do FIRST, before any feature work)
*Findings: N‑1, N‑2, N‑3, N‑4, N‑5, N‑6.*

- **P1.1 Fail‑closed internal payment routes (N‑1) [Critical‑priority].** `services/api-gateway/src/routes/storefront/internal-payment-routes.ts:71‑76` returns `true` when `INTERNAL_API_SECRET` is unset and `ENVIRONMENT !== 'production'`, guarding payment **confirm/failure/event/reference/payable** endpoints. Make it fail **closed** identically to `routes/internal-billing.ts:49‑53` and `routes/internal-events.ts:20‑24` (`if (!secret) return false;`) in **every** environment. Add a validator that fails if any `routes/**/internal*` guard has an off‑prod allow‑branch. _DoD: no internal route authorizes without the secret in any env; validator green; tests cover unset‑secret → 403 in staging AND production._
- **P1.2 Stop persisting plaintext app secrets (N‑2).** Keyed installs write the full response incl. `access_token` + show‑once `signing_secret` into `idempotency_keys.response_body` (~24h replay) — `app-store.ts:2143‑2158`, adapter `:69/:151‑156/:112‑118`. Exclude secrets from the persisted/replayed body (store a redacted response; re‑mint or omit show‑once values on replay; or encrypt at rest). _DoD: no app token/signing‑secret recoverable from `idempotency_keys`; replay still idempotent; test proves the persisted body carries no secret._
- **P1.3 Wire orphaned tests into CI + cover the dangerous branch (N‑3).** `tests/contracts/storefront-internal-payment-routes.test.ts` and `domain-event-contracts.test.ts` match no runner (root glob is `tests/*/*.test.mjs`; no workflow runs `tsx`). Make every test file execute in CI (extend the runner/glob or add a `tsx`/node‑strip‑types step) and extend the internal‑payment test to assert the **off‑prod no‑secret → 403** case (the P1.1 fix). _DoD: `pnpm turbo test`/CI executes the `.ts` contract tests; the N‑1 case is asserted and passes._
- **P1.4 Contract or reject uncontracted internal events (N‑4).** `/v1/internal/events/domain` accepts any `eventType ≤160` and stores uncontracted `payment.*` payloads raw (`event-execution.adapter.ts:54‑56`). Either register contracts for the emitted `payment.captured/failed`, `refund.created`, `payment.subscription.activated` topics, or reject uncontracted types at the endpoint. _DoD: every event reaching the ingress is contracted or rejected; no raw‑payload passthrough._
- **P1.5 Single‑source the gateway‑events client (N‑5).** `webhook-service/src/gateway-events.ts` and `queue-workers/src/gateway-events.ts` are functionally identical; the internal‑fetch boilerplate is copied across 4 client modules. Extract one shared client (e.g. into `packages/infrastructure` or a small internal package) consumed by both services. _DoD: one implementation; both services import it; tests green._
- **P1.6 Evict agent‑ledger residue + reap dead queue jobs (N‑6).** Move `CODEX_WS9_LEDGER.md` (inside `apps/merchant-control-plane/src/app/[store]/settings/`), the WS10/WS1 ledgers in workspaces, and the 8 root `CODEX_*.md` (2 byte‑identical to archived copies) into `docs/archive/` (don't delete); archive the stray `CODEX_FOUNDATION_REMEDIATION_MISSION.md` (duplicate mission). Then: the centralize‑outbox change upserts `platform_queue_jobs` rows `queue_name='webhook-deliveries'` that no consumer claims (permanent `queued`) — either add the consumer/drain or stop producing them. _DoD: no CODEX ledger inside any runtime source tree; no `.md` residue at root beyond active governance + this mission's files; no orphaned queue‑job class accumulating._

**GATE P‑1:** ≥129 validators; every internal route fails closed in all envs; no replayable plaintext secret; all test files run in CI incl. the N‑1 case; uncontracted‑event ingress closed; one gateway‑events client; residue archived. **No F‑phase may start until this gate is green.**

### F1.6 — FINISH the god‑file split (carried over, behavior‑preserving)
*Finding: H‑9 (+ supports C‑1).* `storefront.ts` is still 4,833 lines; 11 files >1,500.
- **F1.6a** Continue extracting cohesive route groups (customer auth/account → catalog/search → checkout), characterization tests FIRST each time. _DoD: no route file >1,500 lines for the split set; tests green before+after; route order preserved._
- **F1.6b** Confirm the F1.2 dual‑writer sweep covered every table flagged in `FORENSIC_REPORT/11`; record the sweep in the SINGLE‑WRITER LEDGER. _DoD: every multi‑written table is single‑owned or recorded._

**GATE F1.6:** ≥129; god‑files split under test; dual‑writer sweep recorded.

### F2 — APP PLATFORM MADE HONEST
*Findings: C‑3, C‑4, C‑5, H‑5, H‑6, H‑13. (App‑marketplace H‑9/M‑5/review‑gate already landed in V1 — build on them, don't redo.)*
- **F2.1 Real scoped app API (C‑3).** App tokens are honored at one GET proxy (`app-store.ts:1263`); `middleware/auth.ts:164‑247` has no app‑JWT branch. Add scope‑enforced app‑JWT acceptance + a bounded documented app API (current reads + minimal deliberate writes); reject missing‑scope. No blanket writes. _DoD: installed app calls scope‑guarded endpoints; missing scope rejected; allow+deny tested._
- **F2.2 OAuth client auth (H‑6).** `/oauth/token` (`app-store.ts:1788‑1873`) takes code+client_id+redirect_uri only; grant type `authorization_code` only (`:122‑124`). Add client_secret (confidential) and/or PKCE (public) + refresh grant; used‑code replay fails. _DoD: token exchange requires client proof; refresh works; replay fails; tested._
- **F2.3 Publish compliance webhooks (C‑4).** `customers/data_request|redact`, `shop/redact` force‑subscribed (`app-engine/src/index.ts:150‑154`), zero emit sites (and WS10 now advertises them). Wire real producers at the merchant/customer data‑request/redaction triggers + app uninstall. _DoD: each topic has a real emit path proven by a test; an installed app receives them._
- **F2.4 Real‑sandbox or honest billing (C‑5).** `app-store.ts:1551` fabricates `rzp_route_test_`; payout ledger `test/pending` (`platform-queue-consumer.ts:660/667`). Implement the real provider path in sandbox (create→verify→ledger reflecting real state); live keys + payout release → `[SKIP — NEEDS HUMAN]`. No fabricated success refs remain. _DoD: sandbox charge or honest unconfigured state; no fake refs; payout release the only human remainder._
- **F2.5 Enforce Wasm limits (H‑5).** `app-functions-runtime.ts:203` `instantiate(module,{})`; `memory_limit_kb` only typed/SELECTed (`:42/:233`). Enforce the memory bound + harden the timeout against synchronous CPU loops so a hostile function can't stall checkout. _DoD: over‑memory or spinning function terminated without stalling checkout; both tested._
- **F2.6 Developer tooling no‑cred parts (H‑13).** WS10 is a documentation shell (`developer-surface.ts`, `[SKIP - NEEDS BACKEND]`). Implement the no‑credential parts: app‑manifest upload/validate + API‑key issuance wired to existing tables + a minimal TS SDK over `@letbuyy/api-client`. Full CLI = `[SKIP]` if it can't land green. _DoD: a developer registers an app, gets keys, calls the SDK against staging — or the exact remainder is a recorded SKIP._

**GATE F2:** ≥129; app authenticates, holds scoped tokens, calls a real scoped API, receives compliance webhooks, bills in sandbox; Wasm limits enforced; live‑key/payout items SKIP‑recorded.

### F3 — THEME & STOREFRONT: real editing, publishing, extensibility, cart
*Findings: C‑6, C‑7, C‑8, C‑9, C‑10, H‑4, H‑14, B‑6, orphan tables.*
- **F3.1 Wire the web editor live preview (C‑6).** Editor (`…/themes/[themeId]/editor/page.tsx`) still renders `PREVIEW_PRODUCTS` mock (`:191`) via in‑page `PreviewCanvas` (`:1842`); `CenterPanel.tsx` has 0 importers; gateway preview‑sessions + storefront `/preview` bridge exist (Flutter uses them). Mount the real iframe preview; remove the mock from the proof path. _DoD: editing a section updates the real rendered iframe on web; screenshot evidence._
- **F3.2 Publish separation + concurrency + multi‑template fix (C‑8/B‑6).** Web `editor/route.ts:96‑107` save‑then‑publish, omits `base_version` (gateway conflict checks exist at adapter `:1136‑1138/:1272‑1274`). Split save‑draft vs publish; send `base_version`. **B‑6:** `createPreviewSession` reads `theme_editor_drafts` with a non‑template‑scoped `.maybeSingle()` (adapter `:1451‑1456`) — multi‑row‑unsafe post‑migration‑087; add `template_key` to `PreviewTokenSchema` + scope the query; fix the instance‑draft last‑template‑wins dual‑write. _DoD: draft saves without going live; concurrent saves conflict not clobber; preview‑session is template‑scoped and multi‑row‑safe; tests cover each._
- **F3.3 Data‑driven section registry (C‑7, §2 default).** `renderer-registry.tsx:385‑393` static; unknown→null. Resolve manifest‑declared types through a registry with a documented safe fallback (not silent null); first‑party renderers kept. _DoD: unknown type degrades visibly+safely; new first‑party type needs no hand‑edited switch; tested._
- **F3.4 App embeds + bounded Liquid drops (C‑9, §2 default).** `theme-renderer.ts:190‑191/247‑248` hardwire `content_for_header/footer=''`; `buildLiquidScope:332‑362` lacks commerce objects. Implement sanitized embed injection points + a bounded documented drop set (`product/collection/cart/customer/shop`) + the safe filters themes need; sandbox preserved. _DoD: an app embed renders into head/footer; a Liquid theme reads product/cart/customer via documented drops; sandbox tests pass; no arbitrary script execution._
- **F3.5 Server‑side cart (C‑10).** Cart is `localStorage['lb_cart']` only; `public.carts` unwired; GraphQL now throws `CART_NOT_SUPPORTED` (`graphql/storefront.ts:386‑392`). Wire cart persistence to the gateway (`carts` table) with a cart token; keep localStorage as a synced client cache. _DoD: cart persists server‑side across sessions/devices; cart API scope‑guarded; tested in checkout._
- **F3.6 Real theme‑marketplace checkout (H‑4).** `apps/theme-marketplace/src/app/checkout/page.tsx:206‑217` "Pay" is a `<Link href="/checkout/success…">` (and coupon Apply inert). Wire the real theme‑purchase flow (Razorpay test mode exists) or honest unconfigured state; remove the fake‑success link. _DoD: real (test‑mode) intent or honest state; no fake‑success navigation._
- **F3.7 De‑hardcode demo store + orphan tables (H‑14).** Remove the `urban-kicks-demo` short‑circuit (`store-service.ts:55‑57/73‑75/92‑94/116‑118`) from the real tenant path (demo flag only); stop the editor force‑injecting `REQUIRED_URBAN_KICKS_SECTIONS` into every theme. Decide the 7 orphaned theme tables + write‑only `theme_draft_patches` + unreachable `theme_reviews`: wire or archive‑document each (note migration 087 ALTERed `theme_editor_drafts`, created no orphan). _DoD: real tenants never hit demo fixtures; every theme table used or documented reserved._

**GATE F3:** ≥129; real editor preview + publish separation + multi‑template‑safe; embeds + server cart; no fake checkout; demo isolated.

### F4 — SECURITY & AUTH HARDENING
*Findings: H‑7, H‑16, H‑17; Mediums: CORS, error‑leakage, dev bypasses. (H‑17 overlaps P1.1 — finish the storefront‑login half here.)*
- **F4.1 Single merchant credential authority (H‑7).** Verify moves server‑side; stop shipping `password_hash` over HTTP (identity `route.ts:85` / gateway `auth.ts:156`); one shared hashing module, one cost factor; remove the `domain-boundary-validator.mjs:215` whitelist once compliant. _DoD: hash never leaves the gateway; one hashing impl; login tested._
- **F4.2 Ops‑plane identity + timing‑safe compare (H‑16).** Single static bearer + plain `!==` (`internal-console.ts:56`). Add per‑operator identity (reuse identity/SSO) or `[SKIP — NEEDS HUMAN: ops SSO/IdP]` with rotation runbook; make all secret compares timing‑safe. _DoD: ops actions attributable + timing‑safe, or precise human remainder recorded._
- **F4.3 Storefront login abuse controls (H‑17).** Add rate‑limit + Turnstile (identity‑platform has them) to customer login; ensure the internal‑secret requirement from P1.1 holds for the storefront internal endpoints too. _DoD: customer login rate‑limited; internal endpoints reject unsigned in every env; tested._
- **F4.4 Scope credentialed CORS (Medium).** Constrain `credentials:true` wildcard‑subdomain CORS (`index.ts:391/398`) to the resolved tenant origin set; document it. _DoD: only known tenant origins with credentials; tested._
- **F4.5 Raw‑error sanitizer (Medium).** 122 sites return raw `error.message` past a 3‑code denylist (gap at `employee.ts:60`). Route all error responses through one allowlist sanitizer; validator fails on raw `error.message`. _DoD: no route returns raw DB errors; validator green._
- **F4.6 Dev bypasses (Low).** Make the dev MFA bypass + OTP echo impossible in production builds (compile‑out/hard‑assert) + documented. _DoD: no bypass reachable in a prod build._

**GATE F4:** ≥129; single credential authority; ops identity (or SKIP+runbook); storefront login hardened; CORS scoped; no raw‑error leakage.

### F5 — TESTING REALITY
*Finding: C‑11 (+ completes N‑3).* 10/12 deployable workspaces still `echo 'No tests yet'`.
- **F5.1** Every deployable workspace's `test` runs real tests (`node --test`/`vitest`/`playwright`); none a no‑op. _DoD: `pnpm turbo test` real in all 12._
- **F5.2** Units for `auth-core`, `billing-core`, `payments`, `checkout-core`, `theme-engine`, `app-engine`, `event-core` — prioritizing this mission's invariants (fail‑closed internal routes, single‑writer, scope enforcement, GST, signature verify, Wasm limits). _DoD: each has meaningful core‑invariant coverage._
- **F5.3** One behavioral CI gate (J1‑J5 + new app/theme/cart paths) on real/ephemeral‑Postgres, not plan mode. Fix the inherited `tests/auth/rbac-categories.test.mjs` `./customer-session` load failure here. _DoD: CI fails if a real journey breaks; rbac test green._
- **F5.4** Ensure plan‑mode load/chaos/cert suite names don't overstate; keep `governance-contract-not-live-evidence` surfaced. _DoD: no suite name overstates._

**GATE F5:** ≥129; real tests in all 12; behavioral gate live; no no‑op scripts; inherited test fixed.

### F6 — OBSERVABILITY, DEPLOY & INFRA INTEGRITY
*Findings: C‑14, H‑15; Mediums: migration roots, partition driver, env honesty.*
- **F6.1 Emit real metrics (C‑14).** SLOs/dashboards reference metrics nothing emits; `writeDataPoint` never called; no OTel/prom‑client; `infrastructure/` untouched. Wire a real producer (Workers Analytics Engine `writeDataPoint` and/or OTel) for ≥ request, queue‑DLQ, replay‑lag — or reconcile the SLO/dashboard contracts to emitted reality. Error tracking where no paid plan needed, else `[SKIP]`. _DoD: SLO stack fed by a real producer or contracts match reality._
- **F6.2 One gated prod deploy (H‑15).** Two workflows race on push‑to‑main; `deploy-production.yml` has no migration job/staging gate. Collapse to one gated pipeline (migrate‑gated → smoke staging → promote, single concurrency group); live steps `[SKIP — NEEDS HUMAN]` with exact commands but the structure lands now. _DoD: one prod path; app deploy can't precede its migration; no racing workflows._
- **F6.3 One migration root + partition driver.** Make `supabase/`(PG15) vs `database/supabase/`(PG17) canonical‑one, archive the other; add the driver for migration 079 `ensure/detach…hot_table_partitions` (cron/scheduled handler) or `[SKIP]` with the exact external command. _DoD: one root; partition lifecycle has a driver or recorded SKIP._
- **F6.4 Environment honesty.** Web apps default base URLs to `*.staging.letbuyy.store`; marketing‑site hardcodes `accounts.staging…`; mobile uses `GEMINI_API_KEY` with no template. Prod URLs from env with safe defaults or fail‑loud; de‑hardcode marketing links; add missing mobile env to template (`[SKIP]` for the value). _DoD: no prod surface silently points at staging; missing env is loud._

**GATE F6:** ≥129; metrics emitted or reconciled; one gated prod deploy; one migration root; env honest.

### F7 — LEGACY, DEAD CODE & DUPLICATION
*Findings: H‑2, H‑8; reports 09/10; AV‑M8.*
- **F7.1 Legacy portfolio/resume (H‑2).** Remove from the commerce product OR feature‑flag + document as legacy + hide from default nav/acquisition; schema archive‑documented, not dropped. _DoD: commerce product no longer surfaces portfolio/resume by default; status documented._
- **F7.2 Remove `@letbuyy/utils` dead edge (H‑8).** 8 apps declare it, 0 import it; it exports a service‑role admin client into app graphs. Remove the dependency; archive the package if fully unused; no service‑role client reachable from app graphs; validator guards it. _DoD: 0 apps depend on it; no service‑role client in any app graph._
- **F7.3 Collapse duplication (report 10 + N‑5).** Single‑source crypto (`storefront.ts:1791/1804/1819` re‑declares `timingSafeEqualHex`/`hmacSha256Hex`/`sha256Hex`; consolidate to one shared module; note `lib/crypto.ts` lacks `sha256Hex`), the 6 per‑app `getApiBaseUrl`/api‑client wrappers, 26 `formatDate`/5 `formatCurrency`/3 `slugify`, the duplicated marketplace `logger.ts`/`MarketplaceUnavailable`, and the WS9 orphan `AppsSettingsContent.tsx`. Remove dead marketing/theme‑editor twin sets. _DoD: one impl each; dead twins removed; tests green._
- **F7.4 Dead‑code sweep + AGENTS.md regen (report 09 + AV‑M8).** Archive/remove confirmed‑dead files (re‑confirm 0 refs at edit time): ~41 unused TS, ~34 Dart, 8 `VERCEL_PROJECT_ID_*`, empty‑proof dirs. Regenerate `AGENTS.md` (not hand‑patch) so its provenance header, counts, package list, and line‑85 web‑app list (add `developer-portal`) are true. _DoD: confirmed‑dead archived with evidence; AGENTS.md regenerated + internally consistent._

**GATE F7:** ≥129; legacy gated; no dead service‑role edge; single‑source utilities; dead code archived; AGENTS.md true.

### F8 — MOBILE PARITY HONESTY
*Finding: H‑3.*
- **F8.1** `operator-app` (Flutter counter demo) + `shopper-app` (empty): remove from governed runtime topology (mark explicitly pre‑implementation) and `[SKIP — NEEDS HUMAN: build operator/shopper scope]`, or ship a real gateway‑wired first screen. Default: reconcile topology + SKIP; don't ship a demo as a governed runtime. _DoD: no governed runtime is a starter demo; status recorded._

**GATE F8:** ≥129; mobile topology honest.

---

## 6. TRACEABILITY MATRIX (every finding resolves; DONE rows are V1‑complete — do not redo)

| ID | Finding | Phase | Disposition |
|----|---------|-------|-------------|
| N‑1 | Internal payment routes fail‑open off‑prod | P1.1 | Fail‑closed all envs + validator |
| N‑2 | Plaintext app secrets in idempotency_keys | P1.2 | Stop persisting/redact/encrypt |
| N‑3 | Orphaned `.ts` security tests | P1.3 | Wire to CI + cover off‑prod case |
| N‑4 | Uncontracted payment.* via internal events | P1.4 | Contract or reject |
| N‑5 | `gateway-events.ts` duplicated | P1.5 | Single shared client |
| N‑6 | Ledger residue in source + dead queue jobs | P1.6 | Archive + reap/stop |
| C‑1 | Monolith | F1.6 (+§2) | Modularize; extraction = SKIP |
| C‑2 | 6 phantom services | — | **DONE (V1)** |
| C‑3 | App tokens one proxy | F2.1 | Scoped app API |
| C‑4 | Compliance webhooks never published | F2.3 | Wire producers |
| C‑5 | App billing no money | F2.4 | Sandbox real; live = SKIP |
| C‑6 | Editor preview unwired | F3.1 | Wire real preview |
| C‑7 | Sections compiled in | F3.3 (+§2) | Data‑driven registry |
| C‑8 | One‑step publish, last‑write‑wins | F3.2 | Split + base_version |
| C‑9 | No embeds / Liquid commerce model | F3.4 (+§2) | Bounded drops + embeds |
| C‑10 | No server cart | F3.5 | Wire carts table |
| C‑11 | Tests document‑shaped | F5 | Real tests everywhere |
| C‑12 | AGENTS.md dead DB | — | **DONE (V1)**; regen residue → F7.4 |
| C‑13 | 3 runtime inventories | — | **DONE (V1)** |
| C‑14 | Observability no producer | F6.1 | Emit or reconcile |
| H‑1 | Dual write‑ownership | — | **DONE (V1)** + validator |
| H‑2 | Legacy portfolio/resume | F7.1 | Remove/flag |
| H‑3 | operator/shopper demos | F8.1 | Reconcile; build = SKIP |
| H‑4 | Theme‑marketplace fake checkout | F3.6 | Real intent/honest |
| H‑5 | Wasm limit unenforced | F2.5 | Enforce |
| H‑6 | No OAuth client auth | F2.2 | client_secret/PKCE/refresh |
| H‑7 | Merchant password verify in app | F4.1 | Server‑side, one hashing impl |
| H‑8 | `@letbuyy/utils` dead edge | F7.2 | Remove |
| H‑9 | `storefront.ts` god file | F1.6 | Finish split |
| H‑10 | Queues no producers | — | **DONE (V1)** |
| H‑11 | payout events no emitter | — | **SKIPPED — NEEDS HUMAN (V1)** |
| H‑12 | Uncontracted theme events | — | **DONE (V1)** |
| H‑13 | No dev CLI/SDK/keys | F2.6 | No‑cred parts real; CLI = SKIP |
| H‑14 | Hardcoded demo store | F3.7 | Isolate |
| H‑15 | Racing prod deploys | F6.2 | One gated pipeline |
| H‑16 | Static bearer ops plane | F4.2 | Per‑operator identity (or SKIP+runbook) |
| H‑17 | Storefront login unprotected | F4.3 (+P1.1) | Rate‑limit + secret all envs |

Mediums/Lows (CORS, error‑leakage, FEATURE‑flags, migration roots, partition driver, env honesty, dev bypasses, AV‑M8 AGENTS regen, orphan tables, B‑6 preview‑session) are folded into the phases above and must each end DONE or SKIP in the ledger.

---

## 7. FINAL GATE (mark COMPLETE only when all true)

- `pnpm turbo typecheck` — PASS
- `pnpm run validate:governance` — **≥129 PASS** (add fail‑closed‑internal / no‑secret‑persistence / no‑no‑op‑test / single‑source‑crypto validators as you establish those invariants — never fewer)
- `pnpm lint` — PASS
- `pnpm turbo build` — PASS, no network fetch
- `pnpm turbo test` — real tests pass in **all 12** deployable workspaces; security‑critical packages have units; **every `tests/contracts/*.test.ts` runs in CI**
- Behavioral journeys (J1‑J5 + app/theme/cart) — PASS on real/staging or ephemeral Postgres (live‑only remainder = recorded SKIP)
- **P‑1 regression gate green:** internal routes fail closed all envs; no replayable plaintext secret; N‑1 case asserted by a running test
- **Traceability matrix:** every `C‑*/H‑*/N‑*` is DONE or SKIPPED — NEEDS HUMAN with evidence
- **Honesty audit:** no `runtime.manifest.json`, `AGENTS.md`, `CLAUDE.md`, SLO/dashboard, or test name asserts a capability that doesn't exist
- `CODEX_FOUNDATION_HARDENING_STATUS.md` summarizes the V2 run + every human‑gated remainder with exact commands

Mark COMPLETE only if the foundation is **honest** (nothing overstated), **safe** (no V1 regression open; internal routes fail closed; no replayable secrets), and **capable** (app platform, theme extensibility, cart, observability real or honestly gated). Everything that genuinely needs a human is recorded — not faked, not skipped silently.
