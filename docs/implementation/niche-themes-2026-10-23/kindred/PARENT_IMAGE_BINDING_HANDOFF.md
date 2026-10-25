# Gift image association in the canonical merchant form

The client no longer resends unchanged gift-role indices against a changed photograph order. It carries a UI-only `giftMediaImageOrder` in the existing product draft snapshot, rebases proven URL identities through the canonical helper, and commits the resolved facts with each media mutation. An explicitly chosen current image wins. Removed or ambiguous roles stay cleared when an image is added again.

The sole lease covers the existing product page, `NicheFactsEditor`, `product-form-state`, `product-facts-draft`, and their matching tests. All other owners' work is preserved. The exact pre-lease live files and hashes are under `/private/tmp/letbuyy-kindred-parent-before-image-binding-20261023/manifest.json`; `parent-lease-manifest.json` and `parent-review-*.diff` isolate this change from the repository's earlier dirty baseline.

## Implemented behavior

- Fresh record normalization associates raw gift facts with the loaded authoritative image order. The association is UI state; it is never sent as product metadata or a new API field.
- `resolveProductGiftImages` validates the media-role portion through `GiftFactsSchema` and calls `rebindGiftMediaRoles`. It changes only proven role references. Invalid contents, invalid role values, unknown fields and other fact namespaces remain in the controlled draft for deliberate correction. Canonical metadata validation continues to block malformed fresh writes.
- Current presentation, metadata composition and signatures use the same resolved draft. Media remove/upload/reorder handlers commit the new order and resolved facts together. The page now exposes labelled earlier/later controls using the existing UI and Lucide family.
- Older retained snapshots without identity data upgrade to an explicit unconfirmed marker. They do not guess which photograph a previous index meant. A review banner permits deliberate confirmation of the displayed current choices; invalid or missing choices must still be corrected or cleared.
- Generic facts category selection is derived from the loaded known namespace until the operator explicitly selects a category. The synchronous selection effect and the unused recovery destructure were removed without lint suppressions.
- Existing field serialization moved unchanged to `buildProductFormFields`; server price/domain validation remains authoritative. The page is **1,449 lines**, below the 1,500 limit.

## Recovery and privacy

The original pending command's payload, key, version and signature remain byte-exact. Only its separate newer `draftSignature` advances. A newer invalid draft cannot prevent replay of the original command. Remount and lost-reply acknowledgement preserve the newer image order and role identities, then use the acknowledged version for the next deliberate save.

`retainProductMediaReferences` masks unsafe entries in the associated old image order with unavailable slots before filtering actual retained images. It then rebinds safe URLs into the filtered order. This preserves index meaning and prevents a closed-box view from silently moving onto a different photograph. Malformed fact input is kept, while unsafe image-reference URLs are excluded from the new recovery snapshot. The existing scope, 12-hour and 256k retention checks remain.

Fresh saves refuse image URLs rejected by the already established `publicMediaReference` policy, so a new retained command cannot introduce a bearer URL. An older already-bound command is not rewritten; its recovery path continues to replay that exact command. This is a client retention boundary, not a new provider/API contract.

## Verification

`TSX_TSCONFIG_PATH=apps/merchant/web/tsconfig.json node --import tsx --test apps/merchant/web/src/lib/product-facts-draft.test.ts apps/merchant/web/src/components/products/product-conflict.test.tsx`

**36 passed, 0 failed.** All original 21 cases remain green, with 10 additional mounted image/recovery cases and 5 pure identity/privacy/legacy cases. See `parent-image-binding-tests.log`.

Mounted cases exercise reorder, explicit choice after reorder, removal and re-upload, duplicate URLs, a distinct replacement photograph, malformed contents and correction, lost reply plus newer draft plus remount, old snapshots requiring review, public-image filtering, actor/store/product draft scope, and a newer bearer-image draft during an immutable pending command. These use the real maintained page and synthetic HTTP responses; they do not certify Gateway, database or provider effects.

Focused ESLint on the four leased source files passes with **0 errors, 0 warnings**. `parent-eslint.log` records the result. The parent-focused TypeScript run (`tsconfig.parent.json`, including normal Next declarations) has **no leased-source diagnostic**. Its remaining diagnostic is external: `packages/commerce-core/src/storefront-discovery.ts:9`, TS2345 (`ZodPipe` input `unknown` versus `string | number`), already reported to the shared owner. See `parent-typecheck.log`.

No database, full build, new runtime, schema/API, framework, dependency or image entity was introduced. Durable atomic persistence/rollback, live gift query capability, and broader buyer/merchant lifecycle acceptance remain owned by their existing integration gates. Kindred's earlier browser/server resources are closed and the browser slot was explicitly released.
