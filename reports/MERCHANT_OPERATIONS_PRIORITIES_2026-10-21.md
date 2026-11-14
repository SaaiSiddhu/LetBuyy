# Merchant operations priorities — 21 October 2026

> Later 21 October verification supersedes this report's native source-only limitation: a temporary official Flutter SDK enabled strict analysis, all 358 native tests and an Android-targeted kernel/assets bundle. APK/plugin and device proof remain open. The new Console merchant workspace and additional merchant-web/approval evidence are recorded in [Merchant control end-to-end verification](MERCHANT_CONTROL_E2E_2026-10-21.md). The original results below remain dated history.

## Result and scope

The four owner-selected priorities are implemented in the current working tree:
historical order protection, site-specific billing with truthful payment labels,
merchant/Console support, and actual published theme release metadata. Web and
Gateway behavior have local executable evidence. Native support is implemented
in source but has no build or device verification on this machine.

Checkout: `/Users/saai_mithra/Projects/Start_Up/LetBuyy`, branch `develop`, base
HEAD `118209b4fde1b5a15313f4741bcac454690d15c8`. Changes remain uncommitted.
The original 69 dirty files were fingerprinted before work. All remain present;
64 retain identical contents. The five intentional overlaps are the Console
merchant detail, API transport, shell navigation, Gateway Console overview and
operator-workspace facade. Existing changes in those files were extended, not
reset. No environment file, restored developer database or unrelated Docker
resource was changed.

## Delivered behavior

| Priority | Result | Evidence |
| --- | --- | --- |
| Historical orders | A placed order's item mutation endpoint returns `409 ORDER_SNAPSHOT_IMMUTABLE` after ownership and staff checks. Canonical drafts remain the editing route before placement. Existing return/refund commands remain separate. | A real checkout-created order retains identical API data and stored snapshots after its product is renamed, repriced, assigned a new SKU, deactivated and soft-deleted. Repeated item-edit attempts cannot write; a foreign site is denied. |
| Billing | Merchant 360 selects subscriptions by the exact site, excluding deleted rows; a newer sibling-store subscription cannot win. Merchant billing counts only `paid`/`succeeded` payment statuses as paid. `issued` and `active` are excluded. Recent-order value is explicitly a sample, bounded at 500 orders. | Owned two-store regression plus focused payment-status and billing tests. No pricing, fees or commercial policy changed. |
| Support | Merchant web can create, read and reply to its owner-created tickets. Console has a searchable paginated queue, public replies, internal notes, permission-aware controls and resolution. Merchant 360 links to the site-filtered queue. Both web screens show unavailable states on failed reads and recover after connectivity returns. | Normal merchant password sign-in and normal Console magic-link/MFA sign-in complete a single real ticket journey. Private notes never enter the merchant projection. Read-only operators and foreign stores cannot write. |
| Published themes | Merchant 360 reads the site's current, published, undeleted release using the buyer reader's selection predicates. It shows release ID, theme ID, version and whether the site pointer agrees. Installation order does not stand in for publication. | Owned no-release, foreign-release and pointer-mismatch/consistency cases. No publisher or renderer behavior was changed. |

Support uses the existing `support_tickets`, `ticket_messages`, SLA clocks,
mutation receipts, audit log and transactional outbox. Migration **370** adds a
narrow service-role-only owner command; it does not create another ticket store.
Authority is rechecked before receipt replay, and ticket/message/audit/outbox/
receipt effects commit atomically. A changed intent cannot reuse a committed
key. The original web request key is forwarded through the API client instead
of allowing a second automatic key. Recovery reads the committed receipt.

Merchant projections contain only public messages and safe ticket fields.
Internal notes, private metadata and attachments are excluded at the query
boundary. Merchant staff access is not implicitly granted. The existing support
clock defaults are reused without advertising a contractual SLA or 24/7 service.
Saving a message does not claim notification delivery or privacy fulfillment.

The Flutter Help screen now opens the same owner-scoped support API. Its pending
intent is stored with the existing secure-storage plugin under an account/site
namespace; context changes retire stale responses. This remains source-only
evidence until Flutter analysis/build and a normal device journey are run.

## Verification

Every final suite below exited 0, with zero failed, cancelled, skipped or TODO
cases. Counts describe these suites only, not whole-platform acceptance.

