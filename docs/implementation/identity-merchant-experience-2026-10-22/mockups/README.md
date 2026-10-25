# Responsive mockup plan and visual catalogue

22 October 2026 · LetBuyy merchant, Settings and identity · Historical visual references.

**Current owner direction:** preserve the existing rendered interface, branding and architecture. These boards inform behavioral discussion; their exact palette, layout, controls and incidental copy are not implementation requirements. [Implemented results](../09_IMPLEMENTATION_RESULTS.md) are separate from the generated references.

This set contains **20 image briefs**, each requiring **desktop 1440, tablet 768 and mobile 390 CSS-pixel design views**. The generated raster is a presentation board, so those labels do not mean that each embedded screen is rendered at its native pixel width. All **32 canonical pattern families** from the Shopify comparison have a mapped board. This is a Storybook-style visual specification; it is not a claim that working Storybook stories or application changes exist.

Use the [image gallery](index.html) to browse the boards, [manifest](mockup-manifest.json) for generation/review status and pattern coverage, and [prompt files](prompts/) for the design briefs. Each final image will be saved in this project's `images/` directory. Image-generation provenance and exceptions are recorded rather than treating every generated label as an approved feature.

## Visual direction

Deep-plum chrome `#1E1A2D`, primary action `#2C2642`, white work surfaces, graphite text, restrained lavender selection and readable purple links. Success, warning, error and information retain separate semantic colors. Local Geist assets, Lucide icons, existing task-specific density and canonical tokens remain the implementation authority. Identity stays light-only; merchant appearance does not recolor storefront themes.

The exact values, sizes, contrast calculations and usage rules are in [the purple system](../03_PREMIUM_PURPLE_SYSTEM.md). A generated bitmap cannot certify CSS colors, type metrics, focus behavior, responsive breakpoints or accessibility. **Written contracts and existing component/domain ownership take precedence over incidental image differences.**

## Complete image inventory

Each row below is one image containing all three required device views, plus relevant state insets.

| # | Board | Required variants and behavior |
| --- | --- | --- |
| 01 | Foundations and density | Palette roles, type, spacing, button/field states, focus, semantic badges, compact/comfortable/touch density |
| 02 | Merchant shell and sidebar | Expanded rail, optional collapsed rail/flyout, mobile drawer, hierarchy, icon names, store scope, search, trial notice |
| 03 | Navigation readiness | Immediate acknowledgement, pending item, indeterminate strip, shaped fallback, ready/error/retry, reduced motion |
| 04 | Settings shell | Local navigation/search, selected task, back to store, narrow navigation, grouped headings and scroll ownership |
| 05 | Headers and CTAs | Index/record/settings recipes, title/status/context, primary/secondary/overflow actions, long text and busy action |
| 06 | Tables and tools | Search, views, filters, chips, sort, columns, row/checkbox/menu behavior, mobile summaries and filter drawer |
| 07 | Bulk and pagination | Exact selected population, action tray, page size/previous/next/count, partial failure and original-command recovery |
| 08 | Form system | Main/aside layout, sections, label/input/hint/error, validation summary, units, tags, conditional groups and disclosure |
| 09 | Drafts and SaveBar | Clean/dirty/saving/saved/failure/unknown/conflict, leave guard, recovered draft, keyboard/safe-area behavior |
| 10 | Overlays and pickers | Focused modal, task sheet, anchored menu, tooltip, resource picker, validation, nested focus and restore |
| 11 | Status and feedback | Pills, tabs, chips, toast, actionable snackbar, persistent banner, error, promotion and layer placement |
| 12 | Empty/error/access | First-use, no matches, failed read, denied access and expired session, each with an appropriate next step |
| 13 | Widgets and reporting | Metric evidence/period/scope/freshness/drill-through, unknown values, chart, setup facts and trial promotion |
| 14 | Search and assistance | Scoped command palette, matching/navigation, searching/no-result/error, manual proposal review and apply-to-draft |
| 15 | Identity and onboarding | Light-only sign-in, existing MFA continuation, safe return context, store selection and resumed setup |
| 16 | Product workflow | Create/edit composition, bounded rich description, media, pricing, inventory, draft status, SaveBar and recovery |
| 17 | Settings domains | Overview, addressable owned detail, DNS copy, independent DNS/SSL/primary/visibility, connection dialog and retry |
| 18 | Theme library | Current theme/library cards, draft/released/private meanings, customize/preview, menus, confirmation and history |
| 19 | Theme editor | Persistent commands, wide outline/preview/properties, narrow handoff, schema controls, undo/redo and versioned preview |
| 20 | Capabilities/integrations | Available/unconfigured/restricted/unavailable, role-dependent actions, meaningful fallback, frozen capabilities deferred |

