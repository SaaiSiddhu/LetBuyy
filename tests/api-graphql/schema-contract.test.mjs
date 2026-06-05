import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const schemaPath = path.join(repoRoot, 'services/api-gateway/src/graphql/schema.ts');
const sharedTypesPath = path.join(repoRoot, 'packages/shared-types/src/index.ts');
const schemaSource = readFileSync(schemaPath, 'utf8');
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
    "endpoint: '/v1/graphql/admin'",
    "queryType: 'AdminQuery'",
    "mutationType: 'AdminMutation'",
    "auth: 'merchant-session'",
    "endpoint: '/v1/graphql/storefront'",
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
