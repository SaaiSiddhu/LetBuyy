# Location and supplier creation recovery

1 November 2026. Source/local qualification; no hosted migration, deployment, signing or publication.

## Connected implementation

Location and supplier creation now use the existing warehouse command owner, not a second receipt or retry system. Native `InventoryService` freezes the normalized intent and retains its original key in the existing encrypted actor/site journal before transport. Both native screens expose the shared recovery panel independently of list success, block a new action while unresolved, retire old account/store results, and refresh current records after confirmation. Invalid forms retain the draft and show an error before journaling. Supplier email syntax and length agree with the canonical server schema.

The TypeScript SDK validates the normalized request and the returned actor/site/key/operation/intent, including the actual metadata entity and structured address/pincode. Both real Next create proxies bind current identity, owned site, origin and the original key before the SDK call. The existing web recovery hook can route either metadata command through its existing journal. The existing web location/supplier dialogs now use that hook, pin actor/site lifetimes, preserve uncertain commands through remounts, and read back strict paginated records with exact counts. Web location address fields now match the canonical flat input; pincode is preserved as a structured field by both clients and SQL. This does not claim a hosted authenticated browser create journey.

The existing **unreleased** migration 414 commits the entity and immutable acknowledgement in one transaction. Same-key concurrent applies share one outcome; different intent, actor or site conflicts. Stop-before-apply records cancellation; stop-after-apply returns the original applied outcome, including when the record was subsequently retired. Current authority is checked before private receipt replay. Historical receipts never replace a fresh list read.

414 additionally revokes raw metadata-table INSERT from captured Data API roles, preserving unrelated grants. Its privilege journal records exact object identity, owner and schema fingerprint. The paired empty-only DOWN restores only captured INSERT deltas and refuses changed table/privilege profiles, retained receipts and concurrent/prepared writers. Canonical trusted automatic default-location creation remains the existing database owner; this change does not replace onboarding or its helper.

The unified transport descriptor is now **protocol 2** for all seven warehouse commands. New clients refuse an older descriptor before POST; old clients receive 426 from the new command routes before effects/replay. Existing stock intents retain their original encrypted journal format. Capability is a guarded code-path declaration, not a permission lease or database-readiness certificate. Clients and server/schema must be qualified together; no legacy unsafe fallback is introduced.

## Qualification record

Final implementation source: `15fca500a08ee8c1c3c4d37a376f8fd81ee97403`. This report does not close the 122-feature programme.

- Complete Merchant native suite **728/728**, analyzer clean; shared Dart models **64/64**.
- Complete Gateway unit/contracts **2,025/2,025**; Gateway, SDK, web and shared-contract typing/build pass.
- Composed web lifecycle/journal/real-Next-proxy checks **259/259**, including six new actual location/supplier form/recovery/retirement/page cases. Focused SDK matrix **61/61** is included in the Gateway coverage, not an additional total. Shared TypeScript tests **18/18**.
- Fresh owned SDK → Gateway → PostgreSQL and paired rollback **51/51**, run `25db76a0876b`, source `15fca500a`; no remaining owned containers, networks or volumes. Includes receipt-write fault rollback, concurrent duplicates, lost committed replies, stop-before/after effects, changed intent/site/actor denial, retired-record resolution, raw role INSERT denial and exact guarded DOWN restoration.
- Separate tenant/raw-role baseline **8/8**, run `c51c7ba82aaf`, source `023ca4131`, clean cleanup. Final source changes only the command codec/body/pincode and web/native callers; tenancy and privilege-fence inputs of that baseline are unchanged. Current owned 51-test run independently rechecks the new command owner and INSERT fences.
- Exact-source full governance **114 pass**, zero fail/blocked/skip, one not-applicable; the earlier package-layer defect is closed without weakening its validator. Final Android debug APK is **219,850,329 bytes**, SHA-256 `fec82e09e09c4b88c8adcd781b6961a48bd23adbf58626e6e65b5b6302cc5785`; installed bytes match. Authenticated primary tabs survived the update. Products → Inventory → Locations and Suppliers were each observed: warehouse actions unavailable, count unavailable, create disabled, no false zero or unresolved saved request. The UI does not identify the hosted failure cause. These are safe-unavailable read observations, not hosted create/readback acceptance.

The wire codec now lives in `@letbuyy/shared-types` with commerce-core public compatibility re-exports. The SDK imports only the permitted shared boundary; execution/authority remains the existing monolith/SQL owner. No validator or package-layer rule was weakened.

Preserved failures:

- Run `6f0560112ced`, source `8b9f70d20`: cold migration 414 failed before tests because the metadata privilege block reused a PL/pgSQL record variable as a SQL alias. No hosted state was touched; owned cleanup was complete. Corrected in `3c6bb419e`.
- Run `9b733951da97`, source `3c6bb419e`: 50/51 checks passed; one existing SDK readback test accessed its extracted supplier before initialization. The five rollback checks and ten added metadata behavioral checks passed. Test ordering corrected in `0cc7141d0`; supplier pre-retention validation was also tightened there. Both failure receipts remain under the task's private temporary evidence paths.
- Governance source `023ca4131`: 113 pass / 1 fail because the SDK imported commerce-core across a forbidden package layer. Source `15fca500a` removes that dependency and moves the one existing wire-codec implementation into the canonical shared DTO boundary. The targeted dependency-graph check now passes.

## Authentication and acceptance limits

The user completed the current human-verification step after authorized private-stdin native credential entry; the Merchant dashboard and Products/Inventory navigation were observed on the task-owned Android 15/API 35 emulator. That initial successful sign-in belongs to installed debug source `8be82e4af`. Final source `15fca500a` was then built and installed with application data preserved; its retained authenticated primary tabs were observed. Credential values were not retained in source, command-line arguments, logs or evidence. Read-only production navigation does not prove metadata writes or cross-client synchronization.

All mutation proofs here use owned synthetic accounts and records. Remaining gates include an accepted web-source reconciliation, compatible hosted API/schema, authenticated owner/restricted-staff create/readback and two-direction web/mobile edits/conflicts/revocation, signed Android/iOS release artifacts, provider-specific acceptance and staged operating readback. All 122 primary feature rows remain in the ledger; no all-feature or production-ready certification is asserted.


Final artifact and continuity: `15fca500a` is debug signed with production endpoint configuration; this is not an Android release candidate or store publication. The task-specific credential input helper/dex was removed after sign-in; credentials were never saved by it. The authenticated emulator/application data was preserved. All 122 primary rows were checked for unique IDs 1–122 after ledger reconciliation. No production business writes occurred.
