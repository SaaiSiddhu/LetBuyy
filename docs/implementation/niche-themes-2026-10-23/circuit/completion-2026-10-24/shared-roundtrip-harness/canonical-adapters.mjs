/** One source-backed adapter extractor. It executes only the selected pure declarations. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import ts from 'typescript';
import { sha256 } from './theme-data-contract.mjs';

export async function loadCanonicalAdapters(config, { root, emit = () => {} }) {
  for (const key of ['domainModule', 'editorPage', 'registryAdapter', 'tokenPackage']) assert.equal(typeof config[key], 'string', `explicit ${key} path required`);
  const domain = await import(pathToFileURL(resolve(root, config.domainModule)).href);
  const editorText = readFileSync(resolve(root, config.editorPage), 'utf8');
  const registryText = readFileSync(resolve(root, config.registryAdapter), 'utf8');
  const page = ts.createSourceFile(config.editorPage, editorText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const declarations = new Map();
  for (const node of page.statements) {
    if (ts.isFunctionDeclaration(node) && node.name) declarations.set(node.name.text, node.getText(page));
    if (ts.isVariableStatement(node)) for (const decl of node.declarationList.declarations) if (ts.isIdentifier(decl.name)) declarations.set(decl.name.text, node.getText(page));
  }
  const names = new Set(['normalizeSettingsSchema', 'normalizeEditorState', 'buildDraftConfig', 'createSectionFromSchema', 'createBlockFromSchema']);
  for (const name of names) {
    assert.ok(declarations.has(name), `actual canonical editor declaration missing: ${name}`);
    const walk = node => { if (ts.isIdentifier(node) && declarations.has(node.text)) names.add(node.text); ts.forEachChild(node, walk); };
    walk(ts.createSourceFile('actual-helper.ts', declarations.get(name), ts.ScriptTarget.Latest, true));
  }
  const code = ts.transpileModule([...names].map(name => declarations.get(name)).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  const external = ['getDefaultStorefrontThemeTemplate', 'hasRenderableThemeTemplate', 'letbuyyPrimitiveTokens', 'isUnchangedCoreDemoCategoryBlocks', 'isFirstPartyCoreBundleSlug', 'MAX_BUNDLE_BLOCK_NESTING_DEPTH', 'ThemeEditorTemplateKeySchema', 'normalizeEditorSchemaField', 'resolveFieldDefault'];
  const tokens = createRequire(resolve(root, config.tokenPackage))('@letbuyy/ui/tokens').letbuyyPrimitiveTokens;
  const editor = new Function(...external, `${code};return {normalizeSettingsSchema,normalizeEditorState,buildDraftConfig,createSectionFromSchema,createBlockFromSchema};`)(...external.map(name => name === 'letbuyyPrimitiveTokens' ? tokens : domain[name]));
  const registry = ts.createSourceFile(config.registryAdapter, registryText, ts.ScriptTarget.Latest, true);
  const registryFunctions = registry.statements.filter(node => ts.isFunctionDeclaration(node) && ['asRecord', 'isLiquidBundle', 'buildBundleTemplateConfig'].includes(node.name?.text));
  assert.equal(registryFunctions.length, 3, 'actual registry pure helper closure must be present');
  const registryCode = ts.transpileModule(registryFunctions.map(node => node.getText(registry)).join('\n'), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  const build = new Function(`${registryCode};return buildBundleTemplateConfig;`)();
  emit('adapters-source.json', { classification: 'ACTUAL_PURE_SOURCE_ADAPTERS_NOT_MOUNTED_EDITOR', editor: { path: config.editorPage, sha256: sha256(editorText) }, registry: { path: config.registryAdapter, sha256: sha256(registryText) }, editorDeclarations: [...names].sort(), extractedEditorCodeSha256: sha256(code), extractedRegistryCodeSha256: sha256(registryCode), domainModule: config.domainModule, dependencyBoundary: config.tokenPackage });
  emit('editor.snapshot.tsx', editorText);
  emit('registry.snapshot.ts', registryText);
  emit('extracted-editor.js', code);
  return {
    ...editor,
    parseBundle: domain.parseLiquidThemePackageBundle,
    describeBundle: bundle => { const schema = domain.buildLiquidThemePackagePersistencePayload(bundle).schemaManifest; return { sectionSchemas: schema.section_schemas, settingsSchema: schema.settings_schema }; },
    buildEditorConfig: build,
    collectValidationIssues: domain.collectThemeTemplateValidationIssues,
    compile: domain.compilePortableToLiquidBundle,
    toDocument: domain.toThemeDocumentV2,
    fromDocument: domain.fromThemeDocumentV2,
    isAppBlockType: domain.isLiquidAppBlockType,
  };
}
