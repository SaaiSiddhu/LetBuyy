# SUSTAINED-G2 — merchant custom CSS: closing the render-wiring gap

Branch `letbuyy/sustained-g2-custom-css-wiring`, base `7a8ccf8` (develop, includes merged
SUSTAINED-A through G1). A bounded slice (G2) of the owner's SUSTAINED-G directive; G3
(localization behaviour beyond the SUSTAINED-B.D test-harness fix) is separate, not attempted here.

## What was missing — and what was NOT

The merchant's custom CSS feature is unusually well-built already: it is validated client-side
(`apps/merchant/web`'s `appearance/page.tsx`) **and** server-side at save time
(`apps/merchant/web/src/app/api/stores/[store]/settings/route.ts`, `validateCustomCss`, Phase AA's
"SAFE-CSS LAW"), persisted to `sites.site_settings.custom_css` through the gateway proxy, and the
theme renderer already has a complete, previously-tested validate-and-scope function for it:
`buildLiquidThemeHeadAssets` (`packages/theme-engine/src/theme-renderer.ts:575`) accepts a raw CSS
string, runs it through `validateAndScopeCustomCss` (fail-closed — invalid CSS is silently dropped,
never the base style), and emits a real `<style data-lb-custom-css="1">` tag. All of that was
already correct and already had dedicated unit tests
(`custom-css-sanitizer.test.ts`'s `AA-COMPAT-01..04`).

What was missing: `buildLiquidThemeHeadAssets`'s **only call site**,
`theme-renderer.ts:888` — `const themeHeadAssets = buildLiquidThemeHeadAssets(bundle);` — never
passed the second argument. So the function always took its "no custom CSS" early-return path,
and no merchant's saved custom CSS has ever reached a rendered storefront page. `grep` for
`custom_css`/`customCss` in `apps/commerce/web/src` (the app that actually serves storefront pages)
returned zero matches before this phase — the plumbing did not exist at any layer between the DB
column and the renderer's own input type, `StoreTemplateConfig`
(`packages/theme-engine/src/index.ts:197`, no such field).

## What this adds

Three small, mechanical changes completing the wiring between three already-correct pieces — no
new persistence, no new validation, no new sanitizer:

1. `packages/theme-engine/src/index.ts`: `customCss?: string` added to `StoreTemplateConfig`.
2. `apps/commerce/web/src/lib/store-service.ts`: `mapSupabaseToStore`'s existing "LB-9 appearance
   bridge" (which already reads `site_settings.primary_color`/`font_family`/`border_radius`/
   `logo_url` into the resolved template config, but not `custom_css`) now also reads
   `site_settings.custom_css` and returns it on `templateConfig.customCss` — same pattern,
   same file, same function, six lines.
3. `packages/theme-engine/src/theme-renderer.ts:888`: `buildLiquidThemeHeadAssets(bundle)` →
   `buildLiquidThemeHeadAssets(bundle, input.storeTemplate.customCss)`.

Confirmed, not assumed, that nothing further downstream needed to change:
`composition-engine.tsx:641` already spreads `...store.templateConfig` into the renderer's
`storeTemplate` input (the same mechanism that already carries `liquidBundle` at both the
top level and inside `storeTemplate`), and `sanitizeLiquidHeadStyleText`
(`theme-renderer.ts:1827`) already `querySelectorAll('style')`s every `<style>` node in the
sanitized head assets and joins their text — so the moment `buildLiquidThemeHeadAssets` emits the
second `<style data-lb-custom-css="1">` tag, it is automatically captured into `headStyleText` and
rendered by `LiquidRenderedHtml`'s existing `<style>{headStyleText}</style>` element, with no
changes needed to either function.

**Deliberately out of scope**: the React (non-Liquid) storefront render path has no custom-CSS
output at all and is not touched — the whole validate/scope/render pipeline this phase wires up was
built for the Liquid path only (`buildLiquidThemeHeadAssets`'s own doc comment: "Phase AA —
SAFE-CSS LAW single enforcement point"), and adding a second, React-path enforcement point would be
a second canonical implementation of the same concern, not a fix. Also untouched:
`custom-css-sanitizer.ts` itself, the merchant-side save/validate route, and
`CustomCssWorkspace.tsx` — all already correct.

## Proof

**New tests, `packages/theme-engine/test/liquid-l2-assets.test.ts`** — through the real, public
`LiquidRenderer().render()` entry point (the one storefront pages actually call), not the
already-tested unit function directly:

1. `SUSTAINED-G2: a merchant's saved custom CSS (storeTemplate.customCss) reaches the real rendered
   page` — sets `storeTemplate.customCss` to `.hero { color: rebeccapurple; }`, asserts the
   rendered `layoutHtml` contains the `data-lb-custom-css="1"` tag, the actual CSS value, and the
   `.lb-theme{` scope wrapper.
2. `SUSTAINED-G2: invalid customCss on storeTemplate is dropped fail-closed through the real
   render...` — an `@import` exfiltration attempt never appears in the rendered output; the base
   theme style tag still renders normally.
3. `SUSTAINED-G2: no customCss on storeTemplate renders byte-identical to before this phase` —
   omitting the field (or passing `undefined`) produces byte-identical output to a render with no
   `customCss` key at all.

**Real revert-and-watch**: reverted only the `theme-renderer.ts:888` call-site change (source only)
and re-ran the file — **exactly test 1 failed** (5/6 pass, 1 fail), reproducing the original gap:
the merchant's CSS value and the `data-lb-custom-css` tag never appeared. Tests 2 and 3 correctly
kept passing even with the fix reverted — they assert properties (fail-closed on invalid input,
no-op when absent) that were trivially still true when the argument was never passed at all, so
they are not themselves proof of the fix; test 1 is. Restored; `git diff --stat` on the file back
to a clean 1-line diff; 6/6 (73/73 combined with `custom-css-sanitizer.test.ts`) pass again.

Broader suites run against the fix (all pass, 0 regressions):

- `packages/theme-engine` package suite: **1866/1866 pass** (1863 baseline + 3 new).
- `apps/commerce/web`'s own local test files (5 files): **60/60 pass**, including
  `assembleLiquidPageFromRenderResult carries headStyleText through` — confirming the composition
  layer that turns `headStyleText` into the page's real `<style>` element is exercised and
  unaffected.
- The 12-file wider `apps/commerce/web` test list (federation contract, storefront-liquid-runtime,
  hydration islands ×2, editor-bridge-contract, inspector-bridge, 6 `lb-*` launch suites,
  localization): **945/945 pass**.

## Validation run

- `npx tsc --noEmit -p packages/theme-engine/tsconfig.json`: clean (after building
  `@letbuyy/shared-types` via `tsc -b`, a fresh-worktree project-reference prerequisite).
- `npx tsc --noEmit -p packages/tenant-core/tsconfig.json`: clean (after building
  `@letbuyy/theme-engine` via `tsc -b` — `tenant-core` re-exports `StoreTemplateConfig` through
  `StoreModel.templateConfig`, confirming the new field's type propagates correctly).
- `npx tsc --noEmit` in `apps/commerce/web`: clean.
- `node scripts/validate-governance.mjs`: **109 pass / 5 fail / 0 blocked** — the same 5
  pre-existing ambient FAILs every phase this session has produced
  (`session-security-validator`, `domain-boundary-validator`, `dev-auth-bypass-validator`,
  `environment-validator`, `branch-dispositions-validator`'s shallow-clone SHA-ancestry advisory
  noise plus the harness's own unrelated `develop-dccv37` branch), nothing new.
- Not run standalone this phase: repo-wide `pnpm run lint`/`pnpm run typecheck` (`turbo`, whose
  single-package `--filter` invocation was unreliable in this container in the prior G1 phase) and
  the full gate — this phase's diff is one type field, one renderer call-site argument, and six
  lines in one storefront file, already covered precisely by the three package-scoped `tsc` runs
  and the 2,871 tests (1866 + 60 + 945) run above.

## An unrelated exploration during investigation — one considered, one rejected

While tracing the save path, briefly considered exporting `store-service.ts`'s
`mapSupabaseToStore` to unit-test the `custom_css` bridge directly (mirroring SUSTAINED-E's
`console-mfa.ts` extraction). Attempted it, then reverted: `store-service.ts` transitively imports
`server-only` (via `./api/client`), which throws outside a Next.js Server Component context —
`mapSupabaseToStore` cannot be `node --test`ed without a real extraction into a separate,
`server-only`-free module. Unlike SUSTAINED-E's MFA code (security-critical, zero prior test
coverage, and the extraction was the phase's entire point), this bridge is a six-line mechanical
addition mirroring an already-untested pre-existing pattern (`primary_color`/`font_family`/
`border_radius`/`logo_url` have no dedicated tests either), and the actual defect this phase fixes
— the renderer's missing wiring — already has strong, real, revert-and-watch-proven coverage at the
correct layer. Extracting a module for this one field would have been scope beyond what the fix
needed; left as a pre-existing, unchanged gap rather than invented new architecture.

## Not done (this slice's own explicit boundary)

G3 (localization behaviour beyond the SUSTAINED-B.D test-harness fix) is a separate SUSTAINED-G
sub-item, not started here. The React (non-Liquid) render path's custom-CSS output — never built,
not this phase's to build (see "Deliberately out of scope" above).
