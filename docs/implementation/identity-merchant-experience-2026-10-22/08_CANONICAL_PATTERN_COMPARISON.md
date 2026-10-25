# Canonical pattern comparison and implementation refinement

22 October 2026 follow-up · Same source HEAD `85aac99043d8dc10469e12cbb810609a3b6f1b0d` · Research/planning only.

The [Shopify canonical-system study](../../research/shopify-product-intelligence/identity-onboarding-2026-10-22/canonical-system/README.md) identifies 32 pattern families. The important transfer is a hierarchy of token roles → primitives → task compositions → domain workflows. A canonical system is not one universal header/bar or a new component library beside LetBuyy's current one.

Fresh evidence changes the plan in four distinct places: explicit header/action recipes, inaccessible saved SaveBar controls, grouped section heading semantics, and nested main landmarks. Existing UX-01–UX-42 remain; UX-43–UX-46 extend the same register. Navigation acknowledgement/latency and work protection remain first priorities.

## What the deeper comparison establishes

Shopify used the same rendered dirty-bar family for a temporary Add product edit and General settings edit. Both bars were 36 px high, dark pills with 28 px Save/Discard controls; mobile product editing replaced this with a top close/check row. Sidebar departure retained the dirty form and focused Save. This is stronger evidence for shared behavior than matching colors on unrelated pages. It is not proof of all Shopify Back/reload/security recovery paths.

Native indexes used compact 13 px context headings, while forms/Settings also used 26/32 px task headings. LetBuyy's24/32 px task title is already appropriate; introduce clear task recipes instead of shrinking every header. Public Polaris 2.0 has structured page/section/action contracts, but public app APIs and private native implementation are not interchangeable proof.

The later Shopify editor preview rendered successfully. Earlier blank/spinning captures remain historical states; they should not support a permanent-renderer-failure claim. LetBuyy's own existing signed preview/save/undo/reload strengths remain protected.

## Pattern to canonical owner mapping

Every path below exists in the pinned checkout. The [machine mapping](canonical-pattern-mapping.json) and [source hashes](evidence/canonical-source-snapshot.json) preserve the implementation boundary. A mapped source is not a claim that every consumer was visually accepted.

