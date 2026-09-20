# LetBuyy Accessibility Release Gates

**Floor: WCAG 2.1 AA** (DOC 06 §4.7 — constitutional, not a wave item). Design to WCAG 2.2 AA where
it adds criteria (2.4.11 Focus Not Obscured, 2.5.7 Dragging, 2.5.8 Target Size, 3.3.7 Redundant
Entry, 3.3.8 Accessible Authentication); never report a WCAG 3.0 draft criterion as a requirement.

**Accessibility is a release gate** for the **money** and **auth** surface classes (checkout, payouts,
refunds, settlement, wallet, KYC, login/OTP/password), and a constant constraint everywhere else. A
screen that fails any MUST below is not done, and **no migration may regress accessibility**.

---

## 1. MUST — blocking

### Structure
- Semantic HTML first: `<button>` for actions, `<a href>` for navigation; never a clickable `<div>`.
  ESLint `no-raw-elements` / `no-raw-form-controls` (UX-R15) — a raw control is a defect.
- Landmarks (`header`, `nav`, `main`, `footer`); one `<main>`; one `<h1>`; no skipped levels;
  `lang` set; unique `<title>`; lists as lists; no duplicate `id`s.

### Keyboard (UX-R16)
- Every action keyboard-operable; focus order matches visual order; no positive `tabindex`.
- **Visible focus on everything** — `:focus-visible` from `--lb-color-focus-ring` (≥ 3:1 against
  adjacent, ≥ 2 px perimeter). Never `outline: none` without a stronger replacement.
- No traps: Escape closes `Modal`/`Drawer`/`Dropdown`/`CommandPalette` and restores focus; nothing
  focusable while visually hidden; skip link on multi-section pages.
- `CommandPalette` and modals are keyboard-complete (DOC 06 verified the merchant palette wiring).

### Colour and contrast
- Text **4.5:1** (3:1 for ≥ 18.66 px bold / ≥ 24 px regular); UI components and graphical objects
  **3:1**; focus ring **3:1**. Enforced at the token level by `validateLetbuyyBrandContrast` for
  injected tenant brands; per-screen review for composed surfaces.
- **Never colour alone** — status carries text or an icon (`StatusPresentationBadge`,
  `ProviderModeBadge` render a label + role).
- Works in forced-colours mode; honours `prefers-contrast`.

### Content
- Meaningful images have real `alt`; decorative `alt=""`; `EmptyStateIllustration` motifs are decorative.
- Link text meaningful out of context; new-tab links say so; plain language; acronyms expanded
  (GST, GSTIN, COD are fine in India — spell them once on onboarding).

### Forms (UX-R23)
- Every control has a programmatically associated visible label (`Input`/`Select`/`Checkbox` carry
  it; `Checkbox` requires `label` — `unstyled` + `aria-label` only when the visible label is a sibling).
- Related controls in `fieldset`/`legend`; `autocomplete` set; errors as text, summary above the form,
  linked via `aria-describedby`, focus moved on failure; required fields marked in text.
- OTP/password flows: no cognitive test as the only factor; paste allowed; resend throttled with a
  visible countdown; identical copy for unknown-user and wrong-password (security I16).

### Motion and media
- `prefers-reduced-motion` honoured (the token kill switch); no autoplay; no flashing > 3/s.

### Responsive
- Reflow at 320 px; 200% zoom; text-spacing survivable; zoom never disabled
  (`MOBILE_FIRST_RESPONSIVE_RULES.md`).

### Components
- Disclosure pattern for menus (`aria-expanded` + `aria-controls`), not `role="menu"`.
- Dialogs manage focus, inertness and Escape (`Modal`/`ConfirmDialog` do; do not re-implement).
- Icon-only controls have an accessible name; decorative icons `aria-hidden="true"`.

### Flutter (merchant_app)
- Semantics labels on icon buttons and status chips; touch targets ≥ 44 dp (density tokens);
  colour is a function of `Theme.of(context)` brightness, never a `const Color`; no colour-only
  status; TalkBack pass on Orders, Finance, a form and a dialog.

---

## 2. SHOULD

- Test with a real screen reader (VoiceOver/Safari, NVDA/Firefox) — automation catches roughly a
  third of real issues.
- Focus indicator distinguishable from hover; respect `prefers-reduced-transparency`.
- Reading age around Year 9 for merchant-facing copy.

---

## 3. Verification

Automated (necessary, **not sufficient**):

```bash
pnpm --filter @letbuyy/ui run validate:ui        # vitest incl. jest-axe assertions on primitives
node scripts/validators/validate-design-system.mjs
pnpm run lint:css
```

The repository already has `jest-axe` in `packages/typescript/ui` and a Storybook (`:9009`,
`test:visual` regression script); reuse that tooling rather than introducing a new stack. Storybook
a11y addon and Lighthouse are not wired into CI at `a751a2ff` — say so when they were not run.

Manual, per touched screen, **required before sign-off**:

```
[ ] Tab through the whole screen — order sane, focus always visible, nothing trapped
[ ] Escape closes menu/dialog/palette and restores focus
[ ] Screen reader: headings outline meaningful; links and buttons make sense out of context
[ ] All images have correct alt (or empty alt)
[ ] Contrast measured for text, focus and hover states, both themes — value recorded
[ ] 400% zoom / 320 px — no horizontal scroll, nothing lost
[ ] Text-spacing overrides applied — no clipping or overlap
[ ] Reduced motion on — no animation of consequence
[ ] Forced-colours on — everything still visible and bounded
[ ] Greyscale — all meaning survives (status, provider mode, errors)
[ ] Focused element never fully obscured by the sticky header / SaveBar
[ ] Money surface: ProviderModeBadge present, text label read aloud
```

---

## 4. Measuring contrast before claiming a defect

A colour has no ratio until its rendering role and composited backdrop are established: text 4.5:1,
meaningful icon or UI boundary 3:1. Alpha dilution is a contrast change. A chip labelled in its own
12% tint is colour-on-tint, not colour-on-surface. Measure with the token values actually composited
(light and dark), record the pair and the ratio; do not eyeball.

---

## 5. Reporting rule

Report what was **tested**, not what was intended. "vitest/jest-axe reports 0 violations" is not
"this screen is accessible" — say which manual checks were run, at which viewports, in which theme,
and which were not. A test filename is not proof. An unrun check is a gap, and gaps get stated.
