# Playfield combined source checkpoint — released wrapper and URL lifecycle

The released order-presentation repair and the sealed dynamic-owner URL repair pass together on one stable source epoch: **150 unique PASS / 0 FAIL / 0 SKIP**, with both Commerce and theme-engine typechecks exiting 0. All 134 pinned source files matched before and after qualification. This integration check made no production or test source edits. This is an interim checkpoint before the separately diagnosed Circuit cart recovery repair; the final combined gate after that repair remains pending.

Threadline released the exact wrapper source/test lease in [its final source review](../../../niche-theme-programme/release-playfield201/order-presentation-source-repair/final-review.json) before this run. The [recorded handoff](wrapper-owner-handoff.json) pins that receipt and the actual source hashes. The new checkpoint preserves the original 73-test repair, 141-test URL and 142-test dynamic-owner receipts byte-for-byte. It does not reinterpret their historical source epochs.

## Actual checks

The required previous source regression cohort plus the eight released order-presentation tests recorded **131 PASS / 0 FAIL / 0 SKIP** in [source-regression.tap](source-regression.tap). The separate Buy Now client-mode cohort recorded **19 PASS / 0 FAIL / 0 SKIP** in [buy-now-client-mode.tap](buy-now-client-mode.tap). The cohorts use separate test files; their total is 150 unique cases. Commands, exit codes and stable-source evidence are in [verification.json](verification.json) and [commands.json](commands.json).

Commerce `tsc --noEmit --incremental false` and theme-engine `tsc --noEmit --incremental false --composite false --rootDir ../..` both exited 0. No build output was generated. Hydration/helper/URL-test source hashes exactly match the prior 142-test checkpoint, whose lint evidence remains **1 existing error / 23 warnings / 0 introduced diagnostics**, outside the allocated picker. This check carries that exact-source lint evidence forward; it does not claim a new lint run or a green whole-file gate. Threadline separately recorded wrapper-targeted lint exit 0 in its source handoff.

The in-memory [builder proof](builder-proof.json) independently reproduced raw Playfield 2.0.1 SHA-256 **`91dd7e6239aefa6a341dfc04ba5d8cc79d8136f1c4d46b48fda66799ecbbe9d7`**. The old `c8a1defdf97a0d8d9bf1060c86d5a1727d458747e56353db88f44b456a8bfc5d` digest describes the earlier order-presentation omission and is not this repaired bundle. The entire customer-order section and whole layout now equal historical 2.0.0 bytes, including saved order facts and their CSS. Only these semantic paths differ from 2.0.0:

- `/package/version`
- `/package/version_number`
- `/sections/product-detail/source`

All 20 historical default/v2 builder outputs also match their pinned hashes. This proof writes hashes and semantic observations only; it creates no immutable catalog capture, migration, persisted theme package or SQL proposal.

## Exact source and preservation

The complete 134-file epoch is in [source-epoch-before.json](source-epoch-before.json) and its byte-identical [after record](source-epoch-after.json). Principal source pins are:

| File | SHA-256 |
| --- | --- |
| `niche-order-presentation.ts` | `6c5f89356bab085cc8a3a359c5caad4503dc8442176df0b8a1558b849d651ac3` |
| `niche-order-presentation.test.ts` | `20cef99b2deea24bb02b0c08ecfe7224eb3e8fe90b2a30c09c06afc88502eb19` |
| `liquid-hydration-islands.tsx` | `5f0b2659f1fcfe65d651f248a2c052dba4201bf7c5caa36907a20aa527463bdd` |
| `variant-selection-url.ts` | `290b94804e758325f8262a4dd53bdc81ddbbf30b4ae1a811f7affacde5158ed1` |
| `variant-selection-url.test.ts` | `1d4febedd0d6babf2cd0a3146f758adf082293a5bb8065291034bfdc8b6b477f` |
| `first-party-theme-catalog.ts` | `48e8126f5681d91fb1780b521bd5d53c4bf933156ca2b97c64932d95e0800605` |
| `playfield-theme-v201.ts` | `f2d428503df3630bcb79141488d109e10284412a2a523fa8ad77343aa47ae132` |

All 768 preservation pins matched, including all three previous source receipts and their evidence, the released wrapper owner's evidence, retained installed audit, all 296 original artifact pins and 113 original M1 files. Both retained runtime candidate hydration sources still hash to `9e87ff6b8b18a8e2208ca770fc44c282a03632d575973e26f1cd34f1656088b4`. No frozen artifact, runtime candidate, fixture, browser, database, API, SQL or distribution state was changed.

The hydration writer was already released in the sealed 142-test receipt. This read-only check held no source writer and makes that release explicit again in [writer-release.json](writer-release.json). The narrow URL regression is actual RED 12 PASS / 1 FAIL, then GREEN 13 PASS / 0 FAIL. Circuit can inherit the exact qualified picker bytes under its separate cart-class lease; this task will make no cart changes or further hydration edits. The 150-case run completed after the wrapper handback and before Root's later cart-serialization notice arrived. It remains historical proof of that exact epoch, not acceptance of the unimplemented cart repair. No additional broad run will start before the next complete source handback.

This is a source checkpoint awaiting Root admission and separate distribution/runtime allocation. Editor still solely owns the current browser. PF-I01 through PF-I14 remain NOT_RUN on corrected runtime `f6074d90e894`; the older actual first-pass failures and incomplete results remain retained without promotion. Installed PF-I05/PF-I06 retests, COD, stale-cart effects and immutable history still require the allocated real journeys. The follow-up stays active. See [SOURCE_RELEASE.json](SOURCE_RELEASE.json).
