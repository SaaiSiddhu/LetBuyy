import assert from 'node:assert/strict';
import test from 'node:test';
import { readRazorpayTestKeyCsv } from './razorpay-csv';

test('official one-row test key download fills the existing settings form only in test mode', () => {
    const keyId = ['rzp', 'test', crypto.randomUUID().replaceAll('-', '')].join('_');
    const secret = crypto.randomUUID().replaceAll('-', '');
    assert.deepEqual(readRazorpayTestKeyCsv(`key_id,key_secret\r\n${keyId},${secret}\r\n`), { key_id: keyId, key_secret: secret, test_mode: true });
    assert.deepEqual(readRazorpayTestKeyCsv(`\uFEFF"key_id","key_secret"\n"${keyId}","${secret}"`), { key_id: keyId, key_secret: secret, test_mode: true });
});
test('live, malformed and multi-account files are rejected without echoing file contents', () => {
    const keyId = ['rzp', 'test', crypto.randomUUID().replaceAll('-', '')].join('_');
    const secret = crypto.randomUUID().replaceAll('-', '');
    for (const text of [`key_id,key_secret\n${keyId.replace('_test_', '_live_')},${secret}`, `key_id,key_secret\n${keyId},${secret}\n${keyId + 'other'},${secret}`, `key_secret,key_id\n${secret},${keyId}`, `key_id,key_secret\n${keyId},`, '<html>wrong file</html>']) {
        assert.throws(() => readRazorpayTestKeyCsv(text), error => error instanceof Error && !error.message.includes(secret));
    }
});
