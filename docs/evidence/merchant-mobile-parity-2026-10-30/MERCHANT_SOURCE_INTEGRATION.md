# Merchant source integration — 1 November 2026

Status: source/local integration is committed at `7b76ffed97e9f1f4c18e9dc0162ada3e7257ddd6` and the applicable local gates below pass. No new Merchant deployment, hosted415 or remote push. Earlier pending/uncommitted paragraphs below describe preparation before the owner decision. Preserve the READY Accounts recovery `ce8140b09` / `dpl_D7ThevfxEBw887k74Jj3ugVsNS4x` and existing staging API/BFF. Migration414 must not be submitted again or rolled down after use.

## Source and resolved conflicts

Task source before integration: `bbb9aab75` (qualification at `ce8140b092197a06b7cfd940d154cae4353e886d`). Current Merchant staging source: `e4105581e3346041d71694d3db093eb713773e07`, deployment `dpl_A5ws3ZPqWnu73BWcJskie1fuUMhz`. Ten local conflicts are reconciled, with qualification pending:

- Preserve the newer Merchant shell, navigation, assets, empty-state scenes, notifications, billing and gift-card source behavior.
- Keep canonical customer segment DTOs and exact currency handling, warehouse paged reads, unavailable states, durable original-key recovery and current protocol gates.
- Keep both test inventories, browser storage/lock fixtures and all warehouse plus notification lifecycle cases. Combine the route-owned gift-card and warehouse replay exemptions; each canonical SQL owner must recheck current permission.
- Retain the other branch's claim unchanged and place its two promotion records in the existing Promotions table. No other branch status or environment ref is changed.

## Migration collision: proposed ARB decision

The incoming source independently renamed gift-card replay integrity to **414**, while this task's warehouse414 is already committed and exercised on staging. These are different migrations; they cannot share a version or be treated as equivalent.

Fresh read-only hosted metadata at `2026-11-01T10:44:49.171650+00:00` confirms:

| Environment | History rows | Version414 | Gift-card replay index/lock |
| --- | ---: | --- | --- |
| Staging | 342 | `atomic_warehouse_commands` | Both absent |
| Production | 341 | Absent; latest matching version413 | Both absent |

The warehouse function exists by name on staging and is absent in production. A guessed exact function-signature probe was false on both and is not used as an absence claim. No application records, SQL bodies or credentials were exported in this check. An initial metadata attempt stopped at an obsolete production link directory; the preserved task-owned link was then used. No schema operation occurred.

**Recommended concrete decision:** retain `414_atomic_warehouse_commands.sql` and its rollback unchanged; rename the unapplied `414_gift_card_issue_replay_integrity.sql` and matching DOWN to **415**, updating the active rollback reference and testing/deploy preparation references. Preserve the gift-card SQL bytes exactly. Run the applicable owned database, rollback, idempotency, frontend and governance checks against the integrated source. This is source/local qualification only; it does not authorize hosted415, production warehouse414, alias promotion or production release.

Authority requiring a human decision: root AGENTS `MIG-R2` — “New migrations MUST be numbered sequentially” and “MUST NOT reuse or skip prefixes”; `PRIME-R1` — “escalate to a human ARB decision”. The previous after413 decision covered warehouse414 before this independent collision existed. No renumbering has been performed pending that decision.

Private metadata receipt: `/private/tmp/letbuyy-parity-continuation-20261101/migration-414-collision-readback.json`. The owned encrypted backups, earlier restore rehearsal and all immutable warehouse receipts are retained.

## Independent local checks completed while the decision is pending

| Gate | Result |
| --- | --- |
| Combined Merchant suites | 523 + 818 + 295 = 1,636 pass, zero failures/skips |
| Gateway unit suite after stale test-input correction | 2,027 pass, zero failures/skips |
| Shared UI suite | 75 pass across 8 files |
| Merchant, Gateway, TypeScript client and UI typing | Pass |
| Actual local Merchant Next build | Pass; source fingerprint unchanged during build |
| Git source-conflict markers | None; all ten conflicts resolved in the merge index |
| Integrated migration/governance and owned SQL gates | Not accepted; duplicate414 decision pending |
| Integrated hosted deployment / browser / native acceptance | Not performed |

The first Merchant typecheck found the incoming declared `zod` dependency was not linked in this checkout; offline frozen-lockfile relinking fixed this without changing constraints. The first Gateway run passed2,025 and failed one test-file load: the incoming gift-card source test still referenced the earlier411 filename. Its loader now requires exactly one migration with the named gift-card replay suffix, preserving all SQL semantic assertions. The complete suite subsequently passes2,027. This does not replace migration-history, rollback or real-database proof. Initial failed logs are retained.

React review preserved package-public imports, the shared visual system and Lucide navigation icons, bounded actor/store readers, private request retirement, durable recovery and truthful unavailable states. Added empty-state scenes apply only after a successful empty read. Existing drawer focus/keyboard behavior remains present. No new render cache, component library or functional permission was introduced by the conflict resolution; complete browser accessibility and screenshot acceptance remain open.

