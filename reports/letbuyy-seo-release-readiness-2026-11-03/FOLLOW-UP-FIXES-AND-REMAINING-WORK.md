> **Latest resolution follow-up:** [Current row-by-row results](ROW-BY-ROW-RESOLUTION.md) and [current summary](STATUS-AND-EXECUTIVE-SUMMARY.md) supersede earlier same-day counts/build/access statements below. Original simulatedLCPremains open.

# Follow-up repairs and remaining work — 3 November 2026

This follow-up covers local source repairs and read-only cloud investigation. It does not authorize deployment or replace the earlier live audits. All findings below are **locally verified**, with hosted effect pending.

## LOCAL-CSP-01 — canonical API excluded by default marketing policy

Category:technical/search-experience implementation. Severity:High release blocker. Confidence:High for the current local source/default configuration; current live client fallback remains unverified. Scope:global marketing header; six localized contact/demo landing pages use the API fallback. It is not a claim that all477 live HTML pages suffered an observed conversion failure.

The current Vercel project environment listing contains only a Turnstile key. The shared browser API defaults to `https://api.letbuyy.com/v1`, but the previous default marketing CSP omitted that origin. `csp-before.log` demonstrates the failing behavioral assertion. Live headers also omit it. A bounded19-script live pricing inspection did **not** establish the same API hostname in the currently deployed client; do not turn that negative search into proof of a different complete implementation.

Fix:extract the existing canonical literal to the API client's pure `./origin` export; keep existing resolver semantics, including its override, intact. Marketing passes this canonical fallback to the shared header helper's explicit connect-only option. Other apps' default policy is unchanged. Additional values must be HTTP(S), without credentials or wildcards. Existing script/frame restrictions remain.

Owner:marketing/security engineer. Effort:roughly 0.5–1 engineer-day including environment and browser acceptance; no ranking/revenue gain estimated. Dependency:reviewed marketing release and hosted browser verification. Validate the default, configured-local and forbidden-origin cases, inspect emitted headers and exercise the intended API path without fake success. Success:the intended API is permitted by CSP while unrelated script/frame/API access is not introduced.

## LOCAL-CORS-01 — canonical www missing from the existing gateway allowlist

Category:technical/search-experience/security boundary. Severity:High. Confidence:High for source and real local gateway behavior. Scope:canonical-www marketing requests to the API; template-wide across the API-using marketing journeys, not a new permission realm.

Before repair, a local pricing GET with Origin `https://www.letbuyy.com` returned ACAO `https://letbuyy.com`, which does not match. The behavioral contract failed. The existing platform allowlist now adds exact label `www`; no wildcard, tenant bypass or auth bypass was added. Afterward both canonical and apex match, three lookalike/unconfigured/HTTP controls do not reflect, and unauthenticated `/v1/orders` still returns 401 with correct CORS. All 1,609 gateway unit tests and gateway types pass.

Owner:gateway/security engineer. Effort:roughly 0.5–1 day including bounded hosted validation. Dependency:separate Worker release approval, plus read-only hosted edge investigation. `GATEWAY-CORS-REPAIR.patch` is deliberately separate from the marketing source archive. Verify GET/preflight origins and unauthorized protected reads after an approved release. Success:correct origin reflection without expanding authentication or arbitrary tenant access.

Hosted API probes without Origin return200 and public plans. Probes with **both** apex and www Origin returned Cloudflare403 / error 1010. This is separate from the source mismatch: the exact hosted cause and real-browser effect are not established. Do not disable WAF/security controls to obtain a green result. Current Cloudflare access is still blocked at sign-in/record permissions.

## CONTENT-SEQUENCE-01 — first-store steps had gaps and wrong order

Category:content/task completion. Severity:Low. Confidence:High. Scope:three localized first-store URLs, one template/content item. Visible headings were 1, 4, 3, 5, 8. They now read 1, 2, 3, 4, 5 in English/Hindi/Tamil; all previous section IDs remain explicit and unchanged. The actual update date is3 November 2026. No new capability or professional claim was added.

The translation hashes and32 relevant human-review rows were refreshed; they remain pending human review. The reading-visual test now consults explicit IDs just as the actual renderer does, while still requiring every visual target to exist. Three-language regression tests and HTTP parsing prove visible order and preserved anchors. A scan of all other numbered guides found no other nonsequential set under the same detection rule.

Owner:editorial/marketing engineer. Effort:under half a day plus native-language review. Dependency:authorized publication. Validation/success:all three variants show 1–5, existing deep links resolve, source locks match and no old guide is removed.


## LOCAL-PROXY-01 — deprecated Next.js entry point migrated

State:Confirmed; severity:Informational; confidence:High. This is maintenance, with no demonstrated ranking defect. The existing locale-routing file moved from `src/middleware.ts` to `src/proxy.ts`; only the exported function name and relative import spelling changed. The locale precedence, forged-header replacement, exclusions, redirects, cookie policy and cache headers are preserved. No CSS, theme or animation code changed in the retained source.

