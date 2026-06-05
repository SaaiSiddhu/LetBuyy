import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const schemaPath = path.join(repoRoot, 'services/api-gateway/src/graphql/schema.ts');
const adminGraphQLPath = path.join(repoRoot, 'services/api-gateway/src/graphql/admin.ts');
const storefrontGraphQLPath = path.join(repoRoot, 'services/api-gateway/src/graphql/storefront.ts');
const graphQLCostPath = path.join(repoRoot, 'services/api-gateway/src/graphql/cost.ts');
const gatewayIndexPath = path.join(repoRoot, 'services/api-gateway/src/index.ts');
const sharedTypesPath = path.join(repoRoot, 'packages/shared-types/src/index.ts');
const schemaSource = readFileSync(schemaPath, 'utf8');
const adminGraphQLSource = readFileSync(adminGraphQLPath, 'utf8');
const storefrontGraphQLSource = readFileSync(storefrontGraphQLPath, 'utf8');
const graphQLCostSource = readFileSync(graphQLCostPath, 'utf8');
const gatewayIndexSource = readFileSync(gatewayIndexPath, 'utf8');
const sharedTypesSource = readFileSync(sharedTypesPath, 'utf8');
const sdlMatch = schemaSource.match(/export const LETBUYY_GRAPHQL_SCHEMA_SDL = String\.raw`([\s\S]*?)`;/);

assert.ok(sdlMatch, 'schema.ts must export LETBUYY_GRAPHQL_SCHEMA_SDL as a String.raw template');

const sdl = sdlMatch[1];

function assertIncludesAll(source, needles, context) {
  for (const needle of needles) {
    assert.ok(source.includes(needle), `${context} is missing ${needle}`);
  }
}

test('WS12 G1 exports separate Admin and Storefront GraphQL root metadata', () => {
  assertIncludesAll(schemaSource, [
    "LETBUYY_GRAPHQL_SCHEMA_VERSION = '2026-06-05.g1'",
    "endpoint: '/v1/admin/graphql'",
    "aliases: ['/v1/graphql/admin']",
    "queryType: 'AdminQuery'",
    "mutationType: 'AdminMutation'",
    "auth: 'merchant-session'",
    "endpoint: '/v1/storefront/graphql'",
    "aliases: ['/v1/graphql/storefront']",
    "queryType: 'StorefrontQuery'",
    "mutationType: 'StorefrontMutation'",
    "auth: 'storefront-public-or-customer-token'",
  ], 'GraphQL root metadata');

  assertIncludesAll(sdl, [
    'type Query',
    'type Mutation',
    'type AdminQuery',
    'type AdminMutation',
    'type StorefrontQuery',
    'type StorefrontMutation',
  ], 'GraphQL SDL roots');
});

test('WS12 G1 SDL covers core LetBuyy commerce, content, theme, and app domains', () => {
  assertIncludesAll(sdl, [
    'type Store implements Node & Timestamped',
    'type Product implements Node & Timestamped',
    'type ProductVariant implements Node & Timestamped',
    'type Collection implements Node & Timestamped',
    'type InventoryLevel',
    'type Customer implements Node & Timestamped',
    'type Cart implements Node & Timestamped',
    'type Order implements Node & Timestamped',
    'type Payment implements Node & Timestamped',
    'type Page implements Node & Timestamped',
    'type Policy',
    'type NavigationMenu',
    'type BlogPost implements Node & Timestamped',
    'type Theme implements Node & Timestamped',
    'type ThemeBundle',
    'type ThemeSection',
    'type ThemeBlock',
    'type MarketplaceApp',
    'type InstalledApp',
  ], 'GraphQL SDL domain coverage');
});

