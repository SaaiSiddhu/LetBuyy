# LetBuyy — UI Feedback & Status Communication System Audit

**Date:** 2026-08-16 · **Scope:** repo-wide · **Type:** read-only research. No production code was modified.

**Method:** 16 parallel domain researchers → 4 adversarial verification panels → 5 section authors.
25 agents, ~1,900 tool calls. Every load-bearing claim was re-derived by a verifier whose instruction
was to *refute*, not confirm. Claims that failed verification were dropped or restated — several
attractive-sounding findings did not survive, and their removal is recorded in §28.

---

## 1. Executive Summary

### 1.1 The one-sentence answer

LetBuyy has a **genuinely good feedback vocabulary that the product does not actually use**: the
canonical status→tone engine has **zero consumers**, one active app (`merchant-control-plane`)
consumes the design system at scale while the customer-facing storefront hand-rolls almost
everything, and the CI gate that is supposed to catch this **structurally cannot see it**.

### 1.2 What exists, and its maturity

| Layer | Maturity | Evidence |
|---|---|---|
| Token pipeline | **Strong** | 12-stage, single injection point (`token-style-boundary.tsx:24-27`), 403 `--lb-*` vars, 9 apps mount it |
| Status colour ramp | **Strong** | 4 hues × soft/text/border × 2 themes; all Badge/Banner pairs **pass WCAG AA** (4.57–10.47:1 light, 6.54–8.92:1 dark) |
| Primitives (`Badge`/`Banner`/`Toast`/`EmptyState`) | **Good, incomplete** | Well-built, tokenised, icon+text (not colour-only) — but cannot express failure (§1.4) |
| Adoption | **Poor** | One app deep. `useToast` exists in `merchant-control-plane` (140) + frozen `theme-marketplace` (6); **zero** in storefront, identity, platform-console |
| Status→tone consistency | **Failing** | 3 competing engines, ~39 forked mappers, ~48 independent status maps |
| Validation / forms | **Absent as a system** | No form library repo-wide. `InlineError` has 0 app consumers; the DS `error` prop is used at 15 sites against 663 form controls |
| Copy governance | **None** | 11 ratchet metrics, all visual. Zero copy/microcopy validators |

### 1.3 The five findings that matter most

**① The design system's status vocabulary is dead code.**
`statusToBadgeVariant` (`packages/typescript/ui/src/feedback.tsx:94`) documents itself at `:89-93` as
*"the single source for status→tone logic (replacing the per-app StatusBadge/StatusPill forks)"*.
It has **zero app consumers**. The report it cites as justification, `COMPONENT_DUPLICATION_REPORT.md`,
exists only inside `.claude/worktrees/` — it was never landed in the repo. The consolidation was
designed, built, and documented; the migration never happened.

Worse, `@letbuyy/ui` ships **two contradictory answers** for the same tone: `feedback.tsx:44-61` uses
the accessible 700/800 text ramp, while `internal-workspace.tsx:146-175` (`InternalStatusPill`) uses
the **raw 500 ramp as foreground**. Both are canonical. They disagree on `cancelled` (critical vs
info) and `draft` (warning vs info), and render as two different greens in a single flex row at
`settings/payments/page.tsx:363-368`.

**② A live status bug in the merchant store picker — verified against the running database.**
`apps/merchant-control-plane/src/app/stores/AllStoresClient.tsx:165` tests
`store.status === 'active'`. The live constraint permits only
`draft | published | unpublished | frozen | suspended`:
```
CHECK ((status = ANY (ARRAY['draft','published','unpublished','frozen','suspended'])))
```
`'active'` is **unproducible**. Confirmed against live data (3 `published`, 2 `draft`): every store —
including healthy published ones — renders with the `inactive` class. The green branch and the
`activeStores` filter are permanently unreachable.

**③ A gateway outage renders as an empty shop, on the revenue path.**
`apps/storefront-runtime/src/lib/product-service.ts:47-49` catches **any** failure and returns `[]`,
which is indistinguishable downstream from "this store has no products". A live merchant storefront
serves **HTTP 200 with an empty catalogue**, ISR-cached for 60s. Three sibling services do the same.
This is a direct consequence of ④.

**④ The design system cannot express failure.**
`EmptyStateKind` (`feedback.tsx:338-352`) enumerates 14 values and every one is a *domain noun*
(products, orders, customers…). There is no `error`, no `no-results`, no `permission-denied`. The
primitive models **what** is missing and never **why**. `ToastMessage` has no action slot; `Table`
has no `error` prop. So outages are architecturally forced to render as first-run empty states.

