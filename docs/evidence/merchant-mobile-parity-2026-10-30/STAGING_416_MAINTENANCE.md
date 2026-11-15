# Staging416 maintenance proposal — approval required

2 November2026. **Prepared; not approved or executed. The final native follow-up is qualified; the earlier9bffa native artifact is superseded and withheld.** This is a new staging-only window after the completed415 window. It authorizes no production app/schema/DNS/WAF change, remote branch promotion, paid provider operation or release certification.

`source/local → qualified artifacts → fresh staging recovery →416 only → exact staging activation → synthetic acceptance → retained-state readback`.

## Frozen candidate and demonstrated prerequisites

Coherent source **`e8d1ac3c177775606378487378f665cac8013536`**. [Current follow-up qualification](CSV_IMPORT_FOLLOWUP_QUALIFICATION.json), [unchanged backend/web qualification](CSV_IMPORT_QUALIFICATION.json), [recovery contracts/failures](CSV_IMPORT_RECOVERY.md), [exact binding proposal](STAGING_416_BINDING_PROPOSAL.json).

- 114 governance validators pass; zero failures, blocked or skipped. A first113/1 run exposed the missing schema-derived tenant registry update; the canonical generator now includes both new tables. No exception or weakened validator.
- 786 Merchant Flutter tests,2,037 Gateway unit tests,137 auth/queue checks,25 BFF consumer checks. Configured web phases545/818/295 pass. Shared types/build and touched TS/Dart/Merchant analysis pass. Counts overlap; they are not122-feature acceptance.
- Owned PostgreSQL `770aec51870e`:108/108, consisting of18 import and90 existing atomic-product checks. Registry unit75, actual-table/raw-role8 (`61b7b209b8fe`) and isolated red-team2 (`0dc651f09fc6`) pass. Owned resources are removed. Actual wire-level registration/row/stop COMMIT acknowledgement loss, quota contention, stop-before-late-registration, failed-row recovery and500-row bounded processing are local proofs.
- Existing encrypted pre415 staging snapshot rehearsal `702f4979573f`: exact native PG17 restore; locally restore415, then managed416 UP/DOWN/UP; all524 original tables and13 warehouse receipts exact. This archive predates current staging additions. **It does not replace the fresh recovery backup required below.**

Prepared artifacts (not uploaded):

| Artifact | Exact identity |
| --- | --- |
| API staging main |SHA256 `3c6aee121550b145ba66254264e111005a150033e63a1ff267089d84db8c7762`,4,844,158 bytes; Argon2/Blake2b WASM hashes unchanged |
| Existing queue-worker main |SHA256 `ef2a34acca9bc021f70fa8a1485fc28e6f923245988a05024a30dcca52b68458`,1,924,412 bytes; compiled212a8 source, identical runtime inputs at9bffa |
| Protected Merchant preview |Tree `40990807f2ae8df0e3b7dd3e85a635face8e19e9739a4476039946cc664f0011`; complete frozen closure `95797b7867c2d9f6bb38db16d511ed026bd6b79e40de0af84f14333f92622311`;5 functions,984 output entries,651 external references;1,150 files scanned, generated staging secret values absent |
| Normal staging debug APK |SHA256 `b55efe36ba368963e156c3e3ad49021378d2f917dce9cc10cabe3dd1681b3273`,219,944,828 bytes; exacte8d1 source;9 Inter fonts/license and configured BFF/Accounts/Admin staging URLs verified; uninstalled; debug signing |
|416 forward |Source SHA256 `20d4b5e223e5fca53625724af92bb852e800315dd4b22b1be3edf262d98554d5` |
|416 paired DOWN |Source SHA256 `a8cdcff194a13e4c5b3395554d55d67db8df195214cb33bce68c4e1a8f947753` |

API and protected-web artifacts were built at9bffa; queue at212a8. Exact service/package/web/schema/build-tool inputs are unchanged ate8d1, as recorded in the follow-up manifest. The final native artifact replaces the earlier9bffa APK: all Import entries reach CSV and live capability denial retires private content. Original artifact hashes remain historical; the withheld APK must not be installed.

