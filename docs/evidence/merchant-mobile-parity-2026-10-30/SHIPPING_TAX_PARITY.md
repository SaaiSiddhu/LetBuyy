# Shipping and tax parity — scoped source qualification

30 October 2026. Implementation checkpoints `4dfc715e4` / `622e709c7`, editor lifetime repair `d109894ec`, and navigation `863f556b131db3f945f3489d3023a6b14ed3bb1a`. This is partial local qualification for ledger rows 87/90 and their downstream contracts. None of rows 87–93 is accepted end to end.

## Accepted source reconciliation

Accepted remote develop/staging `77584d19dc3dc557f29f9e2fbc7a967fe38e132c` was locally merged in `4197b81fc0cf25eea918b0be9fc556013d9689e3`. This brings the existing shipping/GST owner and migrations 411–413 into this branch. The conflict preserved both branch-disposition records. The primary checkout at `a72196c6ea9cd86b07d6d8414da2b8176c41046a` retained 139 dirty paths when checked; none was reset or copied.

The composed merge passed 561 Flutter tests, 1,848 Gateway unit/contracts, 97 web checks and 114 governance validators. Owned run `5621a376aadb`: 67/67 in nine suites, including shipping profiles/settings, authoritative checkout tax, GST invoice, payout/money approvals, history/records and operations. Cleanup verified. These receipts establish local composition, not deployment or tax-law certification.

## Current changes

| Boundary | Implemented and checked |
|---|---|
| Gateway | Four settings lists require exact counts and acknowledge the authorized store. Missing counts produce 503 instead of a fabricated empty configuration. Existing live-owner checks remain. |
| Dart SDK | Zones, rates, taxes and profiles compose complete bounded views with explicit store header/query, page/count acknowledgement, stable totals, unique IDs and foreign root/join rejection. Above 1,000 records fails explicitly; individual page APIs remain available. |
| Web SDK | Same scoped/count-checked bounded composition; caller store selection pins transport even when the client default differs. Explicit page requests retain their existing page-only contract. |
| Shared Dart models | Shipping/tax DTOs moved out of the app into the existing canonical Dart model package. Profile handling charges preserve exact paise; revision strings preserve server precision. Missing COD flags remain unknown. |
| Native state | Resource state belongs to the actor/store/context and request generation. Failed refreshes clear rows. Late responses cannot republish an old actor or A→B→A store generation. |
| Native editors | Store/account changes retire private forms and late commands. Permission denials retire loaded rows and mutation controls. Dialog controllers survive until route exit completes. Bounds/state/HSN can be explicitly cleared on PATCH. |
| Tax-inclusive setting | Requires a fresh, owned store response with an actual boolean; cached or missing values cannot enable the editor. |
| Navigation/layout | Normal Settings opens the actual registered Shipping and Taxes routes. Phone-size tab wrapping, constrained store switcher and multiline action subtitles avoid the reproduced overflows. |

The two new denied-save journeys failed against `622e709c7`, including a controller-disposed-during-exit exception; the failure log is preserved. After the lifetime and denial repairs, the focused suite passed 29/29. Separate Settings navigation tests passed 2/2 at 390×844 without suppressing overflow exceptions.

## Verification identities

- Full Flutter at the navigation checkpoint: **592/592**, clean analysis.
- Shared model money/revision/clearing tests: **4/4**.
- Web read/recovery/settings regressions: **94/94**; SDK, web and Gateway typechecks passed.
- Gateway unit/contracts: **1,848/1,848**. Gateway and SDK runtime source is unchanged by the subsequent native-only editor/navigation commits.
- Actual SDK → Gateway → PostgREST run `9944d6b8ead6`: **21/21** in shipping-profiles, shipping-tax-settings and checkout-tax-authority. Missing-count faults, store acknowledgement, 101-row composition, foreign-store denial and recovery are exercised. Cleanup verified.
- Exact-source governance passes 114/114. Installed debug APK bytes 148,929,907 and SHA-256 f1921aba760b4dbe346c1d1c09ae373407356ad4717830381afd20625a7bcf39 match. Normal Settings → Shipping/Taxes initial and refresh reads show generic unavailable states without mutation controls, zero shipping summaries or a tax-inclusive switch. The UI does not identify the hosted failure cause. Full observations are recorded in `QUALIFICATION.json` and the source handoff.

Private test logs/artifacts remain under `/private/tmp/letbuyy-shipping-*`. No credentials, private store lists or authenticated HTTP bodies are included in this evidence.

## Remaining gates

Native profile management UI, zone/profile assignment and COD controls, weight editing, product-profile selection, durable settings mutation recovery, concurrent web/mobile edits and conflict handling remain open. Legacy permissive rate/tax field decoders still need full canonical response validation. Above-cap UI pagination, serviceability/carrier labels, GST/invoice mobile views, provider acceptance, hosted compatible responses and both-direction writes remain open. No provider transaction, hosted migration, deployment, production settings write, release signing or production-ready certification was performed.

