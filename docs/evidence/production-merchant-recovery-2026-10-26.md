# Production merchant recovery — 26 October 2026

Status: SOURCE MERGED INTO LOCAL DEVELOP; HOSTED RELEASE BLOCKED. Verified source 182715b328150046643f1a6d20d6d3c10e9519cb, merge 1f9357f1d043f6251486e813fb932a99591d1d4f. This is not a hosted acceptance certificate.

## Scope and owner decisions

The owner requests the current merchant product to work end to end, including all ten authored niche themes, Circuit as the starting design, and working store subdomains. Base: develop/staging/main 85d251c470645cdfd47658966c4bd7c2bdb473e6. Phase branch codex/production-merchant-recovery, claim f28886b5e. Single agent; no delegated work. Existing local apps, data, environment files, encrypted backups, saved merchant configuration and credentials remain preserved.

The owner explicitly confirmed Circuit/letbuyy-forge, then on 26 October instructed **keep letbuyy.store and change the backend accordingly**. Tenant storefronts remain on that registrable domain; accounts/admin/API remain on letbuyy.com. This current instruction overrides the earlier storefront-apex prose for this phase. No hand-authored constitutional document was amended by the agent. Domain validation remains narrow: only the existing Commerce project aliases and explicit Gateway tenant-root configuration are added to the accepted configuration; account/API domain substitutions remain rejected.

## Verified production state

| Surface | Observation | Consequence |
|---|---|---|
| Merchant themes | Authenticated Snaz page displays zero discovery and installed themes | Not a stale thumbnail/cache problem |
| Database catalog | themes 0, theme_packages 0, theme_package_versions 0 | No current catalog to install |
| Theme commands | install_owned_theme_v1, mutate_owned_theme_draft_v1, read_owned_theme_draft_v1 and theme_draft_actor_site_v1 absent | Current install/editor cannot work on this database |
| Store visibility | sites lacks published, access_mode and custom_domain_status | Current storefront access contract cannot be satisfied |
| Shipping | Native merchant page and authenticated BFF report INTERNAL_ERROR; shipping tables lack site_id/cod_enabled | Production schema lags current scoped settings code |
| Checkout | checkout_intents absent | Current canonical checkout is not deploy-ready |
| Products/orders/taxes | Native browser renders valid empty lists/settings | Empty-read rendering is observed, not a completed mutation journey |
| Payments | Browser reports sandbox, own Razorpay account unconnected; no live provider transaction attempted | External live-payment acceptance is unverified |
| Snaz configuration | Core selected, five configuration keys, no published release | Preserve existing content and draft privacy; do not overwrite or silently publish |
| Storefront hosting | Vercel project root was removed apps/storefront-runtime; latest observed source 5af69e0c080503765dec361eae2128ba860cf529 | Correct source root and a compatible release are required |
| Wildcard hosting | *.letbuyy.store verified:false; external Cloudflare DNS | A resolving wildcard DNS record is not a verified Vercel wildcard deployment |

Only schema metadata, catalog counts and public theme-selection/emptiness information were queried. No production account/session rows, credential material, password, recovery secret, email token or real customer record is included here.

## Repairs and provider configuration