The first 13 boards specify shared patterns; the last seven apply and stress those patterns in real task families. They are not seven new application subsystems.

## Interaction rules the images must support

Navigation acknowledges activation immediately and keeps the shell stable. Loading belongs to the requested route and uses meaningful content geometry. Completion of route navigation, a data request and a theme iframe preview are separate facts. No artificial blank interval, percentage or blanket private-route prefetch is proposed. Profile the actual delay before claiming it is fixed.

Main merchant forms and Settings use **one existing SaveBar owner and a consistent dirty-state recipe**. The proposed default is a deep-plum bar within the owning workspace, Discard plus an inverse Save, with safe mobile placement. A clean form has no hidden focusable controls. Saving, failed, unknown and conflict states have distinct recovery. Product save command/idempotency/version authority remains in the existing domain flow. Theme editor commands, bulk selection and promotions remain task-specific.

The leave prompt is a focused decision: **Stay**, **Discard and leave**, or **Save and leave**. Saving must finish or resolve its original outcome before departure. Browser reload uses the browser's supported leave protection and appropriate scoped draft recovery; it cannot be made visually identical to the custom in-app dialog. Never promise that local draft recovery persists credentials, media bytes or every sensitive setting. Account/store/version and allowed field scope must be resolved in implementation.

Use a modal for a short bounded task; a drawer/sheet for a constrained picker or narrow navigation; an addressable page for a durable record/configuration task; a persistent workbench for theme editing. Menus choose actions, notifications report outcomes, and banners retain unresolved information. A toast is not the sole validation or uncertain-save recovery mechanism.

Tables preserve matching scope, selection and useful operations on small screens. A bulk bar names its actual selected IDs/population and keeps unresolved outcomes reviewable. Selection does not imply all matching records. Pagination counts and server predicates must agree.

## Architecture and implementation sequence

Extend existing `@letbuyy/ui` owners: `AppNavigation`/`AppFrame`, `PageHeader`, `Page`/`Section`/layout primitives, `Button`/fields, `Table`, overlays and `SaveBar`. Existing merchant/Settings adapters own routing and scope; canonical domain/API contracts own validation, permissions, durable commands and publication. Tokens remain authored in `packages/typescript/ui/src/tokens.ts`. No parallel component library, form engine, auth system, draft backend or runtime is introduced.

After the mockup stage, implement the authorized first slice in this order:

1. Navigation pending controller and route-shaped states; profile cold/warm waits without weakening session/tenant checks or broad prefetching.
2. Product/Settings dirty protection, clean SaveBar focus correction, retained input and existing unknown-command recovery.
3. Canonical header/action loading metadata, reusable form section recipes, semantic headings and one main landmark.
4. Premium purple semantic/surface mapping through existing token export and representative consumers.
5. End-to-end Products → edit → blocked departure → save/discard → return, General settings equivalents, slow/failed navigation, reload/Back/store switch, keyboard, mobile and reduced motion. Run relevant component/contracts/build/DS checks; record actual passes and unresolved branches.

The [12-work-package plan](../04_IMPLEMENTATION_PLAN.md) remains the implementation programme. Images do not close any UX finding or authorize enabling a frozen app marketplace, agent platform, third-party theme blocks, new identity capability, payment operation or deployment.

## Generation and review

Generation uses the built-in imagegen tool, one call per board, with the [prompt set](prompts/) and restrained design references. All final selected assets belong in this workspace. Review every image for three visible device specimens, legible key controls, required state coverage, palette intent, semantic status distinction and consistency with component ownership. Record any remaining schematic deviations in [visual review](VISUAL_REVIEW.md).

Exact icon paths, CSS color samples, incidental navigation labels, illustrative values and copy are verified from source/spec during implementation rather than copied blindly from generated pixels. The mockups are not end-to-end test evidence.
