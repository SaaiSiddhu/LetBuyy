# Phase 0 — Evidence Normalization & Migration Plan
## UI Feedback / Status / Validation Canonicalization

**Date:** 2026-08-16 · **Status:** READ-ONLY. No production code modified. **Awaiting approval before Phase 1.**

**Method:** authority chain read by the lead; 8 parallel evidence researchers → 3 adversarial adjudicators
(11 agents, ~2.2M tokens, 722 tool calls). Adjudicators rejected 17 claims and reclassified 23 — those
corrections are applied below, not appended.

---

## 0. Authority chain — read and applied

| Level | Document | What it settles for this program |
|---|---|---|
| 1 | `LETBUYY_CONSTITUTION.md` | ART-20: ONE token source `tokens.ts`; ONE shell `AppNavigation`; systemic `ProviderModeBadge` rendering **`mock/sandbox/live`** (:73, :276). Forbids a money surface without a truthful badge (:278). |
| 2 | root `AGENTS.md` | UI-R1…R7, PAY-R10, ANTI-R1/R9, PRIME-R3, WIN-R4, TEST-R7. UI-R6 repeats **`mock/sandbox/live`**. |
| 4 | `LETBUYY_CANONICAL_SYSTEMS.md` (DOC 03) | App disposition; Design System = row 35 CANONICAL. |
| 5 | `LETBUYY_UI_UX_GOVERNANCE.md` (DOC 06) | UX-R1…R33, the enforceable rule table. **Self-subordinating** (§0). |

**Sequencing law (DOC 06 §10) — binding on this plan.** Design-system unification is debt-paydown at
**Phase 7 / Waves 4–5 and does NOT block go-live.** Exactly two things move earlier:
1. **UX-R4 provider-mode honesty badge** — the one go-live DS item.
2. **The WCAG AA floor** — a constant constraint; a *launch gate* for the **money** and **auth** surface classes.

This corrects the prior audit's blanket "P0" labelling (audit error E-6). Ordinary consolidation is **not** P0.

---

## 1. Deliverable 1 — Corrected primitive usage counts

Prior counts were wrong. **The stated cause was also wrong**, and both are corrected here.

**Method:** `apps/*/src/**/*.{ts,tsx}` excluding `node_modules`, `.next`, `dist`, `build`, `coverage`,
`*.stories.tsx`, `*.test.*`; multiline-safe JSX matching; **every usage resolved to its import source**.

### 1.1 The inflation was prefix-matching, not build output — E-1 partially REFUTED

| Claim | Verdict |
|---|---|
| `<Badge` = 175 | **Inflated.** True = **163**. Delta = 11 × `<BadgeCheck` + 1. |
| Cause was `.next/` build output | **REFUTED.** Only 2 `.next/` dirs exist, containing **0 `.tsx` files**. |
| A bounded regex fixes it | **REFUTED.** Line-based `grep -E '<Badge[[:space:]/>]'` returns 135 — it *under*-counts by 28 multiline JSX openings. 135 + 28 = 163. |
| `Table` 80 | True **64**; 16 victims were TS generics (`Array<TableColumn<T>>`), not JSX. |

> I previously told you the counts were "`.next`-inflated ~2×". That was wrong on the mechanism and
> the magnitude. The real cause is prefix collision plus multiline JSX. Corrected here.

### 1.2 Canonical vs local adoption (the number that actually matters)

| Primitive | Canonical | Local fork | Total |
|---|---:|---:|---:|
| Badge | 163 | 0 | 163 |
| Banner | 133 | 0 | 133 |
| Skeleton | 131 | 0 | 131 |
| EmptyState | 98 | 0 | 98 |
| useToast | 77 | 0 | 77 |
| Table | 64 | 0 | 64 |
| StatusPill (local wrapper → InternalStatusPill) | 0 | 62 | 62 |
| **All tracked primitives** | **759** | **95** | **854** |

### 1.3 The drift totals that scope the migration

| Metric | Count | Rule |
|---|---:|---|
| Local status **engines** | **126** | UX-R9 |
| `--lb-*` **redefinitions in app CSS** | **315** | UX-R3 |
| Inline `style={{` | **808** | UI-R5 |
| Raw colour literals in ts/tsx | 1053 (81 are HTML email — exempt) | UX-R8 |
| Raw **semantic** palette classes (tsx) | **173** | UX-R8 |
| Raw **neutral** palette classes (tsx) | 218 | UX-R8 |
| True visual primitive **forks** (UX-R9) | 4 repo-wide → **2 in scope** (2 are in frozen apps) | UX-R9 |

