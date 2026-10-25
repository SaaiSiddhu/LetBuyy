# Threadline implementation

Status: **implemented and substantially verified locally; acceptance remains open**. No deployment or production acceptance. Starting branch `letbuyy/theme-release-performance-resume`, HEAD `85aac99043d8dc10469e12cbb810609a3b6f1b0d`. Existing unrelated research and identity implementation changes are preserved. See the explicit limitations below before interpreting test totals.

**23 October continuation:** buyer-runtime QA is continuing in [the dated QA record](qa-2026-10-23/README.md). It found and repaired modal cart focus, canonical-host predictive search and order money/progress presentation defects that the earlier passing suites did not establish. The six-hour review instance listed below has expired; its ports and credentials are historical. Current-source test/build evidence and remaining browser checks are recorded separately in the continuation.

The requested scope is the first `sense` / `letbuyy-sense` niche design, versioned as Threadline 2.0.0. The other nine designs are outside implementation scope. The existing Liquid package, merchant marketplace/editor, gateway theme execution, hosted checkout and buyer identity/account owners remain canonical (WIN-R3/R4, ARCH-R11–18, TEST-R6).

## Verified starting gaps

| Capability | Observed gap | Change / evidence required |
|---|---|---|
| Catalog | Core bundle plus settings overlay | Versioned apparel composition in the existing document engine; exact install/readback |
| Layout assets | Page assembly exposes base head styles but discards layout-owned styles | Existing sanitizer extracts the rendered document's head styles; actual browser output |
| Garment facts | Metadata is omitted by public product projection/model/drop | Bounded validated apparel namespace, safe projection, merchant edit/readback and Liquid rendering |
| Per-section product binding | Page-level product union feeds every section | Bounded section-owned product drops and real collection/product bindings |
| Preview | Catalog preview uses generic Urban Kicks demonstration products | Threadline sample content through the real package, isolated from real stores |
| Distribution | Historical catalog generator writes settings-only migration 372 | New forward/rollback artifact promotion, no edits to historical migrations or releases |
| Lifecycle | Existing install/draft/publish APIs and database tests exist | Extend real-worker, owned-DB proof with Threadline structure and recovery |

## Implemented behavior

Threadline is the 2.0.0 package under the existing Sense identifier. It uses an editorial apparel layout, garment imagery, silhouette collections, product discovery, outfit product links, fabric/care content and merchant service information. The other nine catalog entries remain available. This change does not install a second theme engine or identity/checkout system.

- The canonical Liquid package owns its scoped layout styles and declared blocks. The editor resource fields bind actual merchant collections/products, and sections receive their own selected resources. The header owns the announcement so home does not repeat it.
- Merchant apparel facts are validated and persisted through the existing product route. Public drops receive only the bounded apparel namespace; private supplier metadata remains private. Product options, stock and pricing retain their existing server owners.
- Size/color/price/sort discovery uses a bounded, paginated SQL function. Size and color must match the same in-stock variant. Collection membership and site ownership are enforced. Empty pages retain the real total.
- Catalog preview uses explicitly synthetic apparel through the actual package and has desktop/tablet/mobile frames. Its sample purchase action does not create a real cart. The catalog thumbnail was captured from the rendered package; see `preview-provenance.json`.
- Add creates an owned private instance without changing the live release. Draft saves preserve bindings, settings and order; stale saves/publishes fail. Explicit publish captures an immutable release. Catalog promotion/replay does not overwrite installed drafts or releases.
- Theme style selection describes color/typography only. Structural layout changes use the existing reviewed composition workflow. Library/editor links expose the existing **Updates and recovery** surface rather than adding another rollback system.
- Cart drawer/full cart display selected Size/Color and distinguish quantity/removal controls for variants of the same product. Totals remain server authoritative.
- Existing hosted checkout, buyer identity, profile, addresses and orders remain canonical. Checkout receives validated branding data and font mapping; it never executes arbitrary merchant CSS.

Migrations `382` and `383` each have paired rollback files. `382` is generated catalog promotion with an exact prior-value checkpoint; `383` owns apparel discovery. Historical generator `372` can check its frozen payload but cannot overwrite the new catalog.

