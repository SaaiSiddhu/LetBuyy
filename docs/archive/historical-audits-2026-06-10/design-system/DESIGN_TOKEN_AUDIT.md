# LetBuyy Design Token Audit (Phase 3)

**Date:** 2026-06-08 · **Source:** `packages/typescript/ui/src/tokens.ts` (1,374 LOC), `fonts.ts`, every app `globals.css`, `apps/mobile/.../letbuyy_color_tokens.dart`. Read in full; values quoted verbatim.

---

## Verdict

**LetBuyy has a single, well-structured token source of truth *for web TypeScript* — and two-and-a-half competing ones in practice.**

- ✅ **One canonical layered token model** in `tokens.ts` (primitive → semantic → component), correctly emitted to `--lb-*` CSS variables, themed for light/dark/auto, 5 surfaces, 3 densities. This is real and good.
- ⚠ **Parallel source #2:** every app's `globals.css` redeclares theme values (`--primary`, `--text-primary`, `--border`…) in raw `rgb()`, "synced by hand."
- ⚠ **Parallel source #3:** the mobile app's Dart token file — already drifted.
- ⚠ **Half a source #4:** ~613 raw Tailwind default color utilities in app JSX that resolve to Tailwind's palette, not tokens.

So the honest grade is **B− on color, B on the metric scales, C on cross-surface single-source-of-truth.** The architecture deserves an A−; the *enforcement boundary* is what pulls it down.

| Token family | Single source? | Grade | One-line finding |
|---|---|---|---|
| Color | Partial | C+ | Canonical 3-tier model, but raw hex leaks into semantic layer + 3 parallel channels (CSS/Tailwind/Dart) |
| Spacing | Web: yes | B+ | Clean numeric scale; **named+numeric aliases** both public; Dart scale diverges |
| Typography | Web: yes | B+ | Role-based + fluid `clamp()`; **but h1–h4 aliases kept alongside role names** |
| Elevation (shadow) | Yes | A− | 5 tokens, light/dark card variants; tidy |
| Radius | Yes | A | 5-step scale, fully tokenized, consumed everywhere |
| Motion | Yes | A− | duration/easing/transform + `prefers-reduced-motion`→0; minor duration-alias overlap |
| Breakpoints | Defined, **not wired** | C | DS defines xs/mobile/sm/md/lg/xl; apps use Tailwind defaults; preset adopted by 0 apps |
| Z-index | Yes | A | 7 named layers; but overlays don't portal, so layering can still be defeated |
| Icons | Yes | B+ | ~450 lucide icons single-exported; sizing tokenized; no app may hardcode SVGs (not enforced) |

---

## 1. Color

### 1.1 Primitive palette — incomplete & irregular (root cause of most color debt)

`letbuyyPrimitiveTokens.color`:

```
purple {300,500,600,700}            gray {50,100,125,150,175,200,400,500,900}
slate  {700,800,850,900,950}        green {100,500,700,950}
amber  {100,500,800,950}            red {100,500,600,700,950}
blue   {100,500,700,950}            white black
opacity{purpleSubtle, overlayLight, overlayDark}
```

**Problem:** this is a *hand-picked* set, not a systematic scale. `gray` jumps `200→400→500→900` (no 300/600/700/800) and carries oddball steps `125/150/175`. `purple` has no `100/200/400/800/900`. Compare the reference systems: Polaris and Cloudflare generate **full, perceptually-even ramps** (Cloudflare = 10 hues × 10 luminosities; Stripe Sail generates ramps in OKHsl with WCAG contrast guaranteed between fixed steps). LetBuyy's gaps mean the semantic layer *cannot* always reference a primitive…

### 1.2 Raw hex leaks into the semantic layer

Because the primitive ramp is incomplete, `letbuyySemanticTokens` inlines raw hex that exists in **no** primitive token:

| Location | Raw value | Should be |
|---|---|---|
| `light.button.primary.hover` | `#5B21B6` | `purple.800` (missing) |
| `light.button.primary.active` | `#4C1D95` | `purple.900` (missing) |
| `dark.text.secondary` (`textSecondaryDark`) | `#CBD5E1` | `slate.300` (missing) |
| `dark.statusText.danger` | `#FCA5A5` | `red.300` (missing) |
| `dark.statusText.info` | `#7DD3FC` | `blue.300` (missing) |

This violates the core 3-tier invariant ("no raw values above the primitive layer") that every reference system enforces. It also means the `no-hardcoded-hex` ESLint rule **cannot be turned on inside the design system's own token file** — the system exempts itself from its own rule.

