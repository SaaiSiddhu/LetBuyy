# F-LIQCONTRACT-1 — four storefront Liquid tests that failed on a clean develop

Date: 2026-09-24 · Branch: `letbuyy/liqcontract1-liquid-source-contracts` · Base: `develop` at `ea5fc7b5`
Owner request (2026-09-24): make four named failing tests pass by fixing whichever side is wrong, attribute
each failure to the commit that caused it, and weaken no assertion.

```
Execution mode: SINGLE AGENT · Subagents invoked: NO · Agent/Task delegation: NO
Background agents: NO · Parallel worktree agents: NO · Workflow orchestration: NO
```

## Result

No code regressed. In all four failures, a test had pinned the exact text of source code that a later
commit moved or renamed on purpose. Each test now checks the same behaviour where it lives now.
Every assertion is at least as strict as before, and two old ones are stricter: they matched text
anywhere, including comments.

Reproduction command (from the request), in the phase worktree after the last test commit (`2a9b0447`):

| Runtime | tests | pass | fail | skipped |
|---|---|---|---|---|
| Node 26 (this machine) | 82 | 82 | 0 | 0 |
| Node 20 (`npx -y node@20`, the version the repository declares) | 82 | 82 | 0 | 0 |

Before this phase, the same command on `ea5fc7b5` gave 82 tests, 78 passing and 4 failing (the owner
measured the same at `33eba8a9`).

## The four failures

Each introducing commit was confirmed by running the test at that commit's parent (it passes) and at
the commit itself (it fails), in throwaway detached worktrees that were removed afterwards.

| Test (exact name) | File | Failing assertion | Introduced by | What moved |
|---|---|---|---|---|
| W2: the search route matches the exact path + query param the lb-search island already submits to | `tests/launch/lb-s2-route-template-closure.test.mjs` (created `8201e4cb`, 2026-08-23) | `data-search-url="/search"` in `search-box.liquid` | `9c02d2ac` 2026-08-25 *feat(theme): make the Core storefront real — routing, auth, merchant data, design* | The section now passes `{{ routes.search_url }}`, which is `/store/{subdomain}/search`. A bare `/search` reaches the store's search page only on the store's own host, where `rewriteToStore` adds the prefix. The platform root host has no `/search` page, and local development and theme-editor previews run there. The literal was introduced by `06d3cc85` (2026-07-10). |
| F5 fallback_reason is conditioned on both liquidHtml===null AND plan.rendererEngine===liquid | `tests/launch/lb-storefront-ssr-contracts.test.mjs` (created `dbcf173a`, 2026-07-10) | the variable name `liquidHtml` | `c5a9fe98` 2026-08-25 *fix(theme): make the announcement bar full-bleed and ship the portable stylesheet* | Renamed to `liquidResult` when `renderLiquidPlan` began returning `{ html, headStyleText }`. The condition is unchanged character for character. |
| storefront resolver and composition engine render full Liquid documents with Liquid chrome | `tests/theme-engine/storefront-liquid-runtime.test.mjs` (created `c4a05f0d`, 2026-06-05) | `const { header, contentForLayout, footer } = result.liquid` and the concatenation, in `composition-engine.tsx` | `c5a9fe98` (same commit) | Moved into `liquid-page-assembly.ts` (created by that commit). That module has no `server-only` imports, so it can be unit-tested, and it also returns `headStyleText`. `composition-engine.tsx` now calls it for every rendered result. |
| Liquid storefront plans bind catalog data and cart drops without fabricating server cart state | same file | `.lb-theme`, `.lb-header`, `.lb-product-grid__items` anywhere in `globals.css` | `89b62ea2` 2026-08-25 *fix(storefront): Dawn-class header/footer/drawer/search, and make merchant nav actually ship by default* | That commit deleted a stale `@layer components` block, a duplicate that overrode the real layout. Its replacement comment in `globals.css` names the owner: *liquid-theme.css is the sole owner of Liquid layout*. The store layout imports that file. |

## What each test now asserts

- **W2** follows the whole chain:
  - the island takes `this.dataset.searchUrl`, builds `new URL(searchUrl, window.location.origin)` and sets `search`;
  - the `<lb-search>` element passes `data-search-url="{{ routes.search_url }}"`;
  - the routes drop builds `search_url` as `${basePath}/search`, with `basePath = /store/${input.context.subdomain}`;
  - `store/[subdomain]/search/page.tsx` types `search` and reads `query?.search`, which is new in this test.
- **F5** takes the variable name from the single `renderLiquidPlan` call, so a rename cannot break it. It then requires that same variable to set `engine` (new in this test) and to gate `fallback_reason` together with `plan.rendererEngine === 'liquid'`. The `: null` branch assertion is kept.
- **Full Liquid documents with Liquid chrome** requires:
  - `composition-engine.tsx` imports `assembleLiquidPageFromRenderResult` and returns it for every rendered result;
  - that function destructures `header, contentForLayout, footer` and builds `html` from all three;
  - neither file returns the body alone.

  The resolver, renderer and `dangerouslySetInnerHTML` assertions are unchanged.
