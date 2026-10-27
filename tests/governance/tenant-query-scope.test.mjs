import assert from 'node:assert/strict';
import test from 'node:test';
import ts from 'typescript';
import {directTenantQueries} from '../../scripts/governance/tenant-query-scope.mjs';

const registry=new Map([['product_reviews',{scopeColumns:['store_id','site_id']}],['sites',{scopeColumns:['user_id','custom_user_id']}]]);
function inspect(body) {
  const text=`interface Array<T> { [index:number]:T; length:number }
    interface Builder { select(...args:unknown[]):Builder; eq(...args:unknown[]):Builder; in(...args:unknown[]):Builder;
      insert(value:unknown):Builder; upsert(value:unknown):Builder; delete():Builder; update(value:unknown):Builder }
    declare function getSupabaseAdmin(c?:unknown):{from(table:string):Builder};
    ${body}`;
  const file='fixture.ts',options={noLib:true,strict:true};
  const source=ts.createSourceFile(file,text,ts.ScriptTarget.Latest,true);
  const host=ts.createCompilerHost(options);
  host.getSourceFile=name=>name===file?source:undefined;host.fileExists=name=>name===file;host.readFile=name=>name===file?text:undefined;
  const program=ts.createProgram([file],options,host);
  return directTenantQueries(source,program.getTypeChecker(),registry).map(row=>row.scoped);
}

test('both store and site predicates prove scope on the actual direct chain',()=>{
  assert.deepEqual(inspect(`getSupabaseAdmin().from('product_reviews').select('*').eq('store_id','a');
    getSupabaseAdmin().from('product_reviews').select('*').in('site_id',['a']);`),[true,true]);
});

test('neighbouring chains and quoted/commented examples cannot lend scope to an unscoped query',()=>{
  assert.deepEqual(inspect(`getSupabaseAdmin().from('product_reviews').select('*');
    // .eq('store_id','a')
    const example=".eq('site_id','a')";
    getSupabaseAdmin().from('product_reviews').select('*').eq('store_id','a');`),[false,true]);
});

test('contextual delegated payloads need a required scope field; optional, unknown and unscoped writes remain refused',()=>{
  assert.deepEqual(inspect(`
    declare function register(deps:{insertReview(c:unknown,review:{store_id:string}):unknown}):void;
    register({insertReview:(c,review)=>getSupabaseAdmin(c).from('product_reviews').insert(review)});
    declare const optional:{store_id?:string};
    declare const unknownPayload:unknown;
    getSupabaseAdmin().from('product_reviews').insert(optional);
    getSupabaseAdmin().from('product_reviews').upsert(unknownPayload);
    getSupabaseAdmin().from('product_reviews').insert({rating:5}).eq('store_id','a');
  `),[true,false,false,false]);
});

test('every bulk row must carry scope and the empty array cannot masquerade as a scoped write',()=>{
  assert.deepEqual(inspect(`
    getSupabaseAdmin().from('product_reviews').insert([{store_id:'a'},{site_id:'b'}]);
    getSupabaseAdmin().from('product_reviews').insert([{store_id:'a'},{rating:5}]);
    getSupabaseAdmin().from('product_reviews').insert([]);
  `),[true,false,false]);
});


test('only an exact root-site id read matches the existing runtime root lookup guard',()=>{
  assert.deepEqual(inspect(`
    getSupabaseAdmin().from('sites').select('id,payment_settings').eq('id','site-a');
    getSupabaseAdmin().from('sites').select('*');
    getSupabaseAdmin().from('sites').select('*').in('id',['site-a','site-b']);
    getSupabaseAdmin().from('sites').update({name:'changed'}).eq('id','site-a');
    getSupabaseAdmin().from('sites').delete().eq('id','site-a');
    getSupabaseAdmin().from('sites').insert({id:'site-a'});
    getSupabaseAdmin().from('product_reviews').select('*').eq('id','review-a');
  `),[true,false,false,false,false,false,false]);
});
