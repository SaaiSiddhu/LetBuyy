# Install version precondition — implementation handoff

Evidence/request for the canonical installer owner; not new architecture or migration authority. 23 October 2026.

## Implementation update

The initial findings below are historical inputs, superseded where implemented. Root granted this workstream install-method/request/test ownership and migration387. Expected semantic version/package/version UUID fields are now retained by InstallThemeSchema. Migration387 and its paired rollback amend the existing installer atomically and return actual identities. Merchant details obtain UUIDs through the existing canonical schema endpoint; Add requires descriptor, exact receipt and owned-library readback. SDK index remains Circuit-owned.

Unit/merchant checks pass. Fresh owned PostgreSQL run095ef5dd8c5a is not green: all private version/race/concurrency/rollback cases passed, but public Threadline install encounters a real registry mismatch. `ensureThemePackageRuntime` currently sets package `version` from `theme.schema_version` and `version_number=1`; `findPackageRuntime` chooses the latest number rather than exact catalog semantic version. Threadline catalog and embedded package are2.0.0, schema version1.0.0. This must be repaired append-only by the canonical registry owner, preserving captured versions, before rerunning. Migration387 is reserved/implemented, not accepted for release. No hosted migration or promotion occurred.

## Original gap analysis

The marketplace sends `expectedVersion` through its BFF as `expected_version`. Current shared InstallThemeSchema/ThemeInstallInput do not retain that field. The canonical worker resolves a current theme/runtime before calling `install_owned_theme_v1`; migration377 verifies that runtime UUID belongs to a published package version. It does not bind the selected catalog semantic version or identify the actual returned instance version.

Current evidence:

- `packages/theme-engine/src/index.ts` InstallThemeSchema: store_id/config_overrides only.
- `packages/typescript/api-client/src/index.ts` ThemeInstallInput/Result: no expected version/package version receipt.
- `services/api-gateway/src/execution/theme-execution.adapter.ts` installTheme: getTheme→validateTemplateConfig→RPC, receipt unconfirmed only if missing instance.
- `database/supabase/migrations/377_theme_install_event_contract.sql` current installer: existing nonarchived instance is replayed without comparing its version with the selected runtime. Archived instance reactivation also retains its old version. Receipt returns id/slug/name/instance only.
- `listSiteThemes` includes the actual instance package-version UUID but does not expose a semantic package version alongside it. The marketplace cannot infer semantic parity from a UUID.

The canonical owner should complete this single path, preserving WIN-R4/PAY/tenant guarantees:

1. Carry selected package/version preconditions through the canonical schema/client; return public descriptor package/version/checksum identity without adding a second catalog DTO.
2. Check the selection inside the same transaction as instance creation/replay, against locked catalog/package-version state. An API-only check leaves a promotion race between read and RPC.
3. Replay an existing instance only when its actual version matches the selected version. A different or archived older version must produce an explicit conflict/upgrade-required outcome; never reset its draft or silently return the old design as the selected design.
4. Return the actual installed instance/package/version identity, including on replay. Frontend readback must compare those identities before announcing success or handing off the editor.
5. Keep Add private and idempotent; publication stays separate. Scope every check to the verified actor/site and retain purchase/library-limit/event contracts.

Required real owned-DB cases: exact selection success and readback; stale catalog selection conflict; promotion during pre-resolution/RPC; existing older instance; archived older instance; duplicate/concurrent same selection; lost response retry preserving draft; denied tenant/purchase; last-write failure rollback; paired migration forward/down behavior. No new migration number is reserved by this document. Migration/SDK/schema ownership remains Themes.
