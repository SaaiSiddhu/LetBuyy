# SUSTAINED-G1 — storefront search box renders a real `<form>`

Branch `letbuyy/sustained-g-storefront-search-form`, base `2f94c3a` (develop, includes merged
SUSTAINED-A through F). A bounded slice (G1) of the owner's SUSTAINED-G directive (storefront
search/CSS/localization); G2 (merchant custom CSS) and G3 (localization behaviour beyond the test
harness fix already done in SUSTAINED-B.D) are separate, not attempted here.

## What was broken

`packages/theme-engine/src/theme-bundle.ts`'s `search-box` section (inside
`createUrbanKicksLiquidThemeBundleFixture()`, reused as-is by
`createLetbuyyCoreLiquidThemeBundleFixture()` per `theme-bundle-core.ts:68`, so one source location
covers both shipped theme examples) rendered:

```html
<lb-search data-lb-island="search" data-search-url="{{ routes.search_url }}">
  <input type="search" placeholder="{{ section.settings.placeholder }}" aria-label="Search products">
</lb-search>
```

No `<form>` anywhere. Confirmed identically broken in both generated artifacts,
`packages/theme-engine/examples/{letbuyy-core-liquid,urban-kicks-liquid}/files/sections/search-box.liquid`.
On the client, `LbSearchElement.connectedCallback()`
(`apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands.tsx:459-470`) only synthesizes a
`<form>` when `this.innerHTML.trim().length === 0` — never true for this section's real,
server-rendered, non-empty markup — so no `<form>` existed and pressing Enter in the input
submitted nothing, with or without JS hydration. The already-correct comparison point in the same
file is the header's predictive-search overlay (~lines 1449-1457): a real `<form role="search"
method="get" action="{{ routes.search_url }}" data-lb-search-form>`.

`apps/commerce/web/src/app/store/[subdomain]/search/page.tsx`'s own header comment independently
confirms the intended contract: *"the Liquid `lb-search` hydration island (search-box.liquid)
submits a full-page GET to this exact path with a `search` query param... so the path and param
name here are load-bearing, not incidental"* — the route was always built to receive this
submission; the section just never sent it.

## What this fixes

Rewrote only the `search-box` section body to a real form, matching the header's pattern:
`<form role="search" method="get" action="{{ routes.search_url }}" data-lb-search-form>` wrapping
a `<label>`, a `name="search"` input (`value="{{ search.terms }}"`, the existing placeholder
setting preserved), and a submit `<button>`. `value="{{ search.terms }}"` is the same
already-established pattern the collection-filter search input uses
(`theme-bundle.ts:1160`); the sanitizer's `FORBID_TAGS`/`FORBID_ATTR`
(`theme-renderer.ts:300-301`) forbid only `style` attributes and
`base`/`embed`/`object`/`script` tags, so `form`/`label`/`button` were never a sanitizer concern.

Regenerated both example bundles via the sanctioned generator, `node
packages/theme-engine/examples/generate-examples.mjs` (run via `tsx` per the script's own
documented fallback order) — `git diff --name-status` after regeneration touched exactly
`search-box.liquid` in both example dirs plus their `bundle.json`/`manifest.json` checksums and
`examples/index.json`'s content hashes/timestamp; no other section or file changed.

Deliberately untouched: `liquid-hydration-islands.tsx`'s `connectedCallback()` empty-check —
`theme-bundle.ts:2298`'s separate "Spotlight" demo section (`<lb-search
data-lb-island="search" data-search-url="{{ routes.search_url }}"></lb-search>`, genuinely empty)
intentionally relies on that branch to synthesize its own form; changing the branch's condition
would have been a second, unrequested behaviour change outside this phase's scope. The header
predictive-search section is untouched (confirmed below).

## Proof

`packages/theme-engine/test/liquid-l7-search.test.ts`, two new tests added to the existing L7
search-experience suite (which already renders through the **real** `LiquidRenderer` — real Liquid
parsing/rendering, not string construction):

1. `SUSTAINED-G1: the search box renders a real <form> that GETs routes.search_url, so Enter
   submits without JS` — asserts a `<form data-lb-search-form method="get" action=".../search">`
   exists and the input carries `type="search" name="search"`.
2. `SUSTAINED-G1: the search box input echoes an existing query back into its value attribute` —
   asserts `value="runner"` round-trips through `search.terms`.

**Real revert-and-watch**: reverted only the `search-box` body in `theme-bundle.ts` back to the
broken bare-`<input>` markup (source only, not the tests or generated examples), re-ran the test
file — exactly the 2 new tests failed (4/6 passing, the pre-existing 4 unaffected), with the
rendered HTML in the failure output showing the exact original bug (`<lb-search ...><input
type="search" ...></lb-search>`, no `<form>`). Restored the fix; `git diff --stat` on the source
file back to a clean 7-insertion/1-deletion diff; all 6 tests pass again.

**Real-browser verification** (Playwright, `/opt/pw-browsers/chromium`, matching the repo's pinned
`@playwright/test@1.60.0`; throwaway script, not committed): rendered the real search page HTML
through the same `LiquidRenderer` pipeline the test uses, served it from a local static HTTP
server (so relative `action` URLs resolve against a real origin), and drove a real Chromium tab:
  - Typing into the input and pressing **Enter** navigated to
    `/store/local-kicks/search?search=sneakers` — confirmed both by the browser's final URL and by
    a mock search-route handler on the server echoing the received query string back.
  - **Clicking the submit button** navigated to `/store/local-kicks/search?search=boots`,
    confirming the fix works via both submission paths.
  - The header predictive-search section was not exercised end-to-end in this synthetic render
    (it requires the `header` section in the route's section list, which this minimal L7-style
    render context, like the existing test, does not include) — regression safety for it instead
    rests on `git diff --name-status`, which shows `header`'s generated output file untouched, and
    the existing 48-test hydration-island suite (below) staying green.

Broader suites run against the fix (all pass, 0 regressions):

- `packages/theme-engine` package suite (`npx tsx --test test/*.test.ts`): **1863/1863 pass**, 0
  fail (was already 1863 before this phase's 2 new tests were added to the 1861 pre-existing —
  consistent, no prior-suite regression).
- `tests/theme-engine/liquid-hydration-islands-parity.test.mjs`,
  `tests/theme-engine/liquid-hydration-islands.test.mjs`, `tests/launch/lb-liquid-l7-search.test.mjs`,
  `tests/launch/lb-s2-route-template-closure.test.mjs` (the last of which reads the generated
  `letbuyy-core-liquid` `search-box.liquid` file directly and asserts its `data-search-url`
  attribute): **48/48 pass**.

## Validation run

- `npx tsc --noEmit -p packages/theme-engine/tsconfig.json` (after building `@letbuyy/shared-types`
  via `tsc -b`, a fresh-worktree project-reference prerequisite, not a phase-caused issue): clean,
  0 errors.
- `node scripts/validate-governance.mjs`: same 5 pre-existing ambient FAILs as the unmodified
  `develop` baseline (`session-security-validator`, `domain-boundary-validator`,
  `dev-auth-bypass-validator`, `environment-validator`, `branch-dispositions-validator` — the last
  purely the same shallow-clone SHA-ancestry advisory noise every phase this session has produced,
  plus the harness's own `develop-dccv37` branch having no ledger row, neither caused by this
  phase), confirmed by running the identical command against the unmodified primary checkout
  (`develop` at `2f94c3a`) side by side: same 5 failures there too, verbatim.
- **Infrastructure note**: mid-phase, `node_modules/.pnpm` briefly appeared to be missing in both
  this worktree and the primary checkout (a `turbo typecheck --filter` run warned "node_modules
  missing"), consistent with a transient container-level filesystem inconsistency rather than real
  data loss — a `pnpm install --frozen-lockfile` reported "Already up to date" in 5.5s (too fast to
  be a real reinstall of 55 workspace projects) and the store was present again immediately after;
  re-ran the full typecheck and the 1863-test package suite afterward to confirm nothing was
  actually lost. Not this phase's own defect; recorded here as observed ground truth.
- Not run standalone this phase: repo-wide `pnpm run lint`/`pnpm run typecheck` (`turbo`, whose
  single-package `--filter` invocation hit the module-resolution warning above and is unreliable in
  this container for a filtered run) and the full gate — this phase's diff is one theme-engine
  source section, one test file, and generator-produced example output, already covered precisely
  by the package-scoped `tsc` run and the full theme-engine package test suite above.

## Not done (this slice's own explicit boundary)

G2 (merchant custom CSS — trace save/validation/persistence/render path, reuse the existing CSS
scoping mechanism, prevent style-tag breakout) and G3 (localization behaviour beyond the test
harness fix SUSTAINED-B.D already made) are separate SUSTAINED-G sub-items, not started here.
