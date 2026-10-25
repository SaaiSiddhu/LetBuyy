import pathlib,json,re,hashlib,difflib
root=pathlib.Path(__file__).parent;repo=pathlib.Path('/Volumes/Projects/LetBuyy');inp=repo/'docs/implementation/niche-theme-programme/completion-2026-10-24/themes-shared-review-20261025-01/apparel-provenance-inputs01'
handoff=json.loads((inp/'CURRENT_SQL_INPUT_HANDOFF.json').read_text())
for pin in handoff['exactUPOrder']:
 assert hashlib.sha256((repo/pin['path']).read_bytes()).hexdigest()==pin['sha256']
def body(text):
 m=re.search(r'\bAS\s+(\$[A-Za-z_0-9]*\$)([\s\S]*?)\1',text,re.I);assert m;return m[2]
oldnames="ARRAY['toys','electronics','food','furniture','gifts','personalization','beauty','sports','books']"
newnames=oldnames[:-1]+",'apparel']"
specs=[]
for x,argc,defaults,args,config,owner_mode in [
 (handoff['savedNativeCartProfiles'][0],10,1,['p_site_id','p_cart_id','p_cart_token','p_expected_updated_at','p_line_id','p_operation_key','p_request_hash','p_buyer_account_id','p_buyer_session_epoch','p_replacement'],'search_path=public, pg_catalog','cart'),
 (handoff['orderWriterSourceReconstruction'],11,8,['p_store_id','p_customer_name','p_customer_email','p_customer_phone','p_shipping_address','p_items','p_payment_method','p_notes','p_coupon_code','p_actor_id','p_request_id'],'search_path=public','order')]:
 path=x['definitionFile'];text=(repo/path).read_text();before=body(text);assert hashlib.md5(before.encode()).hexdigest()==x['bodyMd5'];assert before.count(oldnames)==1
 after=before.replace(oldnames,newnames)
 specs.append(dict(name=x['name'],signature=x['signature'],before=before,after=after,beforeMd5=hashlib.md5(before.encode()).hexdigest(),afterMd5=hashlib.md5(after.encode()).hexdigest(),argc=argc,defaults=defaults,args=args,config=config,ownerMode=owner_mode,evidenceClass=x['evidenceClass']))
