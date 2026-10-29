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

## Newly reproduced checkout return defect

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
Original source/browser qualification must finish before this additional repair
is promoted.

## Remaining boundaries

Hosted staging sign-in remains unconfigured; the owner accepted that exact
limitation for `4c3843b81`. GitHub CI remains billing-blocked. The complete real
Razorpay sandbox capture/refund canary has not yet been observed for this release.
Managed/live collection remains disabled. Partner/Route approval, bank/KYC
qualification, account-scoped webhook convergence, provider-report reconciliation,
post-settlement refund/dispute journeys and physical mobile acceptance remain
programme work. There is no production-ready verdict for all 68 items.

Retain the expanded schema and immutable history after use. Do not blindly apply
DOWN migrations, restore pre-pointer payment code, replay uncertain financial
commands or attempt to undo an external email by a source rollback.
