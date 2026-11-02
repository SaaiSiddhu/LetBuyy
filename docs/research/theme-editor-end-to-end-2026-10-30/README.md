# Theme Editor end-to-end research — 30 October 2026

## Verdict

The canonical source contains a capable schema-driven editor, versioned draft and release APIs, signed preview, and ten opt-in 2.1.0 first-party bundle factories. The current mounted editor, applied database, installed catalog versions, and anonymous published output were **not verified** in this audit. The editor's section-add callback is demonstrably template-append-only in current source; its preview insertion callback is declared but not wired by the page. Device selection contributes to the iframe URL and key. These shared issues potentially affect every theme.

The existing [30 October starting analysis](../../implementation/theme-editor-2026-10-30/ANALYSIS_AND_DELIVERY_PLAN.md) recorded direct Shopify Horizon observations, including Header/Template/Footer, a contextual section catalog, and the `contact` template/resource combination. Those observations are **historical evidence only in this package**. Current Chrome inspection was attempted under a bounded coordinator allocation, but automatic approval review rejected the browser open because it considered the project paused. No new direct Shopify UI observation was made.

## Method and evidence words

`DIRECTLY OBSERVED IN SHOPIFY UI` means observed in this audit; there are **none**. `OFFICIAL SHOPIFY DOCUMENTATION` means the linked current public Help Center/developer contract. `LETBUYY SOURCE VERIFIED` means current checkout source or a source-only bundle factory execution. `LETBUYY DATABASE VERIFIED`, `LETBUYY MOUNTED RUNTIME VERIFIED`, and `LETBUYY PUBLISHED STOREFRONT VERIFIED` require separate real readbacks; none were obtained. `HISTORICAL EVIDENCE ONLY` refers to older chat, screenshots, tests, and receipts. `INFERENCE` is a reasoned implication. `NOT VERIFIED` names a missing test or resource. A test file's presence is source evidence, not a passing result.

Checkout: `develop` at `a72196c6ea9cd86b07d6d8414da2b8176c41046a`; cached `origin/develop` was `55975acd0da3fd39bcff56168e19b05ff598bc43` (not a fresh remote read). At intake, `git status --short` had 122 entries, including the dirty editor page. Root and Merchant `node_modules` existed. No branch switch, reset, dependency install, runtime activation, database query, or test execution was made. Current process/container readiness was not inspected because the coordinator granted no audit fixture admission.

## Read in order

1. [Shopify workflows](SHOPIFY_UI_WORKFLOWS.md) and [public contracts](SHOPIFY_PUBLIC_CONTRACTS.md) distinguish historical UI from documented behavior.
2. [LetBuyy architecture](LETBUYY_ARCHITECTURE.md) maps ownership, APIs, data, trust boundaries, and error recovery.
3. [Feature parity matrix](FEATURE_PARITY_MATRIX.md) ties capabilities to gaps and acceptance.
4. [Ten-theme inventory](TEN_THEME_INVENTORY.md) summarizes each niche; [the source catalog](TEN_THEME_SOURCE_CATALOG.md) enumerates all generated templates, sections, controls, blocks, and presets.
5. [Field/render trace](FIELD_RENDER_TRACE.md), [gaps](GAPS_AND_RISKS.md), and [implementation blueprint](IMPLEMENTATION_BLUEPRINT.md) guide later work.
6. [Evidence index](EVIDENCE_INDEX.md) and [open questions](OPEN_QUESTIONS.md) define what is proven and what needs a new allocation or owner decision.

This package is research, not new governance or a release certificate. The Constitution, root `AGENTS.md`, and canonical registry remain authoritative. No implementation source, Shopify setting, database, theme publication, deployment, or payment state was changed by this task.
