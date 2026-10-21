import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import test,{before,after} from 'node:test';
import {getPooledSql,closePooledSqlClients,type PooledSqlClient} from '@letbuyy/infrastructure/pooled-sql-adapter';
import {withTenantTx,type TenantTxCallback} from '../../lib/tenant-transaction';
import type {Env} from '../../index';
import {requireOwnedDatabase,startOwnedPooledSqlProxy,type OwnedPooledSqlProxy} from './owned-db-support';
import {newSyntheticTenant,seedSyntheticTenant,seedSyntheticOrder} from './synthetic-tenant';

const owned=requireOwnedDatabase();
const stores=[newSyntheticTenant('pool-context-a'),newSyntheticTenant('pool-context-b')];
let proxy:OwnedPooledSqlProxy;
let env:Env;
let sql:PooledSqlClient;
const stateSql=`SELECT pg_backend_pid() AS pid,current_database() AS database,current_user AS role,session_user AS login,
    nullif(current_setting('app.site_id',true),'') AS site,
    nullif(current_setting('app.request_id',true),'') AS request`;
before(async()=>{
    for(const store of stores){seedSyntheticTenant(owned.psql,store);seedSyntheticOrder(owned.psql,store);}
    proxy=await startOwnedPooledSqlProxy(owned);env=proxy.env() as Env;
    sql=getPooledSql(env,{maxConnections:3,idleTimeoutSeconds:10,connectTimeoutSeconds:5})!;
    assert.ok(sql);
});
after(async()=>{await closePooledSqlClients();await proxy?.stop();});
const transaction=<T>(siteId:string,requestId:string,callback:TenantTxCallback<T>)=>withTenantTx(env,{siteId,requestId},callback);

test('Hyperdrive-shaped owned wire prepares unsafe statements in root, transaction, savepoint and reserved scopes while direct mode stays compatible',async()=>{
    const literal="Synthetic parameter '; SELECT current_user; --";
    const statement='SELECT $1::text AS protocol_literal';
    const check=async(client:Pick<PooledSqlClient,'unsafe'>)=>{
        const explicitUnprepared={prepare:false,simple:true};
        const query=client.unsafe(statement,[literal],explicitUnprepared);
        const queryOptions=(query as unknown as {options:{prepare:boolean;simple:boolean}}).options;
        assert.equal(queryOptions.prepare,true);assert.equal(queryOptions.simple,false);
        assert.equal((await query)[0].protocol_literal,literal,'parameters remain literal data');
        const prepared=await client.unsafe('SELECT name FROM pg_prepared_statements WHERE statement=$1',[statement]);
        assert.ok(prepared.length>0,'server session must contain an actual named prepared statement');
    };
    await check(sql);
    await sql.begin('read write',async tx=>{
        await check(tx);await tx.savepoint('protocol-check',async inner=>{await check(inner);});
        await assert.rejects(tx.savepoint(async inner=>{await check(inner);throw new Error('Synthetic savepoint abort');}),/Synthetic savepoint abort/);
        assert.equal((await tx.unsafe('SELECT 42 AS recovered'))[0].recovered,42);
    });
    const reserved=await sql.reserve();try{await check(reserved);}finally{reserved.release();}
    const direct=getPooledSql({DATABASE_URL:proxy.env().HYPERDRIVE.connectionString},{maxConnections:3,idleTimeoutSeconds:10,connectTimeoutSeconds:5})!;
    assert.notEqual(direct,sql,'target protocol belongs to client identity');
    const unprepared=direct.unsafe(statement,[literal]);
    assert.equal((unprepared as unknown as {options:{prepare:boolean}}).options.prepare,false);
    assert.equal((await unprepared)[0].protocol_literal,literal);
});

