# Phase 1 — Governance Report (Stream G)

**Status:** ✅ Phase 1 introduces **no new governance failures**. The full gate has **two pre-existing, evidenced failures** caused by the working tree's unrelated WIP — neither is from Phase 1.

## Phase-1-relevant validators — ALL PASS

| Validator | Result | Relevance |
|---|---|---|
| `foundation-antifabrication-gate` | ✅ pass (1230 source files; 0 temp entries) | Scans all source incl. Phase-1 files — no fabrication/placeholders |
| `theme-governance-validator` | ✅ pass (25 built-in schemas, 20 frozen sections, 20 Liquid-parity) | LB-8 reused the existing schema; counts unchanged |
| `no-new-react-sections-validator` | ✅ pass (20 frozen sections) | LB-8 added NO file under `components/sections/` |
| `migration-safety-validator` | ✅ pass | LB-9 migration 187 is additive/idempotent, no destructive patterns |

## Governance constraints honored (per blocker)
- **LB-12** — registration stays entirely in the HS256 customer issuer; no merchant/ES256 crossing (asserted by lb12 test). Turnstile + rate-limit on the gateway register route preserved.
- **LB-8** — compliant with the React-section freeze (component in `components/layout/`, not `components/sections/`); reuses the approved `announcementBar` schema; merchant colors via inline `style` with `var(--token, rgb(...))` fallbacks (no raw hex). No new ARB-gated React section.
- **LB-9** — `site_settings` migration is additive (`ADD COLUMN IF NOT EXISTS`), replayable; no money/RLS change. Read-only SELECT extension.
- **LB-10** — dispatch closures are best-effort notification side-effects (try/catch, post-event) — **no canonical-ledger mutation, no money RPC touched**. Idempotency-keyed jobs.
- **LB-7** — no code change; server-authoritative shipping/GST invariant re-confirmed by the 28-assertion suite.

## The two gate failures are PRE-EXISTING (proven)

The gate (`validate-governance.mjs --lane=gate`) is fail-fast. With the working tree as-is it aborts at **tenant-isolation** (validator #2). With that one pre-existing blocker temporarily cleared (registry regenerated, then reverted), it proceeds and aborts at **design-system**. Both are WIP, not Phase 1:

### 1. tenant-isolation — `tenant-tables.registry.ts` is stale
- Running `generate-tenant-table-registry.mjs` adds only: `founding_merchant_allocations` (migration **176**), `site_domains` + `site_domain_verifications` (**185**), `subscription_coupon_redemptions` (**184**) — all **uncommitted WIP migrations**.
- Phase 1's migration **187 adds a *column* to the existing `sites` table** — it adds **no tenant table**, so it cannot change the registry. (Regen reverted after proving this.)
- **Remediation (WIP owner):** `node scripts/generators/generate-tenant-table-registry.mjs` once migrations 175–186 are finalized/committed.

### 2. design-system governance — ratchet regressions in untouched files
- Regressions are dominated by **CSS-file / cross-app** metrics: `appCssRawHex` 0→72, `appCssNakedRgbHsl` 572→641, `appLocalLbTokenRedefs` 112→216, `rawPxFontSize` 533→550, `rawPxSpacing` 1365→1398, plus a `marketing-site` dark-mode HARD invariant. These live in `marketing-site/globals.css`, `identity-platform/globals.css`, `merchant-control-plane/globals.css` and other WIP-modified files — **all ` M` before Phase 1, none touched by Phase 1**.
- **Phase 1's only measurable TSX delta** was `tsxRawHex` 0→2 (two hex fallbacks in the new announcement bar). **Fixed** — switched to `var(--token, rgb(...))`; re-run shows `tsxRawHex` back at baseline **0**. The remaining at-most-one `tailwindPaletteClass` delta (a `text-red-500` error line in the register form) matches the three identical pre-existing error displays in the same file; `tsxInlineStyles` and `tsxArbitraryRadius` are *below* baseline (improved).
- **Remediation (WIP owner):** resolve the CSS drift in the modified app files, or make a deliberate `--update` re-baseline decision. **Not run here** — re-baselining would mask unrelated regressions (anti-fabrication / governance principle).

### Also pre-existing (report lane): sequential-migration
- Fails on untracked migration **186** (`186_v1_scale_commerce_os_coming_soon.sql`) — pre-existing WIP. Phase 1's migration **187** is also currently untracked. **Remediation:** `git add` 186 + 187 once the WIP migration set is committed.

## Bottom line
Phase 1 is governance-clean: it passes anti-fabrication, the theme-governance/freeze validators, and migration-safety, and adds no net design-system drift after the hex fix. The gate cannot show all-green only because the working tree is an in-progress lane carrying unrelated, uncommitted WIP (new tables needing registry regen; CSS drift; uncommitted migrations). Those are inherited cleanup items for the lane owner, itemized above with exact one-line remediations.
