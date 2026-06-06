# @letbuyy/ui Deprecations

This register tracks additive deprecations only. No public export is removed in the UI foundation stream.

| Symbol | Since | Replacement | Codemod | Removal |
|---|---|---|---|---|
| `DataTable` | `0.0.2` | `Table` | `packages/typescript/ui/codemods/data-table-to-table.cjs` (U8) | SKIP - breaking, needs cross-app migration |
| `IndexTable` | `0.0.2` | `Table` | `packages/typescript/ui/codemods/index-table-to-table.cjs` (U8) | SKIP - breaking, needs cross-app migration |
| `TextStyle` | `0.0.2` | `Text` | `packages/typescript/ui/codemods/text-style-to-text.cjs` (U8) | SKIP - breaking, needs cross-app migration |
| `PageShell` | `0.0.2` | `Page` | `packages/typescript/ui/codemods/page-aliases-to-canonical.cjs` (U8) | SKIP - breaking, needs cross-app migration |
| `PageActions` | `0.0.2` | `PageHeaderActions` | `packages/typescript/ui/codemods/page-aliases-to-canonical.cjs` (U8) | SKIP - breaking, needs cross-app migration |
| `TableFilterBar` | `0.0.2` | `FilterBar` | `packages/typescript/ui/codemods/page-aliases-to-canonical.cjs` (U8) | SKIP - breaking, needs cross-app migration |
| `Badge variant="danger"` | `0.0.2` | `Badge variant="critical"` | `packages/typescript/ui/codemods/badge-danger-to-critical.cjs` (U8) | SKIP - breaking, needs cross-app migration |
| `LooseMaterialIconName` / arbitrary icon-name strings | `0.0.2` | `StrictMaterialIconName`, `materialIconName()`, `isMaterialIconName()` | Not planned; human review needed for unknown icon names | SKIP - breaking, needs icon-name audit |
