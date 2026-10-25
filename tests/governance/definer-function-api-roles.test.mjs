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

const loopSql=readFileSync(join(migrationsDir,'335_durable_loyalty_refund_recovery.sql'),'utf8');
const loopBlock=loopSql.match(/DO \$acl\$[\s\S]*?END \$acl\$;/)[0];
const loopResult=sql=>currentDefinerClosureOffenders([migration(335,sql)]);

test('finite literal signature loops earn closure from executable structure, independent of labels and spacing',()=>{
    assert.deepEqual(loopResult(loopSql),[]);
    assert.deepEqual(loopResult(loopSql.replaceAll('$acl$','$renamed_acl$')),[]);
    assert.deepEqual(loopResult(loopSql.replaceAll('||',' || ')),[]);
});

test('a finite closure must include the exact required signature and every ordinary API role',()=>{
    const required="'public.restore_loyalty_on_refund(uuid,uuid,uuid,text)',";
    const mutations=[
        loopSql.replace(required,''),
        loopSql.replace(required,"'public.unrelated(uuid,uuid,uuid,text)',"),
        loopSql.replace(required,"'public.restore_loyalty_on_refund(uuid,uuid,uuid,uuid)',"),
        loopSql.replace('FROM PUBLIC,anon,authenticated,app_tenant','FROM PUBLIC,authenticated,app_tenant'),
        loopSql.replace('FROM PUBLIC,anon,authenticated,app_tenant','FROM PUBLIC,anon,app_tenant'),
        loopSql.replace('FROM PUBLIC,anon,authenticated,app_tenant','FROM anon,authenticated,app_tenant'),
    ];
    for(const sql of mutations){assert.notEqual(sql,loopSql);assert.ok(loopResult(sql).some(n=>n.endsWith('public.restore_loyalty_on_refund')));}
});

test('conditional, reassigned, nonliteral or incomplete loops cannot supply closure',()=>{
    const mutations=[
        loopSql.replace("  EXECUTE 'REVOKE", "  IF false THEN EXECUTE 'REVOKE").replace("app_tenant';", "app_tenant'; END IF;"),
        loopSql.replace(" LOOP\n  EXECUTE", " LOOP\n  s := 'public.unrelated(uuid)';\n  EXECUTE"),
        loopSql.replace(/FOREACH s IN ARRAY ARRAY\[[\s\S]*?\] LOOP/,'FOREACH s IN ARRAY unknown_signatures LOOP'),
        loopSql.replace("EXECUTE 'REVOKE ALL ON FUNCTION '||s||' FROM PUBLIC,anon,authenticated,app_tenant';", "PERFORM 'REVOKE ALL ON FUNCTION public.restore_loyalty_on_refund(uuid,uuid,uuid,text) FROM PUBLIC,anon,authenticated';"),
        loopSql.replace("||s||' FROM", "||other_signature||' FROM"),
    ];
    for(const sql of mutations){assert.notEqual(sql,loopSql);assert.notDeepEqual(loopResult(sql),[]);}
});

test('loop closure is ordered after definitions, covers overloads and is invalidated by later dynamic grants',()=>{
    const beforeDefinition=loopBlock+'\n'+loopSql.replace(loopBlock,'');
    assert.notDeepEqual(loopResult(beforeDefinition),[]);
    const closed=migration(257,mint+close);
    const overload=mint.replace('p_site uuid','p_site text');
    assert.deepEqual(currentDefinerClosureOffenders([migration(257,mint+overload+close)]),['257_synthetic.sql: public.mint_things']);
    const loopGrant="DO $$ DECLARE s text; BEGIN FOREACH s IN ARRAY ARRAY['public.mint_things(uuid)'] LOOP EXECUTE 'GRANT EXECUTE ON FUNCTION '||s||' TO anon'; END LOOP; END $$;";
    assert.notDeepEqual(currentDefinerClosureOffenders([closed,migration(258,loopGrant)]),[]);
    const unbound="DO $$ DECLARE s text; BEGIN FOREACH s IN ARRAY unknown_signatures LOOP EXECUTE 'GRANT EXECUTE ON FUNCTION '||s||' TO service_role'; END LOOP; END $$;";
    assert.notDeepEqual(currentDefinerClosureOffenders([closed,migration(258,unbound)]),[]);
});

