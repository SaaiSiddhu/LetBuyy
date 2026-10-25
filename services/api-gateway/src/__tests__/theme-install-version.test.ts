import assert from 'node:assert/strict';
import test from 'node:test';
import { createFirstPartyCatalogBundle, InstallThemeSchema } from '@letbuyy/theme-engine';
import { ThemeExecutionAdapter } from '../execution/theme-execution.adapter';
import { AppError } from '../lib/errors';
const site='7b669c70-f000-4000-8000-000000000001',actor='7b669c70-f000-4000-8000-000000000002';
const packageId='7b669c70-f000-4000-8000-000000000003',versionId='7b669c70-f000-4000-8000-000000000004',instanceId='7b669c70-f000-4000-8000-000000000005';
const themeId='7b669c70-f000-4000-8000-000000000006',foreign='7b669c70-f000-4000-8000-000000000099';
const intent={store_id:site,config_overrides:{},expected_version:'2.0.0',expected_package_id:packageId,expected_package_version_id:versionId};
const receipt={installation:{id:site},theme:{id:themeId,slug:'letbuyy-sense',name:'Threadline',version:'2.0.0'},theme_instance_id:instanceId,theme_package_id:packageId,theme_package_version_id:versionId,installed_version:'2.0.0',already_installed:false};
type Result={data?:unknown;error?:{code:string;message:string}|null};
function fixture(options:{catalogVersion?:string;selected?:unknown;result?:Result;ownershipDenied?:boolean}={}){
    const calls:Array<{name:string;args:Record<string,unknown>}>=[],reads:string[]=[];
    const records:Record<string,unknown>={sites:{site_type:'store'},subscriptions:{plan:'enterprise'},plans:{slug:'enterprise',site_type:'store',name:'Enterprise',limits:{themes:null}},theme_package_versions:options.selected===undefined?{id:versionId,theme_package_id:packageId,version:'2.0.0'}:options.selected};
    const db={from(table:string){reads.push(table);const chain:Record<string,unknown>={};for(const method of ['select','eq','is','in','order','limit'])chain[method]=()=>chain;chain.maybeSingle=async()=>({data:records[table],error:null});return chain;},async rpc(name:string,args:Record<string,unknown>){calls.push({name,args});return options.result||{data:receipt,error:null};}} as unknown as ConstructorParameters<typeof ThemeExecutionAdapter>[0];
    const adapter=new ThemeExecutionAdapter(db,site);
    adapter.verifyThemeEditorStore=async()=>{if(options.ownershipDenied)throw new AppError('Denied',403,'FORBIDDEN');return{id:site};};
    adapter.getTheme=async()=>({id:themeId,slug:'letbuyy-sense',name:'Threadline',version:options.catalogVersion||'2.0.0',default_template:{themeId:'letbuyy-sense',liquidBundle:createFirstPartyCatalogBundle('letbuyy-sense')}});
    Object.defineProperty(adapter,'schemaRegistry',{value:{resolveThemeRuntime:async()=>({themePackageId:packageId,themePackageVersionId:versionId})}});
    Object.defineProperty(adapter,'validateTemplateConfig',{value:async()=>({themePackageId:packageId,themePackageVersionId:versionId})});
    return {adapter,calls,reads};
}
const errorIs=(status:number,code:string)=>(error:unknown)=>error instanceof AppError&&error.statusCode===status&&error.code===code;
test('canonical install request retains bounded version and UUID preconditions',()=>{
    assert.deepEqual(InstallThemeSchema.parse(intent),{...intent,config_overrides:{}});
    for(const expected_version of ['', ' leading', 'line\nbreak', 'x'.repeat(41),null,7])assert.equal(InstallThemeSchema.safeParse({...intent,expected_version}).success,false);
    for(const field of ['expected_package_id','expected_package_version_id'])assert.equal(InstallThemeSchema.safeParse({...intent,[field]:'foreign-not-a-uuid'}).success,false);
    assert.ok(InstallThemeSchema.safeParse({store_id:site}).success,'older source callers may omit a selection; receipt remains exact');
});
test('selected runtime/catalog expectations travel into the existing atomic installer and actual receipt is preserved',async()=>{
    const f=fixture();const result=await f.adapter.installTheme('letbuyy-sense',intent,actor,'request-one');
    assert.deepEqual(result,receipt);assert.equal(f.calls.length,1);assert.equal(f.calls[0].name,'install_owned_theme_v1');
    assert.deepEqual(f.calls[0].args.p_runtime,{theme_package_id:packageId,theme_package_version_id:versionId,client:'api',catalog_version:'2.0.0',selected_version:'2.0.0',expected_version:'2.0.0',expected_package_id:packageId,expected_package_version_id:versionId});
    assert.equal(f.calls[0].args.p_actor,actor);assert.equal(f.calls[0].args.p_site,site);assert.equal(f.calls[0].args.p_bound_site,site);
});
test('ownership is checked before any catalog/runtime/install read',async()=>{
    const f=fixture({ownershipDenied:true});await assert.rejects(f.adapter.installTheme('letbuyy-sense',intent,actor),errorIs(403,'FORBIDDEN'));assert.deepEqual(f.reads,[]);assert.deepEqual(f.calls,[]);
});
test('stale catalog, expected package and expected package-version refuse before the install RPC',async()=>{
    const scenarios=[{options:{catalogVersion:'1.0.0'},input:intent},{options:{},input:{...intent,expected_package_id:foreign}},{options:{},input:{...intent,expected_package_version_id:foreign}},{options:{selected:{id:versionId,theme_package_id:packageId,version:'1.0.0'}},input:intent}];
    for(const scenario of scenarios){const f=fixture(scenario.options);await assert.rejects(f.adapter.installTheme('letbuyy-sense',scenario.input,actor),errorIs(409,'THEME_VERSION_CONFLICT'));assert.equal(f.calls.length,0);}
});
test('missing or foreign runtime metadata cannot manufacture an install',async()=>{
    for(const selected of [null,{}, {id:foreign,theme_package_id:packageId,version:'2.0.0'},{id:versionId,theme_package_id:foreign,version:'2.0.0'}]){const f=fixture({selected});await assert.rejects(f.adapter.installTheme('letbuyy-sense',intent,actor),errorIs(503,'THEME_STATE_UNAVAILABLE'));assert.equal(f.calls.length,0);}
});
test('transactional version and existing-instance conflicts stay distinct from library limits',async()=>{
    for(const [message,code]of [['THEME_VERSION_CONFLICT','THEME_VERSION_CONFLICT'],['THEME_INSTANCE_VERSION_CONFLICT','THEME_INSTANCE_VERSION_CONFLICT'],['Theme library limit reached','THEME_LIMIT_REACHED']]){const f=fixture({result:{data:null,error:{code:'PT409',message}}});await assert.rejects(f.adapter.installTheme('letbuyy-sense',intent,actor),errorIs(409,code));}
});
test('missing/mismatched actual receipt identity is an unconfirmed outcome, never success',async()=>{
    for(const data of [{...receipt,theme_instance_id:undefined},{...receipt,already_installed:undefined},{...receipt,theme_package_id:foreign},{...receipt,theme_package_version_id:foreign},{...receipt,installed_version:'1.0.0'},{...receipt,theme:{...receipt.theme,slug:'letbuyy-aura'}},{...receipt,theme:{...receipt.theme,version:'1.0.0'}}]){const f=fixture({result:{data,error:null}});await assert.rejects(f.adapter.installTheme('letbuyy-sense',intent,actor),errorIs(503,'THEME_INSTALL_UNCONFIRMED'));}
    const replay=fixture({result:{data:{...receipt,already_installed:true},error:null}});assert.equal((await replay.adapter.installTheme('letbuyy-sense',intent,actor)).already_installed,true);
});