### 1.3 Theming math is good

`createLetbuyyBrandVariables()` derives hover/active/subtle from a single brand color via `color-mix(in srgb, … 12%, transparent)`, and `validateLetbuyyBrandContrast()` computes WCAG ratios for primary-text (≥4.5), CTA-text (≥4.5), focus-ring (≥3) using a correct sRGB relative-luminance implementation. **Baking contrast validation into the brand pipeline is best-in-class** (matches Stripe Sail / Cloudflare philosophy). Gap: it validates only 3 tokens and is a *callable* check, not a *CI gate* — nothing fails a build if a brand fails contrast.

### 1.4 Three parallel color channels (the single-source-of-truth break)

1. **`globals.css` per app** — raw `rgb()` redeclarations (`--primary: rgb(139 92 246)`, `--text-primary: rgb(15 23 42)`, `--border: rgb(226 232 240)`…). Raw-color counts: merchant **382**, marketing **304**, app-marketplace **235**, theme-marketplace 69, identity 43, storefront 18, others ~10. Comment literally says "synced with accounts app theme" → manual sync = guaranteed drift. **Not** covered by ESLint (`.css` is never scanned).
2. **Raw Tailwind palette in JSX** — `bg-white`/`bg-black`/`text-white` (251) + `text-gray-500`/`bg-blue-100`/etc. (362) = **~613**. These render Tailwind defaults (e.g. gray-500 `#6b7280`), bypass `--lb-*`, and **do not switch in dark mode** → a correctness bug, not just a style nit.
3. **Mobile Dart** — see §8.

**Net:** the *intended* single source (`tokens.ts`) is excellent; the *effective* number of color sources a new screen can pull from is four.

---

## 2. Spacing

`tokens.space`: `0,4,8,12,16,20,24,32,40,48,64,96` (px), exposed **twice**: numeric `--lb-space-0..11` *and* named `--lb-space-xs/sm/md/lg/xl`. The file comments admit named are "public aliases for compatibility."

- ✅ 4px base grid, consistent, consumed via `--lb-space-*` everywhere in components.
- ⚠ **Dual naming** (numeric + named) doubles the vocabulary a developer must learn and is exactly the kind of ambiguity the `no-new-token-alias` validator now exists to *stop growing* — meaning the team already recognizes this as debt.
- ⚠ **Dart divergence:** mobile spacing is `0,2,4,6,8,12,16,20,24,32,40,48,64` — adds `2`/`6`, drops `96`. Web and native are on different grids.

**Fix:** pick numeric `--lb-space-*` as canonical, deprecate named aliases via codemod, regenerate Dart from the same source.

---

## 3. Typography

`tokens.typography`:

- `fontFamily` body/display/mono from `letbuyyFontStacks` (Geist via `next/font/local`, wired in each app layout). ✅ Single source.
- `fontSize`/`lineHeight` are **role-based** (`pageTitle, sectionTitle, cardTitle, body, secondary, table, sidebar, caption, badge…`) **plus** legacy heading aliases (`display, h1–h4`) **plus** fluid `clamp()` variants (`displayFluid, h1Fluid, h2Fluid`). 
- `fontWeight` regular/medium/semibold/bold. ✅

**Strengths:** role-based naming is the modern best practice; fluid display type is a nice touch. **Weakness:** the same overlap pattern as spacing — `h1–h4` *and* `page-title/section-title/card-title` both public, so two developers will pick differently for the same visual. Consolidate to roles; keep `h*` only as deprecated aliases.

---

## 4. Elevation, radius, motion, z-index

- **Shadow** (`sm/md/lg` + `cardLight/cardDark`): clean, theme-aware card shadow via `--lb-shadow-card`. **A−.**
- **Radius** (`sm4/md8/lg12/xl16/full999`): fully tokenized, consumed in every component. **A.**
- **Motion** (`duration{hover,menu,carousel,fast,normal,slow}`, `easing{standard,out,emphasized}`, `transform{hoverLift,hoverScale}`) with `@media (prefers-reduced-motion: reduce)` zeroing all durations and disabling float keyframes. **A−.** Minor: `hover/menu/fast` are all `150ms` (alias overlap) and `standard===out===ease-out` — harmless but redundant.
- **Z-index** (7 layers `base→tooltip`): named and ordered. **A** for the tokens — but because overlays **don't portal**, a child stacking context can still trap a `z-[var(--lb-z-modal)]` element below sibling content. Tokens are necessary but not sufficient without portals.

---

## 5. Breakpoints (the quiet gap)

