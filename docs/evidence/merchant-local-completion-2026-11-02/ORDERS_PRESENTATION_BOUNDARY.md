# Orders frontend presentation boundary

The source22 collection cohort is archived and qualified separately. The next cohort remains within the owner's frontend-only assignment.

A private synthetic probe seeded one positive Orders read, changed the API request context, then made the current read return 403. The existing `OrderService.fetchOrders` returned its previous in-memory `OrderContract` rows instead of surfacing that denial. The negative result is retained at `/private/tmp/letbuyy-merchant-local-20261102-br1jhgh8/orders-read-policy-v1-negative.log`. The bootstrap creates one persistent `OrderService` provider; it does not recreate that instance on each account change.

The intended repair is presentation state and request lifetime in the existing canonical owner. It does not authorize new persistence, authentication or financial policy. The assignment explicitly allows UI controllers, presentation state and safe response-to-view mappings; Dart files still require classification by behavior.

Allowed changes in `OrderService` are limited to:

- Bind in-memory list rows, cursor and read freshness to the captured existing request context and original canonical query/cache key.
- Retire late or superseded UI reads before assigning rows or continuing the original cache write sequence.
- Surface current 401/403/404 and changed-context outcomes instead of replacing them with old private presentation rows.
- Preserve same-context, same-query offline presentation where the existing saved cache supplies it; label it as saved/unconfirmed in the UI.
- Expose read freshness as presentation metadata without changing the existing DTO or HTTP response meaning.

`CacheService` remains byte-identical. Its actor/environment key namespace, file format, cache keys, durable read/write APIs and retention policy stay unchanged. All existing order create/convert/status/fulfillment/line/refund/shipping payloads, idempotency, pending journals, approval checks and monetary calculations remain unchanged. No server, BFF, SQL, RLS, authentication policy, native integration or deployment change is included.

The protected-source readback will classify this narrow client presentation exception explicitly, as it already does for the retained Staff presentation cache/lifetime repair. Parsed preservation checks must prove the business methods and original cache key/payload expressions remain unchanged. The new negative must pass with populated controls; current denial, query changes, A→B→A, concurrent reads and late disposal need their own evidence. A presentation cache marker is never a permission grant.

Whole-app, durable offline revocation semantics, provider/hosted/iOS runtime and complete feature acceptance remain separate. If an intended correction requires changing one of the protected policies above, record the dependency and obtain the additional human scope before doing it.

## Detail read extension after source13/native20 terminal

The new populated `order_detail_read_presentation_test.dart` was run before this extension: **1 pass / 6 fail**. The old method returned saved detail after current401/403/404, returned/wrote a held former-context response, admitted a held result after disposal, and cached a different returned record under the requested ID. The unchanged same-owner offline positive passed. Exact negative: `mobile-ui-order-detail-v1-negative.log` in the existing private run root.

The next permitted extension is still client read presentation: bind each requested detail ID to the existing request context and read generation; check record identity and an optional captured store before admitting/caching it; expose live-versus-saved provenance; retire observed current denial and stale/disposed results. The optional store argument is an admission check only and adds no HTTP field or tenant authority. Preserve the exact existing detail cache key/payload, CacheService owner/namespace/retention, DTO meaning and all command/security/calculation methods. Current Detail UI must also stop short-circuiting to an initial/saved record without a live lookup; this service repair alone does not establish that UI gate.

No draft backend repair, new persistence or authorization policy is included. The actual draft failure remains in `ORDERS_DRAFT_BACKEND_DEPENDENCY.md`. Extend parsed preservation checks against source13 for the narrow detail read differences before qualifying the next cohort.

## Existing shipping capability read

The source3 governance31 diagnostic passes113 validators and fails the provider-mode evidence check. The former Detail badge was hardcoded Sandbox; removing it produced an honest but unconfirmed carrier mode. The existing server already exposes authorized `GET /v1/shipping/labels/provider-mode?store_id=…`, also present in the TypeScript SDK, with a separate `capabilities` record. Its reported runtime mode must not be mistaken for carrier-booking availability: the current server can report Sandbox while `capabilities.provider_mode` is unavailable and `carrier_booking_available` is false.

Complete only the client presentation: a read-only helper in the existing OrderService may call that existing endpoint through ApiClient, bind the original request context and selected store, and retire a late result. The editor requests it only when label purchase is selected or explicitly rechecked. Show the existing ProviderModeBadge from the received mode, retain an honest unavailable state, and bind booking availability to the explicit current server capability; preserve the independent manual path. No provider mode is inferred from environment, app configuration, selected carrier or a successful animation. No new cache, DTO authority, secret, endpoint/backend behavior, credential policy or shipping command semantics are added. All original shipping request fields/defaults, parser units, command/proof/key sequence and calculations remain unchanged.

The existing app-owned ProviderModeBadge keeps its public enum/parser/signature; presentation may compose the shared token-paired status primitive so its text is readable. The validator itself is preserved. Require populated mode/capability, denial, late retirement and exact unchanged shipping payload tests, then repeat current source qualification.

## Current canonical item read projection — frontend-only

Native23 on Order/Returns6 announced0items while its owned canonical COD fixture contained one order_items row, quantity1 and total199INR. The payload source was traced through orders.ts -> hydrateOrderItems -> checkout-core.normalizeOrderRecord. The current normalizer emits `item_count`, `items` and `order_items`, while Dart OrderContract.lineItems reads only `line_items`. This is a client presentation mismatch; it is not evidence that the backend failed to save the item.

The current list view reads the existing `item_count` first, validates a finite nonnegative integer for display, and uses its original quantity helper only for a valid legacy `line_items` projection when count metadata is absent. Missing/malformed measures are unavailable, not a model-default zero. The original `_orderItemCount` calculation, sorting, totals and command inputs remain unchanged.

Detail's view-only `_presentedLineItems` preserves a received `line_items` projection and otherwise reads the current `order_items`/`items` array, maps title to the existing LineItemContract name, and binds absent line currency to the actual raw parent currency. No conversion or ID invention occurs. The cached/SDK OrderContract remains byte-for-byte the original response, and original line editing/refund/MFA/journal command bodies still receive their original inputs. Real canonical payload fixtures verify readable quantity/price, unchanged cache/model and no enabled line editor from absent command records.

The current normalizeOrderItemRecord omits order-line IDs from the normalized array. This assignment does not repair that backend projection or enable commands without IDs. See ORDERS_CANONICAL_ITEM_REFERENCE_DEPENDENCY.md. Current-source native read/form/keyboard/readback acceptance remains separate from these fixture tests.
