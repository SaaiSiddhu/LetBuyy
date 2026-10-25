import assert from 'node:assert/strict';
import test from 'node:test';
import {safePlatformReturnTo, authPathWithReturnTo} from '../lib/auth/return-to';

test('marketplace sign-in preserves only the exact configured local marketplace and admin origins', () => {
    const admin = process.env.NEXT_PUBLIC_ADMIN_URL;
    const marketplace = process.env.NEXT_PUBLIC_THEME_MARKETPLACE_URL;
    process.env.NEXT_PUBLIC_ADMIN_URL = 'http://admin.threadline-synthetic.localhost:62075';
    process.env.NEXT_PUBLIC_THEME_MARKETPLACE_URL = 'http://themes.threadline-synthetic.localhost:9015';
    try {
        const destination = 'http://themes.threadline-synthetic.localhost:9015/install?theme=letbuyy-sense&version=2.0.0';
        assert.equal(safePlatformReturnTo(destination), destination);
        assert.equal(new URL(authPathWithReturnTo('/login', destination), 'https://accounts.letbuyy.com').searchParams.get('return_to'), destination);
        assert.equal(safePlatformReturnTo('http://admin.threadline-synthetic.localhost:62075/accept-invite'), 'http://admin.threadline-synthetic.localhost:62075/accept-invite');
        for (const unsafe of [
            'http://themes.threadline-synthetic.localhost:9016/install',
            'http://other.threadline-synthetic.localhost:9015/install',
            'http://themes.threadline-other.localhost:9015/install',
            'http://localhost:9015/install',
            'http://themes.threadline-synthetic.localhost.attacker.invalid:9015/install',
            'http://user:password@themes.threadline-synthetic.localhost:9015/install',
            'https://themes.threadline-synthetic.localhost:9015/install',
            'ftp://themes.threadline-synthetic.localhost:9015/install',
            '//themes.threadline-synthetic.localhost:9015/install',
            'javascript:alert(1)',
        ]) assert.equal(safePlatformReturnTo(unsafe), null, unsafe);
        process.env.NEXT_PUBLIC_THEME_MARKETPLACE_URL = 'http://themes.example.invalid:9015';
        assert.equal(safePlatformReturnTo('http://themes.example.invalid:9015/install'), null);
        process.env.NEXT_PUBLIC_THEME_MARKETPLACE_URL = 'malformed';
        assert.equal(safePlatformReturnTo('http://admin.threadline-synthetic.localhost:62075/accept-invite'), 'http://admin.threadline-synthetic.localhost:62075/accept-invite');
        assert.equal(safePlatformReturnTo(destination), null);
        process.env.NEXT_PUBLIC_THEME_MARKETPLACE_URL = 'https://themes.example.invalid';
        assert.equal(safePlatformReturnTo('https://themes.example.invalid/install'), 'https://themes.example.invalid/install');
        assert.equal(safePlatformReturnTo('https://themes.example.invalid:444/install'), null);
        process.env.NEXT_PUBLIC_THEME_MARKETPLACE_URL = 'https://user:password@themes.example.invalid';
        assert.equal(safePlatformReturnTo('https://themes.example.invalid/install'), null);
    } finally {
        if (admin === undefined) delete process.env.NEXT_PUBLIC_ADMIN_URL; else process.env.NEXT_PUBLIC_ADMIN_URL = admin;
        if (marketplace === undefined) delete process.env.NEXT_PUBLIC_THEME_MARKETPLACE_URL; else process.env.NEXT_PUBLIC_THEME_MARKETPLACE_URL = marketplace;
    }
});
