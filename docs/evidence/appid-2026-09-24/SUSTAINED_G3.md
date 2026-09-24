# SUSTAINED-G3 — the real `| t` Liquid filter now calls the tested, canonical translation resolver

Branch `letbuyy/sustained-g3-locale-filter-wiring`, base `6d42b2f` (develop, includes merged
SUSTAINED-A through G2). The final bounded slice of the owner's SUSTAINED-G directive.

## What was found — distinguishing a real defect from a large content gap

Investigated whether SUSTAINED-B.D's fix (the localization *test harness*'s stale TS-loader import
resolution) left any real *application* localization defect unaddressed, per this phase's mandate
to "distinguish stale harness vs real defects."

**A real, code-level duplication bug, found and fixed by this phase:** the theme engine has two
separate implementations of the same translation-lookup concern.

1. `packages/theme-engine/src/theme-locale.ts` — `tLocale()`, "Phase Z — Theme Markets &
   Localization." Complete, documented India-first fallback chain (`[locale, language, 'en-IN',
   'en']`, en-IN always tried before bare `en`), a prototype-pollution guard on dot-path traversal
   (`BLOCKED_PATH_SEGMENTS`: `__proto__`/`constructor`/`prototype`), key-charset validation,
   placeholder interpolation, 32 passing tests (`theme-locale.test.ts`).
2. `packages/theme-engine/src/theme-renderer.ts`'s own inline `translateLiquidKey`/
   `resolveLiquidLocaleDictionary`/`lookupTranslation` — a second, simpler, independently-written
   implementation. This — not `tLocale` — is what the real Liquid `\| t` filter (registered via
   `engine.registerFilter('t', ...)`, the filter every theme section actually calls at render time)
   used.

Measured, not assumed: `grep -rln '\btLocale\b'` across `apps/`, `services/`, `packages/` matched
only `theme-locale.ts` itself and its own test file — not even re-exported from
`packages/theme-engine/src/index.ts`. `theme-renderer.ts` never imported `theme-locale.ts` at all.
This is the same "built and tested, never wired" pattern as G1 and G2, except here the two
implementations don't just fail to connect — they actively **diverge**:

- Fallback order: `resolveLiquidLocaleDictionary`'s candidates were `[locale,
  locale.split('-')[0], 'en']` — `en-IN` never appears in that list at all. For a locale like
  `fr-FR` on a bundle carrying both `en-IN` and `en` entries, the old code would resolve `en`,
  skipping the more-specific `en-IN` entry entirely — the opposite of the documented India-first
  design (`theme-locale.ts`'s own header comment: "The fallback chain always includes 'en-IN'
  before 'en' so that stores configured for Indian English resolve correctly").
- Prototype-pollution guard: `tLocale`'s `lookupPath` explicitly skips `__proto__`/`constructor`/
  `prototype` segments during dot-path traversal; the old inline `lookupTranslation` had no such
  guard.

**A real, but much larger and out-of-authority, content gap, found and NOT attempted by this
phase:** the shipped Urban Kicks / LetBuyy Core theme's own `locales` dictionary
(`theme-bundle.ts:3992-3998`) contains exactly one key, `general.cart: 'Cart'`, English only — and
the `\| t` filter is used exactly once in the entire theme's Liquid source
(`theme-bundle.ts:1445`). Every other UI string in the shipped theme (search placeholders, empty
states, form labels, button text, aria-labels — dozens of strings across every section) is
hardcoded literal English directly in the Liquid section bodies, with no `t:` indirection at all.
A merchant who selects `hi-IN`/`ta-IN`/`bn-IN`/etc. as their "Storefront language" (a real,
supported choice on the merchant Settings page, backed by `admin-locales.ts`'s 9 India locale
codes) would see an almost entirely English storefront today, with or without this phase's fix —
because there is essentially no translated content for the mechanism to serve. Populating real
translation catalogs across 9 India locales for the theme's actual UI strings is a large,
legitimate content-authoring project, not a wiring bug; fabricating plausible-sounding Hindi/Tamil/
Bengali/etc. text for a live merchant-facing storefront without the owner's word is exactly the
kind of unilateral, unverifiable content decision this session's authorization does not cover.
Recorded here as a bounded, honest finding — not invented, not silently omitted, and explicitly
out of this phase's scope.

## What this fixes

`theme-renderer.ts`'s `'t'` filter registration now calls `tLocale(key, locale, bundle.locales,
replacements)` directly. `translateLiquidKey`, `resolveLiquidLocaleDictionary`, and
`lookupTranslation` — the duplicate, less-robust implementation — are deleted, not kept alongside
(the skill's own rule: prefer deleting a parallel system over inventing a third). Net diff: -48
lines / +7 lines in `theme-renderer.ts`. One stale comment in `theme-locale.ts` (referencing the
now-deleted `translateLiquidKey` by name) updated to describe the pattern generically instead.

## Proof

**Two new tests, `packages/theme-engine/test/liquid-l2-assets.test.ts`**, through the real
`LiquidRenderer().render()` entry point:

1. `SUSTAINED-G3: the real render for locale "en" still resolves the shipped general.cart key
   unchanged` — the theme's one real, shipped `\| t` usage (the header's cart accessible label)
   still renders `Cart` exactly as before. (The header/footer chrome renders into
   `result.liquid.header`, a separate field from `result.liquid.layoutHtml` — confirmed by reading
   the renderer's own render-path code, not assumed.)
2. `SUSTAINED-G3: the \| t filter now resolves through the India-first fallback chain (en-IN before
   bare en), proving it calls tLocale and not the old duplicate lookup` — a bundle with both `en`
   and `en-IN` `general.cart` entries, rendered with an unsupported locale (`fr-FR`): the rendered
   header now carries the `en-IN` value, not the old (wrong) `en` value. This exact divergence is
   only observable if the filter truly delegates to `tLocale`.

**Real revert-and-watch**: temporarily restored the deleted `translateLiquidKey`/
`resolveLiquidLocaleDictionary`/`lookupTranslation` functions and the old filter registration
(source only), re-ran the file — **exactly test 2 failed** (7/8 pass, 1 fail), with the failure
output showing `<span class="lb-sr-only">Cart</span>` (the old, wrong `en` fallback winning) where
`ENIN_CART_LABEL` was expected. Test 1 (the simple, non-divergent `en` case) correctly kept
passing, since both implementations agree there. Restored the fix; `git diff --stat` on
`theme-renderer.ts` back to the intended -48/+7 diff; 8/8 (40/40 combined with
`theme-locale.test.ts`) pass again.

**A stale source-text assertion found and fixed**: `tests/theme-engine/liquid-renderer-contract.
test.mjs` pinned the deleted function names by regex (`/function translateLiquidKey/` etc.) —
exactly the same class of drift APPID-FIX2 hit with `products.test.ts`. Updated to assert the new
delegation instead (`import { tLocale } from './theme-locale'` and the call site), not deleted or
weakened.

Broader suites run against the fix (all pass, 0 new regressions):

- `packages/theme-engine` package suite: **1868/1868 pass** (1866 baseline + 2 new).
- `tests/theme-engine/*.test.mjs` (13 files): **95/96 pass** — the one failure
  (`first-party-liquid-portability.test.mjs`, "converted Liquid theme keeps reusable and app block
  portability") is **pre-existing**, confirmed by running the identical file against the unmodified
  `develop` tip (`6d42b2f`, before this phase's worktree existed): same 4/5, same failure, verbatim
  — this phase touches none of the files that test reads.

## Validation run

- `npx tsc --noEmit -p packages/theme-engine/tsconfig.json`: clean (after building
  `@letbuyy/shared-types` via `tsc -b`, a fresh-worktree project-reference prerequisite).
- `node scripts/validate-governance.mjs`: **109 pass / 5 fail / 0 blocked** — the same 5
  pre-existing ambient FAILs every phase this session has produced, nothing new.
- Not run standalone this phase: repo-wide `pnpm run lint`/`pnpm run typecheck` (`turbo`, unreliable
  in this container for a filtered single-package run per SUSTAINED-G1's finding) and the full
  gate — this phase's diff is confined to `packages/theme-engine` (two source files, one test file)
  plus one repo-root test file, already covered precisely by the package-scoped `tsc` run and the
  1868 + 96 tests run above.

## Not done (this slice's own explicit boundary, and SUSTAINED-G's)

Authoring real translation content for the theme's dozens of hardcoded English UI strings across 9
India locales — a large content project needing the owner's word on translation quality/source, not
a wiring fix, per the finding above. `formatThemeCurrencyDisplay` (`theme-locale.ts`) is a separate,
also fully-built-but-unwired currency-display function — not touched here; `formatLiquidMoney` in
`theme-renderer.ts` already handles the live INR path correctly and is unaffected by this phase.
With G1, G2, and G3 all merged, SUSTAINED-G (storefront search/CSS/localization) is complete as
scoped by this programme; Phase H (integrated acceptance) is next.
