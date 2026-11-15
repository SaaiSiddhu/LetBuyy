# Discounts presentation discovery — source read only

Historical discovery; active Coupon implementation and current qualification are now in MOBILE_UI_COUPONS_PROGRESS.json and MOBILE_UI_SECURITY_PROGRESS.json. Gift-card gates remain unchanged.

Current work remains frozen Warehouse4 while Android36 executes. No Discounts source has been changed and no Discounts migration/acceptance is claimed.

## Read owners and entries

Read the complete Coupon list/form and Gift cards widgets; complete CouponService; ProductService gift readers, issue method and original GiftCardContract/Input; SDK Coupon and Product gift methods; generated CouponContract; route specifications and existing rendering tests. Routes `/coupons` and `/features/coupons` share CouponsScreen. The `/gift-cards` and `/features/gift-cards` specifications name GiftCardsScreen, but further route-owner review confirms V1CapabilityPolicy defers both IDs before their builders execute; the actual routed surface is the canonical gated page. No normal direct GiftCardsScreen push caller was found. CouponForm uses the existing named route with storeId/coupon. These aliases are nonadditive. Remaining normal menu discovery and source-wide caller review still open.

## Current supported authority

CouponService calls the existing paginated `/coupons` reader (page1/limit50 unless supplied), create/update/delete/validate endpoints. It exposes rows but drops page metadata; totals in the current widget are only loaded-row folds. No all-population statistics can be claimed. Preserve original active query, exact payload, create omission versus patch null-clear, uppercase code, limits/defaults, validators, original service/SDK/model bytes and helper calculations.

GiftCardContract/Input live in ProductService. Original reader uses `/products/gift-cards`; original issue uses SDK create and its existing automatic idempotency key per invocation. It exposes no durable key/recovery interface. Backend already has additional balance/status/transactions capabilities, but these are absent from the current Dart public interface. Completing those transport/domain/recovery contracts is a dependency under the frontend-only authority; do not add persistence or a parallel issue journal. Never automatically retry an uncertain issue as a fresh request. Whole Gift-card web parity remains open.

## Source-supported candidates to reproduce

Both lists retain `_storeId` via `??=` and only mounted checks after async work: stale query/store completion, covered callbacks and feedback require meaningful UI tests. Empty lists show numeric zero before a successful read. Coupon counts and gift balance describe fetched rows, not a proven global population. Fixed-row toolbars/metrics, long metadata and gift codes need small/large-text tests. Coupon complex editor lacks dirty Back and duplicates native fields/header/save geometry. Validation and gift issue use centered forms; controllers outlive neither the modal transition nor delayed completion reliably. Gift issue calls setState after await without a mounted/current-scope guard. Mutation busy/unknown/reopen behavior needs real negative coverage, keeping original operations and exact result meanings.

## Financial preservation boundary

The existing Coupon editor initializes value with `toStringAsFixed(0)` and original model helpers coerce absent numeric/status values. Initial discovery treated this conservatively as a dependency; the later canonical contract readback below distinguishes erroneous UI input formatting from authoritative financial calculations. Preserve server/model calculations and exact stored values, correct safe presentation mappings, and never fabricate a paid/card result.

## Proposed next frontend work (not implemented)

Reuse canonical list/header/metrics/feedback, scoped current-view guards, one scrolling owner, exact applied query labels and explicit page navigation where supported without inventing has-next metadata. Coupon form stays a durable full-page editor with shared fields and live dirty/busy Back. Validation and bounded gift issue become canonical sheets, retain exact original parsing/defaults, and keep controllers until actual route completion. Scope responses/drafts/feedback to actor-store-generation and current route. An uncertain operation stays a warning/review state, without fresh retry or claimed cancellation. Keep protected service/SDK/model/backend bytes identical, add precise preservation comparisons, then composed tests and existing safe integration only. Missing recovery/status/transactions acceptance stays explicit.

## Route-policy reconciliation (source readback)

Current `AppRoutes._buildConfiguredRoute` checks V1CapabilityPolicy before constructing the named widget. Both Gift-card IDs are deferred, so the list/issue body inspected above is retained gated source, not an active normal mobile flow. Its recovery/transport gaps remain reasons not to call it ready or activate it. Preserve the existing gate and blocked-state meaning. A direct widget test can render retained source but does not prove live reachability. The current frontend assignment does not authorize changing activation or authentication policy. Active Coupon UI work may continue independently; any Gift-card body migration would remain unactivated and cannot close end-to-end acceptance.

## Canonical contract readback for the next active Coupon cohort

Read the mounted Coupon route, checkout-core Create/Validate/List query schemas, normalization/create/update/validation plans, shared Coupon schema, web Coupon facade and actual web editor fields. No source edits during Warehouse6/native38. These findings supersede the earlier provisional instruction to preserve an erroneous UI transform merely because it exists:

1. `ListCouponsQuery` supports `status=active|expired|all`. Existing mobile CouponService sends `is_active=true`, which is not that schema field and therefore does not apply the promised Active filter. Correct the frontend transport binding to the existing canonical status meaning; no server filter or permission rule changes.
2. Existing canonical `value` is a number and permits fractional values. Web edit preserves it with `String(coupon.value)`. Mobile initializes its text field with `toStringAsFixed(0)`, silently changing the saved input before an edit. This is a frontend response-to-input precision defect. Retain the exact existing value/units in the controller while preserving payload parsing, validation and server calculations. This does not authorize changing financial rules or the domain model.
3. `/coupons/validate` returns `{valid:false,reason:...}` on a normal200 and `{valid:true,coupon,pricing_authority:'checkout'}` when available. It checks code availability; checkout alone determines final discount amounts/eligibility. Existing mobile reads `message` and otherwise says Coupon is valid, so even a rejection takes that success fallback. Present actual valid/false/unknown outcomes and existing reason, with explicit checkout authority. Do not compute a discount or declare cart acceptance.
4. Normalized raw rows retain `usage_count`; the web facade maps it to `used_count`. Mobile currently reads only `used_count`, so observed usage may become a fabricated0. Add a safe response-to-view mapping from the existing authoritative field, preserving true0 versus unavailable and original units. No counter mutation or new calculation.
5. The existing SDK returns real page metadata; CouponService drops it. If exposed for current page/scope presentation, complete this existing read owner with bounded original queries and identity/query retirement, while retaining every create/update/toggle/delete/validate command/payload and all persistence/SDK/server/model bytes. Classify and prove any read-only presentation exception in the protected-source ledger; no parallel service or journal.

The active editor also needs the existing web Start date field through the already supported `starts_at` contract, without inventing new timezone/activation policy. Existing mobile-only optional max discount/per-customer/description fields remain. Web facade fixed_amount maps to canonical fixed; preserve the actual wire type. Gift-card and third-party-app activation gates remain unchanged.
