import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const EVENT_CORE = 'packages/event-core/src/index.ts';
const OPERATIONS_SCHEMA = 'services/api-gateway/src/schemas/operations.schema.ts';
const OPERATIONS_INDEX = 'services/api-gateway/src/index.ts';
const MARKETPLACE_REVIEW_ROUTE = 'services/api-gateway/src/routes/operations/marketplace-reviews.ts';
const REVIEW_HELPER = 'services/api-gateway/src/lib/marketplace-review-records.ts';
const API_CLIENT = 'packages/typescript/api-client/src/index.ts';
const OPERATIONS_PACKAGE = 'apps/platform-operations-portal/package.json';
const OPERATIONS_MANIFEST = 'apps/platform-operations-portal/runtime.manifest.json';
const OPERATIONS_API_CLIENT = 'apps/platform-operations-portal/src/lib/api/client.ts';
const OPERATIONS_PAGE = 'apps/platform-operations-portal/src/app/(dashboard)/operations/page.tsx';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('event-core declares app and theme review decision events', () => {
  const source = read(EVENT_CORE);

  for (const eventType of ['app.approved', 'app.rejected', 'theme.approved', 'theme.rejected']) {
    assert.match(source, new RegExp(`'${eventType.replaceAll('.', '\\.')}'`), eventType);
  }

  assert.match(source, /export const MarketplaceReviewListQuerySchema/);
  assert.match(source, /export const MarketplaceReviewDecisionSchema/);
  assert.match(source, /reviewer_id: UuidSchema\.optional\(\)/);
  assert.match(source, /producer: 'platform-operations-portal'/);
  assert.match(source, /consumers: \['analytics', 'notifications', 'search-indexing', 'webhook-service'\]/);
});

test('operations schemas expose marketplace review queue contracts', () => {
  const source = read(OPERATIONS_SCHEMA);

  assert.match(source, /MarketplaceReviewListQuerySchema/);
  assert.match(source, /MarketplaceReviewDecisionSchema/);
  assert.match(source, /type MarketplaceReviewListQuery/);
  assert.match(source, /type MarketplaceReviewDecisionInput/);
});

test('ops route lists and decides marketplace app and theme reviews', () => {
  const index = read(OPERATIONS_INDEX);
  const route = read(MARKETPLACE_REVIEW_ROUTE);
  const helper = read(REVIEW_HELPER);

  assert.match(index, /api\.route\('\/operations\/marketplace-reviews', operationsMarketplaceReviewsRouter\)/);
  assert.match(route, /router\.use\('\*', requireRoleCategory\('ops'\), requireSuperAdmin\)/);
  assert.match(route, /router\.get\('\/', requirePermission\('review:view'\)/);
  assert.match(route, /router\.post\('\/:id\/decision', requirePermission\('review:decide'\)/);
  assert.match(route, /MarketplaceReviewListQuerySchema\.safeParse/);
  assert.match(route, /MarketplaceReviewDecisionSchema\.safeParse/);
  assert.match(route, /from\('marketplace_review_records'\)/);
  assert.match(route, /MARKETPLACE_REVIEW_RECORD_COLUMNS/);

  assert.match(helper, /export const MARKETPLACE_REVIEW_RECORD_COLUMNS/);
  assert.match(helper, /export type MarketplaceReviewDecision/);
});

test('ops decisions publish apps, publish or revoke theme versions, and emit review events', () => {
  const route = read(MARKETPLACE_REVIEW_ROUTE);

  assert.match(route, /from\('marketplace_apps'\)/);
  assert.match(route, /status: marketplaceAppStatusForDecision\(decision\)/);
  assert.match(route, /if \(decision === 'approved'\) return 'published'/);
  assert.match(route, /if \(decision === 'rejected'\) return 'rejected'/);

  assert.match(route, /from\('theme_packages'\)/);
  assert.match(route, /from\('theme_package_versions'\)/);
  assert.match(route, /if \(decision === 'approved'\) return 'published'/);
  assert.match(route, /if \(decision === 'rejected'\) return 'revoked'/);
  assert.match(route, /from\('themes'\)/);
  assert.match(route, /is_active: decision === 'approved'/);

  assert.match(route, /eventTypeForMarketplaceReview/);
  assert.match(route, /return 'app\.approved'/);
  assert.match(route, /return 'app\.rejected'/);
  assert.match(route, /return 'theme\.approved'/);
  assert.match(route, /return 'theme\.rejected'/);
  assert.match(route, /new EventExecutionAdapter\(db\)\.emitDomainEvent/);
  assert.match(route, /reviewer_id: input\.actorId/);
});

test('typed API client exposes operations review queue methods', () => {
  const source = read(API_CLIENT);

  assert.match(source, /MarketplaceReviewListQuery/);
  assert.match(source, /MarketplaceReviewDecisionInput/);
  assert.match(source, /readonly operations =/);
  assert.match(source, /marketplaceReviews: \(query\?: MarketplaceReviewListQuery/);
  assert.match(source, /decideMarketplaceReview: \(id: string, input: MarketplaceReviewDecisionInput/);
  assert.match(source, /'\/operations\/marketplace-reviews'/);
  assert.match(source, /`\/operations\/marketplace-reviews\/\$\{encodePathSegment\(id\)\}\/decision`/);
});

test('platform operations portal consumes the operations API as a thin client', () => {
  const packageJson = read(OPERATIONS_PACKAGE);
  const manifest = read(OPERATIONS_MANIFEST);
  const client = read(OPERATIONS_API_CLIENT);
  const page = read(OPERATIONS_PAGE);

  assert.match(packageJson, /"@letbuyy\/api-client": "workspace:\*"/);
  assert.match(packageJson, /"@letbuyy\/shared-types": "workspace:\*"/);
  assert.match(manifest, /"@letbuyy\/api-client"/);
  assert.match(manifest, /"@letbuyy\/shared-types"/);

  assert.match(client, /createLetbuyyApiClient/);
  assert.match(client, /createLetbuyyInternalSessionHeaders/);
  assert.match(client, /LETBUYY_MERCHANT_SESSION_COOKIE/);
  assert.doesNotMatch(client, /@supabase\//);

  assert.match(page, /createPlatformOperationsApiClient\(\{ requireSession: true \}\)/);
  assert.match(page, /api\.operations\.marketplaceReviews/);
  assert.match(page, /api\.operations\.decideMarketplaceReview/);
  assert.match(page, /submitMarketplaceReviewDecision/);
  assert.match(page, /revalidatePath\('\/operations'\)/);
  assert.doesNotMatch(page, /@supabase\//);
});