## Browser acceptance observed

The browser used production Next builds against a real gateway, disposable PostgreSQL and PostgREST. These are local synthetic fixtures, not hosted/provider evidence.

| Journey | Observed result | Evidence |
|---|---|---|
| Marketplace and Add | Threadline found under Fashion; all ten catalog entries retained. Add created one private instance with no active release. | `clean-install.jpg`, `browser-release-proof.json` |
| Resource bindings | Actual Relaxed/Straight/Easy collections and actual apparel products selected from the resource picker. | `clean-editor-collection-bindings.jpg` |
| Configure and persist | Heading, hero images, focal point, CTA/fit links, primary color and section order saved and retained after reload. Add/remove, undo/redo and reviewed layout application exercised. | `clean-draft-desktop.jpg`, `layout-change-review.jpg` |
| Preview | Actual desktop 1440, tablet 834 and mobile 390 frames rendered without horizontal document overflow. | `responsive-preview-proof.json`, `clean-draft-tablet.jpg`, `clean-draft-mobile.jpg` |
| Final store hostname | All eight rendered images loaded with positive natural widths. Hero, product media and preview thumbnail returned HTTP 200 and real WebP bytes on the store host. Published home, collection, product and cart had `clientWidth = scrollWidth = 314` at a 320px viewport. Keyboard Enter selected M/Oat, and the real cart showed quantity 1 / ₹2,490. Browser viewport reset afterward. | `store-host-assets-proof.json`, `final-review-proof.json`, `final-review-storefront.jpg`, `published-home-320.jpg`, `published-cart-320.jpg` |
| Publish | Explicit Publish produced an active release; anonymous response contained the saved campaign. Captured release source version 13, SHA-256 `3ac5acdebb40e24169cf0caf0eca0ab112e6bb93d7cdead74a258d100ada9d43`. | `clean-editor-published.jpg`, `published-home-desktop.jpg`, `browser-release-proof.json` |
| Product and cart | Unavailable XL rejected; M/Oat selected. Cart retained variant labels; quantity 2 read back with server total ₹4,980. | `product-unavailable-size.jpg`, `published-cart-variant.jpg` |
| Buyer identity and accounts | Normal existing-password login and explicit consent returned to the site-bound account. Profile edits and address create/edit persisted after reload. Orders empty state rendered. Synthetic buyer registration was fixture setup through the canonical API, not a claimed browser signup. | `buyer-account.jpg`, `buyer-address-persisted.jpg`, `buyer-profile-persisted.jpg` |
| Failure recovery | A failed save retained local edits, displayed Unsaved and disabled Publish. Normal reauthentication then allowed save. Stale publish preserved the active release in the real-worker suite. | Owned lifecycle assertions; browser observation |
| Release restore | Published versions 1 and 2, saved a newer private draft, then restored version 1 through the canonical reviewed UI. A signed-out refusal retained the exact retry; normal reauthentication and Recover rollback committed version 3. The restored snapshot hash exactly matched version 1, and draft version 8 retained its unpublished description. | `release-recovery-proof.json`, `release-recovery-confirmed.jpg` |

The browser release hash identifies that captured immutable release, not a promise that a mutable test store has remained unchanged afterward. Later user edits and an unsaved second campaign exist in earlier review tabs and were preserved.

## Validation recorded

Results are separate evidence groups, not an inflated claim of unique coverage. Some full commands contain overlapping contract checks.

