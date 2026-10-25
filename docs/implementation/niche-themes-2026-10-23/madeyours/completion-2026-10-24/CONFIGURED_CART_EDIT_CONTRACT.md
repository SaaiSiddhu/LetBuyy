# Configured cart edit — required contract, not yet admitted to Main

Independent decision `MY-G05-REVIEW` in the programme's `PHASE0_INDEPENDENT_REVIEW.json` keeps the approved inline configured-cart edit promise open. The old agent execution amendment's remove/re-review/re-add recipe does not by itself remove that promise. No direct human acceptance changing it has been established here. Preserve the original23 recipe/history while adding a separate real edit acceptance; never silently treat the alternative as feature completion.

## Actual reusable owners

- `apps/commerce/web/src/lib/theme-engine/liquid-hydration-islands.tsx`: existing `LiquidCartItem.serverLineId`, `cartItemKey`, safe saved `nicheSnapshot`, strict `personalization`, canonical whole-line input mapper, cart fetch/mutation and open/change events. Current cart markup supplies quantity and Remove controls; no configured-line edit control was found in this source.
- `apps/commerce/web/src/lib/theme-engine/madeyours-personalization.ts`: existing `bindMadeYoursPersonalization` controller, variant/context freshness, canonical draft validation, explicit normalization consent, last-valid preview and deliberate Review. The controller intentionally owns no cart or storage mutations. Reuse it; do not create another configurator or weaken acceptance to generic properties.
- `personalization-review-client.ts`, canonical cart BFF/gateway/cart core: existing no-store current product/variant facts and server review fingerprint, same cart token and strict whole-line replacement. Price/version/hash/snapshot remain server authority.

The actual exact file/base pins are captured in CAPABILITY_INVENTORY/SOURCE_RECONCILIATION; the allocator must revalidate before a writer lease. At the initial contract checkpoint no source change was proposed. Private02 now implements the existing endpoint/controller flow and proposes paired unnumbered atomic SQL helpers; no Main source or schema has been changed by that private work. Native and browser acceptance remain required.

## Intended connected interaction

On a normally loaded owned cart line with a valid saved personalization snapshot, offer an accessible Edit personalization control within the current cart workflow. Bind to the actual server line key (the canonical composite product/variant/configuration identity, not an independent UUID) from this scoped cart, never product label/index alone. Open the existing bounded configuration/review content in the cart's established accessible panel/dialog language; preserve MadeYours visual identity and selected variant. Use the current canonical variant UUID and saved exact text/method/style/placement IDs as editable input, then fetch fresh no-store review context. Saved accepted labels are historical display, not a new capability authority. Missing/revoked choices remain visible as unavailable and require explicit supported selection; do not silently substitute the first current method.

Editing changes only a private transient draft. The accepted original line, quantity and full cart remain unchanged until one canonical replacement command is acknowledged. Show the last accepted/last-valid preview distinctly. Invalid text, failed review-context fetch, outdated facts, unavailable variant, stock/price conflict, network failure or Cancel retain the exact draft when appropriate and retain the original accepted line. Explicit Unicode suggestion acceptance and a new Review are required. No customer text, cookies or cart token enter URLs or logs.

After deliberate Save reviewed changes, build one proposed whole-cart replacement from current canonical readback: retain every unrelated line; replace only the exact original line's configuration at its current quantity; merge an exact resulting same-configuration sibling only under the existing canonical identity rule. Keep the same cart and original mutation intent/idempotency key for uncertain retry. Never issue Remove first followed by Add, and never optimistically erase the old line before acknowledgement. Commit UI/storage only from the canonical response, preserving server line identities, aggregate same-SKU inventory truth and returned prices/facts. Reconcile an unknown outcome before allowing another edit or checkout commitment.

If another tab changes/removes the line while editing, do not overwrite that newer cart using an old snapshot. Determine the canonical existing version/conflict/readback support before implementation; if it cannot safely reject/reconcile a stale whole-cart write, request the smallest correction in the existing cart authority, under the same single-writer lease. Do not invent a parallel local revision, new cart or second API. This concurrency contract is an explicit prerequisite, not a claimed existing guarantee.

After acknowledgement, close/return focus to the same cart context, announce the accepted result, and show the exact returned production summary. Cancel/escape return focus without a mutation. A pending/invalid edit must not disappear behind a new checkout commitment; the user explicitly resolves or cancels it.

## Finite acceptance slice for the canonical owner

Use source/unit tests for the real controller/identity/serialization boundaries, mounted existing cart API/owned PostgreSQL for atomicity/conflicts/idempotency, then actual installed drawer and full-cart browser paths. Required witnesses:

1. Asha1/Kabir1 on the same Moss UUID -> edit Asha to Asha-Rae -> one acknowledged replacement; Kabir, quantity, cart identity and inventory unchanged except expected canonical acknowledgement/telemetry.
2. Invalid text/Unicode suggestion/context failure/expired facts/OOS/overstock preserve old accepted Asha plus exact editable draft and last-valid preview; no silent replacement or generic fallback.
3. Cancel, Escape and unsaved navigation preserve the accepted line and context; keyboard/focus/announcements work at actual320/390/768/834/1440 and200% text.
4. Variant/method/style/placement changes invalidate the earlier Review; saved written instructions exactly match the current server acceptance.
5. Same-result merge follows canonical configuration identity; different names stay distinct; aggregate same-SKU stock cannot be bypassed by editing.
6. Lost acknowledgement, exact same-intent retry, duplicate Save, concurrent tab mutation/removal and stale version yield one effect or explicit conflict/recovery without overwriting unrelated lines. Record exact observed HTTP/DB effects; no invented status.
7. Checkout waits for resolve/cancel; the real normal COD and Razorpay Test Mode orders contain only acknowledged edited instructions. Later catalogue edits never rewrite those historical snapshots.

This acceptance belongs to `MY-C-DESIGN-6` and its cart/history/security/quality cases. Original MY-13 remove/re-add remains a separate retained regression. No new pass, source grant, browser lease or change to frozen2.0.0/M1 is implied.
