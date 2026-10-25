# Canonical theme update repair — source release

**GOVERNANCE HOLD — supersedes the release-ready interpretation below.** Independent review rejected the whole-transaction `service_role` approach under SEC-R9 / ART-08 and requires validated `OwnedStoreScope` under IDN-R5. The prepared transaction is unapproved and must not execute. Source/logic checks and logging/Date fixes do not qualify its tenancy. Final source release and native preparation are held. See `TENANT-PUBLICATION-PROPOSAL.md` and `GOVERNANCE-HOLD.json`; the proposed capability helper has not been implemented or approved.

Implemented and verified at the source/logic layer. Native PostgreSQL/mounted-API/browser qualification is **NOT RUN** and remains ungranted pending independent Root review. This supersedes the unresolved source-blocker status of the earlier native-source handoff, while preserving that epoch's raw evidence and snapshots.

## Resulting behavior

The existing theme engine now separates its closed schema-epoch compatibility check from package-edition ordering. Package `version_number` is the existing catalog ordinal; `version` remains an opaque display label. Same-schema Playfield2.0.0→2.0.1 applies the admitted target's product source and preserves merchant content. Schema downgrades and package downgrades both refuse. Another package, conflicting labels/ordinals and unknown schema direction fail closed. The existing schema `fromVersion`/`toVersion` fields remain; the diff additionally carries package identity/version/ordinal fields.

The existing update route loads the selected target with its actual package/catalog context. Deleted/revoked versions, unavailable/deleted packages, wrong-package or mismatched capture identity, unsupported Liquid and another store's private theme refuse before publication. A correctly owned private theme remains a positive control. Merchant ownership/session-store guards remain before target access and are repeated under the mutation's site lock.

Confirmation now binds the exact diff, current release UUID and selected target UUID. The request fingerprint binds the store, slug, target, confirmation and normalized publication options. Exact retry is read after current authorization/availability, so its own committed baseline change does not reject it; changing intent while reusing its key conflicts. The transaction checks the receipt again to serialize concurrent retries.

The existing adapter uses the existing pooled SQL transport/backend service role and **calls the existing `public.publish_theme_release`**, with no new publisher/RPC/runner. One transaction locks and rechecks current ownership, target availability, release/config and installed instance; repoints that instance; invokes the publisher; writes release artifacts and the exact retry receipt; then commits. Missing SQL transport fails closed. The version update has no multi-request REST fallback. Private draft/patch/revision rows are not consumed. The canonical376 publisher already preserves those private drafts; the baseline body inspected earlier is historical, not current behavior.

These are implemented source semantics. Unit tests with injected SQL results exercise control flow and serialization, **not actual PostgreSQL locking/commit/rollback/RLS**. The real native lane remains necessary for publication, faults, concurrency, restoration and no-effect state proofs.

Independent review completed the CODE-R3 failure contract within the same adapter: unexpected transaction or transport-factory failures use the existing `foundationStructuredLog` pattern and return sanitized500 `INTERNAL_ERROR`. Logs contain only fixed operation/classification, an optional validated request ID and optional five-character SQLSTATE; raw message, query, payload, credentials and malformed IDs/codes are omitted. Known `AppError`, missing-transport503 and concurrency409 behavior remain. The unchanged native late-outbox install/rollback assertion is retained; it is not relabeled as this new update path's unexpected-error response.

The installed postgres.js timestamp parser returns `Date`, whereas REST returns a string. The adapter now accepts both and normalizes response timestamps to the same UTC representation for first publication and replay. Database timestamps/history are not rewritten. Both driver-shaped cases originally failed and now pass; dependency behavior and its lock-bound parser hash are recorded separately.

## Verification and preserved reds

