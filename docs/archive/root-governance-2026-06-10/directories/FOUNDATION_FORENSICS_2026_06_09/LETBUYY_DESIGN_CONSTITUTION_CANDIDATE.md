# LETBUYY DESIGN CONSTITUTION — CANDIDATE

**Status:** CANDIDATE · **Date:** 2026-06-09 · **Scope:** tokens, components, theming, UI consistency across the 9 web apps + Flutter merchant app. Subordinate to the Master Constitution.

Grounded in `LETBUYY_DESIGN_SYSTEM_FORENSICS.md`, `LETBUYY_DESIGN_GOVERNANCE_REPORT.md`, `LETBUYY_UI_CONSISTENCY_REPORT.md`. **Correction applied during verification:** the design workstream reported `.github/workflows/` as *empty*; this is **false** — there are **10 workflows**, and `architecture-governance.yml` + `ci.yml` *do* reference design-system validation. The accurate finding is narrower: the design ratchet has **no committed baseline** to enforce, so the gate is present but toothless.

---

## Article I — One token source of truth

1. **All color/type/spacing/radius/elevation derive from `packages/typescript/ui/src/tokens.ts`** (the four-layer primitive→semantic→component→density hierarchy, 352+ CSS vars). This is FROZEN as the single source.
2. **No parallel token systems.** `apps/marketing-site/src/app/globals.css` defines ~40 raw-rgba local CSS variables and 25 hardcoded hex — a second, ungoverned token system. It MUST be migrated onto the canonical tokens or formally exiled as a non-product marketing island (and excluded from the design-system score either way).
3. **Mobile consumes the bridge, it does not fork it.** The three hand-authored Dart color files (`light_theme_colors.dart`, `dark_theme_colors.dart`, `store_admin_colors.dart` — 107 raw `Color(0xFF…)` literals) MUST be generated from the web token bridge (`generate-mobile-tokens.mjs`), not maintained by hand.

## Article II — Components are shared, not re-implemented

1. **Primitives come from `@letbuyy/ui`.** All 9 apps already import it — FROZEN. New buttons/inputs/cards/tables/modals MUST NOT be re-authored locally.
2. **No bypassing primitives with raw markup.** `developer-portal` rendering tables as hand-rolled HTML instead of the `Table` component is prohibited going forward.
3. **Self-tagged consolidation debt MUST be paid, not perpetuated.** `console-workspace.tsx` and `ops-workspace.tsx` are character-for-character identical and both carry a `[CONSOLIDATE -> @letbuyy/ui]` comment; duplicated components that announce their own duplication MUST be promoted to `@letbuyy/ui` within one cycle.

## Article III — Theming

1. **One `LetbuyyThemeProvider`** (9/9 apps today) — FROZEN. Light/dark is token-driven; no per-app theme forks.

## Article IV — Hardcoded values

1. **Zero hardcoded hex in `.tsx`** — current state is **0** (the ESLint plugin works). This is FROZEN at zero; a regression fails CI.
2. **Inline styles are bounded.** `storefront-runtime` carries **521** `style={{…}}` usages (24× the next-worst app). New inline styles in admin/platform apps are prohibited; storefront's existing debt gets a burn-down target, not amnesty.

## Article V — Governance has teeth

1. **Commit the design-system baseline.** `scripts/validators/design-system-baseline.json` does not exist, so the ratchet validator cannot enforce regression (`validate-design-system.mjs:129`). The baseline MUST be generated and committed; without it the gate is decorative.
2. **The design gate must actually fail the build.** Presence of `validate:design-system` in a workflow is not enough if it cannot fail; the gate MUST block merges on token/hardcode violations.
3. **stylelint must be installed and run.** It is currently referenced but dormant; either wire it or remove the pretense.

---

## FROZEN (protect)
The four-layer token hierarchy; `@letbuyy/ui` as the only primitive source (9/9 adoption); single `LetbuyyThemeProvider`; the ESLint raw-element rule keeping `.tsx` hex at zero.

## CONDEMNED (fix)
marketing-site's parallel CSS token system; mobile's 3× hand-authored color fork (107 literals); developer-portal's bypass-the-`Table` markup; the un-promoted console/ops workspace duplication; storefront's 521 inline styles; the missing ratchet baseline that leaves governance toothless.

## Scores
**Design System 54/100 · UI Consistency 68/100.** A genuinely strong, near-Polaris token core whose *enforcement* layer is the weak point — the library is better than the governance protecting it.
