# Durable CSV product import recovery

2 November 2026. **Connected source/local candidate; hosted416, normal-device acceptance and release qualification remain pending.** The completed staging415 cohort is unchanged. This is one part of the122-item programme, not full Merchant parity certification.

## Confirmed baseline and canonical owner

The old mounted POST `/v1/export/import-products` used R2 source/status objects, `waitUntil`, sequential canonical product creation and an in-memory result count. A named second-row INSERT fault left one committed product but reported zero; the retry endpoint returned404. Unchanged owned runs `738cfddd69e3` and `8e8c7d93ebf8` fail0/2 with the positive first-product control intact. Their reports and the latter detailed logs remain under `/private/tmp/letbuyy-parity-continuation-20261101/csv-import-recovery-before*`.

The existing web Export page did have a direct-fetch CSV form. An earlier search restricted to SDK method names missed that caller. That form is now replaced with **Open CSV imports**, linking to the same workspace as Products. Mobile previously had a low-level CSV SDK method, but no connected CSV screen/service. Its separate catalog-selection `ImportProductsScreen` remains a different workflow and still needs its own parity review.

The repair completes the current API monolith, existing queue worker, canonical product planner/edit writer, shared TS/Dart contracts and existing web/native applications. It adds no runtime, issuer, generic SQL transport or event bus.

## Connected contract

- Shared `ProductCsvImportSchema` is v2 with actor/site-bound original UUID and exact source SHA-256. Both raw UTF-8 source and its formatted JSON request must fit one MiB; maximum500 logical data rows. UTF-8 BOM, quoted CR/LF and Unicode are preserved. Blank names, malformed text and unsupported columns fail before registration. Supported fields are name, price in rupees, description, category, stock, tags and images; semicolons separate list values. Imports create active products rather than update existing ones.
- New registration uses **POST `/v1/export/imports/register`**. New clients cannot accidentally enter an older backend's unsafe legacy path: the older backend refuses the distinct URL. On this candidate the old POST returns410 and starts no work.
- New source/local migration416 adds private FORCE-RLS jobs/rows, immutable intent/completed receipts, current account/owner checks, original-key registration and stop,120-second fenced leases, exact private pages and a service-only two-identity due selector. Business work remains tenant-role guarded. Application roles cannot directly read or write the private tables.
- Each row commits the existing product parent/edit, variants/inventory/audit/outbox effects, product usage and immutable row completion in one transaction. Normal product creation participates in the same per-site persisted-quota lock and same-transaction usage boundary. A usage/receipt fault rolls back the product. No second product writer or guessed plan limit is introduced.
- Work is bounded to50 rows/eight seconds per continuation. Existing queue-workers opts in with `PRODUCT_IMPORT_RECOVERY=bound-request-v1` and a **dedicated** server-only `PRODUCT_IMPORT_REQUEST_SECRET`. Its fixed POST `/v1/internal/product-import/run` accepts only `{}`, with method/path/environment/audience/body-bound MAC, short clock window and the existing durable JTI replay cache. It grants no general app/Identity authority. Missing configuration refuses new registration/capability; existing manual recovery stays available.
- GET capabilities, history, original-key lookup and job/row pages acknowledge actor/site, exact counts and paging. Retry reuses the original job/row identities; stop preserves completed products. No result-file URL is invented. Legacy R2 records are read-only, with unverified counts represented as unavailable and no import-result download.
- **Stop before registration** creates a zero-accepted-row stopped tombstone under the same original-key lock. A delayed original POST remains stopped; a changed hash conflicts. This does not claim an unknown CSV contained zero rows. Lost stop acknowledgement retains the client identity until terminal readback confirms it.
- TS SDK, owner-bound Next route and Dart SDK use the same command and progress contracts. Next checks origin, current actor/site, original header/body key and bounded request stream before forwarding. Browser storage retains only protocol/key/hash/actor/site under request locking; native uses existing encrypted storage. Recovery never stores CSV bytes in the journal or silently mints a new key.
- The actual web/native screens expose history, progress, bounded row pages, product links, retry, original-registration recovery and stop confirmation. Missing counts/access are unavailable rather than zero. Scope retirement clears private content; a newer access denial supersedes an older capability response. The static input template remains downloadable; imported rows have no fabricated output CSV.

## Verification recorded so far

All results below are **source/local**, with synthetic identities/fixtures where applicable. Passing suites overlap and must not be added into a fabricated acceptance total.

| Boundary | Current result/evidence |
| --- | --- |
| Merchant Flutter suite |781/781, `csv-import-flutter-all-v4.log` |
| Gateway unit lane |2,037/2,037, `csv-import-gateway-unit-v4.log` |
| Merchant web configured phases |545,818,295 pass respectively;89 file executions, `csv-import-web-all-current-v1.{log,json}` |
| Auth-core and existing queue-worker unit suites |137/137, `csv-import-auth-queue-all-current-v1.log` |
| Actual Export entry / CSV workspace recovery |7/7 focused checks, `csv-import-web-entries-v4.log`; included in the full web lane |
| Native original-key/stop/service and actual screen checks |15/15, `csv-import-native-stop-v3.log`; included in the full Flutter lane |
| Shared/types |Shared-types build; Gateway, queue, TS SDK and Merchant web typechecks; Merchant and both Dart package analyses pass |
| Owned import DB |18/18, combined run `770aec51870e`; all owned resources removed |
| Existing atomic product DB |90/90 with two prepared slots in the same combined108/108 run; no skips or cancellations |
| Exact artifact/governance/retained-data rehearsal |Pending at the frozen source; do not infer admission from earlier415 or intermediate artifacts |

