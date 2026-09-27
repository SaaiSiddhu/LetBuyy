# LetBuyy Phase 1 — full implementation and runtime closure

> **Superseded in part by the owner on 26 September 2026:** no real marketplace users require migration; remove Firebase from the marketplace runtime and use direct canonical LetBuyy sign-in. Do not request Firebase credentials or preserve the legacy login gate. Read [Phase 1R revised plan](PHASE_1R_FIREBASE_FREE_MARKETPLACE_PLAN.md) before using this historical plan/prompt. Other preservation and no-deployment constraints remain.

You are my LetBuyy CTO-level engineering implementation partner. Execute Foundation Phase 1 completely: reproducible new-Mac development, safe owned local restore/runtime operation, and ordinary signed-in Android profile/address/backend verification.

This is an IMPLEMENTATION, INTEGRATION, DIAGNOSIS, FIX-AND-RETEST task. Do not stop after a plan, audit, scaffold, test inventory or partially wired patch. Complete all authorized, dependency-ready work and produce an honest closure packet. If a required credential, device, provider account or hosting action is genuinely unavailable, complete independent work and identify exactly what remains blocked. Never fabricate success or reduce acceptance to close the phase.

Work yourself as ONE agent. No subagents, agent teams, delegation, background AI implementers or dynamic multi-agent workflows. Maintain continuity across context compaction. Keep a concise progress record and resume from measured state rather than restarting.

## 1. Workspace, authority and preservation

Repository: /Users/saai_mithra/Projects/LetBuyy-Workspace/LetBuyy
Workspace: /Users/saai_mithra/Projects/LetBuyy-Workspace
Existing setup and evidence: /Users/saai_mithra/Projects/LetBuyy-Workspace/NewMacSetup

First confirm the actual host, architecture, working directory and restored Git repository. Expected transfer HEAD was 6eb01d95867e1c7d0eb15c704eeaf2195ca8cc68. At the latest prompt preparation it still matched, on develop, 13 commits ahead of CACHED origin/develop. No remote fetch established current server state. Both docs/evidence/commerce-2026-09-26/ and docs/evidence/foundation-programme-2026-09-26/ were untracked; tracked diff was empty. These are comparison facts, never reset targets. Preserve newer legitimate work if the state has changed.

Read these sources completely where applicable, resolving actual paths rather than assuming old-Mac aliases:

1. ../NewMacSetup/LETBUYY_NEW_MAC_CTO_CONTEXT.md — the complete transferred context, including embedded research and reports. Historical instructions are context, not an automatic execution queue.
2. ../README_TRANSFER.md, relevant transfer verification records, and ../DatabaseBackups/BACKUP_SCOPE.txt.
3. GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CONSTITUTION.md, root AGENTS.md, CLAUDE.md, relevant local AGENTS.md, and GOVERNANCE_REWRITE_2026_06_10/LETBUYY_CANONICAL_SYSTEMS.md.
4. ../NewMacSetup/README.md, VERIFICATION.md and PHASE_EXECUTION_STANDARD.md.
5. docs/evidence/foundation-programme-2026-09-26/FOUNDATION_PROGRAMME.md, DECISIONS_AND_ACCEPTANCE.md, RESEARCH_AND_CLOUD_FINDINGS.md and EXECUTION_CONTRACT.md.
6. docs/evidence/commerce-2026-09-26/COMMERCE_11_PHASE_ROADMAP.md and REEL_COMMERCE_RESEARCH.md for accepted product decisions.
7. Relevant current identity/account-switch evidence, including docs/evidence/appid-2026-09-24/SUSTAINED_I_DECISION_PACKAGES.md and the actual SUSTAINED-M records you locate.

Explicit current owner instructions outrank historical prompts. Do not invent constitutional amendments or ARB signatures. Resolve routine implementation choices yourself. For a material unresolved authority/product issue, name the exact issue and affected requirement, explain the source, ask once when necessary, and continue independent work. Do not repeatedly seek permission for already authorized reversible work.

