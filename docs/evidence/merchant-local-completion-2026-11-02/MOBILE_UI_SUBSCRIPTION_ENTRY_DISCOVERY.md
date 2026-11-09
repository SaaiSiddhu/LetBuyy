# Pricing, checkout and payment connection source discovery

Complete source reviewed: Pricing459 lines, RazorpayCheckout315, ConnectRazorpay659, SubscriptionService629, the catalog projection and canonical PaymentConfigModel308. Actual named routes, the thin Upgrade alias, Dashboard/Settings/Billing callers, Dart SDK methods, Gateway checkout/recovery/verify ingress and payment-config read/save were traced. These are six existing nonadditive surface rows, not six accepted features. Provider execution and real sandbox acceptance remain separate.

Existing authorities to preserve:

- Pricing uses the current persisted catalog and saved checkout amount/tax, with an explicit review if the saved amount differs. Plan/period matching and saved tax checks precede the provider page.
- The Gateway verifies current ownership, persisted actor/site/plan/period/reference, signature and captured provider evidence before activating a subscription. The final response contains the saved subscription; client activation must be tied to that acknowledgement.
- Connection supports merchant-owned sandbox and explicit managed test connection. Backend encryption/credential verification, expected revision, original request key and explicit online enablement remain authoritative. The canonical model does not deserialize secrets and cannot claim live bank readiness.

Candidates requiring composed reproduction before repair:

1. Pricing's plan and price-confirmation surfaces lack the complete originating StoreContext/provider/route lifetime. Confirmation calls `_initiatePayment` using mutable `_store`; store/account changes while a review is open require tests proving zero new checkout dispatch and preserved original intent.
2. Initial asynchronous loads use epoch/ID rather than the complete selection generation/provider identity. A→B→A, equal-key provider replacement and covered routes need populated positive controls across all three screens.
3. Checkout's JavaScript callbacks check mounted/busy state, then navigate after verification. Original view, actor/store and route ownership must be checked around those awaits; malformed acknowledgements must not become confirmed activation. SDK and server validation already protect payment proof and must not be weakened.
4. Provider navigation URLs, WebView bridge boundaries, raw error presentation, close-during-verification and unknown payment outcome require source/provider-contract tests. Do not invent an allowlist that breaks legitimate bank/payment handoffs or replace the canonical provider flow without authority.
5. ConnectRazorpay does not subscribe to the complete view lifetime. Credentials, retry fingerprints and replacement state require current-account/store retirement tests. Its success dialog performs two generic navigator pops; a retained callback must not pop a covering/new destination.
6. Managed test connection displays success after model conversion without an explicit current verified acknowledgement check in that widget. Malformed/foreign/unavailable acknowledgements need positive-control tests before changing presentation. The server still performs real credential verification before committing a successful save.
7. Connection fields/secret visibility actions, fixed-height primary controls, short confirmation surfaces, large text and hardcoded status presentation need migration through the existing shared mobile owners. Preserve the visual identity and secret-handling boundaries.

The existing checkout journal's environment/issuer and queued-context candidates are recorded in `MOBILE_UI_BILLING_DISCOVERY.md`. No original key, price, formula, provider, secret-storage representation, live payment gate or cancellation behavior was changed or exercised in this source-only review. Unclear retained money-intent ownership requires a concrete human decision before dependent work; continue independent repairs meanwhile.

Source remains frozen for the current StoreSwitcher/Staff acceptance. No provider charge, real credential, hosted action or new runtime was used by this review.
