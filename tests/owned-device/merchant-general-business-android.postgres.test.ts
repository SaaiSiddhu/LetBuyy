// Explicitly selected Wave 6 native fixture. All accounts, documents, and provider values are synthetic.
// An owned emulator receipt and normal Android UI evidence are mandatory; no hosted or live-provider claim follows.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import test from 'node:test';
import { createServer, type Server } from 'node:http';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { exportJWK } from 'jose';
import mobileBff from '../../services/mobile-bff/src/index';
import { hashMerchantPassword } from '../../services/api-gateway/src/lib/merchant-password';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders, INTERNAL_SECRET } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';
import { requireOwnedDatabase, startOwnedClientRuntime, stopOwnedClientRuntime, type OwnedClientProcess } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';

const owned = requireOwnedDatabase();
const bffPort = 54450, identityPort = 54451, apiPort = 54452;
const turnstileSiteKey = '1x' + '0'.repeat(20) + 'AA';
const turnstileSecretKey = '1x' + '0'.repeat(31) + 'AA';

test('owned Merchant Android General, conflict, and private KYC journey', { timeout: 2_700_000 }, async context => {
  const receiptPath = process.env.LETBUYY_ANDROID_DEVICE_RECEIPT;
  assert.ok(receiptPath, 'explicit task-owned emulator receipt required');
  const receipt = JSON.parse(readFileSync(receiptPath, 'utf8')) as {
    owner_thread: string; root: string; avd_name: string; serial: string; emulator_pid: number;
    sdk_root: string; apk_sha256: string; installed_path: string;
  };
  assert.equal(receipt.owner_thread, '01a189a1-9c83-7c50-9314-d93991ee6067');
  assert.equal(receipt.root, '/private/tmp/letbuyy-wave6-android-20261101');
  assert.equal(realpathSync(receipt.root), receipt.root);
  process.kill(receipt.emulator_pid, 0);
  const processCommand = execFileSync('ps', ['-p', String(receipt.emulator_pid), '-o', 'command='], { encoding: 'utf8' });
  assert.ok(processCommand.includes('qemu-system-aarch64') && processCommand.includes('-avd ' + receipt.avd_name) && processCommand.includes('-port 5580'));
  const adb = join(receipt.sdk_root, 'platform-tools/adb');
  assert.equal(execFileSync(adb, ['-s', receipt.serial, 'emu', 'avd', 'name'], { encoding: 'utf8' }).trim().split('\n')[0].trim(), receipt.avd_name);
  const installed = execFileSync(adb, ['-s', receipt.serial, 'shell', 'pm', 'path', 'com.letbuyy.store'], { encoding: 'utf8' }).trim().replace(/^package:/, '');
  assert.equal(installed, receipt.installed_path);
  assert.equal(execFileSync(adb, ['-s', receipt.serial, 'shell', 'sha256sum', installed], { encoding: 'utf8' }).trim().split(/\s+/)[0], receipt.apk_sha256);

  const journeyRoot = join(receipt.root, 'general-business');
  mkdirSync(journeyRoot, { recursive: true });
  const readyPath = join(journeyRoot, 'journey-ready.json');
  const donePath = join(journeyRoot, 'journey-done.json');
  const injectPath = join(journeyRoot, 'inject-conflict.json');
  const injectedPath = join(journeyRoot, 'injected-conflict.json');
  assert.equal(existsSync(donePath), false, 'a prior marker cannot certify this run');
  assert.equal(existsSync(injectPath), false, 'a prior conflict command cannot be replayed');

  const keys = await newIdentityKeys();
  const identityOrigin = `http://127.0.0.1:${identityPort}`;
  const privateObjects = new Map<string, Uint8Array>();
  const gateway = new Gateway(gatewayEnv(owned, keys, {
    ENVIRONMENT: 'local', LETBUYY_IDENTITY_ISSUER: identityOrigin,
    NEXT_PUBLIC_ADMIN_URL: 'http://127.0.0.1:54453', RESEND_API_KEY: '',
    KYC_UPLOAD_ENABLED: 'true',
    KYC_PRIVATE_BUCKET: {
      put: async (key: string, bytes: Uint8Array) => { privateObjects.set(key, bytes); },
      delete: async (key: string) => { privateObjects.delete(key); },
    } as never,
  }));
  const tenant = newSyntheticTenant('wave6-android');
  seedSyntheticTenant(owned.psql, tenant);
  const owner = randomUUID(), password = 'Wave6-pass-42';
  const email = `wave6-owner-${owner}@example.invalid`;
  const hash = await hashMerchantPassword(password);
  owned.psql(`INSERT INTO users_custom(id,email,email_verified,full_name,password_hash)
    VALUES('${owner}','${email}',true,'Synthetic Wave 6 Owner','${hash}');
    UPDATE sites SET custom_user_id='${owner}' WHERE id='${tenant.siteId}';`);

  const calls: Array<{ path: string; method: string; status: number; source: string }> = [];
  const record = async (request: Request, source: string): Promise<Response> => {
    const url = new URL(request.url);
    const bytes = ['GET', 'HEAD'].includes(request.method) ? undefined : new Uint8Array(await request.arrayBuffer());
    const result = await gateway.request(url.pathname + url.search, {
      method: request.method, headers: request.headers, ...(bytes?.length ? { body: bytes as BodyInit } : {}),
    });
    calls.push({ path: url.pathname, method: request.method, status: result.status, source });
    writeFileSync(join(journeyRoot, 'backend-progress.json'), JSON.stringify({ run_id: owned.runId, calls }, null, 2) + '\n');
    return new Response(result.text, { status: result.status, headers: result.headers });
  };
  const bffEnv = {
    INTERNAL_API_SECRET: INTERNAL_SECRET, ENVIRONMENT: 'local', TURNSTILE_SECRET_KEY: turnstileSecretKey,
    API_GATEWAY_SERVICE: { fetch: (request: Request) => record(request, 'mobile-bff') },
  };
  const bridge = (handler: (request: Request) => Promise<Response>): Server => createServer(async (req, res) => {
    try {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      const body = Buffer.concat(chunks), headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string' && !['host', 'connection', 'content-length', 'transfer-encoding', 'accept-encoding'].includes(key)) headers.set(key, value);
      }
      const response = await handler(new Request('http://127.0.0.1' + (req.url ?? '/'), {
        method: req.method, headers, ...(body.length ? { body: body as BodyInit, duplex: 'half' as const } : {}),
      } as RequestInit & { duplex?: 'half' }));
      res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch {
      res.writeHead(500); res.end('{}');
    }
  });

  let api: Server | undefined, bff: Server | undefined, identity: OwnedClientProcess | undefined;
  try {
    api = bridge(request => record(request, 'identity'));
    bff = bridge(request => mobileBff.fetch(request, bffEnv as never));
    for (const [server, port] of [[api, apiPort], [bff, bffPort]] as const) {
      await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
    }
    identity = startOwnedClientRuntime(owned, 'identity-next', { port: identityPort, env: {
      NODE_ENV: 'development', LETBUYY_API_URL: `http://127.0.0.1:${apiPort}/v1`,
      INTERNAL_API_SECRET: INTERNAL_SECRET, LETBUYY_IDENTITY_ISSUER: identityOrigin,
      LETBUYY_IDENTITY_PRIVATE_JWK: JSON.stringify({ ...await exportJWK(keys.privateKey), alg: 'ES256', kid: keys.kid }),
      NEXT_PUBLIC_ACCOUNTS_URL: identityOrigin, NEXT_PUBLIC_ADMIN_URL: 'http://127.0.0.1:54453',
      ACCOUNTS_COOKIE_SECRET: randomUUID() + randomUUID(), COOKIE_DOMAIN: '',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: turnstileSiteKey, TURNSTILE_SECRET_KEY: turnstileSecretKey,
      LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'false', NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'false',
      RESEND_API_KEY: '', LETBUYY_EMAIL_API_KEY: '',
    } });
    const deadline = Date.now() + 180_000;
    let identityReady = false;
    while (Date.now() < deadline) {
      try { if ((await fetch(identityOrigin + '/api/auth/session', { signal: AbortSignal.timeout(2000) })).status === 200) { identityReady = true; break; } }
      catch { /* wait for owned identity */ }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    assert.ok(identityReady, 'owned identity runtime started');
    for (const port of [bffPort, identityPort, apiPort]) execFileSync(adb, ['-s', receipt.serial, 'reverse', `tcp:${port}`, `tcp:${port}`]);
    writeFileSync(readyPath, JSON.stringify({ run_id: owned.runId, serial: receipt.serial, store_id: tenant.siteId,
      store_handle: tenant.subdomain, owner_email: email, password, apk_sha256: receipt.apk_sha256,
      scope: 'Owned Android + BFF/Gateway/Postgres; synthetic documents and account, no real provider or inbox.' }, null, 2) + '\n', { mode: 0o600 });
    console.info('OWNED_WAVE6_ANDROID_READY ' + readyPath);

    while (!existsSync(donePath)) {
      context.signal.throwIfAborted();
      process.kill(receipt.emulator_pid, 0);
      if (identity.exitCode !== null || identity.signalCode !== null) throw new Error('Owned Identity stopped');
      if (existsSync(injectPath) && !existsSync(injectedPath)) {
        const requested = JSON.parse(readFileSync(injectPath, 'utf8')) as { name: string };
        const version = Number(owned.psql(`SELECT version FROM sites WHERE id='${tenant.siteId}';`));
        const headers = await signedIdentityHeaders(owner, email, tenant.siteId);
        headers['Content-Type'] = 'application/json';
        headers['X-Idempotency-Key'] = randomUUID();
        const response = await gateway.request(`/v1/stores/${tenant.siteId}`, { method: 'PATCH', headers,
          body: JSON.stringify({ version, name: requested.name }) });
        assert.equal(response.status, 200, response.text);
        writeFileSync(injectedPath, JSON.stringify({ run_id: owned.runId, status: response.status,
          version: Number(owned.psql(`SELECT version FROM sites WHERE id='${tenant.siteId}';`)), name: requested.name }, null, 2) + '\n');
      }
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    const proof = JSON.parse(readFileSync(donePath, 'utf8')) as { run_id: string; steps: string[]; evidence: string[] };
    assert.equal(proof.run_id, owned.runId);
    const finalInstalled = execFileSync(adb, ['-s', receipt.serial, 'shell', 'pm', 'path', 'com.letbuyy.store'], { encoding: 'utf8' }).trim().replace(/^package:/, '');
    assert.equal(finalInstalled, receipt.installed_path, 'the observed journey must use one installed APK');
    assert.equal(execFileSync(adb, ['-s', receipt.serial, 'shell', 'sha256sum', finalInstalled], { encoding: 'utf8' }).trim().split(/\s+/)[0], receipt.apk_sha256);
    for (const step of ['normal-native-login', 'general-readback', 'stale-save-recovery', 'private-kyc-upload']) assert.ok(proof.steps.includes(step), step);
    assert.ok(proof.evidence.length >= 4);
    for (const path of proof.evidence) { assert.ok(path.startsWith(journeyRoot + '/')); assert.ok(existsSync(path)); }
    assert.ok(calls.some(call => call.source === 'mobile-bff' && call.path === `/v1/stores/${tenant.siteId}` && call.method === 'GET' && call.status === 200));
    assert.ok(calls.some(call => call.source === 'mobile-bff' && call.path === `/v1/stores/${tenant.siteId}` && call.method === 'PATCH' && call.status === 409));
    assert.ok(calls.some(call => call.source === 'mobile-bff' && call.path === '/v1/kyc/documents/upload' && call.method === 'POST' && call.status === 201));
    assert.equal(owned.psql(`SELECT name FROM sites WHERE id='${tenant.siteId}';`), 'Wave 6 server edit');
    assert.equal(owned.psql(`SELECT count(*) FROM merchant_kyc_documents WHERE site_id='${tenant.siteId}' AND document_type='business_pan' AND metadata ? 'private_object_key';`), '1');
    assert.equal(privateObjects.size, 1);
    writeFileSync(join(journeyRoot, 'backend-verified.json'), JSON.stringify({ run_id: owned.runId,
      apk_sha256: receipt.apk_sha256, calls, final_store_name: 'Wave 6 server edit', private_object_count: privateObjects.size,
      scope: 'Owned native readback, stale save, and synthetic private upload. No provider approval or payout evidence.' }, null, 2) + '\n');
  } finally {
    for (const port of [bffPort, identityPort, apiPort]) {
      try { execFileSync(adb, ['-s', receipt.serial, 'reverse', '--remove', `tcp:${port}`]); } catch { /* bounded owned cleanup */ }
    }
    await stopOwnedClientRuntime(identity);
    await gateway.settle();
    for (const server of [api, bff]) if (server) {
      server.closeAllConnections();
      await new Promise<void>(resolve => server.close(() => resolve()));
    }
  }
});
