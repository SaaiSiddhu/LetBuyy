import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const repoRoot = process.cwd();
const scanRoots = [
  'services/api-gateway/src',
  ...readdirSync(path.join(repoRoot, 'packages'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => `packages/${entry.name}/src`),
].filter((relative) => existsSync(path.join(repoRoot, relative)));

const extensions = ['.ts', '.tsx', '.mts', '.cts', '.js', '.jsx'];
const ignoredSegments = new Set(['dist', 'build', 'node_modules', '.next', 'coverage']);
const CURRENT_FILE_LEVEL_CYCLE_BUDGET = 3;
const cycleBudget = Number(process.env.LETBUYY_CYCLE_BUDGET || CURRENT_FILE_LEVEL_CYCLE_BUDGET);

function listSourceFiles(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (ignoredSegments.has(entry.name)) continue;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listSourceFiles(fullPath));
    } else if (entry.isFile() && extensions.includes(path.extname(entry.name))) {
      files.push(fullPath);
    }
  }
  return files;
}

function normalize(filePath) {
  return path.relative(repoRoot, filePath).split(path.sep).join('/');
}

const files = new Set(scanRoots.flatMap((root) => listSourceFiles(path.join(repoRoot, root))).map(normalize));
const graph = new Map([...files].map((file) => [file, new Set()]));

function resolveRelativeImport(fromFile, specifier) {
  if (!specifier.startsWith('.')) return null;

  const base = path.join(repoRoot, path.posix.dirname(fromFile), specifier);
  const candidates = [
    base,
    ...extensions.map((ext) => `${base}${ext}`),
    ...extensions.map((ext) => path.join(base, `index${ext}`)),
  ].map(normalize);

  return candidates.find((candidate) => files.has(candidate)) || null;
}

function moduleSpecifierText(node) {
  return node && ts.isStringLiteralLike(node) ? node.text : null;
}

for (const file of files) {
  const absolutePath = path.join(repoRoot, file);
  const text = readFileSync(absolutePath, 'utf8');
  const sourceFile = ts.createSourceFile(absolutePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  function visit(node) {
    let specifier = null;
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      specifier = moduleSpecifierText(node.moduleSpecifier);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1
    ) {
      specifier = moduleSpecifierText(node.arguments[0]);
    }

    if (specifier) {
      const target = resolveRelativeImport(file, specifier);
      if (target && target !== file) graph.get(file)?.add(target);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

let index = 0;
const stack = [];
const onStack = new Set();
const indexes = new Map();
const lowlinks = new Map();
const components = [];

function strongConnect(file) {
  indexes.set(file, index);
  lowlinks.set(file, index);
  index += 1;
  stack.push(file);
  onStack.add(file);

  for (const next of graph.get(file) || []) {
    if (!indexes.has(next)) {
      strongConnect(next);
      lowlinks.set(file, Math.min(lowlinks.get(file), lowlinks.get(next)));
    } else if (onStack.has(next)) {
      lowlinks.set(file, Math.min(lowlinks.get(file), indexes.get(next)));
    }
  }

  if (lowlinks.get(file) === indexes.get(file)) {
    const component = [];
    let current;
    do {
      current = stack.pop();
      onStack.delete(current);
      component.push(current);
    } while (current !== file);

    if (component.length > 1) {
      components.push(component.sort());
    }
  }
}

for (const file of [...files].sort()) {
  if (!indexes.has(file)) strongConnect(file);
}

components.sort((a, b) => a[0].localeCompare(b[0]));

if (components.length > cycleBudget) {
  console.error(`Cycle budget exceeded: ${components.length} components found, budget is ${cycleBudget}.`);
  for (const component of components.slice(0, 20)) {
    console.error(` - ${component.join(' -> ')}`);
  }
  process.exit(1);
}

console.log(`Cycle budget validator passed: ${components.length}/${cycleBudget} file-level cycle components.`);
