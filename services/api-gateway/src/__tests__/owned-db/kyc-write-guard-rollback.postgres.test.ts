import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';

const owned = requireOwnedDatabase();
const migration = readFileSync(new URL('../../../../../database/supabase/migrations/414_kyc_provider_decision_write_guard.sql', import.meta.url), 'utf8');
const rollback = readFileSync(new URL('../../../../../database/supabase/rollback/414_kyc_provider_decision_write_guard.rollback.sql', import.meta.url), 'utf8');

function apply(sql: string) {
    execFileSync('docker', [
        'exec', owned.container, 'psql', '-U', 'postgres', '-d', owned.database,
        '-v', 'ON_ERROR_STOP=1', '-q', '-c', sql,
    ], { encoding: 'utf8', timeout: 15_000 });
}

function guardShape() {
    return owned.psql(`SELECT json_build_object(
        'force_rls', c.relforcerowsecurity,
        'read_policy', EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='merchant_kyc_documents' AND policyname='merchant_kyc_documents_site_owner_select'),
        'write_policy', EXISTS(SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='merchant_kyc_documents' AND policyname='merchant_kyc_documents_site_owner_all'),
        'guard_trigger', EXISTS(SELECT 1 FROM pg_trigger WHERE tgrelid='public.merchant_kyc_documents'::regclass AND tgname='merchant_kyc_server_write_v1' AND NOT tgisinternal)
    ) FROM pg_class c WHERE c.oid='public.merchant_kyc_documents'::regclass;`);
}

test('KYC server-write containment has a paired pre-use rollback and forward replay', () => {
    assert.deepEqual(JSON.parse(guardShape()), {
        force_rls: true, read_policy: true, write_policy: false, guard_trigger: true,
    });
    apply(rollback);
    assert.deepEqual(JSON.parse(guardShape()), {
        force_rls: false, read_policy: false, write_policy: true, guard_trigger: false,
    });
    apply(migration);
    assert.deepEqual(JSON.parse(guardShape()), {
        force_rls: true, read_policy: true, write_policy: false, guard_trigger: true,
    });
});
