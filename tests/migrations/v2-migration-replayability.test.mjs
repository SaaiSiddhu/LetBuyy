import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const legacyReplayabilityDebt = [
  '076_app_extension_registry.sql',
  '093_app_pricing_plans.sql',
  '095_app_usage_metering.sql',
  '096_app_spend_controls.sql',
  '097_app_uninstall_feedback.sql',
  '098_app_versions.sql',
];

const merchantMobileV2Migrations = [
  '114_mobile_onboarding_attempt_progress.sql',
  '115_product_review_merchant_replies.sql',
  '116_mobile_draft_orders.sql',
  '117_mobile_customer_notes_tags.sql',
  '118_mobile_shipping_labels.sql',
  '119_mobile_money_ledgers.sql',
  '120_mobile_kyc_documents.sql',
  '121_mobile_merchant_2fa_factors.sql',
  '122_mobile_business_profile.sql',
  '123_mobile_tax_rate_parity.sql',
  '129_mobile_customer_segments.sql',
  '130_orders_site_id_not_null.sql',
  '131_hot_table_partition_shadow_mirror.sql',
  '132_mobile_whatsapp_commerce.sql',
  '136_mobile_marketing_email_campaigns.sql',
  '137_mobile_storefront_localization.sql',
  '138_mobile_store_metafields.sql',
  '140_mobile_cod_reconciliation.sql',
  '158_order_items_tenant_scope.sql',
];

function read(path) {
  return readFileSync(path, 'utf8');
}

function stripSqlComments(sql) {
  return sql
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/--.*$/gm, '');
}

test('legacy non-replayable migrations are documented instead of edited in place', () => {
  const doc = read('docs/governance/migration-replayability.md');

  for (const fileName of legacyReplayabilityDebt) {
    assert.match(doc, new RegExp(`database/supabase/migrations/${fileName}`));
  }
  assert.match(doc, /Applied migration history is immutable/);
});

test('merchant-mobile V2 migrations use replayable create and additive alter patterns', () => {
  for (const fileName of merchantMobileV2Migrations) {
    const sql = stripSqlComments(read(join('database/supabase/migrations', fileName)));

    assert.doesNotMatch(sql, /\bCREATE\s+TABLE\s+(?!IF\s+NOT\s+EXISTS\b)/i, `${fileName}: CREATE TABLE must use IF NOT EXISTS`);
    assert.doesNotMatch(sql, /\bCREATE\s+(?:UNIQUE\s+)?INDEX\s+(?!IF\s+NOT\s+EXISTS\b)/i, `${fileName}: CREATE INDEX must use IF NOT EXISTS`);
    assert.doesNotMatch(sql, /\bALTER\s+TABLE\b[\s\S]*?\bADD\s+COLUMN\s+(?!IF\s+NOT\s+EXISTS\b)/i, `${fileName}: ADD COLUMN must use IF NOT EXISTS`);

    if (/\bCREATE\s+POLICY\b/i.test(sql)) {
      assert.match(sql, /\bDROP\s+POLICY\s+IF\s+EXISTS\b/i, `${fileName}: policies must be dropped before recreation`);
    }
    if (/\bCREATE\s+TRIGGER\b/i.test(sql)) {
      assert.match(sql, /\bDROP\s+TRIGGER\s+IF\s+EXISTS\b/i, `${fileName}: triggers must be dropped before recreation`);
    }
  }
});

test('migration-safety validator enforces the V2 replayability contract', () => {
  const validator = read('scripts/validators/migration-safety-validator.mjs');

  assert.match(validator, /merchantMobileV2Migrations/);
  assert.match(validator, /migration-replayability\.md/);
  assert.match(validator, /CREATE TABLE must use IF NOT EXISTS/);
  assert.match(validator, /ADD COLUMN must use IF NOT EXISTS/);
});
