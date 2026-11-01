# Merchant source integration — 1 November 2026

Status: local reconciliation in progress; no new Merchant deployment or remote push. Preserve the READY Accounts recovery `ce8140b09` / `dpl_D7ThevfxEBw887k74Jj3ugVsNS4x` and existing staging API/BFF. Migration414 must not be submitted again or rolled down after use.

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