**⑤ Destructive actions are double-submittable by construction.**
`ConfirmDialogProps` (`overlays.tsx:496-506`) has no `loading`, no `confirmDisabled`, no error slot,
and `onConfirm: () => void` cannot signal completion. Verified end-to-end on a state-mutating path:
`orders/page.tsx:673` → `handleCancel` (`:317-322`) is `async` and only closes the dialog *after* the
await, so the destructive button stays live for the entire round-trip. The diagnostic tell is an
asymmetry the authors were forced into — `DomainDetailView.tsx:96` guards `makePrimary` with
`if (working) return` and guards `onClose` at `:336`, but `onConfirm` has no defence available.
Separately, disabling a gift card (`products/gift-cards/page.tsx:355-366`) has **no confirmation at all**.

### 1.4 Major strengths — do not regress these

- **Contrast is genuinely good** where the convention was followed. All 8 Badge/Banner
  text-on-background pairs pass AA in both themes. Independently recomputed twice from the raw token
  values; light `success` is the thinnest at **4.57:1** and therefore fragile — any darkening of the
  surface or lightening of the text breaks it.
- **`Badge` always renders an icon** alongside its label (`feedback.tsx:83`), so the canonical badge is
  **not** colour-only signalling. The a11y failures are all in the components that bypassed it.
- **Status colour is surface-invariant.** `adminSurfaceIdentity` (`tokens.ts:1140-1248`) overrides
  *zero* status tokens. Every colour inconsistency in the product is therefore app-authored drift —
  **not** theming. That makes the whole problem class mechanically fixable.
- **`merchant-control-plane` and `identity-platform` carry zero raw palette classes.** The drift is
  concentrated in `platform-console` (78) and `storefront-runtime` (64).
- The gateway **sanitises every 4xx/5xx on egress** (`middleware/security.ts:90-129`), so the 182 route
  handlers echoing raw Postgres text do not actually leak to merchants.

### 1.5 Major risks

| Risk | Why it matters |
|---|---|
| Outage-as-empty-state on storefront | Silent revenue loss; no alarm, no retry, 200 OK |
| Double-submittable destructive actions | Duplicate cancels/refunds on money-adjacent paths |
| `InternalStatusPill` contrast | 1.93–3.21:1 across 62 pills; fails AA outright |
| 39 forked status mappers | Every new status silently falls through to a neutral default |
| Zero copy governance | 93% of merchant error toasts ship no authored description |
| CI blindness | `validate-design-system.mjs` walks `apps/` only, exempts `packages/typescript/ui`, and counts colours/pixels — never **adoption**. Findings ①③④⑤ are all invisible to it |

### 1.6 Headline recommendation

Do **not** start by writing new components. The gap is not missing primitives — it is *adoption* and
*expressiveness*. In order:

1. **P0 — correctness & safety.** Fix the `AllStoresClient` dead branch; give `EmptyState`/`Table` an
   error/offline kind and stop storefront services swallowing failures; add `loading`/`confirmDisabled`
   to `ConfirmDialog`; fix `InternalStatusPill`'s foreground ramp.
2. **P1 — one status engine.** Collapse the 3 engines + 39 forks into one *exact-match, per-domain*
   registry keyed off the real DB `CHECK` values. Note `statusToBadgeVariant`'s substring matching is
   itself unsafe — `"unpaid".includes("paid")`, `"inactive".includes("active")` and
   `"unverified".includes("verified")` all resolve **green**; it is a latent trap today only because
   nothing calls it, and must not be adopted as-is.
3. **P2 — adoption, enforced.** Add an adoption metric to the ratchet so bypassing the DS is *visible*
   to CI, then migrate storefront and platform-console.
4. **P3 — copy.** Introduce a microcopy standard and a validator.

Full detail, matrices and evidence follow in §2–§29.

---

## Reading order

| File | Sections |
|---|---|
| `00-executive-summary.md` | §1 |
| `01-architecture-and-inventory.md` | §2 scope · §3 architecture · §4 inventory · §5 pills/badges · §6 banners · §7 toasts |
| `02-validation-async-states.md` | §8 validation · §9 loading · §10 empty/error · §11 modals · §12 tables |
| `03-color-tokens-domains.md` | §13 semantic colour · §14 tokens · §15 domain statuses · §23 state matrix · §24 domain matrix |
| `04-quality-findings.md` | §16 a11y · §17 responsive · §18 copy · §19 duplicates · §20 architecture |
| `05-recommendations.md` | §21 canonical classification · §22 usage matrix · §25 gaps · §26 target architecture · §27 migration · §28 open questions |

### A note on numbers

The initial scouting counts in the research brief were inflated roughly 2× because they included
`.next/` build output. Every count in this report was re-derived with build artefacts excluded, and
the corrected figures are used throughout. Where a count is disputed between researchers, the
verifier's figure wins and the discrepancy is noted inline.