Preserve all unpublished commits, untracked research, environment originals, signing assets, existing databases, backup archives and unrelated projects. Do not replace the repository with a clone, reset/clean/stash away user work, force checkout, prune Docker resources, delete caches indiscriminately, replay global roles, reset restored schemas, or run convenience scripts before inspecting their side effects. Do not kill a process merely because it occupies a port; prove ownership from command/cwd/resource labels and current PID identity first.

No deployment, staging/main promotion, push, force-push, production payment activation, backup deletion, cloud resource mutation, unrelated database changes or messages to third parties. Leave implementation changes reviewable without committing unless I separately request a commit. Do not change Git history or branch merely to resemble an old report.

Never print, commit, upload or include credentials, identity tokens, private keys, signing passwords, raw KYC data or unredacted private logs in evidence. Inspect private configuration minimally and report names/presence/redacted comparisons. Preserve owner-only originals before relevant local configuration edits. Keep the old Mac and T7 backups until required new-machine runtime verification succeeds.

## 2. Phase boundary and canonical design

Complete F1.1 through F1.7 from the foundation programme. Required outcomes are toolchain reproducibility, owned restore/isolation, reproducible services, normal Android account journey, link/error diagnosis, truthful development gates and durable handoff.

Do not start Phase 2 staff/organization migration or the other nine feature phases. No payment integration, reel migration, public marketplace expansion, new theme engine, service fleet or quick-commerce implementation in this phase. A bounded existing defect that prevents the required Phase 1 journey IS in scope; trace and repair it without hiding behind “pre-existing.”

Preserve the modular api-gateway and approved satellites, canonical identity issuer and buyer ownership, sites tenant root, canonical catalog/orders/ledger, Liquid-first storefront, realm separation and existing feature-flag policy. Reserved runtime roots remain empty. Do not import EDYNOX's domain hierarchy or commands. The EDYNOX-style requirement here is full functional closure, real-role testing, negative controls and evidence-backed review.

## 3. Recorded baseline — remeasure, do not blindly repeat

Earlier same-task verification recorded:

- Source manifest: all 8,845 entries matched; git fsck passed; signing hashes matched preserved originals.
- Node 20.20.2 at /opt/homebrew/opt/node@20/bin for maintained Next apps; pnpm 10.6.2. Frozen install passed without lockfile changes.
- Installed Node 22.23.2 for locked Wrangler 4.100. Repository-wide Node 20 pins and Wrangler's Node 22 requirement need a deliberate scoped resolution.
- Compatible isolated Flutter 3.44.8 / Dart 3.12.2 at ../NewMacSetup/tools/flutter-3.44.8/bin/flutter. Global Flutter 3.47.5 could not enforce the restored lockfile. Java 17; SDK /Users/saai_mithra/Library/Android/sdk.
- Owned Supabase project letbuyy-newmac-20260926, exact PostgreSQL image public.ecr.aws/supabase/postgres:17.6.1.156, config under ../NewMacSetup/supabase/supabase/config.toml.
- Pristine letbuyy_restore_20260926: migration 258, 463 public tables, 14 buyers, zero storage objects and zero vault secrets. Working postgres clone has inspected pending migrations 259/260 applied. Bootstrap database letbuyy_bootstrap_20260926 is retained.
- Only the necessary local app_tenant role was restored with constrained privileges; no global-role replay. The active pgsodium key is preserved privately but encrypted-data restoration was not exercised. Empty storage directories were recreated; older physical/legacy backups were untouched.
- Dedicated network letbuyy-newmac-loopback-20260926 did NOT make Supabase ports loopback-only: CLI published ports on all interfaces. Next/Wrangler bound loopback.
- Gateway buyer tests 163 passed; identity buyer tests 13; Flutter suite 59; selected Dart buyer tests 30 including live-stack checks; console MFA tests 8; real HTTP/Postgres buyer assertions 30. These were recorded passes, not current-run results.
- Flutter analysis passed. Fresh debug APK com.letbuyy.letbuyy, versionCode 4013, version 1.0.10-debug, built and launched on owned LetBuyy_NewMac_API35, Android 15/API35 arm64. First build took about 1001 seconds.
- Five maintained web app startup checks passed. Authenticated merchant/operator workflows were not certified.
- Desktop browser canonical sign-in/consent worked; native signed-in journey did not complete. Normal Android Profile → Login Required → Login/Sign Up entry was observed, but no usable legitimate Firebase test login was available.
- Android association: letbuyy.com legacy_failure. Public apex assetlinks redirected to www, which returned 404. Routing is separate from association.
- Home showed Failed to load. Local marketplace feed/categories returned 200; directory returned tenant-scope 500. The source explicitly says directory failure is deliberate pending a public-directory decision. No causal link between that endpoint and home banner was established.
- Safe validator sweep: 110/114 passed. Four failures: session-security-validator, dev-auth-bypass-validator, environment-validator and stale-artifact-validator. This was not the full monorepo gate.