- New-store default is a browser-safe shared contract, Circuit/letbuyy-forge. Gateway validates and stores the real captured catalog Liquid document before inserting a first-party store, refuses unavailable/malformed catalog state, and preserves explicit older-client selections. Industry survey metadata does not recolor an authored niche design.
- Identity creation leaves an unspecified design to that server authority. Normal onboarding's explicit Core override was reproduced in a fresh browser signup, removed, and the same full signup now selects Circuit and remains a draft. The new default also loads its first editor, saves a durable draft and creates a preview session without opening the store.
- Exact configured platform aliases are retained for signed editor previews, while View store/onboarding links identify the requested tenant. Loopback and local-path routing remain covered. Existing storefront/storefront-staging platform handles are reserved against new merchant claims.
- Merchant settings use the configured storefront root. Domain copy distinguishes an unpublished store from a public address; an address assignment is not asserted to be live availability.
- Custom-domain validation now always protects the canonical platform zone as well as configured tenant/platform roots. A positive real-owner external claim passes; before repair the omitted platform env wrongly sent a first-party zone into abuse screening instead of rejecting it before claim processing. This is a boundary correctness repair, not a claim that the existing abuse screen allowed a takeover.
- Catalog sorting gains a unique id tie-breaker for stable pagination and authored first-party sequence.
- Verified actual Accounts and Merchant project IDs replace stale identifiers in the deployment manifest. Commerce project URLs identify its existing storefront aliases.
- Existing Vercel storefront project prj_P5yXTxXK5VnzVoAfv0lSoqXpIME8 now has root apps/commerce/web. Only snaz.letbuyy.store was attached and verified on this project. No apex or nameserver routing was changed.
- Automatic approval review rejected an apex attachment because it could affect root-domain services beyond tenant routing. The safer existing preview host plus tenant-only attachment was used; the rejected apex action was not retried through another mechanism.
- 18 production Commerce variables are configured. INTERNAL_API_SECRET and its alias use the already-rotated production value; dedicated PREVIEW_SIGNING_KEY/STORE_ACCESS_SIGNING_KEY are generated and protected as sensitive. Existing CUSTOMER_SESSION_SECRET is retained; COOKIE_DOMAIN is absent. The new signing keys still require synchronization to the guarded API release. Incorrectly sensitive NEXT_PUBLIC entries required recreation as known public configuration under Vercel's current API rules; other Preview targets were retained. No secret values are printed or committed. Configuration applies to a new deployment. Production-config build dpl_2YyMsGJPyUQb8x2LdNvpPi957c6U is READY from pinned main 85d251c470645cdfd47658966c4bd7c2bdb473e6 with autoAssignCustomDomains:false. Only generated Vercel aliases were assigned; independent alias API readback confirms Snaz and storefront custom domains remain on dpl_FyTmyocsDQZsEBUCShvrH6CdPRST. No traffic promotion is claimed here.

Provider readbacks and receipts live in the ignored local directory .tmp/local-dev/production-merchant-recovery-20261025/. All ten catalog-v2 WebP assets independently return HTTP200 on the production Merchant host. Public HTTP after hostname attachment still returns404/Store not found on Snaz and the old storefront deployment. Therefore hostname ownership alone does not close the incident.

## Merchant completion map

The repository contains 80 merchant page entries, including non-store legacy pages. Presence is not completion. No frozen app, new runtime, extension executor, real payment or donor mobile application is activated by this audit.

| Journey | Current qualification | Hosted limit |
|---|---|---|
| Store creation/onboarding | Real Gateway creation/default/replay/invalid-catalog tests; fresh UI signup passes through email verification, password setup, Circuit creation and the merchant redirect | Current database lacks catalog and creation contract |
| Dashboard/store discovery | 10 owned current-authority/access cases | Production UI observed; full current release blocked |
| Products/add/edit/status/export/navigation | 10 production-build browser cases,7 status cases,5 summary cases; canonical export5 cases | Production empty read observed; live mutations not certified |
| Collections and smart collections | 5 membership +2 saved-rule preview browser cases | Migration deployment required |
| Inventory adjustments | 5 browser cases including role, stale/lost-response behavior | Migration deployment required |
| Purchasing/operational records | 5 real Gateway/DB detail cases | Hosted provider/schema acceptance pending |
| Shipping and taxes | 6 real Gateway/DB cases +1 production-build browser case, including saved settings through checkout totals | Shipping live read fails on old schema |
| Themes/install/editor/drafts | Full ten-theme install case,8 Core/default/bootstrap cases,1 browser draft recovery case; engine 2209 cases | Catalog0 and current command functions absent |
| Billing/subscription | 10 browser intent/retry/actor cases | Live paid provider transaction not attempted |
| Payout statements | 1 real browser recovery case | No real payout or financial action attempted |
| Staff and MFA | 1 staff +1 MFA browser case through normal synthetic sign-in | Hosted account-changing acceptance not claimed |
| Loyalty | 1 full owned browser journey | Live provider integrations not certified |
| Domains and preview routing |31 focused host/domain cases including hostile-control rejection; Snaz provider verification | Full wildcard verification, compatible API/Commerce release and publication remain prerequisites |
| Customer, review, content, marketing, notification and analytics surfaces | Source/navigation inventory and existing unit/contract coverage; not represented as full live acceptance | Broad current schema release is still blocked |

