# Applied private Threadline successor

24 October 2026. **Private implementation and deterministic schema/render proof ready for review.** No Main integration, catalogue registration, migration, browser, app, database, provider or build action occurred.

`threadline-successor.ts` is an applied private copy of the current Threadline factory, reusing the canonical engine imports. It proposes **2.0.1-private.1**, marked draft. The allocator still owns the actual forward version and dispatch decision. The canonical `theme-bundle.ts` and frozen Threadline 2.0.0 remain unchanged.

The copy implements the category description, explicit collection-list heading override and order-detail heading. It retains the existing trusted collection/order data, buyer/unavailable/missing guards and canonical sanitizer. It creates no renderer or identity/payment authority.

## Actual execution

| Run | Actual result | Meaning |
| --- | --- | --- |
| `runs/red-baseline/` | Setup error | The docs directory has no root jsdom link. Preserved separately; no behavioral-red credit. The test now resolves the canonical package's declared installed jsdom dependency. |
| `runs/red-baseline-02/` | 0 PASS / 3 FAIL / 0 SKIP | Original canonical 2.0.0 factory rendered with edited fields: subtitle absent, collection heading still Dresses, order heading still Order #1042. |
| `runs/private-initial/` | 12 PASS / 2 FAIL / 0 SKIP | Applied private copy fixed all three original regressions. Real renders exposed whitespace override and default DOM drift. Initial module/test snapshots and output are preserved. |
| `runs/private-corrected/` | **15 PASS / 0 FAIL / 0 SKIP**, exit 0 | Corrected applied copy tested through `LiquidRenderer`, canonical schemas, persistence manifests, validator and ThemeDocument roundtrip. |

The corrected run saved 61 actual rendered content outputs. It compares original and successor default content/header/style output exactly for all 21 page templates with the same synthetic drops. This is deterministic render parity, not browser screenshots, layout measurements, routing/authentication proof or complete accessibility certification.

The passing cases cover a populated collection, omitted/cleared/whitespace heading, explicit `Clothing`, missing collection title, category description clear/whitespace, order heading default/override/clear/whitespace, hostile escaped values, original order guards, canonical schema negatives, serialization and unchanged original input bytes. Synthetic buyer/order drops are test inputs; no accounts or orders were created.

## Default behavior corrections

The first private run showed why changing a schema default alone was insufficient:

- A wrapper around an empty subtitle changed the default DOM. The applied copy now adds that wrapper only with nonblank copy.
- A whitespace heading bypassed the fallback. The applied copy strips it before falling back to the real collection name.
- The inherited list-collections subtitle and search `Results` value were previously inert. In the **new distribution defaults only**, they become blank so the default public output stays unchanged when those controls become live. No existing merchant document is migrated, and explicit `Clothing` remains a real override rather than a sentinel.

`APPLIED_PRIVATE_SOURCE.diff` records all changes from the original factory, including private import paths, draft metadata and these two distribution-default adjustments. Prior rejected V1, V2 semantics and TL-F04 records are intact.

## Reproduce in an unused owned result directory

From `/Volumes/Projects/LetBuyy`, create a new directory rather than overwriting a receipt:

```sh
python3 -c "from pathlib import Path; Path('docs/implementation/threadline-2026-10-22/completion-2026-10-24/private-successor-01/runs/reviewer-01').mkdir(exist_ok=False)"
TL_RENDER_RUN_DIR='/Volumes/Projects/LetBuyy/docs/implementation/threadline-2026-10-22/completion-2026-10-24/private-successor-01/runs/reviewer-01' TL_RENDER_TARGET=private node --import ./docs/implementation/threadline-2026-10-22/completion-2026-10-24/private-successor-01/capture-runtime.mjs --import tsx --test ./docs/implementation/threadline-2026-10-22/completion-2026-10-24/private-successor-01/successor.test.ts
```

The baseline regression command adds `TL_RENDER_TARGET=baseline` and `--test-name-pattern='^REGRESSION_'` using another unused result directory. Its three failures are expected and must remain visible.

`RESULTS.json` links every run, exit status, failed case, output and source hash. `FINAL_RUNTIME_INPUTS.json` binds 1,204 observed runtime/explicit test inputs, including actual TypeScript implementations and installed JavaScript dependencies. All were rehashed after the completed green run; no captured Main inputs changed. This input record is scoped to the pure test process, not a deployed fixture or a complete future browser candidate.

## Handoff and remaining acceptance

`HANDOFF.json` requests independent review and an exact allocator-owned successor integration decision. Full theme certification remains open: actual editor persistence/publication, normal identity/cart/COD, per-theme Razorpay Test Mode, immutable post-purchase history, responsive/security/performance and independent full acceptance are still required. Original 26 browser obligations retain their status.

The later instruction reopened this private implementation slice after the prior blocked boundary. Work resumed under that scope. The goal tracker still reported blocked at intake and its available update tool has no active/resume transition; this record does not falsely claim that tool state changed. The full completion objective is preserved.
