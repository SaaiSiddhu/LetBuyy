#!/usr/bin/env node
// Client-process supervisor for the owned database lane. This is test infrastructure,
// not an application/runtime authority. The existing fixture guard decides ownership.
import { resolveOwnedStoreRoot } from './owned-client-host-policy.mjs';
import { isOwnedClientServiceUrl } from './owned-client-url-policy.mjs';
import { validateOwnedProviderFixture } from './owned-provider-network.mjs';
import { pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { lookup } from 'node:dns/promises';
import { verifyOwnedFixture, OWNED_FIXTURE_ENV } from './owned-fixture-guard.mjs';
import { claimOwnedNextDirectory, ownedNextDirectoryName, removeOwnedNextDirectory } from './owned-next-directory.mjs';

const TYPES = new Set(["commerce-next", "identity-next", "merchant-next", "console-next", "commerce-next-production", "identity-next-production", "merchant-next-production", "commerce-session-smoke", "marketplace-flutter", "buyer-orders-dart", "lifecycle-probe", "money-ledger-scheduled-probe", "subscription-restart"]);
const isNextKind = kind => kind.endsWith('-next') || kind.endsWith('-next-production');
const [kind, parentText, rootText, portText] = process.argv.slice(2);
let client;
let closing = false;
let watchdog;
let nextDirectory;
const alive = pid => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };
const groupAlive = pid => alive(-pid);
const delay = ms => new Promise(resolveDelay => setTimeout(resolveDelay, ms));
const signalGroup = signal => { if (client?.pid) { try { process.kill(-client.pid, signal); } catch (e) { if (e.code !== 'ESRCH') throw e; } } };

async function finish(code) {
    if (closing) return;
    closing = true;
    clearInterval(watchdog);
    if (client?.pid) {
        signalGroup('SIGTERM');
        const deadline = Date.now() + 4000;
        while (groupAlive(client.pid) && Date.now() < deadline) await delay(40);
        if (groupAlive(client.pid)) signalGroup('SIGKILL');
        const hardDeadline = Date.now() + 1500;
        while (groupAlive(client.pid) && Date.now() < hardDeadline) await delay(40);
        if (groupAlive(client.pid)) {
            process.stderr.write('owned client runtime: its process group did not stop\n');
            code = 71;
        }
    }
    if (nextDirectory && (!client?.pid || !groupAlive(client.pid))) {
        try { removeOwnedNextDirectory(nextDirectory); }
        catch (error) { process.stderr.write(`owned Next cleanup refused: ${error.message}\n`); code = 71; }
    }
    process.exit(code);
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, () => { void finish(0); });
process.on('disconnect', () => { void finish(97); });