test('WS12 G1 SDL defines Relay-style connections and calculated query cost metadata', () => {
  assertIncludesAll(sdl, [
    'directive @cost',
    'type PageInfo',
    'type QueryCost',
    'queryCost(document: String!, variables: JSON): QueryCost!',
    'type ProductConnection',
    'type OrderConnection',
    'type CustomerConnection',
    'type CollectionConnection',
    'type ThemeConnection',
    'type MarketplaceAppConnection',
    'type BulkOperationConnection',
    'edges: [ProductEdge!]!',
    'nodes: [Product!]!',
    'pageInfo: PageInfo!',
    'queryCost: QueryCost',
  ], 'GraphQL pagination and cost contract');
});

test('WS12 G1 SDL reserves JSONL bulk operation mutations and status shape', () => {
  assertIncludesAll(schemaSource, [
    "queryMutation: 'bulkOperationRunQuery'",
    "mutationMutation: 'bulkOperationRunMutation'",
    "cancelMutation: 'bulkOperationCancel'",
    "outputFormat: 'JSONL'",
    "resultStorage: 'Cloudflare R2'",
    "idempotencyHeader: 'X-Idempotency-Key'",
  ], 'GraphQL bulk operation metadata');

  assertIncludesAll(sdl, [
    'type BulkOperation',
    'enum BulkOperationStatus',
    'enum BulkOperationType',
    'input BulkOperationRunQueryInput',
    'input BulkOperationRunMutationInput',
    'bulkOperationRunQuery(input: BulkOperationRunQueryInput!): BulkOperationPayload!',
    'bulkOperationRunMutation(input: BulkOperationRunMutationInput!): BulkOperationPayload!',
    'bulkOperationCancel(id: ID!): BulkOperationPayload!',
  ], 'GraphQL bulk operation SDL');
});

test('WS12 G1 schema is aligned to shared-types instead of app-local DTOs', () => {
  assertIncludesAll(schemaSource, [
    "Product: '@letbuyy/shared-types:Product'",
    "Order: '@letbuyy/shared-types:Order'",
    "Customer: '@letbuyy/shared-types:Customer'",
    "Store: '@letbuyy/shared-types:Store'",
    "ThemeBundle: '@letbuyy/shared-types:ThemeBundle'",
    "MarketplaceApp: '@letbuyy/shared-types:MarketplaceApp'",
    "BulkOperation: '@letbuyy/shared-types:GraphQLBulkOperation'",
    "ProductConnection: '@letbuyy/shared-types:GraphQLConnection<Product>'",
  ], 'GraphQL shared-type alignment map');

  assertIncludesAll(sharedTypesSource, [
    'export const GraphQLPageInfoSchema',
    'export const GraphQLQueryCostSchema',
    'export const GraphQLBulkOperationSchema',
    'export interface GraphQLConnectionEdge<TNode>',
    'export interface GraphQLConnection<TNode>',
  ], 'shared-types GraphQL primitives');
});

test('WS12 G2 mounts Admin GraphQL behind gateway auth with cost limiting', () => {
  assertIncludesAll(gatewayIndexSource, [
    "import { createAdminGraphQLRouter } from './graphql/admin'",
    "api.route('/admin/graphql', adminGraphQLRouter)",
    "api.route('/graphql/admin', adminGraphQLRouter)",
    "api.use('/*', authMiddleware)",
    "api.use('/*', csrfProtection)",
    "api.use('/*', rateLimit({ max: 300 }))",
  ], 'Admin GraphQL gateway mount');

  assert.ok(
    gatewayIndexSource.indexOf("api.use('/*', authMiddleware)") <
      gatewayIndexSource.indexOf("api.route('/admin/graphql', adminGraphQLRouter)"),
    'Admin GraphQL must be mounted after gateway auth middleware',
  );
});

