import assert from 'node:assert/strict';
import test from 'node:test';
import { GET as checkContact } from './check/route';
import { POST as legacyLogin } from './login/route';
import { POST as setLegacyPassword } from './set-password/route';

test('legacy contact lookup and password routes are retired without inspecting submitted identity', async () => {
    const lookup = await checkContact();
    const login = await legacyLogin();
    const setPassword = await setLegacyPassword();

    for (const response of [lookup, login, setPassword]) {
        assert.equal(response.status, 410);
        assert.equal(response.headers.get('cache-control'), 'no-store');
        assert.deepEqual(await response.json(), {
            error: 'Order history now requires your LetBuyy buyer account.',
        });
    }
});
