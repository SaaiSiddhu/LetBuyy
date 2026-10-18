// Staff identity-link and duplicate-email behavior is proved through the actual
// worker/PostgreSQL in merchant-staff-lifecycle.postgres.test.ts. These are only
// transport contracts for the private atomic RPC, not a simulated SQL authority.
import assert from 'node:assert/strict';
import test from 'node:test';
import { executeStaffMutation, readStaffSeatPolicy } from '../execution/staff-execution.adapter';

const actor = { id: 'aaaaaaaa-0000-4000-8000-0000000000b1', email: 'owner@example.invalid' };
const storeId = '99999999-0000-4000-8000-0000000000a1';
function dbFor(reply: unknown, calls: { name: string; args: any }[]) {
    return { rpc: async (name: string, args: unknown) => {
        calls.push({ name, args });
        return name === 'merchant_staff_policy_snapshot_v1'
            ? { data: { slug: 'free', site_type: 'store', plan: null, source_hash: 'synthetic-source-hash' }, error: null }
            : reply;
    } } as any;
}
const input = { actor, storeId, operation: 'create' as const, key: 'stable-staff-request',
    intent: { email: 'staff@example.invalid', role: 'viewer', permissions: { granted: ['products:read'] } } };

test('staff execution sends canonical actor, stable intent/key and server-resolved seat policy to one effect RPC', async () => {
    const calls: {name:string;args:any}[] = [];
    const reply = { data: { status: 201, data: { id: 'synthetic-result' }, replayed: true }, error: null };
    const result = await executeStaffMutation({ ...input, db: dbFor(reply,calls) });
    assert.equal(result.status,201); assert.equal(result.replayed,true);
    assert.deepEqual(calls.map(c=>c.name),['merchant_staff_policy_snapshot_v1','mutate_merchant_staff_v1']);
    assert.equal(calls[1].args.p_actor_id,actor.id); assert.equal(calls[1].args.p_key,input.key);
    assert.equal(calls[1].args.p_seat_limit,1); assert.equal(calls[1].args.p_policy_hash,'synthetic-source-hash');
});
test('a storage error returns sanitized 503 rather than a successful staff record', async () => {
    await assert.rejects(() => executeStaffMutation({ ...input, db: dbFor({ data: null, error: { message: 'private database failure' } },[]) }),
        (e:any)=>e.statusCode===503 && e.code==='STAFF_STATE_UNAVAILABLE' && !e.message.includes('private database'));
});
test('the atomic duplicate-email conflict is exposed without database details or the email', async () => {
    const result = await executeStaffMutation({ ...input, db: dbFor({data:{status:409,error:'EMPLOYEE_ALREADY_EXISTS'},error:null},[]) });
    assert.equal(result.status,409); assert.equal((result.body as any).error.code,'EMPLOYEE_ALREADY_EXISTS');
    assert.doesNotMatch(JSON.stringify(result.body),/constraint|SQLSTATE|staff@example/);
});
test('an unavailable policy snapshot cannot silently grant unlimited seats', async () => {
    await assert.rejects(() => readStaffSeatPolicy({rpc:async()=>({data:null,error:{message:'offline'}})} as any,actor,storeId),
      (e:any)=>e.statusCode===503 && e.code==='STAFF_STATE_UNAVAILABLE');
});