**My earlier per-app palette vector (`platform-console 78, storefront 64, merchant 0 …`) is NOT
REPRODUCIBLE** and is withdrawn. Replacement, single consistent metric (tsx occurrences, semantic hues,
excluding neutrals): **storefront-runtime 81 · theme-marketplace 42 · marketing-site 19 · platform-console 19**.

---

## 2. Deliverable 2 — App classification

| App | Disposition | Migration target | Note |
|---|---|:--:|---|
| `merchant-control-plane` | **ACTIVE-RETAINED** | ✅ 1st | All 4 ProviderModeBadge sites; owns theme install/library/publish |
| `identity-platform` | **ACTIVE-RETAINED** | ✅ **move earlier** | AUTH surface class → AA is a *launch gate*. DOC 06:344 exempts it from the shell rollout, so its payload is exactly this program |
| `storefront-runtime` | **ACTIVE-RETAINED** | ✅ | Buyer + money-adjacent → AA launch gate. Frozen React renderer inside it must NOT be deleted (UX-R32) |
| `platform-console` | **ACTIVE-RETAINED** | ✅ **move later** | Ops sliver from `platform-operations-portal` has **not** folded in yet (no refund/payout/dispute/KYC pages exist). Its surface will **grow**; DS work now = rework |
| `marketing-site` | **ACTIVE-RETAINED, ratchet-EXILED** | ✅ last | Only exiled app (`validate-design-system.mjs:50`). Exile is temporary (UX-R26); un-exile is the final step |
| `apps/mobile/merchant-app` | **ACTIVE-RETAINED** | ✅ split | UX-R4 Flutter mirror moves early; the rest is Wave 5. Outside the TS ratchet; governed by `mobile-token-validator.mjs` |
| `platform-operations-portal` | **TRANSITIONAL** (DELETE_AFTER_MIGRATION) | ❌ | Fold refund/maker-checker-payout/dispute-log/KYC-queue into `platform-console` first. **Scope it OUT** — DS work here is discarded |
| `app-marketplace`, `developer-portal` | **FROZEN** | ❌ | De-deployed; backend fail-closed behind `appPlatformKillSwitch` |
| `theme-marketplace` | **FROZEN runtime / CANONICAL capability** | ❌ as an app | See below |
| 9 deprecated aliases | **DEAD — and absent** | ❌ | All 9 paths probed: **none exist on disk**. Zero migration work |

**theme-marketplace "contradiction" — REFUTED as a conflict.** The two documents have different
referents and no authority-chain arbitration is needed: `CLAUDE.md:140` scopes its own term —
*"frozen (not deploy targets)"* — and DOC 03:315 calls the **machinery** canonical. The Next.js
**runtime** is frozen; the **capability** (upload/install/purchase/reviews) is live inside `api-gateway`
and `merchant-control-plane`. Consequence: do not migrate the app; **do** treat merchant-control-plane's
theme purchase/install surfaces as in-scope money-adjacent surfaces.

### 2.1 Revised migration order (2 changes to the proposed order)

`merchant-control-plane` → **`identity-platform`** → `storefront-runtime` → **`platform-console`** →
`marketing-site` → `apps/mobile/merchant-app` (UX-R4 mirror pulled early).

- **identity-platform moves up** — auth is one of the two AA launch-gate classes, and its payload is
  purely feedback/validation/a11y (no shell work), so it is small and high-value.
- **platform-console moves down** — behind the `LEG-023` fold, or the work is redone.

---

## 3. Deliverable 3 — Finding register

### 3.1 PROVEN SOURCE DEFECT — Phase 1 candidates

