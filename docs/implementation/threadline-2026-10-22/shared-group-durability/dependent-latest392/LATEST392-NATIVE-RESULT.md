# Full default-LATEST392 qualification

Run `bc5db405796b` passed all three admitted full suites in one fresh owned native lane: **19 passed, 0 failed, 0 skipped, 0 cancelled, 0 todo**. Wall time was 159.8 seconds. No source fix or retry was needed in this lane.

| Full suite | Passed | Failed | Skipped |
| --- | ---: | ---: | ---: |
| Electronics search / 392 | 8 | 0 | 0 |
| Shared header/footer / 391 | 6 | 0 | 0 |
| Niche theme promotion / 389–390 | 5 | 0 | 0 |

Each suite received its own owned database from the canonical runner. All three applied the actual 321-file migration chain through 392 with no migration ceiling. The run used jobs 1, no reaping, a 600-second suite timeout and two prepared transactions.

## Header/footer save → reload → publish

The real mounted API and PostgreSQL passed the complete flow for all ten themes. Each theme saved changed header/footer fields, reloaded the acknowledged revision, published the exact draft snapshot, and returned the same fields through the anonymous public storefront API with HTTP 200. The canonical renderer projection was also asserted against the edited root configuration and immutable Liquid base.

Thirty additional cases omitted header, footer, or both from later saves and retained the previously saved groups. Saved unselected pages and alternates survived. Concurrent retries produced one effect; stale revisions, changed idempotency payloads, foreign actors and invalid sections were rejected. A synthetic late outbox failure rolled back the draft, revision, patch, audit and receipt together.

Threadline (`letbuyy-sense`) reached draft version 7 and published release `1e1b60f8-c440-471d-920e-94a4f00732fd`. Its saved header was `Native391 header letbuyy-sense`; its saved footer was `Native391 footer letbuyy-sense`. All three omission cases reloaded the acknowledged version and retained both fields. The exact proof is [Threadline native flow](native-runs/01/proofs/theme-shared-groups.postgres/letbuyy-sense.json).

## Migration and evidence conservation

Both dependent consumers entered with the exact qualified 392 browse body and 391 editor body. The shared-group suite performed strict 392 DOWN, 391 DOWN, all five existing phases, 391 UP and 392 UP. The promotion suite performed strict 392/390/389 DOWN, all four existing phases, then 389/390/392 UP. Exact original discovery profiles were restored, 391 remained protected through the promotion journey, and business rows were conserved around the migration legs. Existing privilege, raw ACL, default-expression AST, provider-fence and unknown-body refusals remained active.

All **816** captured current source/evidence inputs were byte-identical before and after this lane, including the 47 frozen generator/theme sources, nine release artifacts, SQL pairs and all new admissions. The 31 archived historical source/receipt files were independently checked. Original historical admissions remain unchanged.

The evidence contains 365 native proof files (343 search, 15 shared groups, 7 promotion). Every emitted original proof and copied proof was checked against its emitted SHA-256. The [qualification](latest392-qualification.json) links the raw result, source snapshots, run binding, proof-copy receipt and per-theme evidence. The [manifest](latest392-native-evidence-manifest.json) freezes 376 evidence files.

## Scope and next handoff

This is native SQL and API acceptance. A browser editor save/full-page-reload/publish pass on the retained candidate is still separate and is **not claimed here**. No retained fixture was migrated; no candidate app was started, restarted or rebuilt. Threadline preview, merchant login, user tabs, and the retained `9cd50e893016`, `d4eb85047858` and `ff9941a78139` fixtures were untouched.

The runner removed its own PostgREST containers, databases, PostgreSQL container, network and volume. Cleanup failures and remaining containers/networks/volumes were empty, and the reaped list was empty. The native lane is released for the coordinator’s independent review; applying 391/392 to the Editor-owned candidate and performing its browser proof remain with that separately allocated flow.
