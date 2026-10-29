#!/usr/bin/env node
// Build and serve a fixed real Commerce/Identity app under its owned supervisor.
// Both children inherit that supervisor's process group, so shutdown covers the
// build workers and the server. No arbitrary command, project or environment loader.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, resolve } from 'node:path';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { verifyOwnedFixture } from './owned-fixture-guard.mjs';
import { isOwnedClientServiceUrl } from './owned-client-url-policy.mjs';
import { isOwnedNextIngress } from './owned-next-ingress-policy.mjs';

const apps = [
    { root: fileURLToPath(new URL('../../apps/commerce/web', import.meta.url)), kind: 'commerce-next-production' },
    { root: fileURLToPath(new URL('../../apps/platform/identity', import.meta.url)), kind: 'identity-next-production' },
    { root: fileURLToPath(new URL('../../apps/merchant/web', import.meta.url)), kind: 'merchant-next-production' },
];
const app = apps.find(candidate => resolve(candidate.root) === resolve(process.cwd()));
const port = Number(process.argv[2]);
if (process.env.LETBUYY_OWNED_CLIENT_RUNTIME !== '1' || process.env.NODE_ENV !== 'production'
    || !app
    || !Number.isInteger(port) || port < 1024 || port > 65535
    || !(new RegExp(`^\\.next-session-runtime-\\d+-${app.kind}$`)).test(process.env.LETBUYY_SESSION_RUNTIME_NEXT_DIST_DIR || '')) {
    throw new Error('production client requires its fixed owned supervisor binding');
}
await verifyOwnedFixture();
const next = join(app.root, 'node_modules/next/dist/bin/next');
const run = args => new Promise((done, reject) => {
    const child = spawn(process.execPath, [next, ...args], { cwd: app.root, env: process.env, stdio: 'inherit' });
    child.once('error', reject);
    child.once('exit', (code, signal) => done(code ?? (signal ? 1 : 0)));
});
const built = await run(['build', '--webpack']);
if (built !== 0) process.exit(built);
// Verify ownership again after a potentially long build, before opening a listener.
await verifyOwnedFixture();
if (app.kind === 'commerce-next-production' && process.env.CHECKOUT_ORIGIN?.startsWith('https:')) {
    if (!isOwnedClientServiceUrl('CHECKOUT_ORIGIN', process.env.CHECKOUT_ORIGIN)) throw new Error('owned checkout ingress must stay on loopback');
    // `next start` constructs request.url from its internal listening address.
    // Model the platform's trusted TLS ingress only after the owned-fixture guard
    // and an exact loopback-host check. This config never enters a deploy artifact.
    const config = JSON.parse(readFileSync(join(app.root, process.env.LETBUYY_SESSION_RUNTIME_NEXT_DIST_DIR, 'required-server-files.json'), 'utf8')).config;
    const nextApp = createRequire(join(app.root, 'package.json'))('next')({
        dev: false, dir: app.root, conf: { ...config, experimental: { ...config.experimental, trustHostHeader: true } },
        hostname: 'localhost', port,
    });
    await nextApp.prepare();
    const handler = nextApp.getRequestHandler();
    const server = createServer((req, res) => {
        if (!isOwnedNextIngress(req.headers, { port, checkoutOrigin: process.env.CHECKOUT_ORIGIN, rootDomain: process.env.NEXT_PUBLIC_STORE_ROOT_DOMAIN })) {
            res.writeHead(421); res.end(); return;
        }
        void handler(req, res).catch(() => { if (!res.headersSent) res.writeHead(500); res.end(); });
    });
    await verifyOwnedFixture();
    server.listen(port, 'localhost');
    const close = () => { server.close(() => { void nextApp.close().finally(() => process.exit(0)); }); server.closeAllConnections(); };
    process.once('SIGTERM', close); process.once('SIGINT', close);
} else {
process.exit(await run(['start', '--hostname', 'localhost', '-p', String(port)]));
}