| Pattern | Existing LetBuyy owner | Disposition | Gap IDs / acceptance direction |
| --- | --- | --- | --- |
| PAT-01 Stable shell and task workspace | [apps/merchant/web/src/components/AdminShell.tsx](../../../apps/merchant/web/src/components/AdminShell.tsx) | Preserve | UX-16, UX-46: Existing shell retains scope, keyboard drawer and scroll; Page cannot create a nested main. |
| PAT-02 Context header and task header | [packages/typescript/ui/src/layout.tsx](../../../packages/typescript/ui/src/layout.tsx) | Refine | UX-43: Explicit index/record/settings/workbench recipes use existing PageHeader without title-string guesses or unexplained hidden context. |
| PAT-03 Decisive primary action | [packages/typescript/ui/src/button.tsx](../../../packages/typescript/ui/src/button.tsx) | Complete | UX-43, UX-36: PageHeader action metadata forwards loading/label/disabled semantics to the canonical Button. |
| PAT-04 Secondary and overflow actions | [packages/typescript/ui/src/overlays.tsx](../../../packages/typescript/ui/src/overlays.tsx) | Refine | UX-43: Overflow preserves action effect, permission, busy state and a useful return. |
| PAT-05 Named compact icon action | [packages/typescript/ui/src/button.tsx](../../../packages/typescript/ui/src/button.tsx) | Complete | UX-36: Name, tooltip, focus and touch area remain usable in all density variants. |
| PAT-06 Contextual dirty-form save bar | [packages/typescript/ui/src/feedback.tsx](../../../packages/typescript/ui/src/feedback.tsx) | Complete | UX-02, UX-44: Saved bar is absent/inert; dirty input protected across navigation; uncertain command recovers original intent. |
| PAT-07 Bulk-selection action context | [apps/merchant/web/src/app/[store]/products/page.tsx](../../../apps/merchant/web/src/app/[store]/products/page.tsx) | Verify | UX-18: Selection never silently expands; partial/unknown outcomes retain original commands. |
| PAT-08 Sticky bottom actions | [packages/typescript/ui/src/feedback.tsx](../../../packages/typescript/ui/src/feedback.tsx) | Refine | UX-39: A single scoped placement recipe avoids overlap with trial/toast/dialog actions. |
| PAT-09 Persistent editor command toolbar | [apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx](../../../apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx) | Preserve | UX-33: Existing saved-version publication and undo/redo survive layout work. |
| PAT-10 Selected-object contextual toolbar | [apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx](../../../apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx) | Refine | UX-32, UX-41: Actions target the selected schema object once; accepting a suggestion does not publish. |
| PAT-11 Settings local navigation | [apps/merchant/web/src/components/settings/SettingsShell.tsx](../../../apps/merchant/web/src/components/settings/SettingsShell.tsx) | Preserve | UX-14, UX-15: Capability rules agree across cards/nav/commands/routes; valid return retains store context. |
| PAT-12 Semantic section composition | [packages/typescript/ui/src/layout.tsx](../../../packages/typescript/ui/src/layout.tsx) | Complete | UX-45, UX-37: Grouped Section and settings recipes preserve heading navigation and avoid redundant card nesting. |
| PAT-13 Form rhythm and layout recipe | [packages/typescript/ui/src/layout.tsx](../../../packages/typescript/ui/src/layout.tsx) | Consolidate | UX-37: Document reusable BlockStack/Grid/Section recipes and adopt them in product/Settings without a new form engine. |
| PAT-14 Labeled field and inline error | [packages/typescript/ui/src/input.tsx](../../../packages/typescript/ui/src/input.tsx) | Complete | UX-36, UX-07: Shared field semantics survive custom/unstyled adoption and validation; useful input preserved. |
| PAT-15 Progressive disclosure | [packages/typescript/ui/src/controls.tsx](../../../packages/typescript/ui/src/controls.tsx) | Preserve | UX-21, UX-33: Hidden fields do not silently commit stale values; errors reveal the appropriate group. |
| PAT-16 Rich description authoring | [apps/merchant/web/src/app/[store]/products/new/page.tsx](../../../apps/merchant/web/src/app/[store]/products/new/page.tsx) | Complete | UX-19: Bounded format round trips through existing product/API/storefront sanitization; no arbitrary scripts. |
| PAT-17 Focused modal | [packages/typescript/ui/src/overlays.tsx](../../../packages/typescript/ui/src/overlays.tsx) | Preserve | UX-36, UX-39: Existing dialog variants work with nested pickers and exact failure/retry states. |
| PAT-18 Resource and value picker | [packages/typescript/ui/src/controls.tsx](../../../packages/typescript/ui/src/controls.tsx) | Refine | UX-21, UX-32: Use existing Combobox/media selection; enforce store ownership; selection differs from upload completion. |
| PAT-19 Status badge and qualification | [packages/typescript/ui/src/feedback.tsx](../../../packages/typescript/ui/src/feedback.tsx) | Preserve | UX-22, UX-29: Draft/release/store visibility/provider readiness remain separate. |
| PAT-20 Metric widget with supporting evidence | [packages/typescript/ui/src/productivity.tsx](../../../packages/typescript/ui/src/productivity.tsx) | Complete | UX-24: Keep existing MetricCard; define scope/freshness/period and matching drill-through at consumer contract. |
| PAT-21 Reporting scope controls | [packages/typescript/ui/src/controls.tsx](../../../packages/typescript/ui/src/controls.tsx) | Refine | UX-24: URL/state and endpoint predicates agree; undefined comparisons are not invented deltas. |
| PAT-22 Responsive collection table | [packages/typescript/ui/src/table.tsx](../../../packages/typescript/ui/src/table.tsx) | Complete | UX-17, UX-18: Existing server matching/pagination, selection and return context work beyond first100 rows. |
| PAT-23 Meaning-specific empty state | [packages/typescript/ui/src/feedback.tsx](../../../packages/typescript/ui/src/feedback.tsx) | Consolidate | UX-25, UX-38: No backend jargon, fake empty data or dead app CTA; reuse existing art registry. |
| PAT-24 Navigation and layered readiness | [apps/merchant/web/src/components/MerchantNavigationLink.tsx](../../../apps/merchant/web/src/components/MerchantNavigationLink.tsx) | Complete | UX-03, UX-40: Immediate feedback plus profiled latency; preserve private prefetch limits and auth checks. |
| PAT-25 Error with retained context and retry | [apps/merchant/web/src/lib/api/use-read-request.ts](../../../apps/merchant/web/src/lib/api/use-read-request.ts) | Preserve | UX-12, UX-09: Retry retains scope/input and original intent; current helpers abort stale reads. |
| PAT-26 Scoped notification and promotion | [apps/merchant/web/src/components/TrialBanner.tsx](../../../apps/merchant/web/src/components/TrialBanner.tsx) | Refine | UX-39: Trial dates/provider facts truthful; layered panels never obscure critical actions. |
| PAT-27 Theme lifecycle workspace | [apps/merchant/web/src/components/theme-library/ThemeLibraryWorkspace.tsx](../../../apps/merchant/web/src/components/theme-library/ThemeLibraryWorkspace.tsx) | Complete | UX-29, UX-34: One lifecycle resolver and canonical release contract; no marketplace activation. |
| PAT-28 Schema inspector and outline | [apps/merchant/web/src/components/theme-editor/SchemaFormRenderer.tsx](../../../apps/merchant/web/src/components/theme-editor/SchemaFormRenderer.tsx) | Preserve | UX-30, UX-33: Supported schemas remain source of truth; wide layout improves without replacing mobile handoff. |
| PAT-29 Version-correlated preview | [apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx](../../../apps/merchant/web/src/app/[store]/online-store/themes/[themeId]/editor/page.tsx) | Complete | UX-31: Only scoped version/origin acknowledgements mark synchronized; saved draft survives preview error. |
| PAT-30 Contextual assistance proposal | [apps/merchant/web/src/app/[store]/ai/page.tsx](../../../apps/merchant/web/src/app/[store]/ai/page.tsx) | Refine | UX-41: Deterministic suggestions/checklists remain honest; no general agent platform built. |
| PAT-31 Scroll, elevation and overlay ownership | [packages/typescript/ui/src/app-shell.tsx](../../../packages/typescript/ui/src/app-shell.tsx) | Complete | UX-39, UX-46: Canonical scope prevents nested landmarks and overlay/portal conflict. |
| PAT-32 Semantic visual roles and density | [packages/typescript/ui/src/tokens.ts](../../../packages/typescript/ui/src/tokens.ts) | Refine | UX-35, UX-36, UX-37: Premium brandInk roles remain canonical; no app-local palette or universal28px controls. |

