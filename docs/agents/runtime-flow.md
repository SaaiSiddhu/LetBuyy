# Runtime Flow

## Merchant Auth And Session Flow

1. Merchant enters through accounts app.
2. Accounts app performs signup/login/OTP/OAuth/session actions through worker auth APIs.
3. Worker auth routes own custom session lifecycle and user/store bootstrap.
4. App-to-worker privileged calls use signed internal app/session headers.
5. Admin resolves `[store]` through worker ownership checks before accessing merchant data.

## Admin Operations Flow

1. Admin app reads the active store from route/session context.
2. Admin app proxies app-boundary requests to worker `/v1`.
3. Worker auth middleware resolves user context.
4. Store context middleware verifies site ownership, memberships, roles, permissions, and entitlements.
5. Worker services perform business logic and database writes.
6. Audit/outbox events are emitted where workflows require durable side effects.

## Public Storefront Flow

1. Wildcard routing maps host/store handle to tenant storefront.
2. Storefront requests public published store, product, page, navigation, blog, policy, and theme data from worker storefront routes.
3. Theme template resolver chooses route template.
4. Data-binding engine maps tenant data into approved renderer components.
5. Mutations such as checkout, customer actions, reviews, and contact forms preserve tenant context.

## Checkout And Order Flow

1. Client intent enters through storefront cart/checkout UI.
2. Worker rebuilds totals from products, variants, discounts, taxes, shipping, and tenant settings.
3. Order creation uses server-side workflow/RPC and reserves inventory where configured.
4. Payment initiation creates provider order/session from trusted server totals.
5. Provider verification validates signatures and reconciles payment/order state.
6. Webhook worker handles asynchronous provider events idempotently.

## Theme Lifecycle Flow

1. Shared schema registry defines valid section and theme settings.
2. Admin/editor creates draft changes against an installed theme.
3. Worker validates safe JSON, schema fields, blocks, and renderer references.
4. Preview sessions expose scoped draft previews.
5. Publishing creates immutable release state and storefront renders from active release.
6. Rollback points storefront to a prior release without arbitrary code execution.

## App Marketplace Flow

1. Public catalog/search/detail routes expose approved apps.
2. Developer and install actions require worker auth.
3. Store ownership is verified before install/review/developer actions.
4. Installed apps may receive signed outbound webhook deliveries through outbox workflow.
5. App permissions and integration contracts must be explicit before app side effects occur.

## Event And Queue Flow

1. Services write domain state and outbox/audit events in the same logical workflow where possible.
2. Scheduled worker cron claims due outbox events.
3. Queue service dispatches analytics and search projections currently.
4. Outbound webhooks are signed and retried according to delivery state.
5. Future queue categories must be connected to explicit consumers before being treated as operational.

## Webhook Flow

1. Provider sends webhook to `backend/workers/webhooks`.
2. Worker verifies provider signature before parsing side effects.
3. Event ID/idempotency key is recorded.
4. Payment, subscription, order, and inventory reconciliation is applied.
5. Duplicate events are ignored or reconciled safely.

## Mobile Flow

1. Flutter builder consumes the same domain contracts as web surfaces.
2. Dart services should not invent parallel commerce semantics.
3. Theme, order, payment, inventory, and auth behavior must remain compatible with worker APIs.