## Validation and attribution

Candidate checks before the final commit: merchant unit 280/280; Gateway unit 1789/1789; theme engine 2209/2209; shared contracts 361/361; targeted typecheck 37/37 tasks; three app lint tasks pass. Owned core suites: 7/7, 41 cases. Production-build product/shipping browser suites: 2/2, 11 cases. Remaining merchant browser batch: 11/11, 38 cases. Synthetic fixtures perform no real provider charge and do not establish hosted email/DNS/TLS acceptance.

Regressions were reproduced before repair: missing Circuit API default; preview-host alias routed to the wrong root/path. A candidate value import into tenant-core pulled Node-only theme packaging into the Identity browser build; it was corrected to a pure shared-types constant, then the actual production-build browser tests passed. Initial browser execution beside preserved app env files was correctly refused and rerun from a clean disposable checkout. These harness/candidate failures are not mislabeled as additional live product outages. The reserved-host contract mirror was updated to include the verified platform aliases; negative domain controls still fail correctly.

The positive-control-first domain guard regression passes 1/1 after its 422-before/400-after boundary repair. Fresh signup passes 1/1 after the failing-before/fixed-after Circuit assertion. The safe pre-commit gate passes typecheck/lint/contracts/Gateway/CI and retains exactly the two baseline findings (113/114 individual validator sweep; 844/845 governance cases, with the sole preserved-env lifecycle refusal). Final implementation source 182715b328150046643f1a6d20d6d3c10e9519cb passes typecheck, lint, contracts 361, Gateway 1789 and CI checks. Its default post-commit gate retains exactly the baseline stale-artifact method finding and preserved-env lifecycle refusal: 113/114 sweep, 844/845 governance cases. The exact clean lifecycle passes 1/1 and the real clean gate passes 114/114. The initially omitted new database suite was explicitly registered in the reviewed inventory; its 14 discovery/ownership controls pass. There are no newly attributed source failures. Baseline method findings were stale-artifact sweep behavior and lifecycle refusal beside the intentionally preserved merchant .env.local; do not delete local configuration to obtain a green result. Destructive governance runs only in the disposable clean checkout, after its browser processes stop.

## Release dependency and exact recovery order

The release requires provider-owned letbuyy_maintenance.lock_catalogs_v1() before migration 353 and several later guarded migrations. Prior production-copy rehearsal reached 352 and correctly refused 353. Both hosted projects still require provider confirmation; the owner reported no reply to the existing 22 October support request. Do not remove this guard, impersonate supabase_admin, forge migration history, or publish a partially installed catalog.

The existing provider installation packet is database/supabase/deploy/provider-admin-catalog-fence.sql with paired rollback/profile; the existing request is docs/evidence/web-launch-week1-2026-10-21/github-sync/supabase-compatibility-2026-10-22/PROVIDER_ADMIN_REQUEST.md. Production project qtrzgnnqnvboifoqntfi and staging yhhhjeaprrpjglriazad must both be checked through the governed admission path after installation.

Then: refresh encrypted verified backups; rehearse the complete current chain on the fresh production copy; apply the guarded schema/history plan staging then production; verify the ten existing immutable catalog payloads and captured schema versions; synchronize production/staging secrets separately; deploy current Workers and the corrected Commerce root; install Circuit through the owner-scoped command while retaining the existing configuration snapshot and privacy; exercise editor save/reload, signed previews, publication, tenant subdomain, product/variant/cart and checkout through the real browser. Future arbitrary store subdomains also need a supported verified wildcard or the existing per-domain Vercel provisioning owner with appropriately scoped credentials. No apex nameserver migration or broad CLI-token redistribution is authorized by this record.

