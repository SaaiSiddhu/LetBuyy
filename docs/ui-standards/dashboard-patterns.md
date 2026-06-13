# Dashboard Patterns

For merchant-control-plane list/detail screens.

- **Page shell** — `Page` > `PageHeader` (title, description, breadcrumbs, primaryAction, secondaryActions) > `Card`/`Section`.
- **Lists** — `Table` with typed `columns` (`{ key, header, render }`); render INR via `formatInrCurrency`, dates via `toLocaleDateString('en-IN')`, status via `Badge` with the right variant.
- **Row actions** — an `actions` column with `ghost`/`destructive` buttons; per-row busy state (`loading`/`disabled` keyed by row id).
- **Detail drawers** — `Drawer` for inspecting a row (e.g. gift-card transactions) without leaving the list.
- **Counts** — show totals (`Badge` "N total") and refresh affordance.
- **Loading** — `Skeleton variant="table"` while fetching; never a blank flash.
- **Filters/search** — debounce; reflect in URL where useful; empty filtered result → `EmptyState`.
- **Pagination** — cursor-based from the gateway; preserve scroll.
