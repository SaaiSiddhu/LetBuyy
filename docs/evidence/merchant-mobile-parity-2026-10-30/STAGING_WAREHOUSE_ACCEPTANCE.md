# Staging warehouse recovery and client synchronization — 1 November 2026

## Current verdict

**Locations/Suppliers and warehouse command recovery now pass bounded hosted staging backend acceptance.** The actual Merchant Next routes, shared web SDK, shared Dart SDK, mobile BFF, Gateway and PostgreSQL agree on synthetic records and durable command outcomes. Purchase receiving and transfers also pass hosted stock-conservation checks. This does **not** accept all 122 features, normal password/CAPTCHA login, browser/emulator interaction, a signed release, or production activation.

The owner approved staging-only recovery/verification after the original source/local migration-number decision. The later instruction was to continue backend work while their Chrome session was occupied. The separately approved staging Turnstile key transfer has **not** been performed; its value has not been read or copied. No production business mutation, production migration, production deployment, remote Git push, protection disablement, paid upgrade or provider payment occurred.

## Qualified source and artifacts

Candidate: `288cb3dfa02f8b0d2b650de7126504864b3c89b6` on the task branch. Runtime changes are in parent `a2375b54d`; the candidate adds the paired binding-manifest checksum. API business code remains the previously qualified integrated warehouse implementation. The first `a2375b54d` governance run failed that stale checksum; the final candidate passed **114 validators**, zero failure/blocked/skip, one not-applicable.

| Surface | Activated staging identity | Exact-byte evidence |
|---|---|---|
| API | version `2ec36261-eee3-49b5-95e8-5c6c0b7d9928` | JavaScript SHA-256 `cd641400800125fadde1d8615254834e7cdfc6181ad270b6cf000c13df1095c3`; downloaded JS and both WASM modules equal the local bundle |
| Mobile BFF | version `62a1161a-13f8-411d-8d3a-7714d6f590a2` | downloaded JS SHA-256 `b82206854a9e7b10c3626e88027c40b612f8c8efa1aa19e13b49f11d412b0603` equals local bundle |
| Merchant preview | `dpl_EfLAyZXXmP1C6jZcBAVcUgPkwEfD` | admitted artifact file-tree SHA-256 `3b788810be90db42ca1b16a902a50db0b3f19a28483c34aa24063363e1e6e834` |
| Accounts preview | `dpl_28HF3PhfWcBKcxUdR3WNDG8aEiYe` | admitted artifact file-tree SHA-256 `31b5be5e2f3b25a50bbb97fc9c7409f5ebafa93f7f6406fd6306e9fade510087`; downloaded lookup page chunk equals admitted file |

