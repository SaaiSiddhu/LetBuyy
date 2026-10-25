# Reserved391 shared header/footer durability proposal

Status: **PREPARED; no native391 execution, no active391 migration emitted, no retained fixture application.** The admission sentinel is intentionally pending. The coordinator's draft review and a fresh owned-database lease are required before the native suite may run.

The accepted390 equipment length and furniture width/depth work is closed in [its combined qualification record](../promotion-qualification/qualification.json). Its accepted SQL/source/native receipts remain frozen. This proposal addresses the subsequently observed shared-header save loss described in [the diagnosis](../editor-save-diagnosis/README.md).

## Exact change

The six added lines in [the review diff](391-body-proposal.diff) reapply explicitly supplied `templates.header` and `templates.footer` after preservation of saved unselected pages and the selected page. Incoming stale unselected pages do not gain precedence. There are no schema, immutable-capture, data, transport, renderer, or historical384 edits.

| Input | SHA256 |
| --- | --- |
| [UP draft](391_shared_group_durability.up.draft.sql) | `27fa0234ad98c4b924fb0d1ecec22e9f592ab533f438ca348f99e4c6bb17a17c` |
| [DOWN draft](391_shared_group_durability.down.draft.sql) | `7fea9fbf09df7f8f3af189ce3e406d3f7582ae2c371bf4dde225b59f91f25b54` |
| Qualified384 source | `e7304c2306956dd3784175d4f735e3d8f9029ddc1631f97b9d396d1ee9f55cca` |

The sole target is `public.mutate_owned_theme_draft_v1(uuid,uuid,text,text,integer,text,text,jsonb,jsonb,uuid,text,jsonb)`. Baseline/DOWN `prosrc` MD5 is `2a6e74135720d0557ba921d517e88a13`; proposed UP is `f14f2252157119e56f6614decef4c4aa`.

Both transaction wrappers keep the qualified native catalog lock/provider-admin fence. They refuse unknown function bodies/profiles, non-owner ACL grantors, untrusted direct or inherited execution, and any change to the complete non-body `pg_proc` row, comments, dependencies, shared dependencies, raw ACL, or raw default-expression AST. Dynamic replacement DDL begins at byte0 with the original `CREATE` header so default AST source positions stay exact. DOWN restores the exact384 function body and writes no business rows. Replay admits only either known body and is required to be a data-preserving no-op.

## Prepared native qualification

New suite: [theme-shared-groups.postgres.test.ts](../../../../services/api-gateway/src/__tests__/owned-db/theme-shared-groups.postgres.test.ts). It needs central inventory registration by the coordinator; this chat has not changed the central inventory.

The suite refuses absent/pending review admission. It admits a fresh canonical owned fixture through390, or default-LATEST containing the exact root-reviewed391 body. Both require the exact390 browse function and all nine admitted2.0.0 captures plus the actual pinned Threadline2.0.0 descriptor from382. A latest391 entry must first execute the strict admitted paired DOWN and prove full business-state and non-body catalog conservation; it then runs every same baseline and qualification phase and finishes at UP391. Unknown bodies fail before DDL. There is no proposal fallback, speculative later-version admission, app import, developer-stack access, skipped phase, or default runner ceiling change.

Threadline is read from the real382 SQL payload, pinned by the existing manifest's file/payload/parsed-bundle/raw-bundle hashes. No factory or replacement descriptor is generated. Its canonical schema endpoint may materialize the pinned version before the capture digest is frozen. The prepared test freezes all package/version/schema/renderer captures thereafter and protects every catalog content field. Real merchant installation invokes the existing `update_theme_install_count()` trigger; its exact active-row count and `max(store_themes.updated_at)` timestamp are asserted, then every other Threadline catalog field is compared exactly. Around either391 SQL leg, full catalog rows including operational statistics remain byte-exact through the complete state digest.

Its five dependent child phases and parent are prepared to prove:

