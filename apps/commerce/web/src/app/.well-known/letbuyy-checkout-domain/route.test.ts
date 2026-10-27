import assert from 'node:assert/strict';
import test from 'node:test';
import { createHmac } from 'node:crypto';
import { NextRequest } from 'next/server';
import { canonicalCheckoutDomainProbePayload } from '@letbuyy/checkout-core';
import { GET } from './route';

const key='synthetic-owned-readiness-only-key';
const proof=()=>({site_id:'11111111-1111-4111-8111-111111111111',hostname:'checkout.synthetic.shops.example.invalid',nonce:'a'.repeat(64),expires_at:new Date(Date.now()+30_000).toISOString()});
const sign=(direction:'request'|'response',value:ReturnType<typeof proof>,secret=key)=>createHmac('sha256',secret).update(canonicalCheckoutDomainProbePayload(direction,value)).digest('hex');

test('real checkout readiness handler responds only to a fresh exact-host request MAC with a distinct response MAC',async()=>{
  const previous=process.env.STORE_ACCESS_SIGNING_KEY;process.env.STORE_ACCESS_SIGNING_KEY=key;
  try {
    const value=proof(),signature=sign('request',value);
    const request=()=>new NextRequest(`https://${value.hostname}/.well-known/letbuyy-checkout-domain`,{headers:{host:value.hostname,'X-LetBuyy-Checkout-Probe':JSON.stringify({...value,signature})}});
    const response=await GET(request());assert.equal(response.status,200);assert.equal(response.headers.get('cache-control'),'no-store');
    const body=await response.json();assert.equal(body.signature,sign('response',value));assert.notEqual(body.signature,signature);
    for(const change of [{hostname:'checkout.foreign.shops.example.invalid'},{expires_at:new Date(Date.now()-1000).toISOString()},{nonce:'b'.repeat(64)},{signature:sign('response',value)}]){
      const response=await GET(new NextRequest(`https://${value.hostname}/.well-known/letbuyy-checkout-domain`,{headers:{host:value.hostname,'X-LetBuyy-Checkout-Probe':JSON.stringify({...value,signature,...change})}}));assert.equal(response.status,401);
    }
    delete process.env.STORE_ACCESS_SIGNING_KEY;assert.equal((await GET(request())).status,503);
  } finally {if(previous===undefined)delete process.env.STORE_ACCESS_SIGNING_KEY;else process.env.STORE_ACCESS_SIGNING_KEY=previous;}
});
