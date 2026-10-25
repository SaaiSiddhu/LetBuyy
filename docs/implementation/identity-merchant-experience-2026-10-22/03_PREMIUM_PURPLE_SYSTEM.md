# Premium purple visual system

**Owner update, 23 October 2026:** The premium purple palette role mapping is now authorized for Merchant and Settings. Existing layouts, architecture and domain behavior remain preserved. Admin light bindings now implement these roles. [Current implementation and scope](10_CANONICAL_ADOPTION.md).

**Owner direction update, 22 October 2026:** preserve the existing rendered LetBuyy UI, palette, font families and layout. The proposals below are historical design references, not instructions to recolor or rebuild the application. The first implementation slice adds only a shared 44 px mobile action-target size role; it changes no color values. See [implementation results](09_IMPLEMENTATION_RESULTS.md).

This proposed role mapping extends the current `brandInk` primitives in [the canonical token source](../../../packages/typescript/ui/src/tokens.ts). It is a specification for a later implementation slice; no application palette has been changed by this audit. The [board](assets/premium-purple-board.png) is an original schematic with illustrative records, not a screenshot of a shipped redesign.

## Color roles

| Role | Proposed value | Existing source and use |
| --- | --- | --- |
| Navigation/header plum | `#1E1A2D` | `brandInk[850]`; coordinate current near-black header and purple rail |
| Primary action | `#2C2642` | Preserve `brandInk[800]`; decisive filled action, not every clickable object |
| Primary hover | `#362C58` | Preserve `brandInk[700]` |
| Primary pressed | `#181524` | `brandInk[900]`; explicit pressed role after composed-state checks |
| Links and quiet accent text | `#523F97` | `brandInk[500]`; use underline/context as well as hue |
| Focus indicator on light surfaces | `#6C54C4` | `brandInk[400]`; visible ring plus offset where required |
| Selected subtle surface | `#E7E3F7` | `brandInk[100]`; tabs, selected rows, small contextual areas |
| Rail secondary text | `#C9BFED` | `brandInk[200]`; preserve readable secondary navigation |
| Canvas | `#F6F7F9` | Current local neutral; broad work background |
| Card/input surface | `#FFFFFF` | Current surface; central work content |
| Primary text | `#111827` | Current primary text; product names, values, labels |
| Secondary text | `#6B7280` | Current secondary; never reduce with extra opacity for essential text |
| Decorative divider | `#E5E7EB` | Current border; quiet nonessential separation |
| Essential control boundary candidate | `#8F88A9` | Rounded sRGB mix of `brandInk[600]` 60% and white 40%; new semantic/component role only where a boundary is needed to identify a control |

`#443870`, `#9D8DD8` and the rest of the existing ramp remain useful for secondary artwork and supported appearance roles. Do not introduce a second set of hex constants in app CSS. The new control-boundary value is a proposal to test against real composed inputs, not a declaration that every current border fails.

Use neutral surfaces for most of the workspace. Reserve filled plum for the principal action, stable navigation identity and deliberate emphasis. Give secondary actions a white/very light neutral surface and a visible boundary; use text actions for tertiary work. Use existing green, amber, red and blue status roles with icon/text labels. Revenue being positive, a draft selection and a destructive action should not all turn purple.

## Measured pair contrast

The [reproducible calculation](assets/render_palette.py) uses WCAG sRGB relative luminance and compares unrounded ratios. Results are stored in [contrast-pairs.json](assets/contrast-pairs.json).

