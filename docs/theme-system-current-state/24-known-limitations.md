# 24 — Known Limitations

> **Date:** 2026-08-05. Everything below is a known, evidenced gap. Nothing here is speculative, and
> nothing that is broken is described as working.

---

## 1. Liquid data-binding failures — **RESOLVED**

The four failures (`liquid-l3-compiler`, `l5-product`, `l6-collection`, `l7-search`) are **fixed**. They
were never data-binding defects.

**Root cause.** LiquidJS `renderLimit` is a **wall-clock** budget, not CPU time. It was 250 ms. Sections
render concurrently via `Promise.all` while `sanitizeRenderedHtml` runs jsdom + DOMPurify
**synchronously**, so a trivial section is aborted because a *sibling* starved the event loop.
`sections/product-detail.liquid` renders in **2.9 ms in isolation under the same 250 ms limit** yet was
replaced by an `lb:section-error` placeholder — producing a correct shell with empty product containers.

**Residual limitation:** the concurrency itself is unfixed. The project's own F9 benchmark shows the
parallel path is **~5× slower** than sequential (227 ms vs 42 ms for N=25). Raising the budget removes the
symptom; sanitizing off the render path or rendering sequentially is the real fix.
[25](25-follow-up-backlog.md) P1.

---

## 2. Open Graph and favicon meta cannot be emitted

The WHOLE_DOCUMENT DOMPurify pass allowlists `name` and `content` on `<meta>` but **not `property`, and
not `rel` on `<link>`**. `<meta property="og:title" …>` survives sanitization as `<meta content="…">` and
`<link rel="icon" …>` as `<link href="…">` — malformed markup no crawler can use.

These tags were **removed rather than shipped broken**. `twitter:*` uses `name=` and renders intact.

**To restore:** add `property` and `rel` to `ADD_ATTR` in `theme-renderer.ts` — a sanitizer-allowlist
change and therefore an **ARB gate** under THEME-R4 / SEC-R11.

---

## 3. Customer auth — bounded contract analysis [HIGH-STAKES]

No orphaned templates were added. This is the contract analysis required before anything is built.

### 3.1 `customers/reset_password` — backend complete, **storefront route missing**

| Question | Finding |
|---|---|
| **Route owner** | `apps/storefront-runtime` — the gateway default reset URL is `/account/reset-password` (`customer-engagement-routes.ts:240`). `apps/storefront-runtime/src/app/store/[subdomain]/account/` contains `addresses`, `orders`, `settings`, `wishlist` — **no `reset-password`, no `forgot-password`** |
| **Does identity-platform already expose it?** | It exposes `reset-password`, `send-reset`, `set-password` — but those are the **merchant realm (ES256)**. Reusing them for shoppers would cross the issuer boundary (ART-05 / IDN-R4 / ARCH-R18). **Must not be reused** |
| **Required gateway routes** | Already exist and are complete: `POST /customer/password/request-reset` (`:446`), `POST /customer/password/confirm-reset` (`:522`). **No new gateway route is required** |
| **Customer HS256 session** | Unchanged. Confirm-reset updates the credential; session issuance stays with `issueCustomerSession` |
| **Token format** | 32 random bytes (`CUSTOMER_PASSWORD_RESET_TOKEN_BYTES = 32`), stored only as `hashCustomerPasswordResetToken(CUSTOMER_SESSION_SECRET, store_id, email, token)` — HMAC-bound to **store and email** |
| **Expiry** | `CUSTOMER_PASSWORD_RESET_TTL_SECONDS = 3600` (1 h); `reset_expires_at` enforced with `.gt('reset_expires_at', now)` |
| **One-time use / replay** | ✅ matched on `reset_used_at IS NULL`, then burned (`reset_token_hash = null, reset_used_at = now`). Migration `077` adds the columns and partial indexes |
| **Turnstile / rate limit** | `enforceCustomerAuthRateLimit` ✅ on both routes. **Turnstile is NOT enforced** on request-reset — a gap versus login/register, and an ARB question |
| **Email-link generation** | `customerPasswordResetUrl(...)` with a `reset_url` override; sender is the Resend adapter |
| **Tenant/site binding** | ✅ `store_id` required on both routes; token hash includes it; lookups filter on it |
| **Redirect / error behaviour** | Undefined — no UI exists to define it |
| **No-JavaScript behaviour** | **Undefined and at risk.** Liquid login/register already fail without JS because the sections ship no Turnstile widget. A reset form must be a real `POST` |
| **Required Liquid templates/sections** | `templates/customers/reset_password.json` + a `customer-reset-password` section (request + confirm), and a forgot-password entry point from login |
| **Required React fallback** | Yes — and it must actually render, unlike the 22 sections whose `rendererKey` never matches |
| **Required tests** | Token expiry, one-time use, cross-store token rejection, rate limiting, no-JS POST, tenant isolation |
| **Public contract or migration?** | **Neither.** Routes and schema already exist |
| **ARB decisions needed** | (a) Turnstile on request-reset? (b) Is a `/account/reset-password` storefront route in scope? (c) Does the no-JS path block until the Turnstile widget gap is closed? |

**Verdict: `Blocked by missing platform route`.** The backend is well built — tenant-bound, hashed,
expiring, one-time, rate-limited. Only the UI route is absent.

### 3.2 `customers/activate_account` — **no platform contract at all**

