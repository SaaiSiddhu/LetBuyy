# @letbuyy/ui Deprecations

V1 deprecated the compatibility surface below so apps could migrate safely. V2-A5 consumed those migrations and removed the deprecated root exports for the 1.0 line.

| Removed symbol | Deprecated since | Removed in | Replacement | Codemod |
|---|---|---|---|---|
| `DataTable` | `0.0.2` | `1.0.0` | `Table` | `packages/typescript/ui/codemods/data-table-to-table.cjs` |
| `IndexTable` | `0.0.2` | `1.0.0` | `Table` | `packages/typescript/ui/codemods/index-table-to-table.cjs` |
| `TextStyle` | `0.0.2` | `1.0.0` | `Text` | `packages/typescript/ui/codemods/text-style-to-text.cjs` |
| `PageShell` | `0.0.2` | `1.0.0` | `Page` | `packages/typescript/ui/codemods/page-aliases-to-canonical.cjs` |
| `PageActions` | `0.0.2` | `1.0.0` | `PageHeaderActions` | `packages/typescript/ui/codemods/page-aliases-to-canonical.cjs` |
| `TableFilterBar` | `0.0.2` | `1.0.0` | `FilterBar` | `packages/typescript/ui/codemods/page-aliases-to-canonical.cjs` |
| `Badge variant="danger"` | `0.0.2` | `1.0.0` | `Badge variant="critical"` | `packages/typescript/ui/codemods/badge-danger-to-critical.cjs` |
| Root preview helpers (`ColorSwatch`, `ColorPreviewBlock`, `ColorPreviewSurface`, `ColorPreviewButton`, `RadiusPreview`) | `0.0.2` | `1.0.0` root export removed | `@letbuyy/ui/preview` | Import-source migration |

`LooseMaterialIconName` remains available for now because arbitrary icon names need a separate audit before removal.
