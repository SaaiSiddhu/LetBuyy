// Authoring tool only. Compiles the exact canonical schemas into finite static SQL predicates.
// There is no runtime schema interpreter, extension, dynamic SQL or merchant-provided schema.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const repo = path.resolve(__dirname, '../../../../..');
const { storefrontDiscoverySchemaSnapshot } = require(path.join(repo, 'packages/commerce-core/src/storefront-discovery.ts'));
const snapshot = storefrontDiscoverySchemaSnapshot();let serial = 0;
const quote = value => "'" + String(value).replaceAll("'", "''") + "'";
const json = value => quote(JSON.stringify(value)) + '::jsonb';
const supported = new Set(['$schema','type','properties','additionalProperties','required','items','minItems','maxItems','minLength','maxLength','minimum','maximum','exclusiveMinimum','exclusiveMaximum','enum','const','pattern','format','default','anyOf','oneOf']);
function compile(schema, value) {
  for (const key of Object.keys(schema)) if (!supported.has(key)) throw new Error('Unsupported canonical schema keyword: ' + key);
  const checks = [];
  if (schema.anyOf) checks.push('(' + schema.anyOf.map(row => compile(row,value)).join(' OR ') + ')');
  if (schema.oneOf) checks.push('(' + schema.oneOf.map(row => `(CASE WHEN ${compile(row,value)} THEN 1 ELSE 0 END)`).join('+') + '=1)');
  if ('const' in schema) checks.push(`${value}=${json(schema.const)}`);
  if (schema.enum) checks.push(`${value} IN (${schema.enum.map(json).join(',')})`);
  const scalar = `(${value}#>>'{}')`;
  switch (schema.type) {
    case 'object': {
      const props = schema.properties || {}, nested = [];
      if (schema.additionalProperties !== false) throw new Error('Only strict canonical objects are supported');
      nested.push(`(${value}-ARRAY[${Object.keys(props).map(quote).join(',')}]::text[])='{}'::jsonb`);
      if (schema.required?.length) nested.push(`${value}?&ARRAY[${schema.required.map(quote).join(',')}]::text[]`);
      for (const [key, child] of Object.entries(props)) nested.push(`(NOT ${value}?${quote(key)} OR ${compile(child,`(${value}->${quote(key)})`)})`);
      checks.push(`CASE WHEN jsonb_typeof(${value})='object' THEN (${nested.join(' AND ')}) ELSE false END`);break;
    }
    case 'array': {
      if (!Number.isInteger(schema.maxItems) || schema.maxItems > 100) throw new Error('Every discovery array must be bounded to at most100');
      const alias = 'item' + serial++;
      checks.push(`CASE WHEN jsonb_typeof(${value})='array' THEN CASE WHEN jsonb_array_length(${value}) BETWEEN ${schema.minItems || 0} AND ${schema.maxItems} THEN NOT EXISTS(SELECT 1 FROM jsonb_array_elements(${value}) ${alias}(value) WHERE NOT ${compile(schema.items,`${alias}.value`)}) ELSE false END ELSE false END`);break;
    }
    case 'string': {
      checks.push(`jsonb_typeof(${value})='string'`);
      const length = `public.storefront_discovery_utf16_length_v1(public.storefront_discovery_trim_v1(${scalar}))`;
      if (schema.minLength !== undefined) checks.push(`${length}>=${schema.minLength}`);
      if (schema.maxLength !== undefined) checks.push(`${length}<=${schema.maxLength}`);
      if (schema.pattern) checks.push(`${scalar}~${quote(schema.pattern)}`);
      if (schema.format && schema.format !== 'uuid') throw new Error('Unsupported canonical string format: ' + schema.format);
      break;
    }
    case 'integer': case 'number': {
      const number = `${scalar}::numeric`, nested = [`abs(${number})<=1.7976931348623157e308`, `(${number}=0 OR abs(${number})>=4.9406564584124654e-324)`];
      if (schema.type === 'integer') nested.push(`${number}=trunc(${number})`);
      for (const [key,op] of [['minimum','>='],['maximum','<='],['exclusiveMinimum','>'],['exclusiveMaximum','<']]) if (schema[key] !== undefined) nested.push(`${number}${op}${schema[key]}`);
      checks.push(`CASE WHEN jsonb_typeof(${value})='number' THEN (${nested.length ? nested.join(' AND ') : 'true'}) ELSE false END`);break;
    }
    case 'boolean': checks.push(`jsonb_typeof(${value})='boolean'`);break;
    case 'null': checks.push(`${value}='null'::jsonb`);break;
    case undefined: break;
    default: throw new Error('Unsupported canonical schema type: ' + schema.type);
  }
  if (!checks.length) throw new Error('Unconstrained canonical discovery value');
  return `coalesce((${checks.join(' AND ')}),false)`;
}
const trim = "U&' " + ['0009','000A','000B','000C','000D','00A0','1680','2000','2001','2002','2003','2004','2005','2006','2007','2008','2009','200A','2028','2029','202F','205F','3000','FEFF'].map(code => String.fromCharCode(92)+code).join('')+"'";
const catalogFence = fs.readFileSync(path.join(repo,'database/supabase/migrations/385_product_variant_facts.sql'),'utf8').match(/DO \$managed_catalog_fence\$[\s\S]*?END \$managed_catalog_fence\$;/)[0];
const oldMigration = fs.readFileSync(path.join(repo,'database/supabase/migrations/383_storefront_apparel_discovery.sql'),'utf8');
const oldBodyMd5 = crypto.createHash('md5').update(oldMigration.split('$function$')[1]).digest('hex');
const admission = `DO $admission$ DECLARE p pg_catalog.pg_proc%ROWTYPE; BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_proc existing JOIN pg_catalog.pg_namespace n ON n.oid=existing.pronamespace WHERE n.nspname='public' AND(existing.proname LIKE 'storefront_discovery_%_v1' OR existing.proname='browse_storefront_products_v1')) THEN RAISE EXCEPTION 'Migration386 refuses pre-existing discovery functions'; END IF;
 SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure('public.browse_storefront_apparel_v1(uuid,integer,integer,text,text,numeric,numeric,text,text,text,uuid,boolean,text)');
 IF p.oid IS NULL OR pg_catalog.md5(p.prosrc)<>${quote(oldBodyMd5)} OR p.prosecdef OR p.prokind<>'f' OR p.proretset OR p.provolatile<>'s'
 OR p.proowner<>(SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.products'::regclass)
 OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]
 OR NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
 OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a WHERE a.grantee NOT IN(p.proowner,'service_role'::regrole) OR a.grantee<>p.proowner AND a.is_grantable)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc q WHERE q.pronamespace=p.pronamespace AND q.proname=p.proname AND q.oid<>p.oid)
 THEN RAISE EXCEPTION 'Migration386 requires the exact migration383 invoker profile';END IF;
 END $admission$;`;
