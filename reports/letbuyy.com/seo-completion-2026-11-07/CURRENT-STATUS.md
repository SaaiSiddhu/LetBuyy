# LetBuyy marketing SEO — 7 November 2026

**The follow-up is incomplete. Both simulated LCP gates still fail. Nothing was deployed.** The existing SEO repairs, layout, animation code and all 20 marketing CSS sources are preserved. No new application change met acceptance; the two isolated performance candidates were discarded.

The owner's current Chrome profile now works for **Search Console (`letbuyy.com`), Firebase (`letbuy-y`) and Cloudflare DNS (`letbuyy.com`)**. Real local pricing is available at [port 9006](http://127.0.0.1:9006/in/pricing), with gateway 9010 and Accounts 9002. Launch and Growth read ₹199 and ₹699 founding prices from the local catalog, and the two upcoming plans remain unavailable. The signup page opens with development auth bypass disabled in Accounts. No signup was submitted to the shared database.

## Verification completed

- **224 marketing tests, four auth-boundary tests**, types, ESLint, stylelint and scoped import/export/origin validators passed. The token-alias validator passes. The exact filtered release build passed **29/29, all fresh**.
- **489 known URLs** checked in both local configurations: **477 HTML 200s, 12 intended publisher redirects**, plus expected 404 controls. All **105 localized guides** and **180 contextual article links** are present. XML has **189 entries**; the three accessible HTML directories remain `noindex, follow` and are excluded. Parsed **690 JSON-LD blocks**; syntax and local checks do not certify Google feature eligibility or indexing.
- Current Chrome normal-window and mobile-emulated interactions pass for the checked pricing/guide/signup entry cases. Separate disposable Chromium passes **48 page cases and eight interactions**. Actual phones, native Safari/Firefox and assistive-technology review remain open.
- **Current live observations:** duplicate brand in the homepage title, generic pricing title, stale 99-entry XML and legacy robots declarations, the old Shopify tag still returning 200 with a nonlocalized canonical, and live API `www` Origin receiving the apex ACAO. The local gateway reflects exact approved origins and keeps unauthenticated Orders at 401. These are separate live/local observations, not claims that Google has processed a correction.

## Required performance results

| Page | Throttling | LCP samples, seconds | Median | Passes |
|---|---|---:|---:|---:|
| Pricing | Simulated | 2.918, 3.451, 3.563 | 3.451s | 0/3 |
| Pricing | Applied DevTools | 1.938, 1.944, 1.985 | 1.944s | 3/3 |
| First-store guide | Simulated | 3.830, 3.827, 3.828 | 3.828s | 0/3 |
| First-store guide | Applied DevTools | 2.138, 2.142, 2.150 | 2.142s | 3/3 |

Every TBT and CLS sample passed. Both original simulations failed; applied-throttling lab success does not meet the simulated requirement. Real-user LCP, INP and CLS remain unmeasured.

## What remains, and why

| Work | Current state | Next dependency |
|---|---|---|
| Simulated mobile LCP | Pricing 3.451s, guide 3.828s, 0/3 each | A safe source fix or supported tooling correction that meets all unchanged measurements and preserves behavior. |
| Legacy DNS | Records and Vercel bindings read; exact root redirects and proposed record diff prepared | Verify post-binding CNAME values, TLS and unmatched paths, then obtain separately scoped authority. No DNS change applied. |
| Analytics | Owner chose to keep tracking off; consent-first proposal delivered | Approved stream, consent/event policy and later implementation authorization if tracking is desired. |
| Razorpay | One real test auth check returned HTTP 401; owner has no valid pair | Replace test credentials in the approved local secret location, then real sandbox E2E with owned fixtures. |
| Human/device acceptance | 202 native-language review rows pending; qualified legal/tax and real-device/AT evidence absent | Actual reviewers and named test devices/browsers. |
| Live release and Google | Reproducible candidate, **not ready for approval** | Passing required acceptance first, then scoped release approval, live verification and Google reprocessing evidence. |
| Buyer-app privacy/support | Explicitly deferred; active buyer app retained | Owner's later app-specific facts, review and authorization. |
| Wider measurement | Current GSC Generative AI report shows 73 impressions in a different window than the November3 report | Comparable dated data; no citation-count, conversion or field performance claim. Fuller backlinks and third-party AI data unavailable. |

Source: `118209b4fde1b5a15313f4741bcac454690d15c8` on `codex/local-work-preserved-20261025`, with the owner's working changes preserved. Running root build `b2CsFLYIUn25H5EguBjys`; fresh isolated production-canonical build `Nr2bD-AZ_XyFXsUJdc2FD`. All 1,289 source files across 15 roots match the prior snapshot. The isolated build uses loopback API/Accounts settings and is not production deployment output.

[Performance investigation](PERFORMANCE-INVESTIGATION.md) · [URL inventory](URL-INVENTORY.csv) · [Chrome verification](CHROME-DESKTOP-MOBILE-VERIFICATION.md) · [DNS proposal](DNS-AND-HOSTING-PROPOSAL.md) · [Analytics proposal](ANALYTICS-DESTINATION-AND-CONSENT.md) · [Razorpay](RAZORPAY-TEST-VERIFICATION.md) · [Release candidate](RELEASE-CANDIDATE.md) · [57-record register](WORK-REGISTER.csv) · [All deliverables](README.md)