| Verification | Result | Local log/result |
|---|---|---|
| Full theme engine | 1,922 passed; 0 failed/skipped | `/private/tmp/threadline-theme-final-tests.log` |
| Full merchant command, final rerun | 218 component/lifecycle tests and 810 contracts passed; 0 failed/skipped | `/private/tmp/threadline-merchant-final-tests.log` |
| Full commerce command, final rerun | Groups of 159, 144 and 1,052 passed; 0 failed/skipped, including static-host routing | `/private/tmp/threadline-commerce-final-host-tests.log` |
| Focused gateway contracts | 133 passed | `/private/tmp/threadline-gateway-final-contracts.log` |
| Resource search contracts | 15 passed | `/private/tmp/threadline-resource-contracts.log` |
| Cart/address/wishlist islands | 19 passed | `/private/tmp/threadline-commerce-islands.log` |
| Six owned database suites | 43 passed: Threadline lifecycle, all-ten catalog installation, authenticated checkout, hosted-checkout ownership, buyer data and atomic addresses | `/private/tmp/threadline-regression-result.json` |
| Final Threadline lifecycle | Passed against actual worker/DB, including resource-search regression, tenant denial, stale-save/publish denial and migration rollback/replay | `/private/tmp/threadline-lifecycle-final-result.json` |
| Buyer identity through actual Next/gateway/DB | 8 passed | `/private/tmp/threadline-buyer-identity-result.json` |
| Canonical draft/release recovery | 35 passed, including exact retries, stale/current pointer guards, draft preservation, concurrent intents and audit/outbox failure atomicity | `/private/tmp/threadline-release-recovery-result.json` |
| Actual merchant store resolver | 3 passed: UUID/handle endpoint selection and denied/transient failure handling | `apps/merchant/web/tests/owned-store-resolution.test.mjs` |
| Owned fixture credential lifetime | 3 passed | `tests/governance/owned-fixture-credential-lifetime.test.mjs` |
| Merchant, commerce, gateway TypeScript | All passed | `/private/tmp/threadline-{merchant,commerce,gateway}-final-typecheck.log` |
| Governance, final isolated source snapshot | 114 passed, 0 failed/blocked/skipped, 1 not applicable, including the static-host fix | `/private/tmp/threadline-governance-final-host.json` |
| Mobile asset URL handling | 5 passed | Existing mobile test run; source `theme_catalog_assets_test.dart` |
| Build/artifact checks | Production identity, merchant and commerce builds; generated package check; stylelint; frozen lock check; Threadline-scoped `git diff --check` passed | Production fixture readiness and generator check |

The initial commerce command exposed one exact-literal font contract mismatch. Font literals were normalized and the entire command rerun green. Resource search originally selected nonexistent `handle` columns; it now selects real schema columns and fails safely on schema errors instead of showing an empty picker. A real-DB regression verifies both behavior and cross-tenant denial.

The browser recovery check caught two integration defects after the underlying API tests had passed: recovery links omitted the required theme slug, and the shared owned-store resolver's UUID regex omitted a UUID group separator. The links now carry the selected slug, and valid site UUIDs reach the owned-ID endpoint. The resolver still makes a single authenticated API lookup and preserves denial/availability semantics. The merchant command, typecheck and governance gate were rerun after these fixes.

Checking the published page on the actual store hostname also exposed static theme images being rewritten into tenant page paths. The proxy now exempts the explicit public `theme-assets/` and `theme-previews/` namespaces. It does not exempt arbitrary nested paths with file suffixes; the regression keeps product, account, contact, checkout and store-access routes gated. Earlier canonical-host screenshot with missing images was rejected as delivery evidence and replaced after verification.

Long browser sessions also exposed a test-runner defect: the owned REST service credential expired after two hours even when the bounded suite ran longer. Its expiry now covers the suite deadline plus five minutes, with the prior two-hour minimum retained. It remains a signed, expiring credential scoped to owned disposable infrastructure; no production auth behavior changed.

## Remaining acceptance limits

1. **Checkout browser completion is blocked by the local self-signed certificate at `checkout.localhost`.** The browser reported `ERR_CERT_AUTHORITY_INVALID`. Browser safety policy requires the user to handle that warning; the agent did not bypass it, disable certificate checks or claim a completed payment. API/owned-DB checkout tests passed separately.
2. No browser-completed order/payment, order-detail success screen, public signup password-entry flow, real provider transaction or hosted deployment is claimed. Existing-buyer login, API registration and account edits have separate evidence.
3. Full 200%-zoom/reduced-motion/accessibility and production performance acceptance are not complete. Measured responsive evidence covers the three editor preview widths plus 320px published home/collection/product/cart; this is not a full accessibility certification.
4. Some inherited Core template descriptions and the header's generic “Log in” label remain. Selected silhouette cards follow the store collection order rather than the editor slot order. These are recorded presentation limits, not silently rewritten captured releases.
5. Earlier fixture keys expired; those old URLs must not be represented as working logins. The final review instance uses the corrected bounded credential lifetime. Disposable runtime ports and current availability are session-specific; credentials remain outside this repository.

