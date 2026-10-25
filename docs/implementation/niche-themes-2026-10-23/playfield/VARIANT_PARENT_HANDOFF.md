# Shared variant facts composition and parent integration

The support wrapper and the explicitly granted parent wiring are ready for coordinator review. The support allocation introduced these four app files:

- `src/components/products/VariantFactsEditor.tsx` and its mounted test.
- `src/lib/variant-facts-draft.ts` and its pure helper test.

The coordinator subsequently granted an exclusive parent lease for the shared new/edit page, `product-form-state` and `product-conflict.test.tsx`. That wiring is complete below. `product-facts-draft`, `NicheFactsEditor`, APIs, public indexes and DB files were not edited in this lease. The edit route remains its existing re-export of the shared new page.

## Wrapper contract

`VariantFactsEditor` receives `value:unknown` for one enclosing row's complete raw variant metadata, `onChange(metadata:Record<string,unknown>)`, optional `commonFacts`, `resources` and `disabled`. `commonFacts` is the product metadata object; each leaf receives only its own raw namespace. Common values are read-only and never copied into overrides. No new product/variant domain DTO was introduced.

The wrapper composes the five real editors through `NicheVariantFactsEditorProps`: Toys, Food, Furniture, Sports and Books. Category selection is view state and emits no metadata. The category registry is checked against the public `VARIANT_NICHE_FACT_SCHEMAS` contract.

Child `onChange(null)` deletes exactly that category. Sibling namespaces and invalid/incomplete raw fields remain intact. The last removal **always emits `{}`**, so an edited parent can explicitly clear stored metadata. Clearing all overrides is a separate explicit action. No UUID, SKU or option identity is generated or read by this component.

Unreadable top-level drafts are retained with a recovery message. Only an explicit clear emits `{}`; no mount, category change or common-context change creates an empty write. Valid object drafts receive the canonical combined-schema errors while their raw values remain editable. UI/schema feedback does not perform a network or storage operation.

## Pure helper API

| Export | Behavior |
|---|---|
| `VARIANT_FACT_NAMESPACES` / `VariantFactsNamespace` | Derived from the canonical five-namespace registry. |
| `isVariantFactsNamespace(value)` | Own-key guard; unrelated product namespaces and prototype keys are rejected. |
| `readVariantFactsDraft(value)` | Copies own data properties without product defaults or leaf validation. Only `undefined` normalizes to an absent/empty editor baseline. Scalars, null, arrays, encoded strings, class instances and accessor fields throw a recovery error. |
| `updateVariantFactsDraft(value, namespace, next)` | Raw immutable namespace replacement, or single-namespace deletion on callback null. Final result stays explicit `{}`. Unsupported category edits throw. |
| `validateVariantFactsDraft(value)` | Uses `ProductVariantMetadataSchema.safeParse` on the raw-reader result. Returns native canonical success/issues without changing the draft. Unreadable top-level shapes throw the reader's recovery error. |

Validation preserves `[]`, nested `null`, supported `''` text clears and false flags exactly. It uses canonical **variant** schemas; product defaults must never fill a partial namespace.

## Accepted enclosing-row fields

The existing `VariantRow.id` remains the only durable identity for persisted rows. New rows receive no business UUID until the canonical server writer accepts the same atomic creation command.

- `factsMetadataBaseline?: unknown`: the immutable raw metadata captured from authoritative readback for this exact row/UUID. An own baseline field with `{}` means known empty. Absence on an old retained existing row means **unknown**, not known empty.
- `factsMetadataDraft?: unknown`: the controlled raw edited metadata, including invalid partial fields and explicit clears. Preserve its presence; do not use `draft || {}` or nullish fallback to hide malformed input.
- `factsMetadataEdited?: boolean`: parent change-intent marker. Recompute by comparing the raw draft to the known baseline, preserving array order, types and clear markers without applying product defaults. Reverting to baseline should remove the metadata write intent.

API hydration should set the known baseline/draft explicitly when the authoritative metadata contract is available, including known-empty `{}`. Fresh new rows can safely start with a known-empty baseline and no IDs/factual defaults. Older retained existing rows lacking those fields must leave metadata omitted until authoritative UUID-based rehydration makes the baseline known; do not allow an unknown empty baseline to overwrite stored sibling facts.

The parent should include **validated explicit `metadata` only on an actual metadata change**. Unchanged metadata remains omitted, even when price/SKU/stock changes. Clearing the final stored namespace must send `metadata:{}`, never omit metadata. Enclosing version, row UUID, actor/store/product scope and the existing single idempotent atomic command remain unchanged.

## Identity, regeneration and recovery requirements

- Do not associate facts with mutable SKU, title, option labels, array position or regenerated combination strings. Carry them only with a proven retained row/UUID. If matrix regeneration would detach an edited/new-row draft from that row, preserve the original matrix and require explicit review rather than silently transferring or dropping facts.
- Old retained snapshots may lack all three new fields. Upgrade only presentation draft state; missing fields do not become an edit or an implicit empty write. Snapshot validation should accept the old shape and retain malformed raw fact drafts for correction.
- Pending command payload bytes, key, saved signature and variant signature remain immutable. Never rebuild an uncertain command from current controls or rewrite its identity during an old-snapshot upgrade.
- Confirmed readback may reset baseline/draft/edited only for the exact authoritative row and request scope. A late acknowledgement must preserve newer edits. New rows without a proven returned UUID must use the existing canonical reload/review path; do not guess identities from response order/SKU/options.
- The coordinator's 36 gift image-binding/recovery cases were preserved and all pass after parent integration.

