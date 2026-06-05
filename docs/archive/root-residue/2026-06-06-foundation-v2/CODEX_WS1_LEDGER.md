# CODEX WS1 Ledger

Worktree: `/Users/saai_sidd/Git/lb-ws1`
Branch: `stream/WS1-designsystem`
Scope: `packages/typescript/ui/**`
Last updated: 2026-06-03

## Batch 1 — Tokens, Accessibility Pass, Storybook Evidence

Status: stable for consumers, additive-only.

Mission document blocker:
- `docs/Codex_waves/CODEX_DESIGN_SYSTEM_MISSION.md` was not present in this checkout.
- `docs/Codex_waves/CODEX_SHOPIFY_UX_MISSION.md` was not present in this checkout.
- Execution used the pasted WS1 mission text plus root/local `AGENTS.md`, `memory/lessons.md`, and `tasks/todo.md`.

Verification evidence:
- `pnpm install` — passed, lockfile resolution skipped, 651 packages linked from existing store.
- `pnpm --filter @letbuyy/ui typecheck` — passed.
- `pnpm --filter @letbuyy/ui build-storybook` — passed; Storybook build completed successfully.
- Storybook dev server — passed at `http://localhost:6006/`.
- Browser screenshot — passed; direct story iframe rendered `TokenSystem` with `#8B5CF6` and `#6366F1`.
- Screenshot: `packages/typescript/ui/storybook-screenshots/ws1-token-system.jpg`.

Implemented in this batch:
- Brand token alignment: primary `#8B5CF6`, secondary `#6366F1`.
- Added semantic action tokens so interactive foreground/background contrast remains AA.
- Added explicit CSS variables for secondary, strong, soft, accent text, and action colors.
- Disambiguated Tailwind arbitrary text utilities with `text-[color:...]` and `text-[length:...]`.
- Added `TokenSystem` Storybook story for token evidence.
- Improved form control ARIA wiring for `Input`, `Textarea`, and `Select`.
- Added roving keyboard behavior and tab/panel ARIA relationships to `Tabs`.
- Added keyboard selection semantics to `Combobox`.
- Added focus management and focus trapping to `Modal`.
- Added `aria-describedby` support to `Tooltip`.
- Improved sort semantics and keyboard access for `DataTable` and `IndexTable`.
- Added focus-visible support to `Pagination`.
- Added keyboard selection semantics to `CommandPalette`.

## Batch 2 — Additive API Hardening and Component Matrix

Status: stable for consumers, additive-only.

Verification evidence:
- `pnpm install` — passed, lockfile resolution skipped, 651 packages linked from existing store.
- `pnpm --filter @letbuyy/ui typecheck` — passed.
- `pnpm --filter @letbuyy/ui build` — passed.
- `pnpm --filter @letbuyy/ui build-storybook` — passed; Storybook build completed successfully.
- Storybook dev server — passed at `http://localhost:6006/`.
- Browser screenshot — passed; direct story iframe rendered `ComponentApiMatrix`.
- Screenshot: `packages/typescript/ui/storybook-screenshots/ws1-component-api-matrix.jpg`.

Implemented in this batch:
- `Button`: added optional `icon`, `trailingIcon`, `pressed`, and `loadingLabel` props.
- `Input`: added optional `prefixContent`, `suffixContent`, `labelAction`, `requiredIndicator`, and `controlSize` props without colliding with native input attributes.
- `Textarea`: added optional `labelAction` and `requiredIndicator` props.
- `Banner`: added optional `onDismiss` and `dismissLabel` props.
- `ToastProvider`: added optional `duration` and `maxToasts` props.
- `ToastMessage`: added optional `duration` and `action` fields.
- `SaveBar`: added optional `message`, `saveDisabled`, and `discardDisabled` props.
- `DataTable`: added optional `caption`, `ariaLabel`, `loadingLabel`, `emptyState`, `rowKey`, `rowActions`, `rowClassName`, `isRowDisabled`, `density`, `stickyHeader`, and column `align`/`className`.
- `DataTable`: added keyboard row activation for clickable rows while preventing nested row actions from triggering the row handler.
- Added `ComponentApiMatrix` Storybook story showing the batch 2 public API additions.

