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

const CANDIDATE_GUARDED = [280,285,288,291,293,294,296,303,305];

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
        createdFunctions(read(name)).includes('create_checkout_order') && !GUARDED.includes(name));
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
        const guarded = new Set(guardedRestorations(sql));
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
    assert.equal(restorers,13);
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
