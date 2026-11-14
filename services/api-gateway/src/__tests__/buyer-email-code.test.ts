// APPID-P4b — where a buyer's email code goes: the local console for a local database, the provider
// otherwise, and nowhere when there is no provider.

import assert from 'node:assert/strict';
import test from 'node:test';
import type { Env } from '../index';
import { buildBuyerEmailCodeMessage, sendBuyerEmailCode } from '../lib/buyer-email-code';

const delivery = { email: 'shopper@example.com', code: '482913', purpose: 'verify_email' as const };

async function captureConsole(run: () => Promise<unknown>): Promise<{ result: unknown; lines: string[] }> {
    const lines: string[] = [];
    const original = console.info;
    console.info = (line: unknown) => { lines.push(String(line)); };
    try {
        return { result: await run(), lines };
    } finally {
        console.info = original;
    }
}

test("a local database's codes go to the console, even with the local env generator's dummy key", async () => {
    // That key looks real to a placeholder check; sending with it reached the provider and failed.
    const env = { SUPABASE_URL: 'http://localhost:54321', RESEND_API_KEY: 're_local_dev_unused' } as unknown as Env;
    const { result, lines } = await captureConsole(() => sendBuyerEmailCode(env, delivery));
    assert.deepEqual(result, { sent: true });
    assert.equal(lines.length, 1);
    assert.equal(JSON.parse(lines[0]).code, '482913');
});

test('a deployed gateway with no provider sends nothing, and says so', async () => {
    for (const key of [undefined, '', 'replace-with-resend-key', 'dev-only-key', 'placeholder']) {
        const env = { SUPABASE_URL: 'https://abc.supabase.co', RESEND_API_KEY: key } as unknown as Env;
        const { result, lines } = await captureConsole(() => sendBuyerEmailCode(env, delivery));
        assert.deepEqual(result, { sent: false }, String(key));
        assert.equal(lines.length, 0, 'a deployed gateway never logs a code');
    }
});

test('the code is in the body, never the subject', () => {
    for (const purpose of ['verify_email', 'reset_password'] as const) {
        const message = buildBuyerEmailCodeMessage({ ...delivery, purpose });
        assert.ok(!message.subject.includes('482913'), purpose);
        assert.ok(message.text.includes('482913'), purpose);
    }
});
