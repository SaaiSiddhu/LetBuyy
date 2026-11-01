// F-ROLLBACK-1 (CAP-C65) — the cheap, always-on half of the guard.
//
// The executable suite proves the real behaviour against Postgres: every affected rollback refuses
// at head, still applies at its own migration, and reproduces the defect when the precondition is
// stripped. It needs a database. This file needs nothing, so it runs in the gate on every change and
// catches the realistic accident — someone adding a rollback that restores a function with a stale
// parameter list, or deleting a precondition from one that has one.
//
// WHY `create_checkout_order` IS NAMED EXPLICITLY
// It is the only function in the schema with this exposure — measured, not assumed: a sweep of every
// rollback against the live signature of all 201 public functions found no other. Naming it means
// deleting a precondition fails here by name rather than silently reducing a count.

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { sqlTokens, tokenText } from '../../scripts/governance/definer-role-closure.mjs';
import { guardedRestorations, rollbackSignatureGuards, droppedRestorations } from '../../scripts/governance/rollback-signature-guards.mjs';

const rollbackDir = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'database/supabase/rollback');

// Every rollback that restores create_checkout_order. All six carry a signature precondition; the
// list is explicit so that removing a file, or a precondition, is a named failure.
const GUARDED = [
    '202_narrow_checkout_order_payment_method.rollback.sql',
    '206_checkout_order_idempotency_advisory_lock.rollback.sql',
    '213_checkout_order_gst_place_of_supply_and_tax_lines.rollback.sql',
    '215_fix_gift_card_digest_search_path.rollback.sql',
    '218_restore_checkout_idempotency_advisory_lock.rollback.sql',
    '219_purchase_parent_child_orders.rollback.sql',
];

// Rollbacks written after this phase are held to the forward rule below. Earlier files are covered
// by the explicit list above; raising this number is not a fix.
const RATCHET_FROM_EXCLUSIVE = 245;
// These use the stronger finite typed-ABI guard checked by guardedRestorations.
const PROFILE_GUARDED = [
    '388_cart_order_fact_snapshots.rollback.sql',
    '411_authoritative_checkout_gst.rollback.sql',
];

const CANDIDATE_GUARDED = [280,285,288,291,293,294,296,303,305,411];

const rollbackFiles = () => readdirSync(rollbackDir).filter((n) => n.endsWith('.sql')).sort();
const read = (name) => readFileSync(join(rollbackDir, name), 'utf8');
const number = (name) => parseInt(name.match(/^(\d+)/)?.[1] ?? '-1', 10);

