import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readAppStoreRouteSource } from '../helpers/app-store-route-source.mjs';

const SHARED_TYPES = 'packages/shared-types/src/index.ts';
const API_CLIENT = 'packages/typescript/api-client/src/index.ts';
const APP_MARKETPLACE_PACKAGE = 'apps/frozen/app-store/package.json';
const APP_MARKETPLACE_MANIFEST = 'apps/frozen/app-store/runtime.manifest.json';
const APP_MARKETPLACE_API_CLIENT = 'apps/frozen/app-store/src/lib/api/client.ts';
const APP_MARKETPLACE_DASHBOARD = 'apps/frozen/app-store/src/app/(auth)/developers/dashboard/page.tsx';
const APP_MARKETPLACE_HEADER = 'apps/frozen/app-store/src/components/Header.tsx';

function read(path) {
  return readFileSync(path, 'utf8');
}

test('shared types expose partner console analytics, payouts, stores, and access contracts', () => {
  const source = read(SHARED_TYPES);

  assert.match(source, /export const PartnerPayoutLedgerEntrySchema/);
  assert.match(source, /export const PartnerDevelopmentStoreSchema/);
  assert.match(source, /export const PartnerCollaboratorAccessSchema/);
  assert.match(source, /export const PartnerAnalyticsSchema/);
  assert.match(source, /export const PartnerDashboardSchema/);
  assert.match(source, /partner_gst_minor: z\.number\(\)\.int\(\)\.nonnegative\(\)/);
  assert.match(source, /payout_pending_minor: z\.number\(\)\.int\(\)\.nonnegative\(\)/);
  assert.match(source, /managed_stores: z\.array\(PartnerDevelopmentStoreSchema\)\.default\(\[\]\)/);
  assert.match(source, /export type PartnerDashboard = z\.infer<typeof PartnerDashboardSchema>/);
});

test('typed API client exposes the Partner API dashboard and collaborator code endpoints', () => {
  const source = read(API_CLIENT);

  assert.match(source, /PartnerDashboard/);
  assert.match(source, /partnerDashboard: \(options\?: LetbuyyRequestOptions\)/);
  assert.match(source, /'\/app-store\/partners\/dashboard'/);
  assert.match(source, /collaboratorCode: \(options\?: LetbuyyRequestOptions\)/);
  assert.match(source, /'\/app-store\/partners\/collaborator-code'/);
  assert.match(source, /PartnerDashboard\['collaborator_access'\]/);
});

test('gateway Partner API is RBAC gated and aggregates listings, payouts, stores, and analytics', () => {
  const source = readAppStoreRouteSource();

  assert.match(source, /import \{ requireRoleCategory \} from '.*middleware\/rbac'/);
  assert.match(source, /router\.get\('\/partners\/dashboard', authMiddleware, requireRoleCategory\('partner'\)/);
  assert.match(source, /router\.post\('\/partners\/collaborator-code', authMiddleware, requireRoleCategory\('partner'\)/);
  assert.match(source, /from\('app_developers'\)/);
  assert.match(source, /from\('marketplace_apps'\)/);
  assert.match(source, /from\('marketplace_review_records'\)/);
  assert.match(source, /from\('app_billing_charges'\)/);
  assert.match(source, /from\('partner_payout_ledger_entries'\)/);
  assert.match(source, /from\('app_installations'\)/);
  assert.match(source, /from\('site_memberships'\)/);
  assert.match(source, /const code = randomToken\('lbc', 24\)/);
  assert.match(source, /code_prefix: code\.slice\(0, 12\)/);
  assert.match(source, /code_hash: await sha256Hex\(code\)/);
  assert.match(source, /partner_gst_minor: sumMinor\(chargeRows, 'partner_gst_minor'\)/);
  assert.match(source, /payout_pending_minor: sumMinor/);
  assert.match(source, /development_stores: Array\.from\(developmentStoresById\.values\(\)\)/);
});

test('app marketplace partner console consumes only the typed gateway client', () => {
  const packageJson = read(APP_MARKETPLACE_PACKAGE);
  const manifest = read(APP_MARKETPLACE_MANIFEST);
  const client = read(APP_MARKETPLACE_API_CLIENT);
  const dashboard = read(APP_MARKETPLACE_DASHBOARD);
  const header = read(APP_MARKETPLACE_HEADER);

  assert.match(packageJson, /"@letbuyy\/api-client": "workspace:\*"/);
  assert.match(manifest, /"@letbuyy\/api-client"/);
  assert.match(client, /createLetbuyyApiClient/);
  assert.match(client, /createLetbuyyInternalSessionHeaders/);
  assert.doesNotMatch(client, /@supabase\//);

  assert.match(dashboard, /api\.appStore\.partnerDashboard\(\)/);
  assert.match(dashboard, /PartnerDashboard/);
  assert.match(dashboard, /Payout ledger/);
  assert.match(dashboard, /Collaborator access/);
  assert.match(dashboard, /Development stores/);
  assert.match(dashboard, /Managed access/);
  assert.match(dashboard, /GST on Earnings/);
  assert.match(dashboard, /Listings and review status/);
  assert.doesNotMatch(dashboard, /api\.appStore\.developerApps\(\)/);
  assert.doesNotMatch(dashboard, /@supabase\//);

  assert.match(header, /\/developers\/dashboard/);
  assert.match(header, /Partner Console/);
});
