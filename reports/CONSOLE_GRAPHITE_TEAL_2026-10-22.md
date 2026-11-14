# Console graphite and teal — 22 October 2026

The owner rejected the previous violet presentation and selected **graphite and teal**. The Console now uses a neutral off-white canvas and white surfaces in light mode, layered graphite in dark mode, and restrained teal actions, links and selection. This supersedes the visual direction in `CONSOLE_UI_REFINEMENT_2026-10-21.md`; the workflows and previous behavioral evidence remain intact.

## What changed

- The existing `operations` surface receives its palette from the canonical `packages/typescript/ui/src/tokens.ts`. Other surfaces retain their existing palette. New graphite/teal primitives are projected into the DTCG interchange file.
- Violet canvas washes, gradients, coloured metric rails and tinted panel headers are removed. Metric values and page titles have stronger hierarchy; borders and shadows are quieter.
- The canonical comfortable density is enabled. Forms keep 44px controls; cards, setup steps and work queues have more breathing room. Status chips use a subtle fill and a dot alongside their text.
- Overview copy is direct: Platform overview, Revenue overview and Work queues. Missing revenue evidence stays unavailable rather than becoming zero.
- Existing shared tables, inputs, menus and primary actions inherit the operations palette. Saved light/dark choice, keyboard focus, navigation, filtering, pagination, support privacy and independent approvals remain under their existing authority.

The compiled Tailwind utilities exposed a real scope defect: colour aliases were resolved on the root, so a nested surface could inherit root colours. The shared colour aliases now use `@theme inline`; breakpoints retain their existing declaration. A regression compiles the actual shared stylesheet and verifies direct surface-token references. The final visual check waits for finite colour transitions before measuring the target palette; its 4.5 contrast threshold is unchanged.

## Current references and design rationale

The direction follows current [Carbon colour guidance](https://www.carbondesignsystem.com/building-blocks/foundations/color/overview) and [Atlassian colour roles](https://atlassian.design/foundations/color/): neutral layers carry most of the workspace, while colour distinguishes intentional actions and semantic states. Carbon’s page was updated 25 September 2026. The teal choice and spacing are project design decisions, not claims of universal comfort or the latest version of a vendor UI. [Tailwind’s variable-reference guidance](https://tailwindcss.com/docs/theme#referencing-other-variables) supports the scope correction. No framework or dependency upgrade was needed.

## Verification

Final visual/table browser **1/1 passes** in `916eb84c9a2a`. It verifies the actual shared revenue table uses the same current surface as its panel, then exercises the checklist/catalog, theme reload, keyboard recovery, pagination and responsive layouts. The connected merchant/Console support journey **1/1 passes** in `6cd05ce7bd55`, including normal merchant settings save/readback, real Console MFA sign-in, private/public reply isolation, original-request recovery and resolution. Its earlier visual-test instrumentation failure is retained in that mixed receipt rather than being relabelled green.

- Complete shared UI: **52/52 pass**, including token-pair contrast, layered dark surfaces, shared table colours and actual utility compilation.
- Existing Console regressions: **46/46 pass**.
- Console production build: exit **0**, including TypeScript and route generation, in a separate environment-free source copy.
- Owned browser `d3fae7ee8d88`: **2/2 pass**, covering visual/keyboard behaviour and all enabled pages. Page coverage is 20 index pages, four populated details, two frozen-page refusals, page-two listing, failed-form draft retention and narrow-screen navigation. A final surface mapping subsequently aligns shared table backgrounds/borders and muted text; final table and support acceptance is recorded separately.
- Final visual coverage includes light/dark overview, shared revenue table, merchant checklist/catalog, theme reload, 1440/390/320px layouts, keyboard/dialog recovery, account dismissal and unavailable/restricted states. The 155 sampled text observations have a minimum **4.5078:1**; this is a bounded text sample, not full WCAG or assistive-technology certification. Desktop/dark/mobile/table/support screenshots were inspected.
- Scoped Console ESLint, CSS stylelint, Console/shared UI/Gateway types, public API and token-variable snapshots, DTCG parity, shared adoption contracts and the design-system ratchet pass. Four Console-local `--lb-*` overrides were removed; no baseline or validator was weakened.
- The token-alias validator remains red with **18 findings identical before and after this pass**. Its baseline reproduction is preserved. No snapshot was loosened to conceal the existing issue; no full-platform green gate is claimed.

Earlier browser `af4166d5ffe2` remains failed: page coverage passed, but the visual run sampled the active navigation during a theme transition. A screenshot review also exposed the root-resolved utility colours. Both causes were addressed; no failed receipt is relabelled green.

The later table assertion originally returned an unevaluated function from a browser expression, yielding `undefined`. Its corrected invocation preserves the exact table/panel equality check and passes in the final visual run. Runtime source is unchanged between the successful support journey and final visual acceptance. All runner receipts show verified cleanup with no failures or remaining owned containers, networks or volumes.

## Scope and delivery

Source is uncommitted on `develop`, HEAD `118209b4fde1b5a15313f4741bcac454690d15c8`. The pass starts from 153 pre-existing changed files and preserves unrelated work. The owned browser/database fixtures use disposable infrastructure; the Console browser runtime is development, with a separate successful production build. No production Console browser, hosted deployment, real provider delivery, database migration, push or merge is claimed. No permission, money rule, domain workflow or parent programme acceptance changes.

Raw logs and full source fingerprints are under `/private/tmp/letbuyy-console-palette-20261022/`. [Final screenshots and receipts](../docs/evidence/console-graphite-teal-2026-10-22/) and the paired JSON record preserve the source identity, exact results, earlier failures and unchanged baseline findings. The browser candidate's runtime/test sources and production-build runtime sources match the delivered source; the ledger and programme continuity were updated after verification. The requested refinement is implemented and locally verified; hosted release remains separate.
