# apps/admin_app

Platform-operator mobile app. `applicationId` `com.letbuyy.admin` (note: the
Android `namespace` field still reads `com.letbuyy.letbuyy`, a leftover from
the shared Flutter template this app, `marketplace`, and `seller` were all
scaffolded from — recorded, not changed, by this move).

**Not production-ready.** Its release signing config (`android/key.properties`)
points `storeFile` at `debug.keystore`, not a real release key — strong
evidence this app has never shipped a signed release. See
`docs/migration/repository_consolidation/00a_signing_key_rescue.md`.

## Provenance

This app's history lives outside this repository's `.git`. It was established
by copying (not `git mv`, since this is a cross-repository move) from:

- **Source system:** System A, `Ecommerce/LetBuyy` (`github.com/SiddhuSaai/letbuyy.git`)
- **Source path:** `apps/admin`
- **Source HEAD at copy time:** `be716ae18b5f1e25e1266f963ab5c0907928db26`
- **Full commit history:** preserved in `~/LetBuyy-history-preservation-2026-08-29/system-A-letbuyy.bundle` (SHA-256 `0c3236b01df9406008b97722596247040ee946e39108648fce1180f1096c7358`)

Chosen as the `admin_app` survivor on real-logic completeness (266 files vs.
System B's Agrimore `admin_app` donor at 90 files) — neither candidate has a
production signal. See
`docs/migration/repository_consolidation/04_application_survivor_scorecard.md`,
`07_final_path_mapping.md`, and `10_merge_execution_journal.md` (Stage 3) for
the full evidence and the rejected-candidate disposition.