try {
    if (!TYPES.has(kind)) throw new Error('unapproved client runtime kind');
    if (process.platform === 'win32') throw new Error('owned client supervision requires POSIX process groups');
    const parentPid = Number(parentText);
    if (!Number.isInteger(parentPid) || parentPid <= 1 || parentPid !== process.ppid || !alive(parentPid)) throw new Error('client owner is not the launching process');
    const root = resolve(rootText || '');
    const port = Number(portText);
    if (isNextKind(kind) && (!Number.isInteger(port) || port < 1024 || port > 65535)) throw new Error('invalid local Next port');
    let input = '';
    for await (const chunk of process.stdin) {
        input += chunk;
        if (Buffer.byteLength(input) > 65536) throw new Error('client environment payload exceeds limit');
    }
    const env = JSON.parse(input);
    if (!env || Array.isArray(env) || typeof env !== 'object' || Object.values(env).some(v => typeof v !== 'string')) throw new Error('invalid explicit client environment');
    if (Object.keys(env).some(name => name.startsWith('__NEXT_PRIVATE_'))) throw new Error('owned client runtime refuses private framework configuration overrides');
    const fixture = await verifyOwnedFixture();
    if (closing || !alive(parentPid)) throw new Error('client owner stopped before launch');
    // Never permit a real app .env file to supply an undeclared credential/fallback.
    // Use an isolated candidate snapshot when the developer checkout contains one.
    for (const appRoot of ['apps/commerce/web', 'apps/platform/identity', 'apps/merchant/web', 'apps/internal/console']) {
        for (const file of ['.env', '.env.local', '.env.development', '.env.development.local', '.env.production', '.env.production.local']) {
            if (existsSync(join(root, appRoot, file))) throw new Error('owned client runtime refuses app environment files; use an isolated candidate snapshot');
        }
    }
    for (const name of ['LETBUYY_API_URL','LETBUYY_API_BASE_URL','PLATFORM_CONSOLE_API_BASE_URL','NEXT_PUBLIC_API_URL','NEXT_PUBLIC_API_BASE_URL','NEXT_PUBLIC_ACCOUNTS_URL','NEXT_PUBLIC_ADMIN_URL','CHECKOUT_ORIGIN','LETBUYY_SESSION_RUNTIME_GATEWAY_URL','LETBUYY_MARKETPLACE_OWNED_GATEWAY_URL']) {
        if (!env[name]) continue;
        if (!isOwnedClientServiceUrl(name, env[name])) throw new Error(`owned client runtime requires a loopback ${name}`);
    }
    // The database announcement is the fresh guard's result, never a caller override.
    env.SUPABASE_URL = fixture.restUrl;
    env.NEXT_PUBLIC_SUPABASE_URL = fixture.restUrl;
    env.SUPABASE_SERVICE_ROLE_KEY = process.env.LETBUYY_OWNED_REST_SERVICE_KEY;
    for (const name of Object.values(OWNED_FIXTURE_ENV)) env[name] = process.env[name];
    // Carry the already verified image binding through nested owned clients.
    // A caller's application environment cannot replace this configuration.
    for (const name of ['LETBUYY_EXECUTABLE_PG_IMAGE', 'LETBUYY_EXECUTABLE_REST_IMAGE']) {
        if (process.env[name] !== undefined) env[name] = process.env[name];
        else delete env[name];
    }
    delete env.DATABASE_URL;
    for (const key of Object.keys(env)) if (/^PG/.test(key)) delete env[key];
    env.LETBUYY_OWNED_CLIENT_RUNTIME = '1';
    const canonicalRoot = env.LETBUYY_OWNED_CLIENT_HOST_MODE ? readFileSync(join(root,'packages/shared-types/src/brand.ts'),'utf8').match(/export const DEFAULT_STOREFRONT_DOMAIN = '([a-z0-9.-]+)'/)?.[1] : undefined;
    env.NEXT_PUBLIC_STORE_ROOT_DOMAIN = resolveOwnedStoreRoot({mode:env.LETBUYY_OWNED_CLIENT_HOST_MODE,requestedRoot:env.NEXT_PUBLIC_STORE_ROOT_DOMAIN,storefrontUrl:env.NEXT_PUBLIC_STOREFRONT_URL,checkoutOrigin:env.CHECKOUT_ORIGIN,canonicalRoot});
    delete env.LETBUYY_OWNED_CLIENT_HOST_MODE;
    env.NEXT_TELEMETRY_DISABLED = '1';
    env.CI = '1';
    // NextURL normalizes 127.0.0.1 to localhost. Bind that same host to avoid
    // turning internal rewrites into external self-proxies. DNS ordering keeps
    // the existing IPv4 test adapters reachable; this fixed option is not a
    // caller-controlled loader seam and affects only these disposable clients.
    const addresses = await lookup('localhost', { all:true });
    if (!addresses.length || addresses.some(a => a.address !== '127.0.0.1' && a.address !== '::1')) throw new Error('localhost must resolve only to loopback');
    env.NODE_OPTIONS = '--dns-result-order=ipv4first';
    if (env.LETBUYY_OWNED_BLOCKED_LOCAL_PORTS !== undefined) {
        const ports = JSON.parse(env.LETBUYY_OWNED_BLOCKED_LOCAL_PORTS);
        if (!Array.isArray(ports) || ports.some(p => !Number.isInteger(p) || p < 1 || p > 65535)) throw new Error('invalid owned local port deny list');
        env.NODE_OPTIONS += ' --import=' + pathToFileURL(join(root,'scripts/governance/owned-local-network-preload.mjs')).href;
    }
    if (env.LETBUYY_OWNED_PROVIDER_PROFILE !== undefined) {
        if (!kind.startsWith('identity-next')) throw new Error('owned provider fixture is limited to Identity clients');
        const provider = validateOwnedProviderFixture(JSON.parse(env.LETBUYY_OWNED_PROVIDER_PROFILE));
        const response = await fetch(provider.origin + '/_owned_provider_fixture', {
            headers: { 'X-Owned-Provider-Capability': provider.capability }, redirect:'error', signal:AbortSignal.timeout(3000),
        });
        const receipt = response.ok ? await response.json() : null;
        if (receipt?.kind !== provider.kind || receipt?.runId !== fixture.runId || receipt?.database !== fixture.database) throw new Error('owned provider fixture ownership refused');
        env.NODE_OPTIONS += ' --import=' + pathToFileURL(join(root,'scripts/governance/owned-provider-preload.mjs')).href;
    }
    let command = process.execPath;
    let args;
    let cwd = root;
    if (['commerce-next-production','identity-next-production','merchant-next-production'].includes(kind)) {
        cwd = join(root, { 'commerce-next-production':'apps/commerce/web','identity-next-production':'apps/platform/identity','merchant-next-production':'apps/merchant/web' }[kind]);
        env.NODE_ENV = 'production';
        args = [join(root, 'scripts/governance/owned-next-production.mjs'), String(port)];
    } else if (kind.endsWith('-next')) {
        const roots = { 'commerce-next':'apps/commerce/web', 'identity-next':'apps/platform/identity', 'merchant-next':'apps/merchant/web', 'console-next':'apps/internal/console' };
        cwd = join(root, roots[kind]);
        if (kind === 'console-next') env.NODE_ENV = 'development';
        args = [join(cwd,'node_modules/next/dist/bin/next'),'dev','--webpack','--hostname','localhost','-p',String(port)];
    } else if (kind === 'commerce-session-smoke') {
        cwd = join(root,'apps/commerce/web');
        args = ['--import','tsx','scripts/customer-session-runtime-smoke.mjs'];
    } else if (kind === 'marketplace-flutter') {
        command = 'flutter';
        cwd = join(root,'apps/marketplace/mobile');
        args = ['test','--no-pub','test/marketplace_checkout_owned_gateway_test.dart'];
    } else if (kind === 'buyer-orders-dart') {
        command = 'dart';
        cwd = join(root, 'packages/dart/api_client');
        args = ['test', 'owned_test/buyer_orders_owned_gateway_test.dart'];
    } else if (kind === 'money-ledger-scheduled-probe') {
        args = ['--import','tsx',join(root,'scripts/governance/owned-money-ledger-scheduled-probe.mjs')];
    } else if (kind === 'subscription-restart') {
        args = ['--import','tsx',join(root,'scripts/governance/owned-subscription-restart-probe.mjs')];
    } else {
        args = ['--import','tsx',join(root,'scripts/governance/owned-client-lifecycle-probe.mjs')];
    }
    if (isNextKind(kind)) {
        nextDirectory = claimOwnedNextDirectory({ root, kind, runId:fixture.runId, supervisorPid:process.pid, parentPid });
        env.LETBUYY_SESSION_RUNTIME_NEXT_DIST_DIR = ownedNextDirectoryName(nextDirectory);
        // Deliver proof before spawning a writer. The registered launching parent
        // can finish cleanup if this supervisor is SIGKILLed.
        await new Promise((done, reject) => process.send({ type:'owned-next-directory', receipt:nextDirectory }, error => error ? reject(error) : done()));
        if (closing || !alive(parentPid)) throw new Error('client owner stopped before Next launch');
    }
    client = spawn(command, args, { cwd, env, stdio:['ignore','pipe','pipe'], detached:true });
    client.stdout.pipe(process.stdout);
    client.stderr.pipe(process.stderr);
    client.once('spawn', () => process.send?.({ type:'owned-client-started', pid:client.pid }));
    client.once('error', () => { process.stderr.write('owned client runtime could not start its approved command\n'); void finish(70); });
    client.once('exit', (code, signal) => { void finish(code ?? (signal ? 1 : 0)); });
    watchdog = setInterval(() => { if (!alive(parentPid) || !alive(fixture.runnerPid)) void finish(97); }, 250);
} catch (error) {
    process.stderr.write(`owned client runtime refused: ${error.message}\n`);
    await finish(70);
}
