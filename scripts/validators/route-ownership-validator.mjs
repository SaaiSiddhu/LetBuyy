import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

const repoRoot = process.cwd();
const routesRoot = path.join(repoRoot, 'services/api-gateway/src/routes');

const routeMethods = new Set(['get', 'post', 'put', 'patch', 'delete']);
const tenantTables = [
  'app_installs',
  'app_reviews',
  'cart_items',
  'carts',
  'cod_reconciliation_entries',
  'commission_reconciliation_entries',
  'commission_schedules',
  'contacts',
  'coupons',
  'customer_addresses',
  'customer_credentials',
  'customer_whatsapp_messages',
  'form_submissions',
  'inventory',
  'merchant_kyc_documents',
  'marketing_email_campaigns',
  'marketing_email_recipients',
  'media',
  'merchant_2fa_factors',
  'notifications',
  'order_items',
  'orders',
  'pages',
  'payouts',
  'payout_statements',
  'product_variants',
  'products',
  'projects',
  'reviews',
  'shipping_rates',
  'shipping_zones',
  'site_navigation',
  'sites',
  'store_customers',
  'store_markets',
  'store_metafield_definitions',
  'store_metafield_values',
  'storefront_locales',
  'storefront_translations',
  'tax_rates',
  'theme_instances',
  'theme_releases',
  'wallet_ledger_entries',
];

const guardTokens = [
  'requireOwnedSite',
  'verifySiteOwnership',
  'verifyStoreOwnership',
  'assertStoreOwnership',
  'verifyStoreOwner',
  'resolveTenantContextForOwnedSite',
  'resolveTenantContextForOrder',
  'resolveOwnedLocalizationStore',
  'resolveOwnedMetafieldStore',
  'requireStorefrontInternal',
  'requireCustomerSession',
  'verifyCheckoutHandoff',
  'requireCustomUser',
  'requireWhatsAppWebhookSignature',
  'getVerifiedStoreCustomer',
  'createPublicStorefrontTenantContext',
  'loadPublishedStore',
  'loadPublishedStoreById',
  'isInternalApiSecretRequest',
  'requireInternalApiSecret',
  'authMiddleware',
  "c.get('auth')",
  'c.get("auth")',
];

const explicitAllowlist = new Set([
  // Existing platform/admin surfaces have mount-level controls or need a
  // separate endpoint-by-endpoint audit. This allowlist is the initial legacy
  // budget; adding a new tenant-table handler without a local guard grows the
  // output and fails this validator.
  'admin.ts:GET:/dashboard',
  'admin.ts:GET:/stores',
  'admin.ts:GET:/analytics',
  'app-api.ts:GET:/products',
  'app-api.ts:GET:/orders',
  'app-store.ts:GET:/reviews/moderation',
  'app-store.ts:GET:/apps/:id/reviews',
  'auth.ts:POST:/custom/users/first-store',
  'auth.ts:POST:/custom/subdomains/validate',
  'contacts.ts:POST:/',
  'custom-domains.ts:POST:/domains',
  'custom-domains.ts:POST:/domains/verify',
  'custom-domains.ts:GET:/domains/:domain/status',
  'custom-domains.ts:POST:/domain-reviews/:reviewId/decision',
  'custom-domains.ts:DELETE:/domains/:domain',
  'custom-domains.ts:PUT:/',
  'domains.ts:POST:/purchase',
  'internal-console.ts:GET:/summary',
  'internal-console.ts:GET:/analytics',
  'internal-console.ts:GET:/stores',
  'internal-custom-domain-reconcile.ts:POST:/run',
  'onboarding.ts:POST:/check-subdomain',
  'pages.ts:GET:/',
  'pages.ts:POST:/',
  'storefront/customer-engagement-routes.ts:POST:/customer/password/request-reset',
  'storefront/customer-engagement-routes.ts:POST:/customer/password/confirm-reset',
  'storefront/customer-engagement-routes.ts:POST:/customer/login',
  // LB-12 register is public by necessity (a new shopper has no session); gated by per-IP rate-limit
  // + Turnstile + the not-exists precondition (no token-less overwrite of an existing credential).
  'storefront/customer-registration.ts:POST:/customer/register',
  'storefront/customer-engagement-routes.ts:PATCH:/customer/profile',
  'storefront/customer-engagement-routes.ts:POST:/reviews',
  // Public storefront catalog reads are scoped by loadPublishedStore/loadSiteByHandle
  // helper dependencies outside the registered handler body.
  'storefront/public-routes.ts:GET:/lookup',
  'storefront/public-routes.ts:GET:/directory',
  'storefront/public-routes.ts:GET:/store/:storeId',
  'storefront/public-routes.ts:GET:/:subdomain',
  'storefront/public-routes.ts:GET:/:subdomain/products',
  'storefront/public-routes.ts:GET:/:subdomain/products/:productId',
  'storefront/public-routes.ts:GET:/:subdomain/theme',
  'storefront/public-routes.ts:GET:/:subdomain/pages/:slug',
  'stores.ts:GET:/public/:subdomain',
]);

