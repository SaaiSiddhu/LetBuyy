# Coupon presentation migration — 5 November 2026

Continue the existing whole-app frontend task in this exact worktree. The prior temporary run is unavailable; its native38 outcome is unconfirmed. Seven existing Warehouse contrast/focus/choice regressions passed afresh. Historical broad results remain historical receipts.

## Preserved authority and bounded changes

The canonical mounted `/v1/coupons` route, existing SDK, shared CouponContract, StoreContext, server authorization, discount calculations, command/idempotency behavior and persistence are unchanged. Complete the existing CouponService reader only: correct `status=active|all`, expose supplied page metadata, reject mismatched rows/late context, and retire read notifications at disposal. Keep complete create/update/toggle/delete/validate method bodies unchanged. This is a sixth, specifically scoped client read/presentation exception; no new service, domain model, journal or backend is authorized. Capture preimages and compare parsed protected method bodies plus all other source bytes.

## Connected compositions

- Coupon list: canonical responsive header, one lazy scroll owner, supported active/all filter, bounded page navigation from actual metadata, explicit matching versus loaded-row counts, true zero versus unknown usage, coherent labelled refresh, denial clearing, actor/store/query lifetime, covered/disposed action guards.
- Complex create/edit: canonical full-page editor, original native validation/helpers/payload rules and optional-create omission preserved; exact response value initializes input; expose existing starts_at raw ISO field as on web (no timezone policy change). Original currency/type/precision/server authority preserved. Dirty Back, busy duplicate prevention, visible uncertainty and explicit review without automatically creating a fresh operation.
- Validate: canonical short sheet with widget-owned controllers through route disposal; keep original service input semantics. Distinguish `valid:true`, `valid:false` and unknown responses. Explain checkout decides final eligibility/amounts. No financial calculation or buyer acceptance claim.
- Remove action: canonical explicit confirmation, explain existing endpoint deactivates. Do not claim physical deletion. Preserve operation and current-store/readback guards.

## Verification

Reproduce existing binding/precision/false-success/missing-usage defects before fixes. Then meaningful service/SDK and composed widget tests: long records, 320dp/large text/light/dark, loaded-page scope, page/filter params, held refresh and 401/403/503, A-B-A, covered/disposed callbacks, keyboard/form/dirty/busy, original optional/null payloads, exact fractional roundtrip, uncertain completion without retry, validation true/false/unknown. Run analysis and relevant existing regressions; full suite only after coherent source changes. Native/web/database/iOS runtime/provider acceptance remains separate and open. No release or whole119-feature claim.

Gift-card/app capability gates and theme51 freeze remain unchanged.