Owned import coverage includes positive nonzero partial progress, duplicate original registration/workers, expired lease recovery, exact scoped history/rows, owner loss, raw-role refusal, usage-fault rollback, normal-create/import final-slot contention, stopped/late workers, stop-before-register and concurrent stop, guarded DOWN drift/nonempty refusal and empty UP/DOWN/UP. Actual PostgreSQL-wire relay faults withhold the real backend COMMIT acknowledgement for registration, row and registration-stop; readback preserves one original effect. Prepared statement/portal tracking retains only fixed fault identities, no SQL values or credentials. The500-row fixture completes in ten capped continuations with exact last-page481–500; row501 refuses without a job. These timings/capacities are owned local results, not hosted Worker performance.

## Retained failures and evidence provenance

The initial repair assumed a nonexistent `users_custom.deleted_at`; run `92a223b924ea` failed and the guard was corrected to the canonical account check. Run `c36fd34f78b9` lacked persisted quota authority; the fixture now seeds/asserts an explicit synthetic100-product entitlement. Neither failure proves hosted readiness.

The existing atomic product suite initially passed82/90 because its old frozen346 rollback setup did not account for current empty successor objects, then89/90 without prepared slots. Its fixture now retires/reapplies empty416/414 around the unchanged346 pair, with two prepared slots. No346 SQL or original assertions were weakened. The historical101-check report was preserved separately as `csv-import-owned-48cc-historical-report-preserved-20261102.json` when a pre-existing final-v1 pathname was discovered during the current rerun; current evidence must use the new report's actual run identity. Do not treat the old101 report as the current18+90 result.

The first wire-loss run `5debb91c9a9c` passed11/13 because a reused prepared statement prevented the deliberate fault firing. Later real-wire13/13 and14/14 runs and the current18-check suite prove the actual fault/readback path. Failed reports remain distinct.

An earlier web raw log was accidentally reused; its535/1 fixture-dependency result is retained in `csv-import-web-envelope-before-summary.json` and the tool transcript, not reconstructed as raw evidence. Recent entry runs also exposed an invalid old actor fixture and a DOM-object assertion on the static template link. Those fixture/assertion defects were corrected while preserving no-command, original-key, readback and scope-retirement checks. Bounded focused checks and all configured web phases now pass.

Earlier debug APKs and test manifests precede the latest source and remain historical/uninstalled. The normal task emulator still has the hash-verified415 APK. Final current compilation, compiled-asset inspection and device acceptance are separate gates.

## Staging416 prerequisites and recovery

No hosted416, new import key, worker flag, protection exception or new application deployment has occurred. The completed415 approval does not cover them. The API currently has64 variables; its opaque encrypted keyrings must never be rewritten or repurposed. Read-only metadata and the admitted844 bundle show that the staging API plaintext `NEXT_PUBLIC_ENV` slot is unused. A proposed staging-only64-to63-to64 swap removes only that API slot and adds the dedicated purpose secret; queue-worker bindings would change27 to29. Accounts/Merchant preview variables, old secrets, production bindings and protections remain unchanged. The existing deployment wrapper preserves old plaintext variables, so source removal alone cannot perform the provider swap.

Before requesting hosted permission, freeze and qualify source, actual API/queue/preview/native artifacts, managed416 preparation and a retained-data restore rehearsal. The concrete maintenance plan must name the exact variable swap, fixed-purpose request policy/key and activation/recovery sequence. `scripts/supabase/README.md` requires fresh encrypted recovery backup/restore proof, source/grant/history reconciliation and an approved hosted maintenance window. Preserve414/415 history and all retained data/receipts; never blindly retry an uncertain commit.

416 DOWN is paired, quiescent and drift-guarded using the native managed-catalog fence and recorded exact function/table profiles. It refuses any retained import job, including zero-row stopped tombstones. Once imports exist, operational recovery is compatible source/forward repair with receipts preserved, not destructive DOWN or old unsafe import replay.

Still open: final source/artifact/governance admission, fresh retained-data rehearsal and approved416 hosted window; real synthetic owner/staff web↔mobile CSV readback and revocation; normal emulator DNS/password/current CAPTCHA; provider, money, signed Android/iOS and all122-feature release acceptance. The programme ledger remains partial.

## Artifact and retained-data qualification continuation

Source checkpoint `212a8ecd9b4f949e9cb687535acb7fd3cd87f470` compiles both staging Workers and the normal debug staging APK. The initial governance gate passes113 validators and fails one: the generated tenant table registry did not yet include the two new private import tables. The canonical schema-derived generator now adds exactly those tables (321 total); the isolation validator passes without exceptions or weakened rules. Its focused unit/actual-table checks and the full exact-source gate are being collected before admission. Runtime artifacts affected by the registry change require a new frozen source identity.

Local retained-data rehearsal `702f4979573f` restores the existing encrypted pre415 staging archive into an owned network-disabled native PG17 cluster. After restoring415 locally, managed416 UP/DOWN/UP passes with exact CLI-role/catalog/grant/history checks; all524 original public/auth/storage tables and13 original warehouse receipts remain exact. Final history is344. The owned cluster and volume are removed. This reused1 November archive predates current staging additions and is **not a fresh hosted416 backup**; no new export or hosted connection occurred. Report: `csv-import-existing-backup-rehearsal-212a8-20261102.json`.