## Batch 3 — Workflow Overlay and Productivity Hardening

Status: stable for consumers, additive-only.

Verification evidence:
- `pnpm install` — passed, lockfile resolution skipped, 651 packages linked from existing store.
- `pnpm --filter @letbuyy/ui typecheck` — passed.
- `pnpm --filter @letbuyy/ui build` — passed.
- `pnpm --filter @letbuyy/ui build-storybook` — passed; Storybook build completed successfully.
- Storybook dev server — passed at `http://localhost:6006/`.
- `pnpm exec playwright screenshot --viewport-size=1280,720 --wait-for-timeout=2500 'http://localhost:6006/iframe.html?id=merchant-experience-design-system--workflow-component-hardening&viewMode=story' packages/typescript/ui/storybook-screenshots/ws1-workflow-component-hardening.jpg` — passed.
- `pnpm exec playwright screenshot --viewport-size=1280,720 --wait-for-timeout=2500 'http://localhost:6006/iframe.html?id=merchant-experience-design-system--command-palette-workflow-states&viewMode=story' packages/typescript/ui/storybook-screenshots/ws1-command-palette-workflow-states.jpg` — passed.
- Screenshots: `packages/typescript/ui/storybook-screenshots/ws1-workflow-component-hardening.jpg`, `packages/typescript/ui/storybook-screenshots/ws1-command-palette-workflow-states.jpg`.

Implemented in this batch:
- `Modal`: added optional `size`, `dismissible`, `closeOnEscape`, `closeOnOverlayClick`, `dismissLabel`, `footerAlign`, `initialFocusRef`, and `restoreFocus` props.
- `Modal`: added controlled overlay dismissal, configurable initial focus, focus restoration, dialog sizing, and footer alignment.
- `ConfirmDialog`: added optional `children`, `confirmLoading`, `confirmDisabled`, `cancelDisabled`, `closeOnOverlayClick`, and `className` props.
- `Tooltip`: added optional `side`, `align`, and `id` props with cross-axis alignment for all placements.
- `MetricCard`: added optional `secondaryValue`, `icon`, `loading`, and `loadingLabel` props.
- `Avatar`: added optional `imageAlt`, `status`, and `statusLabel` props with an accessible `img` role fallback.
- `Pagination`: added optional `previousLabel`, `nextLabel`, `pageLabel`, `showPageNumbers`, `siblingCount`, and `compact` props.
- `CommandPaletteAction`: added optional `group`, `keywords`, and `disabled` fields.
- `CommandPalette`: added optional `title`, `emptyMessage`, `loading`, `loadingLabel`, `query`, `defaultQuery`, `onQueryChange`, and `footer` props.
- `CommandPalette`: added grouped rendering, keyword filtering, disabled action states, and first-enabled keyboard active item behavior.
- Added `WorkflowComponentHardening` and `CommandPaletteWorkflowStates` Storybook stories for the batch 3 public API additions.

## Batch 4 — Control Component Hardening

Status: stable for consumers, additive-only.

Verification evidence:
- `pnpm install` — passed, lockfile resolution skipped, 651 packages linked from existing store.
- `pnpm --filter @letbuyy/ui typecheck` — passed after fixing the `prefixContent` class guard.
- `pnpm --filter @letbuyy/ui build` — passed.
- `pnpm --filter @letbuyy/ui build-storybook` — passed; Storybook build completed successfully.
- Storybook dev server — passed at `http://localhost:6006/`.
- Browser render check — passed; direct story iframe rendered `ControlComponentHardening`.
- `pnpm exec playwright screenshot --viewport-size=1280,720 --wait-for-timeout=2500 'http://localhost:6006/iframe.html?id=merchant-experience-design-system--control-component-hardening&viewMode=story' packages/typescript/ui/storybook-screenshots/ws1-control-component-hardening.jpg` — passed.
- Screenshot: `packages/typescript/ui/storybook-screenshots/ws1-control-component-hardening.jpg`.