| ID | Defect | Evidence |
|---|---|---|
| F-1 | **Shopper address DELETE = false success.** No `res.ok`, no rollback; list updates optimistically. 401 on expired session silently "succeeds" | `addresses-client.tsx:107-119`; route 401/400/500 verified |
| F-2 | **Address SAVE fails silently.** `if (res.ok){…}` with **no else**, `try/finally` with **no catch**. No toast/banner/error primitive imported in the file at all | `addresses-client.tsx:85-106`, imports `:7-12` |
| F-3 | **Address LIST swallows every error** — literal `// silent` catch; a 500 renders "No saved addresses" | `addresses-client.tsx:49-59`, empty state `:152-157` |
| F-4 | **"Set Default" ignores the response, no in-flight state** — contrast the Delete button in the *same file* which binds `disabled` + spinner | `:124-131`, trigger `:218-226` vs `:227-235` |
| F-5 | **Razorpay dismiss deadlock.** Zero `modal`/`ondismiss` keys in the options literal; `isProcessing` set at `:258` and only reset by handler / `payment.failed` / pre-`open()` catch. Button `loading` hard-disables (`button.tsx:63,:134`) | `CheckoutClient.tsx:298-354`, `:349-352`, `:676` |
| F-6 | **Order cancel double-fireable via ConfirmDialog** — `handleCancel` clears state only *after* the awaited PATCH | `overlays.tsx:496-506,526-533`; `orders/page.tsx:667-678`, `:317-322` |
| F-7 | **Idempotency defeated client-side.** Every money mutation mints a fresh `crypto.randomUUID()` inside the key, so the gateway replay branch is unreachable by construction | `orders/page.tsx:267,350,394`; `payouts/page.tsx:101`; server `orders.ts:1436-1447` |
| F-8 | **Payout release has zero in-flight feedback** — no busy state in the file; step-up closes *before* the POST | `payouts/page.tsx:57-62`, `:90-122`, `:204-215` |
| F-9 | **Store picker tests an impossible status** (`=== 'active'`; CHECK allows `draft\|published\|unpublished\|frozen\|suspended`) | `AllStoresClient.tsx:165` + constraint |
| F-10 | **Storefront services swallow failures → empty catalogue, HTTP 200** | `product-service.ts:35-37,47-49,60-62,78-80` |
| F-11 | **ProviderModeBadge non-compliant on 5 counts** (see §3.4) | `ProviderModeBadge.tsx:1,4-5,8-11,14,19` |

**F-7 scope discipline:** this proves the *client defeats the designed idempotency layer*. It does **not**
prove a reachable double-spend — independent server guards (payout transition checks, over-refund clamp
`payments.ts:482-490`, `FOR UPDATE` in the RPC) hold. State it that way.

### 3.2 REFUTED OR OVERSTATED

| Claim | Verdict |
|---|---|
| Gift-card disable = "irreversible destruction of stored value" (E-2) | **REFUTED.** A `Reactivate` button exists — `gift-cards/page.tsx:355-377` |
| `EmptyState` lacking an `error` kind *causes* service swallowing (E-3) | **REFUTED as causality.** Two separate causes: service error policy (F-10) vs UI expressiveness. Both real, independently fixable |
| Counts were `.next`-inflated | **REFUTED.** Prefix collision + multiline JSX |
| storefront/marketing are "bypassing the DS" | **OVERSTATED.** storefront imports `@letbuyy/ui` in 43/142 files (30.3%) |
| `ssl_status='failed'` renders "SSL unknown" | **REFUTED.** `normalizeSsl` accepts `active\|pending\|error\|unavailable`; `failed` is not a value it can receive |
| ProviderModeBadge is "colour-only" | **REFUTED (1 of 6 counts).** It has `aria-label` + visible text. 5 counts stand |
| UX-R5 error-with-retry is broadly absent in merchant | **OVERSTATED.** Two correct hand-rolled implementations exist (`orders:461-482`, `customers`) |
| 9 deprecated app aliases need deletion | **REFUTED.** All absent from disk |
| Mobile debug-keystore release blocker (DOC 03:262) | **REFUTED — already fixed** (`mobile-merchant-release.yml:24-33,:53`) |

### 3.3 LATENT (real artifact contradiction, no reachable consequence — Phase 2, not Phase 1)

`VALID_TRANSITIONS` missing `returned`/`rto` (`checkout-core:1425-1447`) · `UpdateOrderStatusSchema`
missing the same (`:231-235`) · `gift_card_accounts.status` TS invents `redeemed`, omits `held` ·
`subscriptions.status` TS adds illegal `expired` · `employees.status` drift · `products.status`
unconstrained + coerces unknown → `draft` · **`statusToBadgeVariant` substring bug** (zero consumers).

