# F3.3 provider eligibility and live split gate — 4 October 2026

Checkout: `LetBuyy-phase2`, branch `letbuyy/phase2-shared-buyer-identity`, HEAD `0862687a5008d604d0df23357b2eb511293139fa` before this slice. Existing checkout changes remain unstaged and preserved.

## Current primary-source findings

- Razorpay's current [Route documentation](https://razorpay.com/docs/payments/route/) lists an eligibility floor of domestic turnover above ₹40 lakh or export turnover above ₹5 lakh in FY26 or FY25, evidenced by GST-3B returns or bank-issued FIRC respectively. It also requires a linked account to directly interface with the customer's goods/services and a written Route use-case declaration reviewed by Razorpay. The page says the submission deadline for existing Route users was 31 December 2025 and directs disabled accounts to support. These are Razorpay's published requirements; they do not establish LetBuyy's turnover, submitted evidence, approval, current account state or reinstatement.
- Cashfree's [Easy Split developer documentation](https://www.cashfree.com/docs/api-reference/payments/latest/split/easy-split-overview) documents vendor onboarding, order-level static or post-payment splits, settlement schedules, refund and adjustment paths, settlement details and reconciliation. It does not publicly confirm LetBuyy's account eligibility, contract, current sandbox parity, marketplace role approval or the owner's desired weekly eligible settlement cycle.
- RBI's [Master Direction on Regulation of Payment Aggregators, 2025](https://www.rbi.org.in/Scripts/BS_ViewMasDirections.aspx?id=12896), dated 15 September 2025, distinguishes a PA that aggregates customer funds and settles them to merchants from a payment gateway that supplies technology without handling funds. It says PAs aggregate only for merchants with whom they have a contractual relationship and that a PA business shall not carry out marketplace business. The applicability to LetBuyy's exact contracting/funds-flow structure needs Indian counsel and provider confirmation; code or an adapter cannot resolve that classification.

## 4 October official provider-terms refresh

Razorpay's currently published [Terms & Conditions](https://razorpay.com/terms/) state that a merchant's use must match the categories registered during onboarding or otherwise approved in writing (section 2.14); a marketplace must accept payments only for sellers it has onboarded and with whom it has a contractual obligation (section 2.22); and marketplace collection terms apply only when accepting on behalf of sub-merchants, with the platform onboarded as a master merchant and seller authorization available on request (sections 1.14–1.17). The current [Route product page](https://razorpay.com/route/) describes linked accounts, transfers, reversals and configurable settlement holds, but marketing/API capability does not establish that LetBuyy's account, entity, seller contracts, weekly eligibility rules or exact COD/refund flow is approved.

**Decision consequence:** the published terms reinforce the existing fail-closed D08 gate. They do not establish an account-specific approval or decide LetBuyy's legal classification. Keep marketplace online intent creation disabled until provider-written acceptance covers the actual contracting entity, seller onboarding/authorization, permitted categories, funds flow, settlements, refunds/chargebacks, COD treatment and reconciliation; obtain counsel review for regulatory classification. This is a source refresh, not legal advice, an owner policy decision, or a provider sandbox result.

## Engineering consequence

Provider credentials alone are not acceptance evidence. Live Razorpay Route payout and PA-split settlement ingest now also require a provider-specific, non-secret approval-reference configuration. Live COD-remittance records must use the COD or manual provider classification, and PA-split records must use the supported Route provider. The current settlement/payout execution path is Razorpay Route-specific; therefore Cashfree Easy Split live settlement ingest is explicitly unavailable until a provider-specific execution and reconciliation adapter exists. Sandbox behavior is unchanged. The reference parser rejects missing values, obvious placeholders and unsafe content.

Marketplace hosted checkout now also rejects Razorpay payment-intent requests at the Gateway boundary while D08 remains unresolved. The check runs before the idempotent payment step because the storefront Razorpay flow creates a pending order before it calls the provider. An owned-Postgres regression verifies that a marketplace request leaves no order or payment intent. This blocks marketplace online collection in sandbox and live modes; it does not change COD or storefront payment behavior.

This is deliberately a fail-closed configuration gate, not proof that the referenced contract, counsel opinion or provider eligibility is valid. No references were configured, and no provider mode, credential, account or hosted setting was changed. No provider request, funds movement, settlement or deployment occurred.

The normal payment capability remains gated until LetBuyy's contracting entity, provider's direct/linked merchant model, sellers/transaction categories, weekly-eligible settlement semantics, refunds/chargebacks, grievance responsibilities, payer-payee transparency and reconciliation contract are confirmed. Never route funds through LetBuyy custody to work around an eligibility rejection.

## Verification

- Gateway money/settlement/payout tests: **16/16 passed** (`money.test.ts`, `settlements.test.ts`, `payout-provider-client.test.ts`).
- Payments-domain unit tests: **5/5 passed**, including missing, placeholder, malformed, mismatched-provider and provider-configuration negative controls.
- `pnpm --filter @letbuyy/api-gateway typecheck`: passed.
- `pnpm --filter @letbuyy/payments typecheck`: passed.
- `git diff --check`: passed.
- No provider sandbox credentials/accounts or owned database were used; no settlement endpoint was called against a provider.

## Next work

1. Resolve the PA/marketplace legal classification and entity-specific provider requirements with counsel and the provider; preserve written evidence identifiers.
2. Confirm whether either provider supports the approved weekly eligible settlement policy, partial refunds, holds, chargebacks, COD, seller onboarding and reconciliation for LetBuyy's actual account.
3. Only after acceptance evidence exists, configure the matching provider-specific reference in the chosen environment and run a real provider sandbox end-to-end journey. Provider and legal acceptance remain open; Phase 3 and the eleven-phase goal remain open.

## 5 October correction — settlement payout transaction boundary

The local payout writer now creates a Route payout instruction only when the
recorded PA-split settlement itself names `razorpay_route`. A Cashfree sandbox
settlement can still be recorded with its settlement ledger/event, but it does
not fall through to Route statement, payout, item or `payout.scheduled` writes.
This prevents provider/rail misbinding; it does not add a Cashfree adapter or
change the live provider/legal gate. The route behavior is covered by the
[owned settlement payout atomicity evidence](F9_SETTLEMENT_PAYOUT_INSTRUCTION_ATOMICITY_2026-10-05.md).