Six behavioral cases pass on both entry points. Twelve actual HTTP before/after cases match. A deliberate isolated mutation removing language-header replacement causes the expected behavioral failure, and the test source is restored exactly. The complete known-URL checks pass separately on the final root localhost configuration and production-canonical source closure. No deprecation warning remains. See [migration receipt](evidence/proxy-followup/proxy-migration.json), [HTTP parity](evidence/proxy-followup/proxy-routing-parity.json) and [bounded patch](PROXY-MIGRATION.patch).

Owner:marketing engineer. Effort:under half a day plus release checks. Dependency:authorized marketing publication. Validation/success:the recorded routing cases retain response semantics, assets/API discovery remain exempt and the build no longer reports the deprecated convention. Official guidance:[Next.js Proxy convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy).

## Release source and verification

The source archive contains 1,286 materialized files across 15 runtime/package roots, plus required test/lint inputs. It contains no environment files, node_modules or generated build output; its source hashes match the owner checkout. Frozen offline install succeeded using the existing pnpm cache without changing dependency constraints. The final exact filtered build passed 29 tasks (28 cached/one executed); earlier uncached acceptance passed 29. This is a review snapshot, not approval to release every dependency change in the dirty tree.

Root build:`x_o-z2KN4IIGV9tF3-aKw`. Source-closure build:`BoHfXEideCPtgUwHVBwKv`. See`release-source-manifest.json`, `release-source-bundle.json`, `completion-source-lineage.json` and `completion-css-preservation.json`. No CSS or animation source was edited in this follow-up. All nine compiled CSS files are byte-identical between the latest root and source-closure builds. All 20 source styles match the captured November 3 baseline. Earlier Chrome observations remain dated evidence; fresh browser acceptance is blocked.

Marketing 218+four auth-boundary tests, types/lint, seven API/header contracts, four CORS contracts, gateway1,609 unit tests/types,489 URL checks, XML/404 controls and exact guide anchors pass. The full destructive governance gate and all owned-DB/provider/device acceptance were not run or claimed in this scoped follow-up. Existing prior UI/token evidence is reused because those sources did not change.

## Performance remains unresolved

Final unchanged original budget:2,500ms LCP,200ms TBT,0.1 CLS. Final source build received three repetitions per page/method. Pricing simulation median3124.000ms; guide3833.912ms; zero of three pass each. Applied lanes pass, all 12 TBT/CLS samples pass, and no diagnostic sample or threshold waiver is counted. These are lab results, not real-user CWV or INP. The SDK/policy/content repairs do not establish a causal performance improvement. Earlier failed experiments and model-sensitivity evidence remain available; an open upstream issue is not proof this site's warning is harmless.

## Existing Analytics access, no tracking deployment

Current Chrome now exposes both existing LetBuyy properties. `letbuy-y` property 513546435 has Web stream 13007347185; `let-buyy` property 505262659 has Web stream 12176601288. Both show inactive collection/no recent data and no website URL shown. No agent email-preference save, stream edit, secret view, tag installation or event transmission occurred. The owner must select the destination and approved consent/event policy before implementation can be joined to a real marketing sink. App traffic is not marketing conversion evidence.

The standing no-deployment boundary and owner privacy deferral remain. Production/Google reprocessing, DNS/legacy changes, human acceptance, sufficient field data, fuller authority data and real provider payment acceptance cannot be labelled complete from this local packet.

## Latest performance investigation and browser limit

Five private candidates tested tree shaking, CSS inlining, demand-loaded fonts, demand-loaded motion, and combined page-owned CSS/theme/motion changes. None met the original simulation budget on both pages. They were not copied into the site. The demand-loaded motion candidates also lack full first-interaction/failure/visual acceptance; their lower byte counts are not sufficient acceptance. The inlining candidate increased compressed HTML materially. [All ten diagnostic outcomes](evidence/performance-candidate-results.json) are separate from the 12 final-build acceptance samples. An upstream model issue is not proof of harmlessness. No threshold, audit, simulator, throttle or delayed-LCP workaround was introduced.

The latest final source simulation medians are 3.124s pricing and3.834s guide,0/3 pass each. Applied medians are 1.923s and 2.079s,3/3 pass each; all 12 TBT/CLS samples pass. The guide varied materially from an earlier same-day median3.358s. No causal improvement or regression is assigned from these uncontrolled repeated-build observations. [Exact final reports/traces](evidence/proxy-final-performance/summary.json) identify each sample.

Current Chrome is blocked by an application-opening dialog, and direct browser inventory reports local browser use disabled in Work settings. No dialog choice, browser setting change or alternative profile was used. The owner readiness question remains unanswered; dated earlier account observations do not prove fresh access. See [access limitation](evidence/current-chrome-access-limits.json). The root URL checker initially used the release copy's production canonical expectation; its configuration was corrected to the root build's intentional localhost canonical and rerun. That was a checker configuration error, not a source defect; the receipt is retained.
