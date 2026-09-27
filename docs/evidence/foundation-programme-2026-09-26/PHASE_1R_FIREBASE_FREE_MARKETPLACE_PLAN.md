# Phase 1R — Firebase-free marketplace foundation and canonical buyer closure

Date: 26 September 2026. Status: revised plan, not implemented. This records the owner's explicit correction after reviewing the Phase 1 and branding reports.

## Owner decision and effect

The owner states that there are no real marketplace users to preserve and authorizes removal of Firebase from the legacy marketplace app. The next implementation must not require Firebase credentials or preserve Firebase login as the app's entrypoint. No legacy-user migration, identity linking, dual authentication or Firebase compatibility rollout is required for this marketplace cutover.

This supersedes the earlier Phase 1 prompt's requirement to complete a Firebase login before testing canonical identity, and supersedes decision D01 as an external Firebase-credential blocker. It also supersedes the instruction to preserve Firebase-era production/default app authentication flags: the revised source must make canonical LetBuyy authentication the normal supported entry, with no Firebase fallback. Changing source defaults is not authorization to deploy.

The owner's no-real-users statement is accepted product context, not a claim that this review audited every hosted database. It removes the need for a customer migration project. It does not require deleting old Mac/T7 backups, hosted Firebase projects, signing assets or unrelated data. The current request is planning; no implementation, merge or cloud deletion was performed here.

## What current evidence establishes

- Primary checkout: develop at 6eb01d95867e1c7d0eb15c704eeaf2195ca8cc68, 13 ahead of cached origin/develop. Eight tracked Phase 1 files are modified, plus the prepared assetlinks directory and untracked evidence/generated files.
- Branding worktree: ../LetBuyy-agrimate-cleanup, branch letbuyy/agrimate-branding-cleanup, HEAD 8255ffe6. Its changes are not integrated into primary develop.
- Both lines of work affect secret-scan-exceptions.json. The branding work removes obsolete Flutter-web files/exceptions while Phase 1 adds an exception for one of those files. Integration needs semantic reconciliation; “disjoint changes” is not an adequate merge assessment.
- main.dart initializes Firebase before runApp and starts FCM afterward. It registers a broad set of legacy providers alongside the canonical repository and buyer clients.
- profile_screen.dart directly reads FirebaseAuth and Firestore for user/profile/order/wishlist/address behavior. Its Firebase gate precedes canonical sign-in.
- buyer_sign_in_wiring.dart supplies a Firebase token callback; the controller carries Firebase account-linking state despite already having a canonical sign-in client and secure session store.
- A scoped static search matched 71 files across marketplace app, marketplace_services and marketplace_core for Firebase/Firestore patterns. This is an impact indicator, not a complete reachable-dependency count. marketplace_models also declares cloud_firestore and must be included in the dependency audit.
- Existing canonical building blocks include data/marketplace_repository.dart, data/canonical_api.dart, buyer sign-in/browser/session storage, BuyerAccountApi and BuyerAddressApi. Reuse and complete them rather than create another identity/backend.

The pasted reports were read in full. Their reported tests were not independently rerun in this planning pass. The detailed closure says gateway results were 1,106 total, 1,095 passed, 9 skipped and 2 todo; “1,106 passed” would be inaccurate. Worker ready logs are startup evidence, not proof of every worker's functional flow. Non-loopback database ports remain an unresolved isolation limitation. A pin unused on this Mac can still matter in CI or another developer's environment.

## Outcome and boundaries

Build a clean canonical marketplace app inside the existing approved app root, preserving package identity and signing assets. Reuse useful UI, design tokens and domain/API clients; retire the inherited Firebase composition and irrelevant template code. This is not a fresh repository, second app, or new backend.

Required now: Firebase-free boot; honest guest discovery from existing canonical APIs; direct LetBuyy sign-in; canonical profile/address flows; session restoration/logout/account switching; tested ownership boundaries; no hidden Firebase runtime dependency. Existing supported canonical read views can be wired where bounded and available.

