import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const migration = readFileSync(new URL('../../../../../database/supabase/migrations/419_kyc_private_metadata_gateway_only.sql', import.meta.url), 'utf8');
const rollback = readFileSync(new URL('../../../../../database/supabase/rollback/419_kyc_private_metadata_gateway_only.rollback.sql', import.meta.url), 'utf8');
const referenceLimitMigration = readFileSync(new URL('../../../../../database/supabase/migrations/421_kyc_last_four_reference_limit.sql', import.meta.url), 'utf8');
const referenceLimitRollback = readFileSync(new URL('../../../../../database/supabase/rollback/421_kyc_last_four_reference_limit.rollback.sql', import.meta.url), 'utf8');

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

test('KYC write and private metadata containment have one paired pre-use rollback and forward replay', () => {
    assert.deepEqual(JSON.parse(guardShape()), {
        force_rls: true, read_policy: false, write_policy: false, guard_trigger: true,
    });
    apply(rollback);
    assert.deepEqual(JSON.parse(guardShape()), {
        force_rls: false, read_policy: false, write_policy: true, guard_trigger: false,
    });
    apply(migration);
    assert.deepEqual(JSON.parse(guardShape()), {
        force_rls: true, read_policy: false, write_policy: false, guard_trigger: true,
    });
});

test('KYC four-character limit refuses overcollected history and replays after reviewed cleanup', () => {
    const tenant = newSyntheticTenant('kyc-last-four');
    seedSyntheticTenant(owned.psql, tenant);
    const rowId = randomUUID();
    apply(referenceLimitRollback);
    owned.psql(`INSERT INTO public.merchant_kyc_documents(id,site_id,document_type,document_number_last4)
        VALUES ('${rowId}','${tenant.siteId}','business_pan','12345');`);
    assert.match(owned.psqlExpectError(referenceLimitMigration), /KYC reference cleanup required/,
        'forward migration must not silently truncate overcollected history');
    assert.equal(owned.psql(`SELECT document_number_last4 FROM public.merchant_kyc_documents WHERE id='${rowId}';`), '12345');
    assert.match(owned.psql(`SELECT pg_get_constraintdef(oid) FROM pg_constraint
        WHERE conname='merchant_kyc_documents_last4_check'
          AND conrelid='public.merchant_kyc_documents'::regclass;`), /2,8/,
    'a failed forward migration retains the prior database constraint');
    // Synthetic fixture cleanup stands in for a separately reviewed privacy cutover.
    owned.psql(`UPDATE public.merchant_kyc_documents SET document_number_last4='2345' WHERE id='${rowId}';`);
    apply(referenceLimitMigration);
    assert.equal(owned.psql(`SELECT document_number_last4 FROM public.merchant_kyc_documents WHERE id='${rowId}';`), '2345');
    assert.match(owned.psqlExpectError(`UPDATE public.merchant_kyc_documents SET document_number_last4='12345' WHERE id='${rowId}';`),
        /merchant_kyc_documents_last4_check/);
});