| Pair | Ratio | Interpretation |
| --- | ---: | --- |
| Graphite text / white | 17.74:1 | Strong normal-text pair |
| Secondary text / white | 4.83:1 | Meets normal-text 4.5:1 threshold |
| Secondary text / canvas | 4.51:1 | Narrow margin; do not apply extra opacity |
| White / primary plum | 14.35:1 | Strong primary action label pair |
| White / rail plum | 16.92:1 | Strong rail text pair |
| Lavender rail text / rail | 9.80:1 | Readable secondary navigation |
| Link purple / white | 8.34:1 | Readable links |
| Link purple / selection wash | 6.65:1 | Readable selected text |
| Focus / white | 5.67:1 | Good light-surface indicator pair |
| Proposed control boundary / white | 3.35:1 | Candidate essential boundary |
| Proposed control boundary / canvas | 3.13:1 | Candidate essential boundary; test adjacency |
| Decorative divider / white | 1.24:1 | Do not use as the sole essential control/state cue |
| Focus purple / primary plum | 2.53:1 | Ring needs a white separation/appropriate inverse focus role |

Normal text generally requires 4.5:1; qualifying large text 3:1. Meaningful control/state boundaries generally need 3:1 against adjacent colors. See [W3C text contrast](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) and [non-text contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html). These opaque pair calculations do not certify shadows, translucent overlays, rendered pages, all status badges or whole-product accessibility. Recompute composite colors over their actual backgrounds.

## Scope and implementation

Author primitives, semantic roles, component roles and permitted surface bindings only in `packages/typescript/ui/src/tokens.ts`. Retain generated CSS/Dart consumers and the existing exporter. Map the merchant admin surface; ensure identity's use of the admin ink palette continues to resolve inside `DesignSystemRoot`. Do not restore app-local primary overrides to win specificity. Fix any unrelated stock-violet border/glow through the same semantic role rather than a second hardcoded purple.

Review all affected shared consumers: identity, merchant, thin console, Storybook and generated mobile tokens. A merchant-only density adjustment belongs in an existing surface/component contract, not a global root override that changes every app. Update stale color documentation after implementation, with generated examples showing surface-specific values; a generic primary entry alone is misleading.

Identity stays **light-only with no theme switch** under D-AUTH-LIGHT. Shared dark roles already exist; their reachability and any merchant policy exception need a separate recorded decision. This plan does not enable a new appearance control. The merchant palette must not overwrite theme-authored storefront colors or hosted checkout branding.

## Typography

Retain local Geist Sans, display and mono assets. Use the existing semantic size/line-height roles rather than a new font library. Proposed task assignments:

| Element | Size / line height | Weight | Usage |
| --- | --- | --- | --- |
| Identity page heading | 28/36 or existing approved identity variant | 600 | One clear task heading; no dashboard density |
| Merchant page title | 24/32 | 600 | Keep current measured scale |
| Section title | 18/24 | 600 | Major form/report group |
| Card title | 16/20 | 600 | Nested task group, avoid redundant headers |
| Body and labels | 14/20 | 400; labels 500 | Operational reading and editing |
| Table cells | 13/18 | 400 | Short values; long text wraps or has a detail route |
| Table heading | 13/18 | 500 | Real table header semantics |
| Supporting caption | 12/16 | 400–500 | Nonessential hints, not critical errors or prices |
| Currency/quantity | Inherit task role, tabular numerals | 500 where useful | Right aligned numeric columns, consistent INR/minor-unit formatting |

Use sentence case. Avoid uppercase paragraphs, repeated eyebrow labels and multiple competing page titles. Never replace unknown values with zero to keep alignment. Preserve text enlargement and multiline labels; do not shrink labels to keep a row at a fixed height.

## Spacing and geometry

The current scale is sufficient: 2, 4, 6, 8, 12, 16, 20, 24, 32, 40, 48, 64 and 96 px. Keep these as tokens and add role aliases only when needed by a shared pattern.

