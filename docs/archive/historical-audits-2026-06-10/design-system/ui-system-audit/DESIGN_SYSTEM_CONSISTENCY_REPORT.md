# DESIGN_SYSTEM_CONSISTENCY_REPORT.md

**Scope:** `@letbuyy/ui` benchmarked against Shopify Polaris, Stripe, Linear, and Vercel (Geist).
**Audit date:** 2026-06-06
**Lens:** consistency, predictability, composition.

---

## Executive summary (for leadership)

`@letbuyy/ui` is clearly **modeled on Shopify Polaris** — and that lineage shows in the best ways: `Page`/`Section`/`Card`/`BlockStack`/`InlineStack`/`ChoiceList`/`IndexTable`/`Banner`/`EmptyState` are Polaris's exact vocabulary, and the three-tier token model matches Stripe/Polaris/Material practice. **As a v0, it is meaningfully closer to Polaris than most internal design systems ever get.**

Where it diverges from all four references is **discipline, not ambition**:

- **Polaris/Stripe/Linear/Vercel each enforce a single API grammar.** LetBuyy doesn't — five change-handler conventions, three "size" prop names, two text components, two tables (see `COMPONENT_API_STABILITY_REPORT.md`).
- **All four reference systems compose internally** (their `Button` is *the* button, used inside their own `Modal`/`Header`). LetBuyy re-implements raw `<button>` inside `PageHeader`, `SaveBar`, `IndexTable`, `Pagination`, `DensityToggle` — so the system contradicts itself.
- **All four publish versioned, tested, documented packages.** LetBuyy is `0.0.1`, private, untested, ships raw source.

The gap to "Polaris-class" is **~2–3 quarters of hygiene**, not a rebuild. The bones are right.

---

## Scorecard vs references

Scale: ✅ at/near reference bar · ⚠️ partial · ❌ absent.

| Dimension | Polaris | Stripe | Linear | Vercel/Geist | **LetBuyy** | Verdict |
|---|---|---|---|---|---|---|
| **Token tiers (primitive→semantic→component)** | ✅ | ✅ | ✅ | ✅ | **✅** | At bar — genuine strength |
| **Density / sizing system** | ⚠️ | ⚠️ | ✅ | ⚠️ | **✅** | **Above** most refs |
| **Layout primitives (Stack/Box/Page)** | ✅ | ⚠️ | ⚠️ | ✅ | **✅** | At bar |
| **Single API grammar** | ✅ | ✅ | ✅ | ✅ | **❌** | Below — 5 handler styles |
| **Internal composition (own Button used internally)** | ✅ | ✅ | ✅ | ✅ | **❌** | Below — raw buttons inside |
| **Overlay suite (Modal/Drawer/Popover/Dropdown/Tooltip)** | ✅ | ✅ | ✅ | ✅ | **⚠️** | Modal/Tooltip/CommandPalette only; **no Drawer/Popover/Dropdown** |
| **Focus management in overlays** | ✅ | ✅ | ✅ | ✅ | **❌** | No focus trap |
| **Accessibility baseline (WCAG AA)** | ✅ | ✅ | ✅ | ✅ | **⚠️** | Strong in controls, gaps in Input/Modal/contrast |
| **Theming (light/dark + system)** | ✅ | ✅ | ✅ | ✅ | **⚠️** | Light/dark exist; `auto` broken |
| **Multi-brand / white-label** | ⚠️ | ✅ | ❌ | ⚠️ | **❌** | `surface` axis inert |
| **Versioning / semver / changelog** | ✅ | ✅ | ✅ | ✅ | **❌** | `0.0.1`, private |
| **Tests** | ✅ | ✅ | ✅ | ✅ | **❌** | 0 tests |
| **Docs / Storybook** | ✅ | ✅ | ✅ | ✅ | **⚠️** | 4 stories, no usage docs |
| **Distribution (built artifact)** | ✅ | ✅ | ✅ | ✅ | **❌** | ships raw `src` |
| **`as`/`asChild` polymorphism** | ⚠️ | ✅ (Radix-style) | ✅ | ✅ | **⚠️** | `Box`/`Text` only; not Button |
| **Icon system** | ✅ | ✅ | ✅ | ✅ | **✅** | lucide + Material alias map |

---

## 1. Consistency

