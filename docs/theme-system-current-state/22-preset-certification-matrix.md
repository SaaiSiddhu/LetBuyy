# 22 — Preset Certification Matrix

> **Date:** 2026-08-05. Ten canonical experiences from `EXPERIENCE_REGISTRY`
> (`packages/theme-engine/src/theme-presets.ts:387-398`).
>
> **Certification honesty rule.** No browser session was run against a live storefront. Nothing here is
> certified on visual evidence. Every column reflects what an executed command actually proved.
>
> **Legend** — ✅ verified by command · ⚙️ structural only (present + unit/integration-tested, not
> rendered in a browser) · ⚠️ partial with a named defect · ❌ blocked · n/a not applicable

---

## 1. Per-preset certification

All ten share one bundle, so template-level results are identical by construction — that is the intended
architecture (presets are data over a shared core, not forked bundles). What differs per preset is the
token overlay and the section composition.

| Preset | Settings validation | Home | Collection | Product | Cart | Content page | Contact | List collections | Account entry | Checkout handoff | Mobile | Desktop | A11y | Tenant isolation | React fallback | **Certification** |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `forge` | ✅ | ⚙️ | ✅ | ✅ | ⚙️ | ⚙️ | ⚠️ | ⚙️ | ⚠️ | ❌ | ⚙️ | ⚙️ | ⚙️ | ✅ | ❌ | **Conditional — not canary-ready** |
| `sense` | ✅ | ⚙️ | ✅ | ✅ | ⚙️ | ⚙️ | ⚠️ | ⚙️ | ⚠️ | ❌ | ⚙️ | ⚙️ | ⚙️ | ✅ | ❌ | **Conditional — not canary-ready** |
| `aura` | ✅ | ⚙️ | ✅ | ✅ | ⚙️ | ⚙️ | ⚠️ | ⚙️ | ⚠️ | ❌ | ⚙️ | ⚙️ | ⚙️ | ✅ | ❌ | **Conditional — not canary-ready** |
| `craft` | ✅ | ⚙️ | ✅ | ✅ | ⚙️ | ⚙️ | ⚠️ | ⚙️ | ⚠️ | ❌ | ⚙️ | ⚙️ | ⚙️ | ✅ | ❌ | **Conditional — not canary-ready** |
| `refresh` | ✅ | ⚙️ | ✅ | ✅ | ⚙️ | ⚙️ | ⚠️ | ⚙️ | ⚠️ | ❌ | ⚙️ | ⚙️ | ⚙️ | ✅ | ❌ | **Conditional — not canary-ready** |
| `ride` | ✅ | ⚙️ | ✅ | ✅ | ⚙️ | ⚙️ | ⚠️ | ⚙️ | ⚠️ | ❌ | ⚙️ | ⚙️ | ⚙️ | ✅ | ❌ | **Conditional — not canary-ready** |
| `dawn` | ✅ | ⚙️ | ✅ | ✅ | ⚙️ | ⚙️ | ⚠️ | ⚙️ | ⚠️ | ❌ | ⚙️ | ⚙️ | ⚙️ | ✅ | ❌ | **Conditional — not canary-ready** |
| `bloom` | ✅ | ⚙️ | ✅ | ✅ | ⚙️ | ⚙️ | ⚠️ | ⚙️ | ⚠️ | ❌ | ⚙️ | ⚙️ | ⚙️ | ✅ | ❌ | **Conditional — not canary-ready** |
| `nova` | ✅ | ⚙️ | ✅ | ✅ | ⚙️ | ⚙️ | ⚠️ | ⚙️ | ⚠️ | ❌ | ⚙️ | ⚙️ | ⚙️ | ✅ | ❌ | **Conditional — not canary-ready** |
| `summit` | ✅ | ⚙️ | ✅ | ✅ | ⚙️ | ⚙️ | ⚠️ | ⚙️ | ⚠️ | ❌ | ⚙️ | ⚙️ | ⚙️ | ✅ | ❌ | **Conditional — not canary-ready** |

### Column meanings

