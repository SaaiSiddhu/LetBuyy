# CODEX UI-FOUNDATION HARDENING MISSION — `@letbuyy/ui` (Single-Stream, Parallel-Safe)

**Mission owner (exclusive):** `packages/typescript/ui/**`. This stream owns the design system and **nothing else**.
**Runs in parallel with** the broader `CODEX_FOUNDATION_HARDENING_*` mission (which owns apps/services/other packages). **You two must never edit the same files.** Hard isolation rules in §1.
**Driver:** GPT‑5.x in Codex — `high` for a11y/focus/token-runtime/new-primitive work, `medium` for mechanical edits and stories/tests.
**Mode:** Continuous, autonomous. Run until every unblocked task is DONE or `[SKIP — NEEDS HUMAN]`. Never stop while an unblocked task remains. Never pause to ask.
**Branch:** fresh `stream/letbuyy-ui-foundation` off current `develop`. **Do not** commit on the parallel mission's branch.
**Issue source of truth (canonical):** the UI System Master Audit and its 13 phase docs, already in the repo:
- `docs/LETBUYY_UI_SYSTEM_MASTER_AUDIT.md` (read first — verdict + index)
- `docs/ui-system-audit/TOP_100_UI_FOUNDATION_ISSUES.md` (**the worklist — issues #1–#100, ranked**)
- `docs/ui-system-audit/{UI_COMPONENT_CATALOG, DESIGN_TOKEN_AUDIT, COMPONENT_API_STABILITY_REPORT, UI_USAGE_GRAPH, BREAKING_CHANGE_IMPACT_REPORT, DESIGN_SYSTEM_CONSISTENCY_REPORT, RESPONSIVE_FOUNDATION_REPORT, ACCESSIBILITY_AUDIT, THEMING_AUDIT, UI_SYSTEM_GOVERNANCE, LETBUYY_UI_SYSTEM_V2, BRUTAL_REVIEW}.md`

Trust the cited file:line evidence in those docs; verify only at the point of edit. Every issue #1–#100 must end **DONE** or **SKIPPED — NEEDS HUMAN** in your ledger.

> **This mission changes code** — but only inside `packages/typescript/ui/**`. It is the design-foundation counterpart to the broader hardening mission. You are authorized and required to modify the design system to close issues #1–#100 under the Operating Contract, **without breaking a single one of the 203 consuming import sites** the parallel stream is simultaneously editing.

---

## 0. PRIME DIRECTIVE

`@letbuyy/ui` is architecturally good (three-tier tokens + density + CSS-variable theming, Polaris-shaped vocabulary) and **already the de-facto foundation** (203 import sites across 9 apps). It is held back by *operational* gaps, not architecture: **0 tests, raw-`src` distribution, no focus traps, Input a11y bugs, broken `auto` theme, missing overlay primitives, duplicate components, token hygiene debt,** and **massive bypass** (apps hand-roll 282 raw `<button>`, 138 raw `<input>`, 417 hex; 17 of the best components have zero adoption).

**Your job:** make `@letbuyy/ui` the **stable, correct, complete, single foundation** — by closing #1–#100 **additively and backward-compatibly**, so that:

1. **Nothing that currently imports `@letbuyy/ui` breaks.** Every existing export and every existing `--lb-*` CSS variable keeps working byte-for-byte. New behavior is opt-in or strictly improves correctness.
2. **The correctness gaps are fixed** (focus traps, Input ARIA, contrast, `auto` theme, z-index).
3. **The missing primitives exist** (Drawer, Popover, Dropdown/Menu, Switch, Grid, Container, unified Table, merged Text — all as **new additive exports**; old ones kept and `@deprecated`).
4. **The safety net is built** (tests + axe + Storybook visual regression + a UI API/token snapshot) so the foundation can never silently regress again.
5. **Everything that genuinely needs a human** (brand color decision, breaking removals, `main`→`dist` repoint, cross-app migration) is **built to the gate** and recorded `[SKIP — NEEDS HUMAN]` with the exact decision/command and what it unblocks — never faked, never skipped silently.

**Disposition rule (same spirit as the parallel mission):** make it **real & additive** when it doesn't break a consumer; **shim & deprecate** when the clean version is breaking; **`[SKIP — NEEDS HUMAN]`** the irreversible/decision/cross-app calls and continue.

**SUCCESS = COMPLETE only when all are proven with recorded command evidence:**
1. `@letbuyy/ui` has a real test suite (RTL + jest-axe) wired into `pnpm turbo test`, green; Storybook visual-regression + a public-API snapshot + a `--lb-*` token-variable snapshot exist and gate changes.
2. Every P0 (#1–#15) is fixed: Modal/CommandPalette focus-trapped; Input/Textarea use `useId` + `aria-describedby`/`aria-invalid`; AA contrast met; `theme="auto"` follows OS; z-index scale lands.
3. Drawer, Popover, Dropdown/Menu, Switch, Grid, Container, a unified `Table`, and a merged `Text` exist as new exports; `DataTable`/`IndexTable`/`TextStyle`/`PageShell`/`PageActions`/`TableFilterBar` still work and are `@deprecated` with replacement pointers.
4. Internal components (`PageHeader`, `SaveBar`, `IndexTable`, `Pagination`, `DensityToggle`) compose `Button`/`Checkbox` instead of raw elements — **without changing their public props or rendered look** (verified by visual regression).
5. Theming: `prefers-color-scheme` emitted for `auto`; `data-letbuyy-surface` wired (identity defaults — no visual change until brand palettes provided); a `brand` plumbing path exists; `cx` uses tailwind-merge.
6. Governance artifacts authored **inside UI scope**: an eslint rule/plugin that bans raw `<button>`/`<input>`/`<table>`/hardcoded-hex (authored + self-tested; **app enablement = handoff SKIP**), codemods for every known-breaking consolidation (authored + dry-run proven; **running them across apps = handoff SKIP**), `DEPRECATIONS.md` (UI-scoped), regenerated package `AGENTS.md` + repository intelligence.
7. Every issue #1–#100 is DONE or SKIPPED — NEEDS HUMAN in `CODEX_UI_FOUNDATION_LEDGER.md`; `CODEX_UI_FOUNDATION_STATUS.md` summarizes with every human-gated remainder + exact commands.
8. **Zero consumer breakage:** `pnpm turbo typecheck` + `pnpm turbo build` pass repo-wide (all 9 apps still compile against the changed package); `node scripts/validate-governance.mjs` all-green (count ≥ your branch-point baseline); `pnpm lint` clean.

---

## 1. ISOLATION & OWNERSHIP CONTRACT (parallel-safety — non-negotiable)

You share the repo with the broader hardening mission **running at the same time**. Collisions corrupt both. Obey strictly:

**1.1 Files you MAY write:**
- `packages/typescript/ui/**` — all source, tests, stories, `package.json`, `tsconfig.json`, local `AGENTS.md`, and new subfolders you create here (`__tests__/`, `eslint/`, `codemods/`, `scripts/`).
- **New, UI-owned root ledger files only:** `CODEX_UI_FOUNDATION_LEDGER.md`, `CODEX_UI_FOUNDATION_STATUS.md`, and (UI-scoped) `packages/typescript/ui/DEPRECATIONS.md`. Create these; they are yours.
- **New** validator files **only if** additive and clearly UI-scoped: `scripts/validators/ui-*.mjs` (e.g. `ui-token-variable-snapshot-validator.mjs`, `ui-public-api-snapshot-validator.mjs`, `ui-no-new-token-alias-validator.mjs`). Register them following the existing validator-registration pattern **without rewriting** unrelated validators.

**1.2 Files you MUST NOT touch (the parallel mission owns these):**
- Any `apps/**`, `services/**`, or non-`ui` `packages/**`.
- The existing `CODEX_FOUNDATION_HARDENING_MISSION*.md`, `CODEX_FOUNDATION_HARDENING_LEDGER.md`, `CODEX_FOUNDATION_HARDENING_STATUS.md` — **read-only** to you.
- Root `AGENTS.md`, `CLAUDE.md`, `docs/governance/**` (you may *read* them; changes there are the other stream's or a human's).
- The core body of `scripts/validate-governance.mjs` and any **existing** validator file. You ADD new `ui-*.mjs` validators and register them; you do not modify validators the other stream may also be editing. If registration requires touching a shared registry file and that risks a conflict, instead make your UI validators runnable via a dedicated `pnpm run validate:ui` script you add to the **ui package** `package.json`, and record the “fold into validate:governance” step as `[SKIP — NEEDS HUMAN: merge UI validators into root registry post-parallel]`.

**1.3 The Backward-Compatibility Law (the heart of parallel-safety):**
The other stream is editing the 203 files that import `@letbuyy/ui`. Therefore:
- **Never remove or rename a public export.** To "replace" `DataTable`, add a new `Table`; keep `DataTable` exported, working, and `@deprecated`-tagged.
- **Never remove or rename a `--lb-*` CSS variable.** Add new ones; keep every old one emitting its current value. (Collapsing aliases is **breaking** → SKIP the removal; you may *stop adding new* aliases and add a validator preventing new ones.)
- **Never change a component's existing public prop names, defaults, or rendered visual output** except where an issue explicitly calls for a *correctness* fix (focus, ARIA, contrast). Those are allowed because they fix bugs, not contracts — but record them as behavior changes in STATUS so the app stream re-checks (e.g., any app code doing `getElementById` on a label-derived input id).
- **Do not repoint `main`/`types` from `./src/index.ts` to `./dist`.** Build `dist` additively (new `build` output) but leave the entrypoints on `src` so the parallel stream's builds are unaffected. The repoint is `[SKIP — NEEDS HUMAN]`.

**1.4 Anti-thrash:** max 3 attempts per task → revert that task, log `BLOCKED` + diagnosis in the ledger, move on.

---

## 2. OPERATING CONTRACT (laws)

1. **Continuous execution.** Finish a task → update `CODEX_UI_FOUNDATION_LEDGER.md` → next unblocked task. Never pause to ask; never end while unblocked work remains.
2. **The Green Law.** Tree green after every commit: `pnpm turbo typecheck` + `pnpm --filter @letbuyy/ui test` + `pnpm lint` each increment; full `node scripts/validate-governance.mjs` (all-green, count ≥ branch baseline) + repo-wide `pnpm turbo build` at every phase GATE. Never commit red.
3. **The Backward-Compat Law (§1.3).** No consumer may break. Additive or deprecation-shimmed only. Breaking = SKIP.
4. **The Honesty Law.** Never assert a capability that doesn't exist. A new primitive must actually work (tested), not be a styled `<div>` named `Drawer`. A token fix must change the emitted CSS, not just a TS object. A test must exercise behavior, never assert a string.
5. **The A11y-Default Law.** Every interactive component you add or touch supports keyboard, visible focus (`focus-visible` ring → `--lb-color-focus-ring`), disabled, loading where relevant, and error state, and passes `jest-axe`. (This is also the package's own `AGENTS.md` rule.)
6. **The Real-Evidence Law.** Every `DONE` carries the command + result. UI behavior proven by RTL + jest-axe; visual claims proven by Storybook screenshots (the `storybook-screenshots/` dir already exists — wire it). No mock asserted as proof.
7. **Small reversible increments.** One logical change → validate → commit (`type(ui): summary`). Internal refactors that "preserve look" are proven by a visual-regression baseline captured **before** the change.
8. **Human-skip ledger (mark & continue).** Brand-color decision, any breaking removal/rename, `main`→`dist` repoint, running codemods across `apps/**`, enabling the UI eslint rule in apps, fixing `marketing-site`'s missing `DesignSystemRoot`, deleting the empty `apps/storefront-runtime/src/components/ui` dir → all are **out of your write-scope or need a human decision** → append to `## SKIPPED — NEEDS HUMAN` with exact command/decision + the issues it unblocks, then continue.
9. **No fabrication.** Every DONE needs evidence. Never fake a test or a screenshot.
10. **Respect existing law.** Obey root `AGENTS.md`, the package `AGENTS.md` (ownership rules, forbidden imports: no `apps/*`/`services/*`/`legacy/*`/`infrastructure/*` imports), `docs/governance/`. On any package change, regenerate repository intelligence (`node scripts/generate-repository-intelligence.mjs` if present) and update the package `AGENTS.md` in the same commit.
11. **Anti-ceremony.** No new top-level docs beyond your two ledger files + the UI-scoped `DEPRECATIONS.md`. No new npm packages unless a task authorizes it (prefer subfolders inside the ui package). New dependencies (e.g. `tailwind-merge`, `vitest`, `@testing-library/react`, `jest-axe`) are allowed **only** as `devDependencies`/`dependencies` of `@letbuyy/ui` and must keep `build` network-free.
12. **Traceability.** Every issue #1–#100 ends DONE or SKIPPED — NEEDS HUMAN. Nothing disappears silently.

---

## 3. ARCHITECTURE INVARIANTS (never violate)

One design system (`@letbuyy/ui`); it does not deploy independently and owns no routes/env/db. Tokens are the single styling source — primitive→semantic→component→density, compiled to `--lb-*` CSS variables; **CSS variable names are public API**. Every overlay shares one focus-trap + dismiss + `--lb-z-*` stack. Light/dark/auto theming via `data-*` attributes on `DesignSystemRoot`. No import from `apps/*`/`services/*`/`legacy/*`/`infrastructure/*`. No build-time network. INR-first formatting stays. The package supports React 18 **and** 19 (peer range unchanged).

---

## 4. LEDGER — create & maintain `CODEX_UI_FOUNDATION_LEDGER.md`

Create it at first run with these sections, and keep them current:
- `## TRACEABILITY MATRIX` — rows for issues **#1–#100** (from `TOP_100_UI_FOUNDATION_ISSUES.md`): `| # | issue | phase | status (TODO/DONE/SKIP) | evidence |`. Seed all 100 as TODO; flip as you go.
- `## SKIPPED — NEEDS HUMAN` — each with the exact decision/command + issues it unblocks.
- `## NEW PUBLIC API` — every new export added (component, prop, token var) — this is the additive surface.
- `## DEPRECATIONS` — mirror of `DEPRECATIONS.md`: symbol, since, replacement, codemod path, removal = SKIP.
- `## VISUAL-REGRESSION BASELINES` — what was snapshotted, when.
- `## VALIDATOR LEDGER` — UI validators added.
- `## BLOCKED` — anti-thrash log.
Also create `CODEX_UI_FOUNDATION_STATUS.md` (running summary) and `packages/typescript/ui/DEPRECATIONS.md`.

---

## 5. THE WORK — phases U0 → U8 (in order; each phase has a GATE)

> Issue numbers (#N) refer to `docs/ui-system-audit/TOP_100_UI_FOUNDATION_ISSUES.md`. Every phase: read the cited audit doc section, then implement. **All work is additive/back-compat unless the task says SKIP.**

### U0 — SAFETY NET FIRST (no behavior change; this gates everything)
*Issues #16, #17 (additively), #46, #47, #52, #53, plus the prerequisites for safely doing the rest.* Refs: `UI_SYSTEM_GOVERNANCE.md`, `BREAKING_CHANGE_IMPACT_REPORT.md`.

- **U0.1 Test harness.** Add `vitest` + `@testing-library/react` + `@testing-library/dom` (present) + `jest-axe` + jsdom as devDeps; add a `test` script to `@letbuyy/ui` `package.json` wired so `pnpm turbo test` runs it. Keep `build` network-free. _DoD: `pnpm --filter @letbuyy/ui test` runs and passes (even with 1 smoke test); `pnpm turbo test` includes it._
- **U0.2 Baseline tests for the load-bearing + 🟢 tier.** RTL + jest-axe smoke/behavior tests for Card, Section, Button, Badge, Input, Banner, Skeleton, EmptyState, Select, Checkbox, Radio, Combobox, Tabs. _DoD: each renders, key props work, `axe` clean; suite green._
- **U0.3 Visual-regression wiring.** Wire the existing `storybook-screenshots/` into a runnable baseline (`build-storybook` + a screenshot/diff step you can run locally and in CI). Capture a **pre-change baseline of every component in light+dark × 3 densities** — this is the proof-of-no-regression for all later refactors. _DoD: baseline captured + committed; a `pnpm --filter @letbuyy/ui test:visual` (or documented) diff path exists._
- **U0.4 Public-API + token snapshots (#52, #53 hygiene net).** Add `scripts/validators/ui-public-api-snapshot-validator.mjs` (fails if a public export disappears/renames) and `ui-token-variable-snapshot-validator.mjs` (fails if a `--lb-*` variable disappears/renames). Snapshot current `index.ts` exports + `letbuyyTokenCssVariables`. _DoD: both validators green now; both fail if you remove an export/var (proving the back-compat net)._
- **U0.5 `dist` build (additive, entrypoints unchanged) (#17).** Add a `tsup`/`tsc` build emitting `dist/` (ESM + d.ts). **Keep `main`/`types` on `./src/index.ts`.** Record `[SKIP — NEEDS HUMAN: repoint main/types → dist after parallel stream lands]`. _DoD: `pnpm --filter @letbuyy/ui build` emits dist; entrypoints unchanged; consumers unaffected._

**GATE U0:** test suite green in `pnpm turbo test`; visual baseline captured; API+token snapshot validators green; `dist` builds; entrypoints untouched; repo-wide `pnpm turbo typecheck`+`build` still green.

### U1 — P0 CORRECTNESS (#1–#15)
*Refs: `ACCESSIBILITY_AUDIT.md`, `DESIGN_TOKEN_AUDIT.md` (Z-1, D-1), `THEMING_AUDIT.md` (TH-1).* These are bug fixes — allowed even though behavior changes.

- **U1.1 Z-index scale (#13).** Add `--lb-z-{base,dropdown,sticky,overlay,modal,toast,tooltip}` tokens in `tokens.ts`; map existing overlays (Modal/Toast/CommandPalette/Combobox/SaveBar/Tooltip) onto them. Keep current visual stacking; remove the `z-50` collision. _DoD: distinct z tokens; Modal>overlay>… ordered; existing `z-*` literals replaced; snapshot adds vars (additive)._
- **U1.2 Focus trap for overlays (#1–#4, #14, #15).** Add a shared `useFocusTrap` + `useDismiss` (Esc/outside) hook; apply to `Modal` (initial focus, trap, restore, background `inert`/`aria-hidden`) and `CommandPalette` (+ Arrow-key roving over results). No public prop changes. _DoD: RTL tests prove focus is trapped, restored on close, background inert; palette navigable by keyboard; axe clean._
- **U1.3 Input/Textarea ARIA + `useId` (#5–#8).** Replace label-derived ids with `useId()`; wire `aria-describedby` (helper/error) + `aria-invalid` to match `Select`/`Combobox`. _DoD: no duplicate-id collision; error announced; axe clean. **Record in STATUS as a behavior change** so the app stream re-checks any hardcoded id lookups._
- **U1.4 Contrast fixes (#11, #12).** Darken `textMuted` to ≥4.5:1 on light surface; introduce a purple **text** token (e.g. `purple[700]`) for purple-on-light text (active tab label, accent text), keeping `#8B5CF6` for fills/icons. Verify all `statusSoft` text pairs ≥4.5:1. **If changing an existing `--lb-*` value would alter brand appearance materially, add a NEW token and switch text usages to it (additive); do not silently restyle.** Brand hue change itself = SKIP. _DoD: contrast math recorded ≥AA for text tokens; additive where a value change would be a visual contract change._
- **U1.5 `prefers-color-scheme` for `auto` (#10).** Emit `@media (prefers-color-scheme: dark)` mapping to the dark variable set, scoped so explicit `data-theme` still wins and `auto` now follows OS. _DoD: a root with `theme="auto"` renders dark under OS dark; explicit light/dark unaffected; test asserts the media block exists._
- **U1.6 `marketing-site` token-root gap (#9).** This is an **app** fix → out of scope. Author a short note + the one-line wrapper snippet in STATUS and `[SKIP — NEEDS HUMAN: wrap marketing-site in DesignSystemRoot — app stream]`. Optionally add a UI validator that *documents* the requirement. _DoD: precise handoff recorded._

**GATE U1:** all #1–#15 DONE or SKIP(#9); focus traps + Input ARIA + contrast + auto-dark proven by tests; visual baseline diff shows only intended changes; token snapshot still green (additive only).

### U2 — TOKEN SYSTEM COMPLETION (#29, #30 done in U1, #56–#67 hygiene — additive)
*Refs: `DESIGN_TOKEN_AUDIT.md`, `RESPONSIVE_FOUNDATION_REPORT.md`.*

- **U2.1 Breakpoint tokens + owned `screens` (#29).** Add `--lb-bp-{sm,md,lg,xl}` + export a Tailwind `screens` preset from the package so the responsive contract is owned, not inherited. Keep current values (640/768/1024/1280) so nothing shifts. _DoD: breakpoint tokens exported; preset consumable; no visual change._
- **U2.2 One shadow source (#67) / statusSoft from primitives (#81) — additive.** Make `component.card.shadow` reference `--lb-shadow-*` where equal; pull light `statusSoft` literals onto primitives **only if the emitted value is identical** (else add primitive + keep value). _DoD: no emitted value changes; provenance unified._
- **U2.3 Stop alias growth (#64, #65, #66) — net, not removal.** Add `ui-no-new-token-alias-validator.mjs` that fails if a *new* duplicate variable name for an existing value is added. Document the canonical name for each aliased pair in `DESIGN_TOKEN_AUDIT.md`-aligned comments. **Removing existing aliases = breaking = `[SKIP — NEEDS HUMAN: alias collapse + cross-app codemod]`** (codemod authored in U8). _DoD: validator green; canonical names documented; removals recorded as SKIP._
- **U2.4 Unify type-scale & spacing naming as ADDITIVE canonical set (#66, #65).** Where two names exist (`h2`/`pageTitle`, `space-1`/`space-xs`), pick + document the canonical, keep both emitting. _DoD: canonical documented; both still emit._

**GATE U2:** breakpoint + z-index + shadow provenance landed additively; no-new-alias validator green; token snapshot green; zero visual change outside U1.

### U3 — MISSING PRIMITIVES (purely additive new exports)
*Refs: `LETBUYY_UI_SYSTEM_V2.md` §3, `UI_COMPONENT_CATALOG.md` gaps, issues #21, #22, #23, #31, #32, #44, #45, #55, #79, #80, #92, #93.* All new exports — zero consumer risk.

- **U3.1 Overlay suite on the U1.2 foundation (#21, #22, #23).** Add `Drawer` (left/right/top/bottom, focus-trapped), `Popover` (anchored, dismiss), `Dropdown`/`Menu` (roving keyboard, `role=menu`). Reuse `useFocusTrap`/`useDismiss`/`--lb-z-*`. _DoD: each keyboard+axe tested; stories added; exported from `index.ts`._
- **U3.2 Form/layout primitives (#31, #32, #44, #45, #93).** Add `Grid`/`Columns` (responsive `columns`/`gap`), `Container` (max-width via measure tokens), `Switch`, `NumberField`, and generalize `DensityToggle`→`SegmentedControl` (keep `DensityToggle` as a thin wrapper). _DoD: each tested + storied + exported; `DensityToggle` unchanged for existing callers._
- **U3.3 Smaller gaps (#55, #79, #80, #92).** Add `InlineError`, `Accordion`/`Disclosure`, a single-date `DatePicker`, and app-shell `Navigation`/`Sidebar`/`AppFrame` primitives (the nav apps hand-roll). Ship the ones that land green; record any that can't as `[SKIP]`. _DoD: shipped primitives tested+storied+exported; remainder recorded._

**GATE U3:** new primitives exported, each keyboard-accessible + axe-clean + storied + visual-baselined; nothing existing changed; repo-wide typecheck/build green.

### U4 — CONSOLIDATION VIA SHIMS (no removals)
*Refs: `COMPONENT_API_STABILITY_REPORT.md`, issues #19, #20, #48 (#49–#51, #59, #60, #85 as shims).*

- **U4.1 Unified `Table` (#19, #20).** Add a new `Table` with IndexTable's feature set + responsive cards. **Keep `DataTable` and `IndexTable` exported and working**, tag `@deprecated` → `Table`. Author the consolidation codemod in U8. _DoD: `Table` tested+storied; old tables untouched + deprecated; cross-app migration = SKIP._
- **U4.2 Merge `Text` (#60).** Extend `Text` to absorb `TextStyle` variants; keep `TextStyle` exported as a `@deprecated` wrapper delegating to `Text`. _DoD: `TextStyle` output unchanged; `Text` covers its variants; deprecation noted._
- **U4.3 Alias deprecation (#49, #50, #51).** Tag `PageShell`/`PageActions`/`TableFilterBar` `@deprecated` (keep exported + identical). _DoD: deprecations tagged; no behavior change._
- **U4.4 `Badge` vocabulary (#59) + provenance (#85).** Keep `variant="danger"` working (normalizer stays); document `critical` as canonical; export `Badge` from one canonical module while keeping the `data-table` re-export for back-compat. _DoD: both variants work; canonical documented; re-export preserved._
- **U4.5 `MaterialIconName` typing (#48) — additive.** Add a typed `materialIconName` union/helper and `@deprecated` the `(string & {})` escape hatch in docs (keep it compiling). _DoD: typed path available; loose path still compiles._

**GATE U4:** unified `Table` + merged `Text` shipped; all duplicates deprecated-but-working; `DEPRECATIONS.md` complete; zero consumer breakage (typecheck/build/visual green).

### U5 — INTERNAL COMPOSITION (look-preserving refactor)
*Refs: `DESIGN_SYSTEM_CONSISTENCY_REPORT.md` §3, issues #33, #34, #35, #36, #69.* **Visual-regression baseline must show no change.**

- **U5.1** Refactor `PageHeader` (#33, #69), `SaveBar` (#34), `IndexTable` controls (#35), `Pagination`/`DensityToggle`/mobile-Open (#36) to compose `Button`/`Checkbox`/`Breadcrumbs` internally. Public props **unchanged**; rendered output **pixel-identical** (prove via U0.3 baseline). _DoD: each refactor diff-clean against baseline; props unchanged; tests green._

**GATE U5:** internal raw `<button>`/`<input>`/inline-breadcrumbs replaced by components with **zero visual diff**; public APIs unchanged.

### U6 — THEMING REACH (additive)
*Refs: `THEMING_AUDIT.md`, issues #24, #25, #37, #39, #72.*

- **U6.1 Wire `surface` (#24).** Emit `[data-letbuyy-surface="…"]` variable hooks. Default every surface to **current values** (no visual change) so it's a ready seam; actual per-surface palettes need design → `[SKIP — NEEDS HUMAN: per-surface brand palettes]`. _DoD: surface attribute now themable; identity defaults; SKIP recorded for palettes._
- **U6.2 `brand` plumbing (#25).** Add a `brand` input on `DesignSystemRoot` (and/or `createTheme({brand})`) that rewrites the primary ramp + focus ring + CTA via CSS-variable overrides. Default = current purple (no change). Whether the brand *is* purple or ink, and the light-CTA decision, = `[SKIP — NEEDS HUMAN: brand identity decision]`. _DoD: passing `brand` overrides primary live; default unchanged; decision SKIP recorded._
- **U6.3 `cx` → tailwind-merge (#37).** Replace the naive `cx` join with a tailwind-merge-backed `cx` (keep the same signature) so `className` overrides resolve. _DoD: override-conflict test passes; existing usages unaffected; signature unchanged._
- **U6.4 Dedup token `<style>` injection (#39).** Make `DesignSystemRoot` inject the token `<style>` once (guard by a module-level flag / dedupe by `data-letbuyy-token-source`), so nested roots don't duplicate it. Keep `includeTokenStyles` API. _DoD: nested roots emit one `<style>`; API unchanged; test asserts single injection._

**GATE U6:** surface + brand seams live with identity defaults; `cx` merges; single `<style>` injection; brand/surface palette decisions SKIP-recorded.

### U7 — A11Y & POLISH (#68, #70, #71, #74, #75, #77, #78, #83, #84, #88, #89, #94, #96, #97, #99, #100)
*Refs: `ACCESSIBILITY_AUDIT.md`, `UI_COMPONENT_CATALOG.md`.* Additive/correctness.

- **U7.1** Tooltip↔trigger association + touch reveal (#83, #84); `Toast` `duration`/`placement` options (#77, #78, additive defaults); reduced-motion gate on hover transforms (#74); IndexTable `aria-selected` (#75); Modal backdrop → `div`+labelled close instead of giant `<button>` (#96); Avatar optional `alt` (#94); document the icon-button `aria-label` rule (#88-area). _DoD: each tested/axe-clean; defaults preserve current behavior._
- **U7.2** Expand `Pagination` (page numbers + page-size, additive props) (#70); externalize EmptyState illustration set behind the current default (#98); document `inert` support/polyfill note (#100). _DoD: additive; defaults unchanged._

**GATE U7:** polish issues DONE or SKIP; axe-clean across the suite; defaults unchanged.

### U8 — GOVERNANCE ARTIFACTS & HANDOFFS (author in UI scope; cross-app = SKIP)
*Refs: `UI_SYSTEM_GOVERNANCE.md`, issues #18, #26, #27, #28, #40, #41, #42, #43, #49–#51 removals, #61, #62, #82, #95.*

- **U8.1 eslint rule/plugin (#26, #27, #28, #43).** Author an eslint rule set (under `packages/typescript/ui/eslint/` or a clearly-UI plugin) banning raw `<button>`/`<input>`/`<table>`/hardcoded-hex, with autofix-to-component hints. **Self-test the rule.** **Enabling it in `apps/**` = `[SKIP — NEEDS HUMAN: app stream enables eslint-plugin-ui]`.** _DoD: rule authored + unit-tested; app enablement SKIP._
- **U8.2 Codemods (#41, and migrations for #19, #59, #64, #49–#51).** Author jscodeshift codemods (under `packages/typescript/ui/codemods/`) for: `DataTable`/`IndexTable`→`Table`, `Badge danger`→`critical`, `PageShell`/`PageActions`/`TableFilterBar`→canonical, and token-alias rename. Prove each with a dry-run on fixtures. **Running them across `apps/**` = `[SKIP — NEEDS HUMAN: app stream runs codemods]`.** _DoD: codemods authored + dry-run-proven on fixtures; cross-app run SKIP._
- **U8.3 Deprecation + semver discipline (#18, #40).** Finalize `DEPRECATIONS.md`; add a dev-only `console.warn` on deprecated exports (`process.env.NODE_ENV !== 'production'`); bump `@letbuyy/ui` to a `0.x` pre-1.0 with a `CHANGELOG.md` **inside the package**. Actual `main`→`dist` repoint + 1.0 cut = `[SKIP — NEEDS HUMAN]`. _DoD: deprecations warn in dev; package changelog started; version bumped within package._
- **U8.4 Housekeeping (#42, #61, #62, #82, #95).** Move visual preview helpers (`visual.tsx` `Color*`/`RadiusPreview`) to a `@letbuyy/ui/preview` subpath export (keep main re-export `@deprecated` for back-compat); add CODEOWNERS guidance text to the package `AGENTS.md` (#42); add Storybook do/don't docs (#95); flag the empty `apps/storefront-runtime/src/components/ui` removal as `[SKIP — app scope]` (#77-area). Regenerate package `AGENTS.md` + repository intelligence. _DoD: preview subpath added (main still works); docs added; AGENTS regenerated; app-dir removal SKIP._

**GATE U8:** eslint rule + codemods authored & self-proven (cross-app = SKIP); deprecations warn; package changelog + version bump; AGENTS/intelligence regenerated.

---

## 6. TRACEABILITY — all 100 issues bucket to phases

Seed `CODEX_UI_FOUNDATION_LEDGER.md`'s matrix from `TOP_100_UI_FOUNDATION_ISSUES.md` and map:

| Issues | Phase | Disposition |
|---|---|---|
| #1–#4, #14, #15 (focus traps) | U1.2 | DONE (additive correctness) |
| #5–#8 (Input/Textarea ARIA) | U1.3 | DONE (correctness; behavior-change noted) |
| #9 (marketing-site no root) | U1.6 | **SKIP — app stream** |
| #10 (auto theme) | U1.5 | DONE |
| #11, #12 (contrast) | U1.4 | DONE (additive token where needed; hue = SKIP) |
| #13 (z-index) | U1.1 | DONE |
| #16, #46, #47, #52, #53 (tests/snapshots/visual) | U0 | DONE |
| #17 (dist) | U0.5 | DONE additively; **repoint = SKIP** |
| #18, #40 (semver/deprecation) | U8.3 | DONE in-package; **1.0 cut = SKIP** |
| #19, #20 (tables) | U4.1 | Unified `Table` + deprecate; **migration = SKIP** |
| #21, #22, #23 (Drawer/Popover/Dropdown) | U3.1 | DONE (new exports) |
| #24 (surface) , #25 (brand) | U6.1/U6.2 | Seam DONE; **palettes/identity = SKIP** |
| #26, #27, #28, #43 (bypass/eslint) | U8.1 | Rule authored; **app enable = SKIP** |
| #29 (breakpoints), #30 (z-index) | U2.1/U1.1 | DONE |
| #31, #32, #44, #45, #55, #79, #80, #92, #93 (primitives) | U3.2/U3.3 | DONE (new exports) |
| #33–#36, #69 (composition) | U5 | DONE (look-preserving) |
| #37 (cx), #39 (style dedupe), #72 (theme selectors) | U6.3/U6.4 | DONE |
| #38 (Button polymorphism) | U3/U5 | Add `as`/`asChild` (additive) |
| #41 (codemods) | U8.2 | Authored; **run across apps = SKIP** |
| #42 (CODEOWNERS), #61, #62, #82, #95 (housekeeping) | U8.4 | DONE (app-dir removal = SKIP) |
| #48 (icon typing), #54 (ConfirmDialog copy), #57, #58, #56 (API grammar) | U4.5/U4/U7 | Additive: add canonical, deprecate loose; **prop renames = SKIP** |
| #49, #50, #51 (aliases), #59, #60, #85 (vocab/dupes) | U4.2–U4.4 | Deprecate-shim; **removal = SKIP** |
| #63, #64, #65, #66, #67, #81 (token hygiene) | U2 | Additive + no-new-alias validator; **collapse = SKIP** |
| #68, #70, #71, #74, #75, #77, #78, #83, #84, #88, #89, #94, #96, #97, #99, #100 | U7 | DONE/SKIP per item |
| #51 (storefront empty ui dir) , marketing fixes | U1.6/U8.4 | **SKIP — app stream** |

Anything not individually listed still gets a row and ends DONE or SKIP.

---

## 7. FINAL GATE (mark COMPLETE only when all true)
- `pnpm turbo typecheck` — PASS (repo-wide; all 9 apps still compile against changed `@letbuyy/ui`)
- `pnpm --filter @letbuyy/ui test` — real RTL + jest-axe suite PASS; included in `pnpm turbo test`
- `pnpm --filter @letbuyy/ui build` — emits `dist`; **`main`/`types` still `./src/index.ts`**
- Visual-regression: only intended diffs (U1 correctness + new components); U5 refactors **zero diff**
- `pnpm lint` — PASS
- `pnpm turbo build` — PASS, no network
- `node scripts/validate-governance.mjs` — all-green, count ≥ branch-point baseline; new `ui-*` validators green (or `validate:ui` green + fold-in SKIP recorded)
- **Back-compat proof:** API + token snapshot validators green; **no public export or `--lb-*` variable removed/renamed**
- **Traceability:** every issue #1–#100 is DONE or SKIPPED — NEEDS HUMAN with evidence
- **Honesty audit:** every new primitive actually works (tested); no faked screenshot/test; nothing overstated
- `CODEX_UI_FOUNDATION_STATUS.md` summarizes the run + every human-gated remainder (brand decision, alias collapse, `main`→`dist` repoint, cross-app codemod/eslint enable, marketing-site fix) with exact commands

Mark COMPLETE only if `@letbuyy/ui` is **correct** (P0 fixed), **complete** (overlay + layout + form primitives exist), **safe** (zero consumer breakage; full test/visual/snapshot net), and **honest** (deprecations shimmed, removals deferred to humans, nothing faked) — and the parallel app stream can adopt all of it without a single broken import.

---

## 8. HOW TO START (first 30 minutes)
1. `git checkout develop && git pull && git checkout -b stream/letbuyy-ui-foundation`.
2. Read `docs/LETBUYY_UI_SYSTEM_MASTER_AUDIT.md` then `docs/ui-system-audit/TOP_100_UI_FOUNDATION_ISSUES.md`.
3. Create `CODEX_UI_FOUNDATION_LEDGER.md` (+ matrix seeded #1–#100), `CODEX_UI_FOUNDATION_STATUS.md`, `packages/typescript/ui/DEPRECATIONS.md`.
4. Record the branch-point validator count (`node scripts/validate-governance.mjs | tail`) as your baseline.
5. Begin **U0.1**. Never stop while an unblocked task remains.