test('WS12 G2 Admin GraphQL resolvers delegate through existing REST handlers', () => {
  assertIncludesAll(adminGraphQLSource, [
    'export type AdminGraphQLRestDelegate',
    'restDelegate: AdminGraphQLRestDelegate',
    'new Request(url.toString()',
    "resolveConnection(c, delegate, document, variables, 'products', '/products'",
    "resolveConnection(c, delegate, document, variables, 'orders', '/orders'",
    "resolveConnection(c, delegate, document, variables, 'customers', '/customers'",
    "resolveConnection(c, delegate, document, variables, 'themes', '/themes'",
    "resolveConnection(c, delegate, document, variables, 'marketplaceApps', '/app-store/apps'",
    "restGet(c, delegate, '/payments/subscription'",
    "restGet(c, delegate, '/analytics/dashboard'",
    'connectionFromEnvelope',
  ], 'Admin GraphQL REST delegation');
});

test('WS12 G2 Admin GraphQL applies calculated document cost and rate-limit headers', () => {
  assertIncludesAll(adminGraphQLSource, [
    'calculateGraphQLQueryCost',
    'checkQueryCostRateLimitKey',
    "prefix: 'rl:graphql-admin'",
    'X-RateLimit-Cost',
    'X-RateLimit-Policy',
    'QUERY_COST_RATE_LIMITED',
    'extensions: { cost }',
  ], 'Admin GraphQL cost enforcement');

  assertIncludesAll(graphQLCostSource, [
    'export function calculateGraphQLQueryCost',
    "'products'",
    "'orders'",
    'bulkOperationRunQuery',
    'bulkOperationRunMutation',
    'Math.min(cost, 250)',
  ], 'GraphQL cost estimator');
});

test('WS12 G3 mounts Storefront GraphQL as a public cache-aware endpoint', () => {
  assertIncludesAll(gatewayIndexSource, [
    "import { createStorefrontGraphQLRouter } from './graphql/storefront'",
    "api.route('/storefront/graphql', storefrontGraphQLRouter)",
    "api.route('/graphql/storefront', storefrontGraphQLRouter)",
    "api.route('/storefront', storefrontRouter)",
    "api.use('/*', authMiddleware)",
  ], 'Storefront GraphQL gateway mount');

  assert.ok(
    gatewayIndexSource.indexOf("api.route('/storefront/graphql', storefrontGraphQLRouter)") <
      gatewayIndexSource.indexOf("api.route('/storefront', storefrontRouter)"),
    'Storefront GraphQL must be mounted before the generic storefront REST router',
  );

  assert.ok(
    gatewayIndexSource.indexOf("api.route('/storefront/graphql', storefrontGraphQLRouter)") <
      gatewayIndexSource.indexOf("api.use('/*', authMiddleware)"),
    'Storefront GraphQL must remain public and optional-customer-token scoped',
  );

  assertIncludesAll(storefrontGraphQLSource, [
    'export type StorefrontGraphQLRestDelegate',
    'Cache-Control',
    'public, max-age=30, stale-while-revalidate=120',
    'private, no-store',
    'calculateGraphQLQueryCost',
    'checkQueryCostRateLimitKey',
    "prefix: 'rl:graphql-storefront'",
    'X-RateLimit-Cost',
    'QUERY_COST_RATE_LIMITED',
    'extensions: { cost }',
  ], 'Storefront GraphQL cache and cost enforcement');
});

test('WS12 G3 Storefront GraphQL delegates reads through existing storefront REST handlers', () => {
  assertIncludesAll(storefrontGraphQLSource, [
    "restGet(c, delegate, `/storefront/${encodeURIComponent(handle)}`",
    "`/storefront/${encodeURIComponent(handle)}/products`",
    "`/storefront/${encodeURIComponent(handle)}/products/${encodeURIComponent(identifier)}`",
    "`/storefront/${encodeURIComponent(handle)}/categories`",
    "`/storefront/${encodeURIComponent(handle)}/pages`",
    "`/storefront/${encodeURIComponent(handle)}/policies`",
    "`/storefront/${encodeURIComponent(handle)}/navigation`",
    "`/storefront/${encodeURIComponent(handle)}/blog`",
    "'/storefront/reviews'",
    "'/storefront/customer/by-email'",
    "'/storefront/customer/orders'",
    'data.cart = null',
  ], 'Storefront GraphQL REST delegation');
});