### 3.4 PRODUCT/SEMANTIC DECISION REQUIRED — ⚠️ blocks Phase 1

**The provider-mode vocabulary genuinely conflicts with the database, and I will not invent a value.**

| Source | Vocabulary |
|---|---|
| **DOC 01 Constitution :73, :276** (supreme) | `mock \| sandbox \| live` |
| root `AGENTS.md` UI-R6 / PAY-R10 | `mock \| sandbox \| live` |
| DOC 06 UX-R4 (Level 5, self-subordinating) | `live \| sandbox \| scaffold` |
| **Runtime / DB — CHECK-enforced on 5 money tables** | **`sandbox \| live` only.** `DEFAULT 'sandbox'`. Backend emits `mock`: **zero hits** |
| Current UI | `sandbox \| live`; **absent → renders nothing** (`:14 if (!mode) return null`) |

Authority resolves the *name*: **`mock`**, not `scaffold` (Level 1 beats Level 5, and DOC 06 concedes
subordination). But the DB **cannot store** a third value.

**Recommended resolution (needs approval, no new value, no migration):** `mock` is not a stored
provider_mode — it is the **absent/unresolved** case. DOC 01:73 defines mock as the *default adapter when
nothing real is wired*, which is exactly `null`. So:
- DB keeps `sandbox | live` (a *configured* provider's mode) — **no schema change**.
- The badge renders **three** states; **`mock` is what absent/unknown renders** — satisfying Constitution
  :73/:276, ANTI-R9, and DOC 06's "never sandbox-as-success".
- `if (!mode) return null` is the defect: today a scaffolded money surface is **visually identical to a
  live one**, which is the precise failure ANTI-R9 exists to prevent.

**Also needs a decision:** DOC 06 UX-R4 should be corrected to `mock` to conform to DOC 01 (a governance
doc edit, not code).

### 3.5 RUNTIME REPRODUCTION REQUIRED (E-4 — not provable from source)

Toast portal/stacking-context and SR announcement · dialog focus-trap behaviour · ISR cache timing on
F-10 · duplicate-effect firing · on-screen contrast · reflow · touch-target pixels · Flutter goldens
after any `ThemeData` re-point.

---

## 4. Deliverable 4 — Canonical ownership map

| Concern | Owner | Rationale |
|---|---|---|
| Semantic tones, tokens, accessible pairs | `packages/typescript/ui/src/tokens.ts` | UX-R1 / ART-20 — sole authoring source |
| Badge · Banner · Toast · Empty · Loading · Confirm · field-error primitives | `packages/typescript/ui` | UX-R9 — forking an exported primitive is forbidden |
| Light/dark, keyboard + SR behaviour, density/surface variants, web icons | `packages/typescript/ui` | UX-R12/R15/R16, CODE-R7 |
| **Domain status types + presentation records** | the domain package (`checkout-core`, `billing-core`, `tenant-core`, …) or `@letbuyy/shared-types` | Must be serializable `Record<DomainStatus, StatusPresentation>` — **no React in domain packages** |
| **API error parsing / normalization** | `@letbuyy/api-client` (or a shared error-contract package) | **Not** `@letbuyy/ui`. UI receives *normalized* errors and renders them, preserving code · HTTP status · requestId · retryability · fieldErrors · safe message |
| App surface profiles | `tokens.ts` surface identities + `LetbuyyThemeProvider surface=` | Extends the existing mechanism; no new runtime |
| Storefront merchant-theme adapter | `@letbuyy/ui` storefront kit, constrained | UX-R22 — dynamic theming is a **blessed axis**, with contrast validation + safe fallback |
| Flutter tokens | generated bridge → `packages/dart/ui_kit` | UX-R2 |

**Explicit anti-goal.** Do **not** collapse unrelated public APIs into one tone union. Status tone, text
emphasis, box tone and metric delta may share semantic *tokens* while keeping separate typed contracts.

---

## 5. Deliverable 8 — Per-phase validation gates

> ⛔ **Blocking prerequisite discovered:** `node_modules` is **not installed** (root has 8 packages; no
> app has one). `pnpm turbo lint`, `typecheck`, every `next build`, all DOM/a11y/visual gates and
> `validate:ui` **cannot run today**. `pnpm install` is step 0 of Phase 1.
> Also: `pnpm --filter @letbuyy/ui validate:ui` is **currently FAILING at HEAD** (pre-existing) — it must
> be triaged before it can gate anything.

| Phase | Gate |
|---|---|
| **1** Live correctness | `pnpm install` · targeted unit + contract for each fix · **new test: unknown `provider_mode` renders `mock`, never nothing** · money/auth security suite (TEST-R7) · `validate:design-system` (must not raise) · `validate-governance` · app builds |
| **2** Domain contracts | compile-time exhaustiveness (`never` checks) per domain · contract tests DB CHECK ↔ TS union · **unknown-value test per domain** · no-substring-matcher validator |
| **3** Primitives | `validate:ui` (once triaged) · axe · keyboard · light/dark visual regression · reduced-motion · contrast from **resolved runtime tokens** |
| **4** App migration (per app) | before/after adoption counts · light+dark · mobile reflow · keyboard + AT · E2E on money/auth flows · ratchet must **fall** |
| **5** Deletion | importer count = 0 · build · test · `validate-governance` · smoke · public-API + token snapshots updated **in the same change** (UX-R32) |
| **6** Verification | full six-class rigor; heavier classes for money/auth/checkout/theme |
| **7** Governance | new AST/type-aware validators green; ratchet repays ≥10% (UX-R29) |

**Ratchet hazard — measured, not inferred.** `validate-design-system.mjs` walks `apps/` **only**;
`packages/` is never walked. The `TOKEN_LAYER` constant that *looks* like an exemption is **dead code**
(one occurrence, the declaration). Consequence: **119 `rounded-[…]` + 7 inline styles already sit
ungoverned inside `packages/typescript/ui`** — a third more arbitrary radii than the entire apps-only
budget, inside the very package this program consolidates into. **Moving code into `@letbuyy/ui` will
make the ratchet report improvement for a pure relocation.** Phase 7 must extend the ratchet to
`packages/` or add a relocation-aware metric, or the gate rewards hiding.

---

## 6. Risks, dependencies, rollback

| # | Risk | Mitigation |
|---|---|---|
| R1 | Provider-mode decision (§3.4) blocks the one go-live item | **Escalate now** — it is the first approval needed |
| R2 | `platform-console` migrated before the `LEG-023` fold → rework | Sequenced after the fold |
| R3 | Storefront merchant theming broken by tokenization | UX-R22 separation rule; adapter + contrast validation + fallback; never force admin `--lb-*` onto merchant-themed surfaces |
| R4 | Relocation gaming the ratchet | Extend ratchet to `packages/` in Phase 7 |
| R5 | `validate:ui` already failing | Triage before it gates |
| R6 | Deleting a primitive with 0 consumers but a live governance contract | UX-R32 + deletion-validation gate; snapshots updated in-change |
| R7 | Flutter goldens after bridge extension | Re-baseline + visual review (UX-R2 note) |
| R8 | Runtime-unproven claims driving work | All quarantined in §3.5 |

**Rollback:** every phase is a separate branch + PR. Phase 1 fixes are independent single-file changes,
each revertable alone. Phase 3 primitive deltas are additive with back-compat guards, so a revert
restores prior behaviour. Phase 5 deletions land only after importer count = 0 and are pure reverts.

---

## 7. Decisions required before Phase 1

1. **Provider-mode vocabulary (§3.4)** — approve `mock | sandbox | live` with `mock` = absent/unresolved,
   no DB change; and correct DOC 06 UX-R4 to conform to DOC 01. **Blocks the one go-live DS item.**
2. **Revised migration order (§2.1)** — identity-platform up, platform-console down.
3. **Scope `platform-operations-portal` OUT** of the DS program while leaving its code untouched.
4. **Phase 1 scope** — F-1…F-11 as listed, with F-7 stated as "defeats idempotency", not "double-spend".
5. **`pnpm install` + `validate:ui` triage** as Phase 1 step 0.

---

*Phase 0 complete. Read-only: no file under `apps/`, `packages/`, `services/`, `config/`, `database/`,
`scripts/` or `GOVERNANCE_REWRITE_2026_06_10/` was created, modified, renamed or deleted.*