Implemented in this batch:
- `TabItem`: added optional `icon`, `disabled`, and `panelClassName` fields.
- `Tabs`: added optional `variant`, `ariaLabel`, and `panelClassName` props.
- `Tabs`: added pill styling and keyboard navigation that skips disabled tabs.
- `SelectOption`: added optional `description`, `keywords`, and `icon` fields for richer combobox rendering and search.
- `Select`: added optional `placeholder`, `requiredIndicator`, `labelAction`, `prefixContent`, `controlSize`, and `hideLabel` props.
- `Select`: added required ARIA wiring and token-driven control sizing.
- `Combobox`: added optional `id`, `name`, `helperText`, `error`, `loading`, `loadingLabel`, `disabled`, `required`, `requiredIndicator`, `labelAction`, `query`, `defaultQuery`, `onQueryChange`, and `inputClassName` props.
- `Combobox`: added keyword/description search, hidden form value support, helper/error text, disabled input state, metadata-rich options, and first-enabled keyboard active item behavior.
- Added `ControlComponentHardening` Storybook story showing the batch 4 public API additions.

## Batch 5 — Layout Component Hardening

Status: stable for consumers, additive-only.

Verification evidence:
- `pnpm install` — passed, lockfile resolution skipped, 651 packages linked from existing store.
- `pnpm --filter @letbuyy/ui typecheck` — passed after fixing the native `CardProps.title` attribute collision.
- `pnpm --filter @letbuyy/ui build` — passed.
- `pnpm --filter @letbuyy/ui build-storybook` — passed; Storybook build completed successfully.
- Storybook dev server — passed at `http://localhost:6006/`.
- Browser render check — passed; direct story iframe rendered `LayoutComponentHardening`.
- `pnpm exec playwright screenshot --viewport-size=1280,720 --wait-for-timeout=2500 'http://localhost:6006/iframe.html?id=merchant-experience-design-system--layout-component-hardening&viewMode=story' packages/typescript/ui/storybook-screenshots/ws1-layout-component-hardening.jpg` — passed.
- Screenshot: `packages/typescript/ui/storybook-screenshots/ws1-layout-component-hardening.jpg`.

Implemented in this batch:
- `Page`: added optional `width` and `gap` props for narrow, default, and full-width operational layouts.
- `PageHeaderAction`: added optional `ariaLabel`, `target`, `rel`, and `destructive` fields.
- `PageHeader`: added optional `subtitle`, `backAction`, `titleMetadata`, `actionGroupLabel`, and `compact` props.
- `PageHeader`: added guarded disabled link behavior, destructive secondary action styling, title metadata, compact heading scale, and accessible action grouping.
- `Card`: added optional `title`, `description`, `action`, `footer`, `padding`, `tone`, `headerDivider`, and `footerDivider` props.
- `Card`: omits the native HTML `title` attribute from inherited props so the public `title` API can accept React content.
- `Section`: added optional `footer`, `padding`, `divider`, `subdued`, and `headingLevel` props.
- Added `LayoutComponentHardening` Storybook story showing the batch 5 public API additions.

## Batch 6 — Feedback Component Hardening

Status: stable for consumers, additive-only.

Verification evidence:
- `pnpm install` — passed, lockfile resolution skipped, 651 packages linked from existing store.
- `pnpm --filter @letbuyy/ui typecheck` — passed.
- `pnpm --filter @letbuyy/ui build` — passed.
- `pnpm --filter @letbuyy/ui build-storybook` — passed; Storybook build completed successfully.
- Storybook dev server — passed at `http://localhost:6006/`.
- Browser render check — passed; direct story iframe rendered `FeedbackComponentHardening` with toast and SaveBar content.
- `pnpm exec playwright screenshot --viewport-size=1280,720 --wait-for-timeout=2500 'http://localhost:6006/iframe.html?id=merchant-experience-design-system--feedback-component-hardening&viewMode=story' packages/typescript/ui/storybook-screenshots/ws1-feedback-component-hardening.jpg` — passed.
- Screenshot: `packages/typescript/ui/storybook-screenshots/ws1-feedback-component-hardening.jpg`.