## Shared component findings

| Owner | Preserve | Complete/refine |
| --- | --- | --- |
| PageHeader | Existing identity/icon, titleAdornment, visibility flags, primary/secondary actions and renderer escape hatch | Explicit index/record/settings/workbench recipes; deliberate back/context/description visibility; common busy/disabled/action metadata |
| Button | Existing variants, loading, navigation adapter and disabled/link behavior | Forward its contract from header/save/widget compositions; avoid routine unstyled clones and test names/focus/width stability |
| SaveBar | Existing shared owner and saving/dirty behavior; consumer command recovery | Clean controls must leave keyboard/AX tree; extend scoped state/placement recipes without moving domain save authority into UI |
| Section/Card/Stack/Grid | Existing grouped/default Section and layout primitives | Preserve headings in grouped styling; consolidate settings-specific form recipes rather than create a second form engine |
| AppFrame/Page | Existing viewport/scroll ownership and shared shell | One main landmark; non-landmark page container inside shell, suitable standalone option elsewhere |
| Input/Select/Combobox | Existing labels, helper/error IDs and control semantics | Preserve those semantics in custom compositions; standardize prefix/unit, conditional group and validation-focus recipes |
| MetricCard/Table | Existing rendering/formatting and responsive summaries | Application-owned population, period, matching, pagination, drill-through and unknown/zero semantics |
| Dialog/Drawer/Popover | Existing portals, focus/scroll hooks and variants | Nested picker, mobile keyboard, hidden-focus, focus restoration and layer acceptance |
| SettingsPane/Shell | Existing shared PageHeader/SaveBar composition and local nav | Capability consistency, addressable domain tasks, plain availability text and intentional header/context choices |
| Theme editor | Existing schemas, draft client, version/security gates, mobile handoff | Wide layout, catalog discoverability and separate draft/preview/release status |

### Fresh keyboard and landmark evidence

On the existing saved synthetic product, SaveBar's clean wrapper had opacity 0 and pointer-events:none. Its Save/Discard buttons were still enabled/tabIndex 0 without hidden/inert. Pressing Tab from Tags focused invisible Discard. The result is [captured here](evidence/canonical-saved-savebar-focus.json). This is a live accessibility defect, not a speculative critique of a CSS token.

Products DOM also contained shell main#admin-page-scroll and a nested main produced by Page. [Evidence](evidence/canonical-current-products-semantics.json). Retain the shell's scroll port and make inner composition semantically appropriate; do not rebuild navigation to solve a landmark issue.

