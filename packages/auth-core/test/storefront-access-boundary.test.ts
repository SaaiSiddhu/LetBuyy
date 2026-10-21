import assert from 'node:assert/strict';
import test from 'node:test';
import {createStorefrontGateToken,createStorefrontPreviewToken,createStorefrontSignedToken,verifyStorefrontGateToken,verifyStorefrontPreviewToken} from '../src/storefront-access';
const secret='synthetic-storefront-capability-key-v1';
const host='synthetic-capability.example.invalid',sid=crypto.randomUUID(),exp=Math.floor(Date.now()/1000)+600;
const gatePayload={sid,host,exp,revision:'a'.repeat(64)};
const previewPayload={sid,host,exp,scope:'share-link' as const,jti:crypto.randomUUID()};
test('password proof cannot become preview authority when keys coincide',async()=>{
 const token=await createStorefrontGateToken(gatePayload,secret);
 assert.equal((await verifyStorefrontPreviewToken(token,secret,{expectedHost:host})).valid,false);
});
test('preview proof cannot become password authority when keys coincide',async()=>{
 const token=await createStorefrontPreviewToken(previewPayload,secret);
 assert.equal((await verifyStorefrontGateToken(token,secret,{expectedHost:host})).valid,false);
});
test('typed preview verification refuses a signed payload with no host',async()=>{
 const token=await createStorefrontSignedToken({sid,exp,scope:'share-link',jti:crypto.randomUUID(),kind:'storefront-preview'},secret);
 assert.equal((await verifyStorefrontPreviewToken(token,secret,{expectedHost:host})).valid,false);
});
test('typed factory roundtrips retain purpose, host and expiry checks',async()=>{
 const gate=await createStorefrontGateToken(gatePayload,secret),preview=await createStorefrontPreviewToken(previewPayload,secret);
 assert.equal((await verifyStorefrontGateToken(gate,secret,{expectedHost:host})).valid,true);
 assert.equal((await verifyStorefrontPreviewToken(preview,secret,{expectedHost:host})).valid,true);
 assert.equal((await verifyStorefrontGateToken(gate,secret,{expectedHost:'foreign.example.invalid'})).valid,false);
 assert.equal((await verifyStorefrontPreviewToken(preview,secret,{nowSeconds:exp+1})).valid,false);
});