Implemented in this batch:
- `Badge`: added optional `icon`, `hideIcon`, and `size` props.
- `Banner`: added optional `icon`, `hideIcon`, `secondaryAction`, `compact`, and narrowed `role` props.
- `ToastMessage`: added optional `icon`, `dismissLabel`, and `onDismiss` fields.
- `ToastProvider`: added optional `position`, `dismissLabel`, and `className` props.
- `ToastProvider`: added positioned toast stacks and per-toast dismiss labels/icons.
- `Skeleton`: added `avatar`, `button`, and `media` variants plus optional `lineWidths`, `animated`, and `label` props.
- `EmptyState`: added optional `media`, ReactNode `body`, `footer`, `align`, `compact`, `bordered`, and `tone` props.
- `SaveBar`: added optional `placement`, `tone`, `icon`, `secondaryAction`, `ariaLabel`, and `compact` props.
- Added `FeedbackComponentHardening` Storybook story showing the batch 6 public API additions.

## Batch 7 — Action, Input, and Table Hardening

Status: stable for consumers, additive-only.

Verification evidence:
- `pnpm install` — passed, lockfile resolution skipped, 651 packages linked from existing store.
- `pnpm --filter @letbuyy/ui typecheck` — passed.
- `pnpm --filter @letbuyy/ui build` — passed.
- `pnpm --filter @letbuyy/ui build-storybook` — passed; Storybook build completed successfully.
- Storybook dev server — passed at `http://localhost:6006/`.
- Browser render check — passed; direct story iframe rendered `ActionInputTableHardening`.
- `pnpm exec playwright screenshot --full-page --viewport-size=1280,720 --wait-for-timeout=2500 'http://localhost:6006/iframe.html?id=merchant-experience-design-system--action-input-table-hardening&viewMode=story' packages/typescript/ui/storybook-screenshots/ws1-action-input-table-hardening.jpg` — passed.
- Screenshot: `packages/typescript/ui/storybook-screenshots/ws1-action-input-table-hardening.jpg`.
- `pnpm run validate:governance` — passed; governance validation passed (128 validators).

Implemented in this batch:
- `Button`: added optional `loadingPosition`, `justify`, and `wrap` props.
- `Input`: added optional `trailingAction`, `clearable`, `clearLabel`, `onClear`, `showCharacterCount`, and `characterCountLabel` props.
- `Input`: added clear-button affordance, character count ARIA wiring, and wider trailing-control spacing without changing existing default field behavior.
- `Textarea`: added optional `showCharacterCount`, `characterCountLabel`, and `resize` props.
- `DataTable`: added optional `selectable`, `selectedRowKeys`, `defaultSelectedRowKeys`, `onSelectionChange`, `bulkActions`, `selectionLabel`, `selectAllLabel`, and `selectRowLabel` props.
- `DataTable`: added controlled/uncontrolled selection state, disabled-row selection guards, selected-row styling, select-all semantics, and bulk action surface.
- Added `ActionInputTableHardening` Storybook story showing the batch 7 public API additions.

## Batch 8 — Index Table and Pagination Hardening

Status: stable for consumers, additive-only.

Verification evidence:
- `pnpm install` — passed, lockfile resolution skipped, 651 packages linked from existing store.
- `pnpm --filter @letbuyy/ui typecheck` — passed.
- `pnpm --filter @letbuyy/ui build` — passed.
- `pnpm --filter @letbuyy/ui build-storybook` — passed; Storybook build completed successfully.
- Storybook dev server — passed at `http://localhost:6006/`.
- Browser render check — passed; direct story iframe rendered `IndexTablePaginationHardening`.
- `pnpm exec playwright screenshot --full-page --viewport-size=1280,720 --wait-for-timeout=2500 'http://localhost:6006/iframe.html?id=merchant-experience-design-system--index-table-pagination-hardening&viewMode=story' packages/typescript/ui/storybook-screenshots/ws1-index-table-pagination-hardening.jpg` — passed.
- Screenshot: `packages/typescript/ui/storybook-screenshots/ws1-index-table-pagination-hardening.jpg`.
- `pnpm run validate:governance` — passed; governance validation passed (128 validators).

