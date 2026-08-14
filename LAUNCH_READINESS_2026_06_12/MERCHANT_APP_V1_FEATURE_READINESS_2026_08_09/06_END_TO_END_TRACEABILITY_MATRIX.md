# 06 — END-TO-END TRACEABILITY MATRIX

**Package:** `MERCHANT_APP_V1_FEATURE_READINESS_2026_08_09` · **Date:** 2026-08-09
**Audited commit:** `ee371182` (`stepup/main`)
**Authority:** Evidence package. Subordinate to DOC 01 (Constitution), root `AGENTS.md`, DOC 03.

A feature is a **vertical slice**, not a screen. This document traces each slice and then answers
the only question that matters for launch: **which of the 20 required end-to-end scenarios has an
executing automated test?**

Legend: `✔` present and evidenced · `~` present but unproven · `✖` absent · `n/a` not applicable.

---

## 1. The 20 required scenarios — scenario coverage is the launch gate

| # | Scenario | Automated test that **executes** | Status |
|---|---|---|---|
| 1 | New merchant signs up securely | none end-to-end; unit coverage only | ✖ |
| 2 | Merchant creates a store | none end-to-end | ✖ |
| 3 | Merchant creates a product with inventory | none end-to-end | ✖ |
| 4 | Product appears on the public storefront | none — **and host routing is dead code** (§3) | ✖ |
| 5 | Buyer adds to cart | none end-to-end | ✖ |
| 6 | Server recomputes totals | `checkout` unit/contract tests (mocked client) | ~ |
| 7 | Buyer completes COD or sandbox payment | none end-to-end | ✖ |
| 8 | Exactly one order is created | none end-to-end | ✖ |
| 9 | Inventory reserves/commits correctly | `tests/executable` money/tenant suites touch adjacent RPCs; no reserve→commit E2E | ~ |
| 10 | Money effect posts exactly once | **`foundation-wave1-money-postgres`** — double-release guard + derived-balance insufficiency, on real Postgres | **✔** |
| 11 | Merchant sees the order in the mobile app | the only mobile integration test is **skipped** (§2) | ✖ |
| 12 | Merchant fulfils with tracking | none end-to-end | ✖ |
| 13 | Buyer sees updated status | none end-to-end | ✖ |
| 14 | Notification dispatched or honestly sandboxed | provider is unconnected; honesty sentinels verified | ~ |
| 15 | **Cross-tenant access fails** | **`tenant-redteam-postgres` RT-1…RT-9** under `app_tenant` + raw-REST roles | **✔** |
| 16 | Duplicate mutation/webhook ⇒ one effect | partial — money idempotency proven at RPC level (#10); no webhook-replay E2E | ~ |
| 17 | Network failure ⇒ retryable truthful UI | Flutter widget tests cover error states on several screens | ~ |
| 18 | Expired/invalid session fails closed | **`foundation-wave4-session-postgres`** — rotates, rejects reuse, rolls back | **✔** |
| 19 | Deep links cannot bypass capability gates | **no test, and the design cannot currently satisfy it** (§4) | ✖ |
| 20 | Excluded V1 features unreachable / not marketed | no test; no capability-policy layer exists (§4) | ✖ |

**Score: 3 of 20 proven. 5 partial. 12 absent.**

All three proven scenarios are **database-layer** proofs on the ephemeral Postgres fixture. **Not
one scenario that crosses an HTTP boundary is proven**, because no application runtime was booted
(doc 11 §2) and no CI runs on the active branch.

This single table is the reason the verdict in doc 15 is NO-GO. It is not that the code is absent —
much of it is present and well-built — it is that the merchant→buyer journey has never been
executed end-to-end anywhere.

## 2. Why mobile scenarios cannot currently be proven

```
apps/mobile/merchant-app/integration_test/merchant_happy_path_test.dart:123
    skip: !AppConfig.hasTurnstileToken

dart-defines/staging.json     TURNSTILE_TOKEN = SKIP_NEEDS_HUMAN_MOBILE_TURNSTILE_TOKEN
dart-defines/production.json  TURNSTILE_TOKEN = SKIP_NEEDS_HUMAN_MOBILE_TURNSTILE_TOKEN
```

The merchant app's **only** integration test is skipped in **every checked-in configuration**. Its
164 passing tests are unit and widget tests against mocked services.

Under the scoring model a skipped test contributes **zero**, and "no automated happy-path
integration test" caps a capability at **69**. Therefore **no mobile capability can exceed 69**, and
no mobile capability can be launch-proven, regardless of how complete its code is.

**This is the highest-leverage fix in the entire program**: making that one test execute — with a
Turnstile test key or an injected test double — lifts the cap on the whole mobile surface. It is
also why doc 15's verdict is driven by verification, not construction.

## 3. The buyer-facing chain is broken in two places

Traced personally, end to end:

| Layer | State | Evidence |
|---|---|---|
| Merchant publishes | ✔ writes `status='published'`, `published_at`, **and now `published`** | `stores.ts:780-790`, `:823-828` (fixed this program) |
| Host → store routing | **✖ dead code** | `apps/storefront-runtime/src/middleware.ts` does not exist; no file invokes `proxy(`; yet `proxy.ts:61` exports `config.matcher` and `:300` exports `proxy()` |
| Access resolution | ~ requires `published` **and** `status==='published'` | `proxy.ts:380-381,392` |
| `sites.published` writer | ✔ **fixed this program** — previously readers-only | readers: `proxy.ts:380,392`, `robots.ts:34`, `sitemap.ts:22`, `seo.ts:57`; writers: none before this program |
| Merchant admin's view of "published" | ⚠ lenient `||` — would have shown "published" while the storefront denied | `merchant-control-plane/.../domains/page.tsx:78` |
| Storefront render | ~ present, unreachable by host | `apps/storefront-runtime/src/app/store/[subdomain]/**` |

**The two defects masked each other.** Nothing 401s today only because nothing routes by host at
all. Fixing the middleware alone would have taken the platform from "storefronts unreachable" to
"storefronts 401 for everyone", with the admin UI still reporting success. They must ship together
with a back-fill (doc 12 §6).

## 4. V1 exclusion cannot currently be enforced — the gating gap

Scenarios 19 and 20 fail by construction, not by oversight:

| Component | State |
|---|---|
| `CapabilityGate` widget (`lib/widgets/shared/capability_gate.dart`) | **Exists and is good** — `FeatureAvailability` = `available` / `temporarilyUnavailable` / `desktopHandoff` / `providerSetupRequired`, honest copy, already unit-tested |
| A **policy source** deciding which capability is in V1 | **✖ does not exist.** Both current usages hardcode a value; `AppConfig` has no feature flags at all |
| `StaffRoleGate` (`lib/app/role_gate.dart`) | Exists, but it is **staff-role** gating (owner/admin/manager/…), not capability gating |
| Route registry (`lib/app/routes.dart`) | **91 registered routes, 36 of them `/features/*` aliases; 31 screens reachable by 2–3 distinct paths.** `AppsScreen` is reachable by **three** |

So hiding a feature from navigation would leave it reachable by deep link through an alias.
**Any V1 exclusion must be enforced at route resolution** (`AppRoutes.generateRoute`, which is the
single choke point for both primary and `/features/*` paths), keyed by capability, wrapping the
excluded screen in `CapabilityGate` — not by editing navigation lists.

The primitive exists; the policy layer must be built. Registered as a mandatory V1 item in doc 04.

## 5. Slice traceability — the frozen-candidate surfaces

`M` = mobile merchant app · `W` = merchant-control-plane (web).

| Slice | Merchant UI | Client service | Endpoint | Persistence | Buyer effect | Executing test |
|---|---|---|---|---|---|---|
| Auth: signup/OTP/login | M ✔ / W ✔ | `store_auth_service.dart` (tokens → `FlutterSecureStorage`) | `identity-platform` (sole ES256 issuer) | `users_custom`, sessions | n/a | unit ✔ / E2E ✖ |
| Store create + publish | M ✔ / W ✔ | `store_service.dart` | `POST /stores`, `POST /stores/:id/publish` | `sites` (`status`, `published_at`, `published`) | gates storefront | ✖ (7 gateway tests currently red — §6) |
| Products CRUD | M ✔ / W ✔ | `product_service` | `/products` | `products` | storefront render | unit ✔ / E2E ✖ |
| Inventory + reservations | M ✔ / W ✔ | inventory service | `/inventory` | reserve→commit RPCs, row locks | oversell prevention | partial (RPC-level) |
| Orders list/detail/status | M ✔ / W ✔ | `order_service` | `/orders` | `orders`, `order_items` | buyer status | unit ✔ / E2E ✖ |
| Fulfilment + tracking | M ✔ / W ✔ | — | `/orders/:id/fulfil` | tracking fields | buyer sees tracking | ✖ |
| Money: capture/COD/ledger | — | — | `/payments`, webhooks | **canonical append-only ledger** | order paid | **✔ real Postgres** |
| Refunds | **✖ no UI anywhere** | — | route exists, 428s without step-up | ledger reversing entry | refund email absent | ✖ |
| Taxes / GST | M ✔ / W ✔ | `shipping_tax_service` | `/tax` | `tax_rates`, `sites.tax_inclusive` | invoice totals | widget ✔ (fixed this program) |
| Theme editor | M ✔ / W ✔ | theme service | `/themes` | `theme_releases`, `sites.template_config` | storefront render | theme-engine ✔ |
| **App marketplace / App Bridge** | **M ✔ (3 routes)** | `AppMarketplaceService` | `/app-store/**` mounted in the monolith | installations | — | **FORBIDDEN — see doc 05** |

## 6. Traceability blocked by in-flight work

Seven gateway tests currently fail, including four that would otherwise evidence the store-publish
and storefront-resolver slices above. All seven are **source-regex assertions** pinning the old
inline `.or(...)` string that the user's uncommitted PostgREST filter-injection hardening replaced.

They are not behavioural failures, and this program did not repair them because the refactor is
**half-applied** (`stores.ts` converted; ~10 other gateway files still use the unquoted pattern).
Full detail in doc 09 §6.

**Consequence for this matrix:** the store-publish slice cannot be marked evidenced until either the
refactor is completed and the assertions updated, or — better — those source-regex tests are
replaced with behavioural ones. Asserting that a string appears in a file is barely stronger than
the file-presence checks TEST-R10 forbids, and it actively penalises correct security refactors.
