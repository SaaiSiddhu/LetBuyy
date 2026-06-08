import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const repoRoot = process.cwd();

const tsTargets = [
  'apps/marketing-site/src/components/Header.tsx',
  'apps/theme-marketplace/src/lib/public-urls.ts',
  'apps/storefront-runtime/src/lib/api/browser-client.ts',
  'apps/storefront-runtime/src/lib/api/base-url.ts',
  'apps/storefront-runtime/src/lib/seo.ts',
  'packages/shared-types/src/brand.ts',
  'services/api-gateway/src/routes/auth.ts',
  'services/api-gateway/src/routes/onboarding.ts',
  'services/api-gateway/src/routes/payments.ts',
  'services/api-gateway/src/routes/storefront/customer-engagement-routes.ts',
  'services/api-gateway/src/middleware/permission.ts',
  'services/api-gateway/src/middleware/store-context.ts',
];

const textTargets = [
  'apps/mobile/merchant-app/lib/config/app_config.dart',
  'apps/mobile/merchant-app/dart-defines/production.json',
  'packages/dart/core/lib/src/constants/api_constants.dart',
];

const allowedStringLiterals = [
  /^letbuyy\.store$/,
  /noreply@letbuyy\.store/,
  /support@letbuyy\.store/,
];

function isAllowedLiteral(value) {
  return allowedStringLiterals.some((pattern) => pattern.test(value));
}

function validateTsFile(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!existsSync(absolutePath)) return [];

  const text = readFileSync(absolutePath, 'utf8');
  const sourceFile = ts.createSourceFile(absolutePath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const violations = [];

  function visit(node) {
    if (ts.isStringLiteralLike(node) && node.text.includes('letbuyy.store') && !isAllowedLiteral(node.text)) {
      const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
      violations.push(`${relativePath}:${line}: ${node.text}`);
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return violations;
}

function validateTextFile(relativePath) {
  const absolutePath = path.join(repoRoot, relativePath);
  if (!existsSync(absolutePath)) return [];

  const text = readFileSync(absolutePath, 'utf8');
  return text.includes('letbuyy.store') ? [`${relativePath}: contains letbuyy.store`] : [];
}

const violations = [
  ...tsTargets.flatMap(validateTsFile),
  ...textTargets.flatMap(validateTextFile),
];

if (violations.length > 0) {
  console.error('Functional platform domain literals must be env-driven before .com cutover:');
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log('Platform domain literal validator passed.');