Offline managed forward/DOWN artifacts are prepared from9bffa with identical416 source/adapter bytes ate8d1 in private directories. Their current manifests are **rehearsal-only**. Fresh live history digest, exact migration names and a new guarded journaled batch must be prepared after recovery checks. No unexecuted history row is marked applied.

## Approved-window operations requested

1. Recheck staging ownership, source/artifact hashes, provider versions/settings/protections and exact migration history. Expected staging API `844f3c28-4c13-435b-9ada-5a931d1890fa`, queue `0579c993-248f-4848-9d37-9cbe57a49af8`, BFF `1c53075f-6e92-4a7c-ad63-530b0ff23572`. Protected Merchant currently `dpl_tr4FKGLnQRBh4UmGnPuHtRNrXzp8`, Accounts `dpl_D7ThevfxEBw887k74Jj3ugVsNS4x`. History343, with414 warehouse and415 gift-card present and416 absent. Any drift is reconciled before dispatch.
2. Refresh the **private encrypted staging recovery backup**, covering commerce tables, auth/session data, storage metadata, owners/grants and migration history. Use the existing private recovery key; no plaintext dump, provider-role password export, record contents in chat/logs, or production export. Prove restore into an isolated owned network-disabled PG17 cluster and rehearse exact416 UP/DOWN/UP with all original table/row hashes, current warehouse receipts and history preserved. Remove only this owned cluster/volume. Retain encrypted recovery material privately.
3. Capture only necessary metadata for any legacy R2 import activity and preserve its objects. Do not replay, delete or fabricate counts for legacy partial imports. If an old job may still be executing, reconcile its observed product effects before permitting a replacement import.
4. Prepare and execute **only416** once on one guarded direct staging backend using the exact fresh history digest and trusted-admin-maintenance model. Preserve all existing provider/legacy history aliases and414/415 receipts. On a timeout or uncertain response, close and read back actual history/schema/receipts before considering any remaining operation. Do not resubmit415 or all migrations.
5. Generate **one new purpose-only MAC secret**, solely for the staging API and existing staging queue worker. Generate in memory, retain only encrypted private recovery bytes, and keep its value out of source, plaintext files, command arguments, logs and chat. Existing Identity/app/domain/Turnstile keys and opaque keyrings are neither exported nor rewritten. This is a fixed-purpose operation authenticator, not another Identity issuer.
6. Activate the exact admitted API modules with the reviewed binding replacement below, independently verify actual modules/settings/bindings and confirm new registration remains unavailable if purpose authentication is missing.
7. Activate the exact existing queue-worker artifact, add the same purpose secret and enable `PRODUCT_IMPORT_RECOVERY=bound-request-v1`. Preserve its API service binding, all existing cron/queue schedules and retry behavior. Reconcile each version/response before retry. Independently verify modules and binding differences.
8. Upload the complete frozen Merchant preview, preserve Vercel SSO protection, verify READY and exact runtime/asset closure, then assign **only `admin-staging.letbuyy.com`** to that verified deployment. Accounts/BFF and production aliases remain at their recorded versions. No protection bypass is introduced or relaxed.
9. Install the admitted normal staging debug APK on **only emulator5580/ADB15038**, preserving its data and the restorable415 APK. Exercise synthetic owner/staff journeys below. Current human-verification approval is separate, applies to the displayed challenge only, and is not inferred from this maintenance approval.
10. Collect post-window history, exact original retained-row comparisons, worker/preview identities, synthetic command receipts and known limitations. Record the window as accepted only for demonstrated cases; all122 and production-ready certification remain separate.

## Exact variable and request-policy changes

API is at64 variables. Remove only the **unused staging API plaintext `NEXT_PUBLIC_ENV`** and add **secret `PRODUCT_IMPORT_REQUEST_SECRET`** in the same reviewed module upload, maintaining64 variables atomically. Preserve every other current plaintext/JSON/resource binding from a fresh in-memory snapshot and preserve all prior encrypted secret types. Do not upload a65th variable or rewrite opaque keyring entries. This refines the earlier proposed63-variable intermediate step into a single atomic replacement; it changes no web/Accounts environment variable.