write=handoff['savedNativeCartProfiles'][1]
def quote(v):return "'"+v.replace("'","''")+"'"
def sql(direction):
 up=direction=='up';parts=['-- PRIVATE UNNUMBERED APPAREL PROPOSAL; NOT APPLIED. No new table, grants, or row rewrites.', '-- Baseline: full322/max393 + exact four admitted UPs in SQL_SOURCE_CONSERVATION.json.', '-- Order body/profile expectations are pinned-source constraints, not a claimed current native dump.', 'BEGIN;', 'DO $apparel_provenance$', 'DECLARE p pg_catalog.pg_proc%ROWTYPE; old_body text; next_body text; definition text; before_profile jsonb; after_profile jsonb;', 'BEGIN']
 for s in specs:
  old=s['before'] if up else s['after'];new=s['after'] if up else s['before'];expected=s['beforeMd5'] if up else s['afterMd5'];result=s['afterMd5'] if up else s['beforeMd5']
  parts += [f"  -- {s['name']}: replace one product-level whitelist and preserve every other byte.",f"  SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure({quote(s['signature'])});",
   f"  IF NOT FOUND OR pg_catalog.md5(p.prosrc)<>{quote(expected)} OR NOT p.prosecdef OR p.prokind<>'f'",
   f"    OR p.pronargs<>{s['argc']} OR p.pronargdefaults<>{s['defaults']} OR p.proretset OR p.prorettype<>'jsonb'::regtype",
   "    OR p.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname='plpgsql')",
   "    OR p.provolatile<>'v' OR p.proparallel<>'u' OR p.proisstrict OR p.proleakproof OR p.prosupport<>0",
   f"    OR p.proconfig IS DISTINCT FROM ARRAY[{quote(s['config'])}]::text[]",
   f"    OR p.proargnames IS DISTINCT FROM ARRAY[{','.join(quote(a) for a in s['args'])}]::text[] OR p.proargmodes IS NOT NULL",
   "    OR p.provariadic<>0 THEN RAISE EXCEPTION 'APPAREL_PROFILE_MISMATCH: function definition or source profile'; END IF;"]
  if s['ownerMode']=='cart':
   parts += ["  IF p.proowner<>'postgres'::regrole OR p.proacl IS DISTINCT FROM ARRAY['postgres=X/postgres','service_role=X/postgres']::aclitem[]",
    "    OR p.proowner<>(SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.carts'::regclass)",
    "    THEN RAISE EXCEPTION 'APPAREL_PROFILE_MISMATCH: saved native configured writer access'; END IF;"]
  else:
   parts += ["  IF p.proowner<>(SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.orders'::regclass)",
    "    OR NOT EXISTS(SELECT 1 FROM pg_catalog.pg_roles r WHERE r.oid=p.proowner AND r.rolsuper)",
    "    OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a",
    "      WHERE a.grantor<>p.proowner OR a.grantee NOT IN(p.proowner,'postgres'::regrole) OR a.privilege_type<>'EXECUTE' OR (a.grantee<>p.proowner AND a.is_grantable))",
    "    OR NOT pg_catalog.has_function_privilege(p.proowner,p.oid,'EXECUTE')",
    "    OR pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') OR pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')",
    "    OR pg_catalog.has_function_privilege('app_tenant',p.oid,'EXECUTE') OR pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')",
    "    THEN RAISE EXCEPTION 'APPAREL_PROFILE_MISMATCH: source-relative order writer access'; END IF;"]
  parts += ["  before_profile:=(pg_catalog.to_jsonb(p)-'prosrc'-'proargdefaults') || pg_catalog.jsonb_build_object('argument_defaults',pg_catalog.pg_get_expr(p.proargdefaults,0));",f"  old_body:=$old_apparel_body${old}$old_apparel_body$;",f"  next_body:=$new_apparel_body${new}$new_apparel_body$;",
   "  IF p.prosrc IS DISTINCT FROM old_body THEN RAISE EXCEPTION 'APPAREL_BODY_MISMATCH'; END IF;",
   "  definition:=pg_catalog.pg_get_functiondef(p.oid);",
   "  IF (length(definition)-length(replace(definition,old_body,'')))/length(old_body)<>1 THEN RAISE EXCEPTION 'APPAREL_DEFINITION_AMBIGUOUS'; END IF;",
   "  EXECUTE replace(definition,old_body,next_body);",
   "  SELECT (pg_catalog.to_jsonb(q)-'prosrc'-'proargdefaults') || pg_catalog.jsonb_build_object('argument_defaults',pg_catalog.pg_get_expr(q.proargdefaults,0)) INTO after_profile FROM pg_catalog.pg_proc q WHERE q.oid=p.oid;",
   f"  IF before_profile IS DISTINCT FROM after_profile OR (SELECT md5(q.prosrc) FROM pg_catalog.pg_proc q WHERE q.oid=p.oid)<>{quote(result)}",
   "    THEN RAISE EXCEPTION 'APPAREL_METADATA_CONSERVATION_FAILED'; END IF;"]
 parts += ["  -- Whole-cart writer is intentionally unchanged. Fail closed on a different current writer.",f"  SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure({quote(write['signature'])});",
  f"  IF NOT FOUND OR pg_catalog.md5(p.prosrc)<>{quote(write['bodyMd5'])} OR p.proowner<>'postgres'::regrole OR NOT p.prosecdef",
  "    OR p.proconfig IS DISTINCT FROM ARRAY['search_path=public, pg_catalog']::text[] OR p.provolatile<>'v' OR p.proparallel<>'u' OR p.proisstrict OR p.proleakproof",
  "    OR p.proacl IS DISTINCT FROM ARRAY['postgres=X/postgres','service_role=X/postgres']::aclitem[]",
  "    THEN RAISE EXCEPTION 'APPAREL_PROFILE_MISMATCH: unchanged current whole-cart writer'; END IF;",
  'END;','$apparel_provenance$;','COMMIT;','']
 return '\n'.join(parts)
for direction in ['up','down']:(root/f'UNNUMBERED_apparel_order_facts.{direction}.proposal.sql').write_text(sql(direction))
report={'classification':'PRIVATE_SOURCE_PREPARATION_NOT_NATIVE_SQL_ACCEPTANCE','baseline':handoff['baseline'],'exactUPOrder':handoff['exactUPOrder'],'currentInputHandoff':str(inp/'CURRENT_SQL_INPUT_HANDOFF.json'),'currentInputHandoffSha256':hashlib.sha256((inp/'CURRENT_SQL_INPUT_HANDOFF.json').read_bytes()).hexdigest(),'delta':[{'signature':s['signature'],'beforeBodyMd5':s['beforeMd5'],'afterBodyMd5':s['afterMd5'],'replacementCount':1,'semanticDelta':'Append apparel to product-level fact whitelist only','evidenceClass':s['evidenceClass']}for s in specs],'unchangedWholeCartWriter':write,'tablesGrantsOwnersACLOrSignaturesChanged':False,'sqlExecuted':False,'nativeProfileLimit':'Order writer native full profile not retained. Defaults/volatility/strictness/parallel/language/argument fields are source expectations, not observed native metadata. Exact existing ACL/order owner constraints fail closed; admitted fresh qualification must capture and independently verify full profiles before UP/DOWN.','rollback':'DOWN restores prior function bodies only. It retains all row data. Active corrected apparel cart is safely refused by old order provenance comparison, then accepted with the same intent after UP. Actual native proof required.','guardNote':'Current body guards plus metadata invariants do not replace full fresh owned baseline provenance (322 migrations/max393/fourUPs).'}
(root/'SQL_SOURCE_CONSERVATION.json').write_text(json.dumps(report,indent=2)+'\n')
for s in specs:
 (root/(s['name']+'.body-delta.diff')).write_text(''.join(difflib.unified_diff(s['before'].splitlines(True),s['after'].splitlines(True),fromfile='current/'+s['name'],tofile='proposed/'+s['name'])))
print(json.dumps({'sqlProposals':2,'changedFunctionBodies':2,'whitelistEdits':2,'nativeOrDbExecuted':False}))
