import assert from 'node:assert/strict';
import test from 'node:test';
import {resolveOwnedStoreRoot} from '../../scripts/governance/owned-client-host-policy.mjs';
const canonicalRoot='stores.example.test';
const valid={mode:'canonical-storefront-loopback',canonicalRoot,requestedRoot:canonicalRoot,storefrontUrl:`https://${canonicalRoot}:4321`,checkoutOrigin:'https://checkout.localhost:4321'};
test('default owned clients retain localhost; explicit canonical host mode requires the scoped TLS pair',()=>{
 assert.equal(resolveOwnedStoreRoot({}), 'localhost');
 assert.equal(resolveOwnedStoreRoot(valid),canonicalRoot);
 for(const override of [{mode:'anything'},{requestedRoot:'foreign.example.test'},{storefrontUrl:'https://foreign.example.test:4321'},{storefrontUrl:`http://${canonicalRoot}:4321`},{storefrontUrl:`https://${canonicalRoot}`},{storefrontUrl:`https://user:pass@${canonicalRoot}:4321`},{checkoutOrigin:'https://checkout.example.test:4321'},{checkoutOrigin:'https://checkout.localhost:4322'},{canonicalRoot:undefined}])assert.throws(()=>resolveOwnedStoreRoot({...valid,...override}));
});
