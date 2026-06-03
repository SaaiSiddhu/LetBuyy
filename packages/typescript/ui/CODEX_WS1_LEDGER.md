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

## Stable Public API

Components:
- `Avatar`
- `Badge`
- `Banner`
- `Button`
- `Card`
- `ColorPreviewBlock`
- `ColorPreviewButton`
- `ColorPreviewSurface`
- `ColorSwatch`
- `Combobox`
- `CommandPalette`
- `ConfirmDialog`
- `DataTable`
- `DesignSystemRoot`
- `EmptyState`
- `IndexTable`
- `Input`
- `MetricCard`
- `Modal`
- `Page`
- `PageHeader`
- `Pagination`
- `RadiusPreview`
- `SaveBar`
- `Section`
- `Select`
- `Skeleton`
- `Tabs`
- `Textarea`
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
- `ButtonProps`
- `CardProps`
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
- `EmptyStateProps`
- `IndexTableBulkAction`
- `IndexTableColumn`
- `IndexTableProps`
- `InputProps`
- `LetbuyyTheme`
- `MetricCardProps`
- `ModalProps`
- `PageHeaderAction`
- `PageHeaderProps`
- `PageProps`
- `PaginationProps`
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
- `ToastMessage`
- `ToastProviderProps`
- `ToastVariant`
- `TooltipProps`

Icon exports:
- Lucide React icon exports and `MaterialIcon`.
