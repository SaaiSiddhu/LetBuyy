# 05 — V1 SCOPE FREEZE AND EXCLUSIONS

**Package:** `MERCHANT_APP_V1_FEATURE_READINESS_2026_08_09` · **Date:** 2026-08-09
**Audited commit:** `bf35062e` (`stepup/main`)
**Authority:** Evidence package. Subordinate to DOC 01 (Constitution), root `AGENTS.md`, DOC 03.
This document freezes a **scope**. It does not amend the Constitution, alter a canonical winner,
or reopen a frozen capability.

---

## 1. The finding that shapes the whole freeze

The mandate was: find what is genuinely past 70%, finish it, add the indispensable foundations, hide
the rest, launch small. Applying that honestly to `bf35062e` produces an uncomfortable result.

**188 capabilities. Mean score 45.5. Nineteen at ≥70. None above 89. None launch-proven.**

But the shape matters more than the numbers. The largest cluster — **78 capabilities at 50–69** —
is real, wired, tenant-aware code that **cannot be proven to work**. And the reason is nearly always
the same single cap: *no automated happy-path integration test.*

> **LetBuyy's V1 problem is verification, not construction.**

The clearest instance: the merchant app has 151 Dart files, 91 routes, `flutter analyze` clean and
**164/164 tests green** — and its only integration test is `skip:`-ed in every checked-in
configuration, so **no mobile capability can score above 69**. The app is not unfinished. It is
unproven.

That distinction drives every decision below.

## 2. Scope selection, applied

### 2.1 Group A — capabilities scoring ≥ 70

Nineteen qualified on the auditors' first pass; each was then handed to an adversarial verifier
instructed to falsify the score. The corrected list and the falsification results are in
[`03_70_PERCENT_PLUS_V1_CANDIDATES.md`](03_70_PERCENT_PLUS_V1_CANDIDATES.md), which governs where it
differs from doc 02.

What Group A actually contains is striking: it is **almost entirely infrastructure and invariants**,
not merchant features.

| Category | Members |
|---|---|
| Money kernel | canonical double-entry ledger (82), fail-closed with no credentials (80), `commission_bps = 0` (74), canonical money RPCs (71) |
| Security / tenancy | merchant/customer realm separation (76), secret handling (74), Turnstile (72) |
| Theme | sanitizer + Liquid sandbox (82), renderer selection (74), React section registry (70), **web** theme editor (72) |
| Governance | evidence-package placement law (78), decision-class escalation (74), freeze protocol (72), frozen-app containment (74) |
| Commerce | inventory reservations + oversell prevention (72) |
| Infra | Worker configuration (71), local dev environment (70), domains/custom-domain connect (70) |

**Exactly one merchant-facing feature clears 70: inventory reservations.** Not products, not orders,
not fulfilment, not customers, not discounts. Those all sit at 50–69, capped by missing integration
evidence.

A V1 cannot be assembled from Group A alone — it contains no coherent merchant journey.

### 2.2 Group B — mandatory foundations regardless of score

Registered in full in [`04_MANDATORY_V1_LAUNCH_FEATURE_REGISTER.md`](04_MANDATORY_V1_LAUNCH_FEATURE_REGISTER.md).
**Eleven are at 0** and are genuine builds; **four more are actively violated** and need removal or
an ARB waiver rather than construction.

## 3. THE FROZEN V1 SCOPE

**LetBuyy V1 is the web merchant platform plus the buyer storefront. The Flutter merchant app is a
V1.1 companion release, gated on the four items in §3.3.**

This confirms the prior scope lock's classification of the mobile app as post-V1 — but for
**materially different and better-evidenced reasons**, and with a much shorter path (see §6).

### 3.1 In scope — must reach launch-proven