- **Catalog data and cart drops** keeps every data-binding and cart assertion. It replaces the three `globals.css` regexes:
  - the store layout must import `./liquid-theme.css`;
  - the Liquid HTML must be rendered into a `<div data-theme-renderer="liquid">`;
  - `liquid-theme.css` must style that root, `.lb-header` and `.lb-product-grid__items` with real rules: comments are stripped, and a class must match as a whole token, so `.lb-header__brand` does not count;
  - the portable stylesheet `LIQUID_THEME_BASE_CSS` must still carry a `.lb-theme` rule.

## Proof the new assertions bite

`git revert --no-commit` of each test commit brings the old assertion back, and the test fails again on
current code: F5 1 fail, `storefront-liquid-runtime` 2 fails, W2 1 fail. `git revert --abort` then left
the tree clean.

Each plant below broke one behaviour in a **source** file (never a test file). The owning test file was
then run, and the source restored from `HEAD`. All 19 plants failed at the assertion meant to catch
them. The one control passed, and `git status --porcelain` showed only the three test files, which
were still uncommitted at that point.

| Plant | Result |
|---|---|
| F5: drop the `rendererEngine` condition · read the reason from another value · pick `engine` from the plan | fail ×3 |
| F5 control: rename `liquidResult` everywhere | **pass** (the name is not pinned) |
| Chrome: return the body only · assembly drops the header · assembly returns `contentForLayout` alone · stop importing the assembly | fail ×4 |
| Styling: layout stops importing `liquid-theme.css` · `.lb-product-grid__items` survives only in a comment · only `.lb-header__*` rules remain · root styled only through descendants · Liquid HTML rendered without the root attribute · portable sheet loses `.lb-theme` | fail ×6 |
| W2: section back to `/search` · island ignores `data-search-url` · island sends `q` · `search_url: '/search'` · `basePath = ''` · page reads `q` | fail ×6 |

## Findings recorded, not fixed here

None of these caused the four failures, and none is a regression by the attributed commits. Each needs
its own phase, because fixing it changes what a storefront renders.

1. **`.lb-theme` matches nothing on the storefront runtime.**
   - Where the class is: only on the theme layouts' `<body>` (`examples/*/files/layout/theme.liquid`, the generated bundles and the migrations that persist them). This was already true at `89b62ea2^`.
   - Why it never renders: `composition-engine.tsx` renders the header and footer section groups around the template sections, and never renders the layout document. The theme renderer builds them the same way (`theme-renderer.ts`, the L4 chrome block).
   - Effect: the ten `.lb-theme`-scoped rules in `LIQUID_THEME_BASE_CSS` apply only for other consumers of the portable stylesheet. On this runtime, `[data-theme-renderer="liquid"]` in `liquid-theme.css` does that job. The `globals.css` `.lb-theme` rule that `89b62ea2` removed was just as inert, so deleting it changed nothing rendered.
2. **Merchant custom CSS reaches no storefront.**
   - The merchant app validates and saves `site_settings.custom_css` (`apps/merchant/web/src/app/api/stores/[store]/settings/route.ts`).
   - No file under `apps/commerce/web/src` or `services/api-gateway/src` reads it.
   - The one production call, `buildLiquidThemeHeadAssets(bundle)` (`theme-renderer.ts:888`), passes no custom CSS.
   - Even if it were passed, `validateAndScopeCustomCss` wraps it in `.lb-theme { … }`, which per finding 1 matches nothing here.
3. **The Core search box cannot submit.**
   - `search-box.liquid` puts a bare `<input type="search">` inside `<lb-search>` with no `<form>`. It has had no form since `06d3cc85`.
   - `LbSearchElement` builds its own form only when the element is empty, and otherwise listens for `submit`.
   - HTML implicit submission needs a form owner, so pressing Enter there dispatches nothing. This is reasoned from the HTML specification and was **not** exercised in a browser.
   - The section is used by `templates/search.json`. The header's search overlay has a real `method="get"` form with `name="search"` pointing at `routes.search_url`, so it works without JavaScript.
4. **Five `apps/commerce/web/src/**/*.test.ts` files run in no lane.** The package's `test` script runs only repository-root `.mjs` suites. One of them, `liquid-page-assembly.test.ts`, is the behavioural test for the assembly above; run directly with `npx tsx --test` at this branch it gives 3 tests, 3 passing.
5. **The customer-web lane stays red after this phase** on one pre-existing name, `tests/localization/theme-localization.test.mjs`. It fails at file level: its test require shim rejects the `./theme-presets` import in `packages/theme-engine/src/theme-bundle.ts`. That import arrived with `db4c08bf` (2026-08-24), which is a candidate cause not confirmed by a parent/child run. It is outside the four requested tests.

## Files

- `tests/launch/lb-storefront-ssr-contracts.test.mjs` (`19bf9725`)
- `tests/theme-engine/storefront-liquid-runtime.test.mjs` (`9eec998a`)
- `tests/launch/lb-s2-route-template-closure.test.mjs` (`2a9b0447`)
- this record
- the claim row (`bd79420b`)

No source file changed. The full gate ran after the last commit; its result and the by-name comparison
with the previous develop gate are recorded in this phase's `EXECUTION_LEDGER.md` row.
