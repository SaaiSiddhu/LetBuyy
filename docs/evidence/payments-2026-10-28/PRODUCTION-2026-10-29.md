# Payments sandbox activation — 29 October 2026

The owner explicitly resumed implementation and production delivery after staging.
The previously approved sandbox candidate `4c3843b812d0cc6ab5f085d13bf146e8627e3b32`
is now activated. This records the bounded release, not completion of the entire
68-item payment programme.

## Source, staging and activation

- Remote develop and staging were re-read at the exact candidate; remote main was
  fast-forwarded from `219654a2cb971f38788cf1f32812eaff23a25729`. No force push.
- Staging's seven exact migration payloads and all earlier history were verified
  again; the 13 bounded health/catalog/directory/denial checks passed again.
  The earlier owned PostgreSQL, security, reconciliation, recovery-rehearsal and
  114-validator evidence remains pinned in RELEASE.md and the accepted review.
- Production migrations 403–409 committed and passed independent readback at
  05:28 UTC. History grew 330 → 337; all original history and the immediately
  preceding theme catalog were preserved. The newer Dewdrop catalog update was
  retained. Public roles cannot execute the four private payment/notification RPCs.
- API version: `a6caaf93-922c-424c-a24b-f3a72a174dcf`.
- Queue version: `4400da32-25ed-4f73-a394-cd229cfc5cf5`.
- Uploaded Worker module hashes match the qualified builds. All bindings and
  secret names were preserved; no secret rotation. Production API has 64 variables
  and Queue has 31, within the existing Free limits.
- Merchant artifact `dpl_6TL4GJwzbeGFiLFWQqumqHfX82Xv` was promoted without a
  rebuild; the actual `admin.letbuyy.com` alias was read back at that artifact.
  Its previous actual alias was `dpl_96oF1yzYCs4zesMcxds9yJKiqhfD`.
- Four newly queued automatic main builds for this exact SHA were canceled so
  unrelated web apps and the prepared Merchant promotion remained controlled.
  No build-ignore, project deployment policy or future-commit suppression was set.
- Production passed the same 13 bounded HTTP checks. Some Python HTTP requests
  incurred roughly 35 seconds of connection delay; direct curl health controls
  completed in 0.28 seconds on staging and 1.31 seconds on production. These are
  observations, not an established production latency SLO or proven network cause.

Private operation receipts, original failures and provider readbacks are retained
under `/private/tmp/letbuyy-payment-system-plan-20261028/`. The original production
attempt stopped before SQL batch submission; the resumed exact preflight passed.
The public theme catalog changed during the pause, while schema history did not.

## Operating and browser evidence

The owner signed into the production Merchant browser privately. Observed:

- QA Payments shows the saved own-account Sandbox connection, separate online/COD
  controls, unconfirmed business/bank verification, and an unavailable managed
  option. No live or partner approval is implied.
- Test and Live payout queries load separately. Both currently return zero
  statements; pagination reads Page 1 of 1. Bank settlement is not confirmed.
- Customers loads two records with no earlier 503 error; no customer records are
  copied into this report.
- All ten catalog themes are visible. Habitat was added as a private QA draft on
  Free; Threadline remained the published theme. No public theme change occurred.
- The QA product has one available unit and zero reserved units. Quantity two was
  correctly refused; quantity one was accepted and reached
  `checkout.qa-wildcard-20261027.letbuyy.store` with the Razorpay test-mode notice.
  No order, charge or refund was submitted by the agent.
- Six existing lifecycle jobs completed through the released Queue transport.
  Database email logs show five Snaz and one Elaxora message as `sent`, with six
  Resend provider receipt IDs. The owner replied **“Emails arrived.”** This is
  user-confirmed arrival, not independent observation of all six inbox messages.
  No historical order-email intents were regenerated or bulk replayed.

The normal notification cron is observed. A domain-maintenance tick reached the
API and advanced a bounded batch with remaining work deferred. Full-cycle
observation is being retained separately; `deferred=true` is not reported as a
complete cycle.

## Checkout return and integrated domain activation

The branded checkout's Back to Cart link returned to the discovery origin instead
of the originating wildcard storefront. Its cart appeared empty because browser
storage is origin-scoped. This is a separate repair, not part of the activated
`4c3843b81` artifact.

The repair carries a navigation-only origin hint derived after the existing
same-origin POST check. The checkout page independently accepts only the verified
site's exact platform host, the configured discovery origin, or its currently
active custom host through the existing signed resolver. It changes no signed
cart fields, payment authority, tenant grant, cookie scope or migration. Malformed,
wrong-site, revoked-domain and resolver-outage hints retain a safe fallback.
The owner approved qualified release `47cc24098be4dbf218746d1512ca28252c210c02`
with its recorded hosted-staging and billing limitations. That release is now
activated:

- Develop, staging and main were fast-forwarded to the exact release, with branch
  lag zero. Migration 410 committed and passed independent history/grant/catalog
  readback (337 → 338 history entries). Both prior 523-table recovery rehearsals
  were retained; no fresh export was needed for activation.
- Production API version `1572d43a-d45c-4e9b-998e-2081ba1035b9` matches the three
  qualified module hashes. The first attempt refused before provider dispatch
  because the required mutation-approval marker was absent; its preserved receipt
  is not deployment evidence. The corrected approved attempt verified the actual
  new version and preserved bindings/secrets, including the 64-variable Free limit.