let sql = `--386: One canonical storefront discovery algorithm; static guards from canonical Zod leaves.\n-- No tables, RLS changes, definer rights, new SQL extension or anonymous execution.\nBEGIN;\nSELECT pg_advisory_xact_lock(hashtextextended('migration386:storefront-discovery',0));\n${catalogFence}\n${admission}\n\nCREATE OR REPLACE FUNCTION public.storefront_discovery_trim_v1(value text) RETURNS text LANGUAGE sql IMMUTABLE STRICT SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$ SELECT btrim(value,${trim}); $fn$;\nCREATE OR REPLACE FUNCTION public.storefront_discovery_utf16_length_v1(value text) RETURNS integer LANGUAGE sql IMMUTABLE STRICT SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$ SELECT length(regexp_replace(value,U&'[\\+010000-\\+10FFFF]','xx','g')); $fn$;\n`;
const ranges=[];let start=-1;
for(let code=1;code<=0x110000;code++){const matches=code<0x110000&&/[\p{Cc}\p{Cf}]/u.test(String.fromCodePoint(code));if(matches&&start<0)start=code;if(!matches&&start>=0){ranges.push([start,code-1]);start=-1;}}
const escape = code => String.fromCharCode(92)+(code>0xffff?'+':'')+code.toString(16).padStart(code>0xffff?6:4,'0');
const controlPattern = ranges.map(([a,b])=>escape(a)+(a===b?'':'-'+escape(b))).join('');
sql += `CREATE OR REPLACE FUNCTION public.storefront_discovery_label_v1(value text) RETURNS boolean LANGUAGE sql IMMUTABLE STRICT SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$ SELECT value=public.storefront_discovery_trim_v1(value) AND value !~ U&'[${controlPattern}]'; $fn$;\n`;
const names = ['playfield','circuit','pantry','habitat','kindred','madeyours','dewdrop','trailmark','marginalia'];
const hashes = Object.fromEntries(names.map(name => { const file=`packages/commerce-core/src/${name}-facts.ts`;return [file,crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,file))).digest('hex')]; }));
sql += `\n-- canonical-schema-snapshot: ${crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex')}\n-- canonical-leaf-sources: ${JSON.stringify(hashes)}\n`;
sql += `CREATE OR REPLACE FUNCTION public.storefront_discovery_shape_v1(value jsonb, namespace text, variant boolean DEFAULT false) RETURNS boolean LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER SET search_path=pg_catalog,public AS $fn$\nBEGIN\n IF value IS NULL OR octet_length(value::text)>65536 THEN RETURN false; END IF;\n IF namespace='$query' THEN RETURN ${compile(snapshot.query,'value')}; END IF;\n IF variant THEN\n CASE namespace\n`;
for (const [namespace, schema] of Object.entries(snapshot.variant)) sql += ` WHEN ${quote(namespace)} THEN RETURN ${compile(schema,'value')};\n`;
sql += ` ELSE RETURN false; END CASE;\n ELSE CASE namespace\n`;
for (const [namespace, schema] of Object.entries(snapshot.product)) sql += ` WHEN ${quote(namespace)} THEN RETURN ${compile(schema,'value')};\n`;
sql += ' ELSE RETURN false; END CASE; END IF;\nEND $fn$;\n-- END STATIC GUARDS\n';
const target = path.join(__dirname,'386.draft.sql');
const tail = path.join(__dirname,'discovery-tail.sql');
const previous = fs.existsSync(tail) ? fs.readFileSync(tail,'utf8') : '';
const definitions = sql+previous;
const profiles = Array.from(definitions.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\(([\s\S]*?)\)\s*RETURNS (\w+)\s+LANGUAGE (\w+)([\s\S]*?) AS \$fn\$([\s\S]*?)\$fn\$;/g)).map(match => {
 const args=match[2].split(',').map(value=>value.trim().split(/\s+/));
 return {name:match[1],signature:`public.${match[1]}(${args.map(arg=>arg[1]).join(',')})`,argumentNames:args.map(arg=>arg[0]),defaults:args.filter(arg=>arg.some(value=>value.toUpperCase()==='DEFAULT')).length,defaultExpressions:args.filter(arg=>arg.includes('DEFAULT')).map(arg=>{const value=arg.slice(arg.indexOf('DEFAULT')+1).join(' ');return value==='NULL'?`NULL::${arg[1]}`:value.startsWith("'")?`${value}::${arg[1]}`:value;}).join(', '),returnType:match[3],language:match[4],strict:/\bSTRICT\b/.test(match[5]),volatility:/\bIMMUTABLE\b/.test(match[5])?'i':'s',md5:crypto.createHash('md5').update(match[6]).digest('hex')};
});
if(profiles.length!==13) throw new Error('Expected exactly13 bounded discovery helpers/readers, got'+profiles.length);
const grants = profiles.map(profile=>`REVOKE ALL ON FUNCTION ${profile.signature} FROM PUBLIC,anon,authenticated,app_tenant,authenticator,service_role;\nGRANT EXECUTE ON FUNCTION ${profile.signature} TO service_role;`).join('\n');
const profileGuard = `DO $profile$ DECLARE expected jsonb;p pg_catalog.pg_proc%ROWTYPE;BEGIN
 FOR expected IN SELECT value FROM jsonb_array_elements(${json(profiles)}) LOOP
  SELECT * INTO p FROM pg_catalog.pg_proc WHERE oid=pg_catalog.to_regprocedure(expected->>'signature');
  IF p.oid IS NULL OR pg_catalog.md5(p.prosrc)<>expected->>'md5' OR p.prosecdef OR p.proretset OR p.prokind<>'f'
   OR p.provolatile<>expected->>'volatility' OR p.proisstrict<>(expected->>'strict')::boolean OR p.proparallel<>'u'
   OR p.pronargdefaults<>(expected->>'defaults')::integer OR coalesce(pg_catalog.pg_get_expr(p.proargdefaults,0),'') IS DISTINCT FROM expected->>'defaultExpressions' OR p.provariadic<>0 OR p.prosupport<>0 OR p.proleakproof
   OR p.proallargtypes IS NOT NULL OR p.proargmodes IS NOT NULL OR p.probin IS NOT NULL OR p.prosqlbody IS NOT NULL
   OR p.procost<>100 OR p.prorows<>0
   OR p.proowner<>(SELECT relowner FROM pg_catalog.pg_class WHERE oid='public.products'::regclass)
   OR p.prorettype<>pg_catalog.to_regtype(expected->>'returnType') OR p.prolang<>(SELECT oid FROM pg_catalog.pg_language WHERE lanname=expected->>'language')
   OR p.proargnames IS DISTINCT FROM ARRAY(SELECT jsonb_array_elements_text(expected->'argumentNames'))
   OR p.proconfig IS DISTINCT FROM ARRAY['search_path=pg_catalog, public']::text[]
   OR NOT pg_catalog.has_function_privilege('service_role',p.oid,'EXECUTE')
   OR pg_catalog.has_function_privilege('anon',p.oid,'EXECUTE') OR pg_catalog.has_function_privilege('authenticated',p.oid,'EXECUTE')
   OR EXISTS(SELECT 1 FROM pg_catalog.aclexplode(coalesce(p.proacl,pg_catalog.acldefault('f',p.proowner))) a WHERE a.grantee NOT IN(p.proowner,'service_role'::regrole) OR a.grantee<>p.proowner AND a.is_grantable)
   OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc q WHERE q.pronamespace=p.pronamespace AND q.proname=p.proname AND q.oid<>p.oid)
  THEN RAISE EXCEPTION 'Migration386 discovery function profile changed: %',expected->>'name';END IF;
 END LOOP;END $profile$;`;