Protected URLs: [Merchant](https://merchant-agi9oqjnx-letbuyy-store-s-projects.vercel.app), [Accounts](https://accounts-5nt9fr4pv-letbuyy-store-s-projects.vercel.app). Both are READY preview deployments, with actual Git metadata `staging` / `288cb3dfa…`. That local disposable-clone branch does **not** represent a remote staging promotion. Normal unauthenticated requests return a nonce-bearing `302` to Vercel `/sso-api`. Authenticated HTTP checks used the existing scoped Vercel CLI account; protection remained enabled.

Production aliases independently remained on Merchant `dpl_F9XK6HGGssAodfUDA7xeFPStAvbm` and Accounts `dpl_CgC8rBNFLVwLoMS2AdEN92deQ9mt`. The primary checkout's source was not edited.

## Recovery, migration and preservation

An approved fresh encrypted **staging** backup covered public commerce, authentication/session, storage metadata and migration history: 16,424,801 custom-format plaintext bytes were streamed into AES-256-CBC/PBKDF2 encryption, decrypted/hash-checked, and no plaintext dump retained. No provider-role password export occurred. Private archive:
`/private/tmp/letbuyy-production-release-20261025/fresh-recovery-20261026/warehouse414-staging-20261101/`.

Owned restore rehearsals `4ccb5d658b22` and role-aware `eda444c3fdc7` passed UP/DOWN/UP with all **523 original table populations preserved**, paired rollback/history checks, and verified owned cleanup. The latter mirrored the actual hosted service-role inheritance and tested raw-role controls.

Migration **414 committed once on staging**, history **341 → 342**. Independent readback matched its exact journaled payload and the original history digest excluding 414. Approved batch digest: `604db517f0c96586762cd061b997f2baa4cce89a36a803da5582abee08ff0426`; adapted payload digest: `6bb424ad857b7a5353be1518cbae1c4fb6e44ebbb3d3d21383e027449188cbe1`. Do not submit 414 again.

Live original-row preservation is narrower than quiet-restore preservation: **522/523 original populations proved exact**. Concurrent operational-log appends were reconciled by comparing complete original-row populations. The original eight `internal_auth_replay_claims` cache rows could not all be reconstructed after normal expiry/reuse. Its function body is unchanged from backup; two independent connections racing a fresh synthetic nonce produced exactly one winner, and a subsequent fresh connection rejected replay. **Whole original database byte equality is not claimed.** This limitation remains in the receipt.

The first postcommit checker incorrectly expected effective `service_role` EXECUTE privilege to be false. Hosted `service_role` inherits `app_tenant`; explicit function ACL ownership is correct. Actual `SET ROLE service_role` execution was denied by `WAREHOUSE_FORBIDDEN`, while the `app_tenant` positive control reached `WAREHOUSE_INVALID`. No hosted role/grant change or migration resubmission was used to satisfy the checker.

After accepted commands, immutable receipts are retained. Pre-use DOWN rehearsal is not permission to erase their history. Compatible application rollback retains migration 414, its receipts, and current credentials; it must not re-enable direct stock writers or protocol-1 mutations.

## Configuration and staging isolation

One shared TS cookie-name resolver now isolates staging session, CSRF, account/device and password-intent cookies. Accounts, Merchant and BFF consume it. The shared Dart client and native auth select the same staging names; native secure storage, selected-store preferences, private cache actors, security commands and staff retry/invitation storage also have staging namespaces. Existing production names and pending commands are preserved. Staging uses the existing real widget's public site key, without test-key bypass.

Fresh staging internal-call credentials and the Accounts-only asymmetric signer were provisioned within the approved scope. The Gateway received the public verifier and a rollover internal-secret slot; existing secret names and resource bindings were preserved. Merchant and Accounts preview variables are scoped to the actual `staging` branch, never production. The partial initial multi-branch configuration attempt was reconciled before Accounts completion. No existing decrypted Vercel environment export was used; only newly generated staging values entered local build configuration. Generated secret values are absent from all packaged artifact files, including public assets.

The first API deployment failed Cloudflare error 10055: 65 variables exceeded the Free-plan limit. No new API version was activated by that attempt. Current API source uses the existing `global-edge` diagnostic fallback, removing only staging `EDGE_SCOPE`. Fresh provider comparison proved every other plaintext binding equal before using the governed wrapper with `--keep-vars=false`; Wrangler preserves secrets under that flag ([provider contract](https://developers.cloudflare.com/workers/wrangler/commands/workers/)). Final actual count: **44 plaintext + 20 secrets = 64**, with every prior secret name and non-variable resource binding preserved. No plan upgrade occurred.

Correct prior active versions, independently read from the provider's latest deployment: API `87c604fe-6ee4-43a2-8b56-f156dc911a24`, BFF `a636c447-9c2f-4a09-b5e5-13ff45a2da38`. Chronological CLI listing position must not be mistaken for active deployment identity.

## Demonstrated hosted journeys

All fixtures are clearly synthetic: three `.invalid` users, two unpublished draft sites, and one stock product. Sessions were issued using the canonical Accounts source and registered on the actual hosted Gateway. **This does not establish a hosted password/Turnstile login.** The first fixture seed hit the unique store-name constraint; independent readback proved zero owned sites/users committed, and a separately identified seed with unique names succeeded.

**13 backend checks passed:** canonical session controls; current capabilities on API/BFF; scoped exact empty pages; mobile-created location and web-created supplier; original receipts replayed across transports; nonempty matching lists; changed-key-intent refusal; concurrent same-key convergence; later-page/out-of-range exact-count recovery; populated cross-tenant and owner-only staff denial; staging mixed-cookie isolation; protocol-1 refusal; stop-before-effect recovery; and destroyed-session rejection. These assertions are grouped into thirteen recorded checks, not thirteen accepted feature rows.

Actual shared SDK checks additionally proved:

- Web SDK creates and validates a complete location receipt; the Dart SDK reads that location through the hosted BFF.
- Dart SDK creates and replays a supplier; the web SDK reads it and validates exactly the same durable receipt.
- This Dart execution used the **host Dart VM**, not an emulator UI.

**Seven deployed-preview backend checks passed:** Accounts validates the synthetic session using its actual runtime configuration; Accounts ignores production-named cookies; its lookup emits only staged CSRF and the exact admitted page chunk; Merchant's actual Next routes read the same **3 locations / 2 suppliers** with exact scope/count/no-store; Merchant ignores production-named cookies and rejects stale actor context. No browser interaction is claimed.

Independent database readback found **six owned receipts for five metadata records**, exactly one concurrent-command receipt, one cancelled stop receipt, no forbidden/legacy-intent receipt, and unchanged empty warehouse data in the second populated-owner fixture. Four returned metadata receipts matched their complete stored JSON responses.

**Eight further stock checks passed:** purchase creation/replay; partial receiving/replay; receive-all freezing the remaining three units; over-receive and changed-intent denial; transfer creation/replay; shipment/replay; two partial transfer receipts/replays; and complete current document reads. Final independent SQL readback:

- Original **20** available units + **5** purchased/received = **25** available.
- Source **21**, destination **4**, reserved **0**, incoming **0**.
- Purchase ordered/received **5/5**; transfer requested/shipped/received **4/4/4**.
- **13 total owned receipts**, including exactly seven stock receipts; all seven returned stock responses equal their complete durable responses. Denied late receiving has no receipt.
- Both fixture sites remain unpublished. No real payment, delivery, provider settlement or existing merchant stock is involved.

## Source checks

The final runtime trees pass **750/750 Flutter**, clean Flutter analysis, **99 shared Dart API tests / 6 existing skips**, **48 auth-core**, **25 BFF**, **70 Identity**, **1,598 Merchant web**, and **2,025 Gateway** tests. Relevant TS checks pass. These are separate suite results; no combined completion score is inferred. Candidate `288cb3dfa…` passes all 114 governance validators in the disposable clone; active/primary dependency trees were not governance-cleaned.

The newest installed emulator APK still belongs to earlier source `13d254de…`; current staging-isolation source has not been installed or accepted through the emulator. The owner-approved emulator remains sufficient for device acceptance; no new physical-device requirement is imposed.

## Remaining acceptance

1. Finish the approved single staging Turnstile verifier transfer when the user's task tab is available; do not bulk-export secrets or repeat completed approvals.
2. Finish staging custom-domain verification/assignment and confirm protection at the exact host. `admin-staging.letbuyy.com` and `accounts-staging.letbuyy.com` are registered to branch `staging`; verification returned `missing_txt_record` for `_vercel.letbuyy.com`. The current isolated Cloudflare OAuth scope has no DNS write permission; DNS was not changed. Neither custom-host alias was assigned. Protected unique previews are already verified.
3. Establish the supported protected-staging device access path, then exercise normal password/challenge login and actual web/emulator creation, recovery, store changes and revoked staff. Do not embed a Vercel bypass secret in the mobile app or disable preview protection to manufacture acceptance.
4. Continue every remaining ledger row: broader feature trace/implementation, real two-direction UI edits/conflicts, provider sandbox and financial reconciliation, buyer outcomes, signed release and operating/rollback gates. **No row is fully accepted by this report.** Production requires a separate concrete release decision after its gates.

## Retained private evidence

Base: `/private/tmp/letbuyy-hosted-warehouse-20261101/` (private task directory). No raw credentials, backup contents, bearer values or replay nonces are reproduced here.

| Evidence | Receipt/log |
|---|---|
| Staging migration acknowledged + independent qualification | `staging-414-execution.json`, `staging-414-guard-qualification.log` |
| Original preservation limitation | `staging-414-original-row-verification.json`, `staging-replay-turnover-reconciliation.json` |
| Original failed checker | `staging-414-first-postconditions.json`, `staging-414-execution-acknowledged-first-check-failed.json` |
| Final governance | `staging-isolation-governance-final.json` / `.log` (initial failed run also retained) |
| Worker activation and exact provider bytes/bindings | `staging-api-budget-{activation,readback}.json`, `staging-bff-isolation-{activation,readback}.json` |
| First refused API activation | `staging-api-activation.json` and private log |
| Preview build/admission/source/protection | `staging-preview-artifact-admission.json`, `staging-preview-deployments-readback.json` |
| Preview custom-host registration | `staging-alias-activation.json`, `staging-domain-verification.json` |
| Hosted warehouse behavior | `staging-warehouse-hosted-acceptance.json`, `staging-warehouse-effects-readback.json` |
| Actual web and Dart SDK synchronization | `staging-sdk-cross-client-acceptance.json`; failed first Dart harness and corrected log retained |
| Actual deployed Next/Accounts readback | `staging-protected-preview-backend-acceptance.json` / `.log` |
| Purchase/transfer acceptance and SQL conservation | `staging-stock-hosted-acceptance.json`, `staging-stock-effects-readback.json` |

The initial preview protection checker assumed HTTP 401/403; observed nonce-bearing SSO 302 was independently confirmed and the assumption corrected. The initial CLI curl wrapper incorrectly forwarded its global flag; the corrected read used the same isolated account token in memory, explicit team scope, stdin-only synthetic cookies, and no protection change. The failed checks remain retained; none was reclassified as an application pass without the succeeding actual readback.
