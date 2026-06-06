# BRUTAL_REVIEW.md

**Premise:** the Shopify Polaris team sits down and reviews `@letbuyy/ui` as it exists on 2026-06-06. No politeness. Accurate.

> Format: what they'd **praise**, **reject**, **redesign**, **rebuild** — then the unvarnished verdict.

---

## The one-paragraph verdict

You built a Polaris tribute act with real craft — the token system is better than ours in places (density!), the vocabulary is ours, and a few components (IndexTable mobile cards, Chart's sr-only data table, the focus-visible discipline) show people who actually care. Then you shipped it as `version 0.0.1`, `private: true`, `main: ./src/index.ts`, **zero tests**, and let 203 files depend on it while the apps around it pasted in **282 raw `<button>`s, 138 raw `<input>`s, and 417 hardcoded hex colors**. You have a design system the way a house with no foundation inspection has a house: it's standing, it's even nice inside, and nobody is allowed to tell you it's not certified. It is **not yet a foundation. It is a strong prototype that the org started treating as a foundation.**

---

## What we'd PRAISE (genuinely)

1. **The token architecture is correct and we'd steal the density axis.** Primitive → semantic → component, compiled to CSS variables, single source in `tokens.ts`. Three-tier done properly. The compact/comfortable/spacious density system is more than Polaris ships, and it's clean.
2. **The component vocabulary is right.** `Page/Section/Card`, `BlockStack/InlineStack`, `ChoiceList`, `IndexTable` with saved views + bulk actions, `Banner`, `EmptyState`, `SaveBar`. You understood *what* an admin needs.
3. **Pockets of real accessibility skill.** `Tabs`/`Combobox` keyboard models are textbook. `Chart` ships a screen-reader data table. Focus-visible rings are everywhere and keyed to a token. Someone here knows ARIA — which makes the gaps more frustrating, not less.
4. **`IndexTable`'s responsive story** (table → labeled cards under `md`) is the right pattern, not a horizontal-scroll cop-out.
5. **Zero runtime dependencies** beyond lucide. No styled-components tax, no CSS-in-JS runtime. Tailwind + CSS vars is a defensible, fast substrate.

We don't praise to be nice. These are real. Keep all of it.

---

## What we'd REJECT (would not pass our review)

1. **The `Modal` would fail review outright.** No focus trap, no initial focus, no restoration, background not inert. We reject any dialog primitive that lets focus escape. You have 33 of these in production.
2. **The most-used input has the worst a11y.** `Input` derives its `id` from label text — so two "Name" fields collide — and never wires `aria-describedby`/`aria-invalid`. Your *own* `Select` does it right. The #2 form component is below your own bar. Reject.
3. **"Auto" theme that can't go dark.** Your default `theme="auto"` emits nothing and your CSS has no `prefers-color-scheme`. You shipped a complete dark theme that the default config **cannot reach**. That's not a theme system, that's a light theme with a dark theme in the trunk.
4. **A consumer app renders your components with no token root.** `marketing-site` mounts your components with no `DesignSystemRoot`, so they render against undefined CSS variables. You let that ship. Where's the guard?
5. **Two tables, with incompatible `render` signatures.** `DataTable.render(value,row,i)` vs `IndexTable.render(row,i)`. A developer cannot move between them. Pick one. We did.
6. **Your components don't use your own components.** `PageHeader`, `SaveBar`, `IndexTable`, `Pagination`, `DensityToggle` hand-roll raw `<button>`. So "the button" exists in four implementations. A design system whose own header doesn't use its own Button is not a system; it's a folder of components.
7. **No tests, raw-source distribution, frozen `0.0.1`.** You cannot promise stability to 203 import sites with no `dist` boundary and no test catching regressions. Right now the regression net is "someone looks at merchant-control-plane." Reject as a *foundation*; accept as a *v0*.
8. **Contrast.** Muted text at ~2.6:1 and brand-purple text at ~3.5:1 on white. Your active tab label fails AA. We'd flag it in five minutes with a contrast checker.

---

## What we'd REDESIGN (keep the idea, fix the execution)

1. **One API grammar.** Five change-handler conventions, three "size" names, `helperText`+`description`, `danger`+`critical`. Pick one of each and codemod. A developer should guess `<Combobox onChange>` because `<Checkbox onChange>`.
2. **Collapse the token aliases.** `--lb-color-text` *and* `--lb-color-text-primary` for the same value, `space-1` *and* `space-xs`, two type scales, two shadow systems. You have ~200 variables doing the work of ~120. Every alias is a future desync.
3. **Make the brand a real decision.** Brand is purple everywhere except the light-mode primary button, which is near-black slate. That's a Vercel move and it reads well — but you didn't *decide* it, you drifted into it. Commit: brand or ink, then apply it to the CTA consistently, and expose a `brand` input so merchants can theme.
4. **Wire the `surface` axis you already built.** You set `data-letbuyy-surface` and then nothing keys off it. The white-label seam is *in the API and absent in the CSS*. Finish it.
5. **Tokenize breakpoints and z-index.** Right now responsive is raw `sm:/md:/xl:` strings inheriting whatever Tailwind config the app has, and overlays all sit at `z-50`. Both belong in `tokens.ts`.
6. **Consolidate the duplicates.** `Page`/`PageShell`, `PageActions`, `TableFilterBar`, `Text`/`TextStyle` — delete the aliases, merge the twins.

---

## What we'd REBUILD (from scratch)

Short list — most of this is salvageable, but three things should be built new, not patched:

1. **The overlay layer.** `Modal`/`CommandPalette` need a real `useFocusTrap` + `useDismiss` + portal + `--lb-z-*` foundation, and you're **missing `Drawer`, `Popover`, and `Dropdown/Menu` entirely**. Build a proper overlay subsystem once (Radix-style primitives) and put all overlays on it. Don't bolt focus-trapping onto the current `Modal` ad hoc.
2. **The table.** Don't reconcile two tables — build one `Table` with the IndexTable feature set and the responsive card pattern, then codemod the 28 call sites onto it and delete both.
3. **The distribution + test harness.** This isn't a component, it's the missing foundation: `dist` build, semver, `CHANGELOG`, RTL + jest-axe + visual-regression in CI, codemods, and a lint rule that makes raw `<button>`/`<input>`/hex an error in `apps/*`. Until this exists, everything else is decoration.

---

## The part nobody wants to hear

Your component count is **not** your problem. You have ~50 components; you could ship with 35 better ones. Your problem is that **you scaled adoption before you scaled discipline.** 203 import sites, 9 apps, and the surrounding code is *still* **282 raw buttons — more than your 218 `<Button>`s — and 138 raw inputs, more than your 103 `<Input>`s,** and 417 hex colors deep. Worse: **17 of your components have *zero* adoption** — and they're the *good* ones. Your layout primitives (Box/Stack) and your fully-accessible form controls (Checkbox/Radio/ChoiceList/Combobox) are used **nowhere** in the product; teams hand-roll raw `<div className="flex">` and raw `<input type="checkbox">` instead. So your quality and your adoption are *inversely* correlated. A design system's success metric isn't "how many components" — it's "what fraction of the product is built from it, safely." On that metric you're **under 50%**, with no test net and no lint fence, which means the rest will keep leaking in.

The encouraging flip side: **none of the rejections require a rebuild of what's good.** The tokens stay. The vocabulary stays. The good components stay. You need a focus-trap, an ARIA pass, a contrast nudge, a `prefers-color-scheme` line, three new overlay primitives, one table instead of two, and — above all — **a release process with tests.** That's two to three quarters, not a reset.

---

## Scorecard (Polaris-team grading)

| Dimension | Grade |
|---|---|
| Token architecture | **A−** |
| Component vocabulary / ambition | **B+** |
| Accessibility (controls) | **A−** |
| Accessibility (dialogs/inputs/contrast) | **D** |
| API consistency | **C−** |
| Internal composition | **D+** |
| Overlay completeness | **D** (no Drawer/Popover/Dropdown) |
| Theming (mechanism) | **A−** |
| Theming (coverage: auto/brand/surface) | **C−** |
| Responsive foundation | **C−** |
| Tests / distribution / versioning | **F** |
| Adoption safety (bypass + no net) | **D** |
| **Overall** | **C+ — a strong prototype masquerading as a foundation. Promotable to a real foundation in 2–3 quarters of disciplined work.** |

**Would we let teams build on it today?** Not without the test/`dist`/versioning net and the Modal/Input fixes. **Could it become the single foundation for the whole LetBuyy ecosystem?** Yes — the bones are genuinely good. But "could" is doing the work in that sentence until you ship the foundation *under* the foundation.