const forward = definitions+'\n'+grants+"\nCOMMENT ON FUNCTION public.browse_storefront_products_v1(uuid,jsonb,uuid[]) IS 'Internal invoker-only canonical discovery. Caller resolves a published store or verified site-bound preview. Same available canonical variant satisfies every structured fact/option/price predicate. Product base price is preserved; safe page-scoped matches are explicit.';\n"+profileGuard+"\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n";
fs.writeFileSync(target,forward);
const dropOrder=[...profiles].reverse().filter(profile=>profile.name!=='browse_storefront_apparel_v1').map(profile=>`DROP FUNCTION ${profile.signature};`).join('\n');
const restored=oldMigration.replace(/^BEGIN;\s*/m,'').replace(/COMMIT;\s*$/,'');
const laterDependencyGuard = `DO $later$ BEGIN
 IF EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.carts'::regclass AND attname='fact_acceptance_version' AND NOT attisdropped)
 OR EXISTS(SELECT 1 FROM pg_catalog.pg_proc WHERE pronamespace='public'::regnamespace AND proname='apply_product_edit_v1' AND prosrc LIKE '%storefront_discovery_facts_valid_v1%')
 THEN RAISE EXCEPTION 'Migration386 rollback refuses active migration388 dependencies; roll back388 first';END IF;
END $later$;`;
fs.writeFileSync(path.join(__dirname,'386.rollback.draft.sql'),`--386 DOWN: exact migration383 reader/profile restored; no product/fact/table mutation.\nBEGIN;\n${catalogFence}\n${laterDependencyGuard}\n${profileGuard}\n${restored}\n${dropOrder}\nNOTIFY pgrst,'reload schema';\nCOMMIT;\n`);
fs.writeFileSync(path.join(__dirname,'function-profiles.json'),JSON.stringify(profiles,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'canonical-schemas.json'),JSON.stringify(snapshot,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'leaf-source-hashes.json'),JSON.stringify(hashes,null,2)+'\n');
process.stdout.write('Compiled finite guards for query +9product +5variant schemas; no runtime interpreter.\n');
