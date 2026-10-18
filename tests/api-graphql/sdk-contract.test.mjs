import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const tsGraphQLPath = path.join(repoRoot, 'packages/typescript/api-client/src/graphql.ts');
const tsClientIndexPath = path.join(repoRoot, 'packages/typescript/api-client/src/index.ts');
const dartGraphQLPath = path.join(repoRoot, 'packages/dart/api_client/lib/src/graphql.dart');
const dartApiClientPath = path.join(repoRoot, 'packages/dart/api_client/lib/src/api_client.dart');
const dartLibraryPath = path.join(repoRoot, 'packages/dart/api_client/lib/letbuyy_api_client.dart');

const tsGraphQLSource = readFileSync(tsGraphQLPath, 'utf8');
const tsClientIndexSource = readFileSync(tsClientIndexPath, 'utf8');
const dartGraphQLSource = readFileSync(dartGraphQLPath, 'utf8');
const dartApiClientSource = readFileSync(dartApiClientPath, 'utf8');
const dartLibrarySource = readFileSync(dartLibraryPath, 'utf8');

function assertIncludesAll(source, needles, context) {
  for (const needle of needles) {
    assert.ok(source.includes(needle), `${context} is missing ${needle}`);
  }
}

test('WS12 G5 TypeScript GraphQL SDK exposes schema-derived Admin and Storefront operations', () => {
  assertIncludesAll(tsGraphQLSource, [
    "LETBUYY_GRAPHQL_SDK_SCHEMA_VERSION = '2026-06-05.g1'",
    "LETBUYY_ADMIN_GRAPHQL_PATH = '/admin/graphql'",
    "LETBUYY_STOREFRONT_GRAPHQL_PATH = '/storefront/graphql'",
    'LETBUYY_ADMIN_GRAPHQL_OPERATIONS',
    "operationName: 'AdminProducts'",
    "operationName: 'AdminOrders'",
    "operationName: 'AdminBulkOperationRunQuery'",
    "operationName: 'AdminBulkOperationRunMutation'",
    'bulkOperationRunQuery(input: $input)',
    'bulkOperationRunMutation(input: $input)',
    'LETBUYY_STOREFRONT_GRAPHQL_OPERATIONS',
    "operationName: 'StorefrontProducts'",
    "operationName: 'StorefrontPages'",
    'GraphQLConnection<Product>',
    'GraphQLBulkOperation',
    'createLetbuyyGraphQLSdk',
  ], 'TypeScript generated GraphQL SDK');

  assertIncludesAll(tsClientIndexSource, [
    "import { createLetbuyyGraphQLSdk } from './graphql'",
    'readonly graphql: LetbuyyGraphQLSdk',
    "export * from './graphql'",
  ], 'TypeScript API client GraphQL facade');

  assert.doesNotMatch(tsGraphQLSource, /services\/api-gateway|src\/graphql\/schema/, 'TS SDK must not import service internals');
});

test('WS12 G5 Dart GraphQL SDK exposes the same generated operation catalog', () => {
  assertIncludesAll(dartGraphQLSource, [
    "letbuyyGraphQLSdkSchemaVersion = '2026-06-05.g1'",
    "letbuyyAdminGraphQLPath = '/admin/graphql'",
    "letbuyyStorefrontGraphQLPath = '/storefront/graphql'",
    'class GraphQLClient',
    'class LetBuyyGraphQLOperations',
    "operationName: 'AdminProducts'",
    "operationName: 'AdminCurrentBulkOperation'",
    "operationName: 'AdminBulkOperationRunQuery'",
    "operationName: 'AdminBulkOperationRunMutation'",
    'bulkOperationRunQuery(input: $input)',
    'bulkOperationRunMutation(input: $input)',
    "operationName: 'StorefrontProducts'",
    "operationName: 'StorefrontPages'",
    "operationName: 'StorefrontStore'",
  ], 'Dart generated GraphQL SDK');

  assertIncludesAll(dartApiClientSource, [
    "import 'graphql.dart'",
    'late final GraphQLClient graphql',
  ], 'Dart API client GraphQL facade');

  assertIncludesAll(dartLibrarySource, [
    "export 'src/graphql.dart'",
  ], 'Dart public GraphQL export');

  const operations = source => [...source.matchAll(/operationName:\s*'([^']+)'/g)]
    .map(match => match[1]).sort();
  assert.deepEqual(operations(dartGraphQLSource), operations(tsGraphQLSource),
    'both SDKs publish the same complete supported operation catalog');
  for (const source of [tsGraphQLSource, dartGraphQLSource]) {
    assert.doesNotMatch(source, /customerOrders|StorefrontCustomerOrders/,
      'private store-customer orders use the scoped REST transport; GraphQL remains deferred');
  }
});
