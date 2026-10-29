import assert from 'node:assert/strict';
import test from 'node:test';
import { isOwnedNextIngress } from '../../scripts/governance/owned-next-ingress-policy.mjs';
const config = { port: 4111, checkoutOrigin: 'https://checkout.localhost:4222', rootDomain: 'stores.example.test' };
test('owned TLS ingress preserves exact host/protocol while refusing public, conflicting and malformed hosts', () => {
    for (const host of ['checkout.localhost:4222','shop.localhost:4222','shop.stores.example.test:4222','shop.stores.example.test','shop.stores.example.test:443'])
        assert.equal(isOwnedNextIngress({host,'x-forwarded-host':host,'x-forwarded-proto':'https'}, config),true);
    assert.equal(isOwnedNextIngress({host:'localhost:4111'},config),true);
    for (const headers of [
        {host:'foreign.example.com:4222','x-forwarded-proto':'https'},
        {host:'checkout.localhost:4222','x-forwarded-host':'foreign.example.com','x-forwarded-proto':'https'},
        {host:'checkout.localhost:4222','x-forwarded-proto':['https','http']},
        {host:'checkout.localhost:4222','x-forwarded-proto':'https,http'},
        {host:'checkout.localhost:4223','x-forwarded-proto':'https'},
        {host:'shop.stores.example.test:4223','x-forwarded-proto':'https'},
        {host:'shop.stores.example.test','x-forwarded-proto':'http'},
        {host:'foreign.example.com','x-forwarded-proto':'https'},
        {host:'checkout.localhost','x-forwarded-proto':'https'},
        {host:'shop.stores.example.test:4111'}, {host:'checkout.localhost:4222'},
        {host:'user@localhost:4111'}, {host:'localhost:4111/path'}, {host:['localhost:4111']},
    ]) assert.equal(isOwnedNextIngress(headers,config),false,JSON.stringify(headers));
});