| Pattern | Proposed assignment |
| --- | --- |
| Icon/text gap | 8 px; 4–6 px for compact metadata |
| Label to field / field to hint | 6–8 px / 4–6 px |
| Fields within a group | 16 px; related inline values 12 px |
| Card padding | 20–24 px desktop, 16 px narrow screens |
| Section gap | 24 px; major page groups 32 px |
| Page gutter | 24 px roomy desktop, 16 px at ordinary/narrow widths; preserve table workspace when the shell consumes width |
| Navigation | Keep 220 px expanded; optional 60–64 px collapsed only after label/flyout acceptance |
| Settings local navigation | Existing 240 px role, collapses to usable mobile entry |
| Header | Keep 64 px unless real content requires a larger density variant |
| Buttons/fields | Existing compact operational 36 px; 40 px comfortable; 44 px identity/mobile primary action; touch hit areas may extend beyond the visual shape |
| Table rows | Preserve current 44 px compact baseline; allow multiline growth and comfortable variant |
| Corners | 4 px small tags, 8 px controls, 12 px cards/dialogs, 16 px major workspace; pills for suitable chips only |
| Focus | 2 px visible indicator with 2 px separation where needed; verify actual adjacent surfaces |

These are proposed uses of existing roles, not a mandate to replace every local size. Essential controls should satisfy [WCAG target-size criteria](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), including its spacing/exceptions. A 44 px comfortable target is a product recommendation; WCAG 2.2 AA does not universally require 44 px controls.

Avoid a card inside another identical card unless the boundary communicates a separate task. Shadows belong to elevation (popover/dialog/drag), not every row. Reduce broad purple glows and ambient gradients around operational controls. A crisp boundary, useful whitespace and stable alignment do more for this direction than increased blur.

## Icons and illustrations

Retain Lucide React and the compatibility mapping already in `@letbuyy/ui`. Standardize functional icons at 16 px inline, 20 px navigation/action, 24 px primary empty-state symbol where the existing density role supports it. Match optical weight and align to text. Decorative icons use `aria-hidden`; icon-only controls need a meaningful accessible name and a tooltip where appropriate. Do not replace meaningful selected/avatar/status backgrounds merely to make every graphic transparent.

Audit the existing empty-state illustration registry before creating assets. Fill only genuine gaps in one coordinated plum/lavender family: first product, no orders yet, no customers, connect domain and no theme installed. Prefer original restrained line/soft-volume scenes, one focal object, real alpha when foreground cutouts are required, and no copied Shopify art. Store provenance, source, dimensions, display range and decorative/informative purpose in the current asset registry. Error, denied, expired and no-match states usually need concise text and a useful action instead of large artwork.

Theme catalog artwork represents each storefront theme's own palette. Keep “illustrative preview” labels until actual screenshots/rendered previews are available. Do not recolor every theme preview plum.

## Motion and loading

Reuse the existing duration roles: 150 ms hover/menu, 180 ms normal, 200 ms slow, 300 ms carousel. Prefer opacity/transform for local transitions and immediate content readiness; do not enforce a minimum blank interval between pages. Avoid spring/bounce in merchant forms and bulk actions. Reserve subtle emphasis for newly added content, expanded hierarchy and successful local state changes.

Use a 2 px **indeterminate** navigation strip as a proposed feedback pattern, not fabricated completion percentage. The strip tracks pending route work; charts, fetches and iframe preview own their own readiness. Reduced motion uses a static visible pending cue and removes movement/shimmer where appropriate. Toasts and fixed trial UI must not obscure focused controls; see [W3C focus not obscured](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html).

## Visual acceptance

The [canonical composition board](assets/canonical-pattern-board.png) adds the main/Settings header, semantic section and dirty-action recipe. It is an original proposed diagram. A plum contextual-bar variant can pair brandInk[850] with white text and an inverse white Save/plum label; existing pair calculations cover these opaque combinations. Placement belongs to the owning workspace. Keep editor commands, bulk selection and trial promotion as separate patterns, and ensure a saved bar has no invisible interactive controls.

Review the same identity, product list/form, settings/domains, theme library/editor and overlay examples at 390, 768, 1440 and 1920 px, then text scaling/keyboard states. Capture normal, hover, focus, pressed, selected, disabled, loading, validation and unavailable states where applicable. Compare composed screenshots and semantics, not just exported tokens. The palette passes only after these consumers retain legibility and working interactions.
