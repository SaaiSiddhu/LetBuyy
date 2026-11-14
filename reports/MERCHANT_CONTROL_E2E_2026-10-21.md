# Merchant web, native and Console control verification — 21 October 2026

The merchant operations workspace is implemented and locally verified. Operators can find a merchant, inspect its actual catalog, historical orders, effective SaaS access, verification status and current usage, open its support queue, and use the existing independently approved suspension/restoration workflow. Merchant web has real browser evidence; native has strict analysis, all 358 tests and a compiled Flutter entrypoint bundle. APK/plugin compilation and a normal phone journey remain unverified.

This is a bounded merchant-control pass, not acceptance of every merchant feature or the complete foundation programme. It extends the earlier [four-priority implementation](MERCHANT_OPERATIONS_PRIORITIES_2026-10-21.md).

Working position: `/Users/saai_mithra/Projects/Start_Up/LetBuyy`, `develop`, source HEAD `118209b4fde1b5a15313f4741bcac454690d15c8`, uncommitted working tree. The owner selected both merchant web and mobile for verification. No commit, push, merge, deployment or restored developer-database mutation was performed.

## Delivered operating capabilities

| Capability | Merchant and operator behavior | Authority and limits |
| --- | --- | --- |
| Merchant discovery | Store directory and merchant search link directly to the operations workspace. The protected owner/profile view remains available separately. | Existing Console session and role controls. Search explicitly describes its 25-record bound; directory supplies pagination. |
| Catalog inspection | Search product names, filter canonical statuses and paginate exact site-scoped results. Display SKU, catalog price and last update. | Read-only Console projection. Merchant product editing remains in the canonical merchant API and UI. |
| Order evidence | Search order numbers; filter all canonical states, including Pending COD, Returned and RTO; open paginated original order lines with recorded name, SKU, quantity and price. | Reads stored order-item evidence through the canonical normalizer, with no current-product join. Console cannot edit the order. Foreign-store order IDs return 404. |
| SaaS access | Show the effective persisted plan, trial dates, features and limits from the same resolver used by merchant creation checks. Surface product counts above the effective limit. | No manual paid label, plan grant, quota override or additional billing authority. Failed resolution says unavailable; it never infers a free plan. A null canonical limit displays “No limit.” |
| Verification and usage | Show up to 25 recent KYC document-status observations, explicit sandbox/live mode, and up to 50 current-period usage meters with their dates. | Private files and metadata are excluded. Empty and unavailable sources have distinct states. This is a bounded status sample, not a claim that verification is approved. |
| Support and safety | Direct site-filtered support and safety links; previous work supplies the connected merchant/Console thread. | Existing support permissions and canonical ticket storage remain authoritative. This pass adds no broadcast, message-delivery or provider-acceptance claim. |
| Suspend and restore | Preserve the existing request, independent approval and execution workflow, with visible suspension/publication impact. | Fresh actor/session/permission and target-state checks remain intact. Restoration requires its own approval and does not republish a draft. |
| Read-only assistance | Replace the misleading “Start read-only impersonation” launcher with a real “Open read-only merchant workspace” link. Existing recorded assistance sessions remain visible and can be ended. | The old launcher created a session marker without a consuming merchant view. No merchant credential, write impersonation or new authentication system was introduced. |

Gateway owns four new read routes beneath `/v1/internal/console/merchants/:id/operations`: summary, products, orders and one order's lines. Every route binds the current human operator and checks `merchant:view`; bridge transport alone is insufficient. Reads are no-store, mandatory-audited and sanitized on failure. Commerce lists have stable ordering, bounded pagination and exact site predicates. Shared projections use canonical Product, Order and LineItem contracts.

The Console page is a thin server-rendered composition of these contracts. No new runtime, schema migration, Next API proxy, provider, wallet or parallel entitlement system was added. The app API inventory remains at 224 records. This follows AUTH-R1, ARCH-R1/R11–17, CODE-R1–4/R9 and WIN-R4/R6.

## Merchant mobile repairs and verification

Placed orders now show “Order snapshot” instead of an Edit action that the protected server correctly refuses. Return, refund and lifecycle actions retain their existing paths. The full native suite includes the updated read-only snapshot assertion.

The support screen continues to use the canonical owner-scoped support contract. Five new real Flutter widget/storage/transport tests cover failed-read retry, a lost committed reply with the same original key and body, encrypted pending-intent restoration after restart, known refusal preserving input, and account/store-switch isolation. Their transport is explicitly synthetic; these tests do not claim a phone-to-Gateway journey. They exposed a real narrow-screen overflow in the pagination row, repaired with wrapping controls. Secure storage keeps its production default and has a narrow constructor seam for these tests.

The machine initially had no Flutter SDK. A temporary checkout of the official stable Flutter source and an isolated pub cache enabled actual compilation and tests without changing the primary workspace's environment or dependency lock. The verified SDK is Flutter 3.47.7 / Dart 3.13.5, framework revision `abaf9c523780a608bd46686fd5e53740a07077f8`. The full app entrypoint compiled for `android-arm64` in debug bundle mode: 22 kernel/asset files, 109,044,054 bytes. This artifact is **not an APK, native-plugin compilation or device execution**.

