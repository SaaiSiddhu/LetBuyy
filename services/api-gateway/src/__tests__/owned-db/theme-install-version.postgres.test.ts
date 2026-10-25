// Real worker + owned PostgreSQL/PostgREST. No browser cookies, hosted data or providers.
import assert from 'node:assert/strict';
import test,{after} from 'node:test';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createFirstPartyCatalogBundle} from '@letbuyy/theme-engine';
import {UuidSchema} from '@letbuyy/shared-types';
import {requireOwnedDatabase} from './owned-db-support';
import {Gateway,gatewayEnv,newIdentityKeys,signedIdentityHeaders,tapRest,newBarrier} from './gateway-harness';
import {newSyntheticTenant,seedSyntheticTenant} from './synthetic-tenant';
const owned=requireOwnedDatabase();let gateway:Gateway;let tap:ReturnType<typeof tapRest>|undefined;
after(async()=>{tap?.restore();await gateway?.settle();});
const record=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const signature='public.install_owned_theme_v1(uuid,uuid,text,jsonb,jsonb,uuid,integer,text)';
test('selected-version install is atomic, exact on retry, tenant-bound, conflict-safe and reversible',async t=>{
    const a=newSyntheticTenant('install-version-a'),b=newSyntheticTenant('install-version-b');seedSyntheticTenant(owned.psql,a);seedSyntheticTenant(owned.psql,b);
    const actor=randomUUID(),other=randomUUID(),email=`install-${actor}@example.invalid`,otherEmail=`install-${other}@example.invalid`;
    owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name) VALUES('${actor}','${email}',true,'Synthetic install owner'),('${other}','${otherEmail}',true,'Synthetic other owner');UPDATE sites SET custom_user_id='${actor}',theme_id='letbuyy-core' WHERE id='${a.siteId}';UPDATE sites SET custom_user_id='${other}',theme_id='letbuyy-core' WHERE id='${b.siteId}';INSERT INTO subscriptions(user_id,store_id,plan,status) VALUES('${actor}','${a.siteId}','enterprise','active');`);
    gateway=new Gateway(gatewayEnv(owned,await newIdentityKeys()));
    const request=async(path:string,body?:unknown,user=actor,mail=email,site=a.siteId,method=body?'POST':'GET')=>gateway.request(path,{method,headers:await signedIdentityHeaders(user,mail,site),...(body?{body:JSON.stringify(body)}:{})});
    const data=(response:Awaited<ReturnType<typeof request>>)=>record(response.json?.data);
    const upload=async(slug:string,version:string,number:number,paid=false)=>{
        const bundle=createFirstPartyCatalogBundle('letbuyy-sense');bundle.package={...bundle.package,slug,name:'Synthetic version fixture',version,version_number:number,pricing_type:paid?'paid':'free',price:paid?99:0};
        const response=await request('/v1/themes/packages/upload',{store_id:a.siteId,submission_mode:'private_install',bundle});assert.equal(response.status,201,response.text);
        return data(response);
    };
    const selection=(uploaded:Record<string,unknown>)=>({store_id:a.siteId,expected_version:String(record(uploaded.version).version),expected_package_id:UuidSchema.parse(record(uploaded.package).id),expected_package_version_id:UuidSchema.parse(record(uploaded.version).id)});
    const state=(site:string,slug:string)=>owned.psql(`SELECT md5(jsonb_build_object('site',(SELECT jsonb_build_object('theme',theme_id,'config',template_config,'published',published,'status',status,'release',current_theme_release_id) FROM sites WHERE id='${site}'),'instances',(SELECT jsonb_agg(to_jsonb(i) ORDER BY id) FROM theme_instances i WHERE store_id='${site}' AND theme_slug='${slug}'),'drafts',(SELECT jsonb_agg(to_jsonb(d) ORDER BY id) FROM theme_editor_drafts d WHERE store_id='${site}' AND theme_id='${slug}'),'library',(SELECT jsonb_agg(to_jsonb(st) ORDER BY st.id) FROM store_themes st JOIN themes tt ON tt.id=st.theme_id WHERE st.store_id='${site}' AND tt.slug='${slug}'),'events',(SELECT jsonb_agg(to_jsonb(e) ORDER BY id) FROM outbox_events e WHERE store_id='${site}' AND event_type='theme.installed' AND payload->>'theme_slug'='${slug}'))::text);`);
    const slug=`private-${a.siteId}-exact`,v1=await upload(slug,'1.0.0',1),select1=selection(v1);
    let instance='';
    await t.test('concurrent first Add returns one exact instance and never publishes',async()=>{
        const live=owned.psql(`SELECT jsonb_build_object('theme',theme_id,'config',template_config,'published',published,'status',status,'release',current_theme_release_id) FROM sites WHERE id='${a.siteId}';`);
        const barrier=newBarrier(3);tap=tapRest(owned.restUrl,async(call,forward)=>{if(call.resource==='rpc/install_owned_theme_v1'&&record(call.json).p_slug===slug)await barrier.arrive();return forward();});
        let results:Awaited<ReturnType<typeof request>>[];
        try{results=await Promise.all(Array.from({length:3},()=>request(`/v1/themes/${slug}/install`,select1)));}finally{tap.restore();tap=undefined;}
        for(const result of results!){assert.equal(result.status,201,result.text);const receipt=data(result);instance=UuidSchema.parse(receipt.theme_instance_id);assert.equal(receipt.theme_package_id,select1.expected_package_id);assert.equal(receipt.theme_package_version_id,select1.expected_package_version_id);assert.equal(receipt.installed_version,'1.0.0');assert.equal(record(receipt.theme).version,'1.0.0');}
        assert.equal(new Set(results!.map(result=>data(result).theme_instance_id)).size,1);
        assert.equal(results!.filter(result=>data(result).already_installed===false).length,1);
        assert.equal(owned.psql(`SELECT count(*) FROM theme_instances WHERE store_id='${a.siteId}' AND theme_slug='${slug}';`),'1');
        assert.equal(owned.psql(`SELECT count(*) FROM outbox_events WHERE store_id='${a.siteId}' AND event_type='theme.installed' AND payload->>'theme_slug'='${slug}';`),'1');
        assert.equal(owned.psql(`SELECT jsonb_build_object('theme',theme_id,'config',template_config,'published',published,'status',status,'release',current_theme_release_id) FROM sites WHERE id='${a.siteId}';`),live);
        assert.equal(owned.psql(`SELECT theme_package_version_id::text FROM theme_instances WHERE id='${instance}';`),select1.expected_package_version_id);
    });
    await t.test('replayed Add preserves a customized draft and carries the actual installed version',async()=>{
        const editor=await request(`/v1/themes/${slug}/editor?store_id=${a.siteId}`);assert.equal(editor.status,200,editor.text);
        const loaded=data(editor),config=structuredClone(record(loaded.template_config));record(config.themeSettings).primaryColor='#164E63';record(record(record(config.liquidBundle).config).settings_data).current={...record(record(record(record(config.liquidBundle).config).settings_data).current),primaryColor:'#164E63'};
        const saved=await request(`/v1/themes/${slug}/editor/draft`,{store_id:a.siteId,template_config:config,base_version:loaded.version,idempotency_key:'exact-install-customized-draft'},actor,email,a.siteId,'PUT');assert.equal(saved.status,200,saved.text);
        const before=state(a.siteId,slug),replay=await request(`/v1/themes/${slug}/install`,select1);assert.equal(replay.status,201,replay.text);assert.equal(data(replay).already_installed,true);assert.equal(data(replay).theme_instance_id,instance);assert.equal(data(replay).installed_version,'1.0.0');assert.equal(state(a.siteId,slug),before);
    });
    await t.test('wrong selection and foreign actor fail with no merchant effects',async()=>{
        for(const patch of [{expected_version:'9.0.0'},{expected_package_id:randomUUID()},{expected_package_version_id:randomUUID()}]){const before=state(a.siteId,slug),response=await request(`/v1/themes/${slug}/install`,{...select1,...patch});assert.equal(response.status,409,response.text);assert.equal(record(response.json?.error).code,'THEME_VERSION_CONFLICT');assert.equal(state(a.siteId,slug),before);}
        const before=state(a.siteId,slug),foreign=await request(`/v1/themes/${slug}/install`,select1,other,otherEmail,b.siteId);assert.equal(foreign.status,403,foreign.text);assert.equal(state(a.siteId,slug),before);
    });
    await t.test('existing and archived older instances conflict after append-only package promotion',async()=>{
        const v2=await upload(slug,'2.0.0',2),select2=selection(v2),before=state(a.siteId,slug);
        const stale=await request(`/v1/themes/${slug}/install`,select1);assert.equal(stale.status,409,stale.text);assert.equal(record(stale.json?.error).code,'THEME_VERSION_CONFLICT');assert.equal(state(a.siteId,slug),before);
        const existing=await request(`/v1/themes/${slug}/install`,select2);assert.equal(existing.status,409,existing.text);assert.equal(record(existing.json?.error).code,'THEME_INSTANCE_VERSION_CONFLICT');assert.equal(state(a.siteId,slug),before);
        const archive=await request(`/v1/themes/${slug}/archive`,{store_id:a.siteId});assert.equal(archive.status,200,archive.text);const archived=state(a.siteId,slug);
        const retry=await request(`/v1/themes/${slug}/install`,select2);assert.equal(retry.status,409,retry.text);assert.equal(record(retry.json?.error).code,'THEME_INSTANCE_VERSION_CONFLICT');assert.equal(state(a.siteId,slug),archived);
        assert.equal(owned.psql(`SELECT instance_status||'|'||theme_package_version_id::text FROM theme_instances WHERE id='${instance}';`),`archived|${select1.expected_package_version_id}`);
    });
    await t.test('promotion between API pre-resolution and atomic RPC refuses the stale selection',async()=>{
        const raceSlug=`private-${a.siteId}-race`,race1=await upload(raceSlug,'1.0.0',1),before=state(a.siteId,raceSlug);let promoted=false;
        tap=tapRest(owned.restUrl,async(call,forward)=>{if(call.resource==='rpc/install_owned_theme_v1'&&record(call.json).p_slug===raceSlug&&!promoted){promoted=true;await upload(raceSlug,'2.0.0',2);}return forward();});
        try{const result=await request(`/v1/themes/${raceSlug}/install`,selection(race1));assert.equal(result.status,409,result.text);assert.equal(record(result.json?.error).code,'THEME_VERSION_CONFLICT');}finally{tap.restore();tap=undefined;}
        assert.ok(promoted);assert.equal(state(a.siteId,raceSlug),before);
    });
    await t.test('lost first receipt retries the same persisted instance without another installation',async()=>{
        const schema=await gateway.request('/v1/themes/letbuyy-sense/schema');assert.equal(schema.status,200,schema.text);const identity=record(data(schema).theme);
        const selected={store_id:b.siteId,expected_version:'2.0.0',expected_package_id:identity.theme_package_id,expected_package_version_id:identity.theme_package_version_id};let lost=false;
        tap=tapRest(owned.restUrl,async(call,forward)=>{const response=await forward();if(call.resource==='rpc/install_owned_theme_v1'&&record(call.json).p_site===b.siteId&&!lost){lost=true;assert.equal(response.status,200);return new Response('{"code":"SYNTHETIC_LOST_RECEIPT"}',{status:503});}return response;});
        try{assert.equal((await request('/v1/themes/letbuyy-sense/install',selected,other,otherEmail,b.siteId)).status,503);}finally{tap.restore();tap=undefined;}
        assert.ok(lost);const committed=state(b.siteId,'letbuyy-sense'),retry=await request('/v1/themes/letbuyy-sense/install',selected,other,otherEmail,b.siteId);assert.equal(retry.status,201,retry.text);assert.equal(data(retry).already_installed,true);assert.equal(data(retry).installed_version,'2.0.0');assert.equal(state(b.siteId,'letbuyy-sense'),committed);
        assert.equal(owned.psql(`SELECT count(*) FROM theme_instances WHERE store_id='${b.siteId}' AND theme_slug='letbuyy-sense';`),'1');
    });
    await t.test('a last-write failure rolls back the entire installation and paid selection does not invoke acquisition',async()=>{
        const faultSlug=`private-${a.siteId}-fault`,fault=await upload(faultSlug,'1.0.0',1),before=state(a.siteId,faultSlug);
        owned.script(`CREATE FUNCTION public.synthetic_version_install_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.event_type='theme.installed' AND NEW.store_id='${a.siteId}' AND NEW.payload->>'theme_slug'='${faultSlug}' THEN RAISE EXCEPTION 'SYNTHETIC_INSTALL_LAST_WRITE';END IF;RETURN NEW;END $$;CREATE TRIGGER synthetic_version_install_fault BEFORE INSERT ON public.outbox_events FOR EACH ROW EXECUTE FUNCTION public.synthetic_version_install_fault();`);
        try{assert.equal((await request(`/v1/themes/${faultSlug}/install`,selection(fault))).status,503);assert.equal(state(a.siteId,faultSlug),before);}finally{owned.script('DROP TRIGGER synthetic_version_install_fault ON public.outbox_events;DROP FUNCTION public.synthetic_version_install_fault();');}
        const paidSlug=`private-${a.siteId}-paid`,paid=await upload(paidSlug,'1.0.0',1,true),paidBefore=state(a.siteId,paidSlug);const denied=await request(`/v1/themes/${paidSlug}/install`,selection(paid));assert.equal(denied.status,400,denied.text);assert.equal(state(a.siteId,paidSlug),paidBefore);
    });
    await t.test('migration forward/down replay conserves data and rejects changed cost, owner, search_path or ACL',()=>{
        const up=readFileSync(new URL('../../../../../database/supabase/migrations/387_theme_install_version_precondition.sql',import.meta.url),'utf8');
        const down=readFileSync(new URL('../../../../../database/supabase/rollback/387_theme_install_version_precondition.rollback.sql',import.meta.url),'utf8');
        const profile=()=>owned.psql(`SELECT md5(prosrc)||'|'||proowner::regrole::text||'|'||proconfig::text||'|'||proacl::text FROM pg_proc WHERE oid='${signature}'::regprocedure;`);
        const before=state(a.siteId,slug),original=profile();for(const sql of [up,up,down,down,up])owned.script(sql);assert.equal(profile(),original);assert.equal(state(a.siteId,slug),before);
        const owner=owned.psql(`SELECT proowner::regrole::text FROM pg_proc WHERE oid='${signature}'::regprocedure;`);assert.match(owner,/^[a-z_][a-z0-9_]*$/);
        for(const [change,restore] of [[`ALTER FUNCTION ${signature} COST 101;`,`ALTER FUNCTION ${signature} COST 100;`],[`ALTER FUNCTION ${signature} SET search_path=public,pg_catalog;`,`ALTER FUNCTION ${signature} SET search_path=pg_catalog,public;`],[`GRANT EXECUTE ON FUNCTION ${signature} TO anon;`,`REVOKE EXECUTE ON FUNCTION ${signature} FROM anon;`],[`ALTER FUNCTION ${signature} OWNER TO app_tenant;`,`ALTER FUNCTION ${signature} OWNER TO ${owner};`]]){
            owned.script(change);try{assert.match(owned.psqlScriptExpectError(up),/Migration387 refuses changed installer/);assert.match(owned.psqlScriptExpectError(down),/Migration387 refuses changed installer/);}finally{owned.script(restore);}
        }
        assert.equal(profile(),original);assert.equal(state(a.siteId,slug),before);
        for(const role of ['anon','authenticated','app_tenant'])assert.match(owned.psqlExpectError(`SET ROLE ${role};SELECT ${signature.split('(')[0]}(NULL,NULL,NULL,NULL,NULL,NULL,NULL,NULL);`),/permission denied/);
    });
});