function listTypeScriptFiles(dir) {
  if (!existsSync(dir)) return [];
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...listTypeScriptFiles(fullPath));
    } else if (entry.isFile() && entry.name.endsWith('.ts')) {
      files.push(fullPath);
    }
  }
  return files;
}

function stringLiteralText(node) {
  return node && ts.isStringLiteralLike(node) ? node.text : null;
}

function routeMethodName(expression) {
  if (!ts.isPropertyAccessExpression(expression)) return null;
  const name = expression.name.text.toLowerCase();
  return routeMethods.has(name) ? name.toUpperCase() : null;
}

function containsTenantTable(text) {
  return tenantTables.some((table) => {
    const fromPattern = new RegExp(`\\.from\\(\\s*['"]${table}['"]\\s*\\)`);
    const sqlPattern = new RegExp(`\\b(?:from|into|update|join)\\s+public\\.${table}\\b|\\b(?:from|into|update|join)\\s+${table}\\b`, 'i');
    return fromPattern.test(text) || sqlPattern.test(text);
  });
}

function containsGuard(text) {
  return guardTokens.some((token) => text.includes(token));
}

function routeKey(filePath, method, routePath) {
  const relative = path.relative(routesRoot, filePath).split(path.sep).join('/');
  return `${relative}:${method}:${routePath}`;
}

// W1: requireOwnedSite/requireOwnedSiteOrError must resolve to the single
// canonical implementation in lib/tenant-context.ts, never a local
// per-route-file redefinition. containsGuard() above only matches the
// literal substring, so without this check a re-duplicated local function of
// the same name would still silently satisfy the ownership-gate signal.
const canonicalOwnershipGateNamePattern = /^requireOwnedSite/;
const canonicalOwnershipGateModule = path.join(repoRoot, 'services/api-gateway/src/lib/tenant-context');

function importsOwnershipGateFromCanonicalModule(sourceFile, filePath, identifierName) {
  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    const namedBindings = statement.importClause?.namedBindings;
    if (!namedBindings || !ts.isNamedImports(namedBindings)) continue;
    const importsIdentifier = namedBindings.elements.some((element) => element.name.text === identifierName);
    if (!importsIdentifier) continue;
    const moduleSpecifier = stringLiteralText(statement.moduleSpecifier);
    if (!moduleSpecifier || !moduleSpecifier.startsWith('.')) continue;
    const resolved = path.resolve(path.dirname(filePath), moduleSpecifier);
    if (resolved === canonicalOwnershipGateModule) return true;
  }
  return false;
}

// These paths use an actual imported guard rather than one of the legacy text
// signals above. Recognize only direct, ordered calls and exact query bindings;
// a comment, unused import, callback, swallowed error or presumed mount is not proof.
function canonicalIdentifier(identifier, sourceFile, filePath, exportName, modulePath, handler) {
  if (!identifier || !ts.isIdentifier(identifier)) return false;
  const localName = identifier.text;
  let shadowed = false;
  function check(node) {
    if ((ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isParameter(node)) &&
        node.name && ts.isIdentifier(node.name) && node.name.text === localName) shadowed = true;
    ts.forEachChild(node, check);
  }
  check(handler);
  for (let scope = handler.parent; scope && scope !== sourceFile; scope = scope.parent) {
    for (const parameter of scope.parameters ?? []) {
      if (ts.isIdentifier(parameter.name) && parameter.name.text === localName) shadowed = true;
    }
    if (ts.isBlock(scope)) {
      for (const statement of scope.statements) {
        if (ts.isVariableStatement(statement) && statement.declarationList.declarations.some(declaration =>
            ts.isIdentifier(declaration.name) && declaration.name.text === localName)) shadowed = true;
        if (ts.isFunctionDeclaration(statement) && statement.name?.text === localName) shadowed = true;
      }
    }
  }
  if (shadowed) return false;
  return sourceFile.statements.some(statement => {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) return false;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) return false;
    const specifier = statement.moduleSpecifier.text;
    if (!specifier.startsWith('.')) return false;
    const resolved = path.resolve(path.dirname(filePath), specifier).replace(/\.(?:ts|js)$/, '');
    const expected = path.join(repoRoot, 'services/api-gateway/src', modulePath);
    return resolved === expected && existsSync(`${expected}.ts`) && bindings.elements.some(element =>
      !element.isTypeOnly && !statement.importClause.isTypeOnly && element.name.text === localName &&
      (element.propertyName ?? element.name).text === exportName);
  });
}