DS defines `xs360, mobile480, sm640, md768, lg1024, xl1280` and exports `letbuyyTailwindPreset`/`letbuyyTailwindScreens`. **But:** `grep` shows **0** apps import the preset; apps use `@theme inline` + Tailwind's *default* breakpoints (`sm640/md768/lg1024/xl1280/2xl1536`). Consequences: the DS's `xs`/`mobile` breakpoints are unusable in apps; apps' `2xl:` (used 3×) hits a 1536 breakpoint the DS never defined; responsive grids in `layout.tsx` hard-code `sm/md/lg/xl` class strings that happen to match Tailwind defaults but are not derived from tokens. **Two breakpoint systems that agree by luck, not by construction.**

---

## 6. Icons

~450 icons single-exported from `icons.tsx` (`export * from './icons'`), sized via `--lb-density-*-icon-size` and the `.letbuyy-icon` class. ✅ One icon source; consistent sizing. ⚠ No lint rule forbids raw inline `<svg>` in apps, so icon divergence is *possible* (not currently widespread). Recommend an `EmptyStateIllustration`-style policy + a lint rule.

---

## 7. Format & tooling gap (strategic)

Tokens are a **bespoke TypeScript object** serialized to CSS by a custom recursive kebab-case generator. There is **no** W3C DTCG (`$value`/`$type`) representation and **no** Style Dictionary / Tokens Studio pipeline. The W3C Design Tokens format reached its first **stable v1 (2025.10)** and is now the industry interop standard (Style Dictionary v4, Tokens Studio, Figma variables, Supernova). Consequences for LetBuyy:

- **No design↔code parity:** no Figma kit can be generated from, or validated against, these tokens.
- **No cross-platform codegen:** the Dart drift exists precisely because there is no pipeline to emit Swift/Kotlin/Dart from one source. DTCG + Style Dictionary is exactly the fix Cloudflare/Atlassian use.

---

## 8. Mobile token drift (verified, side-by-side)

`apps/mobile/merchant-app/lib/theme/letbuyy_color_tokens.dart` vs `tokens.ts`:

| | Web `tokens.ts` | Mobile `*.dart` | Drift |
|---|---|---|---|
| brand primary | `#8B5CF6` (purple500) | `0xFF8B5CF6` | ✅ match |
| pink accent | — none — | `accentPink #EC4899` (+4 shades) | ⚠ mobile-only color family |
| success-strong / cyan / teal | — none — | `#10B981 / #06B6D4 / #14B8A6` | ⚠ mobile-only |
| slate ramp | 700,800,850,900,950 | **50→950 full** | ⚠ different ramps |
| spacing | 0,4,8,12,16,20,24,32,40,48,64,96 | 0,2,4,6,8,12,16,20,24,32,40,48,64 | ⚠ different grid |
| dark / semantic / component layers | ✅ all three | ❌ none (flat color list) | ⚠ no theming parity |

The mobile app cannot consume `@letbuyy/ui` (it's Dart/Flutter), and there is no generator bridging them, so **"consistent UX across Merchant web + Merchant mobile" is currently unenforceable.**

---

## 9. Recommendations (ranked)

1. **Complete the primitive ramps** (full 50–900 for purple/gray/slate/status hues; ideally generated in OKLCH/OKHsl with contrast guaranteed between fixed steps, à la Stripe/Cloudflare). Then delete every raw hex from the semantic layer. *Unblocks turning `no-hardcoded-hex` on inside the DS itself.*
2. **Adopt W3C DTCG + Style Dictionary** as the token source; emit CSS (`--lb-*`), a Tailwind theme, **Dart**, and a **Figma**-importable file from one file. Kills channels #3 and #4 at the root.
3. **Fence the CSS + Tailwind channels:** add a Stylelint rule banning raw color in `.css`/non-`--lb-*` custom props; restrict Tailwind's color palette in the shared preset to `--lb-*` tokens so `bg-gray-500`/`bg-white` simply don't exist. Migrate the ~613 occurrences with a codemod. Replace per-app `globals.css` color blocks with the generated token CSS.
4. **Collapse alias debt:** choose canonical names (numeric space, role typography), ship codemods, then *remove* (not just freeze) the aliases.
5. **Wire breakpoints:** make every app consume `letbuyyTailwindPreset`; define `2xl` token or forbid `2xl:`.
6. **Promote contrast validation to a CI gate** over all status/text-on-surface pairs, not just 3 brand tokens.

> Net: the token *system* is genuinely strong. The token *boundary* is porous in four places. Closing the boundary — not redesigning the tokens — is the work.