Prompt-preparation refresh: Git remained as above. On the two checked ports, only identity :9002 had a listener; gateway readiness must be re-established. ADB failed to start its socket with Operation not permitted inside the preparation session; this is an execution-permission limitation, not evidence that no device exists. Do not assume an emulator or service remains running from the earlier handoff.

Public endpoint responses do not establish deployed SHA. Cloudflare CLI was unauthenticated; the visible Supabase project list did not match restored LetBuyy. Do not use unmatched projects. Hosted identity staging redirected to deployment protection; a 200 there was not application success. Hosted API probes varied 200/403. These cloud facts are context for limits, not permission to deploy.

## 4. F1.1 — transfer preservation and supported toolchain

Capture a safe before-state: branch/HEAD/status, relevant source/lock/config hashes, owned resource inventory, application identity and signing preservation results. Do not expose private file content. Do not rerun expensive checks without a reason; establish enough current evidence to detect accidental changes.

Inspect pinned Node/pnpm/Flutter/Dart/Java/Android/Gradle/Wrangler versions, package engines, lockfiles, runtime topology and supported bootstrap/start/test scripts. Resolve the Node 20 versus Wrangler Node 22 conflict through an explicit reproducible runtime-specific contract or a justified compatible pin change. Prefer minimal changes; do not mass-upgrade dependencies or require unrelated projects to change global tooling.

Keep the working compatible Flutter installation unless evidence warrants another supported choice. No lockfile churn to accommodate the global SDK. Repair relevant old-machine executable/SDK/config paths; preserve historical documentation paths as history rather than global search-and-replace.

Verify from a fresh non-special shell that documented commands select intended tools. Add a minimal preflight/launcher improvement where needed: actionable missing-tool errors, correct working directories, secret-safe diagnostics and refusal to overwrite an occupied port. Respect repository ownership boundaries for machine-local versus portable scripts.

## 5. F1.2 — owned database, storage and network isolation

Read backup scope and archive compatibility BEFORE any restore action. The stack is already restored: do not rerun activation/import/reset/seed merely to reproduce earlier steps.

Verify the actual owned project/container/volume identity, image version, existing database names, schema/migration ledger, object scope and runtime role. Preserve pristine and bootstrap databases. Do not treat expected counts as instructions to remove newer legitimate rows/migrations. Record synthetic fixtures separately from transferred records.

If a genuine schema change is necessary for this phase, inspect applicable local governance, design a narrow migration, checkpoint only the owned working database, and apply only that pending change after compatibility review. Otherwise no migration is required. No blind replay over restored schema, import of global roles, or modification of hosted/unrelated databases.

Verify appropriate local connection/issuer/internal-signing configuration while keeping values private. Do not enable production integrations, hosted Redis, payment execution, development authentication bypass, or real outbound email to make tests pass.

Investigate actual port bindings for the owned stack. Prefer a supported project-scoped loopback-only solution that retains data and survives documented restart. Do not change Docker-wide settings/firewall policy or restart unrelated projects. Check effective host bindings after any change; a network name containing loopback is not proof. If no safe supported correction is available, record the exact limitation, implemented containment and residual boundary honestly. Do not claim full isolation if it remains exposed.