| Check | Fresh result |
| --- | --- |
| `merchant-operations-priorities.postgres.test.ts` through the owned Gateway/Postgres runner | **6/6**, run `90aa10d64d2f`; real schema through 370, historical catalog changes, tenancy, publication, support, concurrency, lost committed response, mandatory-audit rollback, live ownership revocation, function privileges and DOWN/UP preservation |
| `merchant-console-support-browser.postgres.test.ts` through the owned runner | **1/1**, final layout run `88cad89d7845`; real browser/auth/Gateway/Postgres, public/private separation, resolution, actual network-offline recovery and 390px overflow checks |
| Payment status, billing-core, orders-v1, internal support, Merchant 360 and operator authorization tests | **32/32** |
| `tests/governance/session-security-validator.test.mjs` | **61/61**, including four added negative controls for the existing extracted Console bridge |
| `tests/federation/app-api-route-ownership.test.mjs` | **6/6** |
| Gateway, Merchant web, Console and shared-types TypeScript | Pass |
| Focused Merchant/Console ESLint | Pass, zero warnings |
| Console optimized production build | Pass; `/support` and its BFF appear in the build route inventory |
| Migration safety, tenant isolation, domain boundaries, session security, dependency imports and design-system ratchet | Pass; route inventory and lint baseline both 224; tenant scan 317 registered tables, zero direct service-role bypasses |

The browser's Identity and Merchant runtimes are production builds; the Console
browser runtime uses its existing development fixture. Console also has the
separate successful production build above. These are local fixtures, not hosted
or provider acceptance. Turnstile uses its existing official test credentials;
magic links are captured locally. No real email or provider transaction is sent.

The browser launcher correctly refused the original checkout's environment
files. Tests instead used a disposable source snapshot under
`/private/tmp/letbuyy-merchant-priorities-20261021/candidate`, with 9,959 source
files fingerprinted, environment/build output excluded, and installed workspace
dependencies reused. Original environment files were preserved. The final
historical-order suite ran against the current primary source. After browser
capture, two decorative message corner-radius classes were removed to satisfy
the unchanged design-system ratchet; behavior was unchanged and that validator
was rerun green. The browser snapshot/build therefore precede this cosmetic
removal. No exact clean-commit certification is claimed.

Desktop and 390px screenshots were inspected; both retain their host identity,
separate controls and readable message spacing. Synthetic captures are in
`/private/tmp/letbuyy-merchant-priorities-20261021/screenshots-final/`.

Commands, counts, source fingerprints and log hashes are recorded in the paired
`MERCHANT_OPERATIONS_PRIORITIES_2026-10-21.json`. Raw logs stay in the controlled
temporary evidence folder. Owned runner exit 0 also verifies no remaining
run-labelled containers, networks or volumes and no cleanup failures.

## Failures found and repaired

Earlier runs remain as dated local evidence. They exposed a fixture using a
nonexistent `users_custom.deleted_at` column, an invalid positive-paid seed that
correctly hit the canonical billing writer guard, an inaccessible audience label,
and conflicting forwarded/automatically generated request keys. Those failures
are excluded from the final passing verdict. A read failure returning HTTP 200
and false-empty UI states were also corrected. No guard was bypassed to obtain a
pass.

The session-security validator previously inspected an inline Console transport
guard even though existing work had extracted that guard into `consoleBridge`.
It now follows the actual import and mounted middleware body, retaining token,
missing-configuration and route-order checks. Four mutation controls demonstrate
that disconnected, mis-imported, unconfigured or permissive guards fail.

The two finite support BFFs are registered together in the app API inventory and
lint baseline (222 → 224), following the existing reviewed `gateway-proxy` class.
All domain behavior remains in Gateway/Postgres. No validator was disabled and
no design-system baseline was increased.

## Remaining limits and next step

- Migration 370 and its paired rollback were exercised only in disposable
  databases. Neither was applied to the developer's restored database or a
  hosted environment. Support needs 370 in its target database before rollout.
- Flutter/Dart are unavailable on this machine. Native compile, widget tests,
  secure-storage restart proof and a normal device journey remain unverified.
- Web pending requests retain their original key during an in-page uncertain
  outcome. Full page/tab restart persistence is not implemented or claimed;
  saved tickets remain discoverable in the queue.
- The native legacy placed-order Edit control still relies on the server's
  explicit immutable-order refusal. A native UX cleanup needs SDK verification.
- Attachments, merchant-staff support grants, CSAT/reopen policy, notifications,
  provider acceptance and hosted publication verification are outside this
  bounded delivery. The surrounding programme remains open.
- Nothing was merged, pushed, deployed or formally accepted. Next: verify the
  native journey with an available SDK/device, then perform the separately
  authorized migration/release and hosted checks.