Searching `services/api-gateway/src`, `apps/identity-platform/src` and `packages` for
`activate_account` / `activateAccount` / `activation_token` returns **one** hit:
`packages/theme-engine/src/template-registry.ts` — i.e. the template *type* is registered and nothing
implements it.

| Question | Finding |
|---|---|
| Route owner | Undecided |
| identity-platform support | None for the customer realm |
| Required gateway routes | **All of them** — issue activation, verify activation, set initial password |
| Token semantics | Undefined; would need format, TTL, one-time use, replay prevention |
| Turnstile / rate limit | Undefined |
| Email-link generation | Undefined |
| Tenant binding | Undefined |
| No-JS behaviour | Undefined |
| Public contract / migration | **Both likely required** — new endpoints and probably new columns |
| ARB decisions | Whether shopper accounts need activation at all; if so, the whole contract |

**Verdict: `Not implemented`.** Materially larger than reset-password: a full auth feature, not a UI gap.

> **Neither template was added.** An orphaned template implies a capability that has no route.

---

## 4. Mapped-but-absent sections

`instagramFeed` → `instagram-feed` and `videoHero` → `video-hero` have schemas and kebab mappings but no
Liquid file in either engine. A merchant or generator emitting one gets an "incompatible" diff entry.

They now carry the **mapped-but-absent regression coverage** that `faqAccordion` and `collectionFilter`
used to provide, so the branch stays tested.

---

## 5. Governance — gate is red

**23 of 107 validators fail.** Not "green", and not a regression: **22 fail at clean `HEAD`**, 2 more are
caused by user-owned untracked files, and 1 (`single-source-crypto`) was fixed here.

Two remain theme-adjacent and unfixed:

| Validator | Why not fixed |
|---|---|
| `environment-validator` | **False positive.** The flagged literals (`'sk_live_should_never…reach_liquid'`, `'whsec_must_never_render'`) are **negative-test fixtures asserting credentials never reach Liquid output**. Redacting them would weaken the security tests. Correct fix is a validator test-fixture allowlist |
| `route-line-count-validator` | `routes/themes.ts` is 1 870 lines against a 1 500 limit. A 370-line extraction across every theme endpoint is not low-risk at this stage |

Full table with owners and dispositions: [21](21-final-test-evidence.md) §3.

---

## 6. Benchmark flakiness — test infrastructure, not product

`Urban Kicks fixture renders N=25 times within 30000ms budget` failed once in a full-suite run and passed
on every isolated and subsequent run (**711 ms** against a **30 000 ms** budget — a 42× margin).

Node's runner executes test files concurrently in one process pool, and `sanitizeRenderedHtml` runs
jsdom + DOMPurify synchronously, so a sibling file's work is charged to this test's **wall-clock**.

**The budget was deliberately not raised** — that would weaken a real performance contract to hide a
harness property. Deterministic isolation needs a CI topology change (own process / `--test-concurrency`),
which is out of scope here. **Disposition: test-infrastructure flakiness. Neither a product pass nor a
product failure.**

---

## 7. Unverified checkout, COD and Razorpay paths

| Path | Status |
|---|---|
| Razorpay capture / verify | **Unverified.** Server-side HMAC verification exists; there is **no mock/sandbox adapter**, so it cannot be exercised offline. Live payments prohibited |
| COD | **Unverified**, and ARB-gated — `cod_receivable` is only touched at remittance, where it is *debited*; no origination entry credits it |
| Signed cart handoff | Implemented, tested, **orphaned** — no first-party client uses it |
| Live order-create | Accepts raw `items[]` with no cart binding or session. Server-authoritative **pricing** does hold |
| GST | Computes to **zero** on every live order (the client never sends `address.stateCode`); invoices never issued |
| Provider-mode honesty badge | Absent on the storefront money surface (UI-R6 / PAY-R10 unmet buyer-side) |

---

## 8. Fresh-database limitations

| Item | Status |
|---|---|
| Migration replay | ✅ 124 from zero, 0 failures, 438 tables |
| `letbuyy-core` on a fresh DB | ✅ **fixed by migration 197** — previously absent, because 188 clones from a row the *seed* creates and seeds run after migrations |
| Seed manifest shape | ⚠️ `seeds/urban-kicks-theme.sql` writes a lossy `section_schemas` shape that **overrides** the engine registry (the engine merges DB schemas *after* built-ins), making `validateThemeSectionSettings` reject real settings; its `settings_schema` is the bare 1-field shape. **Not fixed** — outside theme-engine ownership |
| Production DB state | ❓ **Unknown.** Whether migration 188 ever produced a `letbuyy-core` row in production was not probed |
| Local DB provenance | The pre-reset database had been hand-edited outside any code path (three writes at 13:30:32 with zero audit/outbox rows). The reset removed that damage |

---

## 9. Verification not performed

| Not done | Consequence |
|---|---|
| Browser/E2E at ~360 px, tablet, desktop | Every preset is `Complete but not runtime-verified` |
| Screen-reader + contrast audit | Accessibility is structural only |
| Clean-checkout build | HEAD buildability is **inferred, not proven** — the `node:crypto`/`jsdom` fix lives in two **uncommitted** `next.config.ts` files and one **untracked** stub. If HEAD ships as-is, it ships without that fix |
| Production probe | Production theme state unknown |
| Full `validate-governance.mjs` | Destroys `node_modules`; equivalent signal obtained validator-by-validator |
