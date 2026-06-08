# Components

All shared components live in `@letbuyy/ui` (`packages/typescript/ui/src`). Import from the package root; do not re-implement primitives in apps.

## Catalog
- **Actions / inputs:** `Button`, `Input`, `Textarea`, `NumberField`, `Select`, `Combobox`, `Checkbox`, `Radio`, `Switch`, `ChoiceList`, `Tabs`, `SegmentedControl`, `DatePicker`, `DateRangePicker`, `FilterChips`.
- **Layout:** `Page`, `PageHeader`, `Section`, `Card`, `Box`, `BlockStack`, `InlineStack`, `Grid`, `Columns`, `Container`, `Text`, `Divider`.
- **Data:** `Table`, `DescriptionList`, `Pagination`, `MetricCard`, `Chart`, `ProgressBar`.
- **Feedback:** `Badge`, `Banner`, `EmptyState`, `Skeleton`, `Spinner`, `ToastProvider`/`useToast`, `SaveBar`.
- **Overlays:** `Modal`, `Drawer`, `Dropdown`, `DropdownMenu`, `Popover`, `Tooltip`, `ConfirmDialog`.
- **Shell / nav:** `AppFrame`, `Sidebar`, `Navigation`, `AppNavigation`, `Breadcrumbs`, `CommandPalette`, `Avatar` (see [navigation.md](./navigation.md)).
- **Theme:** `LetbuyyThemeProvider`, `ThemeScript`, `useTheme`, `DensityToggle`, `DesignSystemRoot` (internal — used by the provider).
- **Status:** `StatusBadge` (+ `statusToBadgeVariant`) — the canonical status mapper. Do not re-derive tone→color locally.

## Rules
- Prefer `@letbuyy/ui` primitives over raw elements. `no-raw-elements` makes `<button>/<input>/<table>` an ESLint **error** (use `Button`/`Input`/`Table`).
- Status pills, metric cards, workspace shells, and sidebars have canonical components — promote shared patterns here instead of forking into app `_local-ui/` directories.
- Migration help: `packages/typescript/ui/codemods` + `DEPRECATIONS.md`.

## Deprecations
Removed root symbols and their replacements are tracked in `packages/typescript/ui/DEPRECATIONS.md` with codemods.