## Integration and completion report

A–D. Single agent, no delegation. Started from clean primary develop 85d251c47 and a claimed managed phase checkout. Final implementation 182715b32, author/committer matches the repository owner configuration; no extra trailers. The primary checkout was clean before the merge. Existing ignored environment files, local database/apps and recovery backups were preserved.

E–H. Created the owned custom-domain guard suite and this evidence record. Thirty phase paths changed, including the existing branch and execution ledgers; no source file was deleted and no retired path resurrected. First-parent merge diff matches the reviewed phase manifest exactly.

I–N. No migration, schema ownership, RLS, credential API, token-issuer policy, money rule or mobile identity change was applied by this phase. Identity onboarding delegates the unspecified design to the canonical server schema. Tenant boundaries are strengthened by reserved preview handles and unconditional platform-zone rejection. Provider changes are confined to the existing Commerce project and Snaz hostname. Android/iOS qualification is not claimed.

O–U. Commands and exact logs are retained under /private/tmp/letbuyy-production-release-20261025/: merchant-acceptance-postcommit (default battery), merchant-acceptance-real-governance.log (114 real validators), merchant-clean-lifecycle.log (1/1), merchant-unit.log (280), merchant-gateway-unit.log (1789), merchant-theme-engine.log (2209), merchant-contracts-final.log (361), merchant-core-owned (41), merchant-browser-repaired (11), merchant-browser-broad (38), circuit-onboarding-green (1), circuit-default-editable (8, overlapping core cases), domain-zones-green (1), merchant-db-inventory.log (14), merchant-domain-tests-final.log (31) and storefront-direction-final.log. Final focused functional cases have zero failures/skips. Temporary .env refusal, browser dependency import failure and reviewed-inventory failure were diagnosed and corrected/attributed before integration; they are not hidden. The remaining default-gate exit2 represents the two explicit baseline checks and has independent clean counterparts. Local minified production API packaging passes with 4466.63KiB upload size; no upload occurred. The live mutation wrapper refuses absent provider-token environment variables in this shell, while capability plan mode and the local --dry-run pass; a governed live preflight must still pass at release. New Cloudflare startup validation is not claimed.

V–Y. Full production completion is BLOCKED, not merely untested: both freshly checked hosted projects lack the helper/app_tenant and have catalog 0. No hosted migration, ten-row seed, Circuit installation/switch, real publication or coordinated Worker traffic activation was performed here. Snaz remains a draft with its existing configuration. The production-config Commerce build is READY on generated Vercel aliases only; both custom aliases still identify the earlier deployment. Future arbitrary tenant hostnames need verified wildcard support or appropriately scoped per-domain provisioning through the existing owner. The prepared support follow-up has not been sent; explicit approval is requested for inspecting the relevant registered-mail thread and sending that exact follow-up. No real password or bearer link was captured; only server-secret names are reported.

Z. The guarded --no-ff merge was performed inside /Volumes/Projects/LetBuyy with zero overlap/conflicts, exactly 30 phase paths and resurrection count 0. Staging and main remain 85d251c47. No remote branch push was made because the existing provider project has automatic branch deployments and the database-dependent rollout is not ready. The managed phase checkout is retained under the app's previously verified primary-checkout protection; no forced archive/removal or deletion of user files was attempted. The phase tip is an ancestor of local develop. Hosted acceptance and the broader requested production outcome remain open.

The retained managed checkout was detached at local develop after the merge, and only codex/production-merchant-recovery was deleted with git branch -d (tip 182715b32 remains reachable in develop and the ledger). The primary merchant listener is Next dev on 9001, PID 42458, rooted at /Volumes/Projects/LetBuyy/apps/merchant/web. No restart or environment-file change was required. Final primary and managed tracked worktrees are clean; the protected checkout itself remains available for continued release work.
