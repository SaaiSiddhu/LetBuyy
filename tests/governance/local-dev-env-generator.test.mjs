// F-LOCALDEV-1 — the local env generator must configure the apps that exist, for a stack that can serve a store.
//
// Three defects, each found by booting the full stack from `develop` on 2026-09-23:
//   1. scripts/dev/ports.mjs keys APP_PORTS by "dirname under apps/", but three keys still named the folders
//      that were renamed in Phase M. setup-local-env.mjs wrote those apps' .env.local into new, empty
//      apps/customer-web, apps/merchant-web and apps/admin-web, so the real apps booted with no env.
//      apply-dev-scripts.mjs threw ENOENT on its first app.
//   2. The generated worker allowlist was 127.0.0.1/32 while Node resolves `localhost` to ::1 first, so the
//      gateway's internal perimeter refused every storefront access lookup and every store page was a 503.
//   3. CHECKOUT_ORIGIN was not overridden, so the gateway handed carts to wrangler.toml's staging checkout host.
//
// The generator runs at import and writes into its own repository, so it is exercised in a scratch copy
// of exactly what it reads: scripts/dev and the env templates, beside empty app and service folders.

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { APP_PORTS, SERVICE_PORTS } from '../../scripts/dev/ports.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

// The scratch mirrors the repository's REAL app and service folders, not the generator's own keys, so a key
// that names no real folder shows up as a folder the generator invented.
const realFolders = (parent) => readdirSync(join(ROOT, parent))
    .filter((name) => existsSync(join(ROOT, parent, name, 'package.json')));

function scratchRepo() {
    const root = mkdtempSync(join(tmpdir(), 'letbuyy-local-env-'));
    cpSync(join(ROOT, 'scripts', 'dev'), join(root, 'scripts', 'dev'), { recursive: true });
    cpSync(join(ROOT, 'config', 'env', 'templates'), join(root, 'config', 'env', 'templates'), { recursive: true });
    for (const app of realFolders('apps')) mkdirSync(join(root, 'apps', app), { recursive: true });
    for (const service of realFolders('services')) mkdirSync(join(root, 'services', service), { recursive: true });
    return root;
}

function envFile(path) {
    return Object.fromEntries(
        readFileSync(path, 'utf8').split('\n')
            .map((line) => /^([A-Z0-9_]+)=(.*)$/.exec(line))
            .filter(Boolean)
            .map((match) => [match[1], match[2]]),
    );
}

test('every APP_PORTS key is a real app folder whose dev script serves that port', () => {
    for (const [app, port] of Object.entries(APP_PORTS)) {
        const manifest = join(ROOT, 'apps', app, 'package.json');
        assert.ok(existsSync(manifest), `APP_PORTS names apps/${app}, which has no package.json`);
        const dev = JSON.parse(readFileSync(manifest, 'utf8')).scripts?.dev ?? '';
        assert.match(dev, new RegExp(`-p ${port}\\b`), `apps/${app} dev script does not serve port ${port}: ${dev}`);
    }
    for (const [service, { http }] of Object.entries(SERVICE_PORTS)) {
        const dev = JSON.parse(readFileSync(join(ROOT, 'services', service, 'package.json'), 'utf8')).scripts?.dev ?? '';
        assert.match(dev, new RegExp(`--port ${http}\\b`), `services/${service} dev script does not serve port ${http}`);
    }
});

test('the generator writes each app its own .env.local and creates no other folder', () => {
    const root = scratchRepo();
    const before = readdirSync(join(root, 'apps')).sort();
    const result = spawnSync(process.execPath, [join(root, 'scripts', 'dev', 'setup-local-env.mjs')], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);

    assert.deepEqual(readdirSync(join(root, 'apps')).sort(), before, 'the generator must not invent app folders');
    for (const app of Object.keys(APP_PORTS)) {
        assert.ok(existsSync(join(root, 'apps', app, '.env.local')), `apps/${app}/.env.local was not written`);
    }
    for (const service of Object.keys(SERVICE_PORTS)) {
        assert.ok(existsSync(join(root, 'services', service, '.dev.vars')), `services/${service}/.dev.vars was not written`);
    }
});

test('apply-dev-scripts runs, and against the committed manifests it changes no byte', () => {
    // docs/LOCAL_DEV.md prescribes it after a port change. Before F-LOCALDEV-1 it threw ENOENT on its first
    // app, and past that it deleted root `dev:store`, dropped `dev`'s api-gateway filter and reformatted
    // @letbuyy/ui's manifest.
    const root = scratchRepo();
    const manifests = [
        'package.json',
        'packages/typescript/ui/package.json',
        ...Object.keys(APP_PORTS).map((app) => `apps/${app}/package.json`),
        ...Object.keys(SERVICE_PORTS).map((service) => `services/${service}/package.json`),
    ];
    for (const manifest of manifests) {
        mkdirSync(dirname(join(root, manifest)), { recursive: true });
        cpSync(join(ROOT, manifest), join(root, manifest));
    }
    const result = spawnSync(process.execPath, [join(root, 'scripts', 'dev', 'apply-dev-scripts.mjs')], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    for (const manifest of manifests) {
        assert.equal(readFileSync(join(root, manifest), 'utf8'), readFileSync(join(ROOT, manifest), 'utf8'), `${manifest} changed`);
    }
});

test('the generated stack can resolve a store and keep checkout on this machine', () => {
    const root = scratchRepo();
    const result = spawnSync(process.execPath, [join(root, 'scripts', 'dev', 'setup-local-env.mjs')], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);

    const localCheckout = `http://checkout.localhost:${APP_PORTS.customer_web}`;
    for (const service of Object.keys(SERVICE_PORTS)) {
        const vars = envFile(join(root, 'services', service, '.dev.vars'));
        const allowlist = (vars.INTERNAL_GATEWAY_IP_ALLOWLIST ?? '').split(',').map((entry) => entry.trim());
        // Node resolves `localhost` to ::1 first; an IPv4-only list refuses the apps' own internal calls.
        assert.ok(allowlist.includes('::1'), `${service}: the internal allowlist must admit ::1, got "${vars.INTERNAL_GATEWAY_IP_ALLOWLIST}"`);
        assert.ok(allowlist.includes('127.0.0.1/32'), `${service}: the internal allowlist must admit 127.0.0.1/32`);
        assert.equal(vars.CHECKOUT_ORIGIN, localCheckout, `${service}: CHECKOUT_ORIGIN must be the local checkout host`);
    }

    const storefront = envFile(join(root, 'apps', 'customer_web', '.env.local'));
    assert.equal(storefront.CHECKOUT_ORIGIN, localCheckout);
    assert.equal(storefront.NEXT_PUBLIC_STORE_ROOT_DOMAIN, 'localhost', 'checkout.localhost is only a checkout host under this root');
    assert.equal(storefront.INTERNAL_API_SECRET, envFile(join(root, 'services', 'api-gateway', '.dev.vars')).INTERNAL_API_SECRET,
        'the storefront and the gateway must share the internal secret');
});
