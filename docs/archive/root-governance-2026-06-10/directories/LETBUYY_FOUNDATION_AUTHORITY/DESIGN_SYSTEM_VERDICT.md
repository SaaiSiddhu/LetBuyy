# DESIGN_SYSTEM_VERDICT (final authority)

> **Status:** FINAL design authority. Supersedes the interim `PHASE2_ARB_CHALLENGE_2026_06_09/DESIGN_SYSTEM_VERDICT.md`. Evidence: code (grep-anchored), not screenshots. No optimism; every number reproducible.

## 1. Current state (what the code is, not what it claims)

LetBuyy has **one token system and nine consumers, but no enforced authority.** The library is strong; the police force is absent.

| Surface | Tokens | Shell/Nav | Tables | Forms | Verdict |
|---|---|---|---|---|---|
| Merchant control plane | `@letbuyy/ui` ✓ (75 imports) | `HeaderBar` + `Sidebar`+`AISidebar` (local) | shared `<Table>` | shared | **Adopted, drifting** (10,335-line `globals.css`; 152 `rounded-[…]`) |
| Platform console | `@letbuyy/ui` ✓ (18) | `ConsoleWorkspace` (local) | 8 hand-rolled `*IndexTable` | shared | **Adopted; table fork** |
| Operations portal | `@letbuyy/ui` ✓ (17) | `OpsWorkspace` (≡ ConsoleWorkspace) | hand-rolled IndexTable | shared | **Adopted; duplicate shell** |
| Identity | `@letbuyy/ui` ✓ (13) | own `useAuthTheme` | n/a | shared | **Adopted; own theme ctx + 96 hex in css** |
| Developer portal | `@letbuyy/ui` ✓ (13) | local | **raw HTML tables** | local | **Primitive bypass** |
| App marketplace | `@letbuyy/ui` ✓ (59) | `Header` (local) | shared | shared | **Adopted** |
| Theme marketplace | `@letbuyy/ui` ✓ (45) | `navbar` (local) | shared | shared | **Adopted** |
| Storefront runtime | `@letbuyy/ui` ✓ (42) | `dynamic-header` + `composition-engine` theme | shared | shared | **Adopted; 574 inline styles; own theme** |
| Marketing site | `@letbuyy/ui` ✓ (11) | local | n/a | n/a | **Parallel CSS token system (island)** |
| Merchant mobile (Flutter) | **bridge fork** | own | own | own | **Forked: 334 `Color(0xFF…)` across 5 Dart files** |

**Token core:** one source `packages/typescript/ui/src/tokens.ts` (303 `--lb-` tokens; primitive→semantic→component→density), one `LetbuyyThemeProvider`, one ESLint raw-element rule that holds **0 hardcoded hex in any `.tsx`**. **Dark mode:** token-driven in principle but three mechanisms coexist (51 `.dark` + 74 `prefers-color-scheme` + 10 `data-theme`) and ≥4 theme contexts exist. **Tailwind:** **0 committed `tailwind.config.*`** — the radius/spacing scale is not centrally enforced, so `rounded-[…]` arbitraries proliferate (merchant 152, theme-marketplace 106, ops 54, console 26).

**Duplication inventory:** 4 `Header`s · 2 `Sidebar`s · 8 hand-rolled `IndexTable`s · `ConsoleWorkspace ≡ OpsWorkspace` (char-identical, self-tagged `[CONSOLIDATE -> @letbuyy/ui]`) · 2 parallel token systems (marketing CSS, mobile Dart) · ≥4 theme contexts.

## 2. Benchmark vs the references

| Capability | Polaris | Linear | Stripe | Vercel (Geist) | **LetBuyy** |
|---|:--:|:--:|:--:|:--:|:--:|
| Single token source | ✓ | ✓ | ✓ | ✓ | ✓ (but bypassed by 2 systems) |
| Semantic + component tokens | ✓ | ✓ | ✓ | ✓ | ✓ (4-layer) |
| Enforced in CI (fails build) | ✓ | ✓ | ✓ | ✓ | **✗ (ratchet exists, not blocking)** |
| One shell / nav system | ✓ | ✓ | ✓ | ✓ | **✗ (4 headers, 2 sidebars)** |
| One table/data-grid | ✓ | ✓ | ✓ | ✓ | **partial (8 forks)** |
| Cross-platform tokens (web+mobile generated) | ✓ | — | ✓ | ✓ | **✗ (mobile hand-forked)** |
| Documented a11y per component | ✓ | ✓ | ✓ | ✓ | **✗ (no a11y harness found)** |
| Dark mode one-mechanism | ✓ | ✓ | ✓ | ✓ | **✗ (3 mechanisms)** |

**Read:** LetBuyy's *token architecture* is Polaris-class (its real achievement). Its *governance, shell unification, cross-platform parity, and a11y* are pre-1.0. The gap to the references is **enforcement and consolidation, not design vocabulary.**

## 3. Target state (the single design authority)