Implemented in this batch:
- `Pagination`: added optional `ariaLabel`, `firstLabel`, `lastLabel`, `showBoundaryControls`, `disabled`, `summary`, `pageSize`, `pageSizeOptions`, `onPageSizeChange`, and `pageSizeLabel` props.
- `Pagination`: added first/last controls, page-size select control, disabled-state guarding, and summary slot while preserving existing previous/next defaults.
- `IndexTableColumn`: added optional `align`, `className`, and `width` fields.
- `IndexTableBulkAction`: added optional `disabled` and `ariaLabel` fields.
- `IndexTable`: added optional `loadingLabel`, `caption`, `ariaLabel`, `rowActions`, `selectable`, `selectedRowIds`, `defaultSelectedRowIds`, `onSelectionChange`, `isRowDisabled`, `selectedLabel`, `selectAllLabel`, `selectRowLabel`, `density`, and `stickyHeader` props.
- `IndexTable`: added controlled/uncontrolled selection, disabled-row selection guards, selectable opt-out, row actions, selected-row styling, compact density, and table caption/label support.
- Added `IndexTablePaginationHardening` Storybook story showing the batch 8 public API additions.

## Batch 9 — Metric, Avatar, and Command Palette Hardening

Status: stable for consumers, additive-only.

Verification evidence:
- `pnpm install` — passed, lockfile resolution skipped, 651 packages linked from existing store.
- `pnpm --filter @letbuyy/ui typecheck` — passed.
- `pnpm --filter @letbuyy/ui build` — passed.
- `pnpm --filter @letbuyy/ui build-storybook` — passed; Storybook build completed successfully.
- Storybook dev server — passed at `http://localhost:6006/`.
- Browser render check — passed; direct story iframes rendered `ProductivitySurfaceHardening` and `CommandPaletteSurfaceHardening`.
- `pnpm exec playwright screenshot --full-page --viewport-size=1280,720 --wait-for-timeout=2500 'http://localhost:6006/iframe.html?id=merchant-experience-design-system--productivity-surface-hardening&viewMode=story' packages/typescript/ui/storybook-screenshots/ws1-productivity-surface-hardening.jpg` — passed.
- `pnpm exec playwright screenshot --full-page --viewport-size=1280,720 --wait-for-timeout=2500 'http://localhost:6006/iframe.html?id=merchant-experience-design-system--command-palette-surface-hardening&viewMode=story' packages/typescript/ui/storybook-screenshots/ws1-command-palette-surface-hardening.jpg` — passed.
- Screenshots: `packages/typescript/ui/storybook-screenshots/ws1-productivity-surface-hardening.jpg`, `packages/typescript/ui/storybook-screenshots/ws1-command-palette-surface-hardening.jpg`.
- `pnpm run validate:governance` — passed; governance validation passed (128 validators).

Implemented in this batch:
- `MetricCard`: added optional `sparklineTone`, `sparklineLabel`, `action`, `footer`, `tone`, and `size` props.
- `MetricCard`: added tone variants, compact sizing, accessible sparkline labeling, action slots, and footer slots.
- `Avatar`: added optional `shape`, `fallbackTone`, `label`, `description`, `labelPosition`, `badge`, and `containerClassName` props.
- `Avatar`: added labelled identity rows, rounded avatar shape, fallback tone variants, and badge overlays while preserving the existing image/fallback API.
- `CommandPaletteAction`: added optional `badge`, `meta`, and `ariaLabel` fields.
- `CommandPalette`: added optional `description`, `showHeader`, `showCloseButton`, `dismissLabel`, `inputLabel`, `emptyState`, `closeOnSelect`, `size`, `className`, `listClassName`, and `actionClassName` props.
- `CommandPalette`: added visible header/description rendering, close button, size variants, custom empty state slot, action badges/metadata, and selectable close behavior.
- Added `ProductivitySurfaceHardening` and `CommandPaletteSurfaceHardening` Storybook stories showing the batch 9 public API additions.

## Batch 10 — Overlay Surface Hardening

Status: stable for consumers, additive-only.

