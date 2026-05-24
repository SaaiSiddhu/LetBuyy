# Anti-Patterns And Risk Regions

This file captures source-derived risks found during repository analysis. It is not a blame log; it is a map of areas future work must handle carefully.

## Duplicated Logic Regions

- Auth/session work exists in accounts app helpers, admin helpers, worker auth routes, worker auth middleware, and internal signing utilities.
- Payments appear in worker payments routes, storefront payment routes, webhooks worker, subscription checkout UI, and provider-specific verification paths.
- Theme data and schema concepts appear in API types, worker services, storefront renderer/data-binding code, admin editor code, and theme marketplace.
- App-boundary worker clients exist separately in accounts, admin, storefront, app-store, and theme-marketplace.

## Dead Or Dormant Code Regions

- Console and team apps are scaffold-level and should not be assumed production-ready.
- Flutter super admin and team apps are scaffold-level.
- `packages/dart/ui_kit/lib/src/themes/app_theme.dart.broken` indicates broken/dormant UI kit debt.
- Several generated docs and architecture reports are historical snapshots and require source validation before use.

## Over-Coupled Modules

- Large worker route modules, especially storefront and payments, mix protocol parsing with multiple business workflows.
- Storefront theme rendering combines route template resolution, tenant data binding, and React renderer mapping; changes require careful end-to-end verification.
- Admin app route handlers proxy many worker endpoints and can drift from worker contracts.

## Circular Dependency Risks

- Historical lint output reported circular serialization problems in app-store and theme-marketplace ESLint flat config with React configs.
- Shared packages must remain app-free to prevent workspace dependency cycles.
- Theme schemas must flow from shared contracts to worker/storefront/admin, not back from app-specific UI into contracts.

## Infrastructure Weaknesses

- `.github/workflows` was not present in the scan, so CI/CD enforcement is not established in source.
- `vercel.json` uses an install workaround that deletes app-local Next copies; it must remain deployment workaround only.
- Worker KV/R2 bindings were partly commented in scanned wrangler configs; production binding parity needs review before relying on storage paths.

## Build System Risks

- Historical typecheck blocker: worker upload route `File` conversion issue.
- Historical lint blocker: app-store/theme-marketplace lint config circular structure.
- `backend/workers/api/dist/*` is generated output debt if tracked.

## Frontend Consistency Issues

- Static scan found 185 client component files and 155 inline style files.
- Shared `packages/typescript/ui` is minimal relative to the number of app surfaces.
- Admin, app-store, theme-marketplace, storefront, console, and team can drift unless design-system extraction is deliberate.

## Design System Drift

- Web icons must use Lucide React; Flutter icons must use Material Icons.
- Reusable controls should move to shared UI only after two or more real app usages.
- Storefront presentation can be brand/theme expressive; admin and internal tools must stay dense, operational, and consistent.

## State Management Chaos

- `localStorage` appears broadly and must remain limited to non-secret preferences, preview state, or customer-safe UI persistence.
- Merchant auth tokens must never be stored in `localStorage`.
- Storefront customer session state and merchant session state must never merge.

## API Contract Inconsistencies

- Some worker routes use schemas and services; others still parse raw JSON.
- Error envelopes mix patterns such as `successBody`, `errorBody`, and `failureBody`.
- App-local APIs vary between signed session forwarding, signed app requests, static internal secrets, and service wrappers.

## Event System Inconsistencies

- Outbox events define broader categories than currently consumed scheduled queues.
- Webhook inbound processing and outbound webhook deliveries are separate mechanisms and must not be conflated.
- Audit events may be best-effort in some optional-table paths; production operations need explicit guarantees.

## Documentation Gaps

- Generated docs exist but can become stale quickly.
- Commerce OS audit docs exist without a single root index.
- This `docs/agents` tree must be updated after architecture-significant changes.

## Testing Gaps

- Only 3 test files were detected and they are Flutter default-style widget tests.
- Missing critical tests include tenant isolation, auth/session, payments, webhooks, order state transitions, inventory reservations, theme publishing, app installs, admin proxies, and storefront checkout.