- **87 focused tests passed:**47 theme-engine and40 existing gateway source/logic tests; zero failures, skips, todo or cancellation. All42 original engine cases and18 original gateway cases remain, with same-package/advancing-ordinal corrections to three legacy test fixtures and stronger fingerprinted receipt fixtures. No behavioral assertion was relaxed. Final TAP: `source-tests-10-reviewed-final.tap`.
- Exact captured200→201 originally failed (`actual2.0.0`, expected2.0.1); downgrade and wrong-package/reused-ordinal refusals originally failed. The first engine RED is42pass/3fail. Seven target-availability/identity/foreign-private cases originally accepted invalid targets (gateway RED20pass/7fail). Unsupported-schema refusal already passed. Raw TAP is preserved.
- A first gateway-test launch had a bad fixture path and is retained separately; it is **not** counted as a behavioral RED. The corrected behavioral run is `gateway-03-red.tap`.
- The final exact-bundle public-export probe returns2.0.1 with the target product source, preserves its input and rejects the reverse update with `UpdateDowngradeError`.
- Two Date timestamp cases are preserved as35pass/2fail in `gateway-driver-date-red.tap`; the additional logging contract is preserved as35pass/3fail in `gateway-driver-logging-red.tap`. A subsequent failure was an overly broad no-leakage regex matching the required operation name itself; the corrected assertion still forbids raw SQL statements/messages/secret markers. A null request-ID type error is preserved in `gateway-noemit-04-reviewed.log`; invalid IDs now follow the existing logger's typed omission contract.
- **Six refreshed source/admission checks passed.** These include the actual1,078-file positive control and failure on absent/pending admission, wrong suite/closure hashes, tampered dependency, and premature393 UP/DOWN source. They evaluate only the pure admission prefix with an in-memory simulated admission, not the owned suite module. A5pass/1fail stale-closure attempt during asynchronous refresh is retained; the final probe→snapshot→checks were awaited sequentially, without weakening the stale-source assertion. Final TAP: `native-source-contracts-post-review.tap`.
- Theme-engine and gateway noEmit typechecks exited0. The final gateway check is `gateway-noemit-05-final.log` (empty diagnostics).
- Targeted lint is **not fully green**: eight errors existed in the exact pre-repair snapshots and remain (seven existing hex-color fixtures/defaults and one unrelated `prefer-const`). Final comparison uses the same configuration and original source text; it finds zero new diagnostics. Raw baseline/current/final JSON and stderr are preserved. No lint suppression was added.

The previous1,075-file closure is preserved. Its only changed execution sources are the three granted production files, plus the two own docs source-check/capture scripts. The two adjacent test files and the unchanged existing structured logger are newly bound inputs; no additional production path was edited. The final closure has **1,078 files/2,023 literal import edges**, with1,070 prior input hashes unchanged, no removed input, and all current hashes rechecked. Moving browser cart/URL source remains excluded. This closure describes the reviewed source epoch and imposes no unrelated source freeze.

## Exact final hashes

| File | SHA256 |
| --- | --- |
| `packages/theme-engine/src/theme-safe-update.ts` | `10a4b866dbe3167e879d9af43fd61b8c3d751d605ca181e5b2c65adfaa39f539` |
| `packages/theme-engine/test/theme-safe-update.test.ts` | `bc7c41e8b3c1b8bb840a7349d1f856a52e27cd11bc5c6ec7bc3cf4e653878ae3` |
| `services/api-gateway/src/routes/themes/theme-update-route.ts` | `85e3e888f9bf222e07abddd58a92c39417dcbbed8773872049a982e487afc89b` |
| `services/api-gateway/src/execution/theme-execution.adapter.ts` | `f9d8a01afa9075abb5e33f0ca4cc73fbe3a1d860aef03473e30f1372ba5b00fd` |
| `services/api-gateway/src/__tests__/theme-update.test.ts` | `3ba874df56639895940c22a26b2b7f9f52d7a1fca3cad6e278cd4425c988c8dc` |

Native suite remains byte-exact at `f06e2e2185fcb97d58e2972a4e697cb82e6fc9bd0bdf70ef97f629ccfa7c08ea`. Refreshed input closure SHA256: `6d95d36e97a138b3e6d2bffaa0f97c9e459f869ec6fcbe5f704be9b92240ba64`. The exact own repair is `canonical-update-repair.diff`; before/after files, review additions and earlier epochs' snapshots are bound by `source-release.json`.

## Remaining gate and conservation

Root must independently review this source, particularly the ordinary update transaction around the existing publisher, then create an actual final-source admission and allocate one fresh default-LATEST392/no-ceiling owned lane for the unchanged eight-phase393 suite. The pending template remains invalid and `admission.json` is absent. Do not infer permission to run from these passing source checks.

The existing runner command remains the one in `../SOURCE-RELEASE.md`: one suite, jobs1, no-reap, timeout600, prepared-transactions2, no migration ceiling, candidate393 outside the migration scan. Keep raw native REDs/ownership/source-before-after/provenance/cleanup; no native pass is carried forward from the historical19-test run to this changed source epoch. The unchanged suite currently has one parent/eight children; its real API and final source checks remain hard assertions.

All five immutable proposal files and61 factory-source pins are byte-exact. Migration maximum remains392; no migration393 was emitted/applied. Existing migrations, generator, runner, owned support, shared browser fixture and all current fixture stores remain unchanged. No app runtime, browser tab, merchant login, retained Threadline preview, hosted database or provider operation was touched. Installed browser/cart/checkout/accounts acceptance remains separate.
