# Merchant KYC source and caller discovery

Complete screen/dialog (863 lines) and service (468 lines) were reviewed, together with the actual named/alias routes, Settings caller, KycService provider, Dart KycApi and Gateway KYC route. These are two existing nonadditive surface candidates. This review is not implementation or runtime acceptance.

The canonical Gateway derives ownership, status and required documents, redacts evidence metadata, and rejects reference-only JSON submissions with410. Deployed private intake remains gated; India direct uploads require the existing owned-test environment. Client projections must preserve those gates. No provider, real document, hosted upload or status change was performed.

Existing client protections include captured SDK context, operation generations, returned site/document binding, unavailable-upload rejection before file reading, JPEG/PNG signatures and5MB maximum, exact India S3 HTTPS destination and object-key binding, a separate credential-free multipart client and required object-version acknowledgement. Refresh retry keys remain bound to store/document/evidence revision. Sandbox/reference-only acknowledgements do not render as live verification.

Candidates requiring composed reproduction before repair:

1. `_load` captures account epoch before awaiting initial selection, then captures the new selection key after that await without verifying the returned store is still selected. An A→B selection in that interval may bind an A overview read to B's frame. Existing post-request checks do not explicitly compare the selected store ID to the requested store ID.
2. Equal-key StoreContext/KycService provider replacement does not visibly invalidate the request generation or existing projection. Late response acceptance must be tested with populated positive controls.
3. The upload dialog is dismissible while a write is pending; Close remains enabled. A fresh dialog may create a new intent after an uncertain acknowledgement. Server receipts and retained upload recovery must be traced before choosing a repair; do not create a parallel receipt system.
4. Missing or malformed document/requirement lists become empty display lists. Unknown must not be certified as an empty successful overview; reproduce against actual service acknowledgement parsing.
5. The short form uses a generic AlertDialog and hardcoded status colors. Current reference validation permits2–4 alphanumeric characters, while the label says digits. Preserve the actual business rule and existing identity when migrating through shared mobile composition.

The source candidates do not demonstrate an unauthorized backend effect. Current owner-only KYC policy, evidence gating, original idempotency and protected storage behavior remain authoritative. A StoreSwitcher device acceptance run holds product source frozen during this read-only review.
