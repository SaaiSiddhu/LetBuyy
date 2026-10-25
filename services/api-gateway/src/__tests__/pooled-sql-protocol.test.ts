// Actual pinned Postgres.js client/Query objects, never awaited or dispatched.
// No sockets/database/process seam: owned wire suites prove execution separately.
import assert from 'node:assert/strict';
import test,{afterEach} from 'node:test';
import {getPooledSql,closePooledSqlClients,withPooledSqlScope} from '@letbuyy/infrastructure/pooled-sql-adapter';
const connectionString='postgres://synthetic:synthetic@sql.example.invalid/synthetic';
const hyperdrive={HYPERDRIVE:{connectionString}};
const queryOptions=(query:unknown)=>(query as {options:{prepare:boolean;simple:boolean}}).options;
afterEach(()=>closePooledSqlClients());

test('Hyperdrive constructor and actual unsafe Query objects select prepared extended protocol, including unsafe overloads',()=>{
 const sql=getPooledSql(hyperdrive)!;
 const explicitUnprepared={prepare:false,simple:true};
 assert.equal((sql as unknown as {options:{prepare:boolean}}).options.prepare,true);
 for(const query of [sql.unsafe('SELECT $1::text',['synthetic']),sql.unsafe('SELECT 1'),sql.unsafe('SELECT $1::text',['synthetic'],explicitUnprepared),
  (sql.unsafe as unknown as (text:string,options:object)=>unknown)('SELECT 1',{prepare:false,simple:true})]){
  assert.equal(queryOptions(query).prepare,true,'client prepare:true alone does not change unsafe defaults');
  assert.equal(queryOptions(query).simple,false);
 }
});

test('same endpoint with different transport protocols never reuses one client',()=>{
 const direct=getPooledSql({DATABASE_URL:connectionString})!;
 const edge=getPooledSql(hyperdrive)!;
 assert.notEqual(direct,edge);
 assert.equal(getPooledSql(hyperdrive),edge);
 assert.equal(getPooledSql({SUPABASE_DB_URL:connectionString}),direct);
 assert.equal(queryOptions(direct.unsafe('SELECT $1::text',['synthetic'])).prepare,false);
 assert.equal(queryOptions(edge.unsafe('SELECT $1::text',['synthetic'])).prepare,true);
});

test('existing binding precedence, direct query options and explicit feature-off remain compatible',()=>{
 assert.equal(getPooledSql({...hyperdrive,DATABASE_URL:'postgres://synthetic:synthetic@other.example.invalid/synthetic'}),getPooledSql(hyperdrive));
 assert.equal(getPooledSql({...hyperdrive,STOREFRONT_POOLED_SQL:'off'}),null);
 const direct=getPooledSql({DATABASE_URL:connectionString})!;
 const explicitPrepared={prepare:true,simple:false};
 assert.equal(queryOptions(direct.unsafe('SELECT 1')).simple,true);
 assert.equal(queryOptions(direct.unsafe('SELECT 1',[],explicitPrepared)).prepare,true,'direct explicit per-query behavior is untouched');
});

test('nested invocations reuse their own client and separate invocations retain no active driver',async()=>{
 const first=await withPooledSqlScope(async()=>{
  const own=getPooledSql(hyperdrive)!;
  await withPooledSqlScope(async()=>assert.equal(getPooledSql(hyperdrive),own));return own;
 });
 const next=await withPooledSqlScope(async()=>getPooledSql(hyperdrive)!);
 assert.notEqual(first,next);
});


test('the storefront read rollback switch cannot disable a configured required tenant transaction',()=>{
 const env={...hyperdrive,STOREFRONT_POOLED_SQL:'off'};
 assert.equal(getPooledSql(env),null,'optional pooled reads remain disabled');
 const required=getPooledSql(env,{purpose:'tenant-transaction'});assert.ok(required);
 assert.equal(queryOptions(required.unsafe('SELECT $1::text',['synthetic'])).prepare,true);
 assert.equal(getPooledSql(env),null,'a required transaction does not reopen optional reads');
 assert.equal(getPooledSql({STOREFRONT_POOLED_SQL:'off'},{purpose:'tenant-transaction'}),null,'missing physical SQL still fails closed');
});