The incoming merge makes no change to the native, Accounts, BFF or Dart shared-package source. Their prior evidence retains its exact source boundary; no new native or login acceptance is inferred. Merchant's existing staging alias remains unchanged by this integration.

Local build runtime-source fingerprint: `594f35b0d3419ebe7da60bad03ca3c5a8417173499ef512c24a0831204485db3`. Source base `bbb9aab758188b1f07fcc44ed9a60b15309e7328`, merge head `e4105581e3346041d71694d3db093eb713773e07`. The integration is intentionally **uncommitted** pending the required numbering decision; do not treat HEAD alone as this candidate or commit a duplicate414 state. Private build receipt: `integrated-merchant-local-build.json`, under the private evidence root.

After approval: make only the selected source numbering change, preserve exact SQL bytes, qualify the integrated migration/rollback and owned commerce/security paths, run governance only in the disposable clone, then admit an exact pinned Merchant preview. Hosted415 is excluded from the current source/local decision and needs its own concrete maintenance admission. Do not push, promote production, resubmit warehouse414 or roll it down.

## Owner decision received

On 1 November 2026 the owner approved: **“Approve warehouse414 + gift-card415, source/local only (Recommended)”**. The unapplied gift-card forward and rollback have now moved to415 with identical SQL bytes. The owned rollback reference is updated. Warehouse414 is unchanged. This supersedes the pending-decision state above; hosted415 and production application/schema activation remain excluded. Integrated owned database and governance qualification now proceed.

The approved current staging challenge retry and checkbox completion now show **Security check passed** on the installed task emulator (1 November). No credential was entered or login claimed. The separate production two-canary/conditional CDN guard was also approved; neither approval expands application or hosted-migration release authority.

## Final source/local qualification

Integrated commit **`7b76ffed97e9f1f4c18e9dc0162ada3e7257ddd6`** preserves both branches and the approved414/415 numbering. All migration SQL bytes are unchanged by the renumbering. The Merchant runtime source fingerprint matches its passing build. Native, Accounts, BFF and Dart shared-package source remain unchanged.

- 1,636 Merchant checks; 2,027 Gateway units; 75 UI checks; relevant typechecks and actual Merchant build pass for their recorded source boundaries.
- Actual integrated governance: **114 pass**, zero fail/blocked/skip, one not applicable, in the disposable clone only.
- Nine current owned Gateway/Postgres suites pass **95 checks**, covering gift-card issue/replay/concurrency/redemption/refund, billing intent, warehouse recovery and rollback, customers and scoped inventory/operations/shipping reads.
- The tenant red-team assertions pass in **two top-level cases** in a fresh dedicated cluster (`b33e2426b2e4`). The first mixed run (`b870453ab284`) is retained as failed: the Gateway template's non-connectable database held cluster-global roles, preventing the red-team fixture reset before assertions. No attack assertion or role policy was changed. Both runs have empty cleanup receipts.
- Existing encrypted **staging** snapshot restored into the pinned PG17 image with network none and original ownership, ACLs, triggers and checks. 414+415 UP → DOWN → UP passes (`a019dfea1199`), preserving **all523 original tables' row hashes**, original migration history on DOWN, and the exact original gift-card function/index state on rollback. Original themes/defaults/guards remain intact. Own container, network and volume absence was independently checked.
- This uses the approved pre414 recovery snapshot. It is retained-data compatibility evidence; a fresh live backup/rehearsal is still required before hosted415.

The integrated API dry-run initially used the wrong current working directory for its mandatory WASM check. The corrected service-directory build passes with both static WASM modules, without skipping the check. Its admitted main JS SHA256 is `34204b6c3396fb9c8771526b9cc4dd0a7ee60d6308bc318305dec333c13eeceb`; computed main-module gzip is1,607,884 bytes. The admitted protected Merchant tree SHA256 is `685cf603aa7ee1cb57b7f03745e1a12fad16cc99e938082bedf5011adda77f04` (503 files;422 public-static files scanned). Task-generated secret values are absent from distributable public output; no existing provider secret was exported. Neither artifact has been deployed.

Fresh read-only staging history at12:43 UTC remains342 rows, with warehouse414 committed,415 absent and the gift-card replay index absent. Local journal preparation selects **only415** from the exact source, expected history `b205015d8793c8971a2b9aa1211b986c92f0bde364cfdf08cf17ab8462205d41`, batch SHA256 `e8457e86473d49985794c312a7a278da6329ab51cef4a15452b757880a8dee4d`. The initial preparation passed JSON contents instead of the required JSON file path and was refused before producing an artifact; corrected preparation is preserved separately. This is preparation, not hosted acceptance.

Next hosted scope is concrete in [STAGING_415_MAINTENANCE.md](STAGING_415_MAINTENANCE.md). The owner approved source/local415 only; hosted415 and its coherent API/Merchant activation still need the separate maintenance decision. Do not resubmit414, use stale history, activate production, undo concurrent aliases or embed Vercel access credentials into the app.