| # | Capability | Today | What "done" means |
|---|---|---|---|
| V1-01 | Merchant signup / login / session / logout | ~62 | Single issuer (`IDN-S0-1` closed); executing E2E |
| V1-02 | Store creation and publication | fixed | A published store is actually reachable |
| V1-03 | **Storefront host routing** | **0** | `middleware.ts` + `sites.published` + back-fill, shipped together |
| V1-04 | Products + inventory (single-variant) | ~60 | Create in admin → visible on the storefront, proven |
| V1-05 | Cart → server-authoritative checkout → order | ~65 | Totals recomputed server-side; exactly one order |
| V1-06 | Payments: Razorpay + COD | ~65 | One real sandbox transaction with one ledger effect |
| V1-07 | Canonical ledger posting | 82 | **`MNY-S0-001` closed** — one writer to `merchant_payable` |
| V1-08 | Orders list/detail/status | ~62 | Executing E2E |
| V1-09 | Fulfilment with tracking | ~58 | Merchant fulfils; buyer sees it |
| V1-10 | Buyer order emails | ~55 | Delivered, or honestly badged sandbox |
| V1-11 | **Refund path incl. merchant UI + step-up UI** | **0** | Both refund legs gated; cross-tenant exposure closed |
| V1-12 | Tenant isolation | proven (partial) | 22 permissive policies removed; `withTenantTx` actually used |
| V1-13 | Coupons | ~65 | Server-authoritative |
| V1-14 | GST computation + invoice | partial | Engine invoked at order confirm |
| V1-15 | Shipping zones/rates honoured at checkout | partial | Merchant rates actually used |
| V1-16 | Theme editor (web) + one theme | 72 | Reaches the live store |
| V1-17 | **Account deletion (in-app + web)** | **0** | Required even for web-first — Play policy applies to any app; the web resource is needed regardless |
| V1-18 | Privacy policy + terms live | 0 | Real content at the linked URLs |
| V1-19 | **Deployable pipeline** | blocked | Branch lag 0; CI on the working branch; gate green with all 108 validators executing |
| V1-20 | Monitoring / crash reporting | 0 | Connected, not sentinel |

### 3.2 Explicitly excluded from V1 — hidden or gated, not deleted

| Capability | Disposition | Why |
|---|---|---|
| Multi-variant products | DEFER V1.1 | Variant write path incomplete; ship single-variant |
| Collections browsing | DEFER V1.1 | No write path, no storefront route |
| Gift cards | **HIDE** | Split-table defect makes issued codes unredeemable |
| Merchant-entered Razorpay keys | **HIDE** | Checkout reads platform env only; the pane misleads |
| Purchase orders · transfers · multi-location | **GATE** | Already honest stubs; keep them honest |
| Merchant staff roles | **HIDE** | Invite has no acceptance page; role enforcement inert — ship owner-only |
| WhatsApp / SMS / push | **HIDE** | Push structurally absent; WhatsApp sandbox-locked |
| AI screens | **GATE** | Sandbox templates, no live key |
| Stripe / PayPal / Cashfree | **REMOVE from UI** | Not viable paths |
| Liquid renderer default | **KEEP OFF** | ART-17/THEME-R6 gate not met |
| GraphQL | **KEEP OFF** | Correctly `"false"` in production |
| Subscriptions · multi-currency · headless · reseller | DEFER | Not built |

### 3.3 The Flutter merchant app — V1.1, gated on exactly four items

The app is **not** frozen and **not** forbidden. `LETBUYY_CANONICAL_SYSTEMS.md:99,261` names it the
canonical Mobile winner, and `config/runtime/production-topology.json:139-148` already carries it as
`environment: production, status: active`. Its exclusion is a **sequencing** decision, not a
constitutional one.

It ships as V1.1 the moment these four close:

| # | Gate | Today |
|---|---|---|
| MOB-G1 | **An executing integration test** (lifts the 69 cap on the entire mobile surface) | skipped in every configuration |
| MOB-G2 | **iOS privacy manifest + iOS signed-release pipeline** | both absent |
| MOB-G3 | **Account deletion** (shared with V1-17) | absent |
| MOB-G4 | **The App Bridge decision** (§4) | violation live |

Everything else the prior scope lock cited as the reason for V2 — push and store signing — is
either accepted (push is out of V1 scope and must not be claimed) or pure provisioning (H-17).
**The remaining gap is verification and store compliance, not features.**

## 4. Forbidden — never admitted to any V1, regardless of completeness

The most consequential finding of the program.

**The app-marketplace / developer-platform / checkout-extension surface is live**, and it is
forbidden by ART-22, ART-16, NEVER-R3 and R-12:

- `services/api-gateway/src/index.ts:727` mounts `/app-store` **inside the canonical monolith**;
  the router tree includes `extension-routes.ts`, `developer-routes.ts`,
  `developer-tooling-routes.ts`, `billing-oauth-routes.ts`.
- Production **does** set `FEATURE_EXTENSIONS="false"` (`wrangler.toml:246-248`) — but
  `extensionsFeatureGate` (`index.ts:714-716`) covers only the `/extensions` paths. **It does not
  cover `POST /app-store/installations/:id/embed-session` (`extension-routes.ts:298`) or
  `POST /app-store/bridge/fetch` (`extension-routes.ts:403`)**, which remain reachable in production.
- `apps/mobile/merchant-app/lib/screens/apps/app_bridge_runtime_screen.dart` loads a third-party
  `app.appUrl` in a WebView, calls `_injectBridge()` and `runJavaScript(...)`, and routes page
  JavaScript into `_handleBridgeFetch` → `fetchEmbeddedBridgeData(session, path)` — **remote
  third-party code driving a merchant-session-scoped data proxy with an attacker-controllable path**.
