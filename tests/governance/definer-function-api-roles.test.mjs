// APPID-SEC1 — every SECURITY DEFINER function a migration creates after 256 revokes EXECUTE from
// PUBLIC, anon and authenticated BY NAME.
//
// WHY. A new function is executable by PUBLIC (PostgreSQL's default) and, under Supabase's default
// privileges, by anon and authenticated through named grants. A SECURITY DEFINER function runs as its
// owner and usually takes the ids it acts on as parameters, trusting its caller: exactly what the Data
// API must never reach. Migration 256 closed the 158 that were open and removed the named default grant;
// PostgreSQL's grant to PUBLIC cannot be removed per schema, so this ratchet makes each new definer
// function close itself. tests/executable/definer-function-api-roles-postgres.test.mjs proves the
// behaviour on a real database; this file stops the next migration from reopening it.

import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const migrationsDir = join(repoRoot, 'database/supabase/migrations');
const RATCHET_FROM_EXCLUSIVE = 256;

const number = (name) => parseInt(name, 10);
import { definerFunctions, revokedRoles, offenders, currentDefinerClosureOffenders } from '../../scripts/governance/definer-role-closure.mjs';
export { definerFunctions, revokedRoles, offenders };

test('the check sees definer functions, and 255 (which revokes by name) passes it', () => {
    const sql255 = readFileSync(join(migrationsDir, '255_buyer_verified_ownership_links.sql'), 'utf8');
    const found = definerFunctions(sql255);
    for (const name of ['link_buyer_store_customer', 'claim_buyer_orders', 'request_order_return']) {
        assert.ok(found.includes(name), `${name} must be detected as SECURITY DEFINER`);
    }
    assert.ok(!found.includes('buyer_accounts_stamp_email_verified_at'), 'an invoker trigger function is not a definer function');
    assert.deepEqual(offenders(sql255), []);
});

test('a definer function closed only to PUBLIC is an offender', () => {
    const synthetic = `
      CREATE OR REPLACE FUNCTION public.mint_things(p_site uuid) RETURNS void
      LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$ BEGIN NULL; END; $$;
      REVOKE ALL ON FUNCTION public.mint_things(uuid) FROM PUBLIC;
      GRANT EXECUTE ON FUNCTION public.mint_things(uuid) TO service_role;`;
    assert.deepEqual(offenders(synthetic), ['mint_things']);
    assert.deepEqual(offenders(`${synthetic}\nREVOKE ALL ON FUNCTION public.mint_things(uuid) FROM anon, authenticated;`), []);
});

test('every current post-256 definer is closed by name after its latest definition', () => {
    const migrations=readdirSync(migrationsDir).filter(n=>n.endsWith('.sql'))
        .map(name=>({name,number:number(name),sql:readFileSync(join(migrationsDir,name),'utf8')}));
    assert.deepEqual(currentDefinerClosureOffenders(migrations),[],
        'A forward correction may close immutable history, but every current definer needs named closure after its latest definition; a later grant reopens the failure. Actual signatures/roles are also proved in the full-chain owned lane.');
});

const mint=`CREATE OR REPLACE FUNCTION public.mint_things(p_site uuid) RETURNS void
 LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$ BEGIN NULL; END; $$;`;
const close='REVOKE ALL ON FUNCTION public.mint_things(uuid) FROM PUBLIC, anon, authenticated;';
const migration=(number,sql)=>({number,name:`${number}_synthetic.sql`,sql});

test('ordered closure accepts a later forward repair without rewriting the original definition',()=>{
    const original=migration(257,mint+' REVOKE ALL ON FUNCTION public.mint_things(uuid) FROM PUBLIC;');
    assert.deepEqual(currentDefinerClosureOffenders([original]),['257_synthetic.sql: public.mint_things']);
    assert.deepEqual(currentDefinerClosureOffenders([original,migration(258,close)]),[]);
});

test('a later replacement cannot borrow a closure that preceded its definition',()=>{
    assert.deepEqual(currentDefinerClosureOffenders([migration(257,mint+close),migration(258,mint)]),
        ['258_synthetic.sql: public.mint_things']);
});

test('direct or dynamic late grants reopen closure; backend-only grants do not',()=>{
    const closed=migration(257,mint+close);
    assert.deepEqual(currentDefinerClosureOffenders([closed,migration(258,'GRANT EXECUTE ON FUNCTION public.mint_things(uuid) TO anon;')]),
        ['257_synthetic.sql: public.mint_things']);
    assert.deepEqual(currentDefinerClosureOffenders([closed,migration(258,'GRANT EXECUTE ON FUNCTION public.mint_things(uuid) TO service_role;')]),[]);
    const dynamic="DO $$ BEGIN EXECUTE format('GRANT EXECUTE ON FUNCTION public.mint_things(uuid) TO %I', v_role); END $$;";
    assert.deepEqual(currentDefinerClosureOffenders([closed,migration(258,dynamic)]),['257_synthetic.sql: public.mint_things']);
    assert.deepEqual(currentDefinerClosureOffenders([closed,migration(258,dynamic),migration(259,close)]),[]);
});

test('a commented closure is not evidence and the original ratchet still starts at 256',()=>{
    assert.deepEqual(currentDefinerClosureOffenders([migration(257,mint+' -- '+close)]),['257_synthetic.sql: public.mint_things']);
    assert.deepEqual(currentDefinerClosureOffenders([migration(256,mint)]),[]);
});

test('grouped function privileges close every named function and a grouped late grant reopens each',()=>{
    const second=mint.replace('mint_things','mint_other');
    const grouped='REVOKE ALL ON FUNCTION public.mint_other(uuid),public.mint_things(uuid) FROM PUBLIC,anon,authenticated;';
    const closed=migration(257,mint+second+grouped);
    assert.deepEqual(offenders(closed.sql),[]);
    assert.deepEqual(currentDefinerClosureOffenders([closed]),[]);
    assert.deepEqual(currentDefinerClosureOffenders([closed,migration(258,
        'GRANT EXECUTE ON FUNCTION public.mint_other(uuid),public.mint_things(uuid) TO authenticated;')]),
        ['257_synthetic.sql: public.mint_other','257_synthetic.sql: public.mint_things']);
    assert.deepEqual(currentDefinerClosureOffenders([migration(257,mint+second+grouped.replace('public.mint_things(uuid)','public.unrelated(uuid)'))]),
        ['257_synthetic.sql: public.mint_things']);
});
