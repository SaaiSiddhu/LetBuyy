import assert from 'node:assert/strict';
import test from 'node:test';
import {isOwnedClientServiceUrl} from '../../scripts/governance/owned-client-url-policy.mjs';
test('owned client URLs retain HTTP loopback and allow only checkout HTTPS loopback',()=>{
 for(const name of ['LETBUYY_API_URL','NEXT_PUBLIC_ACCOUNTS_URL','CHECKOUT_ORIGIN'])assert.equal(isOwnedClientServiceUrl(name,'http://localhost:4321'),true);
 assert.equal(isOwnedClientServiceUrl('CHECKOUT_ORIGIN','https://checkout.localhost:4321'),true);
 assert.equal(isOwnedClientServiceUrl('CHECKOUT_ORIGIN','https://127.0.0.1:4321'),true);
 for(const[name,url]of [['LETBUYY_API_URL','https://localhost:4321'],['CHECKOUT_ORIGIN','https://checkout.example.test'],['CHECKOUT_ORIGIN','https://checkout.localhost.example.test'],['CHECKOUT_ORIGIN','https://user:pass@localhost:4321'],['CHECKOUT_ORIGIN','file:///tmp/owned'],['CHECKOUT_ORIGIN','not a URL']])assert.equal(isOwnedClientServiceUrl(name,url),false,`${name} unsafe URL rejected`);
});
