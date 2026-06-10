# ACCESSIBILITY_AUDIT.md

**Scope:** `@letbuyy/ui` against WCAG 2.1 AA.
**Audit date:** 2026-06-06
**Method:** source review of ARIA/roles/focus handling + token contrast math. Not a substitute for AT testing (VoiceOver/NVDA) or axe-core CI — both recommended (see end).

---

## Executive summary (for leadership)

Accessibility in `@letbuyy/ui` is **bimodal**: the `controls.tsx` family (Tabs, Combobox, Checkbox, Radio, ChoiceList, Select) is **genuinely well done** — correct roles, `useId`, `aria-describedby` chains, `aria-invalid`, and real keyboard navigation (roving tabindex, Arrow/Home/End, listbox semantics). Charts even ship an sr-only data table. Someone on this team knows ARIA.

But the **two most-used interactive surfaces have real AA failures**:

1. **`Input`/`Textarea` (120 app instances)** — IDs derived from label text (collisions) and **no `aria-describedby`/`aria-invalid`** linking errors to the field. Screen-reader users don't hear the error.
2. **`Modal` (28 effective dialogs)** — **no focus trap, no initial focus, no focus restoration, background not inert.** Keyboard/SR users tab out of the dialog.

Plus a **token contrast problem**: `textMuted` (#94A3B8) and brand-purple text both fall **below 4.5:1** on white, yet are used for real text (muted captions, active tab labels, primary accents).

**Net:** this is **not** an inaccessible system — it's an 80%-there system with a few high-traffic holes. The fixes are well-scoped (focus-trap the Modal, wire Input ARIA, adjust two token values, add a `prefers-reduced-motion` review). None require rearchitecting.

---

## WCAG AA findings (ranked)

### 🔴 A1 — Modal has no focus management · WCAG 2.4.3, 2.1.2
`overlays.tsx` `Modal`: Escape-to-close ✅, `role="dialog"` + `aria-modal` ✅, labelled/described ✅. **Missing:** focus trap, autofocus on open, focus restoration on close, and `aria-hidden`/`inert` on the background. A keyboard user can Tab out of the modal into the page behind it; an SR user is never moved into the dialog. `CommandPalette` shares the gap (autofocuses its input, but no trap). **28 dialog surfaces affected** (1 Modal + 27 ConfirmDialog).

### 🔴 A2 — Input/Textarea: ID collisions + unlinked errors · WCAG 1.3.1, 3.3.1, 4.1.2
`input.tsx`: `id = id || label?.toLowerCase().replace(/\s+/g,'-')`. Duplicate labels → duplicate IDs → broken `htmlFor` and ambiguous AT focus. Error/helper `<p>` are **not** referenced by `aria-describedby`, and the field never sets `aria-invalid`. Compare `Select`/`Combobox`/`Checkbox`, which do all of this correctly — so the fix is "make Input match its siblings." **120 app instances** (Input 103 + Textarea 17).

### 🟠 A3 — Color contrast below AA · WCAG 1.4.3
Token contrast on `surfaceLight` (#FFFFFF):

| Token | Hex | Ratio on white | AA normal (4.5) | AA large (3.0) |
|---|---|---|---|---|
| `textPrimaryLight` | #111827 | ~16.1:1 | ✅ | ✅ |
| `textSecondaryLight` | #6B7280 | ~4.8:1 | ✅ (marginal) | ✅ |
| `textMuted` | #94A3B8 | ~2.6:1 | ❌ | ❌ |
| brand `purple[500]` | #8B5CF6 | ~3.5:1 | ❌ | ✅ |
| `success` #22C55E | #22C55E | ~2.3:1 | ❌ | ❌ |
| `warning` #F59E0B | #F59E0B | ~2.0:1 | ❌ | ❌ |

- `textMuted` is used for real text (`Text tone="muted"`, placeholders inland). **Fails AA.**
- Brand purple is used as **active-tab text** and primary accent text (`Tabs` underline/pills active state, `--lb-color-primary`) — **fails AA for normal text** (passes only as large/bold or non-text).
- `success`/`warning`/`danger` solid colors are used as **Badge/Banner text on soft backgrounds** — the soft bg raises the effective ratio somewhat, but `Badge` `success`/`warning` text on white-ish soft fills is borderline; needs measurement on the actual `statusSoft` pairs.

**Action:** darken `textMuted` to ≥ #6B7280-class, and use a darker purple (e.g. `purple[700]` #6D28D9 ≈ 5.0:1) for purple-on-light **text**, keeping #8B5CF6 for fills/icons.

### 🟠 A4 — Tooltip not associated with its trigger · WCAG 1.3.1, 4.1.2
`overlays.tsx` `Tooltip` renders `role="tooltip"` content but the trigger has no `aria-describedby` pointing at it. CSS hover/focus-within shows it visually; AT users get no association. Also hover-only reveal (no tap support) is a mobile gap.

### 🟡 A5 — `MaterialIcon`/decorative SVG · mostly OK
Most icons are `aria-hidden="true"` (correct for decorative). `MaterialIcon` doesn't force `aria-hidden`, so semantically-meaningful icon-only buttons rely on the **parent** providing an `aria-label` — which the library does in its own icon buttons (Modal close, toast dismiss, filter remove → all have `aria-label`). Consumer-built icon buttons may forget. Document the rule.

### 🟡 A6 — `prefers-reduced-motion` partially honored
`tokens.ts` gates empty-state float/drift animations behind `@media (prefers-reduced-motion: no-preference)` ✅. But component-level `transition`/`animate-spin`/`motion-safe:hover:-translate-y` are not all reduced-motion-aware. Spinners spin regardless (acceptable as a loading indicator). Review hover-lift transforms under reduced motion.

### 🟡 A7 — IndexTable selection semantics
Checkboxes are raw `<input type="checkbox">` with `aria-label` ✅, but the table doesn't expose selection state via `aria-selected`/`aria-multiselectable` on the grid, and the mobile "Open" affordance is a generic button. Functional, not optimal for AT.

---

## What's done well (keep as the template)

| Component | Good a11y |
|---|---|
| **Tabs** | `role="tablist/tab/tabpanel"`, roving `tabIndex`, `aria-selected`, Arrow/Home/End, `aria-controls`/`aria-labelledby` |
| **Combobox** | `role="combobox"`, `aria-autocomplete`, `aria-expanded`, `aria-activedescendant`, `aria-controls`, Arrow/Enter/Escape |
| **Checkbox/Radio/ChoiceList** | `useId`, `aria-describedby` chain, `aria-invalid`, `fieldset/legend` |
| **Select** | `aria-invalid`, `aria-describedby`, `aria-required` |
| **Banner/Toast** | `role="alert"` (critical) / `status`, `aria-live="polite"` |
| **Chart** | `role="img"` + `<title>` + **sr-only `<dl>` data table** |
| **ProgressBar/Spinner** | `role="progressbar"` w/ valuemin/max/now; `role="status"` + sr-only label |
| **Breadcrumbs/Pagination** | `aria-label`, `aria-current="page"` |
| **Focus rings** | consistent `focus-visible:ring-2 ring-[--lb-color-focus-ring]` across interactive elements |

The library's **focus-visible discipline is excellent** — virtually every interactive element has a visible focus ring keyed to a token. That's better than many shipping systems.

---

## Keyboard navigation matrix

| Component | Tab | Arrows | Enter/Space | Esc | Trap |
|---|---|---|---|---|---|
| Button | ✅ | — | ✅ native | — | — |
| Tabs | ✅ | ✅ | ✅ | — | — |
| Combobox | ✅ | ✅ | ✅ | ✅ | — |
| Select | ✅ native | ✅ native | ✅ | — | — |
| Checkbox/Radio | ✅ | ✅ native | ✅ | — | — |
| Modal | ⚠️ (escapes) | — | — | ✅ | ❌ |
| CommandPalette | ⚠️ (escapes) | ❌ (no list arrow-nav) | ✅ click | ✅ | ❌ |
| IndexTable | ✅ | — | ✅ | — | — |

**Gap:** `CommandPalette` — a ⌘K palette — has **no Arrow-key navigation of its results** (mouse/click only) and no focus trap. For a power-user feature this is a notable miss.

---

## Scorecard

| Area | Grade |
|---|---|
| Roles / semantics (controls) | **A−** |
| Keyboard nav (controls) | **A−** |
| Focus-visible states | **A** |
| Dialog focus management | **F** |
| Input error semantics | **D** |
| Color contrast (tokens) | **C−** |
| Reduced motion | **B−** |
| Screen-reader association (tooltip/icons) | **C+** |
| **Overall** | **C+ / B−** — strong controls, high-traffic dialog & input gaps |

---

## Remediation plan

1. **Modal/CommandPalette focus trap** (initial focus, trap, restore, `inert` background, palette Arrow-nav). Single shared `useFocusTrap` hook. *(Pair with the z-index scale — see token Z-1.)*
2. **Input/Textarea ARIA parity** — adopt `useId` + `aria-describedby` + `aria-invalid` to match `Select`/`Combobox`.
3. **Token contrast fixes** — darken `textMuted`; use `purple[700]` for purple **text**; verify all `statusSoft` text pairs ≥ 4.5:1.
4. **Tooltip association** — wire `aria-describedby` from trigger; add tap/long-press for touch.
5. **Add axe-core + jest-axe to CI** and a manual VoiceOver/NVDA pass on Modal, IndexTable, Combobox, forms.
6. **Document the icon-button rule** (`aria-label` required for icon-only).
