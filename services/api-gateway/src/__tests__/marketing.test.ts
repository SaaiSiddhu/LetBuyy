import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const indexSource = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../routes/marketing.ts', import.meta.url), 'utf8');
const schemaSource = readFileSync(new URL('../schemas/marketing.schema.ts', import.meta.url), 'utf8');
const bffSource = readFileSync(new URL('../../../mobile-bff/src/index.ts', import.meta.url), 'utf8');
const migrationSource = readFileSync(
    new URL('../../../../database/supabase/migrations/136_mobile_marketing_email_campaigns.sql', import.meta.url),
    'utf8',
);
const tsClientSource = readFileSync(
    new URL('../../../../packages/typescript/api-client/src/index.ts', import.meta.url),
    'utf8',
);
const dartClientSource = readFileSync(
    new URL('../../../../packages/dart/api_client/lib/src/api_client.dart', import.meta.url),
    'utf8',
);
const mobileServiceSource = readFileSync(
    new URL('../../../../apps/merchant_app/lib/services/marketing_service.dart', import.meta.url),
    'utf8',
);
const mobileScreenSource = readFileSync(
    new URL('../../../../apps/merchant_app/lib/screens/marketing/email_campaigns_screen.dart', import.meta.url),
    'utf8',
);
const mobileRoutesSource = readFileSync(
    new URL('../../../../apps/merchant_app/lib/app/routes.dart', import.meta.url),
    'utf8',
);

test('marketing email route is mounted, protected, and mobile allowlisted', () => {
    assert.match(indexSource, /import marketingRouter from '\.\/routes\/marketing'/);
    assert.match(indexSource, /api\.route\('\/marketing', marketingRouter\)/);
    assert.match(bffSource, /'\/v1\/marketing'/);
    assert.match(routeSource, /router\.get\('\/email-campaigns'/);
    assert.match(routeSource, /router\.post\('\/email-campaigns\/audience-preview'/);
    assert.match(routeSource, /router\.post\('\/email-campaigns'/);
    assert.match(routeSource, /router\.post\('\/email-campaigns\/:id\/send'/);
    assert.match(routeSource, /verifyStoreOwnership/);
    assert.match(routeSource, /sendResendEmail/);
    assert.match(routeSource, /configuredValue\(c\.env\.RESEND_API_KEY\)/);
    assert.match(routeSource, /'sandbox_sent'/);
    assert.doesNotMatch(routeSource, /SKIP_NEEDS_HUMAN/);
});

test('marketing schemas validate explicit campaign and send inputs', () => {
    assert.match(schemaSource, /CreateEmailCampaignSchema/);
    assert.match(schemaSource, /PreviewEmailCampaignAudienceSchema/);
    assert.match(schemaSource, /SendEmailCampaignSchema/);
    assert.match(schemaSource, /idempotency_key/);
    assert.match(schemaSource, /MarketingEmailAudienceSchema/);
});

test('marketing campaign migration is tenant-scoped with RLS and delivery evidence', () => {
    assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.marketing_email_campaigns/);
    assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.marketing_email_recipients/);
    assert.match(migrationSource, /store_id uuid NOT NULL REFERENCES public\.sites\(id\)/);
    assert.match(migrationSource, /last_send_idempotency_key text/);
    assert.match(migrationSource, /idx_marketing_email_campaigns_store_send_idempotency/);
    assert.match(migrationSource, /ALTER TABLE public\.marketing_email_campaigns ENABLE ROW LEVEL SECURITY/);
    assert.match(migrationSource, /ALTER TABLE public\.marketing_email_recipients ENABLE ROW LEVEL SECURITY/);
    assert.match(migrationSource, /FOR ALL TO service_role/);
    assert.match(migrationSource, /FOR ALL TO authenticated/);
    assert.match(migrationSource, /EXECUTE FUNCTION public\.update_updated_at\(\)/);
});

test('TS and Dart clients expose email campaign methods', () => {
    assert.match(tsClientSource, /readonly marketing = \{/);
    assert.match(tsClientSource, /emailCampaigns/);
    assert.match(tsClientSource, /previewAudience/);
    assert.match(tsClientSource, /\/marketing\/email-campaigns/);
    assert.match(dartClientSource, /late final MarketingApi marketing/);
    assert.match(dartClientSource, /class EmailCampaignsApi/);
    assert.match(dartClientSource, /previewAudience/);
    assert.match(dartClientSource, /\/marketing\/email-campaigns/);
});

test('mobile campaign UI is routed and hides provider internals', () => {
    assert.match(mobileServiceSource, /class MarketingService/);
    assert.match(mobileServiceSource, /_api\.marketing\.emailCampaigns\.list/);
    assert.match(mobileServiceSource, /_api\.marketing\.emailCampaigns\.create/);
    assert.match(mobileServiceSource, /_api\.marketing\.emailCampaigns\.send/);
    assert.match(mobileScreenSource, /Email Campaigns/);
    assert.match(mobileScreenSource, /Subscribed customers/);
    assert.match(mobileScreenSource, /Campaign sent in sandbox/);
    assert.match(mobileRoutesSource, /features\/email-campaigns/);
    assert.doesNotMatch(mobileScreenSource, /Resend/);
    assert.doesNotMatch(mobileScreenSource, /SKIP_NEEDS_HUMAN/);
});
