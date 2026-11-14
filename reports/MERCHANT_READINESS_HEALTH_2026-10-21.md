# Merchant setup checklist and store health — 21 October 2026

The setup checklist and store health view are implemented and wired across merchant web, native and Console. They extend the existing `/v1/stores/:id/health` API and native Store Health screen. One Gateway reader supplies the same setup facts to merchants and authorized Console operators; clients do not calculate a second readiness verdict.

Checkout: `/Users/saai_mithra/Projects/Start_Up/LetBuyy`, `develop`, HEAD `118209b4fde1b5a15313f4741bcac454690d15c8`, uncommitted working tree. Scope is the two recommended capabilities—setup checklist and store health—not all five subsequent roadmap suggestions. No deployment, migration, provider transaction or external message was performed.

## Where it is wired

- Merchant web: the store dashboard uses the shared checklist; Settings includes **Setup and store health**, addressable at `/<store>/settings/store-health`. **Check again** reloads server evidence. Each step opens the existing settings, product, theme or domain workflow.
- Merchant native: Home has **Setup checklist and store health**. The existing Store Health screen shows completion, evidence state and settings actions, reloads on return, and clears previous data during retry or account/store changes.
- Console: merchant **Operations workspace** includes the same checklist and a support link. It exposes safe operational summaries, without business contact values, private addresses, credentials or domain verification tokens. Operators guide the merchant through existing settings; this view grants no merchant write authority.

## What each check means

| Check | Required evidence and next action |
| --- | --- |
| Business details | Store name, business contact and recorded business address. Opens General settings. GST registration is not a checklist prerequisite; this is completeness, not legal/KYC certification. |
| Active catalog | An undeleted product must have both active status and the active flag. Drafts and archived items do not count. Opens Products. Stock and buyer-specific serviceability remain checkout checks. |
| Delivery settings | An undeleted active delivery rate must belong to an undeleted zone in this exact store. Opens Shipping. A zone without an active rate is incomplete. |
| Payment acceptance | COD enabled, or configured and verified seller-owned live credentials with encryption available. Shared/sandbox settings do not certify live online acceptance. The summary distinguishes COD and online configuration; it does not certify provider delivery. Opens Payments/Connect Razorpay. |
| Published theme | The buyer reader's current, published, undeleted release must match the site's release pointer. Customization or installation alone does not count. Opens Themes; native opens the existing storefront preview. |
| Store publication | Current published status and flag must agree. A historical publication timestamp does not count. Suspended stores are explicitly restricted and directed to support. Opens the existing publication controls, without bypassing them. |
| Domain and certificate | The default LetBuyy subdomain is sufficient; a custom domain is optional. A custom domain needs matching site/domain evidence, active domain/certificate state and recorded ownership/DNS/SSL verification within 24 hours. Missing, future-dated or stale verification stays unknown. Opens Domains for its existing verification workflow. |

The 24-hour bound is an explicit diagnostic freshness window, not a new selling policy or publishing gate. The response records its observation time and the domain evidence time. It reads stored facts without performing external probes or mutating domain verification. Existing open-order and review signals remain in the health response. The displayed percentage is setup completion, not a risk score or uptime measurement.

Ready, needs attention, restricted and unknown have distinct meanings. Failed sources do not become empty counts or completed steps. The merchant SDK validates the health response contract; an older/malformed response becomes an unavailable panel instead of crashing the dashboard. Merchant health retains its owner-only access; staff do not gain new business/payment visibility. Console requires a live bound operator with `merchant:view`, no-store caching and a successful mandatory audit.

The old merchant-local product/payment readiness inference was removed from the active flow and its helper. This completes the existing system under ARCH-R17 and WIN-R4/R6; it introduces no runtime, schema, event infrastructure, entitlement writer or publishing bypass. The app API route inventory remains 224 because the new web page uses the existing server-side API client.

## Verification

| Evidence | Result and boundary |
| --- | --- |
| Real worker/PostgreSQL suite | **5/5 pass**, run `3ada12132e97`. Cases cover a shared owner/operator result, draft-only catalog, old publication dates, complete setup without GST, linked active delivery, shared-payment refusal, suspension, missing/stale/foreign domain evidence, source outage, read-only behavior, selected-store mismatch, operator revocation and mandatory audit failure. Foreign active catalog data is deliberately present as a positive isolation control. |
| Normal browser journey | **1/1 pass**, final run `477d2d71b508`. Production-built Identity and Merchant apps plus the existing Console development fixture: merchant logs in normally, opens the checklist, follows the business action, saves real General settings, returns to a completed business step and sees the same state through normal Console magic-link/TOTP login. The connected support public/private/recovery journey also passes. No session injection or real provider delivery is claimed. |
| Merchant web tests | **922/922 pass**: 116 local app tests and 806 integration/source contracts; five focused dashboard mapping/URL cases also pass independently. |
| Merchant native | **362/362 pass**, including four new recovery/navigation tests. They exposed and repaired a real selected-store race: the screen now uses the complete canonical request-context key, rather than an account-only epoch. Late replies, failed refresh, wrong-store replies and returning from settings are exercised. These are explicit synthetic transport widget tests, not phone-to-Gateway evidence. |
| Native analysis and compilation | Strict analysis: no issues. The complete app entrypoint compiles into an Android ARM64 debug kernel/assets bundle. This is not an APK, native-plugin or device execution. |
| Publication/source regression | Six existing store publication and health contracts pass after following the extracted shared reader. No ownership assertion was weakened. |
| Builds and static verification | Merchant production artifact exercised by the browser; separate Console production build; Gateway/Merchant/Console/shared-types checks and shared-types/API-client project compilation pass. Focused ESLint is clean; whitespace check passes. |
| Governance | Tenant isolation, domain boundary, session security, declared imports and the unchanged design-system ratchet pass. No full-platform gate or release acceptance is claimed. |

The Store Health golden was updated for the intentional new completion/evidence wording and inspected; its comparison tolerance was unchanged. Merchant desktop/390px and Console captures were inspected, and browser assertions reject horizontal overflow at 390px. These are synthetic viewport captures, not a full accessibility or performance certification.

An isolated source copy excludes environment files and generated output, reuses installed workspace dependencies, and uses the temporary official Flutter SDK from the previous pass. Every database/browser run uses ownership-verified disposable infrastructure. Earlier fixture failures—duplicate synthetic store names, hidden/ambiguous browser selectors, an incorrect native provider wrapper and missing fixture navigation—remain recorded rather than counted as passes. A native test command initially run from the repository root correctly refused the missing test directory; its subsequent full run uses the isolated mobile project. An initial SDK typecheck needed referenced declaration output; the actual shared-types/API-client project build subsequently passed.

Raw evidence, source fingerprints and screenshots are under `/private/tmp/letbuyy-readiness-health-20261021/`; the paired `MERCHANT_READINESS_HEALTH_2026-10-21.json` pins final runner receipts, exact counts, hashes and preservation checks. Existing dirty work and environment files are preserved. Both final runner receipts show zero skips/cancellations/failures, no cleanup failures and no remaining owned containers, networks or volumes.

## Remaining acceptance

Actual Android/iOS plugin builds, a physical/emulated phone journey, real domain/provider checks and hosted release acceptance remain open. Support migration 370 from the earlier task still needs controlled application before hosted use; this feature adds no migration. The checklist reports configuration and recorded evidence and does not approve publication, payments, verification or restrictions. No parent foundation phase is accepted by this bounded pass.
