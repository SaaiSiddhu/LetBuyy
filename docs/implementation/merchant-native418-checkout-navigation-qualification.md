# Native418 checkout browser navigation qualification

Status: local test-only qualification passed; exact-source CI still required. No production activation.

The required CI workflow `44037427585`, source
`140c53e5491fd149e3fec8e276bc09ade6b8acb7`, reached the real Commerce,
Gateway and owned PostgreSQL checkout tests. Three scenarios passed. The
stale-inventory scenario stopped at the hosted navigation wait with
`page.waitForURL: net::ERR_ABORTED; maybe frame was detached?`, before its
inventory-conflict assertions ran. Its retained log SHA256 is
`73b785bfd9f1ef9bb00c0d161a78527c938481629a49fdf11e7eca1afb3a32c0`.

The candidate replaces four navigation-event waits with retrying assertions
that require the actual `checkout.localhost` host, assigned test port, and
`/checkout` path. It retains the 90-second bound, rendered-form checks and all
cart, stock, payment, ledger, outbox and idempotency assertions. No application,
database, production origin, permissions or checkout policy changes are included.

This addresses the observed wait boundary; it does not establish why Chromium
aborted the intermediate navigation. A successful isolated run must exercise the
complete checkout scenarios, and the exact committed source must pass required
CI before release. A failed run or rerun must remain recorded as such.

The assertion API is documented by
[Playwright PageAssertions](https://playwright.dev/docs/api/class-pageassertions#page-assertions-to-have-url).

## Required evidence

- Complete owned checkout browser suite, including stock-conflict recovery.
- Repeat with an independently running owned browser/Identity journey to check
  the concurrent execution conditions that exposed the failure.
- Typecheck and exact-source mandatory CI results.
- Fresh recovery-artifact binding, hosted staging acceptance, production
  deployment and physical iPhone login remain separate subsequent gates.

## Local result — 17 November 2026

Managed run: `20261117T081426Z-native418-checkout-navigation-and-identity-fbc4b044d12d4689abbe904091c33525`. Two bounded owned PostgreSQL workers, prepared transactions enabled, encrypted T7 scratch, real Commerce and Identity browser processes. All three suites completed: checkout 4/4, Identity browser 1/1, Identity sessions 8/8; zero failures, cancellations or skips. Gateway typechecking passed. The full report SHA256 is `f6dc39c91278439320128d7eea156b34406c59d77cfa20de7a9dce6eb27cf40e`.

The preceding CI attempt remains failed/canceled and is not accepted. This local result does not establish full CI, hosted signup, provider delivery, production deployment or iPhone acceptance.