Full reels/media processing, checkout/payment lifecycle, settlement and ads billing retain their later parent phases. Removing their legacy Firebase code does not mean those capabilities are complete. Every affected feature receives an explicit disposition and later owner; no fake-success replacement, hidden broken route or silent deletion of accepted V1 requirements.

## R1.0 — establish one reviewable implementation baseline

Inspect primary changes and branding commits together. Preserve all existing work and compare overlapping files before choosing integration mechanics. Carry forward valid launcher, directory, security-validator, association and branding improvements; retire obsolete Firebase/Flutter-web exceptions rather than retaining both sides blindly.

Do not reset or stash away the primary changes to satisfy a generic clean-worktree rule. Prepare a scoped checkpoint/integration plan and follow the owner's actual commit/merge authority at execution time. There is no permission to merge in this planning request. An explicit later implementation prompt should settle checkpoint/merge mechanics once so ceremony does not block unrelated engineering progress.

Review two potentially overstated closure claims: restart ownership should establish the intended service, not merely any process with a cwd inside the repo; local port isolation is not complete while ports bind all interfaces. Avoid blindly accepting or discarding all previous fixes as one bundle.

Exit: exact baseline contains or accounts for both workstreams, with no lost changes and an explicit overlap resolution record.

## R1.1 — complete dependency and feature disposition map

Trace startup, imports/exports, providers, navigation, background callbacks, SDK initialization, native Gradle/plugins/config, shared models, pub dependencies and tests. Include Auth, Firestore, Storage, Messaging/FCM and Analytics. Audit backend Firebase bridges for actual consumers; marketplace removal does not authorize breaking unrelated apps that still use a shared route.

For each affected capability choose one disposition:

1. REWIRE NOW: a required foundation flow with a usable canonical API.
2. RETIRE LEGACY IMPLEMENTATION: dead/template implementation, with accepted product requirement retained where applicable.
3. LATER PHASE: capability still required but its canonical implementation belongs to a named later phase; remove legacy runtime dependency and expose no false working action.

Record feature, source owner, actual consumers, canonical replacement, user-visible result and test. Preserve guest browsing and authentication as functioning entrypoints. Reels, cart, orders, notifications, reviews, wishlist, loyalty, banners, chat, ads and app-update checks must all be classified rather than discovered one crash at a time.

Exit: no reachable Firebase consumer is left without a disposition. Static grep alone cannot certify reachability or runtime absence.

## R1.2 — direct canonical authentication and account state

Make canonical BuyerSignInController and secure session storage the app's authentication authority. Expose normal Sign in with LetBuyy from guest UI. Use the existing identity service and PKCE/browser callback flow; preserve validation, CSRF, audience and session-revocation protections.

Remove FirebaseUser prerequisites, Firebase UID reads and marketplace Firebase-linking callbacks/state. Use canonical buyer IDs across profile/address/view state. Do not retain dual sessions or build a fresh password system. Keep local environment routing explicit; canonical authentication must not depend on an experimental flag that falls back to Firebase when absent.

Retarget profile and addresses to existing canonical clients and widgets. Audit profile subcomponents and counters so replacing the top-level gate does not leave Firestore calls behind. Reset all account-scoped state on switch/logout and protect against delayed responses from the previous buyer.

Exit: a new synthetic buyer signs in from the ordinary app entry and uses canonical profile/addresses without any Firebase token or account. Local identity credential creation may use the existing supported local flow; no Firebase credential request is permitted.

## R1.3 — Firebase-free startup and supported navigation

Remove Firebase.initializeApp, Firebase-specific boot dependencies and deferred FCM/analytics setup. Replace required guest product/category reads with the canonical repository. Retire Firestore-backed banner/provider wiring rather than continuing to polish a component slated for removal; reuse error-handling lessons on the surviving data path.

The owner asked to remove Firebase, so do not silently retain Firebase Messaging as an exception. Keep canonical in-app notification behavior where available. Record replacement remote-push delivery as an explicit future capability decision if no approved non-Firebase transport already exists; do not choose and integrate a new vendor simply to keep a push icon looking complete.

