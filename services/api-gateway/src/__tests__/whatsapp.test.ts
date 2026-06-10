import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { createWhatsAppCommerceAdapter } from '@letbuyy/infrastructure/whatsapp-commerce-adapter';

const indexSource = readFileSync(new URL('../index.ts', import.meta.url), 'utf8');
const routeSource = readFileSync(new URL('../routes/whatsapp.ts', import.meta.url), 'utf8');
const bffSource = readFileSync(new URL('../../../mobile-bff/src/index.ts', import.meta.url), 'utf8');
const wranglerSource = readFileSync(new URL('../../wrangler.toml', import.meta.url), 'utf8');
const migrationSource = readFileSync(
    new URL('../../../../database/supabase/migrations/132_mobile_whatsapp_commerce.sql', import.meta.url),
    'utf8',
);
const task012MigrationSource = readFileSync(
    new URL('../../../../database/supabase/migrations/150_executable_whatsapp_scoped.sql', import.meta.url),
    'utf8',
);
const task012RollbackSource = readFileSync(
    new URL('../../../../database/supabase/rollback/150_executable_whatsapp_scoped.rollback.sql', import.meta.url),
    'utf8',
);
const notificationCoreSource = readFileSync(
    new URL('../../../../packages/notification-core/src/index.ts', import.meta.url),
    'utf8',
);
const queueWorkerSource = readFileSync(
    new URL('../../../../services/queue-workers/src/platform-queue-consumer.ts', import.meta.url),
    'utf8',
);
const skippedHumanSource = readFileSync(
    new URL('../../../../SKIPPED_HUMAN_DECISIONS.md', import.meta.url),
    'utf8',
);
const mobileServiceSource = readFileSync(
    new URL('../../../../apps/mobile/merchant-app/lib/services/whatsapp_service.dart', import.meta.url),
    'utf8',
);
const customerDetailSource = readFileSync(
    new URL('../../../../apps/mobile/merchant-app/lib/screens/customers/customer_detail_screen.dart', import.meta.url),
    'utf8',
);

