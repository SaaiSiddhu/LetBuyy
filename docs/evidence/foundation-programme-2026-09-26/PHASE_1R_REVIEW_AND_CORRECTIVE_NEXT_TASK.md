# Phase 1R review and corrective next task

Reviewed 26 September 2026 against worktree ../LetBuyy-phase1r, branch letbuyy/phase1r-firebase-free-marketplace, HEAD 9a66ebcf. Read the two supplied implementation transcripts and the user's final paused-device report. This review inspected source/Git and read-only host metrics; it did not rerun suites, inspect a freshly built APK, restart services or interact with the paused emulator.

## Verdict

Preserve the useful implementation. Do not accept full R1.0–R1.4 closure, merge as completed, or move to Phase 2 yet. The source establishes canonical authentication progress and removal of Messaging/Analytics, but not a Firebase-free marketplace app. The next task is a corrective continuation on the existing phase branch, followed by controlled native verification.

## Verified facts and corrections

- The phase worktree is clean at 9a66ebcf. The primary develop checkout remains at 6eb01d95 with its original uncommitted Phase 1 changes and untracked evidence. Reconciliation exists on the phase branch; it has not magically cleaned or updated develop. Do not reset the primary checkout or delete either worktree.
- Canonical buyer controller wiring is unconditional; profile no longer requires the old Firebase login. Firebase account-linking bridge was removed. These are useful code changes, but the ordinary complete native sign-in/profile/address journey remains unverified.
- Messaging/Analytics and their boot hooks were removed. However, both app and marketplace_services pubspec files still directly depend on firebase_core, firebase_auth, cloud_firestore, cloud_functions and firebase_storage. Android app/build.gradle still applies com.google.gms.google-services.
- main.dart still registers legacy AuthProvider, UserProvider, ProductProvider, CategoryProvider, OrderProvider, CartProvider, WishlistProvider, AddressProvider and other inherited providers. Replacing eager Firebase fields with lazy getters defers access; it does not remove the dependency.
- New firebase_safety.dart catches FirebaseAuth access errors and returns null. This prevents selected crashes but treats unavailable Firebase as signed-out legacy state while canonical identity may already be signed in. It is not the intended final authentication/data design.
- ReelsFeedScreen state constructs ReelService at line 97. ReelService's constructor accesses FirebaseFirestore.instance and FirebaseStorage.instance at lines 20–21 before the screen's build method. With no initialized Firebase app, this is a concrete construction-time failure path. It is a strong candidate for the reported Reels error; runtime reproduction remains required before claiming the observed error's exact cause.
- MarketplaceRepository already exposes feed, categories and listing through canonical ApiClient. Its comments include obsolete statements about migrations not being applied; restored local migrations were previously recorded through 260. Comments are not current database or endpoint evidence. Do not infer that all shopping capabilities lack canonical successors from one old comment or the number of migrated screens.
- Reported gate output had ambient lint and contract failures. “Gate green” is not an accurate global verdict unless a later exact-artifact run proves those checks passed. Test counts and APK packaging success also do not prove Firebase absence.
- Dependency removal introduced incidental lockfile upgrades according to the transcript. Review the changed graph and minimize unrelated churn with supported resolution; generation alone does not make every version change necessary.

## Resource and emulator assessment

Pausing repeated reboot attempts was reasonable. The evidence does not prove that resource contention alone caused the reboots, nor that every app error is an emulator issue. Load averages/free-memory snapshots are not an OOM diagnosis; examine memory pressure, swap/compression, host/emulator crash and boot records before claiming one.

The read-only review snapshot showed load averages 45.25/38.79/32.29 and memory_pressure reporting 41% system-wide free percentage. These are transient and use different measurements from the earlier report's 115 MB figure. They do not establish stable readiness or a specific guilty process. No other session was stopped.

Keep native testing paused until a controlled window is available. Source/dependency work and bounded tests can proceed independently. Avoid another full gate, Gradle build, several app servers and emulator launch all running concurrently. Stop only attributed owned processes when authorized; never kill unrelated Claude/EDYNOX sessions.

## Corrective continuation sequence

### C1 — freeze the evidence baseline and correct status

Use the existing phase branch at its actual current HEAD; preserve any newer work. Record old versus current gate results, active source/runtime versions and pending changes. Reopen R1.3/R1.4 as partial and keep R1.5 incomplete. Store a durable feature-disposition matrix and corrective report rather than relying on temporary transcript claims.