Remove unsupported template screens/actions from active navigation or give a deliberate truthful unavailable state appropriate to the product. Do not leave a route that launches a removed provider. Required future features remain in the roadmap and capability matrix, not as pretend working buttons.

Exit: guest launch and every active route in this foundation scope run without Firebase initialization, calls or provider lookup crashes. Empty owned catalog data produces an honest empty state, not fake content or an unexplained error banner.

## R1.4 — remove obsolete SDK/config/build dependencies

Remove unused Firebase package declarations, exports, generated configuration, native plugins and startup/background hooks from the active marketplace dependency closure. Decouple shared models from Firestore-specific serialization where they are consumed by canonical APIs. Remove the obsolete Flutter-web target through the already-reviewed branding changes where appropriate.

Account for shared pub-workspace dependencies: another deferred app keeping Firebase in the workspace lockfile is not proof the marketplace release still links it. Conversely, removing direct dependencies alone is not proof that transitive Firebase plugins disappeared from the marketplace build. Verify the resolved app dependency/plugin graph and packaged APK.

Do not remove Google Maps or unrelated Google libraries merely because their names resemble Firebase. Preserve Android application ID, version/signing policy and signing assets. Keep historical evidence/archive references truthful; no repository-wide string purge. Shared backend compatibility routes can remain only with named remaining consumers or a documented separate retirement owner; the marketplace must not call them.

Exit: no Firebase SDK/plugin/bootstrap/config is required by the active marketplace artifact; dependency evidence and startup tests agree. Retire now-obsolete secret exceptions and update enforcing tests instead of accumulating suppressions.

## R1.5 — real Android proof, remaining local work and closure

Rebuild/install the actual changed app on the owned emulator. Verify:

- Guest launch, honest discovery and normal canonical login entry.
- Local canonical registration/sign-in, PKCE consent/callback and profile edit.
- Address create/read/edit/default/delete through UI, matched to canonical backend records.
- Force-stop/relaunch session restoration; logout and supported sign-out-everywhere.
- Two-buyer switching with no stale profile/address data; cross-buyer denial through real HTTP/backend boundaries.
- Firebase configuration absent and no Firebase initialization/network dependency during these flows. Use dependency inspection plus instrumented/runtime evidence, not an unqualified claim from a clean logcat alone.
- Relevant Flutter/Dart/API/validator tests, including meaningful negative controls and exact passed/skipped/todo counts.
- Preserved app identity/signing, owned data and prior work; safe restart and honest local port-isolation status.

Android domain association remains separate. Prepare/verify local source and certificate matching; no deployment is authorized. Match the fingerprint to the actual distribution signing certificate; do not assume an upload certificate always equals Play's signing certificate. Hosted association can remain blocked without creating a Firebase blocker again.

Full Phase 1 closure still requires all mandatory local acceptance. Report hosted association and any other residual gaps separately and precisely. Do not report physical-device, provider, production or encrypted-data coverage that was not performed.

## Updated programme order

1. Review and reconcile the existing Phase 1 and branding work.
2. Execute R1.1–R1.4 as the Firebase-free marketplace composition cutover.
3. Execute R1.5's normal canonical Android journey and close remaining feasible Phase 1 checks.
4. Continue Phase 2 with cross-channel identity/authorization and merchant/operator work, reusing the now-proven canonical buyer entry.
5. Keep Phases 3–11 for their accepted commercial, merchant, catalog, review, reels, checkout, settlement, advertising and operational outcomes. Phase 7 no longer inherits a live marketplace Firebase runtime; it still owns completion of canonical reel/media functionality.

The next implementation prompt must be titled “Phase 1R — Firebase-free marketplace foundation and canonical Android closure.” It must incorporate the no-real-users/no-Firebase-migration decision, include all six packages above, and replace the old Firebase-credential instructions. One agent. No automatic deployment, push, production payments, hosted-project deletion or backup removal.
