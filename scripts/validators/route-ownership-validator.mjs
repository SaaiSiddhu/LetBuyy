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
  return ts.isStringLiteralLike(node) ? node.text : null;
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

const violations = [];

for (const filePath of listTypeScriptFiles(routesRoot)) {
  const sourceText = readFileSync(filePath, 'utf8');
  const sourceFile = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);

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

if (violations.length > 0) {
  console.error('Route ownership validator found tenant-table handlers without an ownership/internal/session gate:');
  for (const violation of violations) {
    console.error(` - ${violation}`);
  }
  process.exit(1);
}

console.log('Route ownership validator passed.');