## Reproduce locally

Use an isolated source snapshot with dependencies and no ambient app env files. The repository's owned runner creates/labels/bounds its own PostgreSQL and REST resources; do not point this workflow at a shared or hosted database.

```sh
node --import tsx scripts/liquid-parity/build-threadline-catalog.mjs --check
node scripts/governance/run-executable-suites.mjs \
  --suite services/api-gateway/src/__tests__/owned-db/threadline-lifecycle.postgres.test.ts \
  --jobs 1 --timeout 1200
```

For manual CUA acceptance, set `LETBUYY_THREADLINE_BROWSER_HOLD=1` and `LETBUYY_THREADLINE_PRODUCTION_BROWSER=1`, with a bounded runner timeout longer than build plus review. The helper writes generated credentials/control nonce only to the private mode-0600 `/private/tmp/threadline-fixture-state.json`; never commit that file. The hold is bounded to six hours. Ports are allocated per run. Use the generated canonical `<subdomain>.localhost` store host for buyer identity callbacks. Mailpit is the local inbox at `http://localhost:15424`; capture is local-only and separate from real delivery.

## Current environment

Docker is available with an existing local development database stack and unrelated Edynox containers. Those resources must remain untouched by acceptance tests. Gateway tests use the repository's owned disposable database harness. No deployment, hosted mutation, real payment or external message is authorized by this implementation record.

The active checkout is shared with unrelated identity/admin work. Validation runs in isolated snapshots so governance cleanup cannot remove live app build outputs. No reset, hosted migration, push, deployment, real payment or external email was performed.

The 22 October local review instance was merchant `http://localhost:58386` and storefront `http://syn-threadline-ui-65fca0ce.localhost:58387`, with Mailpit at `http://localhost:15424`. That owned, disposable six-hour hold has expired. Its published release was `78df6aed-02f2-4f4c-a1bf-b418fee65ddd`, package 2.0.0, captured snapshot SHA-256 `726d57ea9fa7a57e9d681c906e91cdd92a6500d0dab13ab2cff373c3bac41664`. Credentials and control material remain in private fixture-state files only. Historical ports are not current login instructions.

`validation-manifest.json` pins the source and evidence hashes at their actual boundaries. Root-wide diff cleanliness is not claimed: unrelated concurrent billing/domain edits introduced whitespace warnings after the earlier clean check. Those files were left to their owner. The static matcher test initially lived under production `src` and tripped the dev-dependency import gate; moving it to the app's test directory resolved the failure without adding a runtime dependency or relaxing validation.

The sole Threadline source difference between the final browser/governance snapshot and the workspace is migration 382's SQL dollar-quote label (`$threadline$` versus `$liquidbundle$`). Exact substitution equality and identical normalized JSON artifact hashes are verified in the manifest. Runtime package source and promoted artifact content are identical; this is not an untested bundle change.

Next acceptance actions: have the owner handle the local checkout certificate warning, complete the browser checkout/order-detail and public signup flows through supported UI, then qualify zoom/reduced-motion/accessibility and performance on the integrated build. Reuse this chat's recorded shared fixes as the baseline for the nine-theme programme. Browser control was released to its coordinator after the final captures; this chat's existing tabs/fixtures remain exclusively owned and must not be reused or pruned by other chats.

### Current local review — 23 October 2026

The final mobile repair and 320/390px evidence are recorded in [the continuation report](qa-2026-10-23/README.md). The current temporary owned storefront is <http://syn-threadline-ui-e853e084.localhost:58669/> and merchant app is <http://localhost:58668/>. Normal password sign-in and the published Threadline2.0.0 theme surface were verified. Generated credentials are private and delivered directly to the owner; earlier ports below are historical. Checkout TLS, public browser signup and the stated accessibility/performance qualification limits remain open.