Verification evidence:
- `pnpm install` — passed; lockfile was up to date and install completed using pnpm v10.6.2.
- `pnpm --filter @letbuyy/ui typecheck` — passed.
- `pnpm --filter @letbuyy/ui build` — passed.
- `pnpm --filter @letbuyy/ui build-storybook` — passed; Storybook build completed successfully.
- Storybook dev server — passed at `http://localhost:6006/`.
- Browser render check — passed; direct story iframes rendered `ModalSurfaceHardening` and `ConfirmTooltipSurfaceHardening`.
- `pnpm exec playwright screenshot --full-page --viewport-size=1280,720 --wait-for-timeout=2500 'http://localhost:6006/iframe.html?id=merchant-experience-design-system--modal-surface-hardening&viewMode=story' packages/typescript/ui/storybook-screenshots/ws1-modal-surface-hardening.jpg` — passed.
- `pnpm exec playwright screenshot --full-page --viewport-size=1280,720 --wait-for-timeout=2500 'http://localhost:6006/iframe.html?id=merchant-experience-design-system--confirm-tooltip-surface-hardening&viewMode=story' packages/typescript/ui/storybook-screenshots/ws1-confirm-tooltip-surface-hardening.jpg` — passed.
- Screenshots: `packages/typescript/ui/storybook-screenshots/ws1-modal-surface-hardening.jpg`, `packages/typescript/ui/storybook-screenshots/ws1-confirm-tooltip-surface-hardening.jpg`.
- `pnpm run validate:governance` — passed; governance validation passed (128 validators).

Implemented in this batch:
- `Modal`: widened `title` and `description` to React nodes and added optional `placement`, `role`, `ariaLabel`, `eyebrow`, `titleMetadata`, `headerAction`, `headerDivider`, `footerDivider`, `preventScroll`, `overlayClassName`, `headerClassName`, `bodyClassName`, and `footerClassName` props.
- `Modal`: added top placement, body scroll locking, alert-dialog role support, richer header composition, configurable dividers, and style slots.
- `ConfirmDialog`: added optional `icon`, `tone`, `confirmLoadingLabel`, `dismissLabel`, and `footerAlign` props.
- `ConfirmDialog`: now renders through `Modal` with `role="alertdialog"` and tone-aware confirm/icon behavior.
- `Tooltip`: added optional `tone`, `maxWidth`, `disabled`, `triggerClassName`, and `className` props.
- `Tooltip`: now preserves existing trigger `aria-describedby` values while merging the tooltip id and supports inverse/width styling.
- Added `ModalSurfaceHardening` and `ConfirmTooltipSurfaceHardening` Storybook stories showing the batch 10 public API additions.

## Batch 11 — Choice Control Hardening

Status: stable for consumers, additive-only.

Verification evidence:
- `pnpm install` — passed; lockfile was up to date and install completed using pnpm v10.6.2.
- `pnpm --filter @letbuyy/ui typecheck` — passed.
- `pnpm --filter @letbuyy/ui build` — passed.
- `pnpm --filter @letbuyy/ui build-storybook` — passed; Storybook build completed successfully.
- Storybook dev server — passed at `http://localhost:6006/`.
- Browser render check — passed; direct story iframe rendered `ChoiceControlSurfaceHardening`.
- `pnpm exec playwright screenshot --full-page --viewport-size=1280,720 --wait-for-timeout=2500 'http://localhost:6006/iframe.html?id=merchant-experience-design-system--choice-control-surface-hardening&viewMode=story' packages/typescript/ui/storybook-screenshots/ws1-choice-control-surface-hardening.jpg` — passed.
- Screenshot: `packages/typescript/ui/storybook-screenshots/ws1-choice-control-surface-hardening.jpg`.
- `pnpm run validate:governance` — passed; governance validation passed (128 validators).

Implemented in this batch:
- `Checkbox`: added an accessible standalone checkbox primitive with label, description, helper text, error text, class slots, and `onCheckedChange`.
- `Radio`: added an accessible standalone radio primitive with label, description, helper text, error text, class slots, and `onCheckedChange`.
- `ChoiceListOption`: added option labels, descriptions, disabled state, icons, and badge slots for grouped choices.
- `ChoiceList`: added accessible single- and multi-choice fieldsets with controlled/uncontrolled values, helper/error descriptions, required indicator, responsive vertical/horizontal layout, option cards, and disabled-state handling.
- Added `ChoiceControlSurfaceHardening` Storybook story showing grouped publishing choices, fulfillment radio choices, standalone settings checkboxes, and visibility radios.

## Batch 12 — Composition Primitive Hardening

Status: stable for consumers, additive-only.

