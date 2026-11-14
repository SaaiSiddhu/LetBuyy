# Local signup → plan selection → billing verification

> **Later follow-up,30 October2026:** all three broad-suite failures recorded below are now resolved. Complete Gateway units, root contracts, workspace typecheck/lint and the full source governance gate pass. See [local green checks](../letbuyy-local-green-checks-2026-10-30/VERIFICATION.md). The older totals remain historical evidence. One duplicated synthetic password in this folder’s review patch was redacted during that follow-up; the source fixture and its exact source fingerprints remain unchanged.

**Result: application flow verified locally; seven confirmed defects repaired. Nothing deployed.** Fresh signup through paid plan activation and cancellation passed against production-built apps, the canonical worker and owned disposable PostgreSQL/PostgREST. Email delivery, payment-provider HTTP and the checkout SDK were explicitly captured/simulated. This is not Razorpay sandbox certification or real bank-authorisation evidence.

Normal review services remain running: [Marketing pricing](http://127.0.0.1:9006/in/pricing), [Accounts signup](http://localhost:9002/signup), [Merchant](http://localhost:9001), [Gateway pricing](http://127.0.0.1:9010/v1/pricing). Merchant redirects unauthenticated visitors to local Accounts. See [service checks](evidence/local-services.json).

## What passed

The connected browser journey created its own synthetic account through the actual signup form, captured verification email, OTP, password, onboarding and first-store creation. No account, verified-email flag, password or browser session was seeded. Development auth bypass was false in these tests; the OTP was not returned to the client. Wrong OTP, replayed OTP and unbound/replayed password intent were rejected. A failed mail transport recovered through the form retry.

The disposable migration-built public catalog matched the captured real local catalog: Launch/Growth regular monthly prices ₹299/₹999 and founding prices ₹199/₹699; Scale and Commerce OS remained unavailable. No plan price was overwritten for the test. The fresh store's annual Launch quote was ₹2,388 under the existing scoped founding-price resolver. The store then selected and paid for Launch monthly at19900 paise, upgraded to Growth monthly at69900 paise, and read back both invoices, the current paid plan and a total paid amount of₹898.00. Taxable amount plus tax equalled each immutable quoted gross.

Growth sandbox payment-method setup retained the correct plan and69900 amount. Both Billing and Billing profile entry points worked. Sandbox state was labelled and did not imply live bank authorisation. Cancellation retained both paid invoices and the₹898 total while changing the upcoming amount to0, date to null and UI to “No renewal is scheduled.” The fresh store's existing14-day trial policy was preserved, not changed.

Evidence: [connected flow](evidence/connected-flow.json), [paid billing screenshot](evidence/connected-billing.png), [dashboard screenshot](evidence/connected-dashboard.png), [separate checkout recovery](evidence/checkout-recovery.json).

## Repairs

| ID | Confirmed defect | Correction |
| --- | --- | --- |
| SBF-01 | Launch/Growth became Starter in payment-method UI/BFF; core mandate validation rejected the real plan slugs. Billing profile omitted its current plan. | Carry the explicit catalog slug through the UI, SDK, BFF and core; remove legacy fallback/default and connect the profile's current plan. Unknown/unavailable plans still fail at the worker. |
| SBF-02 | Sandbox setup said AutoPay was activated, and an active sandbox row suppressed the renewal warning. | Derive messaging from returned mode/status; only a matching active **live** mandate counts for real automatic renewal. |
| SBF-03 | BFF generated a new key for every payment-method retry. | Preserve the same form intent/key during page-lifetime retry and forward it unchanged. Missing/invalid intent is400. |
| SBF-04 | Cancelled Growth still appeared as an upcoming₹699 charge. | Retain historical receipts while removing scheduled renewal amount/date/plan for cancelled/non-renewable state. |
| SBF-05 | A reused mandate key accepted changed plan/cycle/instrument details with200. | Compare persisted intent before replay; changed intent returns409 without rewriting the row. |
| SBF-06 | Simultaneous mandate retries hit a uniqueness server error. | Recover and verify the committed same-key row after the constraint race; return one identical mandate, with sanitized storage errors otherwise. |
| SBF-07 | Annual toggle always advertised20% savings, including zero-saving founding quotes. | Derive up-to savings from purchasable catalog prices and hide the badge when there are none. |

[Detailed fixed-issue register](FIXED-ISSUES.csv), [before-fix observations](evidence/confirmed-reproductions.json), [task-only source patch](TASK-ONLY-SOURCE.patch).

The existing recovery browser selector was updated to the actual setup checklist link. The marketing composition contract was retargeted to the existing server-loaded Pricing/client-shell boundary: it still checks every live component, rejects every dead twin and verifies server pricing injection. No access guard, financial invariant, test assertion class, validator threshold or provider restriction was disabled.

## Verification coverage

| Check | Result |
| --- | --- |
| Eight owned database suites | **83/83 pass**, no skips; all disposable infrastructure cleaned |
| Connected public signup and both real plan prices |1 complete browser journey passes; Identity and Merchant production builds |
| Separate checkout recovery |1 complete browser journey passes; Identity, Merchant and Commerce production builds; lost-create reconciliation, reload, SDK dismissal, failed activation rollback, retry and cancellation |
| Mandate intent/ownership/race checks |6/6 pass; actual worker middleware, PostgREST and PostgreSQL |
| Store creation and verification-token redemption |4/4 pass |
| Payment ownership, single activation and tax conservation |71/71 pass, including duplicate payment, cross-store refusal, concurrent/replay and mandatory-write rollback cases |
| Merchant package tests |**925/925 pass**:119 app cases plus806 contracts/integrations;7 focused billing/UI cases included |
| Billing core package tests |**40/40 pass** |
| Gateway documented unit command |1608 pass / **1 pre-existing order-edit assertion failure** |
| Root contracts |336 pass / **2 pre-existing failures** in custom-domain health and Console auth source expectations |
| TypeScript |Merchant, Gateway and SDK pass; SDK project references built before its standalone check |
| Scoped ESLint |Pass, no warnings |
| Design system / domain boundary |Pass; no increased ratchet or new API route;227 ownership records checked |
| Public data preservation |Pass: original local plan rows and founding counters equal the earlier read-only snapshot |

The three remaining broad-suite failures were reproduced in the untouched task-start source snapshot. Their source owners were not changed by this task. They prevent claiming that the entire repository gate is green; they do not erase the passing bounded signup/billing evidence. See [regression results and failure names](evidence/regression-results.json).

Evidence: [all83 case names](evidence/owned-test-cases.json), [runner and per-suite cleanup](evidence/owned-runner.json), [six-run resource cleanup](evidence/owned-cleanup.json), [data preservation](evidence/preserved-local-data.json), [source lineage](evidence/source-lineage.json), [scoped secret check](evidence/scoped-secret-check.json), [acceptance receipt](acceptance.json).

## Scope, preservation and remaining prerequisites

- All mutations ran in ownership-verified disposable databases. The preserved Supabase stack was read-only for this task. No shared user, store, invoice, subscription or plan was seeded, edited or deleted; no shared migration, reset or seed ran.
- The mutation proof uses the canonical worker's actual `fetch` through an HTTP bridge, with real global middleware and database wiring. It does not write test charges through the shared9010 process. Public read checks on9010 and the normal9001/9002/9006 review services passed separately.
- Provider capture uses synthetic supplier facts only inside disposable tests. The shared gateway has Razorpay test-key configuration but **no approved subscription-tax profile**. Actual provider checkout on that shared environment still requires verified, approved supplier configuration. No tax identity was fabricated into its environment.
- Real email/inbox delivery, account-specific Razorpay test/sandbox acceptance, actual UPI authorisation/renewal, webhooks from a real provider, hosted cross-domain cookies and production deployment were not verified. Invoice history was verified; invoice PDF export and bank debits were not exercised.
- Payment-method keys survive uncertain-response retries within the current page/form intent. Cross-reload durable checkout recovery is covered by the separate subscription checkout test; a claim of persistent mandate-form intent across reload is not made.
- Primary flow verification is desktop Chromium. Earlier public pricing EN/HI/TA, mobile and no-JavaScript checks remain in the [real local pricing report](../letbuyy-pricing-local-2026-10-30/VERIFICATION.md); this task does not claim an additional complete mobile signup-to-payment journey.
- All final runtime source matches the isolated build candidate. Fifteen runtime/test/fixture files changed relative to the task-start snapshot; the task-only patch excludes pre-existing edits. Documentation/continuity updates are additional. No environment files, package versions or deployment configuration were changed. No commits, push, merge, external email delivery, purchase or deployment occurred.

## Reproduce safely

Run the repository-owned lane from an **environment-file-free source copy**, reusing the installed dependencies and matching Playwright browser cache. Never target the restored Supabase containers with these mutation tests. The [runner receipt](evidence/owned-runner.json) records the exact eight suite paths, images and limits. Example for the connected flow:

```sh
PLAYWRIGHT_BROWSERS_PATH="$HOME/Library/Caches/ms-playwright" \
node scripts/governance/run-executable-suites.mjs \
  --suite tests/owned-db/merchant-public-signup-browser.postgres.test.ts \
  --jobs 1 --timeout 900
```

Initial failures were retained under `/tmp/letbuyy-signup-billing-20261030/`: the wrong Playwright cache, stale dashboard selector and a duplicate synthetic fixture name were harness problems and were corrected. Product failures (schema, cancellation readback, changed-intent replay, deterministic mandate race and annual badge) were separately reproduced and repaired. Raw local logs are retained there; the deliverable contains sanitized case summaries, source fingerprints and factual browser receipts.