The attempted next step was a temporary, checksum-verified official Android tools/JDK download. Automatic approval review could not complete because its usage limit was reached; the download was not executed. No alternative path bypassed that review. APK and physical/emulated-device verification therefore remain open.

## Executable evidence

| Check | Result | Evidence boundary |
| --- | --- | --- |
| New merchant workspace database/worker cases | 5/5 pass | Real mounted Gateway, PostgREST and owned PostgreSQL: exact counts, persisted SaaS, safe KYC, filtering/pagination, owner catalog edit with unchanged historical order lines, failure handling, mandatory audit, foreign-store denial, transport-only denial and live operator revocation. |
| New Console browser journey | 1/1 pass | Normal magic-link/TOTP login; profile-to-workspace navigation; 27 products across pages; search/status filtering; Pending COD order filter; original item names; foreign-order denial; SaaS outage/recovery; 390px overflow check. |
| Merchant web product journeys | 6/6 pass | Normal Identity/merchant login with real versioned edits, stable variants/zero stock, stale-draft recovery, committed lost-response recovery, changed-account refusal and live owner/staff revocation. Existing development-runtime fixture, not a production-browser claim. |
| Existing protected moderation browser | 1/1 pass | Two independent normal MFA operators, request retry with the same key, independent approval, execution and replay producing one effect. |
| Existing protected moderation worker/database suite | 21/21 pass | Includes independently approved restore, no draft republication, wrong-action/target mismatch, current-permission checks and injected failures. |
| Focused merchant Console/source and command-history checks | 14/14 pass | Includes the honest assistance launcher contract; no money or approval guard was weakened. |
| Console read-parameter, MFA and CSV checks | 12/12 pass | Existing focused unit tests. |
| Full merchant native suite | 358/358 pass | Flutter tests, including the five new support cases. No physical device. |
| Strict native analysis | Pass, no issues | `flutter analyze --no-pub`. |
| Native app entrypoint bundle | Exit 0 | `flutter build bundle --debug --no-pub --target-platform=android-arm64 --target=lib/main.dart`; kernel/assets only. |
| Console production build | Exit 0 | Next.js compilation, TypeScript and page generation; new dynamic operations route included. |
| Gateway, Console and shared-types typechecks | Pass | Final Gateway and Console source checked after the item-name and canonical-filter repairs. |
| Focused Console ESLint and whitespace | Pass | New workspace plus touched profile/directory pages; `git diff --check`. |
| Targeted governance | Pass | Tenant isolation: 317 registered tables, zero direct service-role bypasses; domain boundary: 224 route records; session security; declared imports; unchanged design-system ratchet. |

Final workspace run `58f66e5aa0f5`: 6/6 pass, zero skips/cancellations/failures. Prior acceptance run `713fc6fcc27c`: 27/27 pass, including the 21 protected moderation cases. Both report no remaining owned containers, networks or volumes and no cleanup failure. The six merchant-web cases are the passing suite in `698ab777caf7`; that earlier aggregate was red because the then-unfixed new workspace browser failed. The approval browser was repeated successfully in `652cc5346452`; that aggregate likewise retained the subsequently repaired workspace failure. Only those individually passing suites are reused, not a claim that the earlier aggregate runs passed.

The new browser initially exposed blank original item names because the canonical normalizer returns `title`. The route now maps that field explicitly, and the database assertions check the exact historical name, unit price and total. Initial test-fixture signature/type and SQL transport mistakes were repaired rather than bypassing real middleware or canonical product guards. Native overflow failures and earlier logs are retained separately from final passes.

All multi-runtime tests use a disposable, fingerprinted source copy excluding environment files and generated outputs, with existing installed workspace dependencies reused. The final Console build and workspace browser/database tests used the same source snapshot. The copy contains 9,967 source fingerprints; evidence metadata is in `MERCHANT_CONTROL_E2E_2026-10-21.json`. Raw logs and viewport captures remain under `/private/tmp/letbuyy-merchant-control-e2e-20261021/`. Desktop and narrow viewport captures were inspected; the browser asserts record behavior independently. This is dirty-tree source evidence, not clean-commit or hosted certification.

## Remaining acceptance

1. Provision the Android toolchain after approval review is available, build the actual debug APK and complete an owned device journey through login, catalog editing, read-only orders and support recovery. iOS plugin/device verification is also outstanding.
2. Migration 370 from the earlier support task remains tested only in disposable databases. Controlled database application and hosted verification are still required before shipping those support commands.
3. Run release gates and hosted/operator/provider acceptance against a reviewable release candidate. This pass ran the relevant targeted validators and behavioral suites; it does not certify the full repository or every merchant feature.

Existing dirty work and developer environment files were preserved. The paired receipt records original-file hashes, intentional overlaps, command/log hashes and source fingerprints. No parent phase is marked accepted, no financial authority changed, and no real email or provider transaction was sent.