Verification evidence:
- `pnpm install` — passed; lockfile was up to date and install completed using pnpm v10.6.2.
- `pnpm --filter @letbuyy/ui typecheck` — passed.
- `pnpm --filter @letbuyy/ui build` — passed.
- `pnpm --filter @letbuyy/ui build-storybook` — passed; Storybook build completed successfully.
- Storybook dev server — passed at `http://localhost:6006/`.
- Browser render check — passed; direct story iframe rendered `CompositionPrimitiveHardening`.
- `pnpm exec playwright screenshot --full-page --viewport-size=1280,720 --wait-for-timeout=2500 'http://localhost:6006/iframe.html?id=merchant-experience-design-system--composition-primitive-hardening&viewMode=story' packages/typescript/ui/storybook-screenshots/ws1-composition-primitive-hardening.jpg` — passed.
- Screenshot: `packages/typescript/ui/storybook-screenshots/ws1-composition-primitive-hardening.jpg`.
- `pnpm run validate:governance` — passed; governance validation passed (128 validators).

Implemented in this batch:
- `Box`: added token-driven composition surface with semantic element selection, spacing, tone, border, radius, and shadow props.
- `BlockStack`: added vertical composition primitive with tokenized gap, alignment, and justification props.
- `InlineStack`: added horizontal/wrapping composition primitive with tokenized gap, alignment, justification, and wrap props.
- `Text`: added semantic text primitive with variant, tone, weight, alignment, and truncation props.
- `Divider`: added horizontal and vertical separator primitive with subdued tone support.
- Added `CompositionPrimitiveHardening` Storybook story showing operational composition with tokenized surfaces, stacks, text, and dividers.

## Stable Public API

Components:
- `Avatar`
- `Badge`
- `Banner`
- `BlockStack`
- `Box`
- `Button`
- `Card`
- `Checkbox`
- `ChoiceList`
- `ColorPreviewBlock`
- `ColorPreviewButton`
- `ColorPreviewSurface`
- `ColorSwatch`
- `Combobox`
- `CommandPalette`
- `ConfirmDialog`
- `DataTable`
- `DesignSystemRoot`
- `Divider`
- `EmptyState`
- `IndexTable`
- `InlineStack`
- `Input`
- `MetricCard`
- `Modal`
- `Page`
- `PageHeader`
- `Pagination`
- `Radio`
- `RadiusPreview`
- `SaveBar`
- `Section`
- `Select`
- `Skeleton`
- `Tabs`
- `Textarea`
- `Text`
- `ToastProvider`
- `Tooltip`

Hooks:
- `useToast`

Tokens and utilities:
- `letbuyyTokenCss`
- `letbuyyTokenCssVariables`
- `letbuyyTokens`
- `letbuyyFontCssVariables`
- `letbuyyFontStacks`

Types:
- `AvatarProps`
- `BadgeProps`
- `BannerProps`
- `BlockStackProps`
- `BoxProps`
- `ButtonProps`
- `CardProps`
- `CheckboxProps`
- `ChoiceListOption`
- `ChoiceListProps`
- `ColorPreviewBlockProps`
- `ColorPreviewButtonProps`
- `ColorPreviewSurfaceProps`
- `ColorSwatchProps`
- `Column`
- `ComboboxProps`
- `CommandPaletteAction`
- `CommandPaletteProps`
- `ConfirmDialogProps`
- `DataTableProps`
- `DesignSystemRootProps`
- `DividerProps`
- `EmptyStateProps`
- `IndexTableBulkAction`
- `IndexTableColumn`
- `IndexTableProps`
- `InlineStackProps`
- `InputProps`
- `LetbuyyTheme`
- `MetricCardProps`
- `ModalProps`
- `PageHeaderAction`
- `PageHeaderProps`
- `PageProps`
- `PaginationProps`
- `RadioProps`
- `RadiusPreviewProps`
- `SaveBarProps`
- `SectionProps`
- `SelectOption`
- `SelectProps`
- `SkeletonProps`
- `StatusVariant`
- `TabItem`
- `TabsProps`
- `TextareaProps`
- `TextProps`
- `ToastMessage`
- `ToastProviderProps`
- `ToastVariant`
- `TooltipProps`

Icon exports:
- Lucide React icon exports and `MaterialIcon`.