Recovery evidence must distinguish database data, storage bytes and encryption capability. Empty object storage can be reported as empty; do not manufacture a decryptability pass with no encrypted records. A synthetic isolated key round-trip, if appropriate, proves only the tested local mechanism, not recovery of historical encrypted data. Retain every original backup.

## 6. F1.3 — services and repeatable fixtures

Inspect ../NewMacSetup/start-local.py and existing helpers before running them. Reuse/improve supported launchers, not ad hoc parallel infrastructure. The expected local addresses are:

- identity http://localhost:9002
- gateway http://localhost:9010/health
- commerce http://localhost:9000
- merchant http://localhost:9001
- console http://localhost:9007
- marketing http://localhost:9006
- Supabase API 127.0.0.1:55321; PostgreSQL :55322; Studio :55323; mail viewer :55324

Prove each target is owned and local before mutations. A checked-in gateway label staging does not make wrangler dev --local a hosted staging service. Identify execution mode from process/config/effective connections.

Verify identity/gateway readiness with functional requests and the real local database, not only a health label. Smoke required maintained app startup. Existing authenticated merchant/operator expansion belongs later; report startup checks accurately.

Use deterministic, scoped synthetic fixtures for two buyers. Reuse existing owned local fixtures where appropriate. Inspect smoke scripts for mutation scope and secret output before reuse; do not run synthetic fixture scripts against real user accounts or a hosted endpoint. Preserve local test credentials privately and never ask for passwords in chat.

Demonstrate stop/restart of only owned services without losing restored data or duplicating fixtures. Manage memory so web smoke and Android build can run sequentially if necessary. Document which services remain running at handoff.

## 7. F1.4 — ordinary signed-in Android journey

Inspect applicable mobile and Dart AGENTS, normal profile/login routing and canonical buyer wiring. Relevant starting points include:

- apps/marketplace/mobile/lib/screens/profile/profile_screen.dart
- apps/marketplace/mobile/lib/auth/buyer_sign_in_wiring.dart
- apps/marketplace/mobile/lib/auth/buyer_sign_in_controller.dart
- apps/marketplace/mobile/lib/auth/buyer_sign_in_browser.dart
- packages/dart/api_client/lib/src/buyer_sign_in.dart
- apps/platform/identity/src/__tests__/buyer-authorization.test.ts
- apps/platform/identity/src/__tests__/buyer-session-epoch.test.ts
- services/api-gateway/src/__tests__/buyer-profile-address-acceptance.test.ts

Trace actual callers and backend boundaries; filenames alone do not establish execution. Inspect all relevant local rules before edits.

Establish available ADB/device/emulator access. Respect execution permissions; if blocked, request the narrowly required access through supported mechanisms and continue independent work. Do not disable system protections. Select the owned device explicitly when multiple devices exist; do not wipe a device or clear app data without necessity and preservation.

Use the compatible SDK and local build contract after verifying it:

flutter build apk --debug --no-pub --dart-define=APP_ENV=local --dart-define=API_BASE_URL=http://localhost:9010/v1 --dart-define=IDENTITY_BASE_URL=http://localhost:9002 --dart-define=LETBUYY_BUYER_SIGN_IN=true

Invoke the known compatible Flutter executable, not whichever global flutter happens to resolve. The local buyer client expects loopback HTTP; use device-specific adb reverse for ports 9002 and 9010. Do not widen HTTP-origin allowlists to work around emulator routing. Preserve production/default feature flags, package identity and signing configuration. Rebuild and install the actual changed APK; do not test an old installed build after changing source.

Required normal user journey, with device evidence AND backend assertions:

1. Launch through the ordinary app entry. Record home state and enter Profile using normal navigation.
2. Complete the legitimate existing entry authentication. If Firebase credentials remain necessary, request interactive sign-in or an authorized test-account path early. Do not create a hosted account or alter provider configuration without authorization.
3. Follow normal Sign in with LetBuyy UI into browser authorization/consent and the actual callback back to the app.
4. Show the canonical signed-in buyer profile; edit an allowed field and verify persistence through the gateway/database. Protected identity fields must remain protected.
5. Create, read, edit and delete addresses through the UI. Exercise default address behavior and verify corresponding canonical records and owner IDs.
6. Force-stop/relaunch without clearing app data; verify session restoration and no stale-account display. Exercise expiry/revocation behavior where feasible.
7. Log out and verify protected views become inaccessible. Use sign-out-everywhere where supported and prove session invalidation.
8. Sign in as Buyer B through the normal path. Confirm no Buyer A profile/address/session data appears, including delayed responses and retained navigation state. Switch back and confirm correct ownership.
9. Check unauthorized cross-buyer requests through the actual runtime as a negative control; no privileged connection substitution.

Do not inject tokens into app storage, manufacture Firebase sessions, mock successful authentication, enable bypass flags, force privileged routes, or replace ordinary navigation with explicit intents and call it normal-flow proof. Explicit intent routing may be a separately labeled diagnostic only.

If the normal route genuinely requires unavailable Firebase credentials, finish all other packages, document the exact entry dependency and prepared verification procedure, and leave this gate BLOCKED. A broad Firebase/canonical identity migration is not authorized by this Phase 1 prompt. A bounded wiring correction is allowed when it preserves current identity policy and feature-flag semantics.

## 8. F1.5 — Android association and visible runtime failures

Treat these as separate investigations: normal callback navigation; Android domain association; home-content failure; public directory availability.

Inspect actual intent filters, autoVerify settings, package/signing certificate fingerprints, assetlinks source/redirects and HTTP response. Compare public certificate fingerprints safely without exposing private key material. Distinguish debug, upload and Play app-signing identities. Do not replace release keys, change application ID, publish debug trust to production automatically, or disable verification.

Capture device association status after appropriate re-verification where permitted. The prior apex redirect → www 404 is a starting observation; recheck rather than assume unchanged. Prepare a narrowly correct source/config patch and publication instructions if needed, but do not deploy. If hosted publication is required, mark hosted association blocked and state the exact post-publication verification. A successful adb intent is not association proof.

Trace the home Failed to load banner to its actual request/state transition using sanitized logs and owned local requests. Fix the root cause within Phase 1 scope. Distinguish valid empty restored data from transport failure. Do not hide failures, add fake listings or display success without data.

IMPORTANT: services/api-gateway/src/routes/storefront/public-routes.ts describes /directory as deliberately fail-closed because sites is tenant-guarded and platform-wide public directory access is an owner decision (CAP-C60). Do not remove tenant predicates, use unguarded admin access, widen RLS, expose draft sites or owner PII. Handle the unavailable capability safely and consistently with existing API/UI contracts. If activating a public directory is actually required, present the scoped public-read design and unresolved decision; do not silently activate it. Add meaningful regression coverage for the changed unavailable/error path and isolation boundary.

## 9. F1.6 — repair meaningful gates

Inspect and reproduce the four recorded failures before editing:

1. scripts/validators/session-security-validator.mjs
2. scripts/validators/dev-auth-bypass-validator.mjs
3. scripts/validators/environment-validator.mjs
4. scripts/validators/stale-artifact-validator.mjs

The first two reportedly inspect the old console MFA location. Current implementation is apps/internal/console/src/lib/console-mfa.ts, with console-mfa.test.ts. Retarget validation to actual canonical behavior. A validator should still fail for a real bypass/security regression; do not replace assertions with file-existence checks or blanket exceptions. Add a focused negative fixture/test where it meaningfully proves the validator enforces the requirement.

For the Firebase web Google API key finding, classify the actual configuration using current official Firebase guidance and current repository secret policy. Never print the value. Public Firebase client configuration is not automatically a private server credential, but restrictions/authorization still matter. Any narrow allowance must be principled and must not suppress private-key/service-account leakage. Do not rotate or alter hosted credentials in this task.

