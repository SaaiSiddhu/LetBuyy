import assert from 'node:assert/strict';
import test from 'node:test';
import { readRazorpayTestKeyCsv } from './razorpay-csv';

test('official one-row test key download fills the existing settings form only in test mode', () => {
    const secret = crypto.randomUUID().replaceAll('-', '');
    assert.deepEqual(readRazorpayTestKeyCsv(`key_id,key_secret\r\nrzp_test_synthetic,${secret}\r\n`), { key_id: 'rzp_test_synthetic', key_secret: secret, test_mode: true });
    assert.deepEqual(readRazorpayTestKeyCsv(`\uFEFF"key_id","key_secret"\n"rzp_test_synthetic","${secret}"`), { key_id: 'rzp_test_synthetic', key_secret: secret, test_mode: true });
});
test('live, malformed and multi-account files are rejected without echoing file contents', () => {
    const secret = crypto.randomUUID().replaceAll('-', '');
    for (const text of [`key_id,key_secret\nrzp_live_synthetic,${secret}`, `key_id,key_secret\nrzp_test_synthetic,${secret}\nrzp_test_other,${secret}`, `key_secret,key_id\n${secret},rzp_test_synthetic`, 'key_id,key_secret\nrzp_test_synthetic,', '<html>wrong file</html>']) {
        assert.throws(() => readRazorpayTestKeyCsv(text), error => error instanceof Error && !error.message.includes(secret));
    }
});