### Where LetBuyy matches the bar
- **Polaris-faithful vocabulary.** `Page > Section > Card`, `BlockStack`/`InlineStack`, `ChoiceList`, `IndexTable` with saved views + bulk actions, `Banner`, `EmptyState`, `SaveBar`. A Polaris developer would feel at home immediately.
- **Token-driven styling.** Like all four refs, components read CSS variables, not hardcoded values internally.
- **Density tiers** exceed Polaris (which has a single density) and rival Linear's compact ethos.

### Where it falls short (vs all four)
- **Five change-handler grammars** (`onClick`, `onCheckedChange`, `onValueChange`, `onChange`, `onPageChange`). Polaris uses `onChange` consistently; Radix/Stripe use `onValueChange`/`onCheckedChange` consistently. LetBuyy mixes all of them.
- **Three "size" names** (`size`, `controlSize`, `size`). Reference systems use one.
- **Dual vocabularies** (`danger`/`critical`, `Text`/`TextStyle`, `helperText`/`description`). Polaris has exactly one word per concept.
- **Variant unions are per-component**, not a shared `tone`/`intent`. Stripe/Polaris share an intent vocabulary across Badge/Banner/Button.

**Predictability cost:** a developer cannot guess the API of an unfamiliar LetBuyy component from a familiar one. In Polaris/Stripe they can.

---

## 2. Predictability

| Question a dev asks | Polaris/Stripe answer | LetBuyy answer |
|---|---|---|
| "How do I handle a value change?" | one convention | depends on the component |
| "What's the error/help prop?" | `error`/`helpText` everywhere | `error` + `helperText` *or* `description` |
| "Which table do I use?" | one table | `DataTable` or `IndexTable`? |
| "How do I size this control?" | `size` | `size` or `controlSize` |
| "Will `className` override win?" | yes (tailwind-merge / styled) | maybe (naive `cx`) |
| "Is `name` type-checked?" (icons) | yes | no (`string & {}`) |

LetBuyy fails the predictability test on six common questions. Each is individually small; collectively they are why adoption leaks into raw `<button>`/`<input>` (282/138 occurrences) — developers route around uncertainty.

---

## 3. Composition

**Reference systems are recursively composed.** Polaris's `Modal` footer uses Polaris `Button`; Stripe's primitives nest; Radix-based systems share `Slot`.

**LetBuyy partially composes:**
- ✅ `ConfirmDialog` → `Modal` → `Button` (correct).
- ✅ `IndexTable` → `Skeleton`, `Badge`.
- ❌ `PageHeader.renderDefaultAction` builds raw `<button>`/`<a>` instead of `Button`.
- ❌ `SaveBar`, `IndexTable` (selection/sort/bulk), `Pagination`, `DensityToggle`, mobile-card "Open" button — all raw `<button>`.
- ❌ `PageHeader` re-implements `Breadcrumbs` instead of using the `Breadcrumbs` component.

So the **same visual atom (a button, a breadcrumb) exists in 3–4 implementations** inside the system. That is the inverse of composition and the clearest "not yet Polaris-class" tell.

**Polymorphism:** `Box`/`Text` accept `as` (good). `Button` does not, so link-buttons are hand-rolled — the exact gap Radix `asChild`/Polaris solves.

---

## 4. What each reference team would single out

- **Polaris:** "You copied our nouns — now enforce our grammar. One table, one text component, one intent vocabulary, and use your own Button inside your own components."
- **Stripe:** "Tokens are good. Now ship a versioned, tested, documented package — and add the missing overlay primitives (Popover/Dropdown) that every dashboard needs."
- **Linear:** "Density is great and on-brand for us. Tighten focus states and keyboard semantics in dialogs; we'd reject the Modal focus handling."
- **Vercel/Geist:** "Near-black primary CTA is our move and it reads well — but commit to it. Right now your brand is purple and your light CTA is black; pick one. Also: kill the alias sprawl in tokens."

---

## Consistency verdict

**Architecturally Polaris-class; operationally pre-1.0.** The vocabulary, token model, and density system are at or above reference quality. The deductions are all **enforcement**: one API grammar, internal composition, the missing overlay primitives, focus management, tests, versioning. None require a rebuild — they require a style guide, a consolidation pass, and a release process. Roadmap in `LETBUYY_UI_SYSTEM_V2.md` and `UI_SYSTEM_GOVERNANCE.md`.
