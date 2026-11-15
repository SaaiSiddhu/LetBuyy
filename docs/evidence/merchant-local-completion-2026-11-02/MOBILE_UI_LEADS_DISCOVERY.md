# Merchant Leads source and caller discovery

Reviewed the complete552-line LeadsScreen, complete FormSubmissionService, canonical Dart FormSubmissionsApi, both actual route entries and provider registration, and the current Gateway form-submission routes. This is source/caller discovery only; no current native/provider acceptance or unauthorized effect is demonstrated.

The canonical API already accepts page/limit and validates list queries/status payloads. The Gateway scopes rows and mutations to current owned stores. Preserve that owner policy and the existing CMS normalization owner; do not introduce a second submission authority.

Candidates requiring populated controlled reproduction before repair:

- The screen retains its first store ID with `??=` and observes neither store changes nor account/request generation. The SDK rejects requests whose captured context changes during transport, but it does not retire a private roster already rendered by the screen. Compose A/B/ABA/account/provider cases before choosing a UI repair.
- Filter changes can start overlapping reads without a generation guard. A slower previous query may replace newer selected-filter results. The service similarly owns one unscoped mutable list/loading flag.
- Only the first50 submissions are read although the SDK returns pagination metadata; filter counts are derived from that filtered page and displayed as totals. Unknown/partial data must not become complete counts.
- Update/delete retain record callbacks, allow duplicate commands while pending and call `setState` after await without mounted/current-view checks. Destructive delete has no confirmation. Reproduce actual current/retired/busy/reply-lost behavior; preserve backend effects and original intent before adding recovery machinery.
- Raw exception text appears in visible load/mutation feedback; denial/unavailable/uncertain outcomes need distinct truthful states. Contact/full-name truncation, fixed-height filter rows and long-text/keyboard access need composed checks.
- Gateway errors expose raw database messages and its deleted-at compatibility fallback needs qualification. This review changes no backend source and grants no provider/hosted operation.

Next use the existing MerchantStoreView and captured ApiClient request context, canonical shared feedback/confirmation and current pagination protocol. No data deletion, provider delivery or business-policy expansion is authorized by this review.