test('real Gateway pooled adapter alternates tenants on one backend and restores base role/context after commit',{timeout:20_000},async()=>{
    const initial=(await sql.unsafe(stateSql).catch(error=>{throw new Error(`${error.code}: ${proxy.lastRelayError()??'no relay stderr'}`);}))[0];
    assert.equal(initial.database,owned.database);assert.equal(initial.login,'authenticator');
    assert.equal(initial.role,initial.login);assert.equal(initial.site,null);assert.equal(initial.request,null);
    const pids=new Set([initial.pid]);
    for(const store of [stores[0],stores[1],stores[0]]) {
        const request='syn-pool-'+randomUUID();
        const result=await transaction(store.siteId,request,async tx=>{
            const state=(await tx.unsafe(stateSql))[0];
            const orders=await tx.unsafe('SELECT store_id FROM public.orders');
            return {state,orders};
        });
        assert.equal(result.state.role,'app_tenant');assert.equal(result.state.site,store.siteId);assert.equal(result.state.request,request);
        assert.ok(result.orders.length);assert.ok(result.orders.every(row=>row.store_id===store.siteId));pids.add(result.state.pid);
        const base=(await sql.unsafe(stateSql))[0];assert.equal(base.role,initial.login);assert.equal(base.site,null);assert.equal(base.request,null);pids.add(base.pid);
    }
    assert.equal(pids.size,1,'sequential operations must actually reuse one database session');
    const absent=await sql.begin(async tx=>{await tx.unsafe('SET LOCAL ROLE app_tenant');return tx.unsafe('SELECT count(*)::integer AS count FROM public.orders');});
    assert.equal(absent[0].count,0,'a reused session has no prior tenant authority');
    const wrong=await transaction(randomUUID(),'syn-wrong-context',tx=>tx.unsafe('SELECT count(*)::integer AS count FROM public.orders'));
    assert.equal(wrong[0].count,0);
});

test('application/SQL failures roll back real writes and clear context before a safe retry',{timeout:20_000},async()=>{
    const original=(await transaction(stores[0].siteId,'syn-original',tx=>tx.unsafe('SELECT id,name FROM public.products')))[0];
    await assert.rejects(transaction(stores[0].siteId,'syn-aborted',async tx=>{
        await tx.unsafe('UPDATE public.products SET name=$1 WHERE id=$2',['Synthetic aborted pooled edit',original.id]);
        throw new Error('synthetic application abort');
    }),/synthetic application abort/);
    const base=(await sql.unsafe(stateSql))[0];assert.equal(base.role,base.login);assert.equal(base.site,null);assert.equal(base.request,null);
    const retry=(await transaction(stores[0].siteId,'syn-safe-retry',tx=>tx.unsafe('SELECT id,name FROM public.products')))[0];
    assert.equal(retry.name,original.name,'the failed transaction persisted no product edit');
    await assert.rejects(transaction(stores[1].siteId,'syn-sql-error',tx=>tx.unsafe('SELECT 1/0')));
    const next=(await transaction(stores[0].siteId,'syn-after-error',tx=>tx.unsafe(stateSql)))[0];
    assert.equal(next.site,stores[0].siteId);assert.equal(next.request,'syn-after-error');assert.equal(next.role,'app_tenant');
});

test('concurrent pooled Gateway transactions keep independent tenant/request contexts',{timeout:20_000},async()=>{
    const results=await Promise.all(Array.from({length:18},(_,index)=>{
        const store=stores[index%2],request='syn-concurrent-'+index;
        return transaction(store.siteId,request,async tx=>{
            await tx.unsafe('SELECT pg_sleep(0.015)');
            const state=(await tx.unsafe(stateSql))[0];const rows=await tx.unsafe('SELECT store_id FROM public.orders');
            assert.equal(state.site,store.siteId);assert.equal(state.request,request);assert.equal(state.role,'app_tenant');
            assert.ok(rows.length);assert.ok(rows.every(row=>row.store_id===store.siteId));return state.pid;
        });
    }));
    assert.ok(new Set(results).size>1,'the concurrency proof must use multiple actual database sessions');
    const base=(await sql.unsafe(stateSql))[0];assert.equal(base.role,base.login);assert.equal(base.site,null);assert.equal(base.request,null);
});

test('an owned backend disconnect cannot transfer context to the replacement connection',{timeout:20_000},async()=>{
    await closePooledSqlClients();sql=getPooledSql(env,{maxConnections:3,idleTimeoutSeconds:10,connectTimeoutSeconds:5})!;
    const previous=(await sql.unsafe(stateSql))[0];
    assert.equal(owned.psql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity
        WHERE pid=${Number(previous.pid)} AND datname='${owned.database}' AND usename='${String(previous.login)}';`),'t');
    // A connection loss may fail the first new attempt. Retry only this read-only
    // operation; the Gateway helper must never blindly repeat a callback's effects.
    let result;
    for(let attempt=0;attempt<2;attempt++) {
        try {result=await transaction(stores[1].siteId,'syn-reconnect',tx=>tx.unsafe(stateSql));break;}
        catch(error){if(attempt===1)throw error;await closePooledSqlClients();sql=getPooledSql(env,{maxConnections:3,idleTimeoutSeconds:10,connectTimeoutSeconds:5})!;}
    }
    assert.ok(result);assert.notEqual(result[0].pid,previous.pid);assert.equal(result[0].database,owned.database);
    assert.equal(result[0].site,stores[1].siteId);assert.equal(result[0].request,'syn-reconnect');assert.equal(result[0].role,'app_tenant');
});
