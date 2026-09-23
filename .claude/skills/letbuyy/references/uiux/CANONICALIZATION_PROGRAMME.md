# The UI/UX Canonicalization Programme — canonical first, then the whole codebase

**Owner rule (2026-09-04, D-UIUX):** where no proper canonical system exists for a surface, make it
canonical first — the reference and the gate — then roll it out across the codebase. This file is the
rollout plan. **GOV-3 planned it; nothing here is executed.** Each item becomes a bounded phase
contract (`cto.md` §5) under `/letbuyy plan:` and runs through the normal lifecycle. Order is by
value and risk (DOC 06 §6 and §10: honesty first, then merchant, then storefront, then the rest).

## 0. What is canonical today (measured `a751a2ff`) and what is not

| Surface | Canonical system exists? | Evidence | Status |
|---|---|---|---|
| Web tokens | **Yes** — `tokens.ts` → `tokens.json` → `--lb-*`; parity CI-gated | 307 variables; both generators `--check` pass | canonical |
| Web components | **Yes** — `@letbuyy/ui` (inventory in `uiux.md` §2) | 122/141 merchant_web files import it | canonical; adoption uneven |
| Web shell | **Yes** — `AppNavigation` | merchant_web 2 files, admin_web 1, others 0 | canonical; **not rolled out** |
| Theme controller | **Yes** — one provider, `letbuyy-theme`; `theme="auto"` banned | `DesignSystemRoot` only in merchant_web; toggles missing in merchant_web and identity | canonical; **reachability incomplete** |
| Honesty badge | **Yes** — `ProviderModeBadge` (feedback.tsx:220), validator-enforced on 4 money consumers | `provider-mode-badge-validator` passes | canonical |
| Feedback surfaces | **Yes** — Banner/Toast/Skeleton/EmptyState/SaveBar/ConfirmDialog/InlineError | `references/feedback.md` | canonical |
| Ratchet + HARD gates | **Yes** — `validate-design-system.mjs`, ESLint rules, stylelint in CI (`ci.yml:98`) | passes on the committed tree; the dirty primary shows 1 HARD violation from another session's uncommitted deletion of `useAuthTheme.ts` | canonical; green on `a751a2ff` |
| Flutter tokens bridge | **Yes** — `letbuyy_tokens.dart` with colour, type, spacing, radius, shadow, density (DOC 06's "colours+spacing only" is superseded) | 183 consts, 7 classes | canonical |
| Flutter `ThemeData` consuming the bridge | **Unknown** — not measured this session | UX-R2 | to measure in UX-7 |
| Flutter widget kit | **Partly** — `ui_kit` has the primitives but ships duplicates (`empty_state` vs `empty_state_widget`, `error_view` vs `error_widget`) and a `glass_container` | listing | **needs canonicalization** |
| Storefront static chrome kit | **No** — DOC 06 §3.B/UX-R22 mandates a themable-primitives kit for static chrome; per-store dynamic theming is blessed | customer_web 44/114 files import `@letbuyy/ui` | **needs canonicalization** |
| Hosted checkout design layer | **Yes** — born canonical (Phase T8), sourced from the design system, no theme CSS | `checkout.<root>` | canonical |
| Marketing kit (`MarketingHeader`/`Footer`) | **No** — exiled app; not in scope (D-UIUX HOLD) | ratchet `exiledApps` | HOLD |
| Donor apps (`customer_app`, `admin_app`, `phase_2`) | **Separate system** (`marketplace_ui_kit`, `quickcommerce_*`) | D-0/D-4 open | HOLD |

## 1. Phase order

| ID | Phase | Lineage | Entry gate | Exit evidence | Depends on |
|---|---|---|---|---|---|
| **UX-0** | This reference set (`references/uiux/*`) + the ledger of measurements | C | — | GOV-3 merged | — |
| **UX-1** | **CLOSED 2026-09-23 by F-IDUI-1, re-scoped by OWNER_DECISION D-AUTH-LIGHT.** The owner chose a light-only identity surface. So the reachability target was neither restored nor re-pointed: identity left the reachability list, and a HARD forced-light invariant replaced it. The original plan follows, kept for history. **Keep the ratchet green through the identity theming landing**: another session's uncommitted identity-platform work deletes `src/lib/useAuthTheme.ts` (the dark-mode reachability target) and reds the HARD invariant in the primary; before that work is merged through a phase, the reachability target must be restored or re-pointed (`ThemeToggleButton` in the auth chrome persisting to `letbuyy-theme`, UX-R13) so the committed tree stays at 0 HARD violations; no `--update` | C | collision check on `apps/identity-platform/src/**` (dirty in the primary) | `validate-design-system.mjs` exit 0 on the merge result; browser evidence both themes | UX-0 |
| **UX-2** | **Gates into CI**: promote `no-tailwind-default-color` / `no-raw-color-functions` / `no-raw-form-controls` to `error` where a package's count is already 0 (UX-R31); measure whether `pnpm --filter @letbuyy/ui run validate:ui` and `validate-design-system.mjs` run in `ci.yml` outside the real governance lane, and wire them if not (`lint:css` already runs, `ci.yml:98`) | C | CI readable (D-CI-ACCOUNT) or local proof | ci.yml diff + a planted violation caught locally | UX-0 |
| **UX-3** | **merchant_web shell**: adopt `AppNavigation` everywhere in merchant_web, add the first-class **Finance** node (UX-R19), keep the palette and shortcuts, add the dark-mode toggle (UX-R13); then the HARD invariant against inline `<aside>`/`<nav>` (UX-R11) | C | UX-1 | shell adoption metric; screenshot diff at 360/768/1024/1280 both themes; keyboard pass | UX-1 |
| **UX-4** | **Flutter kit canonicalization**: delete the duplicate empty/error widgets in `ui_kit` (deletion gate: zero importers), point `merchant_app` `ThemeData` at the generated bridge (UX-R2), adopt density tokens for ≥44 dp targets (UX-R17), remove any parity-catalog screens (UX-R14), Finance node on mobile | C | canary 172/172 before | analyze + test + `flutter build apk --debug` + `aapt`; TalkBack pass on 4 screens | UX-0 |
| **UX-5** | **Storefront static-chrome kit**: a themable-primitives kit in `@letbuyy/ui` (or `./marketplace`) for customer_web's static chrome; tokenize genuine hardcodes; lint-exempt blessed per-store dynamic styles by pattern (UX-R22); account shell on `AppNavigation` | C | Liquid parity harness untouched; theme sanitizer untouched | ratchet metrics fall for `apps/customer_web`; render parity per section | UX-3 |
| **UX-6** | **Identity and checkout forms (Stripe clarity)**: labels, `aria-describedby`, focus management, DS primitives only, identity's inline styles and `!important`s removed (UX-R23) | C | UX-1 | a11y manual checklist complete on login/OTP/password/checkout; contrast recorded | UX-1 |
| **UX-7** | **Ratchet burn-down** on a clock: every metric strictly decreasing ≥10% per release until 0, starting with `appLocalLbTokenRedefs` (275 → HARD 0, UX-R3) and `appCssNakedRgbHsl` (786) | C | UX-2 | baseline lowered via `--update` **only** to record a genuine reduction; per-metric evidence | UX-2 |
| **UX-8** | **admin_web**: shell check, Money/Finance surfaces carry the badge, dark-mode toggle verified, tablet band | C | UX-3 | same evidence as UX-3 | UX-3 |
| **UX-9** | **Marketing un-exile** (last): focus-visible + token migration, shared marketing kit, then remove `apps/marketing-site` from `exiledApps` (UX-R26/R27) | C | owner lifts the HOLD | ratchet green with marketing included | UX-7 |
| UX-D | Donor apps (`customer_app`, `admin_app`) — converge on the canonical system or retire | A | **D-0 and D-4 decided** | per DOC 06 §3 scoring | owner |

## 2. Rules for every UX phase

- One phase = one app or one system; never two apps in one branch.
- Every phase carries the uiux lane, the feedback lane, and (for identity/checkout/money screens) the
  security lane; every UI phase ends with browser evidence at the five viewports in both themes.
- **Never regress accessibility**; never `--update` to clear a red; never delete a token source or a
  shell while a consumer references it (UX-R32); never touch the theme provider (UX-R4.4 protected).
- Donor and marketing surfaces stay HOLD: a UX phase that finds a defect there records it in
  `EVIDENCE_LEDGER.md` and moves on.
- Measurements go into `EVIDENCE_LEDGER.md` with the commit; DOC 06's own numbers are never
  re-quoted as current.
- The programme is complete when: shell 5/5 canonical apps, toggles 5/5, ratchet 0 across metrics
  with marketing included, Flutter `ThemeData` on the bridge, one empty/error widget per platform,
  and the badge on every money surface web and mobile — each proven by the gate, not by this file.
