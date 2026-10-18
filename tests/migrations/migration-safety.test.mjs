import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFileSync, mkdtempSync, mkdirSync, copyFileSync, writeFileSync, unlinkSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname, basename } from "node:path";
import { createHash } from "node:crypto";
import { stripTruncateGuardDeclarations } from "../../scripts/validators/migration-safety-validator.mjs";

test("Supabase migration history is replay-safe against destructive table operations", () => {
  const result = spawnSync(process.execPath, ["scripts/validators/migration-safety-validator.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});


test("TRUNCATE guard declarations are recognized without hiding executable destructive SQL", () => {
  const guards = "CREATE TRIGGER deny_truncate BEFORE TRUNCATE ON public.collection_membership_receipts FOR EACH STATEMENT EXECUTE FUNCTION public.reject_mutation(); IF TG_OP='TRUNCATE' THEN RAISE EXCEPTION 'retained'; END IF;";
  assert.doesNotMatch(stripTruncateGuardDeclarations(guards), /\bTRUNCATE\b/i);
  for (const destructive of ["TRUNCATE public.collections;", "TRUNCATE TABLE public.collections CASCADE;", "EXECUTE 'TRUNCATE public.collections';", "EXECUTE $cmd$TRUNCATE public.collections$cmd$;", "EXECUTE 'TRUNCATE'||target_table;", "EXECUTE (ARRAY['TRUNCATE','SELECT'])[1]||target_table;", "SELECT 'TRUNCATE';", guards + " TRUNCATE public.collections;"]) {
    assert.match(stripTruncateGuardDeclarations(destructive), /\bTRUNCATE\b/i, destructive);
  }
});

test("current361 protection events do not masquerade as destructive statements", () => {
  const source=readFileSync("database/supabase/migrations/361_collection_membership.sql", "utf8");
  assert.match(source, /CREATE TRIGGER collection_membership_receipts_no_truncate BEFORE TRUNCATE/);
  assert.doesNotMatch(stripTruncateGuardDeclarations(source.replace(/--.*$/gm, "")), /\bTRUNCATE\b/i);
});

test("migration validator includes untracked source without staging or changing Git ownership", () => {
  const maintainedRoot=process.cwd();
  const staticInputs=[
    "scripts/validators/migration-safety-validator.mjs", "scripts/validators/governance-common.mjs",
    "docs/governance/migration-replayability.md", "database/supabase/config.toml",
    "scripts/migration/run-hot-table-partition-maintenance.mjs", ".github/workflows/hot-table-partition-maintenance.yml",
    "infrastructure/deployment/migration-orchestration.yaml",
    ...["000_baseline.sql","079_partition_worker_request_logs.sql","090_custom_domains_and_store_access.sql",
      "114_mobile_onboarding_attempt_progress.sql","115_product_review_merchant_replies.sql","116_mobile_draft_orders.sql",
      "117_mobile_customer_notes_tags.sql","118_mobile_shipping_labels.sql","119_mobile_money_ledgers.sql",
      "120_mobile_kyc_documents.sql","121_mobile_merchant_2fa_factors.sql","122_mobile_business_profile.sql",
      "123_mobile_tax_rate_parity.sql","129_mobile_customer_segments.sql","130_orders_site_id_not_null.sql",
      "131_hot_table_partition_shadow_mirror.sql","132_mobile_whatsapp_commerce.sql","136_mobile_marketing_email_campaigns.sql",
      "137_mobile_storefront_localization.sql","138_mobile_store_metafields.sql","140_mobile_cod_reconciliation.sql",
      "158_order_items_tenant_scope.sql"].map(name=>"database/supabase/migrations/"+name),
  ];
  const hash=path=>createHash("sha256").update(readFileSync(path)).digest("hex");
  const beforeHashes=Object.fromEntries(staticInputs.map(path=>[path,hash(join(maintainedRoot,path))]));
  const env={...process.env,GIT_CONFIG_GLOBAL:"/dev/null",GIT_CONFIG_NOSYSTEM:"1",GIT_OPTIONAL_LOCKS:"0",GIT_TERMINAL_PROMPT:"0"};
  for(const name of ["GIT_DIR","GIT_WORK_TREE","GIT_INDEX_FILE","GIT_COMMON_DIR"])delete env[name];
  const git=(cwd,...args)=>spawnSync("git",["--no-optional-locks",...args],{cwd,env,encoding:"utf8"});
  const beforeStatus=git(maintainedRoot,"status","--porcelain=v1","--untracked-files=all");assert.equal(beforeStatus.status,0,beforeStatus.stderr);
  const temporary=mkdtempSync(join(tmpdir(),"letbuyy-migration-validator-untracked-"));
  const unsafeName="database/supabase/migrations/999_syn_unsafe_untracked.sql",safeName="database/supabase/migrations/999_syn_safe_guard_untracked.sql";
  try{
    // Only a dedicated temporary Git fixture receives these source copies.
    // No SQL is executed, and no source is staged/committed in any checkout.
    for(const path of staticInputs){const target=join(temporary,path);mkdirSync(dirname(target),{recursive:true});copyFileSync(join(maintainedRoot,path),target);}
    const initialized=git(temporary,"init","--quiet");assert.equal(initialized.status,0,initialized.stderr);
    const run=()=>spawnSync(process.execPath,["scripts/validators/migration-safety-validator.mjs"],{cwd:temporary,env,encoding:"utf8"});
    const clean=run();assert.equal(clean.status,0,clean.stderr||clean.stdout);
    writeFileSync(join(temporary,unsafeName),"TRUNCATE TABLE public.syn_untracked_guard;\n");
    const untracked=git(temporary,"status","--porcelain=v1","--untracked-files=all", "--",unsafeName);assert.equal(untracked.status,0,untracked.stderr);assert.equal(untracked.stdout.trim(),"?? "+unsafeName);
    assert.equal(git(temporary,"ls-files").stdout.trim(),"","Fixture has an empty Git index; no staging masks the untracked case");
    const unsafe=run();assert.notEqual(unsafe.status,0);assert.ok((unsafe.stderr+unsafe.stdout).includes(unsafeName),"The actual validator must name the unsafe untracked migration");assert.match(unsafe.stderr+unsafe.stdout,/TRUNCATE is forbidden/);
    unlinkSync(join(temporary,unsafeName));
    writeFileSync(join(temporary,safeName),"CREATE TABLE public.syn_untracked_guard(id integer);\nCREATE FUNCTION public.syn_guard_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF TG_OP='TRUNCATE' THEN RAISE EXCEPTION 'retained'; END IF; RETURN NULL; END $$;\nCREATE TRIGGER syn_guard BEFORE TRUNCATE ON public.syn_untracked_guard FOR EACH STATEMENT EXECUTE FUNCTION public.syn_guard_reject();\n");
    const safe=run();assert.equal(safe.status,0,safe.stderr||safe.stdout);assert.equal(git(temporary,"status","--porcelain=v1","--untracked-files=all","--",safeName).stdout.trim(),"?? "+safeName);
    assert.equal(git(temporary,"ls-files").stdout.trim(),"");
    console.info("MIGRATION_UNTRACKED_BEHAVIOR "+JSON.stringify({cleanExit:clean.status,unsafeExit:unsafe.status,unsafeNamed:true,safeGuardExit:safe.status,emptyIndex:true,temporaryOnly:true,SQLExecuted:false}));
  }finally{
    assert.ok(basename(temporary).startsWith("letbuyy-migration-validator-untracked-"));rmSync(temporary,{recursive:true,force:true});
    for(const[path,digest]of Object.entries(beforeHashes))assert.equal(hash(join(maintainedRoot,path)),digest,"Maintained source changed: "+path);
    const afterStatus=git(maintainedRoot,"status","--porcelain=v1","--untracked-files=all");assert.equal(afterStatus.status,0,afterStatus.stderr);assert.equal(afterStatus.stdout,beforeStatus.stdout,"Maintained Git status changed");
  }
});

test("closed ACL metadata reads retain destructive-statement protection", () => {
  const sql="IF a.privilege_type=ANY(ARRAY['INSERT','DELETE','TRUNCATE','TRIGGER']) THEN NULL; END IF; SELECT jsonb_object_agg(p,has_table_privilege('service_role',v_table,p)) INTO v_backend FROM unnest(ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) p;";
  assert.doesNotMatch(stripTruncateGuardDeclarations(sql), /\bTRUNCATE\b/i);
  assert.match(stripTruncateGuardDeclarations(sql+" EXECUTE (ARRAY['TRUNCATE','SELECT'])[1]||target_table;"), /\bTRUNCATE\b/i);
});


test("ACL guard recognition cannot hide dynamic or adjacent destructive SQL", () => {
  const metadata = "IF v_privs IS DISTINCT FROM ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']::text[] THEN RAISE EXCEPTION 'changed ACL'; END IF;";
  const reads = "SELECT has_table_privilege('service_role','public.migration_privilege_journal','SELECT,TRUNCATE');";
  assert.doesNotMatch(stripTruncateGuardDeclarations(metadata + reads), /\bTRUNCATE\b/i);
  for (const sql of [
    metadata + " TRUNCATE public.products;",
    reads + " EXECUTE 'TRUNCATE public.products';",
    "FOREACH v_priv IN ARRAY ARRAY['SELECT','TRUNCATE'] LOOP EXECUTE v_priv||' public.products'; END LOOP;",
    "FOREACH v_priv IN ARRAY ARRAY['SELECT','TRUNCATE'] LOOP IF v_priv=ANY(v_privs) THEN INSERT INTO public.migration_privilege_journal(migration) VALUES('999'); EXECUTE format('TRUNCATE %s',v_priv); END IF; END LOOP;",
  ]) assert.match(stripTruncateGuardDeclarations(sql), /\bTRUNCATE\b/i, sql);
});
