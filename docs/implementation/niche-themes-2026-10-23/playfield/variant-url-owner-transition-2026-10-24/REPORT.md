# Playfield selected-edition URL source addendum — duplicate owner transition

The reviewed P2 is fixed in the existing native picker lifecycle. A buyer-page picker now registers its `popstate` listener whenever its captured buyer path is eligible. The existing `ownsBuyerUrl()` check still gates each event, initial restoration and URL writes. Two same-product pickers remain fail-closed; after one disconnects, the survivor can both update its selected-edition URL and restore selection on Back/Forward. Disconnect still removes the listener. No observer or additional authority was introduced.

This is a new source epoch under the reopened picker/test/docs lease. The previous 141-test receipt and every file in its evidence directory remain byte-identical. The adjacent URL helper is unchanged. The sole production delta is moving listener registration outside the initial unique-owner branch, with one explanatory comment. The only other source delta is the native regression test. See [the exact allocated diff](allocated-diff.patch).

## Actual regression evidence

The new test renders two actual Liquid/native pickers initially, proves neither restores from the URL (including an initial `popstate`), removes one, and selects the remaining picker's editions. It then performs real jsdom history Back/Forward traversals through inherited, Paper and unavailable editions. It checks selected UUIDs, facts, availability, preserved Next state objects, repeated query values, hash and zero fetch attempts.

Before the production fix, [the red run](url-red.tap) recorded 12 PASS / 1 FAIL / 0 SKIP. Back reached the Paper URL while the picker still exposed the unavailable edition UUID. The production source SHA remained the prior `17dd019d60d69d81c6bd5d7306fd354528d1ad9400095f695c29c093a3780294` in [the red epoch](red-epoch.json).

After the fix, [the focused run](url-green.tap) recorded 13 PASS / 0 FAIL / 0 SKIP. The stable final source epoch recorded **142 unique PASS / 0 FAIL / 0 SKIP**: 123 in [the source regression cohort](source-regression.tap), including the new case, and 19 in [the Buy Now client-mode cohort](buy-now-client-mode.tap). These cover the required previous cart, facts, Buy Now, Playfield factory and Liquid security regressions. Counts for overlapping historical subsets are not added again. Commands and before/after stability are in [verification.json](verification.json).

Commerce `tsc --noEmit --incremental false` exited 0. URL helper/test lint exited 0. Entire-file hydration lint remains **1 pre-existing error and 23 warnings**, exit 1, outside the allocated picker. The rule/message/source-line diagnostic multiset matches the prior baseline exactly: **0 introduced diagnostics**. See [lint-delta.json](lint-delta.json); this is not a claim of a green whole-file lint gate.

## Preservation and handback

All 684 pinned files matched after qualification, including the complete previous URL evidence directory, the previous 73-test repair source/evidence, retained installed audit, original M1, static browser evidence and both named runtime candidate hydration files. All 296 historical artifact pins also match separately, including 113 original M1 files. See [preservation-after.json](preservation-after.json) and [pinned-artifact-verification.json](pinned-artifact-verification.json).

Current source SHA-256:

| File | SHA-256 |
| --- | --- |
| `liquid-hydration-islands.tsx` | `5f0b2659f1fcfe65d651f248a2c052dba4201bf7c5caa36907a20aa527463bdd` |
| `variant-selection-url.ts` (unchanged) | `290b94804e758325f8262a4dd53bdc81ddbbf30b4ae1a811f7affacde5158ed1` |
| `variant-selection-url.test.ts` | `1d4febedd0d6babf2cd0a3146f758adf082293a5bb8065291034bfdc8b6b477f` |

Both retained `f6074d90e894` and `9cd50e893016` candidate hydration sources still hash to `9e87ff6b8b18a8e2208ca770fc44c282a03632d575973e26f1cd34f1656088b4`. No distribution, immutable capture, candidate, browser, runtime, database, API or SQL changes were made. No installed case status advanced. PF-I05 and the remaining installed lifecycle acceptance still require the separately allocated corrected runtime/browser journey. The follow-up stays active.

The source writer is released for independent Root review of [SOURCE_RELEASE.json](SOURCE_RELEASE.json). Source qualification does not establish installed acceptance. A read-only snapshot setup initially used the wrong key for the older receipt; it failed before source changes and was corrected against that receipt's actual structure, as recorded in [setup-notes.json](setup-notes.json).