function canonicalCall(call, sourceFile, filePath, exportName, modulePath, contextName, handler) {
  return call && ts.isCallExpression(call) && call.arguments[0] && ts.isIdentifier(call.arguments[0])
    && call.arguments[0].text === contextName
    && canonicalIdentifier(call.expression, sourceFile, filePath, exportName, modulePath, handler);
}

// Console operators may inspect tenants by permission; this is not tenant ownership.
// Prove the actual ordered per-route middleware and its canonical imports. Neither
// helper names in comments nor arbitrary local/mount-level callbacks are sufficient.
function canonicalConsoleMiddlewareGuard(sourceFile, filePath, route, handler) {
  const handlerIndex = route.arguments.indexOf(handler);
  const middleware = route.arguments.slice(1, handlerIndex);
  // Additional callbacks could replace the bound identity or change context
  // after authorization. Only the reviewed binder/permission pair is admitted.
  if (middleware.length !== 2) return false;
  let bound = false;
  const permissionFactory = expression => ts.isCallExpression(expression)
    && expression.arguments.length === 1 && ts.isStringLiteral(expression.arguments[0])
    && /^[a-z]+:[a-z]+$/.test(expression.arguments[0].text)
    && canonicalIdentifier(expression.expression, sourceFile, filePath, 'consolePermission',
      'identity-foundation/console-approval-repository', handler);
  for (const argument of middleware) {
    if (canonicalIdentifier(argument, sourceFile, filePath, 'bindConsoleOperatorIdentity',
        'identity-foundation/console-session-repository', handler)) {
      bound = true;
      continue;
    }
    if (!bound) continue;
    if (permissionFactory(argument)) return true;
    if (!ts.isIdentifier(argument)) continue;
    // A module-level const alias is allowed only when it cannot be shadowed at
    // registration. It must still originate from the canonical permission factory.
    let shadowed = false;
    for (let scope = route.parent; scope && scope !== sourceFile; scope = scope.parent) {
      if ((scope.parameters ?? []).some(p => ts.isIdentifier(p.name) && p.name.text === argument.text)) shadowed = true;
      if (ts.isBlock(scope) && scope.statements.some(statement =>
        ts.isVariableStatement(statement) && statement.declarationList.declarations.some(d => ts.isIdentifier(d.name) && d.name.text === argument.text)
        || ts.isFunctionDeclaration(statement) && statement.name?.text === argument.text)) shadowed = true;
    }
    if (shadowed) continue;
    for (const statement of sourceFile.statements) {
      if (!ts.isVariableStatement(statement) || !(statement.declarationList.flags & ts.NodeFlags.Const)) continue;
      if (statement.declarationList.declarations.some(d => ts.isIdentifier(d.name) && d.name.text === argument.text
          && d.initializer && permissionFactory(d.initializer))) return true;
    }
  }
  return false;
}

