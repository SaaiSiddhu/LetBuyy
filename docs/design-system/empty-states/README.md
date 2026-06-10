# LetBuyy Empty State Illustration System

The token-driven empty-state illustration library. One brand-purple ink on a tinted panel, with a central icon chip — the codified, expanded form of the language already shipping in `@letbuyy/ui`'s `EmptyStateIllustration` (`packages/typescript/ui/src/feedback.tsx`).

## Contents

| Path | What it is |
|---|---|
| `generate-empty-states.mjs` | **Source of truth.** Holds all 18 motifs + token values; emits the assets, gallery, and manifest. Edit this, never the outputs. |
| `assets/<motif>.light.svg` · `.dark.svg` | 36 self-contained, concrete-hex illustrations (192×128). For the design library / Canva / docs. |
| `gallery.html` | Interactive, faithful preview — re-themes via the real `--lb-*` variables, animates with the actual keyframes, light/dark/density + motion toggles. Open in a browser. |
| `motifs.manifest.json` | Machine-readable motif → surface map. |

## Governance docs (repo root)

1. `LETBUYY_DESIGN_LANGUAGE_AUDIT.md` — the evidence base (tokens, type, motion, the existing illustration language).
2. `EMPTY_STATE_GOVERNANCE.md` — the rules + the style decision (with the 6-option evaluation).
3. `EMPTY_STATE_INVENTORY.md` — 33 surfaces → title, body, CTAs, motif, a11y.
4. `EMPTY_STATE_TOKEN_MAPPING.md` — every element → exact token, light/dark resolved.
5. `EMPTY_STATE_SCORECARD.md` — 18 motifs scored across 7 axes (system 97.2/100).

## Regenerate

```bash
cd docs/design-system/empty-states
node generate-empty-states.mjs
```

No dependencies. Every color is derived from `packages/typescript/ui/src/tokens.ts`, so assets can never drift from the token system.

## The 18 motifs → 33 surfaces

`generic · orders · products · inventory · shipping · customers · payments · payouts · discounts · analytics · domains · themes · apps · messaging · notifications · identity · security · permissions`

Reuse is deliberate (Shopify/Stripe/Linear pattern): `shipping` serves Shipping/Fulfillment/Returns; `security` serves Security/SSO/Passkeys/Audit Logs; `payouts` serves Payouts/Settlements/Billing; etc. See the inventory for the full map.

## Canva mirror

A **LetBuyy Empty State System** Canva folder exists with a corrected reference board (palette, type scale, anatomy, do/don't):

- Folder: https://www.canva.com/folder/FAHMEt5lWFQ
- Board (view): https://www.canva.com/d/vKrQSBq9E7jUdB5 · (edit): https://www.canva.com/d/RiaGU2MrTMp1zDS

**Honest limitation:** Canva's generator cannot bind to CSS token variables, so the board is a *reference/handoff surface*, not the source of truth — these SVGs are. To get pixel-faithful motifs into Canva, **upload the `assets/*.svg` files directly** (drag-drop into the folder, or host them and use the connector's `upload-asset-from-url`). Do not re-generate the art inside Canva; import it.

## Using it in product (future, optional — not changed in this pass)

Consume `<EmptyState kind="orders" title=… body=… primaryAction=… />` from `@letbuyy/ui`. To ship the 7 new motifs, extend `EmptyStateKind` + `emptyStateIconMap` + `renderEmptyStateMotif` as mapped in `EMPTY_STATE_TOKEN_MAPPING.md` §9. No new tokens are required.