function createdFunctions(sql) {
    return [...sql.matchAll(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.([a-z0-9_]+)\s*\(/gi)]
        .map((m) => m[1]);
}

test('every rollback that restores create_checkout_order carries a signature precondition', () => {
    const missing = GUARDED.filter((name) => !read(name).includes('$rollback_precondition$'));
    assert.deepEqual(
        missing,
        [],
        'CREATE OR REPLACE with a different parameter list ADDS an overload instead of replacing, ' +
        'after which every create_checkout_order call fails "is not unique" and checkout is down. ' +
        'The precondition is what turns that into a refusal.',
    );
});

test('the guarded list is complete — no other rollback restores create_checkout_order unguarded', () => {
    const unguarded = rollbackFiles().filter((name) =>
        createdFunctions(read(name)).includes('create_checkout_order') && !GUARDED.includes(name) && !PROFILE_GUARDED.includes(name));
    assert.deepEqual(unguarded, [], 'add the signature precondition and list the file in GUARDED');
});

test('every listed file exists, so the list cannot decay into fiction', () => {
    const present = new Set(rollbackFiles());
    assert.deepEqual(GUARDED.filter((n) => !present.has(n)), [], 'a renamed or deleted rollback must leave this list');
});

test('a precondition must actually compare a signature, not merely exist', () => {
    // A block that raises nothing, or compares nothing, would satisfy the substring check above.
    for (const name of GUARDED) {
        const sql = read(name);
        assert.match(sql, /v_expected text\[\] := ARRAY\[/, `${name}: must declare the signature it expects`);
        assert.match(sql, /v_names IS DISTINCT FROM v_expected/, `${name}: must compare live against expected`);
        assert.match(sql, /refuses to run/, `${name}: must raise a message saying so`);
        assert.match(sql, /proargnames\[1:p\.pronargs\]/, `${name}: must compare INPUT parameters only`);
        // And it must run before anything it guards.
        assert.ok(
            sql.indexOf('$rollback_precondition$') < sql.search(/CREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+public\.create_checkout_order/i),
            `${name}: the precondition must come before the CREATE it protects`,
        );
        // A raise inside a transaction is what makes the refusal atomic.
        assert.match(sql, /^BEGIN;$/m, `${name}: must run inside a transaction`);
        assert.match(sql, /^COMMIT;$/m, `${name}: must commit`);
    }
});

test('a NEW rollback may not restore a function without either a DROP or a precondition', () => {
    // The ratchet remains at 245; candidate restorers must earn a real guard.
    const offenders = [];
    for (const name of rollbackFiles()) {
        if (number(name) <= RATCHET_FROM_EXCLUSIVE) continue;
        const sql = read(name);
        const forwardFile=join(rollbackDir,'../migrations',name.replace('.rollback.sql','.sql'));
        const forwardSql=readFileSync(forwardFile,'utf8');
        const guarded = new Set(guardedRestorations(sql,{forwardSql}));
        const dropped = new Set(droppedRestorations(sql));
        for (const fn of new Set(createdFunctions(sql))) {
            const dropsIt = dropped.has(fn);
            if (!dropsIt && !guarded.has(fn)) offenders.push(`${name}: creates public.${fn} with neither a DROP nor a precondition`);
        }
    }
    assert.deepEqual(
        offenders.sort(),
        [],
        'A rollback restoring a past definition must either DROP the live function first (so the ' +
        'CREATE cannot add an overload) or assert the signature it expects and refuse otherwise.',
    );
});

test('candidate guards bind every restored ABI and precede any schema or function mutation', () => {
    let restorers = 0;
    for (const n of CANDIDATE_GUARDED) {
        const name = rollbackFiles().find(file => number(file) === n);
        assert.ok(name, `rollback ${n} must exist`);
        const sql = read(name);
        const guard = sql.match(/DO \$rollback_precondition\$[\s\S]*?\$rollback_precondition\$;/)?.[0];
        assert.ok(guard, `${name}: a named guard is required`);
        for (const fn of new Set(createdFunctions(sql))) {
            assert.ok(guard.includes(`'public.${fn}(`), `${name}: bind ${fn}'s typed signature`);
            restorers += 1;
        }
        assert.match(guard,/v_count <> 1/);
        assert.match(guard,/to_regprocedure\(v_expected.signature\)/);
        assert.match(guard,/proargnames\[1:v_live.pronargs\]/);
        assert.match(guard,/prorettype IS DISTINCT FROM/);
        assert.match(guard,/proretset IS DISTINCT FROM/);
        assert.match(guard,new RegExp(`rollback ${n} refuses to run`));
        assert.ok(sql.indexOf(guard) < sql.search(/^\s*(?:CREATE OR REPLACE FUNCTION|DROP |ALTER )/m),`${name}: guard before first mutation`);
        assert.match(sql,/^BEGIN;$/m);
        assert.match(sql,/^COMMIT;$/m);
    }
    assert.equal(restorers,17);
});

test('current Console, staff and subscription rollback guards bind all live signatures before mutation', () => {
    for (const n of [318,324,328,329]) {
        const name=rollbackFiles().find(file=>number(file)===n);
        const sql=read(name);
        const guard=sql.match(/DO \$rollback_precondition\$[\s\S]*?\$rollback_precondition\$;/)?.[0];
        assert.ok(guard,`${name}: named guard required`);
        for (const fn of new Set(createdFunctions(sql))) {
            assert.ok(guard.includes(`'public.${fn}(`),`${name}: bind every restored function`);
        }
        assert.match(guard,/v_count <> v_expected.overloads/);
        assert.match(guard,/to_regprocedure\(v_expected.signature\)/);
        assert.match(guard,/proargnames\[1:v_live.pronargs\]/);
        assert.match(guard,/prorettype IS DISTINCT FROM/);
        assert.match(guard,/proretset IS DISTINCT FROM/);
        assert.match(guard,new RegExp(`rollback ${n} refuses to run`));
        assert.ok(sql.indexOf(guard)<sql.search(/^\s*(?:CREATE OR REPLACE FUNCTION|DROP |ALTER )/m));
        if (n===329) {
            assert.equal((guard.match(/'public\.complete_console_mfa_v1\(/g)||[]).length,2,
                'factor-bound completion and its intentional refusal-only predecessor overload both need guards');
        }
    }
});

const currentRollbacks=[
    ['335_durable_loyalty_refund_recovery.rollback.sql','restore_loyalty_on_refund'],
    ['336_owned_refund_completion.rollback.sql','complete_order_refund'],
    ['337_unique_order_references.rollback.sql','generate_order_number'],
];
const guardBlock=sql=>sql.match(/DO \$guard\$[\s\S]*?END \$guard\$;/)[0];
function requireMutationRefusal(sql, fn, change, label) {
    const original=guardBlock(sql), changed=change(original);
    assert.notEqual(changed,original,`${label}: mutation must change real guard bytes`);
    const mutated=sql.replace(original,changed);
    assert.ok(!guardedRestorations(mutated).includes(fn),label);
}

test('current finite recovery/completion and zero-input trigger guards prove every restored ABI without marker dependence',()=>{
    for(const [name,fn] of currentRollbacks){
        const sql=read(name);
        assert.ok(guardedRestorations(sql).includes(fn));
        assert.ok(rollbackSignatureGuards(sql).every(g=>g.level.startsWith('typed-')));
        assert.ok(guardedRestorations(sql.replaceAll('$guard$','$different_label$')).includes(fn));
        assert.ok(guardedRestorations(sql.replaceAll('DO $guard$',()=> 'DO $$').replaceAll('END $guard$;',()=> 'END $$;')).includes(fn));
    }
});

test('every actual ABI comparison and its live catalog binding is required',()=>{
    for(const [name,fn] of currentRollbacks){
        const sql=read(name);
        for(const [pattern,label] of [
            [/p\.prokind<>\s*'f'\s*(?:OR)?/,'function kind'],
            [/p\.proretset\s*(?:OR)?/,'set result'],
            [/p\.prorettype\s*(?:IS DISTINCT FROM pg_catalog\.to_regtype\(e\.result_type\)|<>\s*'[^']+'::regtype)\s*(?:OR)?/,'result type'],
            [/q\.proname=p\.proname/,'overload name binding'],
            [/q\.pronamespace=p\.pronamespace/,'overload namespace binding'],
            [/p\.oid IS NULL\s*(?:OR)?/,'missing typed function'],
        ]) requireMutationRefusal(sql,fn,g=>g.replace(pattern,'false OR '),name+': '+label);
        requireMutationRefusal(sql,fn,g=>g.replace('RAISE EXCEPTION','RAISE NOTICE'),name+': exception');
        requireMutationRefusal(sql,fn,g=>g.replace(/BEGIN/,'BEGIN RETURN;'),name+': early return');
        requireMutationRefusal(sql,fn,g=>g.replace(/END \$guard\$;/,'EXCEPTION WHEN OTHERS THEN NULL; END $guard$;'),name+': swallowed refusal');
        if(fn!=='generate_order_number'){
            requireMutationRefusal(sql,fn,g=>g.replace(/p\.proargnames\[1:p\.pronargs\]\s*IS DISTINCT FROM e\.input_names/,'false'),name+': input names');
            requireMutationRefusal(sql,fn,g=>g.replace('to_regprocedure(e.signature)','to_regprocedure(e.unrelated)'),name+': signature selection');
        } else {
            requireMutationRefusal(sql,fn,g=>g.replace("public.generate_order_number()","public.unrelated()"),name+': signature identity');
            requireMutationRefusal(sql,fn,g=>g.replace('p.pronargs<>0','false'),name+': zero input count');
            for(const text of ['tgfoid=p.oid','tgtype=7',"tgenabled='O'",'NOT tgisinternal'])requireMutationRefusal(sql,fn,g=>g.replace(text,'true'),name+': trigger '+text);
        }
    }
});

test('guard must run atomically before every mutation; marker/comment/unrelated or empty text cannot prove it',()=>{
    for(const [name,fn] of currentRollbacks){
        const sql=read(name),block=guardBlock(sql);
        const mutations=[
            sql.replace('BEGIN;',''),sql.replace('COMMIT;',''),
            sql.replace(block,'').replace('COMMIT;',block+'\nCOMMIT;'),
            sql.replace(block,'DO $rollback_precondition$ BEGIN NULL; END $rollback_precondition$;'),
            sql.replace(block,block.split('\n').map(line=>'-- '+line).join('\n')),
            sql.replace(block,'DO $rollback_precondition$ BEGIN RAISE NOTICE '+"'"+block.replaceAll("'","''")+"'; END $rollback_precondition$;"),
            sql.replace('BEGIN;','BEGIN; DO $$ BEGIN EXECUTE unknown_command; END $$;'),
        ];
        for(const mutated of mutations){assert.notEqual(mutated,sql);assert.ok(!guardedRestorations(mutated).includes(fn),name);}
    }
});

test('finite guards reject missing/renamed signatures, unknown rows and additional unguarded restored overloads',()=>{
    for(const [name,fn] of currentRollbacks.slice(0,2)){
        const sql=read(name);
        requireMutationRefusal(sql,fn,g=>g.replace(new RegExp(`public\\.${fn}\\(`),'public.unrelated('),name+': renamed expected signature');
        requireMutationRefusal(sql,fn,g=>g.replace(/FOR e IN SELECT \* FROM\(VALUES[\s\S]*?\)expected\(signature,input_names(?:,result_type)?\) LOOP/,'FOR e IN SELECT * FROM unknown_rows LOOP'),name+': unbounded expected rows');
        const extra=`CREATE FUNCTION public.${fn}(p_unknown text) RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;`;
        assert.ok(!guardedRestorations(sql.replace('COMMIT;',extra+'\nCOMMIT;')).includes(fn),name+': unguarded overload');
    }
});

test('missing finite row, catalog substitutions and unknown guard preludes stay closed',()=>{
    const [name,fn]=currentRollbacks[0], sql=read(name);
    requireMutationRefusal(sql,fn,g=>g.replace(/\('public\.restore_loyalty_on_refund\([^']+\)',ARRAY\[[^\]]+\]::text\[\],'jsonb'\),/,''),'missing finite signature row');
    requireMutationRefusal(sql,fn,g=>g.replace('FROM pg_catalog.pg_proc WHERE','FROM public.pg_proc WHERE'),'catalog substitution');
    assert.deepEqual(rollbackSignatureGuards(sql.replace('BEGIN;','BEGIN; SELECT unknown_mutation();')),[]);
    assert.deepEqual(rollbackSignatureGuards(sql.replace('BEGIN;','BEGIN; DO $$ BEGIN PERFORM unknown_mutation(); END $$;')),[]);
});

test('an earlier DROP must retire the exact restored typed ABI, including optional input names',()=>{
    const create="CREATE FUNCTION public.reviewer_probe(p_id uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;";
    assert.deepEqual(droppedRestorations('BEGIN; DROP FUNCTION IF EXISTS public.reviewer_probe(p_wrong text); '+create+' COMMIT;'),[]);
    for(const drop of ['DROP FUNCTION public.reviewer_probe(uuid);','DROP FUNCTION IF EXISTS public.reviewer_probe(p_old_name uuid);','DROP FUNCTION public.reviewer_probe(IN p_old_name pg_catalog.uuid) RESTRICT;']){
        assert.deepEqual(droppedRestorations('BEGIN; '+drop+create+' COMMIT;'),['reviewer_probe']);
    }
});

test('every restored overload must be dropped before its own CREATE, never just one same-name member',()=>{
    const uuid="CREATE FUNCTION public.reviewer_probe(p_id uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;";
    const text=uuid.replace('p_id uuid','p_id text');
    assert.deepEqual(droppedRestorations('BEGIN; DROP FUNCTION public.reviewer_probe(uuid); '+uuid+text+' COMMIT;'),[]);
    assert.deepEqual(droppedRestorations('BEGIN; '+uuid+' DROP FUNCTION public.reviewer_probe(uuid); COMMIT;'),[]);
    assert.deepEqual(droppedRestorations('BEGIN; DROP FUNCTION public.reviewer_probe(uuid),public.reviewer_probe(text); '+uuid+text+' COMMIT;'),['reviewer_probe']);
    assert.deepEqual(droppedRestorations('BEGIN; DROP FUNCTION public.reviewer_probe(uuid); '+uuid+' DROP FUNCTION public.reviewer_probe(text); '+text+' COMMIT;'),['reviewer_probe']);
});

test('commented, quoted, dynamic, incomplete or unknown DROP text supplies no retirement evidence',()=>{
    const create="CREATE FUNCTION public.reviewer_probe(p_id uuid) RETURNS jsonb LANGUAGE sql AS $$SELECT '{}'::jsonb$$;";
    for(const drop of [
        '-- DROP FUNCTION public.reviewer_probe(uuid);\n',
        '/* DROP FUNCTION public.reviewer_probe(uuid); */',
        "SELECT 'DROP FUNCTION public.reviewer_probe(uuid);';",
        "DO $$ BEGIN EXECUTE 'DROP FUNCTION public.reviewer_probe(uuid)'; END $$;",
        'DROP FUNCTION public.reviewer_probe;',
        'DROP FUNCTION public.reviewer_probe(uuid,);',
        'DROP FUNCTION public.reviewer_probe(uuid),;',
        'DROP FUNCTION public.reviewer_probe(p_id uuid DEFAULT NULL);',
        'DROP FUNCTION public.reviewer_probe(unknown_mode p_id uuid);',
    ])assert.deepEqual(droppedRestorations('BEGIN; '+drop+create+' COMMIT;'),[],drop);
});

const transitionSql=read('284_storefront_web_onboarding_channels.rollback.sql');
const transitionName='save_storefront_web_onboarding_draft';
const transitionBlock=sql=>sql.match(/DO \$rollback_precondition\$[\s\S]*?END \$rollback_precondition\$;/)[0];

test('a typed source-to-absent-target transition earns proof only with exact retirement under the catalog lock',()=>{
    assert.ok(guardedRestorations(transitionSql).includes(transitionName));
    assert.equal(rollbackSignatureGuards(transitionSql).find(g=>g.identity.includes(transitionName)).level,'typed-absence-family-transition');
    assert.deepEqual(droppedRestorations(transitionSql),[],'a different typed source DROP is never reclassified as dropping the target');
    for(const changed of [
        transitionSql.replace('LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;',''),
        transitionSql.replace('SHARE ROW EXCLUSIVE MODE','ACCESS SHARE MODE'),
        transitionSql.replace('DROP FUNCTION IF EXISTS public.save_storefront_web_onboarding_draft(uuid, integer, text, text, text, text[]);','DROP FUNCTION IF EXISTS public.save_storefront_web_onboarding_draft(uuid, integer, text, text, text);'),
        transitionSql.replace('DROP FUNCTION IF EXISTS public.save_storefront_web_onboarding_draft(uuid, integer, text, text, text, text[]);',''),
    ]){assert.notEqual(changed,transitionSql);assert.ok(!guardedRestorations(changed).includes(transitionName));assert.ok(!droppedRestorations(changed).includes(transitionName));}
});

test('every transition ABI, absence, family, body, owner and ACL predicate is mandatory source evidence',()=>{
    const block=transitionBlock(transitionSql),condition=block.match(/IF (v_source\.oid IS NULL[\s\S]*?) THEN/)[1];
    const tokens=sqlTokens(condition),parts=[];let depth=0,start=0;
    for(let i=0;i<tokens.length;i++){
        const t=tokens[i];if(t.kind==='symbol'&&t.value==='(')depth++;if(t.kind==='symbol'&&t.value===')')depth--;
        if(t.kind==='word'&&t.value==='or'&&depth===0){parts.push(tokens.slice(start,i));start=i+1;}
    }
    parts.push(tokens.slice(start));assert.equal(parts.length,25);
    for(let i=0;i<parts.length;i++){
        const missing=parts.filter((_,index)=>index!==i).map(tokenText).join(' OR ');
        const mutated=transitionSql.replace(condition,missing);
        assert.ok(!guardedRestorations(mutated).includes(transitionName),tokenText(parts[i]));
    }
});

test('transition row identity, exception, transaction, ordering and mutation interval stay bound',()=>{
    const block=transitionBlock(transitionSql),lock='LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;';
    const mutations=[
        transitionSql.replace('BEGIN;',''),transitionSql.replace('COMMIT;',''),
        transitionSql.replace(block,'').replace('COMMIT;',block+'\nCOMMIT;'),
        transitionSql.replace(lock,'').replace(block,block+'\n'+lock),
        transitionSql.replace('RAISE EXCEPTION','RAISE NOTICE'),
        transitionSql.replace("'public.save_storefront_web_onboarding_draft(uuid,integer,text,text,text)'","'public.unrelated(uuid,integer,text,text,text)'"),
        transitionSql.replace("'public.save_storefront_web_onboarding_draft(uuid,integer,text,text,text,text[])'","'public.unrelated(uuid,integer,text,text,text,text[])'"),
        transitionSql.replace(block,block+'\nSELECT unknown_mutation();'),
        transitionSql.replace(block,block.split('\n').map(line=>'-- '+line).join('\n')),
        transitionSql.replace(block,'DO $rollback_precondition$ BEGIN NULL; END $rollback_precondition$;'),
    ];
    for(const changed of mutations){assert.notEqual(changed,transitionSql);assert.ok(!guardedRestorations(changed).includes(transitionName));}
});

test('transition proof also requires fresh isolation and refusal of uncommitted/prepared writers before catalog selection',()=>{
    for(const text of [
        "pg_catalog.current_setting('transaction_isolation')<>'read committed'",
        "EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.locktype='transactionid' AND l.mode='ExclusiveLock' AND l.granted AND (l.pid IS NULL OR l.pid<>pg_catalog.pg_backend_pid()))",
        'EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts)',
    ]){const changed=transitionSql.replace(text,'false');assert.notEqual(changed,transitionSql);assert.ok(!guardedRestorations(changed).includes(transitionName));assert.ok(!droppedRestorations(changed).includes(transitionName));}
});

// Self-contained counterpart of the reviewed finite catalog fingerprint shape.
// No external worker SQL is imported or executed by this retained pure suite.
const fingerprintGuard = "-- The full current ABI and known implementation must match before any mutation.\nDO $rollback_precondition$\nDECLARE\n  v_expected record;\n  v_live pg_catalog.pg_proc%ROWTYPE;\n  v_count integer;\nBEGIN\n  FOR v_expected IN SELECT * FROM (VALUES\n    ('theme_draft_actor_site_v1','public.theme_draft_actor_site_v1(uuid,uuid,uuid)',ARRAY['p_actor','p_site','p_bound_site']::text[],'public.sites',false,1),\n    ('read_owned_theme_draft_v1','public.read_owned_theme_draft_v1(uuid,uuid,text,text,uuid)',ARRAY['p_actor_id','p_store_id','p_theme_slug','p_template_key','p_bound_site_id']::text[],'jsonb',false,1),\n    ('mutate_owned_theme_draft_v1','public.mutate_owned_theme_draft_v1(uuid,uuid,text,text,integer,text,text,jsonb,jsonb,uuid,text,jsonb)',ARRAY['p_actor_id','p_store_id','p_theme_slug','p_template_key','p_base_version','p_key','p_operation','p_config','p_runtime','p_bound_site_id','p_request_id','p_publish_options']::text[],'jsonb',false,1),\n    ('publish_theme_release','public.publish_theme_release(uuid,text,jsonb,uuid,integer,uuid,text,boolean,text,uuid)',ARRAY['p_store_id','p_theme_id','p_release_config','p_source_draft_id','p_source_draft_version','p_published_by','p_publish_message','p_make_store_live','p_request_id','p_rollback_of_release_id']::text[],'record',true,1)\n  ) AS expected(name, signature, input_names, result_type, returns_set, overloads)\n  LOOP\n    SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p\n      JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace\n     WHERE n.nspname='public' AND p.proname=v_expected.name;\n    IF v_count <> v_expected.overloads OR pg_catalog.to_regprocedure(v_expected.signature) IS NULL THEN\n      RAISE EXCEPTION 'rollback 344 refuses to run: % signature or overload set changed; use a reviewed forward repair', v_expected.name;\n    END IF;\n    SELECT * INTO v_live FROM pg_catalog.pg_proc p\n     WHERE p.oid=pg_catalog.to_regprocedure(v_expected.signature);\n    IF COALESCE(v_live.proargnames[1:v_live.pronargs], ARRAY[]::text[]) IS DISTINCT FROM v_expected.input_names\n       OR v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype\n       OR v_live.proretset IS DISTINCT FROM v_expected.returns_set\n       OR v_live.prokind <> 'f' THEN\n      RAISE EXCEPTION 'rollback 344 refuses to run: % input names or result ABI changed; use a reviewed forward repair', v_expected.name;\n    END IF;\n  END LOOP;\n  SELECT * INTO v_live FROM pg_catalog.pg_proc p\n   WHERE p.oid='public.publish_theme_release(uuid,text,jsonb,uuid,integer,uuid,text,boolean,text,uuid)'::regprocedure;\n  IF v_live.proargnames IS DISTINCT FROM ARRAY['p_store_id','p_theme_id','p_release_config','p_source_draft_id','p_source_draft_version','p_published_by','p_publish_message','p_make_store_live','p_request_id','p_rollback_of_release_id','release_id','release_version','published_at']::text[]\n     OR v_live.proallargtypes IS DISTINCT FROM ARRAY['uuid'::regtype::oid,'text'::regtype::oid,'jsonb'::regtype::oid,'uuid'::regtype::oid,'integer'::regtype::oid,'uuid'::regtype::oid,'text'::regtype::oid,'boolean'::regtype::oid,'text'::regtype::oid,'uuid'::regtype::oid,'uuid'::regtype::oid,'integer'::regtype::oid,'timestamptz'::regtype::oid]::oid[]\n     OR v_live.proargmodes IS DISTINCT FROM ARRAY['i','i','i','i','i','i','i','i','i','i','t','t','t']::\"char\"[] THEN\n    RAISE EXCEPTION 'rollback 344 refuses to run: publish_theme_release table result ABI changed; use a reviewed forward repair';\n  END IF;\nEND;\n$rollback_precondition$;\n\n-- Additional refusal-only checks pin defaults, execution profile and current\n-- bodies. A same-signature forward repair also requires a reviewed rollback.\nDO $current_shape_precondition$\nBEGIN\n  IF EXISTS (\n    SELECT 1 FROM (VALUES\n    ('public.theme_draft_actor_site_v1(uuid,uuid,uuid)',1,false,'search_path=pg_catalog, public','f42c6f35dd1e83963704ed622b011fba',ARRAY['p_actor','p_site','p_bound_site']::text[]),\n    ('public.read_owned_theme_draft_v1(uuid,uuid,text,text,uuid)',2,false,'search_path=pg_catalog, public','aa3de9357219d6e32d32b42664dfd199',ARRAY['p_actor_id','p_store_id','p_theme_slug','p_template_key','p_bound_site_id']::text[]),\n    ('public.mutate_owned_theme_draft_v1(uuid,uuid,text,text,integer,text,text,jsonb,jsonb,uuid,text,jsonb)',5,false,'search_path=pg_catalog, public','b770c5c649eee8eca3b5cc8f5e488c69',ARRAY['p_actor_id','p_store_id','p_theme_slug','p_template_key','p_base_version','p_key','p_operation','p_config','p_runtime','p_bound_site_id','p_request_id','p_publish_options']::text[]),\n    ('public.publish_theme_release(uuid,text,jsonb,uuid,integer,uuid,text,boolean,text,uuid)',7,true,'search_path=public','fa4fae1749dc226ed066e5bf27020c84',ARRAY['p_store_id','p_theme_id','p_release_config','p_source_draft_id','p_source_draft_version','p_published_by','p_publish_message','p_make_store_live','p_request_id','p_rollback_of_release_id','release_id','release_version','published_at']::text[])\n    ) AS expected(signature, defaults, definer, search_path, body_md5, argument_names)\n    JOIN pg_catalog.pg_proc p ON p.oid=pg_catalog.to_regprocedure(expected.signature)\n    JOIN pg_catalog.pg_language l ON l.oid=p.prolang\n    WHERE p.proowner IS DISTINCT FROM (SELECT c.relowner FROM pg_catalog.pg_class c WHERE c.oid='public.theme_instances'::regclass)\n       OR p.pronargdefaults IS DISTINCT FROM expected.defaults\n       OR p.prosecdef IS DISTINCT FROM expected.definer\n       OR p.proconfig IS DISTINCT FROM ARRAY[expected.search_path]::text[]\n       OR l.lanname <> 'plpgsql'\n       OR p.proargnames IS DISTINCT FROM expected.argument_names\n       OR (NOT expected.definer AND (p.proallargtypes IS NOT NULL OR p.proargmodes IS NOT NULL))\n       OR pg_catalog.md5(p.prosrc) IS DISTINCT FROM expected.body_md5\n  ) THEN\n    RAISE EXCEPTION 'rollback 344 refuses to run: current function shape or body changed; use a reviewed forward repair';\n  END IF;\nEND;\n$current_shape_precondition$;\n\n";
const fingerprintPrimary = fingerprintGuard.slice(0,fingerprintGuard.indexOf('-- Additional refusal-only'));
const fingerprintSupplement = fingerprintGuard.slice(fingerprintGuard.indexOf('-- Additional refusal-only'));
const fingerprintCreate = `CREATE OR REPLACE FUNCTION public.publish_theme_release(
 p_store_id uuid,p_theme_id text,p_release_config jsonb,p_source_draft_id uuid,
 p_source_draft_version integer,p_published_by uuid,p_publish_message text,
 p_make_store_live boolean,p_request_id text,p_rollback_of_release_id uuid
) RETURNS TABLE(release_id uuid,release_version integer,published_at timestamptz)
LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'pure fixture'; END $$;`;
const fingerprintSql = 'BEGIN;\n'+fingerprintGuard+fingerprintCreate+'\nCOMMIT;';
const fingerprintName='publish_theme_release';
function rejectFingerprint(changed,label) {
    assert.notEqual(changed,fingerprintSql,label+': real mutation');
    assert.deepEqual(rollbackSignatureGuards(changed),[],label);
    assert.ok(!guardedRestorations(changed).includes(fingerprintName),label);
}

test('finite qualified read-only body fingerprints supplement every already proved typed ABI and table OUT contract',()=>{
    const guards=rollbackSignatureGuards(fingerprintSql);
    assert.equal(guards.length,4);
    assert.ok(guards.every(g=>g.level==='typed-ABI'&&/^[0-9a-f]{32}$/.test(g.body_fingerprint.md5)));
    assert.deepEqual(guards.find(g=>g.name===fingerprintName).output_abi.modes,[...Array(10).fill('i'),...Array(3).fill('t')]);
    assert.deepEqual(guardedRestorations(fingerprintSql),[fingerprintName]);
    assert.deepEqual(guardedRestorations(fingerprintSql.replaceAll('$current_shape_precondition$','$another_label$')),[fingerprintName]);
});

test('supplemental fingerprints cannot supply missing primary signatures or OUT proof',()=>{
    rejectFingerprint(fingerprintSql.replace(fingerprintPrimary,''),'no primary proof');
    const row=/    \('theme_draft_actor_site_v1'[^\n]+\n/;
    rejectFingerprint(fingerprintSql.replace(row,''),'missing primary row');
    const output=/  SELECT \* INTO v_live FROM pg_catalog\.pg_proc p\n   WHERE p\.oid='public\.publish_theme_release[^;]+;[\s\S]*?  END IF;/;
    rejectFingerprint(fingerprintSql.replace(output,''),'missing OUT proof');
    for(const from of ["v_live.prokind <> 'f'",'v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype','v_live.proretset IS DISTINCT FROM v_expected.returns_set','v_count <> v_expected.overloads'])
        rejectFingerprint(fingerprintSql.replace(from,'false'),'primary '+from);
    rejectFingerprint('BEGIN;\n'+fingerprintSupplement+fingerprintPrimary+fingerprintCreate+'\nCOMMIT;','supplement before primary');
});

test('fingerprint catalog queries permit only the exact qualified built-ins, joins and eight refusal predicates',()=>{
    for(const [from,to] of [
        ['pg_catalog.md5(p.prosrc)','md5(p.prosrc)'],['pg_catalog.md5(p.prosrc)','public.md5(p.prosrc)'],
        ['pg_catalog.md5(p.prosrc)','pg_catalog.sha256(p.prosrc)'],['pg_catalog.md5(p.prosrc)','pg_catalog.md5(p.proname)'],
        ['pg_catalog.to_regprocedure(expected.signature)','to_regprocedure(expected.signature)'],
        ['pg_catalog.pg_language l','public.pg_language l'],['pg_catalog.pg_proc p ON','public.pg_proc p ON'],
        ['pg_catalog.pg_class c','public.pg_class c'],['p.oid=pg_catalog.to_regprocedure(expected.signature)','p.oid=p.oid'],
        ['l.oid=p.prolang','l.oid=l.oid'],["c.oid='public.theme_instances'::regclass","c.oid=unknown_owner()"],
    ])rejectFingerprint(fingerprintSql.replace(fingerprintSupplement,fingerprintSupplement.replace(from,to)),from+' -> '+to);
    const condition=fingerprintSupplement.match(/    WHERE ([\s\S]*?)\n  \) THEN/)[1];
    const tokens=sqlTokens(condition),parts=[];let depth=0,start=0;
    for(let i=0;i<tokens.length;i++){
        if(tokens[i].kind==='symbol'&&tokens[i].value==='(')depth++;
        if(tokens[i].kind==='symbol'&&tokens[i].value===')')depth--;
        if(tokens[i].kind==='word'&&tokens[i].value==='or'&&depth===0){parts.push(tokens.slice(start,i));start=i+1;}
    }
    parts.push(tokens.slice(start));assert.equal(parts.length,8);
    for(let i=0;i<parts.length;i++)rejectFingerprint(fingerprintSql.replace(condition,parts.filter((_,j)=>j!==i).map(tokenText).join(' OR ')),'missing '+tokenText(parts[i]));
});

test('fingerprint expected rows remain finite unique complete literals bound to the primary argument names',()=>{
    for(const [from,to] of [
        ["'f42c6f35dd1e83963704ed622b011fba'","unknown_hash()"],
        ["'f42c6f35dd1e83963704ed622b011fba'","'not-md5'"],
        ["1,false,'search_path=pg_catalog, public'","999,false,'search_path=pg_catalog, public'"],
        ["1,false,'search_path=pg_catalog, public'","1,unknown_definer(),'search_path=pg_catalog, public'"],
        ["'search_path=pg_catalog, public'","'search_path=public, unsafe'"],
        ["ARRAY['p_actor','p_site','p_bound_site']::text[]","ARRAY['p_other','p_site','p_bound_site']::text[]"],
        ["'public.theme_draft_actor_site_v1(uuid,uuid,uuid)'","'public.unrelated(uuid,uuid,uuid)'"],
        ['AS expected(signature, defaults','AS unrelated(signature, defaults'],
    ])rejectFingerprint(fingerprintSql.replace(fingerprintSupplement,fingerprintSupplement.replace(from,to)),from);
    // Signature includes its typed argument list; match the full literal row.
    const row=fingerprintSupplement.split('\n').find(line=>line.includes("('public.theme_draft_actor_site_v1("));
    rejectFingerprint(fingerprintSql.replace(fingerprintSupplement,fingerprintSupplement.replace(row+'\n','')),'missing expected row');
    rejectFingerprint(fingerprintSql.replace(fingerprintSupplement,fingerprintSupplement.replace(row,row+'\n'+row)),'duplicate row');
});

test('fingerprint blocks reject side effects, arbitrary statements, positive branches and late or non-atomic guards',()=>{
    for(const statement of ['PERFORM unknown_mutation();',"EXECUTE 'DELETE FROM public.probe';",'UPDATE public.probe SET x=1;','SELECT unknown_call();','RETURN;'])
        rejectFingerprint(fingerprintSql.replace(fingerprintSupplement,fingerprintSupplement.replace('BEGIN','BEGIN '+statement)),statement);
    for(const [from,to] of [
        ['RAISE EXCEPTION','RAISE NOTICE'],["RAISE EXCEPTION 'rollback","RAISE EXCEPTION unknown_call(), 'rollback"],
        ['  END IF;',"  ELSE RAISE EXCEPTION 'unexpected'; END IF;"],
        ['IF EXISTS','IF NOT EXISTS'],['BEGIN','DECLARE x integer; BEGIN'],
    ])rejectFingerprint(fingerprintSql.replace(fingerprintSupplement,fingerprintSupplement.replace(from,to)),from);
    rejectFingerprint(fingerprintSql.replace('BEGIN;',''),'no transaction');
    rejectFingerprint(fingerprintSql.replace('COMMIT;',''),'no commit');
    const late=fingerprintSql.replace(fingerprintSupplement,'').replace('COMMIT;',fingerprintSupplement+'COMMIT;');
    assert.ok(rollbackSignatureGuards(late).every(g=>!g.body_fingerprint),'late supplemental refusal earns no fingerprint evidence; earlier primary ABI remains independently valid');
});

test('OUT ABI arrays reject unknown callees, names, types, modes and mismatched input prefixes',()=>{
    const sql='BEGIN;\n'+fingerprintPrimary+fingerprintCreate+'\nCOMMIT;';
    assert.ok(guardedRestorations(sql).includes(fingerprintName));
    for(const [from,to] of [
        ["'release_id','release_version','published_at'","unknown_name(),'release_version','published_at'"],
        ["'timestamptz'::regtype::oid","unknown_type()"],
        ["'i','i','i','i','i','i','i','i','i','i','t','t','t'","'i','i','i','i','i','i','i','i','i','i','i','t','t'"],
        ["'uuid'::regtype::oid,'text'::regtype::oid","'text'::regtype::oid,'text'::regtype::oid"],
    ]){const changed=sql.replace(from,to);assert.notEqual(changed,sql);assert.deepEqual(rollbackSignatureGuards(changed),[],from);}
});

const extraRefusal=condition=>`DO $extra$ BEGIN IF ${condition} THEN RAISE EXCEPTION 'pure refusal'; END IF; END $extra$;`;
const withPrimaryPrefix=statement=>fingerprintSql.replace('BEGIN\n  FOR v_expected','BEGIN\n  '+statement+'\n  FOR v_expected');

test('unknown pre-loop calls cannot borrow otherwise valid primary ABI proof',()=>{
    for(const condition of ['public.guard_side_effect()','guard_side_effect()','pg_catalog.guard_side_effect()','false OR public.guard_side_effect()',"EXISTS(SELECT 1 FROM public.history WHERE public.guard_side_effect())"])
        rejectFingerprint(withPrimaryPrefix(`IF ${condition} THEN RAISE EXCEPTION 'probe'; END IF;`),condition);
});
test('every declaration initializer must be a finite literal array, including unused declarations',()=>{
    const add=declaration=>fingerprintSql.replace('  v_count integer;','  v_count integer;\n  '+declaration);
    for(const value of ['ARRAY[public.guard_side_effect()]',"ARRAY[(SELECT public.guard_side_effect())]","ARRAY['safe'||public.guard_side_effect()]","ARRAY['safe'::public.effect_type]",'ARRAY[pg_catalog.to_regprocedure(\'public.probe()\')]'])
        rejectFingerprint(add(`unused text[] := ${value};`),value);
    assert.deepEqual(guardedRestorations(add("unused text[] := ARRAY['literal text public.guard_side_effect()'];")),[fingerprintName]);
});
test('fallback refusal conditions bind full callee qualification and literal typed identities',()=>{
    for(const condition of ["public.to_regprocedure('public.probe()') IS NULL","other.to_regprocedure('public.probe()') IS NULL","pg_catalog.to_regprocedure(public.guard_side_effect()) IS NULL","pg_catalog.to_regprocedure('public.probe()') IS NULL OR public.guard_side_effect()"])
        rejectFingerprint(fingerprintSql.replace('BEGIN;','BEGIN; '+extraRefusal(condition)),condition);
    for(const condition of ["pg_catalog.to_regprocedure('public.probe()') IS NULL","to_regprocedure('public.probe()') IS NULL"])
        assert.deepEqual(guardedRestorations(fingerprintSql.replace('BEGIN;','BEGIN; '+extraRefusal(condition))),[fingerprintName]);
});
test('exception messages and arguments cannot evaluate unknown expressions in any recognized guard',()=>{
    for(const expression of ["'message',public.guard_side_effect()","public.guard_side_effect()","'message',v_expected.name::public.effect_type","'message' USING DETAIL=public.guard_side_effect()","'message',unknown_variable"])
        rejectFingerprint(fingerprintSql.replace("RAISE EXCEPTION 'rollback 344 refuses to run: % signature or overload set changed; use a reviewed forward repair', v_expected.name",'RAISE EXCEPTION '+expression),expression);
    const sql=read('246_release_decrements_committed_quantity.rollback.sql');
    assert.ok(guardedRestorations(sql).includes('release_order_inventory'));
    for(const from of ['format(','coalesce(','array_length(','array_to_string(']) {
        const changed=sql.replace(from,'public.'+from);assert.notEqual(changed,sql);assert.deepEqual(guardedRestorations(changed),[],from);
    }
    for(const [from,to] of [["DETAIL = 'CREATE OR REPLACE FUNCTION","DETAIL = public.guard_side_effect(), ignored = 'CREATE OR REPLACE FUNCTION"],['coalesce(array_length(v_names, 1), 0)','coalesce(array_length(v_names, public.guard_side_effect()), 0)']]) {
        const changed=sql.replace(from,to);assert.notEqual(changed,sql);assert.deepEqual(guardedRestorations(changed),[],from);
    }
});
test('trigger refusal prefixes and additional exception branches are closed against unknown expressions',()=>{
    const sql=read('337_unique_order_references.rollback.sql');
    for(const changed of [
        sql.replace('WHERE is_called','WHERE is_called OR public.guard_side_effect()'),
        sql.replace("RAISE EXCEPTION 'rollback337 refuses changed reference trigger ABI'; END IF;","RAISE EXCEPTION 'rollback337 refuses changed reference trigger ABI'; ELSIF public.guard_side_effect() THEN RAISE EXCEPTION 'bad'; END IF;"),
        sql.replace("RAISE EXCEPTION 'rollback337 refuses allocated order references; use a reviewed forward repair'","RAISE EXCEPTION 'message',public.guard_side_effect()"),
    ]){assert.notEqual(changed,sql);assert.deepEqual(rollbackSignatureGuards(changed),[]);}
});
test('nested history refusals admit only bounded read queries and literal predicates',()=>{
    for(const condition of ["EXISTS(SELECT public.guard_side_effect() FROM public.history)","EXISTS(SELECT 1 FROM public.guard_side_effect())","EXISTS(SELECT 1 FROM public.history WHERE x::public.effect_type IS NULL)","EXISTS(SELECT 1 FROM public.history WHERE x=public.guard_side_effect())","EXISTS(SELECT 1 FROM public.history FOR UPDATE)","EXISTS(SELECT 1 FROM public.history WHERE x=1 UNION SELECT public.guard_side_effect())"])
        rejectFingerprint(fingerprintSql.replace('BEGIN;','BEGIN; '+extraRefusal(condition)),condition);
    const nested="DO $extra$ BEGIN IF EXISTS(SELECT 1 FROM pg_attribute WHERE attrelid='public.history'::regclass AND attname='receipt' AND NOT attisdropped) THEN IF EXISTS(SELECT 1 FROM public.history WHERE receipt IS NOT NULL) THEN RAISE EXCEPTION 'history'; END IF; END IF; END $extra$;";
    assert.deepEqual(guardedRestorations(fingerprintSql.replace('BEGIN;','BEGIN; '+nested)),[fingerprintName]);
    rejectFingerprint(fingerprintSql.replace('BEGIN;','BEGIN; '+nested.replace('receipt IS NOT NULL','receipt IS NOT NULL OR public.guard_side_effect()')),'nested inner call');
});
test('the legitimate complete pg_catalog quiescence predicate remains finite and qualified',()=>{
    const quiescence=transitionBlock(transitionSql).match(/ IF (pg_catalog.current_setting[\s\S]*?) THEN/)[1];
    assert.deepEqual(guardedRestorations(withPrimaryPrefix(`IF ${quiescence} THEN RAISE EXCEPTION 'quiescence'; END IF;`)),[fingerprintName]);
    for(const [from,to] of [['pg_catalog.current_setting','public.current_setting'],['pg_catalog.pg_backend_pid()','public.pg_backend_pid()'],["'transaction_isolation'","public.guard_side_effect()"],['pg_catalog.pg_prepared_xacts','public.pg_prepared_xacts']])
        rejectFingerprint(withPrimaryPrefix(`IF ${quiescence.replace(from,to)} THEN RAISE EXCEPTION 'quiescence'; END IF;`),from);
});


// Self-contained literal counterparts; actual frozen355 source is probed separately.
const profilePrimary="DO $forward_precondition$\nDECLARE v_expected record; v_live pg_catalog.pg_proc%ROWTYPE; v_count integer;\nBEGIN\n  IF pg_catalog.current_setting('transaction_isolation')<>'read committed'\n     OR EXISTS(SELECT 1 FROM pg_catalog.pg_locks l WHERE l.locktype='transactionid' AND l.mode='ExclusiveLock' AND l.granted AND (l.pid IS NULL OR l.pid<>pg_catalog.pg_backend_pid()))\n     OR EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts) THEN\n    RAISE EXCEPTION 'forward355 refuses concurrent/prepared writes or non-read-committed state';\n  END IF;\n  FOR v_expected IN SELECT * FROM (VALUES\n    ('allocate_ad_campaign_budget','public.allocate_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid)',ARRAY['p_site_id','p_campaign_id','p_amount_minor','p_idempotency_key','p_request_id','p_actor_id']::text[],'jsonb',false,1),\n    ('release_ad_campaign_budget','public.release_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid)',ARRAY['p_site_id','p_campaign_id','p_amount_minor','p_idempotency_key','p_request_id','p_actor_id']::text[],'jsonb',false,1)\n  ) AS expected(name,signature,input_names,result_type,returns_set,overloads) LOOP\n    SELECT count(*) INTO v_count FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace\n      WHERE n.nspname='public' AND p.proname=v_expected.name;\n    IF v_count <> v_expected.overloads OR pg_catalog.to_regprocedure(v_expected.signature) IS NULL THEN\n      RAISE EXCEPTION 'forward355 refuses to run: typed identity or full overload family changed';\n    END IF;\n    SELECT * INTO v_live FROM pg_catalog.pg_proc p WHERE p.oid=pg_catalog.to_regprocedure(v_expected.signature);\n    IF COALESCE(v_live.proargnames[1:v_live.pronargs],ARRAY[]::text[]) IS DISTINCT FROM v_expected.input_names\n       OR v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype\n       OR v_live.proretset IS DISTINCT FROM v_expected.returns_set\n       OR v_live.prokind<>'f' THEN\n      RAISE EXCEPTION 'forward355 refuses to run: input names or result ABI changed';\n    END IF;\n  END LOOP;\nEND;\n$forward_precondition$;";
const profileSupplement="DO $budget_definition_precondition$\nBEGIN\n  IF EXISTS(\n    SELECT 1 FROM (VALUES\n      ('public.allocate_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid)',2,'NULL::text, NULL::uuid','ac770e6839cde7baafb974da21b73155','2bda47bf30f064d1c794427f7cf9dd44'),\n      ('public.release_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid)',4,'NULL::bigint, NULL::text, NULL::text, NULL::uuid','4c8248128ea36c54a9261cad6546c4e9','3bc84ad4f90fa9a04c14574cbc7e51e2')\n    ) AS expected(signature,default_count,default_source,first_md5,second_md5)\n    LEFT JOIN pg_catalog.pg_proc p ON p.oid=pg_catalog.to_regprocedure(expected.signature)\n    WHERE p.oid IS NULL\n       OR p.pronamespace IS DISTINCT FROM 'public'::regnamespace\n       OR p.pronargs<>6 OR p.provariadic<>0\n       OR p.proargmodes IS NOT NULL OR p.proallargtypes IS NOT NULL\n       OR p.pronargdefaults IS DISTINCT FROM expected.default_count\n       OR pg_catalog.pg_get_expr(p.proargdefaults,0) IS DISTINCT FROM expected.default_source\n       OR p.proowner IS DISTINCT FROM pg_catalog.to_regrole(current_user)\n       OR p.prolang IS DISTINCT FROM (SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')\n       OR NOT p.prosecdef OR p.provolatile<>'v' OR p.proisstrict OR p.proleakproof OR p.proparallel<>'u'\n       OR p.procost IS DISTINCT FROM 100::real OR p.prorows IS DISTINCT FROM 0::real\n       OR p.prosupport<>0 OR p.probin IS NOT NULL OR p.prosqlbody IS NOT NULL OR p.protrftypes IS NOT NULL\n       OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public, pg_temp']::text[]\n       OR pg_catalog.md5(p.prosrc) NOT IN(expected.first_md5,expected.second_md5)\n       OR pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')\n       OR pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')\n       OR NOT pg_catalog.has_function_privilege('app_tenant',p.oid,'EXECUTE')\n       OR NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')\n       OR pg_catalog.has_function_privilege('app_tenant',p.oid,'EXECUTE WITH GRANT OPTION')\n       OR pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE WITH GRANT OPTION')\n       OR (SELECT count(*) FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))))<>3\n       OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a\n         WHERE NOT(a.grantor=p.proowner AND a.privilege_type='EXECUTE' AND\n           ((a.grantee=p.proowner AND a.is_grantable IS NOT DISTINCT FROM\n              (SELECT b.is_grantable FROM pg_catalog.aclexplode(pg_catalog.acldefault('f',p.proowner)) b WHERE b.grantee=p.proowner))\n            OR (a.grantee IN('app_tenant'::regrole::oid,'service_role'::regrole::oid) AND NOT a.is_grantable))))\n  ) THEN\n    RAISE EXCEPTION 'forward355 refuses unknown defaults/body/profile/owner/privileges';\n  END IF;\nEND;\n$budget_definition_precondition$;";
const profileNames=['allocate_ad_campaign_budget','release_ad_campaign_budget'];
const profileCreates=profileNames.map(name=>`CREATE FUNCTION public.${name}(p_site_id uuid,p_campaign_id uuid,p_amount_minor bigint,p_idempotency_key text,p_request_id text,p_actor_id uuid) RETURNS jsonb LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'pure fixture'; END $$;`).join('\n');
const profileSql='BEGIN;\nLOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;\n'+profilePrimary+'\n'+profileSupplement+'\n'+profileCreates+'\nCOMMIT;';
function rejectProfile(changed,label) {
    assert.notEqual(changed,profileSql,label+': actual mutation');
    assert.deepEqual(rollbackSignatureGuards(changed),[],label);
    assert.deepEqual(guardedRestorations(changed),[],label);
}
function changeProfile(from,to,label=from) {
    const changed=profileSupplement.replace(from,to);assert.notEqual(changed,profileSupplement,label);
    rejectProfile(profileSql.replace(profileSupplement,changed),label);
}

test('finite two-row defaults/body/profile/ACL refusal supplements complete typed ABI without function or marker exemptions',()=>{
    assert.deepEqual(guardedRestorations(profileSql),profileNames);
    const guards=rollbackSignatureGuards(profileSql);assert.equal(guards.length,2);
    assert.ok(guards.every(g=>g.level==='typed-ABI'&&g.quiescence_guard&&g.profile_fingerprint.body_md5s.length===2));
    assert.deepEqual(guards.map(g=>g.profile_fingerprint.default_count),[2,4]);
    const renamed=profileSql.replaceAll('allocate_ad_campaign_budget','unrelated_allocate').replaceAll('release_ad_campaign_budget','unrelated_release').replaceAll('$budget_definition_precondition$','$different_marker$');
    assert.deepEqual(guardedRestorations(renamed),['unrelated_allocate','unrelated_release']);
    const onlyOneKnownState=profileSql.replaceAll('ac770e6839cde7baafb974da21b73155','2bda47bf30f064d1c794427f7cf9dd44').replaceAll('4c8248128ea36c54a9261cad6546c4e9','3bc84ad4f90fa9a04c14574cbc7e51e2');
    assert.deepEqual(guardedRestorations(onlyOneKnownState),profileNames,'a repeated literal digest is still a bounded single-state refusal');
});
test('profile metadata cannot create primary proof, borrow incomplete identities or bypass serialization',()=>{
    rejectProfile(profileSql.replace(profilePrimary,''),'no primary');
    const primaryRow=profilePrimary.split('\n').find(line=>line.includes("('allocate_ad_campaign_budget'"));
    rejectProfile(profileSql.replace(profilePrimary,profilePrimary.replace(primaryRow+'\n','')),'missing primary row');
    for(const [from,to] of [['v_live.prokind<>\'f\'','false'],['v_live.proretset IS DISTINCT FROM v_expected.returns_set','false'],['v_count <> v_expected.overloads','false'],["'jsonb',false,1","'jsonb',false,2"],['pg_catalog.current_setting','public.current_setting']])
        rejectProfile(profileSql.replace(profilePrimary,profilePrimary.replace(from,to)),'primary '+from);
    rejectProfile(profileSql.replace('LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;',''),'no catalog serialization');
    const late=profileSql.replace(profileSupplement,'').replace('COMMIT;',profileSupplement+'\nCOMMIT;');
    assert.ok(rollbackSignatureGuards(late).every(g=>!g.profile_fingerprint),'post-mutation block earns no precondition metadata');
    const bare=profileSql.replace(profileSupplement,'');assert.deepEqual(guardedRestorations(bare),profileNames);assert.ok(rollbackSignatureGuards(bare).every(g=>!g.profile_fingerprint));
});
test('every full-profile, default, body, owner and ACL predicate is mandatory in the finite supplemental shape',()=>{
    const condition=profileSupplement.match(/    WHERE ([\s\S]*?)\n  \) THEN/)[1],tokens=sqlTokens(condition),parts=[];let depth=0,start=0;
    for(let i=0;i<tokens.length;i++){
        if(tokens[i].kind==='symbol'&&tokens[i].value==='(')depth++;
        if(tokens[i].kind==='symbol'&&tokens[i].value===')')depth--;
        if(tokens[i].kind==='word'&&tokens[i].value==='or'&&depth===0){parts.push(tokens.slice(start,i));start=i+1;}
    }
    parts.push(tokens.slice(start));assert.equal(parts.length,31);
    for(let i=0;i<parts.length;i++)changeProfile(condition,parts.filter((_,j)=>j!==i).map(tokenText).join(' OR '),'missing '+tokenText(parts[i]));
});
test('default expectations are literal NULL casts bound to trailing typed inputs and exact row counts',()=>{
    for(const [from,to] of [
        [",2,'NULL::text, NULL::uuid'",",7,'NULL::text, NULL::uuid'"],
        [",2,'NULL::text, NULL::uuid'",",1,'NULL::text, NULL::uuid'"],
        ["'NULL::text, NULL::uuid'","'NULL::uuid, NULL::uuid'"],
        ["'NULL::text, NULL::uuid'","public.guard_side_effect()"],
        ["'NULL::text, NULL::uuid'","'public.guard_side_effect(), NULL::uuid'"],
        ["'public.allocate_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid)'","'public.unrelated(uuid,uuid,bigint,text,text,uuid)'"],
        ["'public.allocate_ad_campaign_budget(uuid,uuid,bigint,text,text,uuid)'","'public.allocate_ad_campaign_budget(uuid,uuid,text,text,text,uuid)'"],
    ])changeProfile(from,to);
    const row=profileSupplement.split('\n').find(line=>line.includes("('public.allocate_ad_campaign_budget("));
    changeProfile(row+'\n','', 'missing supplemental row');changeProfile(row,row+'\n'+row,'duplicate supplemental row');
});
test('both digest cells and their current-body binding stay finite and complete',()=>{
    for(const [from,to] of [
        ["'ac770e6839cde7baafb974da21b73155'","public.guard_side_effect()"],
        ["'2bda47bf30f064d1c794427f7cf9dd44'","'not-a-digest'"],
        ["'ac770e6839cde7baafb974da21b73155','2bda47bf30f064d1c794427f7cf9dd44'","'ac770e6839cde7baafb974da21b73155'"],
        ['pg_catalog.md5(p.prosrc)','pg_catalog.md5(p.proname)'],
        ['NOT IN(expected.first_md5,expected.second_md5)','NOT IN(expected.first_md5)'],
        ['expected.second_md5','unrelated.second_md5'],
    ])changeProfile(from,to);
});
test('profile catalog calls, qualification, joins and privilege bindings reject every unknown substitution',()=>{
    for(const [from,to] of [
        ['pg_catalog.pg_get_expr','public.pg_get_expr'],['pg_catalog.pg_get_expr','pg_get_expr'],
        ['pg_catalog.to_regprocedure','public.to_regprocedure'],['pg_catalog.to_regrole','public.to_regrole'],
        ['pg_catalog.md5','public.md5'],['pg_catalog.aclexplode','public.aclexplode'],
        ['pg_catalog.acldefault','public.acldefault'],['pg_catalog.has_function_privilege','public.has_function_privilege'],
        ['LEFT JOIN pg_catalog.pg_proc','JOIN pg_catalog.pg_proc'],['LEFT JOIN pg_catalog.pg_proc','LEFT JOIN public.pg_proc'],
        ['p.oid=pg_catalog.to_regprocedure(expected.signature)','p.oid=p.oid'],
        ["'app_tenant'::regrole::oid","'authenticated'::regrole::oid"],
        ["'anon',p.oid,'EXECUTE'","'anon',p.oid,'USAGE'"],
        ['a.grantor=p.proowner','a.grantor=a.grantor'],['a.is_grantable','public.guard_side_effect()'],
    ])changeProfile(from,to);
});
test('supplemental profile blocks cannot hide expressions, mutation, initializer or additional branches',()=>{
    for(const [from,to] of [
        ['BEGIN','DECLARE unused text[] := ARRAY[public.guard_side_effect()]; BEGIN'],
        ['BEGIN','BEGIN PERFORM public.guard_side_effect();'],
        ['BEGIN',"BEGIN EXECUTE 'DELETE FROM public.probe';"],
        ['BEGIN','BEGIN SELECT public.guard_side_effect();'],
        ['IF EXISTS','IF public.guard_side_effect() OR EXISTS'],
        ['RAISE EXCEPTION \'forward355 refuses unknown defaults/body/profile/owner/privileges\'','RAISE EXCEPTION \'profile\',public.guard_side_effect()'],
        ['  END IF;',"  ELSIF public.guard_side_effect() THEN RAISE EXCEPTION 'extra'; END IF;"],
        ['  END IF;',"  ELSE RAISE EXCEPTION 'extra'; END IF;"],
    ])changeProfile(from,to);
    rejectProfile(profileSql.replace('BEGIN;',''),'missing transaction');rejectProfile(profileSql.replace('COMMIT;',''),'missing commit');
});

import {createHash as retirementBodyHash} from 'node:crypto';
const retirementGrammarFixture=()=>read('346_product_atomic_edits.rollback.sql');
function retirementProfileChange(sql,change,{refreshBodies=false}={}) {
    const match=sql.match(/\$known346\$([\s\S]*?)\$known346\$::jsonb/);assert.ok(match);
    const profile=JSON.parse(match[1]);change(profile);
    if(refreshBodies)for(const fn of Object.values(profile.functions))fn.body_md5=retirementBodyHash('md5').update(fn.prosrc).digest('hex');
    return sql.replace(match[0],()=>'$known346$'+JSON.stringify(profile)+'$known346$::jsonb');
}
function retirementRename(sql) {
    const names={apply_product_edit_v1:'synthetic_apply',read_product_for_edit_v1:'synthetic_read',assert_product_edit_actor_v1:'synthetic_actor',product_edit_snapshot_v1:'synthetic_snapshot',bump_product_edit_revision_v1:'synthetic_bump',guard_product_edit_receipt_v1:'synthetic_immutable',product_edit_receipts:'synthetic_journal',product_options:'synthetic_alpha',product_variants:'synthetic_beta'};
    for(const column of ['operation','expected_version','mutation','response'])names['product_edit_receipts_'+column+'_check']='synthetic_journal_'+column+'_check';
    names.product_edit_receipts_pkey='synthetic_journal_pkey';names.product_edit_receipts_product_idx='synthetic_journal_product_idx';names.product_edit_receipts_immutable='synthetic_journal_immutable';names.product_options_edit_revision='synthetic_alpha_edit_revision';names.product_variants_edit_revision='synthetic_beta_edit_revision';
    for(const [from,to] of Object.entries(names).sort((a,b)=>b[0].length-a[0].length))sql=sql.replace(new RegExp('(?<![a-z0-9_])'+from+'(?![a-z0-9_])','g'),to);
    return retirementProfileChange(sql,()=>{},{refreshBodies:true});
}
test('finite literal receipt grammar binds full guard without file/function names, labels, whitespace or input-name dependence',(t)=>{
    const source=retirementGrammarFixture();
    const renamedArgs=retirementProfileChange(source.replaceAll('p_store_id','p_scope_id'),()=>{},{refreshBodies:true});
    const variants=[source,'-- Arbitrary source comment\n'+source,source.replaceAll('$rollback_','$other_').replaceAll('$known346$','$literal_data$'),source.replaceAll('LOCK TABLE','lock  table'),renamedArgs,retirementRename(source)];
    const primary=source.match(/DO \$rollback_precondition\$[\s\S]*?END \$rollback_precondition\$;/)[0];
    const typedOnly=rollbackSignatureGuards('BEGIN; LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE; '+primary+' DROP FUNCTION public.read_product_for_edit_v1(uuid,uuid,uuid); COMMIT;');
    assert.equal(typedOnly.length,6);assert.ok(typedOnly.every(g=>!g.catalog_retention_profile),'typed6 alone must never claim the full retirement certificate');
    for(const [variant,sql] of variants.entries()) {
        const guards=rollbackSignatureGuards(sql);assert.equal(guards.length,6,'positive variant '+variant);assert.ok(guards.every(g=>g.quiescence_guard&&g.body_fingerprint&&g.catalog_retention_profile?.retained_rows_refused&&g.catalog_retention_profile?.foreign_dependencies_refused));
    }
    t.diagnostic(JSON.stringify({accepted_variants:6,typed_only_is_not_full_certificate:true}));
});
test('finite literal receipt grammar refuses primary, prefix, metadata, lock, effect and dependency weakening',(t)=>{
    const source=retirementGrammarFixture();
    const mutateProfile=change=>sql=>retirementProfileChange(sql,change);
    const cases=[
        ["function ACL boundary",sql=>sql.replace("pg_catalog.aclexplode(CASE WHEN pg_catalog.cardinality(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner)))=0 THEN NULL::pg_catalog.aclitem[] ELSE coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner)) END)","pg_catalog.aclexplode(CASE WHEN pg_catalog.cardinality(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner)))>=0 THEN NULL::pg_catalog.aclitem[] ELSE coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner)) END)")],
        ["receipt ACL boundary",sql=>sql.replace("pg_catalog.aclexplode(CASE WHEN pg_catalog.cardinality(coalesce(r.relacl,CASE WHEN r.relkind='r' THEN pg_catalog.acldefault('r',r.relowner) ELSE '{}'::pg_catalog.aclitem[] END))=0 THEN NULL::pg_catalog.aclitem[] ELSE coalesce(r.relacl,CASE WHEN r.relkind='r' THEN pg_catalog.acldefault('r',r.relowner) ELSE '{}'::pg_catalog.aclitem[] END) END)","pg_catalog.aclexplode(CASE WHEN pg_catalog.cardinality(coalesce(r.relacl,CASE WHEN r.relkind='r' THEN pg_catalog.acldefault('r',r.relowner) ELSE '{}'::pg_catalog.aclitem[] END))>=0 THEN NULL::pg_catalog.aclitem[] ELSE coalesce(r.relacl,CASE WHEN r.relkind='r' THEN pg_catalog.acldefault('r',r.relowner) ELSE '{}'::pg_catalog.aclitem[] END) END)")],
        ["index ACL boundary",sql=>{const needle="pg_catalog.aclexplode(CASE WHEN pg_catalog.cardinality(coalesce(r.relacl,CASE WHEN r.relkind='r' THEN pg_catalog.acldefault('r',r.relowner) ELSE '{}'::pg_catalog.aclitem[] END))=0 THEN NULL::pg_catalog.aclitem[] ELSE coalesce(r.relacl,CASE WHEN r.relkind='r' THEN pg_catalog.acldefault('r',r.relowner) ELSE '{}'::pg_catalog.aclitem[] END) END)",at=sql.lastIndexOf(needle);assert.ok(at>=0);return sql.slice(0,at)+sql.slice(at).replace(needle,"pg_catalog.aclexplode(CASE WHEN pg_catalog.cardinality(coalesce(r.relacl,CASE WHEN r.relkind='r' THEN pg_catalog.acldefault('r',r.relowner) ELSE '{}'::pg_catalog.aclitem[] END))>=0 THEN NULL::pg_catalog.aclitem[] ELSE coalesce(r.relacl,CASE WHEN r.relkind='r' THEN pg_catalog.acldefault('r',r.relowner) ELSE '{}'::pg_catalog.aclitem[] END) END)");}],
        ["column ACL boundary",sql=>sql.replace("pg_catalog.aclexplode(CASE WHEN pg_catalog.cardinality(coalesce(t.attacl,'{}'::pg_catalog.aclitem[]))=0 THEN NULL::pg_catalog.aclitem[] ELSE coalesce(t.attacl,'{}'::pg_catalog.aclitem[]) END)","pg_catalog.aclexplode(CASE WHEN pg_catalog.cardinality(coalesce(t.attacl,'{}'::pg_catalog.aclitem[]))>=0 THEN NULL::pg_catalog.aclitem[] ELSE coalesce(t.attacl,'{}'::pg_catalog.aclitem[]) END)")],
        ['column empty ACL bypasses safe input',sql=>sql.replace("pg_catalog.aclexplode(CASE WHEN pg_catalog.cardinality(coalesce(t.attacl,'{}'::pg_catalog.aclitem[]))=0 THEN NULL::pg_catalog.aclitem[] ELSE coalesce(t.attacl,'{}'::pg_catalog.aclitem[]) END)","pg_catalog.aclexplode(coalesce(t.attacl,'{}'::pg_catalog.aclitem[]))")],
        ['ACL cardinality callee shadow',sql=>sql.replace('pg_catalog.cardinality(','public.cardinality(')],
        ['function ACL default binding',sql=>sql.replace("pg_catalog.acldefault('f',p.proowner)","pg_catalog.acldefault('r',p.proowner)")],
        ['missing profile membership SELECT close',sql=>sql.replace("WHERE rolname IN(current_user,'app_tenant','anon','authenticated','service_role')))\n)","WHERE rolname IN(current_user,'app_tenant','anon','authenticated','service_role'))\n)")],
        ['extra profile membership SELECT close',sql=>sql.replace("WHERE rolname IN(current_user,'app_tenant','anon','authenticated','service_role')))\n)","WHERE rolname IN(current_user,'app_tenant','anon','authenticated','service_role'))))\n)")],
        ['missing primary',sql=>sql.replace(/DO \$rollback_precondition\$[\s\S]*?END \$rollback_precondition\$;/,'')],
        ['family count weakened',sql=>sql.replace('v_count<>v_expected.overloads','false')],
        ['return ABI weakened',sql=>sql.replace('v_live.prorettype IS DISTINCT FROM v_expected.result_type::regtype','false')],
        ['primary hidden public effect',sql=>sql.replace('BEGIN\n IF pg_catalog.current_setting',"BEGIN\n IF EXISTS(SELECT 1 FROM public.synthetic_view) THEN RAISE EXCEPTION 'deny'; END IF;\n IF pg_catalog.current_setting")],
        ['catalog serialization missing',sql=>sql.replace('LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;','')],
        ['unsafe session path',sql=>sql.replace('SET LOCAL search_path=pg_catalog,public,pg_temp','SET LOCAL search_path=public,pg_catalog,pg_temp')],
        ['weak domain lock',sql=>sql.replace('IN ACCESS EXCLUSIVE MODE NOWAIT','IN SHARE ROW EXCLUSIVE MODE NOWAIT')],
        ['catalog lock removed',sql=>sql.replace(/LOCK TABLE pg_catalog\.pg_class[^;]*;/,'')],
        ['early COMMIT',sql=>sql.replace('DROP FUNCTION public.apply_product_edit_v1','COMMIT; BEGIN; DROP FUNCTION public.apply_product_edit_v1')],
        ['function metadata deparser shadow',sql=>sql.replace('pg_catalog.pg_get_expr(p.proargdefaults,0)','public.pg_get_expr(p.proargdefaults,0)')],
        ['unknown builtin effect',sql=>sql.replace('pg_catalog.jsonb_object_agg(p.proname','pg_catalog.pg_sleep(p.proname')],
        ['custom type cast',sql=>sql.replace("'pg_catalog.now()'::regprocedure::oid","'pg_catalog.now()'::public.synthetic_type")],
        ['PERFORM before metadata',sql=>sql.replace('DO $rollback_retention_profile$\nBEGIN',"DO $rollback_retention_profile$\nBEGIN PERFORM public.synthetic_effect();")],
        ['safe-deparse preflight missing',sql=>sql.replace(/DO \$rollback_safe_catalog_deparse\$[\s\S]*?END \$rollback_safe_catalog_deparse\$;/,'')],
        ['unknown raw-node shape',sql=>sql.replace(':funcid @now',':funcid @unknown')],
        ['metadata compare inverted',sql=>sql.replace(') IS DISTINCT FROM $known346$',') IS NOT DISTINCT FROM $known346$')],
        ['live selfapproval',sql=>sql.replace(/\$known346\$[\s\S]*?\$known346\$::jsonb/,"(SELECT pg_catalog.to_jsonb(r) FROM pg_catalog.pg_class r LIMIT 1)")],
        ['retained rows removed',sql=>sql.replace(/ IF EXISTS\(SELECT 1 FROM public\.product_edit_receipts\) THEN RAISE EXCEPTION '[^']*'; END IF;/,'')],
        ['filtered retained rows',sql=>sql.replace('IF EXISTS(SELECT 1 FROM public.product_edit_receipts)','IF EXISTS(SELECT 1 FROM public.product_edit_receipts WHERE false)')],
        ['foreign closure weakened',sql=>sql.replace("SELECT\n EXISTS(SELECT 1 FROM pg_catalog.pg_depend d WHERE (d.refclassid", "SELECT\n false AND EXISTS(SELECT 1 FROM pg_catalog.pg_depend d WHERE (d.refclassid")],
        ['owner false in declared profile',mutateProfile(p=>p.functions.apply_product_edit_v1.owner_valid=false)],
        ['OUT profile declaration',mutateProfile(p=>p.functions.apply_product_edit_v1.proallargtypes=['uuid'])],
        ['default declaration',mutateProfile(p=>p.functions.apply_product_edit_v1.pronargdefaults=1)],
        ['body fingerprint mismatch',mutateProfile(p=>p.functions.apply_product_edit_v1.prosrc+='\n-- Unknown body\n')],
        ['ACL declaration widened',mutateProfile(p=>p.functions.apply_product_edit_v1.acl.synthetic={grantee:'anon',grantor:'$owner',privilege:'EXECUTE',grantable:false})],
        ['table RLS weakened',mutateProfile(p=>p.receipt.relrowsecurity=false)],
        ['unknown semantic role',mutateProfile(p=>p.roles.synthetic={super:true})],
        ['expected constraint missing',mutateProfile(p=>delete p.constraints.product_edit_receipts_mutation_check)],
        ['extra function declaration',mutateProfile(p=>p.functions.synthetic=p.functions.apply_product_edit_v1)],
        ['356-style dependency selfapproval',mutateProfile(p=>{const edge=JSON.parse(JSON.stringify(Object.values(p.dependencies)[0]));edge.object={type:'default value',schema:null,name:null,identity:'for public.inventory_adjustment_receipts.authority_guard'};p.dependencies.synthetic=edge;})],
        ['unrecognized postguard SQL',sql=>sql.replace('DROP FUNCTION public.apply_product_edit_v1',"SELECT public.synthetic_effect(); DROP FUNCTION public.apply_product_edit_v1")],
        ['second literal profile',sql=>sql.replace('COMMIT;',"DO $extra$ BEGIN IF '{}'::jsonb IS DISTINCT FROM $another${\"functions\":{},\"receipt\":{}}$another$::jsonb THEN RAISE EXCEPTION 'deny'; END IF; END $extra$; COMMIT;")],
    ];
    for(const [label,change] of cases) {
        const altered=change(source);assert.notEqual(altered,source,label+' must change actual source');assert.deepEqual(rollbackSignatureGuards(altered),[],label);
    }
    t.diagnostic(JSON.stringify({rejected_mutations:cases.map(([label])=>label)}));
});

// N7 full traversal guard: the unstripped transaction must earn its complete
// catalog/effect certificate. These controls do not execute PostgreSQL.
const traversalGuardFixture=()=>read('349_money_ledger_reconciliation_traversal.rollback.sql');
// Format executable words only. Changing text inside fixed dynamic SQL or a
// declared catalog profile is a different source program, not mere formatting.
const rewriteTraversalWords=(source,change)=>{
    const edits=[];
    for(const token of sqlTokens(source)) {
        if(token.kind==='word') {
            const value=change(token.value,source.slice(token.start,token.end));
            if(value!==source.slice(token.start,token.end))edits.push([token.start,token.end,value]);
        } else if(token.kind==='body'&&/^\s*(?:DECLARE|BEGIN)\b/i.test(token.value)) {
            const width=(token.end-token.start-token.value.length)/2;
            edits.push([token.start+width,token.end-width,rewriteTraversalWords(token.value,change)]);
        }
    }
    for(const [start,end,value] of edits.reverse())source=source.slice(0,start)+value+source.slice(end);
    return source;
};
const changeTraversalProfile=change=>source=>source.replace(/\$frozen349\$([\s\S]*?)\$frozen349\$/,(whole,json)=>{
    const profile=JSON.parse(json);change(profile);return '$frozen349$'+JSON.stringify(profile)+'$frozen349$';
});
test('full two-family traversal transaction earns one complete certificate',()=>{
    const proof=rollbackSignatureGuards(traversalGuardFixture());assert.equal(proof.length,1);
    assert.equal(proof[0].identity,'public.run_money_ledger_reconciliation_batch_v1(text,integer)');
    assert.deepEqual(proof[0].input_names,['p_request_key','p_limit']);
    assert.equal(proof[0].catalog_retention_profile.kind,'closed-literal-traversal-profile');
    assert.equal(proof[0].catalog_retention_profile.relations.length,2);
    assert.equal(proof[0].catalog_retention_profile.prepared_before_locks,true);
    assert.equal(proof[0].catalog_retention_profile.final_quiescence_recheck,true);
    assert.equal(proof[0].catalog_retention_profile.retained_rows_refused,true);
    assert.equal(proof[0].catalog_retention_profile.foreign_dependencies_refused,true);
    assert.match(proof[0].body_fingerprint.definition_sha256,/^[0-9a-f]{64}$/);
});
test('complete traversal variants bind identities and metadata rather than source hash or filename',()=>{
    const source=traversalGuardFixture();
    const variants=[
        ['comments and spacing','-- DROP TABLE public.sites; is only a comment\n'+rewriteTraversalWords(source,(word,raw)=>word==='select'?'SELECT\n  ':raw)],
        ['keyword casing',rewriteTraversalWords(source,(word,raw)=>['select','begin','commit'].includes(word)?word:raw)],
        ['dollar delimiters',source.replaceAll('$retirement349$','$other_body$').replaceAll('$prepared349$','$before_locks$')],
        ['bound synthetic identities',source.replaceAll('money_ledger_reconciliation_','synthetic_traversal_')],
        ['literal object key order',changeTraversalProfile(p=>{p.function=Object.fromEntries(Object.entries(p.function).reverse());p.namespace=Object.fromEntries(Object.entries(p.namespace).reverse());})(source)],
        ['different fixed fingerprint',changeTraversalProfile(p=>p.function.definition_sha256='a'.repeat(64))(source)],
        ['literal refusal text',source.replace(/RAISE EXCEPTION '[^']*'/g,"RAISE EXCEPTION 'Reviewed refusal'")],
    ];
    for(const [label,variant] of variants){assert.notEqual(variant,source,label);const proof=rollbackSignatureGuards(variant);assert.equal(proof.length,1,label);assert.equal(proof[0].catalog_retention_profile.kind,'closed-literal-traversal-profile',label);}
});
const traversalNegativeCases=[
 ['missing pre-lock prepared check',s=>s.replace(/DO \$prepared349\$[\s\S]*?END \$prepared349\$;/,'')],
 ['filtered prepared catalog',s=>s.replace('IF EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts) THEN','IF EXISTS(SELECT 1 FROM pg_catalog.pg_prepared_xacts WHERE false) THEN')],
 ['prepared shadow view',s=>s.replace('pg_catalog.pg_prepared_xacts','public.pg_prepared_xacts')],
 ['missing final quiescence',s=>s.replace(/DO \$final_quiescence349\$[\s\S]*?END \$final_quiescence349\$;/,'')],
 ['final prepared check removed',s=>s.replace(/(DO \$final_quiescence349\$\s*BEGIN)[\s\S]*?( IF EXISTS\(SELECT 1 FROM pg_catalog.pg_locks)/,'$1\n$2')],
 ['catalog lock absent',s=>s.replace(/LOCK TABLE pg_catalog\.pg_proc[\s\S]*?IN SHARE ROW EXCLUSIVE MODE NOWAIT;/,'')],
 ['catalog NOWAIT absent',s=>s.replace('IN SHARE ROW EXCLUSIVE MODE NOWAIT;','IN SHARE ROW EXCLUSIVE MODE;')],
 ['domain lock weak',s=>s.replace('IN ACCESS EXCLUSIVE MODE NOWAIT','IN SHARE MODE NOWAIT')],
 ['unknown SELECT effect',s=>s.replace('DROP FUNCTION public.run_money_ledger_reconciliation_batch_v1','SELECT public.synthetic_effect(); DROP FUNCTION public.run_money_ledger_reconciliation_batch_v1')],
 ['unknown builtin effect',s=>s.replace('DROP FUNCTION public.run_money_ledger_reconciliation_batch_v1','SELECT pg_catalog.pg_sleep(1); DROP FUNCTION public.run_money_ledger_reconciliation_batch_v1')],
 ['unknown financial mutation',s=>s.replace('DROP FUNCTION public.run_money_ledger_reconciliation_batch_v1','DELETE FROM public.wallet_ledger_entries; DROP FUNCTION public.run_money_ledger_reconciliation_batch_v1')],
 ['unknown nested effect',s=>s.replace('BEGIN\n -- Native CREATE','BEGIN\n PERFORM public.synthetic_effect();\n -- Native CREATE')],
 ['cascading retirement',s=>s.replaceAll(' RESTRICT;',' CASCADE;')],
 ['conditional retirement',s=>s.replace('DROP FUNCTION public.run_money_ledger_reconciliation_batch_v1','DROP FUNCTION IF EXISTS public.run_money_ledger_reconciliation_batch_v1')],
 ['early transaction commit',s=>s.replace('DROP FUNCTION public.run_money_ledger_reconciliation_batch_v1','COMMIT; BEGIN; DROP FUNCTION public.run_money_ledger_reconciliation_batch_v1')],
 ['shared sites table retirement',s=>s.replace('DROP INDEX public.money_ledger_reconciliation_sites_order_idx RESTRICT;','DROP TABLE public.sites RESTRICT;')],
 ['one retained family removed',s=>s.replace('  OR EXISTS(SELECT 1 FROM public.money_ledger_reconciliation_traversal) THEN',' THEN')],
 ['retained families changed to AND',s=>s.replace('  OR EXISTS(SELECT 1 FROM public.money_ledger_reconciliation_traversal) THEN','  AND EXISTS(SELECT 1 FROM public.money_ledger_reconciliation_traversal) THEN')],
 ['soft-deleted receipt bypass',s=>s.replace('IF EXISTS(SELECT 1 FROM public.money_ledger_reconciliation_batches)','IF EXISTS(SELECT 1 FROM public.money_ledger_reconciliation_batches WHERE deleted_at IS NULL)')],
 ['profile comparison inverted',s=>s.replace('IF actual_profile IS DISTINCT FROM expected_profile','IF actual_profile IS NOT DISTINCT FROM expected_profile')],
 ['live profile selfapproval',s=>s.replace(/\$frozen349\$[\s\S]*?\$frozen349\$::jsonb/,'(SELECT to_jsonb(c) FROM pg_class c LIMIT 1)')],
 ['fingerprint missing',changeTraversalProfile(p=>delete p.function.definition_sha256)],
 ['fingerprint malformed',changeTraversalProfile(p=>p.function.definition_sha256='not-a-hash')],
 ['profile ACL wider',changeTraversalProfile(p=>p.function.acl.push('anon=X/postgres'))],
 ['literal FORCE RLS missing',changeTraversalProfile(p=>p.tables[0].force_rls=false)],
 ['literal column missing',changeTraversalProfile(p=>p.tables[0].columns.pop())],
 ['literal unknown field',changeTraversalProfile(p=>p.allow_everything=true)],
 ['owner session bypass',s=>s.replace("current_user<>'postgres'",'false')],
 ['unsafe search path',s=>s.replace('SET LOCAL search_path=pg_catalog,public','SET LOCAL search_path=public,pg_catalog')],
 ['inherited role omitted',s=>s.replace("ARRAY['anon','authenticated','app_tenant','service_role']","ARRAY['anon','app_tenant','service_role']")],
 ['native constraint kind fence removed',s=>s.replace("connoinherit IS DISTINCT FROM (contype IN('p','u'))",'false')],
 ['TOAST rule broadened',s=>s.replace('a.attrelid IN(SELECT reltoastrelid FROM pg_catalog.pg_class WHERE oid=ANY(tables))','true')],
 ['column ACL omitted',s=>s.replace('a.attisdropped OR a.attacl IS NOT NULL OR','a.attisdropped OR')],
 ['external dependency inversion',s=>s.replace('WHERE NOT EXISTS(SELECT 1 FROM addresses b','WHERE EXISTS(SELECT 1 FROM addresses b')],
 ['journal identity changed',s=>s.replace("migration=''349''","migration=''348''")],
 ['unknown function family admitted',s=>s.replace("p.proname LIKE 'run_money_ledger_reconciliation_batch%'","p.proname LIKE '%'")],
 ['metadata callee shadowed',s=>s.replace('pg_get_functiondef(oid)','public.pg_get_functiondef(oid)')],
 ['quoted identifier impersonates keyword',s=>s.replace('SELECT array_agg(t.oid','"select" array_agg(t.oid')],
 ['prepared check after locks',s=>{const block=s.match(/DO \$prepared349\$[\s\S]*?END \$prepared349\$;/)[0];return s.replace(block,'').replace('DO $retirement349$',block+'\nDO $retirement349$');}],
 ['source guard only in comment',s=>'/* '+s+' */\nBEGIN; DROP FUNCTION public.run_money_ledger_reconciliation_batch_v1(text,integer); COMMIT;'],
];
for(const [label,change] of traversalNegativeCases)test('full traversal rejects '+label,()=>{
 const source=traversalGuardFixture(),altered=change(source);assert.notEqual(altered,source,'mutation must reach actual source');
 assert.deepEqual(rollbackSignatureGuards(altered),[],label);
});

test('separate missing-function and ABI refusals cannot lose a predicate or move after mutation',()=>{
    const name=rollbackFiles().find(file=>number(file)===347),sql=read(name);
    assert.equal(guardedRestorations(sql).length,4);
    for(const [before,after] of [
        ['live.proargnames[1:live.pronargs] IS DISTINCT FROM expected.input_names','false'],
        ["live.prorettype IS DISTINCT FROM 'jsonb'::regtype",'false'],
        ['OR live.proretset','OR false'],
        ['pg_catalog.to_regprocedure(expected.signature) IS NULL','false'],
        ["other.proname=live.proname)<>1","other.proname=live.proname)<>2"],
    ]){
        assert.ok(sql.includes(before));assert.deepEqual(guardedRestorations(sql.replace(before,after)),[]);
    }
});

test('historical full-definition guards require custody, every restored ABI, and an unbypassable member check',()=>{
    const name=rollbackFiles().find(file=>number(file)===360),sql=read(name);
    const forwardSql=readFileSync(join(rollbackDir,'../migrations',name.replace('.rollback.sql','.sql')),'utf8');
    const guarded=source=>guardedRestorations(source,{forwardSql});
    assert.equal(guarded(sql).length,4);
    const mutations=[
        ["v_journal.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(pg_get_functiondef(v_fn.oid),'UTF8')),'hex')",'false'],
        ["v_fn.oid IS DISTINCT FROM (v_entry.value->>'oid')::oid",'false'],
        ["(v_entry.key<>'public.guard_subscription_tax_ddl_360()' AND encode(sha256(convert_to(pg_get_functiondef(v_fn.oid),'UTF8')),'hex') IS DISTINCT FROM v_entry.value->>'definition_hash')",'false'],
        ["proname=v_fn.proname)<>1","proname=v_fn.proname)<>2"],
        ["jsonb_each(binding->'functions') LOOP","jsonb_each('{}'::jsonb) LOOP"],
        ["SELECT * INTO v_fn FROM pg_proc WHERE oid=to_regprocedure(v_entry.key);","RETURN; SELECT * INTO v_fn FROM pg_proc WHERE oid=to_regprocedure(v_entry.key);"],
        ["SET LOCAL search_path=pg_catalog,public;","SET LOCAL search_path=public,pg_catalog;"],
        ["v_fn.proargmodes IS NOT NULL",'false'],
        ["p_actor uuid,p_site uuid,p_key text,p_request jsonb,p_quote jsonb DEFAULT NULL", "p_other uuid,p_site uuid,p_key text,p_request jsonb,p_quote jsonb DEFAULT NULL"],
    ];
    for(const [before,after] of mutations){assert.ok(sql.includes(before),before);assert.deepEqual(guarded(sql.replace(before,after)),[],before);}
    assert.deepEqual(guardedRestorations(sql),[],'no forward binding source means no historical proof');
    assert.deepEqual(guardedRestorations(sql,{forwardSql:forwardSql.replace("'claim_merchant_subscription_checkout_v1','public.claim_merchant_subscription_checkout_v1", "'other_checkout','public.other_checkout")}),[]);
});

test('visibility rollback earns full typed profile proof; stripped and forged guards do not', () => {
    for (const name of ['366_theme_publication_visibility.rollback.sql','376_atomic_theme_instance_switch.rollback.sql']) {
    const sql=read(name);
    const forwardSql=readFileSync(join(rollbackDir,'../migrations/366_theme_publication_visibility.sql'),'utf8');
    assert.deepEqual(guardedRestorations(sql,{forwardSql}),['publish_theme_release']);
    const terms=[
        'p.oid IS NULL', "p.prokind<>'f'", 'NOT p.proretset', 'NOT p.prosecdef', 'p.pronargdefaults<>7', 'p.provariadic<>0',
        "p.provolatile<>'v'", 'p.proisstrict', 'p.proleakproof', "p.proparallel<>'u'", 'p.procost IS DISTINCT FROM 100::real', 'p.prorows IS DISTINCT FROM 1000::real',
        'p.prosupport<>0', 'p.probin IS NOT NULL', 'p.prosqlbody IS NOT NULL', 'p.protrftypes IS NOT NULL',
        '(SELECT count(*) FROM pg_catalog.pg_proc q WHERE q.pronamespace=p.pronamespace AND q.proname=p.proname)<>1',
        "p.proconfig IS DISTINCT FROM ARRAY['search_path=public']::text[]",
        "pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE')", "pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')",
        "NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')", `pg_catalog.md5(p.prosrc)<>'${name.startsWith('376')?'56a6b7b15e8a7ec159341fe0331ac593':'8a1479af8ced3bbdb3cd6cc21d957f42'}'`,
    ];
    for(const term of terms){assert.ok(sql.includes(term),term);assert.deepEqual(guardedRestorations(sql.replace(term,'false'),{forwardSql}),[],term+' cannot be removed');}
    for(const [before,after] of [
        ['p.proargnames IS DISTINCT FROM','p.proargnames IS NOT DISTINCT FROM'],
        ['p.proallargtypes IS DISTINCT FROM','p.proallargtypes IS NOT DISTINCT FROM'],
        ['p.proargmodes IS DISTINCT FROM','p.proargmodes IS NOT DISTINCT FROM'],
        ['pg_catalog.pg_get_expr(p.proargdefaults,0)','public.pg_get_expr(p.proargdefaults,0)'],
        ["'public.theme_instances'::regclass","'public.sites'::regclass"],
        ['pg_catalog.md5(p.prosrc)','public.md5(p.prosrc)'],
        ['LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;',''],
        ["RAISE EXCEPTION 'Theme publication", "RAISE WARNING 'Theme publication"],
    ]){assert.ok(sql.includes(before),before);assert.deepEqual(guardedRestorations(sql.replace(before,after),{forwardSql}),[],before+' cannot be substituted');}
    assert.deepEqual(guardedRestorations(sql.replace('DO $visibility_shape$', 'CREATE TABLE public.synthetic_before_guard(id integer);\nDO $visibility_shape$'),{forwardSql}),[]);
    }
});

test('metadata rollback requires every reviewed profile, overload and private ACL token',()=>{
 const sql=read('371_storefront_access_metadata.rollback.sql');
 assert.deepEqual(guardedRestorations(sql),['read_published_storefront_site_v1']);
 for(const [before,after] of [
  ['p.proowner<>','p.proowner='],['OR NOT p.prosecdef','OR p.prosecdef'],
  ["'p_id_only'","'p_other'"],["'authenticator'","'authenticated'"],
  ['p.oid IS DISTINCT FROM target','p.oid IS NOT DISTINCT FROM target'],
  ["'597f30ae0ceee9df27a453fee9cc0991'","'00000000000000000000000000000000'"],
  ['LOCK TABLE pg_catalog.pg_proc IN SHARE ROW EXCLUSIVE MODE;',''],
  ['RAISE EXCEPTION','RAISE WARNING']
 ]) {assert.ok(sql.includes(before));assert.deepEqual(guardedRestorations(sql.replace(before,after)),[],before);}
});

test('current cart snapshot rollback retains four complete ABI proofs and refuses forged predicates',()=>{
 const original=read(PROFILE_GUARDED[0]);
 assert.equal(guardedRestorations(original).length,4);
 for(const [before,after] of [
  ['live.proargnames IS DISTINCT FROM expected.input_names','false'],
  ["pg_catalog.has_function_privilege('anon',live.oid,'EXECUTE')",'false'],
  ["(SELECT count(*) FROM pg_catalog.pg_proc other WHERE other.pronamespace=live.pronamespace AND other.proname=live.proname)<>1",'false'],
  ["RAISE EXCEPTION '388 rollback refuses changed typed ABI or API role authority'","RAISE WARNING '388 rollback refuses changed typed ABI or API role authority'"],
  ["j.object_definition_hash IS DISTINCT FROM encode(sha256(convert_to(pg_get_functiondef(p.oid),'UTF8')),'hex')",'false'],
 ]) {
  assert.ok(original.includes(before),before);
  assert.deepEqual(guardedRestorations(original.replace(before,after)),[],before);
 }
});