test('merchant WhatsApp route is mounted, inbound is public-signed, and mobile BFF is allowlisted', () => {
    assert.match(indexSource, /import whatsappRouter, \{ whatsappInboundRouter \} from '\.\/routes\/whatsapp'/);
    assert.match(indexSource, /api\.route\('\/whatsapp\/inbound', whatsappInboundRouter\)/);
    assert.match(indexSource, /api\.route\('\/whatsapp', whatsappRouter\)/);
    assert.match(bffSource, /'\/v1\/whatsapp'/);
    assert.match(routeSource, /router\.get\('\/status'/);
    assert.match(routeSource, /router\.get\('\/templates'/);
    assert.match(routeSource, /router\.get\('\/timeline'/);
    assert.match(routeSource, /router\.post\('\/send'/);
    assert.match(routeSource, /whatsappInboundRouter\.post\('\/'/);
    assert.match(routeSource, /requireWhatsAppWebhookSignature/);
    assert.match(routeSource, /verifyStoreOwnership/);
});

test('WhatsApp adapter supports sandbox sends and live Twilio credential gating', async () => {
    const sandboxAdapter = createWhatsAppCommerceAdapter({
        mode: 'sandbox',
        provider: 'letbuyy_sandbox',
    });
    const sandboxSend = await sandboxAdapter.sendTemplate({
        storeId: 'store_1',
        toPhone: '+919999999999',
        template: 'order_update',
        variables: { order_number: 'LB-1', status: 'shipped', total: 'INR 499' },
    });

    assert.equal(sandboxAdapter.available, true);
    assert.equal(sandboxSend.providerMode, 'sandbox');
    assert.equal(sandboxSend.status, 'queued');
    assert.match(sandboxSend.body, /Order LB-1 is shipped/);

    const liveAdapter = createWhatsAppCommerceAdapter({
        mode: 'live',
        provider: 'twilio',
        accountSid: 'SKIP_NEEDS_HUMAN_TWILIO_ACCOUNT_SID',
        authToken: 'SKIP_NEEDS_HUMAN_TWILIO_AUTH_TOKEN',
        from: 'SKIP_NEEDS_HUMAN_TWILIO_WHATSAPP_FROM',
        environment: 'production',
    });

    assert.equal(liveAdapter.available, false);
    assert.match(liveAdapter.unavailableReason || '', /provider credentials/);
});

test('WhatsApp timeline migration is tenant-scoped with RLS and approved trigger', () => {
    assert.match(migrationSource, /CREATE TABLE IF NOT EXISTS public\.customer_whatsapp_messages/);
    assert.match(migrationSource, /store_id uuid NOT NULL REFERENCES public\.sites\(id\)/);
    assert.match(migrationSource, /CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_whatsapp_messages_store_idempotency/);
    assert.match(migrationSource, /ALTER TABLE public\.customer_whatsapp_messages ENABLE ROW LEVEL SECURITY/);
    assert.match(migrationSource, /FOR ALL TO service_role/);
    assert.match(migrationSource, /FOR ALL TO authenticated/);
    assert.match(migrationSource, /EXECUTE FUNCTION public\.update_updated_at\(\)/);
});

test('WhatsApp config is sandbox-first and production human-gated', () => {
    assert.match(wranglerSource, /WHATSAPP_PROVIDER_MODE = "sandbox"/);
    assert.match(wranglerSource, /WHATSAPP_PROVIDER = "letbuyy_sandbox"/);
    assert.match(wranglerSource, /WHATSAPP_PROVIDER_MODE = "live"/);
    assert.match(wranglerSource, /WHATSAPP_PROVIDER = "twilio"/);
    assert.match(wranglerSource, /TWILIO_ACCOUNT_SID = "SKIP_NEEDS_HUMAN_TWILIO_ACCOUNT_SID"/);
    assert.match(wranglerSource, /TWILIO_WHATSAPP_FROM = "SKIP_NEEDS_HUMAN_TWILIO_WHATSAPP_FROM"/);
});

test('mobile customer detail uses the WhatsApp service and hides provider internals', () => {
    assert.match(mobileServiceSource, /class WhatsAppService/);
    assert.match(mobileServiceSource, /_api\.whatsapp\.status/);
    assert.match(mobileServiceSource, /_api\.whatsapp\.timeline/);
    assert.match(mobileServiceSource, /_api\.whatsapp\.send/);
    assert.match(customerDetailSource, /WhatsApp customer/);
    assert.match(customerDetailSource, /_whatsAppTimeline/);
    assert.doesNotMatch(customerDetailSource, /SKIP_NEEDS_HUMAN/);
    assert.doesNotMatch(customerDetailSource, /Twilio/);
});

test('Task 012 scoped WhatsApp lifecycle, consent, COD, and V1 /wa aliases are implemented without full commerce', () => {
    assert.match(indexSource, /api\.route\('\/wa\/webhook', whatsappInboundRouter\)/);
    assert.match(indexSource, /api\.route\('\/wa', whatsappRouter\)/);
    assert.match(routeSource, /router\.post\('\/optins',\s*validate\('json',\s*WhatsAppOptInSchema\)/);
    assert.match(routeSource, /hasActiveWhatsAppOptIn/);
    assert.match(routeSource, /WA_CONSENT_REQUIRED/);
    assert.match(routeSource, /mirrorWhatsAppMessage/);
    assert.match(routeSource, /upsertWaSession/);
    assert.match(routeSource, /wa\.message_received/);
    assert.match(routeSource, /wa\.cod_confirmed/);
    assert.match(routeSource, /provider_message_id'[\s\S]*direction', 'inbound'/);
    assert.match(routeSource, /isAffirmativeCodReply/);
    assert.match(routeSource, /cod_confirmation/);
    assert.doesNotMatch(routeSource, /catalog sync/i);
    assert.doesNotMatch(routeSource, /support inbox/i);
    assert.doesNotMatch(routeSource, /NLU|openai|model/i);

    assert.match(task012MigrationSource, /CREATE TABLE IF NOT EXISTS public\.wa_templates/);
    assert.match(task012MigrationSource, /CREATE TABLE IF NOT EXISTS public\.wa_sessions/);
    assert.match(task012MigrationSource, /CREATE TABLE IF NOT EXISTS public\.wa_optins/);
    assert.match(task012MigrationSource, /CREATE TABLE IF NOT EXISTS public\.whatsapp_messages/);
    assert.match(task012MigrationSource, /ALTER TABLE public\.whatsapp_messages FORCE ROW LEVEL SECURITY/);
    assert.match(task012MigrationSource, /ALTER TABLE public\.customer_whatsapp_messages FORCE ROW LEVEL SECURITY/);
    assert.match(task012MigrationSource, /public\.current_site_id\(\)/);
    assert.doesNotMatch(task012MigrationSource, /PARTITION BY/i);
    assert.match(task012RollbackSource, /DROP TABLE IF EXISTS public\.whatsapp_messages/);
    assert.match(task012RollbackSource, /DROP TABLE IF EXISTS public\.wa_optins/);
});

test('D10 WhatsApp lifecycle and COD notifications are outbox-planned, consent-gated, and sandbox-badged', () => {
    assert.match(notificationCoreSource, /planWhatsAppNotificationForEvent/);
    assert.match(notificationCoreSource, /case 'order\.paid'[\s\S]*template_key: 'order_paid'/);
    assert.match(notificationCoreSource, /case 'order\.fulfilled'[\s\S]*template_key: 'order_shipped'/);
    assert.match(notificationCoreSource, /case 'order\.delivered'[\s\S]*template_key: 'order_delivered'/);
    assert.match(notificationCoreSource, /case 'cod\.confirmation_requested'[\s\S]*template_key: 'cod_confirmation'/);
    assert.match(notificationCoreSource, /fail_closed_without_consent: true/);

    assert.match(queueWorkerSource, /planWhatsAppNotificationForEvent/);
    assert.match(queueWorkerSource, /processWhatsAppSideEffect/);
    assert.match(queueWorkerSource, /\.from\('wa_optins'\)/);
    assert.match(queueWorkerSource, /WA_CONSENT_REQUIRED/);
    assert.match(queueWorkerSource, /\.from\('customer_whatsapp_messages'\)/);
    assert.match(queueWorkerSource, /\.from\('whatsapp_messages'\)/);
    assert.match(queueWorkerSource, /\.from\('wa_sessions'\)/);
    assert.match(queueWorkerSource, /\.from\('notification_logs'\)/);
    assert.match(queueWorkerSource, /sandbox_send/);
    assert.doesNotMatch(queueWorkerSource, /mock_send/);
    assert.match(queueWorkerSource, /bsp_template_approval/);
    assert.match(queueWorkerSource, /letbuyy_sandbox/);
    assert.match(queueWorkerSource, /expireDueCodConfirmations/);
    assert.match(queueWorkerSource, /\.lte\('expires_at', now\)/);
    assert.match(queueWorkerSource, /cod_confirmation_status: 'expired'/);
    assert.match(queueWorkerSource, /status: 'cancelled'/);

    assert.doesNotMatch(routeSource, /return \{ optedIn: true, error: null \}/);
    assert.match(skippedHumanSource, /SKIP-D10-WHATSAPP-BSP-WABA-HSM/);
});