Queue is at27 variables. Add only the new purpose secret and the explicit recovery flag, reaching29. Existing bindings and schedules remain exact. Cloudflare's official [version upload contract](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/versions/methods/create/) supports retaining specified binding types; existing encrypted secrets must be preserved while replacing only the reviewed plaintext set. Build commands using `--keep-vars` alone cannot remove the old API plaintext binding, so the upload must use the explicit reviewed metadata patch. The sanitized proposal records names/counts, not values.

The admitted API adds one **fixed** authenticated internal route: POST `/v1/internal/product-import/run`, body `{}` only, maximum64 bytes/three-second input deadline, MAC bound to method/path/environment/audience/body digest/time, short clock window and durable JTI replay claim. It selects at most two due identities and performs bounded tenant-authorized work. Reject wrong body/path/query/environment, expired/forged/replayed MAC, missing secret and app/Identity-purpose misuse. No generic database/body/tenant dispatcher, WAF change or external access-policy relaxation is allowed.

## Synthetic acceptance and evidence boundaries

- Use unpublished, task-owned staging sites and synthetic owner/staff identities. Verify positive owner access before cross-tenant/current-staff/revocation refusals. Do not use the user's real production commerce records for mutations.
- Register a small real CSV through the actual Next/TS route and through BFF/Dart/mobile; compare durable jobs/rows and exact products/usage both directions. Reuse the same original key after deliberately withheld client acknowledgements. Refuse changed source/key/scope and the old unsafe POST.
- Read accurate nonzero committed counts, exact filtered row/history pages and product links. Stop remaining work and stop an unconfirmed registration; verify a delayed original submission cannot create new rows. Preserve completed products and immutable receipts. Do not claim every hosted fault from the local synthetic fault suite.
- For **nonzero actual scheduled recovery**, register a separate synthetic queued job through the same canonical registration function under the standard tenant/actor guard during fixture setup, with no API `waitUntil` invocation. The actual existing minute worker must recover it under current owner authority. This fixture is not proof of browser registration, which is tested separately. Never expose an SQL transport or add test-mode production branches.
- Prove restricted staff and foreign actor/site denial, owner/staff revocation, private/no-store responses and retired old-context content. Exercise ordinary device networking/password/challenge where available; explicitly separate any controlled synthetic-session/device transport evidence. DNS, challenge or normal login failure is an open device gate, not fabricated end-to-end acceptance.
- Keep the500-row/effect-once/fault-injected capacity claims at their owned-local boundary unless separately exercised hosted. No sandbox payments, live refunds, payouts, registrar purchases, shipping purchases, outbound customer messages or production writes are part of this window.

## Recovery and stopping conditions

Maintain an intent record before each mutation. A provider/DB timeout is an unknown outcome until independent readback; never retry blindly. If prerequisites drift or retained hashes/grants/source mismatch, stop that activation and retain evidence while continuing independent source work.

Before any import receipt exists, exact guarded DOWN may restore the416-free schema after compatible runtime recovery. Once **any** import job exists, including a zero-accepted-row stop tombstone, DOWN refuses by design. Preserve jobs/rows/products/usage and recover forward with a compatible candidate. Do not restore844's unsafe legacy import handler while retained work exists.

Operationally quiesce recovery by disabling the queue flag and, if necessary, removing only the new API purpose secret to refuse new registrations. Existing manual job read/retry/stop remains tenant-guarded. Preserve current receipts; repair forward or restore a compatible guarded build. Removing the new secret and restoring the old unused plaintext slot, if required, must stay within64 variables and preserve all other credentials. Do not disturb old encrypted keyrings or delete business receipts to make rollback pass.

Retain the previous exact API/queue/Merchant/normal APK artifacts and identities. Production services, production migration history, production aliases, BFF/Accounts deployments, DNS and SSO/WAF controls remain unchanged. Successful staging acceptance is not a production application/schema release.