| Column | Basis |
|---|---|
| **Settings validation** | ✅ `collectExperienceRegistryIssues()`, `collectIndustryMapIssues()`, `collectExperienceFontIssues()` all return `[]`; `validateExperience` + `validateExperienceOverlay` pass for all 10 |
| **Home** | ⚙️ `index` renders in the engine suite; not browser-verified |
| **Collection** | ✅ `liquid-l6-collection` asserts real title/description **and the product loop** — green after the render-limit fix. `collection-filter` now exists, so no preset's collection composition degrades |
| **Product** | ✅ `liquid-l5-product` asserts title, images, description and money formatting |
| **Cart** | ⚙️ renders; cart authority is platform-side and carries two known defects |
| **Content page** | ⚙️ `page` template renders — resolves the historical `contentPage` parity question |
| **Contact** | ⚠️ template added here, but the form posts to a **non-existent `/contact` route** |
| **List collections** | ⚙️ template added here; previously the key fell through to the homepage |
| **Account entry** | ⚠️ login/account render, but **no-JS login always 403s** (no Turnstile widget), there is **no `/customers/register` route**, and **no password reset UI** |
| **Checkout handoff** | ❌ the ART-14 signed handoff is built and **orphaned**; the live path is unsigned. ARB-gated |
| **Mobile / Desktop** | ⚙️ layout is mobile-first (`min-width` queries, ~360 px floor) by inspection — **no viewport matrix was run** |
| **A11y** | ⚙️ skip link → `#MainContent`, `<header>`/`<footer>` landmarks, `:focus-visible` present — **no screen-reader or contrast audit** |
| **Tenant isolation** | ✅ 6/6 two-site suite with the TEST-R4 positive control ordered first; migration 196 forced-RLS posture asserted |
| **React fallback** | ❌ 22 of 44 sections cannot fall back — their coerced `rendererKey: 'liquid.section.<type>'` never matches `COMPATIBILITY_RENDERER_KEYS` |

---

## 2. Why no preset is canary-ready

Not because of preset quality. Three system-level blockers apply identically to all ten:

1. **No working rollback.** THEME-R6 designates the per-theme `renderer.engine` switch as *the* rollback.
   With the React fallback broken for half the sections, flipping back yields "Renderer not available"
   placeholders rather than a working page. **This alone blocks canary expansion.**
2. **Checkout handoff is ARB-gated.** The signed handoff exists and is unused; the live order-create path
   accepts raw `items[]` with no cart binding.
3. **Shopper auth is incomplete.** No password recovery UI, no register route, no-JS login always 403s.

---

## 3. Preset differentiation — the honest position

| Layer | Status |
|---|---|
| Colour / font / radius token overlay | **Applied.** 10 distinct overlays; live proof: site `saai` carries Forge's exact tokens with `experienceId: 'forge'` |
| Section composition (30 template compositions) | **Defined and now resolvable, but not applied.** `applyExperienceToDocument` / `computeExperienceApplyDiff` still have **no runtime caller**; the merchant editor writes only the token overlay |
| Bundle | **Shared** — one core bundle, per-preset data. This is the intended architecture and it holds |
| DB representation | **None.** `theme_presets` has 1 row (`Urban Kicks Default`); the 10 experiences are code-resident |

Before this engagement, 18 of 30 (experience, template) pairs resolved; `collection-filter` and
`faq-accordion` were the blockers. Both now exist, so compositions can resolve — **but a merchant
applying a preset still receives tokens only**, and `ExperiencePicker` advertises a section count that
applying does not produce. Wiring the call site is [25-follow-up-backlog.md](25-follow-up-backlog.md) P1.

---

## 4. What would raise these to "Certified"

| Requirement | Gate |
|---|---|
| React fallback renders coerced Liquid sections | Unblocks rollback → unblocks canary |
| Parity harness wired into CI | `scripts/liquid-parity/run-parity-matrix.mjs` is in no workflow and no package script |
| Browser matrix at ~360 px / tablet / desktop per preset | Converts ⚙️ → ✅ |
| Screen-reader + contrast audit | Converts a11y ⚙️ → ✅ |
| Experience composition wired to the editor call site | Makes presets structurally, not just chromatically, distinct |
| ARB rulings on checkout handoff and shopper auth | Unblocks ❌ / ⚠️ columns |