Screenshots/logs currently exist in /tmp/phase1r-r15-evidence. Preserve relevant evidence to a durable phase location before temporary files disappear; review/redact account identifiers and logs. Keep originals where private and avoid staging raw logs automatically.

### C2 — finish active app composition and capability mapping

Map each reachable route/provider to an existing canonical API or a named later-phase capability. Reuse existing feed/category/listing, identity/profile/address contracts. Inspect other buyer/cart/order clients and server routes individually before declaring a capability unavailable. Avoid building a second backend.

Required foundation surfaces must use canonical data/session state. Remove legacy providers from the active composition, navigation and shared-package exports. For functionality deliberately completed in later phases, disconnect the obsolete Firebase implementation and expose an intentional unavailable state or remove its action from active navigation. Do not turn transport failures into successful empty data, and do not claim later product functionality is complete.

Replace the active Firebase ReelService path rather than adding more try/catch wrappers around it. A nonfunctional legacy reel feed is not worth preserving while full canonical reels belong to Phase 7. Retain that accepted product requirement in the roadmap. Remove obsolete client-side advertising/billing hooks with the retired path; later advertising retains the accepted server-authoritative models.

### C3 — complete Firebase SDK/native removal

Remove Firebase Core/Auth/Firestore/Functions/Storage from the active marketplace dependency closure after their consumers are removed or replaced. Remove firebase_safety helpers when no longer needed. Separate shared canonical contracts from legacy implementation packages where necessary, within existing package governance. Do not break unrelated app consumers or assume a shared workspace lockfile must contain zero Firebase strings.

Remove unneeded native Google Services configuration/plugin hooks, then verify resolved marketplace plugins/dependencies and the actual packaged artifact. Preserve Google Maps and unrelated Google integrations where still needed; names alone do not establish Firebase dependency. Preserve package ID, signing assets, backups and hosted projects. No Firebase credential, customer migration or Firebase reinitialization is part of the solution.

Exit requires zero Firebase requirement in the active marketplace app, not merely successful boot with Firebase errors caught. Add a meaningful architecture/dependency check to prevent reintroduction, scoped to the app's real graph rather than historical documents.

### C4 — meaningful tests before another emulator session

Add boot/composition and active-tab tests which construct the real app dependency tree without Firebase. The existing 57 passing tests did not exercise this failure mode. Include returning canonical session, signed-out state, cross-buyer stale-response protection and error-versus-empty behavior. Keep relevant existing suites and actual failures visible.

Reproduce the Reels constructor failure with a focused test where useful, then prove the retired/replaced path no longer constructs Firebase services. Do not require DevTools before investigating a directly visible constructor path; use debugger/stack capture if the unexplained runtime failure remains afterward.

Build once from the corrected artifact using localhost identity/API URLs with adb reverse. The 10.0.2.2 identity rejection was already documented and should not trigger another security exception or wasted build.

### C5 — controlled native and backend closure

Use one implementation session and only the owned services required for the test: identity, gateway and local database. Do not run a fresh build and heavyweight governance gate during the interactive journey. Establish stable emulator boot/package manager first; if instability recurs, capture diagnostic evidence rather than repeatedly rebooting without a changed hypothesis. A physical Android device can be used if available, but is not assumed.

Ensure identity/gateway run the intended compatible source. The report reused servers from primary develop while the APK came from the phase branch; record those revisions or run verified phase-branch servers on explicitly owned ports. A health 200 does not identify backend source.

Execute normal guest launch → canonical registration/sign-in → consent/callback → profile edit → address CRUD/default → restart/session restoration → logout/revocation → Buyer A/B switching, with backend ownership assertions. No Firebase account or injected token. Verify each active tab and safe failure states.

Record APK hash/build inputs, actual installed package/signing identity, frontend/backend/config/schema versions and named device. Keep hosted Android association separate; no deployment is authorized. Stop/retry only on evidence and retain precise missing results.

## Final acceptance and next phase

The corrective task is complete when the active marketplace artifact has no Firebase runtime requirement, required canonical foundation journeys pass, active navigation has no legacy-construction failures, and evidence distinguishes local/device/hosted status. Reconcile any mandatory gate failures without calling them green merely because they predate the phase.

Only then review merge readiness under the owner's actual authority and proceed to Phase 2. Keep all useful Phase 1R commits; do not restart from scratch, build the remaining ten phases during cleanup, delete backups or change hosted systems.
