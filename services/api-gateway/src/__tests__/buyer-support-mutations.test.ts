import assert from 'node:assert/strict';
import test from 'node:test';
import {buyerSupportRequestKey} from '../lib/buyer-support-mutations';

test('canonical Dart and conventional explicit action keys are preserved byte for byte',()=>{
    const key='support-command-0123456789';
    for(const name of ['X-Idempotency-Key','Idempotency-Key'])
        assert.equal(buyerSupportRequestKey(new Headers({[name]:key})),key);
    assert.equal(buyerSupportRequestKey(new Headers({'X-Idempotency-Key':key,'Idempotency-Key':key})),key);
});

test('two different action-key headers cannot silently select another intent',()=>{
    assert.throws(()=>buyerSupportRequestKey(new Headers({'X-Idempotency-Key':'first-request-key','Idempotency-Key':'other-request-key'})));
});

test('malformed explicit keys are refused rather than replaced by a new action',()=>{
    for(const key of ['','short','x'.repeat(201)])
        assert.throws(()=>buyerSupportRequestKey(new Headers({'X-Idempotency-Key':key})));
});

test('unkeyed old web requests remain single submissions and have no asserted replay identity',()=>{
    const one=buyerSupportRequestKey(new Headers()),two=buyerSupportRequestKey(new Headers());
    assert.match(one,/^legacy-[0-9a-f-]{36}$/);
    assert.notEqual(one,two);
});
