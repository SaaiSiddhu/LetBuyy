import assert from 'node:assert/strict';
import test from 'node:test';
import { checkoutRequestOrigin, checkoutRequestBinding, resolveCheckoutHost } from './checkout-host';
import { installGatewayFake, jsonResponse } from './api/gateway-fetch-fake.test-support';

const origin='https://checkout.snaz.shops.example.invalid';
test('checkout request origin rejects host/protocol forwarding conflicts and malformed hosts',()=>{
  assert.equal(checkoutRequestOrigin(new Headers({host:'checkout.snaz.shops.example.invalid','x-forwarded-host':'checkout.snaz.shops.example.invalid','x-forwarded-proto':'https'}),origin+'/checkout'),origin);
  const cases:Array<Record<string,string>>=[{host:'checkout.other.shops.example.invalid'},{host:'checkout.snaz.shops.example.invalid','x-forwarded-host':'checkout.other.shops.example.invalid'},
    {host:'checkout.snaz.shops.example.invalid','x-forwarded-proto':'http'},{host:'checkout.snaz.shops.example.invalid,attacker.test'},
    {host:'user@checkout.snaz.shops.example.invalid'},{host:'checkout.snaz.shops.example.invalid','x-forwarded-host':'checkout.snaz.shops.example.invalid,attacker.test'}];
  for(const headers of cases) {
    assert.equal(checkoutRequestOrigin(new Headers(headers),origin+'/checkout'),null);
  }
});
test('new checkout links require the actual origin; legacy links are confined to the central origin',()=>{
  const headers=new Headers({host:'checkout.snaz.shops.example.invalid'});
  assert.equal(checkoutRequestBinding(headers,origin),origin);
  for(const declared of [undefined,null,'https://checkout.other.shops.example.invalid',origin+'/',origin+'/path'])assert.equal(checkoutRequestBinding(headers,declared),null);
  assert.equal(checkoutRequestBinding(new Headers({host:'checkout.letbuyy.com'}),null),'https://checkout.letbuyy.com');
});
test('the observed Next dev localhost normalization stays exact to local host, port and nonproduction',()=>{
  const prior=process.env.NODE_ENV;
  const headers=new Headers({host:'checkout.localhost:4321','x-forwarded-host':'checkout.localhost:4321','x-forwarded-proto':'http'});
  try{
    Object.assign(process.env,{NODE_ENV:'development'});
    assert.equal(checkoutRequestOrigin(headers,'http://localhost:4321/checkout'),'http://checkout.localhost:4321');
    assert.equal(checkoutRequestOrigin(headers,'http://localhost:4322/checkout'),null);
    assert.equal(checkoutRequestOrigin(headers,'http://other.localhost:4321/checkout'),null);
    assert.equal(checkoutRequestOrigin(new Headers({host:'checkout.shops.example.invalid:4321'}),'https://localhost:4321/checkout'),null);
    Object.assign(process.env,{NODE_ENV:'production'});assert.equal(checkoutRequestOrigin(headers,'http://localhost:4321/checkout'),null);
  }finally{if(prior===undefined)Reflect.deleteProperty(process.env,'NODE_ENV');else Object.assign(process.env,{NODE_ENV:prior});}
});
test('exact checkout bootstrap carries its purpose through the signed internal perimeter and checks the result',async()=>{
  const old=process.env.INTERNAL_API_SECRET;process.env.INTERNAL_API_SECRET='synthetic-boundary-only-secret';
  let payload:unknown={data:{host:'checkout.snaz.shops.example.invalid',purpose:'checkout',site_id:'11111111-1111-4111-8111-111111111111',subdomain:'snaz'}};
  const fake=installGatewayFake(request=>{assert.equal(request.url.pathname,'/v1/internal/store-access/resolve');assert.equal(request.url.searchParams.get('purpose'),'checkout');assert.equal(request.headers.get('x-internal-api-secret'),process.env.INTERNAL_API_SECRET!);return jsonResponse(payload);});
  try {
    assert.equal((await resolveCheckoutHost('checkout.snaz.shops.example.invalid'))?.subdomain,'snaz');
    for(const patch of [{purpose:'storefront'},{host:'checkout.other.shops.example.invalid'},{site_id:undefined}]){payload={data:{host:'checkout.snaz.shops.example.invalid',purpose:'checkout',site_id:'11111111-1111-4111-8111-111111111111',subdomain:'snaz',...patch}};assert.equal(await resolveCheckoutHost('checkout.snaz.shops.example.invalid'),null);}
  } finally {fake.restore();if(old===undefined)delete process.env.INTERNAL_API_SECRET;else process.env.INTERNAL_API_SECRET=old;}
});
