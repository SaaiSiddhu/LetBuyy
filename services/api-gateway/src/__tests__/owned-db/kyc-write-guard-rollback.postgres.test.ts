import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';

const owned = requireOwnedDatabase();
const migration = readFileSync(new URL('../../../../../database/supabase/migrations/414_kyc_provider_decision_write_guard.sql', import.meta.url), 'utf8');
const rollback = readFileSync(new URL('../../../../../database/supabase/rollback/414_kyc_provider_decision_write_guard.rollback.sql', import.meta.url), 'utf8');
const privateMetadataMigration = readFileSync(new URL('../../../../../database/supabase/migrations/415_kyc_private_metadata_gateway_only.sql', import.meta.url), 'utf8');
const privateMetadataRollback = readFileSync(new URL('../../../../../database/supabase/rollback/415_kyc_private_metadata_gateway_only.rollback.sql', import.meta.url), 'utf8');

function apply(sql: string) {
    owned.script(sql);
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
        force_rls: true, read_policy: false, write_policy: false, guard_trigger: true,
    });
    apply(privateMetadataRollback);
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
    apply(privateMetadataMigration);
    assert.deepEqual(JSON.parse(guardShape()), {
        force_rls: true, read_policy: false, write_policy: false, guard_trigger: true,
    });
});
