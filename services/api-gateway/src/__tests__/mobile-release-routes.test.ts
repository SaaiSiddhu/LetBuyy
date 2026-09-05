// CAP-FB-APPUPDATE — the mobile release gate.
//
// Two things this file exists to hold. First, the SERVER decides: the response carries computed
// booleans, never the threshold for the client to compare against — putting the comparison back in
// the client is exactly the Firestore behaviour being replaced, where a string compare ranks build
// "10" below "9" and silently stops gating. Second, no published release FAILS OPEN: the gate exists
// to stop a known-bad build, and it must never become a liveness dependency that locks every install
// out because a row is missing.

import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import type { Env } from '../index';
import {
    registerMobileReleaseRoutes,
    type MobileReleaseRow,
} from '../routes/storefront/mobile-release-routes';

const APP = 'com.letbuyy.letbuyy';

const RELEASE: MobileReleaseRow = {
    build_number: 5000,
    version_name: '1.2.0',
    minimum_supported_build: 4500,
    update_url: 'https://play.google.com/store/apps/details?id=com.letbuyy.letbuyy',
    message: 'Please update to keep checking out.',
};

function app(release: MobileReleaseRow | null = RELEASE, error: unknown = null) {
    const calls: { platform: string; applicationId: string }[] = [];
    const router = new Hono<{ Bindings: Env }>();
    registerMobileReleaseRoutes(router, {
        loadLatestRelease: async (_c, platform, applicationId) => {
            calls.push({ platform, applicationId });
            return { data: release, error };
        },
    });
    const outer = new Hono<{ Bindings: Env }>();
    outer.route('/storefront', router);
    return { app: outer, calls };
}

const env = () => ({ ENVIRONMENT: 'test' } as unknown as Env);
const get = (h: ReturnType<typeof app>, qs: string) =>
    h.app.request(`/storefront/app-release?${qs}`, undefined, env());

type Body = {
    data: {
        update_available: boolean;
        force_update: boolean;
        latest_version: string | null;
        update_url: string | null;
        message: string | null;
    };
};

test('a build below the floor is FORCED to update', async () => {
    const res = await get(app(), `platform=android&application_id=${APP}&build=4000`);
    assert.equal(res.status, 200);
    const body = await res.json() as Body;
    assert.equal(body.data.force_update, true);
    assert.equal(body.data.update_available, true);
});

test('a build above the floor but behind latest is offered, not forced', async () => {
    const body = await (await get(app(), `platform=android&application_id=${APP}&build=4800`)).json() as Body;
    assert.equal(body.data.force_update, false, '4800 >= the 4500 floor');
    assert.equal(body.data.update_available, true, '4800 < the 5000 latest');
});

test('the current build is neither offered nor forced', async () => {
    const body = await (await get(app(), `platform=android&application_id=${APP}&build=5000`)).json() as Body;
    assert.equal(body.data.update_available, false);
    assert.equal(body.data.force_update, false);
    assert.equal(body.data.update_url, null, 'a current install has nothing to link to');
});

test('the response NEVER carries the threshold for the client to compare', async () => {
    // The whole point. Returning minimum_supported_build would let the app re-implement the compare,
    // which is the defect being replaced.
    const res = await get(app(), `platform=android&application_id=${APP}&build=4000`);
    const raw = await res.text();
    for (const leak of ['minimum_supported_build', 'build_number', 'is_active']) {
        assert.ok(!raw.includes(leak), `${leak} must not reach the client — it invites a client-side compare`);
    }
});

test('no published release FAILS OPEN', async () => {
    // A missing row must not lock every install out. The gate stops a known-bad build; it is not a
    // liveness dependency for the product.
    const body = await (await get(app(null), `platform=android&application_id=unknown.app&build=1`)).json() as Body;
    assert.equal(body.data.force_update, false);
    assert.equal(body.data.update_available, false);
});

test('a database failure is a 500, not a silent "you are up to date"', async () => {
    // Answering "no update needed" on a failed read would silently disable the gate for everyone.
    const res = await get(app(RELEASE, { message: 'connection reset' }), `platform=android&application_id=${APP}&build=1`);
    assert.equal(res.status, 500);
});

test('build is parsed strictly', async () => {
    const h = app();
    for (const bad of ['', 'abc', '4e3', '-1', '0', ' 4013', '4013.5', '99999999999']) {
        const res = await get(h, `platform=android&application_id=${APP}&build=${encodeURIComponent(bad)}`);
        assert.equal(res.status, 400, `build=${JSON.stringify(bad)} must be refused`);
    }
    assert.equal(h.calls.length, 0, 'a malformed build must not reach the database');
});

test('platform and application_id are required and constrained', async () => {
    const h = app();
    assert.equal((await get(h, `platform=windows&application_id=${APP}&build=1`)).status, 400);
    assert.equal((await get(h, `platform=android&build=1`)).status, 400);
    assert.equal((await get(h, `application_id=${APP}&build=1`)).status, 400);
    assert.equal(h.calls.length, 0);
});

test('the lookup is scoped to the requested app and platform', async () => {
    // Without both, an iOS build could be gated by an Android release, or one app by another's.
    const h = app();
    await get(h, `platform=ios&application_id=com.letbuyy.store&build=10`);
    assert.deepEqual(h.calls, [{ platform: 'ios', applicationId: 'com.letbuyy.store' }]);
});
