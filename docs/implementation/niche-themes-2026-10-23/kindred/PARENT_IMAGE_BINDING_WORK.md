# Shared parent planning snapshot — 2026-10-23

Historical planning record. The implemented design and current verification are in `PARENT_IMAGE_BINDING_HANDOFF.md`.

Coordinator granted sole writes after browser release to:

- `apps/merchant/web/src/app/[store]/products/new/page.tsx`
- `apps/merchant/web/src/components/products/NicheFactsEditor.tsx`
- `apps/merchant/web/src/lib/product-form-state.ts`
- `apps/merchant/web/src/lib/product-facts-draft.ts`
- matching helper / `components/products/product-conflict.test.tsx` tests

Root refrains until explicit release. Baseline six files copied with hashes to `/private/tmp/letbuyy-kindred-parent-before-image-binding-20261023/manifest.json`. Root baseline also `/private/tmp/letbuyy-niche-merchant-form-before-20261023.tsx`. Current page 1482 lines, must remain <=1500. Existing 21 actual conflict/facts cases green; full merchant tsc root saw only six other-editor union-option diagnostics. Root ESLint had two warnings: NicheFactsEditor synchronous setState effect; product-form-state `_draft` unused destructure. Fix without suppressions.

Required outcome: current parent always resends whole metadata, so image reorder/removal with unchanged gift role indices bypasses server implicit-image-only rebind. Track UI draft image identity using canonical `rebindGiftMediaRoles`. Reorder exact unique URLs, clear removed/invalid/ambiguous role references, explicit new choices against current images win. Preserve malformed raw facts and private metadata siblings. Binding must survive retained/newer drafts, remount/lost replies, conflict scope; never rewrite immutable pending payload/key/signature. Existing 256k and publicMediaReference retention must not leak bearer URLs or shift associations when images are filtered. Old drafts lacking association must not guess.

Current source observations:

- Snapshot has `nicheFacts:string`, `images:string[]`; `normalizeProductSnapshot` captures raw namespace data. `currentSnapshot` is useMemo, signature JSON snapshot drives dirty/recovery.
- Child host receives raw nicheFacts + metadata ref and current resources images; callback only full facts string. It has effect that picks first known namespace; replace with explicit selection or derived first-known.
- `handleSave` composes full metadata from raw nicheFacts for fresh commands, skips metadata validation if pending. New edit intent binds currentSignature/body/version/key. Recovery MUST still bypass new invalid draft for replay.
- `draftSignature` is updated for newer draft, independent immutable intent. On remount `restoreProductEdit` restores latest draftSignature. On acknowledgement it compares original intent.signature vs latestSignature to preserve newer edits.
- Ordinary retention currently strips importerDetails and filters images by publicMediaReference. New association must preserve old array positions via unavailable blank slots rather than filtering identity order.
- Media UI has remove/upload but no reorder. Add bounded earlier/later controls for actual mounted reorder acceptance, preserving host tokens/labels. Keep page <=1500 via moving existing pure fields serialization block to product-form-state (already allowed UI-state helper), not minifying/removing useful comments.

Tentative implementation design (not yet source implemented):

1. Add UI-only snapshot string such as `giftMediaImageOrder` (JSON image list; empty string means legacy uncaptured), initialized from fresh server images, carried by every snapshot/apply/restore. No new domain schema/API/image entity.
2. Pure draft resolver in product-facts-draft takes raw facts + old bound image order + current images; use canonical media-only schema + rebind helper to adjust ONLY mediaRoles while preserving malformed other fields. If malformed media roles/unknown old identity cannot prove association, retain raw data and block fresh save with clear review path. Valid removed roles can be omitted; valid media-only facts become absent. Never replace failed fact parse with empty facts.
3. Derive resolved child display/save/currentSnapshot from that resolver, rather than setState effects. Child callbacks operate on the resolved current-image draft, so explicit selections are associated with current images. Legacy unknown associations need deliberate confirmation/reselection instead of guessing; generic edits in other namespaces must not silently confirm them.
4. Safe retained snapshot masks unsafe URL entries in the old association array to empty strings (preserve index positions), filters actual current images, then resolves roles into the filtered image order. Preserve invalid fact text; unavailable legacy/corrupt association stays unconfirmed. Never store new bearer URLs through the association field.
5. Pending original body/key remains exact. Review how original signature and newer draftSignature are sanitized without changing already-bound commands; capture tests for privacy and immutable replay.
6. Tests: actual mounted reorder/removal/replacement/duplicate URL, explicit selection after reorder, invalid facts preserved, private siblings, remount + lost reply + newer draft; pure positive control for old draft/unsafe URL association. Retain all original 21 cases. Focused lint/typecheck, no DB/full build.

Browser slot1 already explicitly released; browser closed and static server61195 stopped. Do not restart browser without another allocation. Browser measured 43 states pass, with minor 320px brand-wrap visual follow-up noted. All M1 91 hashes unchanged.
