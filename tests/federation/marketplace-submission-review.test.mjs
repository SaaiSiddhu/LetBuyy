import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const BASELINE_SCHEMA = 'database/supabase/migrations/000_baseline.sql';
const REVIEW_HELPER = 'services/api-gateway/src/lib/marketplace-review-records.ts';
const APP_STORE_ROUTE = 'services/api-gateway/src/routes/app-store.ts';
const THEMES_ROUTE = 'services/api-gateway/src/routes/themes.ts';
const EVENT_CORE = 'packages/event-core/src/index.ts';
const SHARED_TYPES = 'packages/shared-types/src/index.ts';
const API_CLIENT = 'packages/typescript/api-client/src/index.ts';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('marketplace review records are a governed app/theme submission queue', () => {
  const source = read(BASELINE_SCHEMA);

  assert.match(source, /CREATE TABLE public\.marketplace_review_records/);
  assert.match(source, /submission_type text NOT NULL/);
  assert.match(source, /marketplace_review_records_submission_type_check[\s\S]*'app'::text, 'theme'::text/);
  assert.match(source, /status text DEFAULT 'pending'::text NOT NULL/);
  assert.match(source, /automated_checks jsonb DEFAULT '\{\}'::jsonb NOT NULL/);
  assert.match(source, /marketplace_review_records_submission_type_resource_id_key UNIQUE \(submission_type, resource_id\)/);
  assert.match(source, /ALTER TABLE public\.marketplace_review_records ENABLE ROW LEVEL SECURITY/);
  assert.match(source, /marketplace_review_records_partner_read/);
  assert.match(source, /marketplace_review_records_service_all/);
  assert.match(source, /update_marketplace_review_records_updated_at[\s\S]*EXECUTE FUNCTION public\.update_updated_at\(\)/);
});

test('shared types and API client expose marketplace review records', () => {
  const sharedTypes = read(SHARED_TYPES);
  const apiClient = read(API_CLIENT);

  assert.match(sharedTypes, /export const MarketplaceSubmissionTypeSchema = z\.enum\(\['app', 'theme'\]\)/);
  assert.match(sharedTypes, /export const MarketplaceReviewRecordSchema/);
  assert.match(sharedTypes, /export type MarketplaceReviewRecord = z\.infer<typeof MarketplaceReviewRecordSchema>/);

  assert.match(apiClient, /MarketplaceReviewRecord/);
  assert.match(apiClient, /export interface AppSubmissionResult/);
  assert.match(apiClient, /review_records\?: MarketplaceReviewRecord\[\]/);
  assert.match(apiClient, /review_record\?: MarketplaceReviewRecord \| null/);
  assert.match(apiClient, /requestData<AppSubmissionResult>\('\/app-store\/developers\/apps'/);
  assert.match(apiClient, /requestData<ThemePackageUploadResult>\('\/themes\/packages\/upload'/);
});

test('app submissions create a review record and app.submitted event', () => {
  const helper = read(REVIEW_HELPER);
  const route = read(APP_STORE_ROUTE);
  const eventCore = read(EVENT_CORE);

  assert.match(helper, /export async function createMarketplaceReviewRecord/);
  assert.match(helper, /buildMarketplaceAutomatedChecks/);
  assert.match(helper, /from\('marketplace_review_records'\)/);
  assert.match(helper, /automated_checks: input\.automatedChecks/);

  assert.match(eventCore, /'app\.submitted'/);
  assert.match(eventCore, /const AppReviewPayloadSchema = z\.object/);
  assert.match(eventCore, /payloadSchema: AppReviewPayloadSchema/);

  assert.match(route, /createMarketplaceReviewRecord\(db/);
  assert.match(route, /submissionType: 'app'/);
  assert.match(route, /resourceId: app\.id/);
  assert.match(route, /appDeveloperId: developer\.id/);
  assert.match(route, /review_records: reviewRecords \|\| \[\]/);
  assert.match(route, /eventType: 'app\.submitted'/);
  assert.match(route, /review_id: reviewRecord\.id/);
  assert.match(route, /success\(\{ app, review_record: reviewRecord \}\)/);
});

test('theme uploads create a review record and include it in theme.submitted payloads', () => {
  const route = read(THEMES_ROUTE);

  assert.match(route, /createMarketplaceReviewRecord\(db/);
  assert.match(route, /submissionType: 'theme'/);
  assert.match(route, /resourceId: themePackageId/);
  assert.match(route, /source: 'platform-console\.theme_submission'/);
  assert.match(route, /reviewId: reviewRecord\.id/);
  assert.match(route, /\.\.\.\(input\.reviewId \? \{ review_id: input\.reviewId \} : \{\}\)/);
  assert.match(route, /success\(\{ \.\.\.uploadRecord, review_record: reviewRecord \}\)/);
});
