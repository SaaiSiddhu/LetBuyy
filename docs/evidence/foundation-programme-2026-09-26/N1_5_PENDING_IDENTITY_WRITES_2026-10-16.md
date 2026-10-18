# N1.5 pending local cart/wishlist identity writes — 16 October 2026

Current scoped source correction and unit/widget verification; actual current APK/device proof remains required. N1.5/N1 and the programme are open. Existing63 execution,77 acceptance and103 feature dispositions are unchanged. No backend, identity issuer, app ID, signing, deep-link identity, Firebase path or cross-device sync was added.

## Reproduced defect

The actual supported marketplace client wires its canonical buyer ID into the existing local cart/wishlist providers through `ChangeNotifierProxyProvider` in `main.dart`. Although each provider serialized operations, `updateUserId` changed the mutable active ID immediately, before older queued mutations ran. Each mutation then read that later ID when selecting its preference key. A pending A mutation could therefore save A's existing items and new item in B's key. Additionally, getters and product-card/badge consumers exposed A's data while B's namespace was loading.

All four original regression cases fail in `N1.5/pending-identity-reproduction.log`. They run the real providers and serialization code with an explicitly in-memory SharedPreferences platform store, not a device. The first cart/wishlist failures show B receiving both `private-a` and `queued-a`; the other failures show immediate getters retaining the prior buyer's records. Original provider sources are saved under `N1.5/pending-identity-before`.

## Canonical local correction

The existing providers now bind each mutation to the buyer ID and identity generation at submission. A switch clears visible state/error synchronously and schedules the next namespace read in the existing queue. Queued stale commands refuse before mutation; generation checks before storage submission and after its result prevent late state/error/success from reaching another identity. The storage key is captured for the original buyer, so a platform write already in flight can complete only in that buyer's namespace. A late load cannot clear the newer loading state. An A→B→A round trip cannot authorize a command from A's earlier generation merely because its buyer ID matches again.

The existing guest-transfer receipts, deduplication, cart quantity rules, durable completion markers and namespace keys remain intact. No new local owner or backend integration was introduced in the bounded compatibility package.

## Product-detail consumer correction

The affected UI also retained a separate `_isInWishlist` flag. Two additional widget regressions reproduced the mounted detail keeping A's saved heart after a buyer switch and displaying a saved heart when the actual storage write failed. The executable reproduction passes the three retained detail-availability tests and fails both new assertions. The earlier attempt omitted a required synthetic product stock field and remains a compilation diagnostic, not behavioral proof.

Details now render the existing provider's live membership, check its actual save result and suppress UI continuations from another identity revision. Its normal wishlist control has a descriptive tooltip. Buy Now now replaces the cart through the same single captured-identity write, rather than clearing and then adding across two awaits; a failed replacement preserves the prior cart. Focused cases cover replacement quantity, failure conservation and a queued replacement refusing B. No checkout or provider effect is claimed.

## Current verification and limits

- The four original provider regressions failed before correction; both new product-detail regressions also failed before its UI correction.
- Final complete client run passes52/52 across seven provider/widget files. This retains guest-transfer, interrupted transfer, failed storage, queued/in-flight writes, rapid A→B→A, exact namespace readback, eligible-feed revalidation and offline behavior. The focused consumer/race run passes15/15; analysis of all five affected Dart source/test items reports zero issues. Gateway typechecking includes the new real-device fixture and passes.
- One added widget fixture waited across fake/real test clocks and was explicitly interrupted after confirming its exact live process. Its CLI exit0 is not a passing verdict. Correct test-clock pumping preserves the assertions; the subsequent15/15 and52/52 runs are the complete current evidence.
- The final current APK compiled successfully, remains `com.letbuyy.letbuyy`, version4013 / `1.0.10-debug`, and targets Android ARM64. SHA256 `de4eca0a89be753c8f52e77df1699ed69382305125463cc3cfe5f70e30784348`. Artifact: `/private/tmp/letbuyy-n1-android-84e03402b4/marketplace-namespace-de4eca0a89be753c.apk`. The device fixture independently hashed the installed package bytes, not only the host file. The earlier006af9d8 build predates this UI consumer correction and was never device-certified.
- Actual Android35 ARM64 run `f34feae09e63` passes1/1 with no failed, cancelled, skipped or TODO tests,76 real backend requests, two normal browser registrations/PKCE callbacks, and nine independent device-disk stage checks. No positive session, cookie, callback or token is injected.

The device journey saves a guest product into both local stores, signs in A normally and verifies both A stores remain empty until explicit Move actions. Guest contents then transfer into A and disappear from guest. A adds a second product; both populated stores survive a real process force-stop/restart. Device logout returns to an empty guest namespace without losing A's disk records. B registers through the normal different-account/browser/PKCE flow, sees empty stores, saves only B's product and restores that same isolated data after another actual process restart. The fixture reads the real debug application's Android preference file independently after every stage, deriving owner IDs from the actual registered database subjects and checking exact product sets. Stage markers alone cannot advance it.

Products are eligible synthetic display fixtures approved through existing database transitions; this is not merchant-review, checkout/payment or lifecycle acceptance. Initial controller attempts hit transient UIAutomator output and an incorrect assumed Add-button label. The controller resumed from the actually observed already-saved guest detail; no product source, backend fixture or data reset occurred. Logs and driver originals are retained. This is a supervised device fixture, not an unattended CI claim.

The provider tests use a controlled in-memory platform store and the widget feed uses controlled API responses. The actual Android result separately proves real on-device storage, normal UI and process restart. It is an emulator, not a physical phone or Play distribution. Official Cloudflare test keys use the real transport with application bypass disabled; inbox/provider/production anti-bot and hosted results remain separate and unverified.

Artifacts and hashes are in `N1.5/namespace-native-evidence-f34feae09e63/manifest.json`. A's populated restarted cart/wishlist and B's empty/restarted wishlist screenshots were visually inspected. The runner reports empty owned container/network/volume cleanup. Only newly created emulator5580 was stopped; its private files, all previous AVDs and the shared ADB server remain preserved.

The source correction and affected connected local/device journey are scoped verified. Full N1.5/N1 and the original63/77/103 programme remain open for wider supported-scope/provider/hosted requirements. Continue current baseline/accepted-scope reconciliation using existing evidence; do not rerun this unchanged journey or treat it as whole-phase completion.
