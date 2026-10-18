import assert from 'node:assert/strict';
import test from 'node:test';
import { deriveTenantTablesFromMigrations } from '../../scripts/governance/tenant-registry-common.mjs';

test('literal and explicitly seeded partitions inherit final parent ownership columns',()=>{
    const entries=deriveTenantTablesFromMigrations([
        {file:'001_parent.sql',source:`CREATE TABLE public.synthetic_shadow (
            id uuid,
            store_id uuid,
            user_id uuid,
            created_at timestamptz
        ) PARTITION BY RANGE(created_at);
        CREATE TABLE public.synthetic_default PARTITION OF public.synthetic_shadow DEFAULT;
        SELECT public.upsert_retention_policy('synthetic','synthetic_shadow',30);
        SELECT public.ensure_monthly_hot_table_partition('synthetic',DATE '2026-06-15');`},
        {file:'002_scope.sql',source:'ALTER TABLE public.synthetic_shadow ADD COLUMN site_id uuid;'},
    ]);
    assert.deepEqual(entries.map(row=>row.table),['synthetic_default','synthetic_shadow','synthetic_shadow_2026_06']);
    for(const row of entries) {
        assert.deepEqual(row.scopeColumns,['site_id','store_id','user_id']);
        assert.equal(row.tenantColumn,'site_id');
        assert.ok(row.sourceFiles.includes('002_scope.sql'));
    }
});

test('a partition reference cannot invent a parent or silently bypass a missing shadow declaration',()=>{
    assert.throws(()=>deriveTenantTablesFromMigrations([{file:'bad.sql',source:'CREATE TABLE public.synthetic_child PARTITION OF public.missing_parent DEFAULT;'}]),/no declared parent/);
    assert.throws(()=>deriveTenantTablesFromMigrations([{file:'bad.sql',source:"SELECT public.ensure_monthly_hot_table_partition('undeclared',DATE '2026-06-01');"}]),/no declared retention shadow/);
});

test('comments and dynamic maintenance calls do not invent fixed partition names',()=>{
    assert.deepEqual(deriveTenantTablesFromMigrations([{file:'comments.sql',source:`
        -- CREATE TABLE public.synthetic_child PARTITION OF public.missing_parent DEFAULT;
        SELECT public.ensure_monthly_hot_table_partition('synthetic');
    `}]),[]);
});
