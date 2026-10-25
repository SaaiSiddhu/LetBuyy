# Selected-edition URL source handback

**Implemented and source-verified; ready for independent root review. No installed result is advanced.** This is the later, separate source lease for PF-I05's exact-edition reload obligation. The sealed 73-test Playfield 2.0.1 source epoch remains byte-for-byte unchanged. No candidate, browser, database, runtime, SQL, catalog capture or promotion was changed or started.

The existing native Liquid picker now restores a single `?variant=<owned UUID>` on the actual buyer PDP. It restores the row's actual option values through the same option setter, availability and facts path used by normal selection. A shopper's later selection updates that one parameter with `history.replaceState(window.history.state, '', nextUrl)`. Unrelated repeated query values, the fragment and Next's history state survive; no history entry is pushed. Back/forward restores the addressed edition, and a no-variant entry returns to no selection.

## Exact scope

| Path | Allocated change |
| --- | --- |
| `apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands.tsx` | One helper import and changes only inside `LbVariantPickerElement`: URL/path binding, option setter reuse, owned initial/popstate restoration, URL synchronization, unique row matching and listener cleanup. All surrounding cart/auth/quantity/price transport and other island source remains byte-identical. |
| New `apps/commerce/web/src/lib/theme-engine/variant-selection-url.ts` | Pure buyer PDP/UUID validation, exact complete option-tuple matching and URL query update helpers. Reuses the public canonical UUID schema and existing `PickerVariant` type; creates no new commerce DTO or authority. |
| New `apps/commerce/web/src/lib/theme-engine/variant-selection-url.test.ts` | Twelve behavioral/helper cases using explicitly synthetic source-test identities, actual Liquid rendering and native elements in jsdom. No installed fixture identity or successful order is invented. |

Hydration before: `9e87ff6b8b18a8e2208ca770fc44c282a03632d575973e26f1cd34f1656088b4`.

Hydration after: `17dd019d60d69d81c6bd5d7306fd354528d1ad9400095f695c29c093a3780294`.

The exact before/after delta is `allocated-diff.patch`. `SOURCE_RELEASE.json` pins all three files, the diff, verification commands and retained evidence.

## Convention and refusal behavior

Additional bounded inspection found the `variant` key in `apps/commerce/web/src/lib/demo/catalog-demo-route.ts:44` and catalog-demo navigation tests. That parser carries presentation-only demo routes and permits sample string identifiers; it is not live Liquid restoration or durable buyer authority. The production picker previously only used current DOM option state, and the product route did not accept a selected-variant argument. No React fallback or demo routing was revived.

The new behavior binds only `/product/<product UUID>` or `/store/<subdomain>/product/<product UUID>`, to the current origin/path and exactly one matching picker. Other product sections cannot consume or write that selection. Duplicate picker owners are refused, including UUID case variants. Private editor/preview/demo paths, private authority query keys and catalog-demo read-only/inert wrappers do not participate. Existing preview option presentation continues without a URL rewrite.

Initial unknown, foreign, malformed, missing or duplicate `variant` values leave no selection and Add disabled. Duplicate identical parameters are not collapsed into implicit acceptance. A UUID must identify exactly one supplied row with a complete, unique tuple matching the actual option controls; duplicate row IDs, duplicate option combinations and incomplete tuples do not select a first row. A valid out-of-stock row restores its actual options and facts while Add stays disabled. On an explicit incomplete or unmatched user choice, the selection parameter is removed; no label, SKU, metadata or storage fallback is used.

The URL is read-only presentation input. Server cart, stock, price, facts and authorization remain authoritative. There is no price query parameter or server/API change. No child profile information is collected.

## Actual verification

| Check | Result |
| --- | --- |
| Stable server-compatible source cohort | **122 PASS, 0 FAIL, 0 SKIP** |
| React client Buy Now cohort, original Node mode | **19 PASS, 0 FAIL, 0 SKIP** |
| Total distinct tests | **141 PASS**, including the existing 67 cart cases, 35-case facts/Buy Now cohort, prior 2.0.1 regressions and 12 new URL cases; those subsets overlap and are not summed separately |
| Source stability | All three allocated source/test hashes match before and after the final two-cohort run (`final-verification.json`) |
| Commerce no-emit | Exit 0 (`commerce-noemit-final.log`) |
| New helper/tests eslint | Exit 0 (`eslint-new-files.log`) |
| Entire hydration eslint | Retained baseline failure: **1 error, 23 warnings**, all outside the allocated picker; normalized rule/message/source-line equality proves **0 introduced diagnostics** (`lint-delta.json`) |

The new cases cover initial restoration of both Unicode option groups, explicit native selection, source rehydration, real jsdom history back/forward events, no-selection and OOS states, malformed/duplicate/foreign UUIDs, ambiguous tuples/IDs, current-product/related-product/path scoping, duplicate owners, preview/demo exclusions, exact Next state preservation, repeated query values/hash and disconnect/reconnect cleanup. URL cases attempt zero fetches. Existing cart suites use controlled in-process responses; no live API or database acceptance follows.

The first broad invocation incorrectly gave the React client cohort the React Server Components condition, causing three environment failures. The final reproducible runner splits the two modes and passes all 141 cases in one stable source epoch. An initial new test fixture omitted its required description; that test typing was corrected. Initial logs are retained. No production configuration or test was weakened to pass.

The full-file lint error is a pre-existing hardcoded color outside the permitted picker slice. Its 23 accompanying warnings are likewise unchanged. No rule was disabled and no unallocated CSS code was repaired. This handback reports lint delta clean, not a green full-file lint gate.

## Preservation and remaining runtime work

The prior 2.0.1 release JSON, all seven source/test files and all 34 pinned evidence files remain unchanged. Read-only hashes also match the 296 pinned original/archive artifacts, including all 113 M1 files. Both f607 and retained 9cd candidate hydration files remain at the original `9e87ff6b…` hash. The preservation proof verifies that surrounding hydration source outside the existing picker is unchanged except for the new helper import.

This lease provides no screenshots, real browser reload, installed package, live stock/COD/order or screen-reader speech claim. PF-I05 remains open until the actual 2.0.1 package plus this URL delta are admitted into an explicitly allocated candidate, and the sole browser owner exercises edition selection, reload, back/forward and the visible facts on that installed runtime. The original failed evidence remains retained. Other unfinished lifecycle cases and the follow-up remain open.

No distribution, migration or candidate allocation is implied by this source handback. Root reviews the exact delta first; the existing distribution/candidate owner controls any later integration. No cross-chat message was sent or retried.