1. The actual mounted worker reproduces the qualified384 bug: a changed header/footer is acknowledged but overwritten, while a selected local edit survives.
2. Both real profile and ACL/grantor/inherited-role mutants refuse atomically; UP alters only the known body. Exact non-body catalog/default/ACL/dependency conservation and replay are checked.
3. All ten themes install their actual package/version IDs, save a page and alternate, then save changed declared header/footer/local fields against stale unselected pages. Concurrent same-intent saves have one patch/outbox/version effect; replay, stale version, key-content reuse, invalid runtime section, and foreign tenant denials preserve exact state. Each theme also saves three partial payloads: absent header, absent footer, and both absent. A changed selected local field must persist, both prior shared groups and every unselected page must remain exact, and the revision must increment once. Actual publication snapshot and anonymous `render-v1` readback retain the final edited root fields; the canonical compiler projects them onto the unchanged immutable base.
4. A real late `theme.draft.saved` outbox trigger failure rolls back draft/edit/version/patch/audit/receipt writes and returns a sanitized503.
5. DOWN/DOWN replay/UP restore each exact body/profile while conserving all captured edits, releases, business state and protected Threadline. Both legs retain private execution and provider-fence checks.

The suite uses only `requireOwnedDatabase`, its own synthetic tenants, real identity-signed gateway requests, and an owned pooled SQL proxy. A single event-loop drain after synchronous SQL avoids the previously diagnosed test-process socket-close race; it is not an HTTP retry. All evidence is written into a new temporary directory with run ownership and content hashes. Native result, source-before/after proof, cleanup receipt and raw TAP must be retained even on failure. A dedicated native proof records the actual complete current/proposed profiles; [the prepared profile contract](profile-contract.json) is clearly classified as source-declared, not a live database inspection.

Future392 owner handoff is deferred: once a later owner has an exact reviewed392 pair, that owner must establish strict392 DOWN first, then391 DOWN and all full phases, UP391 and exact392 restoration, with corresponding full data/catalog proofs. No392 receipt, ordering branch or admission is speculatively implemented here.

## Admission format for review

After reviewing exact draft and suite bytes, the coordinator can create its own immutable JSON review receipt with these fields and copy those pins into `admission.json`:

```json
{
  "status": "ROOT_REVIEWED_FOR_OWNED_NATIVE_QUALIFICATION",
  "migration": 391,
  "throughMigration": 390,
  "upSha256": "<exact UP hash>",
  "downSha256": "<exact DOWN hash>",
  "suiteSha256": "<reviewed final suite hash>"
}
```

The admission additionally requires `rootReceiptPath` under `docs/implementation/` and `rootReceiptSha256`. Paths containing `..` are refused. This review admission is not a native lease and does not authorize applying391 to retained9cd or emitting an active migration. Those are separate explicit coordination checkpoints after native qualification.

## Executed preparation checks and limits

[Six source contracts](contracts.test.mjs) pass. They establish the minimal exact body diff, selected/nonselected merge ordering, exact DOWN, raw default-AST header positions, complete profile guards, native provider fence and consistency of the current/proposed source profile record. The first source-contract run had one faulty assertion counting grantor checks across the provider fence as well as the target guards; its red TAP is preserved. The assertion now checks each of the two target profile blocks individually; SQL guards were not weakened.

[Ten fixture contracts](fixture-contracts.test.mjs) pass using descriptor/field-selection/edit/projection helpers extracted from the prepared native suite plus the real shared validator/compiler. The nine exact disk artifacts and the pinned actual382 Threadline payload all pass changed header/footer/local, alternate-template, and each missing-group payload validation. The deliberately invalid section is rejected and the embedded base stays unchanged. These checks do not prove SQL durability, browser rendering, publication, or checkout behavior.

The gateway `tsc --noEmit` passes. [Preparation qualification](preparation.json) records final exact input hashes and logs. No database, app, browser, build, active391 emission, hosted migration, provider operation or deployment was performed for391.
