# apps/customer_app

Buyer-facing mobile app. Play Store production identity: `com.letbuyy.letbuyy`.

## Provenance

This app's history lives outside this repository's `.git`. It was established by
copying (not `git mv`, since this is a cross-repository move) from:

- **Source system:** System A, `Ecommerce/LetBuyy` (`github.com/SiddhuSaai/letbuyy.git`)
- **Source path:** `apps/marketplace`
- **Source HEAD at copy time:** `be716ae18b5f1e25e1266f963ab5c0907928db26`
- **Full commit history:** preserved in `~/LetBuyy-history-preservation-2026-08-29/system-A-letbuyy.bundle` (SHA-256 `0c3236b01df9406008b97722596247040ee946e39108648fce1180f1096c7358`)

Chosen as the `customer_app` survivor because it is the only candidate in the
three-system inventory with a confirmed shipped Play Store release
(`com.letbuyy.letbuyy`). See
`docs/migration/repository_consolidation/04_application_survivor_scorecard.md`,
`07_final_path_mapping.md`, and `10_merge_execution_journal.md` (Stage 3) for
the full evidence and the rejected-candidate disposition.

Play Store production identity (`applicationId`, signing config, deep-link intent
filters, Firebase app ID, `versionCode`/`versionName`) was verified byte-for-byte
unchanged by this move — see the journal for the verification commands and results.