test('strings, comments and an unrelated function cannot impersonate closure or an executable definition',()=>{
    assert.deepEqual(definerFunctions(`SELECT '${mint.replaceAll("'","''")}';`),[]);
    assert.notDeepEqual(loopResult(loopSql.replace(loopBlock,loopBlock.split('\n').map(line=>'-- '+line).join('\n'))),[]);
    assert.deepEqual(currentDefinerClosureOffenders([migration(257,mint+"SELECT '"+close+"';")]),['257_synthetic.sql: public.mint_things']);
    const falseBinding="DO $$ DECLARE s text; BEGIN PERFORM 's text := ''public.other(uuid)'';'; EXECUTE 'GRANT EXECUTE ON FUNCTION '||s||' TO service_role'; END $$;";
    assert.notDeepEqual(currentDefinerClosureOffenders([migration(257,mint+close),migration(258,falseBinding)]),[]);
});

test('uncertain dynamic targets cannot borrow a literal binding after reassignment or a different loop',()=>{
    const closed=migration(257,mint+close);
    const dynamicBodies=[
        "DECLARE s text := 'public.other(uuid)'; BEGIN FOREACH s IN ARRAY unknown_signatures LOOP EXECUTE 'GRANT EXECUTE ON FUNCTION '||s||' TO service_role'; END LOOP; END",
        "DECLARE s text := 'public.other(uuid)'; v_other text; BEGIN SELECT 'x','public.mint_things(uuid)' INTO v_other,s; EXECUTE 'GRANT EXECUTE ON FUNCTION '||s||' TO service_role'; END",
        "DECLARE s text := 'public.other(uuid)'; BEGIN s='public.mint_things(uuid)'; EXECUTE 'GRANT EXECUTE ON FUNCTION '||s||' TO service_role'; END",
    ];
    for(const body of dynamicBodies)assert.notDeepEqual(currentDefinerClosureOffenders([closed,migration(258,`DO $$${body}$$;`)]),[]);
    const quoted=mint.replace('public.mint_things','public."Mint_things"');
    assert.notDeepEqual(currentDefinerClosureOffenders([migration(257,quoted+close)]),[]);
});

test('literal-escaped custom function configuration cannot reopen an ACL; raw interpolation can',()=>{
    const closed=migration(257,mint+close);
    const config="DO $$ BEGIN EXECUTE format('ALTER FUNCTION public.mint_things(uuid) SET letbuyy.birth=%L', binding::text); END $$;";
    assert.deepEqual(currentDefinerClosureOffenders([closed,migration(258,config)]),[]);
    for(const mutant of [config.replace('%L','%s'),config.replace('=%L',"=%L; GRANT EXECUTE ON FUNCTION public.mint_things(uuid) TO anon"),config.replace('binding::text)',"binding::text) || unsafe_sql")]) {
        assert.notDeepEqual(currentDefinerClosureOffenders([closed,migration(258,mutant)]),[]);
    }
});

test('finite table grant records cannot inject function grants or borrow a reassigned binding',()=>{
    const closed=migration(257,mint+close);
    const table="DO $$ DECLARE entry record; BEGIN FOR entry IN SELECT * FROM (VALUES ('public.employees','SELECT')) AS dependencies(signature,permission) LOOP EXECUTE format('GRANT %s ON TABLE %s TO service_role',entry.permission,entry.signature); END LOOP; END $$;";
    assert.deepEqual(currentDefinerClosureOffenders([closed,migration(258,table)]),[]);
    for(const mutant of [table.replace("'SELECT'","'SELECT; GRANT EXECUTE ON FUNCTION public.mint_things(uuid) TO anon; --'"),table.replace("'public.employees'","'public.employees; GRANT EXECUTE ON FUNCTION public.mint_things(uuid) TO anon; --'"),table.replace('LOOP EXECUTE',"LOOP entry.signature := unsafe_sql; EXECUTE"),table.replace('ON TABLE %s','ON FUNCTION %s')]) {
        assert.notDeepEqual(currentDefinerClosureOffenders([closed,migration(258,mutant)]),[]);
    }
});


