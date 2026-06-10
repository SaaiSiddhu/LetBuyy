# DESIGN_SYSTEM_VERDICT

ARB challenge of the design-system conclusions. Grep-anchored; no screenshots relied upon.

## The five-question verdict
1. **Is LetBuyy operating one design system?** **Structurally yes, in authority no.** One token source (`packages/typescript/ui/src/tokens.ts`, 303 `--lb-` tokens), one `LetbuyyThemeProvider`, one ESLint rule that holds **0 hardcoded hex in any `.tsx`**, and **9/9 apps import `@letbuyy/ui`**. But ≥4 theme-provider-shaped surfaces exist and three surfaces run parallel styling systems.
2. **Is design governance enforceable?** **The mechanism exists; it is not currently enforcing.** The ESLint raw-element rule works (0 `.tsx` hex proves it). The ratchet baseline **exists** (`scripts/validators/design-system-baseline.json`) — correcting the prior “missing baseline” claim — but it is **not wired as a blocking CI gate**, and stylelint is referenced-but-dormant. Governance is opt-in, not enforced.
3. **Which apps violate governance?** `marketing-site` (parallel CSS token system, 22 hex `.tsx` + 25 hex `.css`, 5,319-line globals); `mobile` (334 hand-authored `Color(0xFF…)` literals across 5 Dart files); `developer-portal` (tables as raw HTML, bypassing `<Table>`); `storefront-runtime` (574 inline `style={{…}}`).
4. **Which apps have drift?** `storefront-runtime` (inline-style sprawl + own theme context `composition-engine.tsx`); `merchant-control-plane` (10,335-line `globals.css` + 152 arbitrary `rounded-[…]`); `marketing-site` (a styling island).
5. **Which apps require redesign (of the styling layer)?** `marketing-site` (migrate onto tokens or be formally exiled from the design surface); `mobile` theme layer (generate from `generate-mobile-tokens.mjs`, delete the 5 hand files); `storefront-runtime` theming (converge onto the canonical provider).

## Scores
| Axis | Score | Basis |
|---|--:|---|
| **Design Architecture** | **72/100** | Genuinely strong four-layer token model + single provider + real primitive set (`button/input/controls/overlays/table/feedback/navigation`). The library is the platform’s best non-commerce asset. |
| **Design Governance** | **40/100** | Working ESLint gate (real) but no blocking ratchet/stylelint CI; parallel token systems survive. |
| **Consistency** | **60/100** | Admin/platform apps consistent; storefront/marketing/mobile diverge; 4 `Header`s, 2 `Sidebar`s, 8 hand-rolled `IndexTable`s, `ConsoleWorkspace≡OpsWorkspace`. |
| **Accessibility** | **35/100 — mostly INSUFFICIENT EVIDENCE** | No a11y test harness, axe run, or focus-management evidence found; arbitrary inline styles + raw HTML tables suggest gaps. Treat as *unverified*; commission a real WCAG pass. |
| **Dark Mode** | **50/100** | Token-driven in principle; forked in practice — 3 mechanisms (51 `.dark` + 74 `prefers-color-scheme` + 10 `data-theme`); raw hex on marketing/identity/mobile won’t theme; storefront themes via utility classes, not tokens. |

## What changed vs the master verdict
- **Upgraded:** the ratchet baseline is *present*, not missing — governance has more raw material than the master implied; the blocker is wiring, not authoring.
- **Held:** “one system, not one authority”, the divergence list, and the duplication inventory all VALIDATED.

**Bottom line:** the design system is the strongest *foundation* in the building after the commerce schema — but it is **a library without a police force.** Make the ratchet a blocking gate, kill the two parallel token systems (marketing CSS, mobile Dart), and converge storefront/identity theming onto the canonical provider. Effort is **P2 (growth)**, not existential — *unless* it keeps blocking the dark-mode and a11y work, which the board should treat as beta-quality gates.