function boundedCanonicalGuard(sourceFile, filePath, handler) {
  if (!ts.isBlock(handler.body) || !handler.parameters[0] || !ts.isIdentifier(handler.parameters[0].name)) return false;
  const contextName = handler.parameters[0].name.text;
  const statements = [...handler.body.statements];
  const writesBinding = (node, name) => {
    if (!ts.isBinaryExpression(node) || node.operatorToken.kind < ts.SyntaxKind.FirstAssignment ||
        node.operatorToken.kind > ts.SyntaxKind.LastAssignment) return false;
    let target = node.left;
    while (ts.isPropertyAccessExpression(target) || ts.isElementAccessExpression(target)) target = target.expression;
    return ts.isIdentifier(target) && target.text === name;
  };
  let contextChanged = false, customerContextWritten = false;
  function inspectContext(node) {
    if (writesBinding(node, contextName)) contextChanged = true;
    if (ts.isVariableDeclaration(node) && node.initializer &&
        ts.isIdentifier(node.initializer) && node.initializer.text === contextName) contextChanged = true;
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) &&
        ts.isIdentifier(node.expression.expression) && node.expression.expression.text === contextName &&
        node.expression.name.text === 'set' && stringLiteralText(node.arguments[0]) === 'customer') customerContextWritten = true;
    ts.forEachChild(node, inspectContext);
  }
  inspectContext(handler.body);
  if (contextChanged) return false;
  const firstRead = statements.findIndex(statement => containsTenantTable(statement.getText(sourceFile)));
  if (firstRead < 0) return false;
  const calls = (statement) => {
    if (ts.isExpressionStatement(statement)) return [statement.expression];
    if (ts.isVariableStatement(statement)) return statement.declarationList.declarations.map(d => d.initializer).filter(Boolean);
    return [];
  };
  for (const statement of statements.slice(0, firstRead)) {
    for (const expression of calls(statement)) {
      // This reviewed local helper verifies the current owner and returns a
      // tenant-scoped resource. Recognize only its direct awaited call before
      // access in its own route module; a mention, callback or shadow is no gate.
      if (path.relative(routesRoot, filePath) === 'shipping-tax.ts' && ts.isAwaitExpression(expression)) {
        const call = expression.expression;
        const name = 'resolveShippingTaxResourceScope';
        const declared = sourceFile.statements.some(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
        let shadowed = false;
        function inspectShadow(node) {
          if ((ts.isVariableDeclaration(node) || ts.isFunctionDeclaration(node) || ts.isParameter(node)) &&
              node.name && ts.isIdentifier(node.name) && node.name.text === name) shadowed = true;
          ts.forEachChild(node, inspectShadow);
        }
        inspectShadow(handler);
        if (declared && !shadowed && ts.isCallExpression(call) && ts.isIdentifier(call.expression) && call.expression.text === name &&
            call.arguments.length === 3 && ts.isIdentifier(call.arguments[0]) && call.arguments[0].text === contextName &&
            ['shipping_zones', 'shipping_rates', 'tax_rates'].includes(stringLiteralText(call.arguments[1]))) return true;
      }
      if (ts.isAwaitExpression(expression) && canonicalCall(expression.expression, sourceFile, filePath,
          'requireConsolePermission', 'identity-foundation/console-approval-repository', contextName, handler) &&
          expression.expression.arguments[1] && ts.isStringLiteral(expression.expression.arguments[1]) &&
          expression.expression.arguments[1].text.length > 0) return true;
    }
  }

  // getCustomerSession is only a context accessor. It becomes a bounded read
  // gate with an unconditional missing-session return BEFORE the read and both
  // customer/store predicates sourced from that same unmodified session.
  for (let i = 0; i < firstRead; i++) {
    const statement = statements[i];
    if (!ts.isVariableStatement(statement) || !(statement.declarationList.flags & ts.NodeFlags.Const)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (!ts.isIdentifier(declaration.name) || !declaration.initializer ||
          !canonicalCall(declaration.initializer, sourceFile, filePath, 'getCustomerSession',
            'middleware/customer-session', contextName, handler)) continue;
      const name = declaration.name.text;
      const allowedSessionReferences = new Set([declaration.name]);
      const refused = statements.slice(i + 1, firstRead).some(node => {
        if (!ts.isIfStatement(node) || node.elseStatement || !ts.isPrefixUnaryExpression(node.expression) ||
            node.expression.operator !== ts.SyntaxKind.ExclamationToken ||
            !ts.isIdentifier(node.expression.operand) || node.expression.operand.text !== name) return false;
        const branch = ts.isBlock(node.thenStatement) ? [...node.thenStatement.statements] : [node.thenStatement];
        const exits = branch.length === 1 && (ts.isReturnStatement(branch[0]) || ts.isThrowStatement(branch[0]));
        if (exits) allowedSessionReferences.add(node.expression.operand);
        return exits;
      });
      if (!refused || customerContextWritten) continue;
      let invalid = false, queryCount = 0;
      function inspect(node) {
        if (writesBinding(node, name)) invalid = true;
        if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === 'from') {
          queryCount++;
          if (stringLiteralText(node.arguments[0]) !== 'store_customers') { invalid = true; return; }
          let current = node, customer = false, store = false, selected = false;
          while (ts.isPropertyAccessExpression(current.parent) && current.parent.expression === current &&
                 ts.isCallExpression(current.parent.parent)) {
            const next = current.parent.parent, method = current.parent.name.text;
            if (!['select', 'eq', 'is', 'maybeSingle', 'single', 'limit', 'order'].includes(method)) invalid = true;
            if (method === 'select') selected = true;
            if (method === 'eq' && next.arguments[1] && ts.isPropertyAccessExpression(next.arguments[1]) &&
                ts.isIdentifier(next.arguments[1].expression) && next.arguments[1].expression.text === name) {
              customer ||= stringLiteralText(next.arguments[0]) === 'id' && next.arguments[1].name.text === 'customerId';
              store ||= stringLiteralText(next.arguments[0]) === 'store_id' && next.arguments[1].name.text === 'storeId';
              allowedSessionReferences.add(next.arguments[1].expression);
            }
            current = next;
          }
          if (!customer || !store || !selected) invalid = true;
        }
        ts.forEachChild(node, inspect);
      }
      inspect(handler.body);
      function inspectReferences(node) {
        if (ts.isIdentifier(node) && node.text === name && !allowedSessionReferences.has(node)) invalid = true;
        ts.forEachChild(node, inspectReferences);
      }
      inspectReferences(handler.body);
      // Raw SQL has no supported query-builder binding proof in this analysis.
      const rawSql = tenantTables.some(table => new RegExp(`\\b(?:from|into|update|join)\\s+(?:public\\.)?${table}\\b`, 'i').test(handler.getText(sourceFile)));
      if (!invalid && queryCount > 0 && !rawSql) return true;
    }
  }
  return false;
}

