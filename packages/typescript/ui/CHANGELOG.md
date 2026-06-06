# @letbuyy/ui Changelog

## 0.0.2

- Added RTL, axe, visual-regression, public API, token-variable, and token-alias safety nets.
- Added additive primitives: `Table`, `Drawer`, `Popover`, `Dropdown`, `Switch`, `Grid`, `Columns`, `Container`, `NumberField`, `InlineError`, `DatePicker`, `Accordion`, `Disclosure`, `SegmentedControl`, `Navigation`, `Sidebar`, and `AppFrame`.
- Fixed overlay focus trapping, input and textarea ARIA wiring, auto theme media output, z-index tokens, status/text contrast, and reduced-motion handling.
- Added additive theming seams for `brand`, `data-letbuyy-surface`, tailwind-merged `cx`, and deduped token style injection.
- Deprecated compatibility exports without removal: `DataTable`, `IndexTable`, `TextStyle`, `PageShell`, `PageActions`, `TableFilterBar`, `Badge variant="danger"`, and main-entry preview helpers.
- Added UI-scoped eslint rules and codemods for governed app migration handoff.

Human-gated follow-ups remain: `main`/`types` repoint to `dist`, 1.0 cut, cross-app codemod execution, app eslint enablement, brand palette decisions, and alias removal.
