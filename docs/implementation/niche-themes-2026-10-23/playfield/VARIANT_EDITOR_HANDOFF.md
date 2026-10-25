# Playfield variant facts editor

`PlayfieldVariantFactsEditor` is ready in the allocated `playfield-variant-facts-editor.tsx`, with its colocated test and optional CSS module. It uses the shared `NicheVariantFactsEditorProps`, public domain exports and host UI/tokens/Lucide. It reuses the existing product editor layout CSS read-only; the new scoped CSS lets long action labels and common context wrap. No parent, metadata helper, package export, API, storage or network code was changed.

## Required parent integration

1. Pass this enclosing variant's raw **partial** toy override as `value`, and the product's raw toy namespace as `commonFacts`. The common namespace is validated only for read-only context. It is never copied into the override. `resources` remains optional and is not treated as factual evidence.
2. Keep every `onChange(next)` draft editable, including invalid/incomplete rows. Validate it with **`ToyVariantFactsSchema`**, not `ToyFactsSchema`. Do not fill product defaults into an omitted override.
3. Replace the current override namespace with each non-null draft. Preserve explicit `[]`, `dimensions:null`, `false` and supported empty strings. Do not shallow-merge old fields or prune empty values: either would change inheritance/clear semantics.
4. `onChange(null)` removes the override namespace. The parent must use its canonical namespace removal/inheritance handling. The callback is not a request to persist an arbitrary top-level null or to delete the enclosing variant.
5. Keep the durable variant UUID in the enclosing create/edit DTO. This component introduces no fact IDs, client UUID, SKU correlation, second save or identity lookup. Canonical creation/persistence must save the namespace atomically with its variant; accepted snapshots/readback and actor/store/product/version/conflict/recovery remain parent-owned.
6. Disable mutation controls while the parent disallows editing or has an in-flight save. Controlled value/common-context replacement is authoritative; this component keeps no private record draft and never emits on mount or common-context changes.

## Deliberate omission and clearing

| Field | Omitted | Supported explicit override/clear |
|---|---|---|
| Age bands/interests/warnings/additional measured parts | Use common values | A supplied list replaces the entire common list; `[]` deliberately clears it. Removing the final row preserves `[]`. |
| Primary dimensions | Use the common measured object | A measured object replaces the whole object, including its unit; `null` clears primary dimensions. Additional measured parts are independent and have their own clear action. |
| Contents | Use the common list | Replacement list; `[]` clears. The clear action also writes `contentsComplete:false` so an old completeness assertion cannot survive. |
| Contents completeness | Canonical default applies | A replacement list without its own completeness assertion is partial. “Use common contents and completeness” removes both overrides. A complete assertion without this payload's nonempty list remains invalid. |
| Age statement/materials/finish/care | Inherit where the canonical resolver permits | Supplied text replaces the value; `''` explicitly clears. Changing edition age bands without edition prose drops a stale common prose age through `resolveToyFacts`. |
| Product type | Use common type | Supplied valid code only. The schema does not accept an empty/null code, so no unsupported clear action is offered. |

New contents, measurements and warnings start incomplete rather than with invented quantities, units or claims. Canonical field errors remain linked to labelled controls. Warning text requires a source; raw text is rendered as inert React text/value. Invalid external keys are not silently discarded from drafts, but the canonical variant schema rejects them before a parent save.

## Verification and limits

Thirteen actual mounted React/shared-UI interaction tests pass (`variant-editor-tests.tap`). They cover exact edited payloads, variant Zod parsing, no defaults/IDs, omitted inheritance, explicit clears and restoration, incomplete/invalid correction, completeness, distinct labelled dimensions, sourced warnings, disabled/programmatic input, unique labels/non-submitting actions, hostile text and controlled common-context replacement.

Focused component/test TypeScript checking and the new CSS module's Stylelint check pass. These tests stub CSS loading, so merchant visual/keyboard acceptance and the parent's atomic write/snapshot/conflict/readback gates remain separate. The prior product controls are already connected according to the coordinator's 21 passing parent tests; this variant component fills the newly allocated partial-schema gap.

```sh
node --import tsx --test apps/merchant/web/src/components/products/niche-facts/playfield-variant-facts-editor.test.tsx
pnpm exec tsc --noEmit --incremental false --skipLibCheck --strict --target ES2022 --module ESNext --moduleResolution Bundler --jsx react-jsx --esModuleInterop --rootDir . apps/merchant/web/next-env.d.ts apps/merchant/web/src/components/products/niche-facts/playfield-variant-facts-editor.tsx apps/merchant/web/src/components/products/niche-facts/playfield-variant-facts-editor.test.tsx
pnpm exec stylelint apps/merchant/web/src/components/products/niche-facts/playfield-variant-facts-editor.module.css
```
