import ts from 'typescript';
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
const hash = value => createHash('sha256').update(value).digest('hex');
const root = 'docs/implementation/niche-themes-2026-10-23/dewdrop/completion-2026-10-24';
const pairs = [
 ['adapter', 'docs/implementation/niche-theme-programme/release-playfield201/catalog394-qualification/publication-preview-read-repair03/theme-execution.adapter.ts.before', 'services/api-gateway/src/execution/theme-execution.adapter.ts'],
 ['transaction', 'docs/implementation/niche-theme-programme/release-playfield201/catalog394-qualification/publication-preview-read-repair03/tenant-transaction.ts.before', 'services/api-gateway/src/lib/tenant-transaction.ts'],
];
function inspect(path, kind) {
 const source = readFileSync(path, 'utf8'); const sf = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
 const entries = {};
 if (kind === 'adapter') {
  const cls = sf.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === 'ThemeExecutionAdapter');
  if (!cls) throw Error('Expected canonical adapter class');
  for (const node of cls.members) if (ts.isMethodDeclaration(node) || ts.isConstructorDeclaration(node)) {
   const key = ts.isConstructorDeclaration(node) ? '<constructor>' : node.name.getText(sf);
   if (entries[key]) throw Error('Duplicate method key');
   entries[key] = { sha256: hash(node.getText(sf)), line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1 };
  }
 } else {
  for (const node of sf.statements) if (ts.isFunctionDeclaration(node) && node.name) {
   entries[node.name.text] = { sha256: hash(node.getText(sf)), line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1, exported: node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword) || false };
  }
 }
 return { path, sha256: hash(source), syntaxDiagnostics: sf.parseDiagnostics.map(d => ts.flattenDiagnosticMessageText(d.messageText, '\n')), entries };
}
const results = pairs.map(([kind, beforePath, currentPath]) => {
 const before = inspect(beforePath, kind), current = inspect(currentPath, kind);
 const names = [...new Set([...Object.keys(before.entries), ...Object.keys(current.entries)])].sort();
 return { kind, before, current, changedOrAdded: names.filter(name => before.entries[name]?.sha256 !== current.entries[name]?.sha256).map(name => ({ name, before: before.entries[name] || null, current: current.entries[name] || null })), unchanged: names.filter(name => before.entries[name]?.sha256 === current.entries[name]?.sha256) };
});
const ordinary = ['installTheme', 'loadEditor', 'saveDraft', 'reorderDraft', 'deleteDraft', 'publish', 'rollbackRelease', 'createPreviewSession'];
const adapter = results.find(r => r.kind === 'adapter');
const report = { schemaVersion: 1, recordedAtUtc: new Date().toISOString(), classification: 'STATIC_ROOT_REPAIR03_DELTA_COUPLING_REVIEW_NOT_RUNTIME_ACCEPTANCE', comparisonBoundary: 'Exact Root repair03 before snapshots versus current bytes; not a claim of full historical936/source393 equivalence.', results, ordinaryMethods: ordinary.map(name => ({ name, existsInBoth: Boolean(adapter.before.entries[name] && adapter.current.entries[name]), unchangedFromRepair03Before: Boolean(adapter.before.entries[name]) && adapter.before.entries[name].sha256 === adapter.current.entries[name]?.sha256 })), limits: ['Current shared source may change while Root owns repair03; revalidate hashes at admission.', 'Unchanged method text alone does not prove transitive runtime/data/security equivalence.', 'Does not waive compiled-source/security/smoke/TLS/actor/fault/network gates.', 'No Main source/native/build/browser/DB/provider action.'], all30Complete: false, newBrowserPasses: 0 };
const output = resolve(root, 'SOURCE_COUPLING_REPAIR03_20261024.json');
writeFileSync(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
process.stdout.write(JSON.stringify({ output, deltas: results.map(r => ({ kind: r.kind, changedOrAdded: r.changedOrAdded.map(x => x.name), unchangedCount: r.unchanged.length })), ordinaryMethods: report.ordinaryMethods }) + '\n');
