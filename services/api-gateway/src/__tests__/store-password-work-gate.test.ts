import assert from 'node:assert/strict';
import test from 'node:test';
import {StorePasswordWorkGate} from '../lib/store-password-work-gate';
import {AppError} from '../lib/errors';
const busy=(e:unknown)=>e instanceof AppError&&e.statusCode===503;
function barrier(){let release!:()=>void;const promise=new Promise<void>(r=>{release=r;});return{promise,release};}
test('one active/four pending: excess work never starts and accepted work drains in order',async()=>{
 const gate=new StorePasswordWorkGate(),hold=barrier(),runs:number[]=[];
 const first=gate.run(async()=>{runs.push(0);await hold.promise;return 0;});
 const rest=Array.from({length:4},(_,i)=>gate.run(async()=>{runs.push(i+1);return i+1;}));
 await assert.rejects(gate.run(async()=>{runs.push(99);return 99;}),busy);assert.deepEqual(runs,[0]);hold.release();assert.deepEqual(await Promise.all([first,...rest]),[0,1,2,3,4]);assert.deepEqual(runs,[0,1,2,3,4]);
});
test('expired pending work is removed and cannot execute after the active operation finishes',async()=>{
 const gate=new StorePasswordWorkGate(1,10),hold=barrier();let late=0;
 const first=gate.run(async()=>{await hold.promise;});
 await assert.rejects(gate.run(async()=>{late++;}),busy);hold.release();await first;assert.equal(late,0);assert.equal(await gate.run(async()=>7),7);
});
test('aborted queued or already-aborted work never runs and frees its pending slot',async()=>{
 const gate=new StorePasswordWorkGate(1),hold=barrier(),controller=new AbortController();let ran=0;
 const first=gate.run(async()=>{await hold.promise;});const pending=gate.run(async()=>{ran++;},controller.signal);controller.abort();await assert.rejects(pending,busy);await assert.rejects(gate.run(async()=>{ran++;},controller.signal),busy);hold.release();await first;assert.equal(ran,0);assert.equal(await gate.run(async()=>8),8);
});
test('active abort does not pretend to interrupt work or release its resource slot early',async()=>{
 const gate=new StorePasswordWorkGate(),hold=barrier(),controller=new AbortController(),order:string[]=[];let returned=false;
 const first=gate.run(async()=>{await hold.promise;order.push('finished');},controller.signal);const rejection=assert.rejects(first,busy).then(()=>{returned=true;});
 controller.abort();const next=gate.run(async()=>{order.push('next');});await Promise.resolve();assert.equal(returned,false);assert.deepEqual(order,[]);hold.release();await Promise.all([rejection,next]);assert.deepEqual(order,['finished','next']);
});
test('work failure releases the slot without losing the queued operation',async()=>{
 const gate=new StorePasswordWorkGate(),hold=barrier();const first=gate.run(async()=>{await hold.promise;throw new Error('Synthetic work failure');});const rejected=assert.rejects(first,/Synthetic work failure/);const next=gate.run(async()=>9);hold.release();await rejected;assert.equal(await next,9);
});

test('absolute monotonic deadline refuses late work even when its timer callback has not run yet',async()=>{
 let now=0,ran=0;const gate=new StorePasswordWorkGate(1,1000,()=>now),hold=barrier();const first=gate.run(async()=>{await hold.promise;});const pending=gate.run(async()=>{ran++;});const rejected=assert.rejects(pending,busy);now=1001;hold.release();await Promise.all([first,rejected]);assert.equal(ran,0);
});