const knownOwnershipGateNames = ['requireOwnedSite', 'requireOwnedSiteOrError'];
const duplicateGuardDefinitions = [];
const violations = [];

for (const filePath of listTypeScriptFiles(routesRoot)) {
  const sourceText = readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const relative = path.relative(routesRoot, filePath).split(path.sep).join('/');

  const locallyDefinedNames = new Set();
  for (const statement of sourceFile.statements) {
    if (ts.isFunctionDeclaration(statement) && statement.name && canonicalOwnershipGateNamePattern.test(statement.name.text)) {
      locallyDefinedNames.add(statement.name.text);
      const line = sourceFile.getLineAndCharacterOfPosition(statement.getStart(sourceFile)).line + 1;
      duplicateGuardDefinitions.push(
        `${relative}:${line} locally defines ${statement.name.text} -- import it from services/api-gateway/src/lib/tenant-context.ts instead`
      );
    }
  }

  for (const identifierName of knownOwnershipGateNames) {
    if (locallyDefinedNames.has(identifierName)) continue; // already reported above
    const referencedAsWord = new RegExp(`\\b${identifierName}\\b`).test(sourceText);
    if (!referencedAsWord) continue; // this file never uses this identifier
    if (!importsOwnershipGateFromCanonicalModule(sourceFile, filePath, identifierName)) {
      duplicateGuardDefinitions.push(
        `${relative} references ${identifierName} without importing it from services/api-gateway/src/lib/tenant-context.ts`
      );
    }
  }

  function visit(node) {
    if (ts.isCallExpression(node)) {
      const method = routeMethodName(node.expression);
      const routePath = node.arguments.length > 0 ? stringLiteralText(node.arguments[0]) : null;
      const handler = node.arguments.findLast?.((arg) => ts.isArrowFunction(arg) || ts.isFunctionExpression(arg));

      if (method && routePath && handler) {
        const handlerText = handler.getText(sourceFile);
        const key = routeKey(filePath, method, routePath);

        if (
          containsTenantTable(handlerText) &&
          !containsGuard(handlerText) &&
          !boundedCanonicalGuard(sourceFile, filePath, handler) &&
          !canonicalConsoleMiddlewareGuard(sourceFile, filePath, node, handler) &&
          !explicitAllowlist.has(key)
        ) {
          const line = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
          violations.push(`${key}:${line}`);
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
}

let failed = false;

if (duplicateGuardDefinitions.length > 0) {
  console.error('Route ownership validator found non-canonical ownership-gate definitions or references:');
  for (const violation of duplicateGuardDefinitions) {
    console.error(` - ${violation}`);
  }
  failed = true;
}

if (violations.length > 0) {
  console.error('Route ownership validator found tenant-table handlers without an ownership/internal/session gate:');
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log('Route ownership validator passed.');