test('catalog ACL bindings never reopen a closed function and forged bindings fail closed', () => {
    const source=readFileSync(join(migrationsDir,'388_cart_order_fact_snapshots.sql'),'utf8');
    const block=source.slice(source.indexOf('DO $close_cart_authority$'),source.indexOf('END $close_cart_authority$;')+'END $close_cart_authority$;'.length);
    const closed=migration(257,mint+close);
    assert.deepEqual(currentDefinerClosureOffenders([closed,migration(258,block)]),[]);
    const mutants=[
        block.replace("'FUNCTION '||p.oid::regprocedure::text", "'FUNCTION '||unsafe_target"),
        block.replace("'TABLE public.carts' target", "unsafe_target target"),
        block.replace("LOOP\n   IF obj.backend", "LOOP\n   obj.target := unsafe_target;\n   IF obj.backend"),
        block.replace('quote_ident(role_name)', 'role_name'),
        block.replace("ARRAY['INSERT','UPDATE','DELETE']", "unsafe_privileges"),
        block.replace("privilege_name:=grant_entry.privilege_type", "privilege_name:=unsafe_privilege"),
        block.replace('TO service_role', 'TO anon'),
    ];
    for(const mutant of mutants) {
        assert.notEqual(mutant,block);
        assert.notDeepEqual(currentDefinerClosureOffenders([closed,migration(258,mutant)]),[]);
    }
});

test('a literal dynamic replacement invalidates only its fixed target and cannot hide trailing SQL', () => {
    const closed=migration(257,mint+close);
    const literal="DO $outer$ BEGIN EXECUTE $ddl$CREATE OR REPLACE FUNCTION public.unrelated(p_site uuid) RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $fn$ BEGIN NULL; END; $fn$;$ddl$; END $outer$;";
    assert.deepEqual(currentDefinerClosureOffenders([closed,migration(258,literal)]),['258_synthetic.sql: public.unrelated']);
    assert.deepEqual(currentDefinerClosureOffenders([closed,migration(258,literal+' REVOKE ALL ON FUNCTION public.unrelated(uuid) FROM PUBLIC,anon,authenticated;')]),[]);
    assert.notDeepEqual(currentDefinerClosureOffenders([closed,migration(258,literal.replace('public.unrelated','public.mint_things'))]),[]);
    assert.notDeepEqual(currentDefinerClosureOffenders([closed,migration(258,literal.replace(';$ddl$', '; GRANT EXECUTE ON FUNCTION public.mint_things(uuid) TO anon;$ddl$'))]),[]);
});


test('fixed invoker body formatting cannot interpolate SQL or invoke an unknown formatter',()=>{
    const closed=migration(257,mint+close);
    const constructor="DO $$ BEGIN EXECUTE format('CREATE OR REPLACE FUNCTION public.unrelated() RETURNS event_trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path=pg_catalog,public AS %L', binding::text); END $$;";
    assert.deepEqual(currentDefinerClosureOffenders([closed,migration(258,constructor)]),[]);
    for(const mutant of [constructor.replace('%L','%s'),constructor.replace('SECURITY INVOKER','SECURITY DEFINER'),constructor.replace('AS %L','AS %L; GRANT EXECUTE ON FUNCTION public.mint_things(uuid) TO anon'),constructor.replace('binding::text','unsafe_sql()')]) {
        assert.notDeepEqual(currentDefinerClosureOffenders([closed,migration(258,mutant)]),[]);
    }
});
