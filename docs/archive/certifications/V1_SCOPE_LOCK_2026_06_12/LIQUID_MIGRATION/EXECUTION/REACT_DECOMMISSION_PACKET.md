# REACT DECOMMISSION PACKET (L17)

**Date:** 2026-06-13 · **HEAD:** `cf4f6f6f` · **PREPARATION ONLY — no React is deleted in this packet.**

## Constitutional gate (hard)
**ART-17 (`LETBUYY_CONSTITUTION.md:256`) forbids deleting React before the data decision at the hardening wave.** L17 may proceed only after: (1) L14 parity green in production, (2) L15 canary clean + a stable production window, (3) the signed hardening-wave data decision. No automation may make that decision — `HR-LIQUID-REACT-DECOMMISSION`.

## Deletion law (repo governance)
Per `REACT_DELETION_PLAN.md` + `typescript-dead-source-validator.mjs:132-134`: "DELETE" = **archive under `docs/archive/dead-code/...` + zero importers + update the referencing freeze/count validator in the SAME commit.** Never a bare `rm`.

## Ownership / route map (current state, code-cited)
**KEEP (engine-agnostic — Liquid reuses; NEVER delete):** `composition-engine.tsx` (Liquid branch), `template-resolver.ts`, `data-binding-engine.ts`, `liquid-hydration-islands.tsx`, `layout.tsx` shell, all `lib/*-service.ts` + `lib/api/*`, all 22 `app/api/*/route.ts` proxies, and **checkout** (`checkout-client.tsx`, `checkout/page.tsx`) — stays React by design.
**MIGRATE → then DELETE (gated):** the **20 React section components** (`apps/storefront-runtime/src/components/sections/*.tsx`) — all now have Liquid parity sections in the bundle — plus the bespoke React funnel pages (`product/[productId]`, `collections/[slug]`, `shop`, `cart`, `account/*`, `orders`) once their Liquid templates are live + parity-proven.
**Section freeze lock:** `no-new-react-sections-validator.mjs` pins the React set at 20 — each section deletion needs a lockstep edit.

## Safe deletion order (only after the gate opens)
1. **Leaf section components** (zero remaining importers once routes render Liquid) → archive + drop the registry entry + decrement the `no-new-react-sections` count, per section.
2. **Bespoke funnel pages** (product/collection/shop/cart/account/orders) → after their Liquid templates serve in production with green parity.
3. **React contexts/shells** that lose their last importer.
4. **Never:** checkout, money (`api-gateway`+`database`), identity (`identity-platform`/ES256), tenancy (RLS), the api proxies.

## Verification after each deletion
`node scripts/validate-governance.mjs --lane=gate` (107+) · launch + theme-engine tests · re-run parity matrix · `tsc -b` · canary still green. Produce `REACT_DELETION_PROOF.md` with the importer-count-zero proof per artifact.

**Status: BLOCKED — constitutional (ART-17 hardening-wave data decision) + L14/L15 green.**
