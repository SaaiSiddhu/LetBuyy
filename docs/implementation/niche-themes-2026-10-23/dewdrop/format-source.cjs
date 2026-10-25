const fs = require('node:fs');
const ts = require('typescript');
const files = [
  'packages/theme-engine/src/dewdrop-theme.ts', 'packages/theme-engine/src/dewdrop-styles.ts', 'packages/theme-engine/src/dewdrop-discovery.ts', 'packages/theme-engine/test/dewdrop.test.ts',
  'packages/commerce-core/src/dewdrop-facts.ts', 'packages/commerce-core/test/dewdrop-facts.test.ts',
  'apps/commerce/web/src/lib/demo/dewdrop-demo.ts', 'apps/commerce/web/src/lib/demo/dewdrop-demo.test.ts',
];
const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
for (const file of files) fs.writeFileSync(file, printer.printFile(ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)));
