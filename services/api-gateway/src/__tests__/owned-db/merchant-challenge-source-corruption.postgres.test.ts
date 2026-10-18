// Source timestamp changes must not detach persisted approval from its MAC.
import assert from 'node:assert/strict';
import test from 'node:test';
import {requireOwnedDatabase}from './owned-db-support';
import {merchantFixture,activeFactor,issue,explain}from './merchant-stepup-fixture';
const owned=requireOwnedDatabase();
for(const field of ['verified_at_null','verified_at_changed','expires_at_changed'])test('changed persisted '+field+' denies a previously issued refund proof',async()=>{
 const f=await merchantFixture(owned),factor=await activeFactor(f),proof=await issue(f,factor);assert.equal(proof.status,201,explain(proof));
 const order=crypto.randomUUID(),ret=crypto.randomUUID(),refund=crypto.randomUUID();owned.psql(`INSERT INTO orders(id,store_id,site_id,customer_email,shipping_address,items,subtotal,total,payment_status)VALUES('${order}','${f.siteId}','${f.siteId}','syn-integrity@example.invalid','{}','[]',100,100,'paid');INSERT INTO returns(id,site_id,order_id,status,refund_method,idempotency_key)VALUES('${ret}','${f.siteId}','${order}','received','manual','syn-${ret}');INSERT INTO refunds(id,site_id,order_id,return_id,amount,status,refund_method,provider,idempotency_key)VALUES('${refund}','${f.siteId}','${order}','${ret}',100,'pending','manual','bank_transfer','syn-${refund}');`);
 const alteration=field==='verified_at_null'?'verified_at=NULL':field==='verified_at_changed'?"verified_at=verified_at+interval '1 second'":"expires_at=expires_at+interval '1 second'";
 owned.psql(`UPDATE step_up_challenges SET ${alteration} WHERE id='${proof.json?.data.challenge.id}';`);
 const result=await f.call('POST','/returns/'+ret+'/refund/complete',{refund_id:refund,idempotency_key:crypto.randomUUID()},{'X-Step-Up-Token':proof.json?.data.step_up_token,'X-Step-Up-Verified-At':proof.json?.data.verified_at});assert.equal(result.status,428,explain(result));assert.equal(owned.psql(`SELECT count(*)FROM ledger_transactions WHERE source_type='refund'AND source_id='refund:${refund}';`),'0');
});