- Merchant artifact `dpl_CsPyvtbVoWL2yM6cWHvEHqxjyjVv` and the byte-equivalent
  Commerce artifact `dpl_HQktaoNVLqHVz6EVunmh1XcQTGsn` were promoted without
  rebuilding. Their actual custom aliases were verified. Accounts, Marketing and
  Queue were unchanged by this release. Sixteen bounded production HTTP controls
  passed; they do not substitute for signed-in checkout acceptance.
- The signed-in Merchant domain setup now shows both `store.pixlnova.com` and
  **`checkout.store.pixlnova.com`** as HTTPS ready, with the complete DNS/check/
  completion flow. Exact DNS ownership values remain copyable; normal product
  copy uses LetBuyy wording. No apex/mail records or primary-store selection changed.
- A real normal scheduled domain cycle completed across three bounded pages
  (checked 1, 2, 1; deferred true, true, false), response 200/outcome ok. The old
  `checkout.snaz.store.pixlnova.com` and prior platform checkout alias completed
  their finite provider drain; retained history remains soft-deleted and the new
  custom checkout binding remains active.
- QA platform checkout → Back to Cart returned to the exact original store host
  and retained one item/₹1. A fresh Snaz Check/Blue/M cart reached its correct
  custom checkout with one item/₹3; no payment or order was submitted.

The final Snaz return canary found a separate frontend issue: bare custom-domain
`/cart` inferred its store handle from the first DNS label (`store`) instead of
the server-resolved handle (`snaz`). The line and total stayed in origin-local
storage, but canonical readback failed and Reload saved cart stayed blocked.
The same saved cart loaded correctly at `/store/snaz/cart`. A targeted regression
reproduced this (14 existing controls passed, the new custom-host control failed).
The repair carries the server composition's base path into Liquid islands before
custom-element upgrade. Source `8e8c0e1a8` is integrated into develop and staging as
`9dc428b8fb9f4f0350ff60c74aea53135b29b64e`. Its focused 55 controls and the full
Commerce command (2,191 checks across five command groups) pass, with typecheck,
build and 114 governance validators. ESLint reports zero errors and 25 unchanged
warnings outside the repair. These counts overlap; they are not added together.

Hosted staging initially returned HTTP 200 with an unavailable catalog, then a
Liquid `esm_interop` refusal. Neither attempt counts as acceptance. Staging lacked
branch-specific API URLs and the Node compatibility option already used by
production/develop. Only its Commerce preview/staging branch received the public
staging API URLs, environment label and `--experimental-require-module` option;
no secrets were copied and no production settings changed. The final staging
artifact `dpl_ERmxiYVJBW3TmV6tH71qi8xoc5ZW` passed eight bounded controls,
including actual Circuit rendering with the resolved store context and preserved
internal-route/buyer-session refusals.

The owner explicitly approved this exact Commerce-only candidate and its TEST-R8
limitations. Artifact `dpl_GXMYgDQibiBcisQCaqUwkS5Yw8Wt` was promoted without
rebuilding and its actual production alias was independently verified. Remote
develop, staging and main all reached `9dc428b8fb9f4f0350ff60c74aea53135b29b64e`,
with branch lag zero. Four redundant automatic main builds for that exact SHA
were canceled before changing the reviewed custom aliases; no project build
policy changed. Merchant, Accounts and Marketing custom aliases were unchanged.
No Worker, migration, credential, payment rule or DNS record changed in this
cart-only activation. The prior Commerce artifact remains the recovery target.

Production browser acceptance now passes:

- Snaz's existing Check/Blue/M cart loads on `https://store.pixlnova.com/cart`.
  Two fresh trips to `checkout.store.pixlnova.com` and Back to Cart retained
  quantity one, saved options and the ₹3 subtotal/final total. A subsequent page
  reload preserved the same state. The unconfirmed-update banner is absent and
  Proceed to checkout remains available.
- The existing QA wildcard store was reloaded on the new release, reached
  `checkout.qa-wildcard-20261027.letbuyy.store`, and returned to its original
  `/cart` with quantity one, ₹1 total and its checkout control intact.
- Actual provider alias readback confirms the custom storefront, custom checkout,
  public discovery and platform wildcard all serve the approved Commerce artifact.
  The bounded final 15-minute function error-log query returned zero entries and
  no further page. This is separate from the observed browser acceptance.

No payment details were entered and no order or payment was submitted. Signed
handoff URLs and cart capabilities were excluded from retained proof. Browser,
promotion, source/alias and error-scan receipts plus cart screenshots are under
`/private/tmp/letbuyy-payment-system-plan-20261028/custom-cart-*`. The qualified
domain/cart scope is complete; the specific accepted CI/staging limitations remain
limitations, not retroactively passed tests.

## Remaining boundaries

Hosted staging sign-in remains unconfigured; the owner accepted the specific
limitations for the scoped activations, including cart candidate `9dc428b8f`.
GitHub CI remains billing-blocked. The complete real
Razorpay sandbox capture/refund canary has not yet been observed for this release.
Managed/live collection remains disabled. Partner/Route approval, bank/KYC
qualification, account-scoped webhook convergence, provider-report reconciliation,
post-settlement refund/dispute journeys and physical mobile acceptance remain
programme work. There is no production-ready verdict for all 68 items.

Retain the expanded schema and immutable history after use. Do not blindly apply
DOWN migrations, restore pre-pointer payment code, replay uncertain financial
commands or attempt to undo an external email by a source rollback.
