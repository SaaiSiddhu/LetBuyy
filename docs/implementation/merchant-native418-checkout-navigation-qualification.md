# Native418 checkout browser navigation qualification

The test-only correction is locally qualified. Full exact-source CI, hosted
staging, production and physical iPhone acceptance remain required.

## Observed failure and cause

The previous 140c53e candidate failed the stale-inventory checkout scenario at
`page.waitForURL` after an intermediate `ERR_ABORTED` navigation. The first
correction, 3bee95811, passed local checkout and Identity tests and the Unit CI
lane, but the same scenario failed in the separate merge-safety lane. That
candidate is not accepted. The second failure log SHA256 is
`f1c43e393251cdb9c4373b70d6da84888d8f53709545ff10671999a710face73`.

Inspection of the installed Playwright 1.60.0 implementation established that
`toHaveURL` with a predicate calls the same navigation-event wait. It catches an
intermediate navigation error and formats it as a timeout, even when it occurs
much earlier. Its regular-expression overload instead polls the actual URL.
The previous predicate replacement therefore did not remove the original race.

A controlled browser experiment reproduced this distinction three times: the
predicate assertion rejected the deliberately aborted intermediate navigation,
while the regular-expression assertion waited for and accepted the correct final
URL in all three runs. The prior negative controls remain failures as expected.

## Final change

All four real checkout journeys call one test helper that uses the polling
regular-expression matcher. It requires the exact HTTP checkout.localhost host,
assigned test port and /checkout path; the original 90-second bound remains.
No UI, stock, order, payment, ledger, outbox or idempotency assertion was removed.
A permanent fifth browser case deliberately aborts an intermediate navigation
and proves that the same helper accepts the eventual correct destination.
Only that harness case uses synthetic documents; the four commerce journeys
still use real Commerce, Gateway and owned PostgreSQL.

Bounded diagnostics on the stale-inventory failure record navigation timing,
close/crash events and host/path only, without query strings or handoff secrets.
There is no application runtime, SQL, permission, issuer or checkout-policy change.

## Verification

- Managed parallel qualification: `20261117T091908Z-native418-checkout-final-abort-regression-7c9bc172a3134614a517da2c59c68783`. Two independent owned lanes
  each passed all five cases, with zero failures, skips or cleanup failures.
- Controlled abort experiment: `20261117T091805Z-native418-navigation-abort-controls-d691e8dac09e43a3aed9e6d084c95739`. Three expected-negative predicate
  controls and three positive polling controls passed their expected outcomes.
- Gateway typecheck passed in `20261117T092130Z-native418-final-checkout-regression-typecheck-9663afca86f34073a0dc7efdbc912465`.
- The preceding failed/canceled CI attempts are preserved and are not accepted.

The API reference is [Playwright PageAssertions](https://playwright.dev/docs/api/class-pageassertions#page-assertions-to-have-url).
