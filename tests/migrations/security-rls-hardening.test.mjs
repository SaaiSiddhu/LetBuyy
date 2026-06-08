import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const testDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testDir, '../..');

function read(relativePath) {
  const absolutePath = join(repoRoot, relativePath);
  assert.equal(existsSync(absolutePath), true, `${relativePath} must exist`);
  return readFileSync(absolutePath, 'utf8');
}

function normalized(sql) {
  return sql.replace(/\s+/g, ' ');
}

test('migration 107 re-scopes sensitive service policies away from anon/authenticated roles', () => {
  const migration = normalized(read('database/supabase/migrations/107_security_rls_hardening_and_payment_uniqueness.sql'));
  const sensitivePolicies = [
    ['devices', '"Service role full access"'],
    ['sessions', '"Service role full access"'],
    ['users_custom', '"Service role full access"'],
    ['verification_tokens', '"Service role full access"'],
    ['customer_credentials', '"Service role manages customer credentials"'],
  ];

  for (const [table, policy] of sensitivePolicies) {
    assert.match(
      migration,
      new RegExp(`DROP POLICY IF EXISTS ${policy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} ON public\\.${table};`, 'i'),
      `${table} must drop the vulnerable baseline policy`,
    );
    assert.match(
      migration,
      new RegExp(`CREATE POLICY ${policy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} ON public\\.${table} FOR ALL TO service_role USING \\(true\\) WITH CHECK \\(true\\);`, 'i'),
      `${table} must recreate the policy for service_role only`,
    );
    assert.doesNotMatch(
      migration,
      new RegExp(`CREATE POLICY ${policy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} ON public\\.${table} (?!FOR ALL TO service_role).*USING \\(true\\)`, 'i'),
      `${table} must not recreate a public permissive service policy`,
    );
  }
});

test('migration 107 replaces broad own-row policies with owner-scoped predicates', () => {
  const migration = normalized(read('database/supabase/migrations/107_security_rls_hardening_and_payment_uniqueness.sql'));

  assert.match(migration, /DROP POLICY IF EXISTS "System can insert notifications" ON public\.notifications;/i);
  assert.match(migration, /CREATE POLICY "Service role inserts notifications" ON public\.notifications FOR INSERT TO service_role WITH CHECK \(true\);/i);
  assert.match(migration, /CREATE POLICY "Users view own notifications" ON public\.notifications FOR SELECT USING \(user_id = auth\.uid\(\)\);/i);
  assert.match(migration, /CREATE POLICY "Users update own notifications" ON public\.notifications FOR UPDATE USING \(user_id = auth\.uid\(\)\) WITH CHECK \(user_id = auth\.uid\(\)\);/i);
  assert.match(migration, /CREATE POLICY "Users delete own notifications" ON public\.notifications FOR DELETE USING \(user_id = auth\.uid\(\)\);/i);
  assert.match(migration, /CREATE POLICY "Users manage own theme reviews" ON public\.theme_reviews FOR ALL USING \(user_id = auth\.uid\(\)\) WITH CHECK \(user_id = auth\.uid\(\)\);/i);
  assert.match(migration, /DROP POLICY IF EXISTS "Users manage their notification preferences" ON public\.notification_preferences;/i);
  assert.match(migration, /DROP POLICY IF EXISTS users_own_notifications ON public\.notification_preferences;/i);
  assert.match(migration, /CREATE POLICY users_own_notification_preferences ON public\.notification_preferences FOR ALL USING \(user_id = auth\.uid\(\)\) WITH CHECK \(user_id = auth\.uid\(\)\);/i);

  assert.doesNotMatch(migration, /CREATE POLICY "Users view own notifications" ON public\.notifications FOR SELECT USING \(true\)/i);
  assert.doesNotMatch(migration, /CREATE POLICY "Users update own notifications" ON public\.notifications FOR UPDATE USING \(true\)/i);
  assert.doesNotMatch(migration, /CREATE POLICY "Users delete own notifications" ON public\.notifications FOR DELETE USING \(true\)/i);
  assert.doesNotMatch(migration, /CREATE POLICY "Users manage own theme reviews" ON public\.theme_reviews USING \(true\)/i);
  assert.doesNotMatch(migration, /CREATE POLICY "Users manage their notification preferences" ON public\.notification_preferences USING \(true\)/i);
});

test('migration 107 enables RLS for previously uncovered tenant tables and adds the anti-replay payment index', () => {
  const migration = normalized(read('database/supabase/migrations/107_security_rls_hardening_and_payment_uniqueness.sql'));

  for (const table of ['contacts', 'projects']) {
    assert.match(migration, new RegExp(`ALTER TABLE public\\.${table} ENABLE ROW LEVEL SECURITY;`, 'i'));
    assert.match(migration, new RegExp(`CREATE POLICY ${table}_service_all ON public\\.${table} FOR ALL TO service_role USING \\(true\\) WITH CHECK \\(true\\);`, 'i'));
    assert.match(migration, new RegExp(`CREATE POLICY ${table}_owner_all ON public\\.${table} FOR ALL USING`, 'i'));
    assert.match(migration, new RegExp(`${table === 'contacts' ? 'site_id|store_id' : 'site_id|store_id'}`, 'i'));
  }

  assert.match(migration, /ALTER TABLE public\.employee_permissions ENABLE ROW LEVEL SECURITY;/i);
  assert.match(migration, /CREATE POLICY employee_permissions_service_write ON public\.employee_permissions FOR ALL TO service_role USING \(true\) WITH CHECK \(true\);/i);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_transactions_provider_payment_global ON public\.payment_transactions \(gateway, provider_payment_id\) WHERE provider_payment_id IS NOT NULL AND deleted_at IS NULL;/i);
});

test('migration 107 ships an executable RLS verification query for local and production operators', () => {
  const verification = read('database/supabase/verification/107_security_rls_hardening_and_payment_uniqueness.sql');

  assert.match(verification, /pg_policies/);
  assert.match(verification, /array_length\(p\.roles, 1\) <> 1/);
  assert.match(verification, /'service_role' = ANY \(p\.roles\)/);
  assert.match(verification, /LIKE '%user_id = auth\.uid\(\)%'/);
  assert.match(verification, /forbidden public\/anon\/authenticated permissive policies/);
  assert.match(verification, /idx_payment_transactions_provider_payment_global/);
});