Grouped Section source renders its visible title as a span, while default Section renders a heading. General settings also contains hand-composed section-label divs. Those are SOURCE findings; the full screen-reader outline across all consumers remains an acceptance task.

## Canonical recipes to complete

1. **Index recipe:** task title/context, current collection/query/view, main CTA or useful first-use CTA, secondary/overflow actions, collection content and scoped loading. Keep result semantics in existing APIs.
2. **Record/create recipe:** parent/back context, readable title/status, main/aside grouping, validation, dirty guard and existing stable save intent. Save is not automatic publication.
3. **Settings recipe:** local navigation, explicit configuration scope, grouped sections/disclosures, provider/capability truth, the same dirty contract and clear return.
4. **Workbench recipe:** persistent scope/commands, independent scroll panes, schema selection, preview readiness and versioned commitment. Do not apply the merchant form bar blindly to theme publication.
5. **Focused-dialog recipe:** bounded named task, useful field validation, Cancel/commit, nested picker and restore-focus. Keep modal addressability when a task needs reload/history.
6. **Collection/bulk recipe:** matching scope, URL state, explicit population, current authority, partial/unknown command recovery. No all-matching expansion without a service contract.

These are compositions of current owners. Add a small shared API/variant only when needed to encode the responsibility once. Domain DTOs/validation and command authority stay in current canonical packages/services.

## Premium purple application

Retain the existing [purple specification](03_PREMIUM_PURPLE_SYSTEM.md): brandInk[850] chrome, brandInk[800] actions, readable 500 links, 400 focus on light, 100 selection wash, white surfaces and graphite text. Semantic success/warning/error/info remain separate.

A proposed dirty-form overlay variant can use deep plum with light text, an inverse white Save action with plum text, and a quieter Discard action. White on brandInk[850] and brandInk[800] on white already have strong documented pair contrast. The existing bottom placement may remain where the task/scroll context needs it. The main/Settings merchant recipe should choose one consistent default with mobile-safe actions. Do not create another SaveBar or globally tint dialogs/fields.

Keep LetBuyy's readable title/body roles and touch/accessibility requirements. Shopify's observed 28 px controls and13px context heading are reference measurements, not a mandate to reduce every LetBuyy control. The [canonical pattern board](assets/canonical-pattern-board.png) illustrates the proposal; it is not implemented application UI.

## First delivery slice and dependency order

Keep the 12 existing work packages. Expand WP-02/WP-03/WP-05 for this evidence:

- First: navigation acknowledgement/latency profiling, product dirty departure protection, saved-bar hidden-focus correction and one-main composition. These address demonstrated repeated waits/work loss/accessibility barriers.
- In the same representative journey: apply explicit header/action/section recipes to Products list → saved product → edit/recovery → return, then General/Domain settings. Preserve existing command keys, validation and scope.
- Next: whole-collection matching, truthful readiness/metrics and identity continuations according to the existing priority/dependency plan.
- Then: wider settings/theme/catalog/assistance adoption, with actual responsive and role-specific acceptance.

For each shared change, verify identity/merchant/console/Storybook and relevant generated consumers. A merchant-scoped appearance refinement must not silently change storefront themes. Do not enable frozen apps or deploy to make examples look complete.

## Acceptance and rollback additions

Use existing tests and meaningful browser scenarios: no invisible focus stops in clean forms; one main/working skip target; meaningful grouped headings; long localized title/status; ordinary header pending state without custom page clones; dirty sidebar/Back/store-switch/reload recovery; delayed/failed navigation; reduced motion; mobile keyboard/safe area; nested dialogs/pickers; saved draft versus preview versus publication.

Actual follow-up checks are described in [the verification report](05_TEST_AND_COVERAGE.md). The original comparison was documentation-only. The subsequent [implementation results](09_IMPLEMENTATION_RESULTS.md) records newly run shared-component/app/browser/build checks and remaining security, role and production acceptance. Earlier results are not relabeled as new runs.

Rollback presentation slices through Git revert or existing scoped controls. Keep existing canonical data/commands and release rollback. Never preserve a second UI/auth/draft system permanently as a rollback strategy.

## Implementation follow-up — 23 October 2026

The premium mapping is authorized and applied through admin surface bindings. Ordinary Settings and main forms now share Card/Section boundaries and headings; PageHeader uses Button and explicit task metadata; SettingsPane forwards full save safety. MetricCard and overview/billing widgets converge on Card. [Adoption/intentional exceptions](10_CANONICAL_ADOPTION.md) distinguish current browser checks from full pattern acceptance. Existing template inspector, draft/release, preview and publication commands retain domain ownership.