**One source, one provider, one shell, generated everywhere, enforced in CI.**
- **Token authority:** `@letbuyy/ui/tokens.ts` is the *only* token source. Mobile Dart + any CSS variables are **generated** from it; no hand-authored colors/spacing anywhere.
- **Provider authority:** one `LetbuyyThemeProvider`; storefront/identity consume it (delete their parallel theme contexts).
- **Shell authority:** one `AppShell` + one `Header` + one `Sidebar` + one `DataTable` in `@letbuyy/ui`; apps compose, never re-implement.
- **Mechanism authority:** dark mode = token-value swap only; retire `.dark`/`prefers-color-scheme` ad-hoc mixing.
- **Enforcement authority:** the ratchet + lint rules are **blocking CI gates**; new hardcoded values/arbitrary scale/raw elements fail the build.

## 4. Migration waves
- **Wave D0 — Enforce (S):** wire `design-system-baseline.json` ratchet + stylelint as **blocking** gates; lint-ban `#hex`/`rounded-[`/`shadow-[` on themable surfaces. *Stops the bleeding.*
- **Wave D1 — Converge tokens (M):** migrate `marketing-site` onto canonical tokens (or formally exile from the design surface + exclude from score); **generate** mobile Dart tokens, delete the 5 hand files.
- **Wave D2 — Unify shells (M):** promote `ConsoleWorkspace`/`OpsWorkspace` → one `AppShell`; consolidate 4 `Header`s → 1; 2 `Sidebar`s → 1; 8 `IndexTable`s → one `DataTable`; developer-portal tables → `<Table>`.
- **Wave D3 — Theming + dark mode (M):** converge storefront/identity onto the canonical provider; one dark-mode mechanism; burn down storefront’s 574 inline styles against a cap.
- **Wave D4 — A11y (L):** commission a real WCAG 2.1 AA pass (axe + keyboard + SR) per component; document a11y in the component catalog.

## 5. Design governance rules (the law)
1. All color/type/space/radius/elevation derive from `tokens.ts`. No parallel token system in any *product* app.
2. No hand-authored mobile colors — generated from the bridge only.
3. No raw `#hex`, `rounded-[`, `shadow-[`, or inline `style={{}}` on a themable surface (storefront burn-down excepted, under a shrinking cap).
4. Primitives come from `@letbuyy/ui`; no app re-implements Button/Input/Table/Modal/Header/Sidebar/Shell.
5. Dark mode is token-value swap; one mechanism.

## 6. CI enforcement rules
| Gate | Tool | Fails build when |
|---|---|---|
| Token ratchet | `design-system-baseline.json` | hardcoded-value count rises above baseline |
| Raw-element | ESLint plugin (exists) | raw hex / banned element in `.tsx` |
| Arbitrary scale | new lint rule | `rounded-[`/`shadow-[` arbitraries added |
| Mobile parity | `generate-mobile-tokens.mjs --check` | Dart tokens diverge from source |
| Inline-style cap | grep gate | storefront `style={{}}` exceeds the cap |
| Stylelint | stylelint (install) | raw colors/units in CSS |

## 7. Scores
- **Design Debt Score: 6.5/10 debt** (high) — 2 parallel token systems, 334 mobile literals, 574 inline styles, 4 headers/2 sidebars/8 table forks, no blocking CI, no a11y evidence.
- **Design Maturity Score: 54/100** — Polaris-class tokens (architecture 72) dragged down by governance (40), consistency (60), dark mode (50), and unverified a11y (35).

## 8. Single design authority — definition
> **`@letbuyy/ui` is the sole design authority.** It owns the only token source, the only theme provider, the only shell/nav/table/form/modal primitives, and the only dark-mode mechanism. Every app — web and mobile — is a *consumer*. Authority is enforced by blocking CI gates, not convention. Marketing-site and mobile are consumers like any other; neither may fork tokens.

## How LetBuyy becomes a 10/10 design system
1. **Make the ratchet block merges (D0).** A design system without a failing CI gate is a style guide, not a system. This single step moves governance 40→70.
2. **Kill the two parallel token systems (D1).** Generate mobile tokens; migrate or exile marketing-site. One source, no exceptions → consistency 60→80.
3. **One shell, one table, one header, one sidebar (D2).** Collapse the 4/2/8 forks into `@letbuyy/ui`. This is what Linear/Stripe have and LetBuyy doesn’t.
4. **One dark-mode mechanism + zero raw hex on themable surfaces (D3).** Dark mode 50→85.
5. **Earn the a11y score you can’t currently claim (D4).** Commission the WCAG pass; document per-component. 35→85.
6. **Publish the authority + catalog.** A living Storybook (the `*.stories.tsx` already exist) as the single reference, with a11y and do/don’t per component — the Polaris move.

Do these five waves and the maturity score moves **54 → ~90**; the remaining 10 is the perpetual discipline of keeping the gates green. **The vocabulary is already 10/10; the system becomes 10/10 the day the gates can fail the build and the forks are gone.**
