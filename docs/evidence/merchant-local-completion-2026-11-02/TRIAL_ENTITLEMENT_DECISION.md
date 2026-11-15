# Fresh-trial entitlement decision

Decision proposal only. No new migration allocation, entitlement grant, trial extension, provider operation or hosted action has been made.

## Observed contract

Normal unseeded local Merchant signup, email OTP, password creation, store creation and named dashboard navigation succeeded. The new store has its actual persisted14-day active trial, Circuit default and zero products. Native Workerd/R2 media upload and exact320x320 PNG readback succeeded. The normal first product create then returned503 ENTITLEMENT_AUTHORITY_UNAVAILABLE and preserved its draft. Run395c869fcade, source6b765122cdf2cc9f3642f099eccb2e862054070012455d4dd819f097af259e56; all source inputs held and terminal verified; owned cleanup empty. Later Core/buyer assertions were not reached.

Existing migration416 assert_product_creation_limit_v1 correctly requires a persisted numeric/null product quota before INSERT. Its resolve_site_entitlements owner (baseline) selects an active/trialing subscription, otherwise plan `free`; it does not use sites.trial_status/trial_ends_at. The current persisted store catalog contains Launch/Growth/Scale/Commerce OS. There is no corresponding persisted free-store allowance. The TypeScript fallback `free`25-product preset is explicitly labelled interim/local-test and must not be silently promoted to commercial authority. Earlier focused creation fixtures declared synthetic persisted overrides; those are useful quota tests, not fresh-trial proof.

Onboarding currently redirects to Select a plan. Sources establish saved trial dates but do not resolve whether product creation before paid-plan selection must be allowed. That is a product/entitlement decision, not permission to bypass the quota guard. Primary read-only comparison also still defines this resolver only in its baseline; no newer reviewed trial resolver was found. No primary source has been imported.

## Concrete recommended source/local contract

For a new store with no eligible active subscription, use the current active **persisted Launch** entitlement catalog only while its existing saved trial_status is active and database time precedes saved trial_ends_at. Preserve saved dates and0% transaction fee; choosing a plan must not reset trial dates. Use existing canonical resolve_site_entitlements as sole authority; no app-local fallback, client-selected quota, privileged bypass, parallel trial engine, extra runtime or invented free plan. Existing persisted override precedence and valid paid subscriptions remain authoritative.

Qualification must prove fresh normal first-product creation, expiry/cancel/frozen refusal, missing/malformed Launch catalog refusal, missing/foreign site and live owner/staff controls, explicit zero override refusal, saved-date preservation, quota concurrency and normal web/native readback. Any SQL change needs the pending numbering reconciliation, a reviewed paired rollback/provenance, owned retained-data/role/concurrency checks, and source/local qualification. This proposal authorizes no hosted execution, billing transaction or deployment.

Alternative: require explicit normal plan selection before catalog creation. Then the product UI/API must explain the required plan step rather than report a temporary infrastructure outage, preserve drafts, and prove the normal local plan-selection/provider-fixture workflow before retry. Do not seed a trial grant or change tests to label the current refusal as successful fresh-trial acceptance.

AGENTS.md PRIME-R1 requires a human decision when correct architecture/scope is unclear; the attachment forbids invented commercial terms/allowances. The existing migration-number question remains separate and pending. Source work that does not depend on either decision can continue.