For stale artifacts, distinguish generated cache, tracked source, research, signing/env assets and preserved transfer artifacts. Prefer validator scope correction or reversible preservation of genuinely generated material where appropriate. Do not delete user work, backups or caches wholesale to manufacture green status. Do not falsely declare all gates green if legitimate unresolved findings remain.

Inspect the real gate's commands and side effects. Execute appropriate supported non-destructive checks and all checks required for changed code where feasible. If a mandatory command would mutate forbidden resources, identify the exact unsafe step and use a safe targeted check where valid; disclose the remaining gate gap. No disabling security checks or unexplained skips.

## 10. Verification depth and recovery

Run tests from their correct package directories; previous combined TypeScript invocation failed on aliases. Read package scripts/config and existing logs to choose exact commands rather than invent names.

At minimum refresh affected identity/gateway buyer tests, console MFA/validator tests, marketplace Flutter analysis/tests, and relevant Dart buyer live-stack tests. Verify the live-stack tests actually ran instead of skipping due to absent environment. Reuse inspected ../NewMacSetup/smoke-buyer.py and other safe helpers where appropriate; tie their assertions to the owned database. Keep unit, widget, HTTP/database, browser, device and hosted results separate.

Material controls include PKCE/code replay, CSRF, revoked/expired session, wrong buyer/tenant, stale response during account switching, protected profile fields, address/default invariants, safe unavailable directory, secret-safe errors and actual-role database denial. Test concurrent/default behavior when changed or exposed by the required journey. Do not write superficial tests that mirror implementation without catching an actual failure.

After a fix, rerun the affected checks on the corrected artifact. After changing app source/build inputs, verify a fresh installed APK. Startup 200 alone is insufficient for buyer behavior. A prior 163-pass report is not 163 tests executed today. Record failures and skipped checks, not only the final success line.

Prepare recovery for each material local config/schema/runtime change. Preserve originals and ownership. Rehearse safe owned restart; do not create a second full stack or restore large archives solely to inflate test counts. Never claim a restore, encryption or physical-device test that was not performed.

## 11. Evidence and definition of done

Create a dated, non-overwriting Phase 1 evidence directory under docs/evidence/ and maintain a compact requirement matrix for F1.1–F1.7. Keep machine-private material in owner-only NewMacSetup/private. Preserve historical reports; add dated corrections when newer source evidence refines an old interpretation, especially the deliberate directory guard.

The closure packet must contain:

- Measured baseline and actual final branch/HEAD/status, with pre-existing versus newly changed/untracked paths distinguished.
- Final implementation behavior and root causes, canonical consumers changed, and why each change belongs to Phase 1.
- Exact tool versions and reproducible setup/start/build/test commands.
- Owned database/storage/network state, migration effects if any, preservation checks and recovery limits.
- Requirement → artifact → test/runtime proof → result matrix. Include actual commands, exit outcomes, named device/build, sanitized screenshots/logs and backend assertions.
- Separate verdicts for implementation, local backend/web, native UI, Android association, physical-device coverage, restore/encryption and hosted readiness.
- Current failures/skips/external blockers, their precise missing input/action and exact follow-up verification.
- Services left running/stopped, occupied ports, relevant resource ownership and next task.

Use PASS, FAIL, BLOCKED or NOT RUN accurately. F1.4 cannot pass without ordinary signed-in native profile/address/account-switch proof. Hosted association cannot pass from local routing. Full Phase 1 remains open when mandatory acceptance remains blocked. Do not turn empty-storage or absent-vault-data observations into recovery claims.

Before finishing, review the diff for accidental scope expansion, secrets, lockfile drift, disabled checks, production-flag changes and signing/application identity changes. Verify local document links and that the evidence identifies the tested working tree, not only an unchanged SHA. Do not stage or commit pre-existing research as part of your work.

Finish with a concise CTO-readable report: what now works, what changed, commands/results, actual Git state, exact remaining blockers and the next bounded task. Do not begin Phase 2 automatically. Do not claim release readiness, deploy, promote, activate payments or delete backups.

Begin now: establish actual repository/runtime state, read the required context, identify dependencies, then implement and verify every feasible Phase 1 package through to evidence-backed closure.