## Evidence and remaining gates

Ten mounted wrapper tests use the actual five leaf components and shared UI, including real Food and Toy edited payload paths, invalid retention across category changes, one-namespace/final clears, explicit marker preservation, disabled actions, hostile text, unique labels, controlled row replacement and no parent form submission. Seven helper tests cover raw parsing, immutable updates, exact empty writes/markers, canonical validation, unsupported fields, unsafe top-level shapes and own-property handling.

All **17 tests pass**, and focused TypeScript checking of the four new files plus imported leaf components passes. Mounted tests stub CSS loading; no browser, API, DB, transaction, snapshot persistence or shared-parent lifecycle success is claimed. Frozen M1 and the archived 49-case renderer evidence remain unchanged.

```sh
node --import tsx --test apps/merchant/web/src/components/products/VariantFactsEditor.test.tsx apps/merchant/web/src/lib/variant-facts-draft.test.ts
pnpm exec tsc --noEmit --incremental false --skipLibCheck --strict --target ES2022 --module ESNext --moduleResolution Bundler --jsx react-jsx --esModuleInterop --rootDir . apps/merchant/web/next-env.d.ts apps/merchant/web/src/components/products/VariantFactsEditor.tsx apps/merchant/web/src/components/products/VariantFactsEditor.test.tsx apps/merchant/web/src/lib/variant-facts-draft.ts apps/merchant/web/src/lib/variant-facts-draft.test.ts
```

## Completed parent integration and lease release

The shared product page now mounts the real five-editor wrapper inside each enclosing row. Persisted facts callbacks bind only to the exact durable UUID. Explicit new rows bind to the current row object; SKU, labels and array position never transfer metadata or UUIDs. Current raw common facts and current images/options are read-only context. Unknown legacy baselines disable fact edits and provide an explicit latest-review/reload path. An acknowledged authoritative readback can also establish the exact row's baseline.

The three optional UI fields are retained in snapshots without upgrading old missing fields into known empty values. Authoritative API rows and explicit newly created rows capture known baselines; malformed raw metadata stays raw. Unchanged or reverted metadata is omitted from the existing atomic request. Actual edits validate against `ProductVariantMetadataSchema`; final clear sends `metadata:{}`. Sibling namespaces remain intact.

General combination changes preserve both the original options and matrix and require explicit row review/removal. A separate additive-value operation verifies the unchanged axes and every existing row, retains the exact old row objects, and appends only new rows with no IDs and empty fact baselines. It never copies an old UUID/fact draft onto a regenerated candidate. This preserves the existing new-variant recovery regression. Tests verify rejection of invalid/ambiguous existing combinations and no identity/fact graft after explicit removal.

Pending retries dispatch their captured payload without constructing or validating a newer draft. Payload bytes, idempotency key, saved signature and variant signature remain immutable across remount. A late acknowledgement rebases only matching persisted UUID baselines and retains newer raw draft values, including invalid fields and clear markers. New rows changed after the captured command retain their raw facts and use the existing explicit latest-review path before adopting returned IDs.

`variant-parent-tests.tap` contains **69 passing tests**: the protected 36, ten new real parent mounted cases, ten wrapper mounted cases and thirteen helper cases. The ten new parent cases cover UUID/sibling isolation with repeated labels/SKUs, unchanged/reverted omission, single/final clears, exact nested clear markers, invalid draft remount/correction, old unknown baseline review, conflict/reload/version, lost committed reply and newer invalid draft, combination review/removal, actual new-product creation, and unconfirmed new-row UUID recovery (some concerns share a case).

Scoped TypeScript for both route entry points and the touched files passes via `parent-wiring-tsconfig.json`. Scoped ESLint exits zero: zero errors, eleven pre-existing warnings in the protected conflict harness; the baseline lint log has the identical eleven warnings. The page is **1,446 lines**, below the 1,500-line limit. `parent-wiring-receipt.json` pins source hashes and case counts. No browser/API/DB integration, full build, production transaction or deployment success is claimed by these synthetic HTTP mounted tests. Frozen M1 and the archived renderer audit are unchanged.

The exclusive shared-parent writer lease is released after this handoff. Any further parent edits require the coordinator to reassign that lease. The next Playfield-owned task is gating discovery markup on the canonical backend capability supplied through the discovery owner; it does not reopen the parent files.

```sh
TSX_TSCONFIG_PATH=apps/merchant/web/tsconfig.json node --import tsx --test apps/merchant/web/src/components/products/product-conflict.test.tsx apps/merchant/web/src/lib/product-facts-draft.test.ts apps/merchant/web/src/components/products/VariantFactsEditor.test.tsx apps/merchant/web/src/lib/variant-facts-draft.test.ts
pnpm exec tsc -p docs/implementation/niche-themes-2026-10-23/playfield/parent-wiring-tsconfig.json
```