- The `CapabilityGate` on that screen (`:100`) renders only an **error state**; it does not gate it.
- `AppsScreen` is reachable by **three** registered routes.

This is simultaneously a constitutional violation and an S1 security exposure. **Disposition:
hard-gate immediately; removal is an ARB decision (Class A adjacent), recorded as `H-29`.**

Also permanently excluded: CQRS/event-sourcing/saga · multi-region · sharding · service mesh ·
self-custody payout rail · cross-merchant wallet · any GMV/transaction fee · headless Hydrogen tier ·
full in-WhatsApp commerce · OIDC/passkeys · filling the six reserved services (verified compliant —
all six are manifest-only).

## 5. How exclusions must be enforced — the gating gap

**Hiding a nav item is not sufficient.** Measured from `lib/app/routes.dart`:

```
91 registered routes · 36 of them /features/* aliases
31 screens reachable via 2-3 distinct paths
AppsScreen reachable via 3
```

And the policy layer does not exist:

| Component | State |
|---|---|
| `CapabilityGate` widget | **Exists and is well-built** — `available` / `temporarilyUnavailable` / `desktopHandoff` / `providerSetupRequired`, honest copy, unit-tested |
| A policy source | **Absent.** Both usages hardcode a value; `AppConfig` has no feature flags |
| `StaffRoleGate` | Staff-role gating only, not capability gating |

**Required design:** a single `V1CapabilityPolicy` consulted inside `AppRoutes.generateRoute` — the
one choke point covering both primary and `/features/*` paths — returning a `FeatureAvailability`
per capability, with excluded screens wrapped in `CapabilityGate`. Web surfaces need the equivalent
at their route boundary. Registered as mandatory item **A-02**.

Until that exists, **scenarios 19 and 20 cannot pass** and no exclusion claim is credible.

## 6. Supersession and change control

This package **does not delete or overwrite** `V1_SCOPE_LOCK_2026_06_12/LETBUYY_V1_SCOPE_LOCK.md`.

**Prior hypothesis** (`LETBUYY_V1_SCOPE_LOCK.md:77`): *"`apps/mobile/merchant-app` | V2 | 68% | Login
unblocked in code, but push structurally absent + store signing unprovisioned."*

**Re-tested at `bf35062e`: CONFIRMED as to the conclusion, CORRECTED as to the reasons.**

| Prior reason | Status now |
|---|---|
| Push structurally absent | **Confirmed** — no FCM/APNs in `pubspec.yaml`; `MOBILE_PUSH_DEVICE_TOKEN` empty in both dart-defines. But push is **not a V1 requirement** — it is only a reason to exclude if the listing claims it |
| Store signing unprovisioned | **Confirmed, and it is provisioning, not engineering** — the pipeline exists and correctly fails closed |
| ~68% complete | **Superseded.** The ceiling is not completeness; it is a **hard evidence cap at 69** from a skipped integration test |
| *(not previously identified)* | **iOS has no release pipeline at all** — release workflow is Android-only |
| *(not previously identified)* | **No iOS privacy manifest** — Apple rejects; the app uses required-reason APIs |
| *(not previously identified)* | **No account deletion anywhere** — both stores reject |
| *(not previously identified)* | **A forbidden App Bridge executes remote third-party JavaScript** |

**Change-control record:** the mobile-app V2 classification is **UPHELD**, restated as **V1.1 gated
on MOB-G1…MOB-G4** (§3.3). The decision class is **Class B (Operative)** under
`LETBUYY_CONSTITUTION.md:338` — a roadmap sequencing choice touching go-live gates, requiring ARB
review, **not** a constitutional amendment. It would be Class A only if it activated a reserved
mobile root, minted tokens outside `identity-platform`, added a runtime, or flipped the Liquid
default. It does none of those.

Registration duties: linked from `000_LAUNCH_READINESS_INDEX.md`; no `PROMPTS.md` row required (no
basename matches the prompt-class regex `MISSION|PROMPT|BLUEPRINT|MASTERPLAN|DELETION` — the same
report-class reasoning recorded at `LETBUYY_V1_SCOPE_LOCK.md:6`); `EXECUTION_LEDGER.md` row appended.

## 7. The freeze

After this document:

- **No optional capability enters V1** because an agent discovers it.
- **Defects required to complete a frozen V1 capability remain in scope.**
- **Security, tenancy, money correctness and deployability are always in scope**, frozen or not.
- Proposed additions are recorded, **not implemented**, during this launch run.

**Two decisions are genuinely the ARB's and were deliberately not made here:** whether to accept the
web-first V1 with mobile at V1.1 (§3.3), and what happens to the App Bridge (§4). Everything else in
this program proceeded without waiting on them.
