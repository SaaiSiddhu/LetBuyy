// Synthetic local test credentials only: owned disposable accounts, stub provider identifiers,
// and public challenge test fixtures. Never use these values for a real account or live provider.
// Exact value hashes are reviewed in config/governance/secret-scan-exceptions.json.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { lstat, mkdir, realpath, rm, rmdir, symlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { importJWK, SignJWT, exportJWK, generateKeyPair, jwtVerify } from 'jose';
import {
  LETBUYY_BUYER_SESSION_HEADER,
  LETBUYY_STOREFRONT_SESSION_AUDIENCE,
  LETBUYY_STOREFRONT_SESSION_HEADER,
  verifyCustomerSessionToken,
} from '@letbuyy/auth-core';

const STORE_A = process.env.LETBUYY_SESSION_RUNTIME_STORE_A_ID || '11111111-1111-4111-8111-111111111111';
const STORE_B = process.env.LETBUYY_SESSION_RUNTIME_STORE_B_ID || '22222222-2222-4222-8222-222222222222';
const STORE_A_HOSTNAME = process.env.LETBUYY_SESSION_RUNTIME_STORE_A_HOSTNAME || 'store-a';
const STORE_B_HOSTNAME = process.env.LETBUYY_SESSION_RUNTIME_STORE_B_HOSTNAME || 'store-b';
const STORE_A_NAME = process.env.LETBUYY_SESSION_RUNTIME_STORE_A_NAME || 'Synthetic Store A';
const STORE_ROOT_DOMAIN = process.env.LETBUYY_SESSION_RUNTIME_STORE_ROOT_DOMAIN || 'localhost';
const PRICE_HISTORY_PRODUCT_ID = process.env.LETBUYY_SESSION_RUNTIME_PRICE_HISTORY_PRODUCT_ID;
const ORIGIN_CONTROL_PRODUCT_ID = process.env.LETBUYY_SESSION_RUNTIME_ORIGIN_CONTROL_PRODUCT_ID;
const STALE_WISHLIST_PRODUCT_ID = process.env.LETBUYY_SESSION_RUNTIME_STALE_WISHLIST_PRODUCT_ID;
const BUYER_ORDER_ID = process.env.LETBUYY_SESSION_RUNTIME_BUYER_ORDER_ID;
const BUYER_ORDER_NUMBER = process.env.LETBUYY_SESSION_RUNTIME_BUYER_ORDER_NUMBER;
const PRICE_HISTORY_SMALL_VARIANT_ID = process.env.LETBUYY_SESSION_RUNTIME_PRICE_HISTORY_SMALL_VARIANT_ID;
const PRICE_HISTORY_LARGE_VARIANT_ID = process.env.LETBUYY_SESSION_RUNTIME_PRICE_HISTORY_LARGE_VARIANT_ID;
const PRICE_HISTORY_PRODUCT_NAME = 'Synthetic Price History Product';
const SUPPORT_TEST_SUBJECT = process.env.LETBUYY_SESSION_RUNTIME_SUPPORT_SUBJECT || 'Synthetic support request';
const SUPPORT_TEST_BODY = process.env.LETBUYY_SESSION_RUNTIME_SUPPORT_BODY || 'Synthetic support request body';
const ADDRESS_TEST_NAME = process.env.LETBUYY_SESSION_RUNTIME_ADDRESS_NAME || 'Synthetic Address Buyer';
const ADDRESS_TEST_LINE1 = process.env.LETBUYY_SESSION_RUNTIME_ADDRESS_LINE1 || '789 E2E Market Road';
const ADDRESS_TEST_UPDATED_LINE1 = process.env.LETBUYY_SESSION_RUNTIME_ADDRESS_UPDATED_LINE1 || `${ADDRESS_TEST_LINE1}, Updated Unit`;
const CUSTOMER = process.env.LETBUYY_SESSION_RUNTIME_CUSTOMER_ID || '33333333-3333-4333-8333-333333333333';
const EMAIL = process.env.LETBUYY_SESSION_RUNTIME_EMAIL || 'buyer@example.test';
const PASSWORD = process.env.LETBUYY_SESSION_RUNTIME_PASSWORD || 'Synthetic-Password-42';
const TAB_SWITCH_EMAIL = process.env.LETBUYY_SESSION_RUNTIME_TAB_SWITCH_EMAIL;
const TAB_SWITCH_PASSWORD = process.env.LETBUYY_SESSION_RUNTIME_TAB_SWITCH_PASSWORD;
const TAB_SWITCH_BUYER_ID = process.env.LETBUYY_SESSION_RUNTIME_TAB_SWITCH_BUYER_ID;
const TAB_SWITCH_ADDRESS_LINE1 = process.env.LETBUYY_SESSION_RUNTIME_TAB_SWITCH_ADDRESS_LINE1
  || `Synthetic stale buyer address ${randomUUID().slice(0, 10)}`;
const RESET_TOKEN = process.env.LETBUYY_SESSION_RUNTIME_RESET_TOKEN;
const SESSION_SECRET = process.env.LETBUYY_SESSION_RUNTIME_SESSION_SECRET || 'local-runtime-smoke-customer-session-secret-32-bytes';
const INTERNAL_SECRET = process.env.LETBUYY_SESSION_RUNTIME_INTERNAL_SECRET || 'local-runtime-smoke-internal-secret';
const externalGatewayUrl = process.env.LETBUYY_SESSION_RUNTIME_GATEWAY_URL;
const mockIdentityMode = process.env.LETBUYY_SESSION_RUNTIME_MOCK_IDENTITY === '1';
let buyerSessionToken = process.env.LETBUYY_SESSION_RUNTIME_BUYER_SESSION_TOKEN;
let buyerId = process.env.LETBUYY_SESSION_RUNTIME_BUYER_ID;
let identityPrivateJwk = process.env.LETBUYY_SESSION_RUNTIME_IDENTITY_PRIVATE_JWK;
const identityKid = process.env.LETBUYY_SESSION_RUNTIME_IDENTITY_KID || 'owned-db-identity';
const workspaceRequire = createRequire(new URL('../../../package.json', import.meta.url));
let loginCalls = 0;
let profileCalls = 0;
let linkCalls = 0;
let failStoreLookup = false;
let badPassword = false;
const authorizationCodes = new Map();
const oauthTrace = [];
const browserTrace = [];
let identityPublicKey = null;

async function holdBuyerSessionRefresh(page) {
  const pattern = '**/api/buyer-auth/session';
  let releaseRequest;
  let reportRefresh;
  let reportCompletion;
  let released = false;
  let pendingRoutes = 0;
  const routeOutcomes = [];
  const held = new Promise(resolve => { releaseRequest = resolve; });
  const observed = new Promise(resolve => { reportRefresh = resolve; });
  const completion = new Promise(resolve => { reportCompletion = resolve; });
  const reportIfSettled = () => {
    if (released && pendingRoutes === 0) reportCompletion([...routeOutcomes]);
  };
  await page.route(pattern, async route => {
    if (released) return route.fallback();
    pendingRoutes += 1;
    try {
      const response = await route.fetch();
      const body = await response.json();
      reportRefresh({ status: response.status(), body });
      await held;
      try {
        await route.fulfill({ response });
        routeOutcomes.push('fulfilled');
      } catch (error) {
        // A visible-tab transition dispatches focus and visibility refreshes
        // back-to-back. A newer refresh may abort an older held browser fetch.
        if (!String(error?.message || error).includes('Route is already handled')) throw error;
        routeOutcomes.push('superseded-by-newer-session-refresh');
      }
    } finally {
      pendingRoutes -= 1;
      reportIfSettled();
    }
  });
  await page.evaluate(() => window.dispatchEvent(new Event('focus')));
  let timeout;
  let session;
  try {
    session = await Promise.race([
      observed,
      new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('buyer session revalidation did not reach the real Commerce BFF')), 15_000); }),
    ]);
  } catch (error) {
    releaseRequest();
    await page.unroute(pattern);
    throw error;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
  assert.equal(session.status, 200);
  assert.equal(session.body?.buyer?.id, TAB_SWITCH_BUYER_ID, 'the held session response confirms the replacement buyer');
  return {
    release: () => { released = true; releaseRequest(); reportIfSettled(); },
    completion: () => completion,
    cleanup: () => page.unroute(pattern),
  };
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return JSON.parse(raw || '{}');
}

function encodeBase64Url(bytes) {
  return Buffer.from(bytes).toString('base64url');
}

async function verifyStorefrontSession(token) {
  if (!identityPublicKey || !identityOrigin) return null;
  try {
    const verified = await jwtVerify(token, identityPublicKey, {
      issuer: identityOrigin,
      audience: LETBUYY_STOREFRONT_SESSION_AUDIENCE,
    });
    return verified.payload;
  } catch {
    return null;
  }
}

const gateway = createServer(async (req, res) => {
  const url = new URL(req.url || '/', 'http://127.0.0.1');
  const send = (status, body) => {
    res.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' });
    res.end(JSON.stringify(body));
  };
  if (url.pathname === '/v1/internal/store-access/resolve') {
    if (failStoreLookup) return send(503, { error: 'controlled resolver outage' });
    const host = url.searchParams.get('host') || '';
    const siteId = host.startsWith(`${STORE_A_HOSTNAME}.${STORE_ROOT_DOMAIN}`) || (mockIdentityMode && /^localhost(?::\d+)?$/.test(host)) ? STORE_A
      : host.startsWith(`${STORE_B_HOSTNAME}.${STORE_ROOT_DOMAIN}`) ? STORE_B : null;
    if (mockIdentityMode) oauthTrace.push({ step: 'resolve', host, siteId });
    return siteId ? send(200, { data: { site_id: siteId } }) : send(404, { data: null });
  }
  if (url.pathname === '/v1/storefront/customer/login' && req.method === 'POST') {
    loginCalls += 1;
    let raw = '';
    for await (const chunk of req) raw += chunk;
    const input = JSON.parse(raw || '{}');
    if (badPassword || input.password !== PASSWORD) return send(401, { error: 'invalid credentials' });
    if (input.store_id !== STORE_A) return send(403, { error: 'store mismatch' });
    return send(200, { data: { customer: { id: CUSTOMER, store_id: STORE_A, email: 'buyer@example.test', full_name: 'Synthetic Buyer' } } });
  }
  if (url.pathname === '/v1/storefront/customer/profile' && req.method === 'GET') {
    profileCalls += 1;
    const verification = await verifyCustomerSessionToken(req.headers['x-letbuyy-customer-session'], SESSION_SECRET);
    if (!verification.accepted || verification.payload?.sub !== CUSTOMER || verification.payload?.storeId !== STORE_A) {
      return send(401, { error: 'invalid or wrong-store customer session' });
    }
    return send(200, { data: { customer: { email: 'buyer@example.test', full_name: 'Synthetic Buyer', phone: null, accepts_marketing: false } } });
  }
  if (mockIdentityMode && url.pathname === '/v1/storefront/buyer/authorization-codes' && req.method === 'POST') {
    const session = req.headers[LETBUYY_BUYER_SESSION_HEADER.toLowerCase()];
    let buyerSession;
    try {
      buyerSession = await jwtVerify(session, identityPublicKey, { issuer: identityOrigin, audience: 'letbuyy:buyer-session' });
    } catch {
      return send(401, { error: { code: 'BUYER_SESSION_REQUIRED' } });
    }
    const input = await readJson(req);
    const callback = new URL(input.redirect_uri);
    if (buyerSession.payload.sub !== buyerId || !callback.hostname.startsWith(`${STORE_A_HOSTNAME}.`)
      || input.client_id !== 'letbuyy-storefront' || input.code_challenge_method !== 'S256') {
      return send(400, { error: { code: 'INVALID_AUTHORIZATION' } });
    }
    const code = crypto.randomUUID().replace(/-/g, '');
    authorizationCodes.set(code, { ...input, buyerId, siteId: STORE_A });
    oauthTrace.push({ step: 'authorize', siteId: STORE_A, clientId: input.client_id });
    return send(200, { data: { code } });
  }
  if (mockIdentityMode && url.pathname === '/v1/storefront/buyer/authorization-codes/check' && req.method === 'POST') {
    return send(200, { data: { client: 'storefront', site: { id: STORE_A, name: 'Synthetic Store A' } } });
  }
  if (mockIdentityMode && url.pathname === '/v1/storefront/buyer/me' && req.method === 'GET') {
    try {
      const session = await jwtVerify(req.headers[LETBUYY_BUYER_SESSION_HEADER.toLowerCase()], identityPublicKey, {
        issuer: identityOrigin,
        audience: 'letbuyy:buyer-session',
      });
      if (session.payload.sub === buyerId) return send(200, { data: { buyer: { email: EMAIL } } });
    } catch {}
    return send(401, { error: { code: 'BUYER_SESSION_REQUIRED' } });
  }
  if (mockIdentityMode && url.pathname === '/v1/storefront/buyer/authorization-codes/redeem' && req.method === 'POST') {
    const input = await readJson(req);
    const grant = authorizationCodes.get(input.code);
    authorizationCodes.delete(input.code);
    const challenge = grant ? encodeBase64Url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input.code_verifier || ''))) : '';
    oauthTrace.push({ step: 'redeem', found: Boolean(grant), pkce: Boolean(grant && challenge === grant.code_challenge), redirect: Boolean(grant && input.redirect_uri === grant.redirect_uri) });
    if (!grant || challenge !== grant.code_challenge || input.client_id !== grant.client_id || input.redirect_uri !== grant.redirect_uri) {
      return send(400, { error: { code: 'INVALID_GRANT' } });
    }
    return send(200, { data: {
      buyer: { id: buyerId, email: EMAIL, email_verified: true },
      client_id: grant.client_id,
      site_id: STORE_A,
      session_epoch: 1,
    } });
  }
  if (mockIdentityMode && url.pathname === '/v1/storefront/buyer/link-store-customer' && req.method === 'POST') {
    const session = await verifyStorefrontSession(req.headers[LETBUYY_STOREFRONT_SESSION_HEADER.toLowerCase()]);
    const input = await readJson(req);
    if (!session || session.sub !== buyerId || session.site_id !== STORE_A || input.store_id !== STORE_A
      || url.searchParams.get('store_id') !== STORE_A) {
      oauthTrace.push({ step: 'link-refused', claims: Boolean(session), subject: session?.sub === buyerId, tokenSite: session?.site_id, bodySite: input.store_id, querySite: url.searchParams.get('store_id') });
      return send(403, { error: { code: 'STOREFRONT_SESSION_REQUIRED' } });
    }
    linkCalls += 1;
    oauthTrace.push({ step: 'link', siteId: session.site_id });
    return send(200, { data: { linked: true } });
  }
  if (mockIdentityMode && url.pathname === '/v1/storefront/buyer/storefront-session' && req.method === 'GET') {
    const session = await verifyStorefrontSession(req.headers[LETBUYY_STOREFRONT_SESSION_HEADER.toLowerCase()]);
    if (mockIdentityMode) oauthTrace.push({ step: 'session-read', siteId: url.searchParams.get('store_id'), claims: Boolean(session), tokenSite: session?.site_id });
    if (!session || session.sub !== buyerId || session.site_id !== url.searchParams.get('store_id')) {
      return send(401, { error: { code: 'STOREFRONT_SESSION_REQUIRED' } });
    }
    return send(200, { data: { buyer: { id: buyerId, email: EMAIL, email_verified: true } } });
  }
  return send(404, { error: 'unhandled controlled Gateway request', path: url.pathname });
});

if (!externalGatewayUrl) await new Promise(resolve => gateway.listen(0, '127.0.0.1', resolve));
const gatewayPort = externalGatewayUrl ? null : gateway.address().port;
const gatewayBaseUrl = externalGatewayUrl || `http://127.0.0.1:${gatewayPort}/v1`;
async function reservePort() {
  const probe = createServer();
  await new Promise(resolve => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise(resolve => probe.close(resolve));
  return port;
}
const appPort = await reservePort();
const requestedIdentityPort = process.env.LETBUYY_SESSION_RUNTIME_IDENTITY_PORT;
const identityPort = buyerSessionToken || mockIdentityMode
  ? requestedIdentityPort
    ? Number(requestedIdentityPort)
    : await reservePort()
  : null;
if (identityPort !== null && (!Number.isInteger(identityPort) || identityPort < 1 || identityPort > 65535)) {
  throw new Error('LETBUYY_SESSION_RUNTIME_IDENTITY_PORT must be a valid TCP port');
}
const appOrigin = `http://localhost:${appPort}`;
const identityOrigin = identityPort ? `http://localhost:${identityPort}` : null;
if (mockIdentityMode) {
  assert.ok(!externalGatewayUrl, 'mock Identity mode must use only the controlled local Gateway double');
  assert.ok(!buyerSessionToken && !identityPrivateJwk, 'mock Identity mode creates fresh throwaway signing keys');
  buyerId = crypto.randomUUID();
  const { privateKey, publicKey } = await generateKeyPair('ES256', { extractable: true });
  identityPublicKey = publicKey;
  identityPrivateJwk = JSON.stringify({ ...(await exportJWK(privateKey)), alg: 'ES256', kid: identityKid });
  buyerSessionToken = await new SignJWT({ realm: 'buyer', token_use: 'buyer_session', sep: 1 })
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT', kid: identityKid })
    .setIssuer(identityOrigin)
    .setAudience('letbuyy:buyer-session')
    .setSubject(buyerId)
    .setIssuedAt()
    .setExpirationTime('10m')
    .setJti(crypto.randomUUID())
    .sign(privateKey);
} else if (buyerSessionToken && identityPrivateJwk) {
  const jwk = JSON.parse(identityPrivateJwk);
  const { d, p, q, dp, dq, qi, oth, ...publicJwk } = jwk;
  identityPublicKey = await importJWK(publicJwk, publicJwk.alg || 'ES256');
}
const appHostA = `${STORE_A_HOSTNAME}.${STORE_ROOT_DOMAIN}:${appPort}`;
const appHostB = `${STORE_B_HOSTNAME}.${STORE_ROOT_DOMAIN}:${appPort}`;
const appDir = fileURLToPath(new URL('..', import.meta.url));
const identityDir = fileURLToPath(new URL('../../../platform/identity', import.meta.url));
const runtimeDistDir = `.next-session-runtime-${process.pid}-${randomUUID()}`;
const ownedHostArgs = process.env.LETBUYY_OWNED_CLIENT_RUNTIME === '1' ? ['--hostname', 'localhost'] : [];
const closedChildren = new WeakSet();
const markClosed = child => child.once('close', () => closedChildren.add(child));
let identityApp = null;
let identityOutput = '';
let createdIdentityNodeModules = false;
let createdIdentityTailwindLink = false;
let identityNodeModulesPath = null;
let identityTailwindLinkPath = null;
if (buyerSessionToken) {
  assert.ok(buyerId, 'the real OAuth journey requires the owned buyer id');
  assert.ok(identityPrivateJwk, 'the real OAuth journey requires an ephemeral test signing key');
  identityNodeModulesPath = new URL('../../../platform/identity/node_modules', import.meta.url);
  identityTailwindLinkPath = new URL('../../../platform/identity/node_modules/tailwindcss', import.meta.url);
  try {
    await lstat(identityNodeModulesPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await mkdir(identityNodeModulesPath);
    createdIdentityNodeModules = true;
  }
  try {
    await lstat(identityTailwindLinkPath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    // This restored worktree has Commerce's Tailwind package but no Identity
    // workspace node_modules link. Supply only that missing dev dependency for
    // the local Identity runtime and remove the exact link during teardown.
    const commerceTailwindPath = await realpath(new URL('../node_modules/tailwindcss', import.meta.url));
    await symlink(commerceTailwindPath, identityTailwindLinkPath, 'dir');
    createdIdentityTailwindLink = true;
  }
  identityApp = spawn(fileURLToPath(new URL('../node_modules/.bin/next', import.meta.url)), ['dev', '--webpack', ...ownedHostArgs, '-p', String(identityPort)], {
    cwd: identityDir,
    env: {
      ...process.env,
      LETBUYY_API_URL: gatewayBaseUrl,
      INTERNAL_API_SECRET: INTERNAL_SECRET,
      LETBUYY_IDENTITY_PRIVATE_JWK: identityPrivateJwk,
      LETBUYY_IDENTITY_ISSUER: identityOrigin,
      LETBUYY_SESSION_RUNTIME_NEXT_DIST_DIR: runtimeDistDir,
      NEXT_TELEMETRY_DISABLED: '1',
      ...(process.env.LETBUYY_SESSION_RUNTIME_BUYER_CREDENTIAL_BROWSER === '1' ? {
        NODE_ENV: 'development',
        LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'true',
        NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'true',
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: '',
      } : {}),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: process.env.LETBUYY_OWNED_CLIENT_RUNTIME !== '1',
  });
  markClosed(identityApp);
  identityApp.stdout.on('data', chunk => { identityOutput = (identityOutput + chunk.toString()).slice(-12000); });
  identityApp.stderr.on('data', chunk => { identityOutput = (identityOutput + chunk.toString()).slice(-12000); });
}
// Launch the CLI directly: terminating a pnpm exec wrapper leaves Next holding
// stdout open after the assertions finish, so the owned runner never gets exit.
const app = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url)), 'dev', '--webpack', ...ownedHostArgs, '-p', String(appPort)], {
  cwd: appDir,
  env: {
    ...process.env,
    LETBUYY_API_BASE_URL: gatewayBaseUrl,
    INTERNAL_API_SECRET: INTERNAL_SECRET,
    CUSTOMER_SESSION_SECRET: SESSION_SECRET,
    ...(identityOrigin ? { NEXT_PUBLIC_ACCOUNTS_URL: identityOrigin } : {}),
    LETBUYY_SESSION_RUNTIME_NEXT_DIST_DIR: runtimeDistDir,
    NEXT_TELEMETRY_DISABLED: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: process.env.LETBUYY_OWNED_CLIENT_RUNTIME !== '1',
});
markClosed(app);
let appOutput = '';
app.stdout.on('data', chunk => { appOutput = (appOutput + chunk.toString()).slice(-12000); });
app.stderr.on('data', chunk => { appOutput = (appOutput + chunk.toString()).slice(-12000); });
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitReady() {
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (app.exitCode !== null) throw new Error(`Next exited (${app.exitCode}):\n${appOutput}`);
    try {
      const response = await fetch(`${appOrigin}/api/customer/session`, { headers: headers(appHostA), signal: AbortSignal.timeout(3000) });
      if (response.status === 200) return;
    } catch {}
    await delay(500);
  }
  throw new Error(`Next did not become ready:\n${appOutput}`);
}
async function waitIdentityReady() {
  if (!identityApp || !identityOrigin) return;
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (identityApp.exitCode !== null) throw new Error(`Identity Next exited (${identityApp.exitCode}):\n${identityOutput}`);
    try {
      const response = await fetch(`${identityOrigin}/api/buyer/oauth/token`, { signal: AbortSignal.timeout(3000) });
      if (response.status === 405) return;
    } catch {}
    await delay(500);
  }
  throw new Error(`Identity Next did not become ready:\n${identityOutput}`);
}
function headers(host) {
  return { host, 'x-forwarded-host': host, origin: `http://${host}`, 'sec-fetch-site': 'same-origin' };
}
try {
  process.stdout.write('RUNTIME_STEP:identity-readiness\n');
  await waitIdentityReady();
  process.stdout.write('RUNTIME_STEP:commerce-readiness\n');
  await waitReady();
  process.stdout.write('RUNTIME_STEP:application-contracts\n');

  let gatewayPriceProduct = null;
  if (externalGatewayUrl && PRICE_HISTORY_PRODUCT_ID) {
    const gatewayProductResponse = await fetch(
      `${gatewayBaseUrl}/storefront/${encodeURIComponent(STORE_A_HOSTNAME)}/products/${encodeURIComponent(PRICE_HISTORY_PRODUCT_ID)}`,
    );
    assert.equal(gatewayProductResponse.status, 200, await gatewayProductResponse.clone().text());
    const gatewayProductPayload = await gatewayProductResponse.json();
    gatewayPriceProduct = gatewayProductPayload.data ?? gatewayProductPayload;
    assert.equal(gatewayPriceProduct.id, PRICE_HISTORY_PRODUCT_ID);
    assert.equal(Number(gatewayPriceProduct.price), 120);
    assert.equal(Number(gatewayPriceProduct.compare_price), 150, `the API reference comes from the complete prior observation window, not seller compare_price=999: ${JSON.stringify(gatewayPriceProduct)}`);
    assert.equal(gatewayPriceProduct.prior_price_coverage_complete, true);
    const gatewayVariants = gatewayPriceProduct.variants || gatewayPriceProduct.product_variants || [];
    const gatewaySmall = gatewayVariants.find(variant => variant.id === PRICE_HISTORY_SMALL_VARIANT_ID);
    const gatewayLarge = gatewayVariants.find(variant => variant.id === PRICE_HISTORY_LARGE_VARIANT_ID);
    assert.ok(gatewaySmall && gatewayLarge, 'the actual public Gateway detail must include both relational variants');
    assert.equal(Number(gatewaySmall.price), 110);
    assert.equal(Number(gatewaySmall.compare_price), 150);
    assert.equal(gatewaySmall.prior_price_coverage_complete, true);
    assert.equal(Number(gatewayLarge.price), 160);
    assert.equal(Number(gatewayLarge.compare_price), 200);
    assert.equal(gatewayLarge.prior_price_coverage_complete, true);

    const filteredProductsResponse = await fetch(
      `${gatewayBaseUrl}/storefront/${encodeURIComponent(STORE_A_HOSTNAME)}/products?country_of_origin=Japan&limit=100`,
    );
    assert.equal(filteredProductsResponse.status, 200, await filteredProductsResponse.clone().text());
    const filteredProducts = await filteredProductsResponse.json();
    const filteredProductIds = (filteredProducts.data || []).map(product => product.id);
    assert.deepEqual(filteredProductIds, [PRICE_HISTORY_PRODUCT_ID], 'the actual Gateway applies the normalized origin filter before pagination');
    assert.equal(filteredProducts.meta?.total, 1);

    const allProductsResponse = await fetch(
      `${gatewayBaseUrl}/storefront/${encodeURIComponent(STORE_A_HOSTNAME)}/products?limit=100`,
    );
    assert.equal(allProductsResponse.status, 200, await allProductsResponse.clone().text());
    const allProducts = await allProductsResponse.json();
    const allProductIds = (allProducts.data || []).map(product => product.id);
    assert.ok(allProductIds.includes(PRICE_HISTORY_PRODUCT_ID));
    assert.ok(allProductIds.includes(ORIGIN_CONTROL_PRODUCT_ID), 'the unfiltered Gateway list includes the India control');
  }

  if (process.env.LETBUYY_SESSION_RUNTIME_BUYER_CREDENTIAL_BROWSER === '1') {
    const csrf = 'owned-db-identity-login-csrf-token-0001';
    const postBuyerLogin = (password) => fetch(`${identityOrigin}/api/buyer/login`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: identityOrigin,
        cookie: `letbuyy_csrf=${csrf}`,
        'x-csrf-token': csrf,
      },
      body: JSON.stringify({ email: EMAIL, password, turnstileToken: 'dev-bypass-token' }),
    });
    const invalid = await postBuyerLogin('Synthetic-Wrong-Password-99');
    assert.equal(invalid.status, 401, await invalid.clone().text());
    assert.equal(invalid.headers.get('set-cookie'), null, 'wrong credentials must not issue an Identity buyer session');
    assert.equal((await invalid.json()).error, 'Invalid email or password.');

    const valid = await postBuyerLogin(PASSWORD);
    assert.equal(valid.status, 200, await valid.clone().text());
    assert.equal((await valid.json()).buyer.email, EMAIL);
    const issuedCookie = valid.headers.get('set-cookie') || '';
    assert.match(issuedCookie, /lb_buyer_session=/);
    assert.match(issuedCookie, /HttpOnly/i);
    assert.match(issuedCookie, /SameSite=Lax/i);
    buyerSessionToken = issuedCookie.match(/lb_buyer_session=([^;,]+)/)?.[1];
    assert.ok(buyerSessionToken, 'successful credential verification must issue the Identity session used by the browser flow');
    browserTrace.push({ step: 'identity-password-login-issued-session' });
  }

  const unauthenticated = await fetch(`${appOrigin}/api/customer/session`, { headers: headers(appHostA) });
  assert.equal(unauthenticated.status, 200);
  assert.equal((await unauthenticated.json()).authenticated, false);

  const deniedCrossOrigin = await fetch(`${appOrigin}/api/customer/login`, {
    method: 'POST', headers: { ...headers(appHostA), origin: 'https://attacker.example', 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, storeId: STORE_A, turnstileToken: 'dev-bypass-token' }),
  });
  assert.equal(deniedCrossOrigin.status, 403);
  assert.equal(loginCalls, 0, 'cross-origin login must stop before Gateway authentication');

  const deniedWrongStore = await fetch(`${appOrigin}/api/customer/login`, {
    method: 'POST', headers: { ...headers(appHostA), 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, storeId: STORE_B, turnstileToken: 'dev-bypass-token' }),
  });
  assert.equal(deniedWrongStore.status, 403);
  assert.equal(loginCalls, 0, 'wrong-store login must stop before Gateway authentication');

  const login = await fetch(`${appOrigin}/api/customer/login`, {
    method: 'POST', headers: { ...headers(appHostA), 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD, storeId: STORE_A, turnstileToken: process.env.LETBUYY_SESSION_RUNTIME_TURNSTILE_TOKEN || 'dev-bypass-token' }),
  });
  assert.equal(login.status, 200, await login.clone().text());
  if (!externalGatewayUrl) assert.equal(loginCalls, 1);
  const setCookie = login.headers.get('set-cookie') || '';
  assert.match(setCookie, /lb_customer_session=/);
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.match(setCookie, /Path=\//i);
  const token = setCookie.match(/lb_customer_session=([^;,]+)/)?.[1];
  assert.ok(token, 'login must issue an HttpOnly shopper cookie');
  const cookie = `lb_customer_session=${token}`;

  const session = await fetch(`${appOrigin}/api/customer/session`, { headers: { ...headers(appHostA), cookie } });
  assert.equal(session.status, 200);
  const sessionBody = await session.json();
  assert.equal(sessionBody.authenticated, true);
  assert.equal(sessionBody.customer.id, CUSTOMER);
  assert.equal(sessionBody.customer.storeId, STORE_A);

  const profile = await fetch(`${appOrigin}/api/customer/profile`, { headers: { ...headers(appHostA), cookie } });
  assert.equal(profile.status, 200, await profile.clone().text());
  assert.equal((await profile.json()).customer.email, EMAIL);
  if (!externalGatewayUrl) assert.equal(profileCalls, 1, 'verified Next session must reach the profile consumer');

  const crossStore = await fetch(`${appOrigin}/api/customer/session`, { headers: { ...headers(appHostB), cookie } });
  assert.equal(crossStore.status, 200);
  assert.equal((await crossStore.json()).authenticated, false, 'a cookie from store A must not authenticate on store B');

  badPassword = true;
  const badLogin = await fetch(`${appOrigin}/api/customer/login`, {
    method: 'POST', headers: { ...headers(appHostA), 'content-type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: 'wrong', storeId: STORE_A, turnstileToken: 'dev-bypass-token' }),
  });
  assert.equal(badLogin.status, 401);
  assert.equal(badLogin.headers.get('set-cookie'), null, 'failed authentication must not issue a session');

  badPassword = false;
  if (!externalGatewayUrl) {
    failStoreLookup = true;
    const resolverFailure = await fetch(`${appOrigin}/api/customer/session`, { headers: { ...headers(appHostA), cookie } });
    assert.equal(resolverFailure.status, 200);
    assert.equal((await resolverFailure.json()).authenticated, false, 'store resolution outage must fail closed');
    failStoreLookup = false;
  }

  const verifyProgrammaticStoreLink = async () => {
    if (!buyerSessionToken) return;
    const linkStart = await fetch(`${appOrigin}/api/buyer-auth/start`, {
      method: 'POST',
      headers: { ...headers(appHostA), 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ intent: 'link_store_customer', return_to: '/account/settings' }),
      redirect: 'manual',
    });
    assert.equal(linkStart.status, 303, await linkStart.clone().text());
    const flowCookie = linkStart.headers.get('set-cookie')?.match(/__Host-lb_buyer_auth=([^;,]+)/)?.[1];
    assert.ok(flowCookie, 'link start stores PKCE verifier and state in the host-only flow cookie');
    const flowState = JSON.parse(Buffer.from(flowCookie, 'base64url').toString('utf8'));
    const authorizeUrl = new URL(linkStart.headers.get('location'));
    const csrf = 'owned-db-oauth-csrf-token-0001';
    const authorization = await fetch(`${identityOrigin}/api/buyer/oauth/authorize`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `lb_buyer_session=${buyerSessionToken}; letbuyy_csrf=${csrf}`,
        'x-csrf-token': csrf,
      },
      body: JSON.stringify(Object.fromEntries(authorizeUrl.searchParams)),
    });
    assert.equal(authorization.status, 200, await authorization.clone().text());
    const authorizationBody = await authorization.json();
    const callbackUrl = new URL(authorizationBody.redirect);
    assert.equal(callbackUrl.searchParams.get('state'), authorizeUrl.searchParams.get('state'));
    const callback = await fetch(`${appOrigin}${callbackUrl.pathname}${callbackUrl.search}`, {
      headers: { ...headers(appHostA), cookie: `__Host-lb_buyer_auth=${flowCookie}; lb_customer_session=${token}` },
      redirect: 'manual',
    });
    assert.equal(callback.status, 303, await callback.clone().text());
    const callbackLocation = new URL(callback.headers.get('location'));
    assert.equal(callbackLocation.searchParams.get('buyer_link'), 'linked');
    const setCookies = callback.headers.getSetCookie?.()
      || (callback.headers.get('set-cookie') || '').split(/,\s*(?=[^;,]+=)/);
    assert.ok(setCookies.some(value => value.startsWith('__Host-lb_store_buyer=')), 'callback installs the Identity-issued storefront session');
    assert.ok(setCookies.some(value => value.startsWith('lb_customer_session=') && /Max-Age=0/i.test(value)), 'successful linking expires the legacy shopper session');

    const linkedSessionCookie = setCookies.find(value => value.startsWith('__Host-lb_store_buyer='))?.split(';', 1)[0];
    assert.ok(linkedSessionCookie);
    const canonicalSession = await fetch(`${appOrigin}/api/buyer-auth/session`, {
      headers: { ...headers(appHostA), cookie: linkedSessionCookie },
    });
    assert.equal(canonicalSession.status, 200, await canonicalSession.clone().text());
    const canonicalBody = await canonicalSession.json();
    assert.equal(canonicalBody.buyer.id, buyerId);
    assert.equal(canonicalBody.buyer.email, EMAIL);
    assert.equal(canonicalBody.buyer.emailVerified, true);

    const wrongStoreBuyerSession = await fetch(`${appOrigin}/api/buyer-auth/session`, {
      headers: { ...headers(appHostB), cookie: linkedSessionCookie },
    });
    assert.equal(wrongStoreBuyerSession.status, 200);
    assert.equal((await wrongStoreBuyerSession.json()).buyer, null, 'a site-bound buyer cookie must not authenticate on a sibling storefront');

    const replay = await fetch(`${identityOrigin}/api/buyer/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: callbackUrl.searchParams.get('code'),
        code_verifier: flowState.verifier,
        client_id: authorizeUrl.searchParams.get('client_id'),
        redirect_uri: flowState.redirectUri,
      }),
    });
    assert.equal(replay.status, 400, 'the same authorization code must not mint a second session');
    assert.equal((await replay.json()).error, 'invalid_grant');
  };

  if (process.env.LETBUYY_SESSION_RUNTIME_BROWSER === '1') {
    assert.ok(buyerSessionToken && identityOrigin, 'browser mode requires a synthetic buyer session and local Identity app');
    const runtimeProgress = step => {
      // Keep the stage in the structured failure trace as well as stdout. The
      // owned DB harness intentionally retains only a bounded output tail, so
      // early stdout markers can disappear when a later browser step fails.
      browserTrace.push({ step: `browser-stage:${step}` });
      process.stdout.write(`BROWSER_STEP:${step}\n`);
    };
    const { chromium } = workspaceRequire('@playwright/test');
    const browser = await chromium.launch({ headless: true });
    try {
      const context = await browser.newContext();
      const browserStoreHost = appHostA;
      const storeOrigin = `http://${appHostA}`;
      await context.setExtraHTTPHeaders({ 'x-forwarded-host': browserStoreHost });
      await context.addCookies([
        { name: 'lb_customer_session', value: token, url: storeOrigin, httpOnly: true, sameSite: 'Lax' },
      ]);
      const page = await context.newPage();
      page.on('pageerror', error => browserTrace.push({ step: 'browser-page-error', message: error.message.slice(0, 250) }));
      page.on('console', message => {
        if (message.type() === 'error') browserTrace.push({ step: 'browser-console-error', message: message.text().slice(0, 250) });
      });
      page.on('requestfailed', request => browserTrace.push({ step: 'browser-request-failed', url: new URL(request.url()).pathname, failure: request.failure()?.errorText }));
      page.on('response', response => {
        if (response.status() >= 400) browserTrace.push({ step: 'browser-http-error', status: response.status(), url: new URL(response.url()).pathname });
      });
      page.on('response', async response => {
        if (new URL(response.url()).pathname === '/api/buyer/oauth/authorize') {
          const body = await response.json().catch(() => null);
          const target = typeof body?.redirect === 'string' ? new URL(body.redirect) : null;
          browserTrace.push({ step: 'identity-consent-response', status: response.status(), redirectHost: target?.host ?? null, redirectPath: target?.pathname ?? null });
        }
      });
      await page.goto(`${storeOrigin}/api/buyer-auth/session`, { waitUntil: 'domcontentloaded' });
      assert.equal(await page.locator('body').innerText(), '{"buyer":null}', 'buyer starts signed out on the storefront');
      runtimeProgress('storefront-session-started');
      const registrationHandoff = await page.request.post(`${storeOrigin}/api/customer/register`, {
        form: { email: 'synthetic-registration@example.invalid', password: 'ignored' },
        headers: {
          'x-forwarded-host': browserStoreHost,
          referer: `${appOrigin}/store/${STORE_A_HOSTNAME}/customers/register`,
        },
        maxRedirects: 0,
      });
      assert.equal(registrationHandoff.status(), 303, 'legacy HTML registration form redirects into canonical buyer identity');
      const registrationStart = new URL(registrationHandoff.headers().location, storeOrigin);
      assert.equal(registrationStart.pathname, '/api/buyer-auth/start');
      assert.equal(registrationStart.searchParams.get('return_to'), `/store/${STORE_A_HOSTNAME}/account`);
      assert.equal(registrationStart.searchParams.get('screen'), 'register', 'registration intent survives the compatibility bridge');
      // `goto` waits for the complete server redirect chain, including the
      // storefront's 303 to Identity. A separately registered waitForURL can
      // race the final navigation and obscures the useful current URL when
      // the destination responds with an error page.
      const registrationPageResponse = await page.goto(registrationStart.toString(), { waitUntil: 'domcontentloaded' });
      assert.equal(registrationPageResponse?.status(), 200,
        `registration handoff should render Identity (landed at ${page.url()})`);
      assert.ok(page.url().startsWith(`${identityOrigin}/buyer/authorize?`), 'registration handoff opens the canonical Identity page');
      assert.equal(await page.getByRole('heading', { name: 'Create your LetBuyy account' }).count(), 1,
        'the canonical Identity page opens in registration mode');
      runtimeProgress('registration-handoff-rendered');
      const identityPageResponse = await page.goto(`${storeOrigin}/api/buyer-auth/start?return_to=${encodeURIComponent('/api/buyer-auth/session')}`, { waitUntil: 'domcontentloaded' });
      assert.ok(page.url().startsWith(`${identityOrigin}/buyer/authorize?`), 'the storefront should redirect the browser to the Identity consent page');
      browserTrace.push({ step: 'identity-authorize-response', status: identityPageResponse?.status() ?? null, contentType: identityPageResponse?.headers()['content-type'] ?? null, title: await page.title().catch(() => '') });
      const consentHeading = `Continue to ${STORE_A_NAME}`;
      if (process.env.LETBUYY_SESSION_RUNTIME_BUYER_CREDENTIAL_BROWSER === '1') {
        await page.waitForLoadState('networkidle');
        const signInButton = page.getByRole('button', { name: 'Sign in' });
        await signInButton.waitFor({ state: 'visible', timeout: 10_000 });
        await page.locator('#buyerEmail').fill(EMAIL);
        await page.locator('#buyerPassword').fill(PASSWORD);
        assert.equal(await signInButton.isEnabled(), true, 'Identity sign-in becomes enabled after the page hydrates and credentials are entered');
        await signInButton.click();
      }
      try {
        await page.getByRole('heading', { name: consentHeading }).waitFor({ timeout: 10_000 });
      } catch {
        browserTrace.push({ step: 'identity-authorize-page', path: new URL(page.url()).pathname, body: (await page.locator('body').innerText().catch(() => '')).slice(0, 500) });
        throw new Error('Identity authorize page did not reach the signed-in continuation state');
      }
      await page.waitForLoadState('networkidle');
      await page.getByRole('button', { name: consentHeading }).click();
      try {
        await page.waitForURL(/\/api\/buyer-auth\/session(?:\?.*)?$/, { timeout: 10_000 });
      } catch {
        browserTrace.push({ step: 'after-consent', path: new URL(page.url()).pathname, body: (await page.locator('body').innerText().catch(() => '')).slice(0, 300) });
        throw new Error('Browser did not complete the Identity-to-store callback navigation');
      }
      assert.equal(await page.locator('body').innerText(), `{"buyer":{"id":"${buyerId}","email":"${EMAIL}","emailVerified":true}}`);
      assert.ok(await context.cookies(storeOrigin).then(cookies => cookies.some(cookie => cookie.name === 'lb_customer_session')),
        'a normal buyer sign-in keeps the separate legacy store-customer session intact');
      runtimeProgress('canonical-buyer-login-and-consent-completed');

      await page.goto(`${storeOrigin}/store/${STORE_A_HOSTNAME}/account/support`, { waitUntil: 'commit', timeout: 90_000 });
      runtimeProgress('buyer-support-page-response-committed');
      await page.getByRole('heading', { name: 'Support', exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
      runtimeProgress('buyer-support-page-rendered');
      await page.getByLabel('Subject').fill(SUPPORT_TEST_SUBJECT);
      await page.getByLabel('Message').fill(SUPPORT_TEST_BODY);
      await page.getByRole('button', { name: 'Send request' }).click();
      await page.getByRole('heading', { name: 'Request received' }).waitFor({ state: 'visible', timeout: 15_000 });
      await page.getByRole('status').getByText(SUPPORT_TEST_BODY, { exact: true }).waitFor({ state: 'visible' });
      const receiptResponse = await page.request.get(`${storeOrigin}/api/buyer/support/tickets`);
      assert.equal(receiptResponse.status(), 200);
      const supportTickets = (await receiptResponse.json()).tickets;
      const createdSupportTicket = supportTickets.find(ticket => ticket.subject === SUPPORT_TEST_SUBJECT);
      assert.ok(createdSupportTicket?.id, 'the complaint receipt must be saved in the signed buyer ticket list');
      await page.getByRole('button', { name: new RegExp(SUPPORT_TEST_SUBJECT) }).click();
      await page.getByRole('heading', { name: SUPPORT_TEST_SUBJECT }).waitFor({ state: 'visible' });
      await page.getByLabel('Reply').fill('Synthetic follow-up detail.');
      await page.getByRole('button', { name: 'Send reply' }).click();
      await page.getByText('Synthetic follow-up detail.', { exact: true }).waitFor({ state: 'visible' });
      browserTrace.push({ step: 'buyer-support-browser-journey', ticketId: createdSupportTicket.id, complaintReceipt: true, publicReply: true });
      runtimeProgress('support-journey-completed');

      const legacyLogout = await page.evaluate(async () => {
        const response = await fetch('/api/customer/logout', {
          method: 'POST',
          headers: { accept: 'application/json' },
        });
        return { status: response.status, body: await response.json() };
      });
      assert.equal(legacyLogout.status, 200);
      assert.deepEqual(legacyLogout.body, { success: true });
      let activeCookies = await context.cookies(storeOrigin);
      assert.ok(!activeCookies.some(cookie => cookie.name === 'lb_customer_session'),
        'legacy customer logout clears its own cookie');
      assert.ok(activeCookies.some(cookie => cookie.name === '__Host-lb_store_buyer'),
        'legacy customer logout preserves the independent canonical buyer cookie');
      const legacySignedOut = await page.evaluate(async () => {
        const response = await fetch('/api/customer/session', { cache: 'no-store' });
        return { status: response.status, body: await response.json() };
      });
      assert.equal(legacySignedOut.status, 200);
      assert.deepEqual(legacySignedOut.body, { authenticated: false, customer: null });
      const canonicalAfterLegacyLogout = await page.evaluate(async () => {
        const response = await fetch('/api/buyer-auth/session', { cache: 'no-store' });
        return { status: response.status, body: await response.json() };
      });
      assert.equal(canonicalAfterLegacyLogout.status, 200);
      assert.deepEqual(canonicalAfterLegacyLogout.body, { buyer: { id: buyerId, email: EMAIL, emailVerified: true } });

      // Restore only the synthetic legacy cookie to prove that canonical logout cannot clear it.
      await context.addCookies([
        { name: 'lb_customer_session', value: token, url: storeOrigin, httpOnly: true, sameSite: 'Lax' },
      ]);
      const buyerLogout = await page.evaluate(async () => {
        const response = await fetch('/api/buyer-auth/logout', {
          method: 'POST',
          headers: { accept: 'application/json' },
        });
        return { status: response.status, body: await response.json() };
      });
      assert.equal(buyerLogout.status, 200);
      assert.deepEqual(buyerLogout.body, { success: true });
      activeCookies = await context.cookies(storeOrigin);
      assert.ok(!activeCookies.some(cookie => cookie.name === '__Host-lb_store_buyer'),
        'canonical buyer logout clears its own cookie');
      assert.ok(activeCookies.some(cookie => cookie.name === 'lb_customer_session'),
        'canonical buyer logout preserves the independent legacy customer cookie');
      const legacyAfterBuyerLogout = await page.evaluate(async () => {
        const response = await fetch('/api/customer/session', { cache: 'no-store' });
        return { status: response.status, body: await response.json() };
      });
      assert.equal(legacyAfterBuyerLogout.status, 200);
      assert.equal(legacyAfterBuyerLogout.body.authenticated, true,
        'legacy store customer session remains usable after canonical buyer logout');
      const canonicalSignedOut = await page.evaluate(async () => {
        const response = await fetch('/api/buyer-auth/session', { cache: 'no-store' });
        return { status: response.status, body: await response.json() };
      });
      assert.equal(canonicalSignedOut.status, 200);
      assert.deepEqual(canonicalSignedOut.body, { buyer: null });
      browserTrace.push({ step: 'realm-explicit-logout', legacyLogoutPreservedBuyer: true, buyerLogoutPreservedLegacy: true });
      runtimeProgress('realm-explicit-logout-completed');

      const siblingStoreOrigin = `http://${appHostB}`;
      await page.setExtraHTTPHeaders({ 'x-forwarded-host': appHostB });
      await page.goto(`${siblingStoreOrigin}/api/buyer-auth/session`, { waitUntil: 'domcontentloaded' });
      assert.equal(await page.locator('body').innerText(), '{"buyer":null}', 'linked buyer cookie is refused on sibling storefront');
      await context.close();

      const linkContext = await browser.newContext();
      // These real Next pages compile on first navigation. Bound cold startup
      // separately from the existing UI, session-refresh and denial deadlines.
      linkContext.setDefaultNavigationTimeout(90_000);
      await linkContext.setExtraHTTPHeaders({ 'x-forwarded-host': browserStoreHost });
      await linkContext.addCookies([
        { name: 'lb_customer_session', value: token, url: storeOrigin, httpOnly: true, sameSite: 'Lax' },
      ]);
      const linkPage = await linkContext.newPage();
      linkPage.on('pageerror', error => browserTrace.push({ step: 'link-browser-page-error', message: error.message.slice(0, 250) }));
      linkPage.on('console', message => {
        if (message.type() === 'error') browserTrace.push({ step: 'link-browser-console-error', message: message.text().slice(0, 250) });
      });
      // A visible server-rendered submit button can precede hydration. Wait
      // for the real client session read before exercising its submit handler.
      const hydratedLegacySession = linkPage.waitForResponse(response =>
        new URL(response.url()).pathname === '/api/customer/session' && response.request().method() === 'GET',
      { timeout:90_000 }); // Includes the cold navigation before hydration starts.
      await linkPage.goto(`${storeOrigin}/store/${STORE_A_HOSTNAME}/account/settings`, { waitUntil: 'domcontentloaded' });
      const legacySessionResponse = await hydratedLegacySession;
      assert.equal(legacySessionResponse.status(), 200);
      await legacySessionResponse.finished();
      const linkButton = linkPage.getByRole('button', { name: 'Sign in and connect with LetBuyy' });
      await linkButton.waitFor({ state: 'visible', timeout: 15_000 });
      await linkButton.click();
      await linkPage.waitForURL(/\/buyer\/authorize\?/, { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await linkPage.waitForLoadState('networkidle');
      const linkSignInButton = linkPage.getByRole('button', { name: 'Sign in' });
      await linkSignInButton.waitFor({ state: 'visible', timeout: 10_000 });
      await linkPage.locator('#buyerEmail').fill(EMAIL);
      await linkPage.locator('#buyerPassword').fill(PASSWORD);
      await linkSignInButton.click();
      await linkPage.getByRole('heading', { name: consentHeading }).waitFor({ timeout: 10_000 });
      await linkPage.waitForLoadState('networkidle');
      await linkPage.getByRole('button', { name: consentHeading }).click();
      await linkPage.waitForURL(url => url.pathname === `/store/${STORE_A_HOSTNAME}/account/settings`
        && url.searchParams.get('buyer_link') === 'linked', { waitUntil: 'domcontentloaded', timeout: 60_000 });
      await linkPage.getByText('This store account is connected.', { exact: true }).waitFor({ timeout: 10_000 });
      const linkedCookies = await linkContext.cookies(storeOrigin);
      assert.ok(linkedCookies.some(cookie => cookie.name === '__Host-lb_store_buyer'), 'account-link callback issues the canonical buyer session on this store');
      assert.ok(!linkedCookies.some(cookie => cookie.name === 'lb_customer_session'), 'successful account linking retires the legacy store session on this host');
      await linkPage.goto(`${storeOrigin}/api/buyer-auth/session`, { waitUntil: 'domcontentloaded' });
      assert.equal(await linkPage.locator('body').innerText(), `{"buyer":{"id":"${buyerId}","email":"${EMAIL}","emailVerified":true}}`);
      runtimeProgress('legacy-account-link-completed');
      if (gatewayPriceProduct) {
        // Product and image/review APIs can remain active in Chromium long
        // enough to outlive Playwright's networkidle threshold. The assertions
        // below wait for the actual product and wishlist controls instead.
        await linkPage.goto(`${storeOrigin}/store/${STORE_A_HOSTNAME}/product/${PRICE_HISTORY_PRODUCT_ID}`, { waitUntil: 'domcontentloaded' });
        await linkPage.getByRole('heading', { name: PRICE_HISTORY_PRODUCT_NAME }).waitFor({ state: 'visible', timeout: 15_000 });
        const saveButton = linkPage.getByRole('button', { name: 'Add to wishlist' });
        await saveButton.waitFor({ state: 'visible', timeout: 15_000 });
        try {
          await saveButton.click({ trial: true, timeout: 30_000 });
        } catch (error) {
          const state = await linkPage.evaluate(() => ({
            path: location.pathname,
            buttons: [...document.querySelectorAll('button[aria-label]')].map(button => ({ label: button.getAttribute('aria-label'), title: button.title, disabled: button.disabled })),
            main: document.querySelector('main')?.innerText.slice(0, 1000),
          }));
          throw new Error(`real buyer-A wishlist must become actionable before saving; page=${JSON.stringify(state)}; ${String(error)}`);
        }
        const mutation = linkPage.waitForResponse(response => new URL(response.url()).pathname === '/api/buyer/wishlist'
          && response.request().method() === 'POST', { timeout: 15_000 });
        await saveButton.click();
        const saved = await mutation;
        assert.equal(saved.status(), 200, 'the product-detail save must be confirmed by the canonical buyer BFF');
        await linkPage.getByRole('button', { name: 'Remove from wishlist' }).waitFor({ state: 'visible', timeout: 10_000 });
        await linkPage.goto(`${storeOrigin}/store/${STORE_A_HOSTNAME}/account/wishlist`, { waitUntil: 'domcontentloaded' });
        await linkPage.getByRole('heading', { name: /Wishlist \(1\)/ }).waitFor({ state: 'visible', timeout: 15_000 });
        await linkPage.getByText(PRICE_HISTORY_PRODUCT_ID.slice(0, 12), { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
        browserTrace.push({ step: 'buyer-product-detail-save-rendered-in-account-wishlist', productId: PRICE_HISTORY_PRODUCT_ID, mutationStatus: saved.status() });
        runtimeProgress('buyer-wishlist-journey-completed');

        if (TAB_SWITCH_EMAIL && TAB_SWITCH_PASSWORD) {
          // Keep the original account page mounted while a sibling tab signs in as
          // another real synthetic Identity account. The second account has no
          // buyer_store_customers edge, so its store wishlist must remain empty.
          let staleWishlistPage = null;
          let buyerAWishlistSnapshot = null;
          if (STALE_WISHLIST_PRODUCT_ID) {
            staleWishlistPage = await linkContext.newPage();
            await staleWishlistPage.goto(`${storeOrigin}/store/${STORE_A_HOSTNAME}/product/${STALE_WISHLIST_PRODUCT_ID}`, { waitUntil: 'domcontentloaded' });
            await staleWishlistPage.getByRole('heading', { name: 'Synthetic Stale Wishlist Product' }).waitFor({ state: 'visible', timeout: 15_000 });
            const staleWishlistButton = staleWishlistPage.getByRole('button', { name: 'Add to wishlist' });
            await staleWishlistButton.waitFor({ state: 'visible', timeout: 10_000 });
            await staleWishlistButton.click({ trial: true, timeout: 30_000 });
            const buyerAWishlistAddPromise = staleWishlistPage.waitForResponse(response => new URL(response.url()).pathname === '/api/buyer/wishlist'
              && response.request().method() === 'POST', { timeout: 15_000 });
            await staleWishlistButton.click();
            const buyerAWishlistAdd = await buyerAWishlistAddPromise;
            assert.equal(buyerAWishlistAdd.status(), 200, 'buyer A can add the control product before the account switch');
            await staleWishlistPage.getByRole('button', { name: 'Remove from wishlist' }).waitFor({ state: 'visible', timeout: 10_000 });
            runtimeProgress('buyer-a-wishlist-control-row-created');
            const buyerAWishlistResponse = await staleWishlistPage.evaluate(async () => {
              const response = await fetch('/api/buyer/wishlist', { cache: 'no-store' });
              return { status: response.status, body: await response.json().catch(() => null) };
            });
            assert.equal(buyerAWishlistResponse.status, 200, 'buyer A wishlist snapshot must be available before switching accounts');
            assert.ok(buyerAWishlistResponse.body?.productIds?.includes(STALE_WISHLIST_PRODUCT_ID));
            buyerAWishlistSnapshot = buyerAWishlistResponse.body;
            await staleWishlistPage.close();
            staleWishlistPage = null;
          }

          let staleOrderListPage = null;
          let staleOrderDetailPage = null;
          let buyerASessionSnapshot = null;
          let buyerAOrderSessionSnapshot = null;
          let buyerAOrderListSnapshot = null;
          let buyerAOrderDetailSnapshot = null;
          if (BUYER_ORDER_ID && BUYER_ORDER_NUMBER) {
            const buyerAOrderSnapshot = await linkPage.evaluate(async (orderId) => {
              const [sessionResponse, listResponse, detailResponse] = await Promise.all([
                fetch('/api/buyer-auth/session', { cache: 'no-store' }),
                fetch('/api/buyer/orders?limit=20', { cache: 'no-store' }),
                fetch(`/api/buyer/orders?order_id=${encodeURIComponent(orderId)}`, { cache: 'no-store' }),
              ]);
              return {
                sessionStatus: sessionResponse.status,
                session: await sessionResponse.json().catch(() => null),
                listStatus: listResponse.status,
                list: await listResponse.json().catch(() => null),
                detailStatus: detailResponse.status,
                detail: await detailResponse.json().catch(() => null),
              };
            }, BUYER_ORDER_ID);
            buyerAOrderSessionSnapshot = buyerAOrderSnapshot.session;
            buyerASessionSnapshot = buyerAOrderSessionSnapshot;
            buyerAOrderListSnapshot = buyerAOrderSnapshot.list;
            buyerAOrderDetailSnapshot = buyerAOrderSnapshot.detail;
            browserTrace.push({
              step: 'buyer-a-order-list-and-detail-read-through-real-bffs',
              sessionStatus: buyerAOrderSnapshot.sessionStatus,
              sessionBuyerId: buyerAOrderSessionSnapshot?.buyer?.id,
              listStatus: buyerAOrderSnapshot.listStatus,
              orders: Array.isArray(buyerAOrderListSnapshot?.orders)
                ? buyerAOrderListSnapshot.orders.map(order => ({ id: order.id, order_number: order.order_number }))
                : null,
              detailStatus: buyerAOrderSnapshot.detailStatus,
              detailOrderId: buyerAOrderDetailSnapshot?.order?.id,
              detailOrderNumber: buyerAOrderDetailSnapshot?.order?.order_number,
            });
            assert.equal(buyerAOrderSnapshot.sessionStatus, 200);
            assert.equal(buyerAOrderSessionSnapshot?.buyer?.id, buyerId, 'the cached session snapshot belongs to buyer A');
            assert.equal(buyerAOrderSnapshot.listStatus, 200, 'buyer A order list BFF must return successfully');
            assert.ok(Array.isArray(buyerAOrderListSnapshot?.orders)
              && buyerAOrderListSnapshot.orders.some(order => order.id === BUYER_ORDER_ID && order.order_number === BUYER_ORDER_NUMBER),
            'the explicitly linked buyer-A order must appear in the real BFF list before the account switch');
            assert.equal(buyerAOrderSnapshot.detailStatus, 200, 'buyer A order detail BFF must return successfully');
            assert.equal(buyerAOrderDetailSnapshot?.order?.id, BUYER_ORDER_ID);
            assert.equal(buyerAOrderDetailSnapshot?.order?.order_number, BUYER_ORDER_NUMBER);
            runtimeProgress('buyer-a-order-list-api-contains-linked-order');
          }
          if (!buyerASessionSnapshot) {
            const buyerASessionResponse = await linkPage.evaluate(async () => {
              const response = await fetch('/api/buyer-auth/session', { cache: 'no-store' });
              return { status: response.status, body: await response.json().catch(() => null) };
            });
            assert.equal(buyerASessionResponse.status, 200, 'buyer A session BFF snapshot must be available before switching accounts');
            assert.equal(buyerASessionResponse.body?.buyer?.id, buyerId);
            buyerASessionSnapshot = buyerASessionResponse.body;
          }

          const buyerAProfileResponse = await linkPage.evaluate(async () => {
            const response = await fetch('/api/buyer/profile', { cache: 'no-store' });
            return { status: response.status, body: await response.json() };
          });
          assert.equal(buyerAProfileResponse.status, 200);
          assert.equal(buyerAProfileResponse.body?.buyer?.id, buyerId,
            'the stale profile snapshot is captured from buyer A before the cookie switch');
          const buyerAProfileSnapshot = buyerAProfileResponse.body;

          // Keep a real buyer-A support conversation mounted across the sibling
          // tab's Identity account switch. Hold a real BFF response for A so the
          // test can prove that its late completion cannot repopulate private UI.
          const supportPage = await linkContext.newPage();
          await supportPage.goto(`${storeOrigin}/store/${STORE_A_HOSTNAME}/account/support`, { waitUntil: 'domcontentloaded' });
          await supportPage.getByRole('heading', { name: 'Support', exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
          const supportTicketButton = supportPage.getByRole('button').filter({ hasText: SUPPORT_TEST_SUBJECT });
          await supportTicketButton.waitFor({ state: 'visible', timeout: 10_000 });
          await supportTicketButton.click();
          await supportPage.getByText(SUPPORT_TEST_BODY, { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
          await supportPage.getByText('Synthetic follow-up detail.', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
          await supportPage.getByLabel('Reply').fill('Private reply draft for buyer A.');
          // Let the real BFF request finish, then hold its Response before the
          // support component can parse it. Playwright route.fulfill cannot
          // reliably release a held request after the tab's identity refresh
          // changes the UI; delaying the actual fetch promise exercises the same
          // stale-response commit guard without replacing the Gateway response.
          await supportPage.evaluate(() => {
            const realFetch = window.fetch.bind(window);
            const state = { status: null, payload: null, released: false };
            let release;
            const released = new Promise(resolve => { release = resolve; });
            window.__letBuyySupportConversation = state;
            window.__releaseLetBuyySupportConversation = release;
            window.fetch = async (input, init) => {
              const requestUrl = new URL(typeof input === 'string' ? input : input.url, window.location.href);
              const requestMethod = (init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();
              const response = await realFetch(input, init);
              if (requestMethod === 'GET' && requestUrl.pathname.startsWith('/api/buyer/support/tickets/') && requestUrl.pathname.endsWith('/messages')) {
                state.status = response.status;
                state.payload = await response.clone().json().catch(() => null);
                await released;
                state.released = true;
              }
              return response;
            };
          });
          await supportTicketButton.click();
          await supportPage.waitForFunction(() => window.__letBuyySupportConversation?.status !== null, null, { timeout: 15_000 });
          const supportConversationSnapshot = await supportPage.evaluate(() => window.__letBuyySupportConversation);
          assert.equal(supportConversationSnapshot.status, 200, 'the held response comes from the real support BFF/Gateway path');
          assert.ok(supportConversationSnapshot.payload?.messages?.some(message => message.body === SUPPORT_TEST_BODY),
            'the delayed BFF response contains buyer A conversation data');

          const tabSwitchPage = await linkContext.newPage();
          runtimeProgress('cross-tab-switch-page-created');
          const returnToWishlist = `/store/${STORE_A_HOSTNAME}/account/wishlist`;
          await tabSwitchPage.goto(
            `${storeOrigin}/api/buyer-auth/start?return_to=${encodeURIComponent(returnToWishlist)}`,
            { waitUntil: 'domcontentloaded' },
          );
          runtimeProgress('cross-tab-switch-start-redirected');
          await tabSwitchPage.waitForURL(url => url.origin === identityOrigin && url.pathname === '/buyer/authorize', { waitUntil: 'domcontentloaded', timeout: 60_000 });
          await tabSwitchPage.waitForLoadState('networkidle');
          browserTrace.push({ step: 'cross-tab-identity-authorize-loaded', title: await tabSwitchPage.title().catch(() => ''), body: (await tabSwitchPage.locator('body').innerText().catch(() => '')).slice(0, 300) });
          const [switchLogout] = await Promise.all([
            tabSwitchPage.waitForResponse(response => new URL(response.url()).origin === identityOrigin
              && new URL(response.url()).pathname === '/api/buyer/logout' && response.request().method() === 'POST'),
            tabSwitchPage.getByRole('button', { name: 'Use a different account' }).click(),
          ]);
          assert.equal(switchLogout.status(), 200, 'normal Identity logout completes before replacing the buyer account');
          await switchLogout.finished();
          runtimeProgress('cross-tab-identity-account-switch-clicked');
          await tabSwitchPage.getByRole('heading', { name: 'Sign in', exact: true }).waitFor({ timeout: 10_000 });
          await tabSwitchPage.waitForLoadState('networkidle');
          runtimeProgress('cross-tab-sign-in-form-ready');
          await tabSwitchPage.locator('#buyerEmail').fill(TAB_SWITCH_EMAIL);
          await tabSwitchPage.locator('#buyerPassword').fill(TAB_SWITCH_PASSWORD);
          await tabSwitchPage.getByRole('button', { name: 'Sign in', exact: true }).click();
          await tabSwitchPage.getByRole('heading', { name: consentHeading }).waitFor({ timeout: 10_000 });
          await tabSwitchPage.waitForLoadState('networkidle');
          runtimeProgress('cross-tab-replacement-account-signed-in');
          await tabSwitchPage.getByRole('button', { name: consentHeading }).click();
          await tabSwitchPage.waitForURL(url => url.pathname === returnToWishlist, { waitUntil: 'domcontentloaded', timeout: 60_000 });
          runtimeProgress('cross-tab-replacement-account-returned-to-store');

          const switchedBuyerSession = await tabSwitchPage.evaluate(async () => {
            const response = await fetch('/api/buyer-auth/session', { cache: 'no-store' });
            return { status: response.status, body: await response.json() };
          });
          assert.equal(switchedBuyerSession.status, 200);
          assert.equal(switchedBuyerSession.body.buyer?.id, process.env.LETBUYY_SESSION_RUNTIME_TAB_SWITCH_BUYER_ID);
          assert.equal(switchedBuyerSession.body.buyer?.email, TAB_SWITCH_EMAIL);
          assert.equal(switchedBuyerSession.body.buyer?.emailVerified, true);
          runtimeProgress('cross-tab-replacement-session-verified');

          const supportRefresh = await holdBuyerSessionRefresh(supportPage);
          let supportSessionRefreshOutcome = 'not-released';
          try {
            // Wait for React to commit the privacy boundary before inspecting the
            // DOM. A focus/visibility refresh may already have completed in this
            // tab, so assert the private content itself is absent rather than
            // requiring one particular intermediate loading presentation.
            await supportPage.getByText(SUPPORT_TEST_SUBJECT, { exact: true }).waitFor({ state: 'hidden', timeout: 5_000 });
            assert.equal(await supportPage.getByText(SUPPORT_TEST_SUBJECT, { exact: true }).count(), 0,
              'buyer A ticket is hidden while the shared cookie is revalidated');
            assert.equal(await supportPage.getByText(SUPPORT_TEST_BODY, { exact: true }).count(), 0,
              'buyer A conversation text is hidden while the shared cookie is revalidated');
            assert.equal(await supportPage.getByLabel('Reply').count(), 0,
              'buyer A reply draft is removed while the shared cookie is revalidated');

            await supportPage.evaluate(() => window.__releaseLetBuyySupportConversation());
            await supportPage.waitForFunction(() => window.__letBuyySupportConversation?.released === true, null, { timeout: 5_000 });
            await new Promise(resolve => setTimeout(resolve, 50));
            assert.equal(await supportPage.getByText(SUPPORT_TEST_SUBJECT, { exact: true }).count(), 0,
              'the stale buyer-A ticket and conversation cannot return after the delayed response completes');
            assert.equal(await supportPage.getByText(SUPPORT_TEST_BODY, { exact: true }).count(), 0,
              'the late buyer-A message body is ignored after the buyer generation changes');
          } finally {
            await supportPage.evaluate(() => window.__releaseLetBuyySupportConversation?.()).catch(() => {});
            supportRefresh.release();
            let refreshOutcomeTimer;
            supportSessionRefreshOutcome = await Promise.race([
              supportRefresh.completion(),
              new Promise(resolve => { refreshOutcomeTimer = setTimeout(() => resolve('refresh-route-did-not-settle'), 5_000); }),
            ]).finally(() => clearTimeout(refreshOutcomeTimer));
            await supportRefresh.cleanup();
          }
          assert.ok(Array.isArray(supportSessionRefreshOutcome) && supportSessionRefreshOutcome.includes('fulfilled'),
            `at least one real session revalidation must complete: ${JSON.stringify(supportSessionRefreshOutcome)}`);
          await supportPage.getByText('You have no support requests yet.', { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
          assert.equal(await supportPage.getByText(SUPPORT_TEST_SUBJECT, { exact: true }).count(), 0,
            'buyer B receives an empty support list and cannot see buyer A ticket data');
          assert.equal(await supportPage.getByText('Private reply draft for buyer A.', { exact: true }).count(), 0,
            'buyer A reply draft does not survive verified buyer B session');
          browserTrace.push({ step: 'cross-tab-support-hides-buyer-a-ticket-messages-and-drafts-and-ignores-delayed-response', hiddenDuringRevalidation: true, buyerBListEmpty: true, staleResponseIgnored: true, sessionRefreshOutcome: supportSessionRefreshOutcome });
          runtimeProgress('cross-tab-support-data-revalidated');
          await supportPage.close();

          // Rehydrate a cached buyer-A session snapshot in a fresh page after the
          // shared cookie has switched to buyer B. This models the stale mounted
          // client generation without depending on a hidden tab surviving the
          // Identity navigation; the mutation itself still traverses the real BFF.
          const staleReviewDraftPage = await linkContext.newPage();
          // Mount/pageshow may both read the session. Bound the synthetic cache
          // to draft preparation, then restore real reads before the write.
          await staleReviewDraftPage.route('**/api/buyer-auth/session', route => route.fulfill({
            status: 200,
            contentType: 'application/json',
            headers: { 'cache-control': 'no-store' },
            body: JSON.stringify(buyerASessionSnapshot),
          }));
          await staleReviewDraftPage.goto(`${storeOrigin}/store/${STORE_A_HOSTNAME}/product/${PRICE_HISTORY_PRODUCT_ID}`, { waitUntil: 'domcontentloaded' });
          await staleReviewDraftPage.getByRole('heading', { name: PRICE_HISTORY_PRODUCT_NAME }).waitFor({ state: 'visible', timeout: 15_000 });
          await staleReviewDraftPage.getByRole('button', { name: 'Write a Review' }).click();
          await staleReviewDraftPage.getByText(`Signed in with LetBuyy as ${EMAIL}`, { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
          const staleReviewForm = staleReviewDraftPage.locator('form');
          await staleReviewForm.locator('input[placeholder="Review Title (optional)"]').fill('Private buyer A review draft');
          await staleReviewForm.locator('textarea[placeholder="Share your experience with this product..."]').fill('This draft belongs to buyer A.');
          await staleReviewForm.locator('button').nth(4).click();
          runtimeProgress('buyer-a-review-draft-loaded-from-cached-session');
          await staleReviewDraftPage.unroute('**/api/buyer-auth/session');
          const currentReviewBuyer = await staleReviewDraftPage.evaluate(async () => {
            const response = await fetch('/api/buyer-auth/session', { cache: 'no-store' });
            return { status: response.status, buyer: (await response.json().catch(() => null))?.buyer };
          });
          assert.equal(currentReviewBuyer.status, 200);
          assert.equal(currentReviewBuyer.buyer?.id, process.env.LETBUYY_SESSION_RUNTIME_TAB_SWITCH_BUYER_ID,
            'the review form displays cached buyer A state while its cookie authenticates buyer B');
          const staleReviewWritePromise = staleReviewDraftPage.waitForResponse(response => new URL(response.url()).pathname === '/api/reviews'
            && response.request().method() === 'POST', { timeout: 15_000 });
          await staleReviewDraftPage.evaluate(() => document.querySelector('form')?.requestSubmit());
          const staleReviewWrite = await staleReviewWritePromise;
          assert.equal(staleReviewWrite.status(), 409, 'the Commerce BFF refuses a buyer-A review draft under buyer B\'s shared cookie');
          assert.deepEqual(await staleReviewWrite.json(), { error: 'Your account changed. Reload before submitting this review.' });
          assert.equal(staleReviewWrite.request().headers()['x-letbuyy-expected-buyer-id'], buyerId,
            'the stale form sends only buyer A as the compare-only identity hint');
          await staleReviewDraftPage.getByRole('alert').getByText('Your account changed. Reload before submitting this review.', { exact: true })
            .waitFor({ state: 'visible', timeout: 5_000 });
          browserTrace.push({ step: 'cross-tab-review-write-refused-under-replacement-buyer-cookie', expectedBuyerId: buyerId, status: staleReviewWrite.status(), persisted: false });
          runtimeProgress('stale-review-write-rejected');
          await staleReviewDraftPage.close();

          // Rehydrate buyer A's cached session and wishlist response in a fresh
          // page after the shared cookie has switched to buyer B. Its delete still
          // traverses the real BFF, which must reject the stale buyer-A identity.
          if (STALE_WISHLIST_PRODUCT_ID && buyerAWishlistSnapshot && buyerASessionSnapshot) {
            staleWishlistPage = await linkContext.newPage();
            await staleWishlistPage.route('**/api/buyer-auth/session', route => route.fulfill({
              status: 200,
              contentType: 'application/json',
              headers: { 'cache-control': 'no-store' },
              body: JSON.stringify(buyerASessionSnapshot),
            }));
            await staleWishlistPage.route('**/api/buyer/wishlist', route => {
              if (route.request().method() !== 'GET') return route.fallback();
              return route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: { 'cache-control': 'no-store' },
                body: JSON.stringify(buyerAWishlistSnapshot),
              });
            }, { times: 1 });
            await staleWishlistPage.goto(`${storeOrigin}/store/${STORE_A_HOSTNAME}/product/${STALE_WISHLIST_PRODUCT_ID}`, { waitUntil: 'domcontentloaded' });
            await staleWishlistPage.getByRole('heading', { name: 'Synthetic Stale Wishlist Product' }).waitFor({ state: 'visible', timeout: 15_000 });
            await staleWishlistPage.getByRole('button', { name: 'Remove from wishlist' }).waitFor({ state: 'visible', timeout: 10_000 });
            await staleWishlistPage.unroute('**/api/buyer-auth/session');
            runtimeProgress('stale-wishlist-delete-waiter-registering');
            const staleWishlistDeletePromise = staleWishlistPage.waitForResponse(response => new URL(response.url()).pathname === '/api/buyer/wishlist'
              && response.request().method() === 'DELETE', { timeout: 15_000 });
            await staleWishlistPage.evaluate(() => {
              const button = document.querySelector('button[aria-label="Remove from wishlist"]');
              if (!(button instanceof HTMLButtonElement) || button.disabled) throw new Error('stale buyer-A wishlist button is not ready');
              button.click();
            });
            runtimeProgress('stale-wishlist-delete-click-dispatched');
            const staleWishlistDelete = await staleWishlistDeletePromise;
            runtimeProgress(`stale-wishlist-delete-response-${staleWishlistDelete.status()}`);
            assert.equal(staleWishlistDelete.status(), 409, 'the Commerce BFF refuses a stale wishlist action under buyer B\'s cookie');
            runtimeProgress('stale-wishlist-http-conflict-confirmed');
            assert.equal(staleWishlistDelete.request().headers()['x-letbuyy-expected-buyer-id'], buyerId,
              'the stale wishlist action sends only buyer A as the compare-only identity hint');
            runtimeProgress('stale-wishlist-compare-header-confirmed');
            await staleWishlistPage.getByRole('status').getByText('Could not save that wishlist change. Try again.', { exact: true })
              .waitFor({ state: 'visible', timeout: 5_000 });
            runtimeProgress('stale-wishlist-visible-error-confirmed');
            browserTrace.push({ step: 'cross-tab-wishlist-mutation-refused-under-replacement-buyer-cookie', expectedBuyerId: buyerId, status: staleWishlistDelete.status(), persisted: false });
            runtimeProgress('stale-wishlist-write-rejected');
            await staleWishlistPage.close();
          }

          if (BUYER_ORDER_ID && BUYER_ORDER_NUMBER && buyerAOrderSessionSnapshot && buyerAOrderListSnapshot && buyerAOrderDetailSnapshot) {
            staleOrderListPage = await linkContext.newPage();
            staleOrderDetailPage = await linkContext.newPage();
            const liveOrderReads = new Map([[staleOrderListPage, false], [staleOrderDetailPage, false]]);
            for (const page of [staleOrderListPage, staleOrderDetailPage]) {
              await page.route('**/api/buyer-auth/session', route => route.fulfill({
                status: 200,
                contentType: 'application/json',
                headers: { 'cache-control': 'no-store' },
                body: JSON.stringify(buyerAOrderSessionSnapshot),
              }));
              await page.route('**/api/buyer/orders**', route => {
                if (liveOrderReads.get(page)) return route.continue();
                const url = new URL(route.request().url());
                const payload = url.searchParams.has('order_id') ? buyerAOrderDetailSnapshot : buyerAOrderListSnapshot;
                return route.fulfill({
                  status: 200,
                  contentType: 'application/json',
                  headers: { 'cache-control': 'no-store' },
                  body: JSON.stringify(payload),
                });
              });
            }
            await staleOrderListPage.goto(`${storeOrigin}/store/${STORE_A_HOSTNAME}/account/orders`, { waitUntil: 'domcontentloaded' });
            await staleOrderListPage.getByText(BUYER_ORDER_NUMBER, { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
            await staleOrderDetailPage.goto(`${storeOrigin}/store/${STORE_A_HOSTNAME}/account/orders/${encodeURIComponent(BUYER_ORDER_ID)}`, { waitUntil: 'domcontentloaded' });
            await staleOrderDetailPage.getByText(BUYER_ORDER_NUMBER, { exact: true }).waitFor({ state: 'visible', timeout: 15_000 });
            await staleOrderDetailPage.getByText('Synthetic Seed Product', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
            runtimeProgress('buyer-a-order-list-and-detail-loaded-from-cached-real-bff-snapshots');

            const listRefresh = await holdBuyerSessionRefresh(staleOrderListPage);
            try {
              assert.equal(await staleOrderListPage.getByText(BUYER_ORDER_NUMBER, { exact: true }).isVisible(), false,
                'the prior buyer order is hidden while the shared cookie is revalidated');
              const listReadPromise = staleOrderListPage.waitForResponse(response => new URL(response.url()).pathname === '/api/buyer/orders'
                && response.request().method() === 'GET', { timeout: 15_000 });
              liveOrderReads.set(staleOrderListPage, true);
              listRefresh.release();
              const listResponse = await listReadPromise;
              assert.equal(listResponse.status(), 200);
              const listBody = await listResponse.json();
              assert.deepEqual(listBody.orders, [], 'the replacement buyer has no link to buyer A\'s order');
              await staleOrderListPage.getByText('No linked orders yet', { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
              runtimeProgress('buyer-b-empty-order-list-rendered');
            } finally {
              listRefresh.release();
              await listRefresh.cleanup();
            }

            const detailRefresh = await holdBuyerSessionRefresh(staleOrderDetailPage);
            try {
              assert.equal(await staleOrderDetailPage.getByText(BUYER_ORDER_NUMBER, { exact: true }).isVisible(), false,
                'the prior buyer order detail is hidden while the shared cookie is revalidated');
              assert.equal(await staleOrderDetailPage.getByText('Synthetic Seed Product', { exact: true }).isVisible(), false,
                'the prior buyer order items are hidden while the shared cookie is revalidated');
              const detailReadPromise = staleOrderDetailPage.waitForResponse(response => {
                const url = new URL(response.url());
                return url.pathname === '/api/buyer/orders'
                  && url.searchParams.get('order_id') === BUYER_ORDER_ID
                  && response.request().method() === 'GET';
              }, { timeout: 15_000 });
              liveOrderReads.set(staleOrderDetailPage, true);
              detailRefresh.release();
              const detailResponse = await detailReadPromise;
              assert.equal(detailResponse.status(), 404, 'the Gateway refuses buyer B access to buyer A\'s linked order');
              await staleOrderDetailPage.getByRole('heading', { name: 'Order unavailable' }).waitFor({ state: 'visible', timeout: 10_000 });
              assert.equal(await staleOrderDetailPage.getByText('Synthetic Seed Product', { exact: true }).count(), 0,
                'the replacement buyer never sees the former buyer\'s order items');
              runtimeProgress('buyer-b-unavailable-order-detail-rendered');
            } finally {
              detailRefresh.release();
              await detailRefresh.cleanup();
            }
            browserTrace.push({ step: 'cross-tab-order-list-and-detail-hidden-until-session-check-then-reloaded-as-buyer-b', buyerAOrderVisibleAfterSwitch: false, buyerBListEmpty: true, buyerBDetailStatus: 404 });
            runtimeProgress('cross-tab-order-list-and-detail-revalidated');
            await staleOrderListPage.close();
            await staleOrderDetailPage.close();
          }
          // Let any read started while the original tab was still becoming
          // idle complete before measuring requests caused by the return/focus.
          await linkPage.waitForLoadState('networkidle', { timeout: 10_000 });
          browserTrace.push({
            step: 'cross-tab-original-wishlist-tab-settled-before-held-revalidation',
            priorBuyerRowVisible: await linkPage.getByText(PRICE_HISTORY_PRODUCT_ID.slice(0, 12), { exact: true }).count() > 0,
          });
          runtimeProgress('cross-tab-original-wishlist-tab-idle-before-held-revalidation');
          let releaseSessionResponses;
          let signalSessionResponse;
          const sessionResponsesReleased = new Promise(resolve => { releaseSessionResponses = resolve; });
          const sessionResponseHeld = new Promise(resolve => { signalSessionResponse = resolve; });
          let holdSessionResponses = true;
          let heldSessionResponses = 0;
          let wishlistRequestsWhileSwitching = 0;
          linkPage.on('request', request => {
            const url = new URL(request.url());
            if (url.pathname === '/api/buyer/wishlist' && request.method() === 'GET') {
              wishlistRequestsWhileSwitching += 1;
              browserTrace.push({ step: 'cross-tab-wishlist-request-started-during-revalidation', count: wishlistRequestsWhileSwitching });
            }
          });
          await linkPage.route('**/api/buyer-auth/session', async route => {
            try {
              const response = await route.fetch();
              if (holdSessionResponses) {
                heldSessionResponses += 1;
                signalSessionResponse(response.status());
                await sessionResponsesReleased;
              }
              await route.fulfill({ response });
            } catch {
              await route.abort().catch(() => undefined);
            }
          });
          const staleWishlistId = PRICE_HISTORY_PRODUCT_ID.slice(0, 12);
          // These reads are intentionally left pending while the response is
          // held. Capture rejection immediately so an earlier assertion does
          // not turn teardown into an unhandled rejection that hides the real
          // failure from the owned browser run.
          const captureResponse = promise => promise.then(
            response => ({ response }),
            error => ({ error }),
          );
          const sessionReadback = captureResponse(linkPage.waitForResponse(response => new URL(response.url()).pathname === '/api/buyer-auth/session'
            && response.request().method() === 'GET', { timeout: 15_000 }));
          const wishlistReadback = captureResponse(linkPage.waitForResponse(response => new URL(response.url()).pathname === '/api/buyer/wishlist'
            && response.request().method() === 'GET', { timeout: 15_000 }));
          await linkPage.bringToFront();
          runtimeProgress('cross-tab-original-tab-front');
          // Headless Chromium does not consistently emit OS focus transitions when a second page
          // is brought forward. Deliver the browser lifecycle signal the provider listens for;
          // the account cookie was still changed by the real Identity login in the sibling page.
          await linkPage.evaluate(() => window.dispatchEvent(new Event('focus')));
          runtimeProgress('cross-tab-focus-dispatched');
          let heldWaitTimer;
          const heldStatus = await Promise.race([
            sessionResponseHeld,
            new Promise((_, reject) => {
              heldWaitTimer = setTimeout(() => reject(new Error(
                `buyer session revalidation did not reach the held BFF route; held=${heldSessionResponses}, wishlistRequests=${wishlistRequestsWhileSwitching}`,
              )), 10_000);
            }),
          ]).finally(() => clearTimeout(heldWaitTimer));
          runtimeProgress(`cross-tab-session-response-held-${heldStatus}`);
          assert.equal(heldStatus, 200, 'the original tab revalidates through the real buyer-session BFF');
          try {
            await linkPage.waitForFunction(() => document.body.innerText.includes('Checking your saved items…')
              || document.querySelector('.storefront-list-loading-state[aria-busy="true"]') !== null, null, { timeout: 5_000 });
          } catch (error) {
            const pageState = await linkPage.evaluate(() => ({
              path: location.pathname,
              visibility: document.visibilityState,
              mainText: document.querySelector('main')?.innerText.slice(0, 500) ?? null,
              mainHtml: document.querySelector('main')?.innerHTML.slice(0, 800) ?? null,
            })).catch(() => null);
            throw new Error(`the active storefront wishlist must render its revalidation state while the buyer session response is held; page=${JSON.stringify(pageState)}; held=${heldSessionResponses}; wishlistRequests=${wishlistRequestsWhileSwitching}; ${String(error)}`);
          }
          runtimeProgress('cross-tab-wishlist-revalidation-state-rendered');
          const priorWishlistMatches = await linkPage.getByText(staleWishlistId, { exact: true }).evaluateAll(nodes => nodes.map(node => ({
            html: node.outerHTML.slice(0, 350),
            visible: node.getClientRects().length > 0 && getComputedStyle(node).visibility !== 'hidden',
            display: getComputedStyle(node).display,
          })));
          assert.equal(priorWishlistMatches.length, 0,
            `the former buyer wishlist is removed from the rendered DOM while the replacement session is pending; matches=${JSON.stringify(priorWishlistMatches)}`);
          await new Promise(resolve => setTimeout(resolve, 200));
          assert.equal(wishlistRequestsWhileSwitching, 0,
            'the original tab must not start a buyer-wishlist read before session revalidation completes');

          holdSessionResponses = false;
          releaseSessionResponses();
          const [sessionRead, wishlistRead] = await Promise.all([sessionReadback, wishlistReadback]);
          runtimeProgress('cross-tab-readbacks-settled');
          assert.ok(sessionRead.response, `buyer-session response must settle: ${sessionRead.error?.message ?? 'no response'}`);
          assert.ok(wishlistRead.response, `wishlist response must settle: ${wishlistRead.error?.message ?? 'no response'}`);
          const sessionResponse = sessionRead.response;
          const wishlistResponse = wishlistRead.response;
          assert.equal(sessionResponse.status(), 200);
          assert.equal((await sessionResponse.json()).buyer?.email, TAB_SWITCH_EMAIL);
          assert.equal(wishlistResponse.status(), 200);
          const switchedWishlist = await wishlistResponse.json();
          assert.equal(switchedWishlist.linked, false, 'the replacement buyer has no store-customer link');
          assert.deepEqual(switchedWishlist.productIds, [], 'an unlinked buyer receives no prior buyer wishlist rows');
          await linkPage.getByText('Link your verified store customer account in settings to use this store\'s saved wishlist.', { exact: true }).waitFor({ timeout: 15_000 });
          assert.equal(await linkPage.getByText(staleWishlistId, { exact: true }).count(), 0,
            'the prior buyer product remains absent after the new unlinked identity is loaded');
          browserTrace.push({
            step: 'cross-tab-buyer-switch-hides-prior-wishlist-before-session-readback',
            heldSessionResponses,
            replacementAccountLinked: switchedWishlist.linked,
            priorWishlistVisibleAfterSwitch: false,
          });
          runtimeProgress('cross-tab-session-readback-completed');
          // Model a stale client snapshot after the sibling tab switched the
          // real shared cookie to buyer B. The profile call reaches the actual
          // BFF and confirms B, then this browser adapter returns A's previously
          // loaded profile. The write still reaches the real BFF under cookie B.
          async function installStaleProfileSnapshot(page) {
            const observed = { reads: 0, error: undefined };
            await page.route('**/api/buyer/profile', async route => {
              if (route.request().method() !== 'GET') return route.continue();
              try {
                const response = await route.fetch({ timeout: 15_000 });
                const canonicalBody = await response.json();
                assert.equal(canonicalBody.buyer?.id, TAB_SWITCH_BUYER_ID,
                  "the real BFF confirms buyer B before supplying A's previously captured client snapshot");
                observed.reads++;
                await route.fulfill({
                  status: response.status(),
                  headers: { ...response.headers(), 'content-type': 'application/json' },
                  body: JSON.stringify(buyerAProfileSnapshot),
                });
              } catch (error) {
                observed.error = String(error);
                if (!page.isClosed()) await route.abort().catch(() => {});
              }
            });
            return observed;
          }
          const staleProfileRead = await installStaleProfileSnapshot(tabSwitchPage);
          await tabSwitchPage.goto(`${storeOrigin}/store/${STORE_A_HOSTNAME}/account/settings`, { waitUntil: 'domcontentloaded' });
          try {
            await tabSwitchPage.getByRole('heading', { name: 'LetBuyy Account' }).waitFor({ state: 'visible', timeout: 20_000 });
          } catch (error) {
            throw new Error(`stale profile form must load from the confirmed buyer-B BFF read; route=${staleProfileRead.error ?? 'pending'}; page=${(await tabSwitchPage.locator('main').innerText()).slice(0, 800)}; ${String(error)}`);
          }
          assert.ok(staleProfileRead.reads > 0);
          assert.equal(staleProfileRead.error, undefined, 'every intercepted profile read must confirm buyer B');
          await tabSwitchPage.locator('#buyer-full-name').fill('Buyer A stale profile draft');
          const staleProfileWritePromise = tabSwitchPage.waitForResponse(response => new URL(response.url()).pathname === '/api/buyer/profile'
            && response.request().method() === 'PATCH', { timeout: 15_000 });
          await tabSwitchPage.getByRole('button', { name: 'Save profile' }).click();
          const staleProfileWrite = await staleProfileWritePromise;
          assert.equal(staleProfileWrite.status(), 409, 'the BFF rejects buyer A profile content under buyer B\'s shared cookie');
          assert.deepEqual(await staleProfileWrite.json(), { error: 'Your account changed. Reload before saving.' });
          await tabSwitchPage.getByRole('alert').getByText('Your account changed. Reload before saving.', { exact: true })
            .waitFor({ state: 'visible', timeout: 5_000 });
          browserTrace.push({ step: 'cross-tab-profile-write-refused-before-revalidation', expectedBuyerId: buyerId, status: staleProfileWrite.status(), persisted: false });
          runtimeProgress('stale-profile-write-rejected');
          await tabSwitchPage.unroute('**/api/buyer/profile');
          // Rehydrate A's actual cached session in a separate mounted page, as
          // for the review and wishlist controls. A newly loaded B form is valid
          // for B and would not represent a stale account mutation.
          const staleAddressPage = await linkContext.newPage();
          await staleAddressPage.route('**/api/buyer-auth/session', route => route.fulfill({
            status: 200, contentType: 'application/json',
            headers: { 'cache-control': 'no-store' },
            body: JSON.stringify(buyerASessionSnapshot),
          }));
          const staleAddressProfileRead = await installStaleProfileSnapshot(staleAddressPage);
          await staleAddressPage.goto(`${storeOrigin}/store/${STORE_A_HOSTNAME}/account/addresses`, { waitUntil: 'domcontentloaded' });
          await staleAddressPage.getByRole('button', { name: 'Add Address' }).click();
          try {
            await staleAddressPage.getByPlaceholder('Full Name *').waitFor({ state: 'visible', timeout: 5_000 });
          } catch (error) {
            const pageState = await staleAddressPage.evaluate(() => ({
              path: location.pathname,
              mainText: document.querySelector('main')?.innerText.slice(0, 500) ?? null,
              mainHtml: document.querySelector('main')?.innerHTML.slice(0, 1200) ?? null,
            })).catch(() => null);
            throw new Error(`stale address form should open after Add Address; page=${JSON.stringify(pageState)}; ${String(error)}`);
          }
          assert.ok(staleAddressProfileRead.reads > 0, "the address form loads A's captured profile after a real B read");
          assert.equal(staleAddressProfileRead.error, undefined);
          await staleAddressPage.getByPlaceholder('Full Name *').fill('Buyer A stale address draft');
          await staleAddressPage.getByPlaceholder('Address Line 1 *').fill(TAB_SWITCH_ADDRESS_LINE1);
          await staleAddressPage.getByPlaceholder('City *').fill('Pune');
          await staleAddressPage.getByPlaceholder('State *').fill('Maharashtra');
          await staleAddressPage.getByPlaceholder('PIN Code *').fill('411001');
          const staleAddressWritePromise = staleAddressPage.waitForResponse(response => new URL(response.url()).pathname === '/api/buyer/addresses'
            && response.request().method() === 'POST', { timeout: 15_000 });
          assert.equal(await staleAddressPage.locator('form').count(), 1, 'the browser retains the buyer-A form snapshot after its shared cookie belongs to buyer B');
          await staleAddressPage.evaluate(() => {
            document.querySelector('form')?.requestSubmit();
          });
          const staleAddressWrite = await staleAddressWritePromise;
          assert.equal(staleAddressWrite.status(), 409, 'the BFF rejects buyer A address content under buyer B\'s shared cookie');
          assert.equal(staleAddressWrite.request().headers()['x-letbuyy-expected-buyer-id'], buyerId,
            'the browser sends only its loaded buyer as the stale-form comparison value');
          assert.deepEqual(await staleAddressWrite.json(), { error: 'Your account changed. Reload before saving.' });
          try {
            await staleAddressPage.getByRole('alert').getByText('Your account changed. Reload before saving.', { exact: true })
              .waitFor({ state: 'visible', timeout: 5_000 });
          } catch (error) {
            const pageState = await staleAddressPage.evaluate(() => ({
              path: location.pathname,
              alerts: Array.from(document.querySelectorAll('[role="alert"]')).map(node => ({
                text: node.textContent,
                display: getComputedStyle(node).display,
                visibility: getComputedStyle(node).visibility,
              })),
              formOpen: Boolean(document.querySelector('form')),
              busy: Boolean(document.querySelector('[aria-busy="true"]')),
            }));
            throw new Error(`stale address refusal must remain visible; page=${JSON.stringify(pageState)}; ${String(error)}`);
          }
          browserTrace.push({ step: 'cross-tab-address-write-refused-before-revalidation', expectedBuyerId: buyerId, status: staleAddressWrite.status(), persisted: false });
          runtimeProgress('stale-address-write-rejected');
          await staleAddressPage.close();
          await tabSwitchPage.close();
        }
      }
      await linkPage.setExtraHTTPHeaders({ 'x-forwarded-host': appHostB });
      await linkPage.goto(`http://${appHostB}/api/buyer-auth/session`, { waitUntil: 'domcontentloaded' });
      assert.equal(await linkPage.locator('body').innerText(), '{"buyer":null}', 'account-linked buyer session remains denied on a sibling storefront');
      browserTrace.push({ step: 'account-settings-link-completed', status: 'linked', legacySessionRetired: true, siblingStoreDenied: true });
      await linkContext.close();

      if (RESET_TOKEN) {
        const resetProgress = (step) => process.stdout.write(`RESET_FLOW:${step}\n`);
        const resetContext = await browser.newContext();
        await resetContext.setExtraHTTPHeaders({ 'x-forwarded-host': browserStoreHost });
        const resetPage = await resetContext.newPage();
        resetPage.on('pageerror', error => browserTrace.push({ step: 'reset-browser-page-error', message: error.message.slice(0, 250) }));
        resetPage.on('console', message => {
          if (message.type() === 'error') browserTrace.push({ step: 'reset-browser-console-error', message: message.text().slice(0, 250) });
        });
        await resetPage.goto(`${storeOrigin}/store/${STORE_A_HOSTNAME}/customers/reset-password?store_id=${encodeURIComponent(STORE_A)}&email=${encodeURIComponent(EMAIL)}&token=${encodeURIComponent(RESET_TOKEN)}`, { waitUntil: 'domcontentloaded' });
        await resetPage.getByRole('heading', { name: `Reset your ${STORE_A_NAME} password` }).waitFor({ state: 'visible', timeout: 15_000 });
        resetProgress('page-loaded');
        await resetPage.waitForFunction(() => window.location.search === '');
        assert.equal(new URL(resetPage.url()).search, '', 'one-time bearer reset token is removed from the browser address bar');
        resetProgress('token-scrubbed');
        await resetPage.getByLabel('New password', { exact: true }).fill('Synthetic-Reset-Password-78');
        await resetPage.getByLabel('Confirm new password', { exact: true }).fill('Synthetic-Reset-Password-78');
        const resetSubmissionResponse = resetPage.waitForResponse(response => new URL(response.url()).pathname === '/api/customer/set-password', { timeout: 15_000 });
        await resetPage.getByRole('button', { name: 'Update password' }).click();
        resetProgress('submit-clicked');
        const resetSubmission = await resetSubmissionResponse;
        resetProgress(`bff-response-${resetSubmission.status()}`);
        assert.equal(resetSubmission.status(), 200, 'password-reset BFF should complete the database redemption and issue the legacy session');
        try {
          await resetPage.waitForFunction(() => document.body.innerText.includes('Your password has been updated.'), null, { timeout: 15_000 });
        } catch (error) {
          const visibleBody = (await resetPage.locator('body').innerText().catch(() => '')).slice(0, 500);
          throw new Error(`successful password reset response did not update the form; body=${JSON.stringify(visibleBody)}; path=${new URL(resetPage.url()).pathname}; ${String(error)}`);
        }
        resetProgress('success-rendered');

        const resetCookies = await resetContext.cookies(storeOrigin);
        assert.ok(resetCookies.some(cookie => cookie.name === 'lb_customer_session'), 'successful password reset creates the expected store-customer session');
        await resetPage.goto(`${storeOrigin}/api/customer/session`, { waitUntil: 'domcontentloaded' });
        const resetSession = JSON.parse(await resetPage.locator('body').innerText());
        resetProgress('session-read');
        assert.equal(resetSession.authenticated, true);
        assert.equal(resetSession.customer.id, CUSTOMER);
        assert.equal(resetSession.customer.storeId, STORE_A);
        await resetPage.goto(`${storeOrigin}/api/customer/profile`, { waitUntil: 'domcontentloaded' });
        const resetProfile = JSON.parse(await resetPage.locator('body').innerText());
        resetProgress('profile-read');
        assert.equal(resetProfile.customer.email, EMAIL);

        const replay = await resetPage.evaluate(async ({ email, password, storeId, resetToken }) => {
          const response = await fetch('/api/customer/set-password', {
            method: 'POST',
            headers: { 'content-type': 'application/json', accept: 'application/json' },
            body: JSON.stringify({ email, password, storeId, resetToken }),
          });
          return { status: response.status, body: await response.json() };
        }, { email: EMAIL, password: 'Synthetic-Replay-Password-79', storeId: STORE_A, resetToken: RESET_TOKEN });
        assert.equal(replay.status, 400, 'consumed reset token cannot be redeemed twice');
        assert.equal(replay.body.error, 'Reset link is invalid or expired.');
        browserTrace.push({ step: 'password-reset-browser-completed', tokenScrubbed: true, cookieIssued: true, sessionAndProfileRead: true, replayDenied: true });

        const crossSiteAddressWrite = await resetPage.request.post(`${storeOrigin}/api/customer/addresses`, {
          headers: { origin: 'https://attacker.invalid', 'sec-fetch-site': 'cross-site' },
          data: { full_name: ADDRESS_TEST_NAME, address_line1: ADDRESS_TEST_LINE1, city: 'Pune', state: 'Maharashtra', postal_code: '411001' },
        });
        assert.equal(crossSiteAddressWrite.status(), 403, 'a sibling or external site cannot use the address BFF as a CSRF relay');
        assert.equal((await crossSiteAddressWrite.json()).error, 'A same-origin request is required.');
        const crossSiteAddressUpdate = await resetPage.request.fetch(`${storeOrigin}/api/customer/addresses`, {
          method: 'PUT', headers: { origin: 'https://attacker.invalid', 'sec-fetch-site': 'cross-site' },
          data: { id: crypto.randomUUID(), full_name: ADDRESS_TEST_NAME },
        });
        assert.equal(crossSiteAddressUpdate.status(), 403, 'cross-site callers cannot update a saved address');
        const crossSiteAddressDelete = await resetPage.request.fetch(`${storeOrigin}/api/customer/addresses`, {
          method: 'DELETE', headers: { origin: 'https://attacker.invalid', 'sec-fetch-site': 'cross-site' },
          data: { id: crypto.randomUUID() },
        });
        assert.equal(crossSiteAddressDelete.status(), 403, 'cross-site callers cannot delete a saved address');

        const legacyAddressesRead = resetPage.waitForResponse(response =>
          new URL(response.url()).pathname === '/api/customer/addresses' && response.request().method() === 'GET');
        await resetPage.goto(`${storeOrigin}/store/${STORE_A_HOSTNAME}/account/addresses`, { waitUntil: 'domcontentloaded' });
        assert.equal((await legacyAddressesRead).status(), 200);
        await resetPage.waitForLoadState('networkidle');
        await resetPage.getByRole('button', { name: 'Add Address' }).click();
        await resetPage.getByPlaceholder('Full Name *').fill(ADDRESS_TEST_NAME);
        await resetPage.getByPlaceholder('Address Line 1 *').fill(ADDRESS_TEST_LINE1);
        await resetPage.getByPlaceholder('City *').fill('Pune');
        await resetPage.getByPlaceholder('State *').fill('Maharashtra');
        await resetPage.getByPlaceholder('PIN Code *').fill('411001');
        await resetPage.getByRole('checkbox', { name: 'Set as default address' }).check();
        const formValidity = await resetPage.locator('form').evaluate(form => Array.from(form.elements)
          .filter(field => 'validity' in field && !field.validity.valid)
          .map(field => ({ placeholder: field.getAttribute('placeholder'), reason: field.validationMessage })));
        assert.deepEqual(formValidity, [], 'the completed legacy address form must satisfy native validation');
        const [legacyAddressCreated] = await Promise.all([
          resetPage.waitForResponse(response => new URL(response.url()).pathname === '/api/customer/addresses'
            && response.request().method() === 'POST'),
          resetPage.getByRole('button', { name: 'Save Address' }).click(),
        ]);
        assert.equal(legacyAddressCreated.status(), 201, 'the normal address form must persist through its real BFF');
        await resetPage.getByText(ADDRESS_TEST_LINE1, { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
        assert.equal(await resetPage.getByText(ADDRESS_TEST_NAME, { exact: true }).count(), 1,
          'the saved legacy customer address appears once in the real account page');
        await resetPage.getByRole('button', { name: 'Edit' }).click();
        await resetPage.getByPlaceholder('Address Line 1 *').fill(ADDRESS_TEST_UPDATED_LINE1);
        const [legacyAddressUpdated] = await Promise.all([
          resetPage.waitForResponse(response => new URL(response.url()).pathname === '/api/customer/addresses'
            && response.request().method() === 'PUT'),
          resetPage.getByRole('button', { name: 'Update Address' }).click(),
        ]);
        assert.equal(legacyAddressUpdated.status(), 200);
        await resetPage.getByText(ADDRESS_TEST_UPDATED_LINE1, { exact: true }).waitFor({ state: 'visible', timeout: 10_000 });
        browserTrace.push({ step: 'legacy-customer-address-form-created-and-edited-default-through-bff-gateway-owned-postgres' });
        await resetContext.close();
      }

      if (gatewayPriceProduct) {
        const storefrontPage = await browser.newPage();
        await storefrontPage.goto(`${storeOrigin}/store/${STORE_A_HOSTNAME}/products`, { waitUntil: 'domcontentloaded' });
        const priceCard = storefrontPage.locator('.storefront-product-card').filter({ hasText: PRICE_HISTORY_PRODUCT_NAME });
        const originControlCard = storefrontPage.locator('.storefront-product-card').filter({ hasText: 'Synthetic Origin Control Product' });
        await priceCard.waitFor({ state: 'visible', timeout: 15_000 });
        const originFilter = storefrontPage.getByRole('textbox', { name: 'Country of origin' });
        await originFilter.fill('Japan');
        await storefrontPage.getByRole('button', { name: 'Apply filter' }).click();
        await storefrontPage.waitForURL(url => url.searchParams.get('country_of_origin') === 'Japan');
        await priceCard.waitFor({ state: 'visible', timeout: 15_000 });
        assert.equal(await originControlCard.count(), 0, 'the India control product must not leak into Japan results');
        await storefrontPage.getByRole('link', { name: 'Clear origin filter' }).click();
        await storefrontPage.waitForURL(url => !url.searchParams.has('country_of_origin'));
        await originControlCard.waitFor({ state: 'visible', timeout: 15_000 });
        await originFilter.fill('Japan');
        await storefrontPage.getByRole('button', { name: 'Apply filter' }).click();
        await storefrontPage.waitForURL(url => url.searchParams.get('country_of_origin') === 'Japan');
        assert.equal(await originControlCard.count(), 0, 'a subsequent filter navigation keeps the Gateway result constrained');
        await storefrontPage.getByRole('link', { name: 'Clear origin filter' }).click();
        await storefrontPage.waitForURL(url => !url.searchParams.has('country_of_origin'));
        await priceCard.waitFor({ state: 'visible', timeout: 15_000 });
        const cardText = await priceCard.innerText();
        assert.match(cardText, /₹120/);
        assert.match(cardText, /Lowest in last 30 days/);
        assert.match(cardText, /₹150/);
        await priceCard.locator('xpath=ancestor::a[1]').click();
        await storefrontPage.waitForURL(new RegExp(`/store/${STORE_A_HOSTNAME}/product/${PRICE_HISTORY_PRODUCT_ID}$`), { timeout: 15_000 });
        await storefrontPage.getByRole('heading', { name: PRICE_HISTORY_PRODUCT_NAME }).waitFor({ state: 'visible' });
        await storefrontPage.getByText('Lowest price in the last 30 days', { exact: true }).waitFor({ state: 'visible' });
        let detailText = await storefrontPage.locator('body').innerText();
        assert.match(detailText, /₹110/);
        assert.match(detailText, /₹150/);
        const largeOption = storefrontPage.getByRole('button', { name: 'Large' });
        await largeOption.waitFor({ state: 'visible', timeout: 10_000 });
        await largeOption.click();
        detailText = await storefrontPage.locator('body').innerText();
        assert.match(detailText, /₹160/);
        assert.match(detailText, /₹200/);
        assert.match(detailText, /Lowest price in the last 30 days/);
        await storefrontPage.getByRole('heading', { name: 'Origin and importer information', exact: true }).waitFor({ state: 'visible' });
        await storefrontPage.getByText('Importer details', { exact: true }).waitFor({ state: 'visible' });
        detailText = await storefrontPage.locator('body').innerText();
        assert.match(detailText, /Example Imports Pvt Ltd, Mumbai, Maharashtra/,
          'the storefront product detail renders the seller-entered importer disclosure returned by Gateway');
        browserTrace.push({ step: 'gateway-origin-filter-and-price-history-rendered', originFilter: { selected: 'Japan', excluded: 'India', cleared: true }, list: { current: 120, priorLow: 150 }, small: { current: 110, priorLow: 150 }, large: { current: 160, priorLow: 200 } });
        browserTrace.push({ step: 'importer-disclosure-rendered', source: 'owned Gateway product detail', value: 'Example Imports Pvt Ltd, Mumbai, Maharashtra' });
        await storefrontPage.close();
      }
    } finally {
      await browser.close();
    }
  }

  await verifyProgrammaticStoreLink();
  process.stdout.write('RUNTIME_STEP:assertions-complete\n');

  const checks = ['unauthenticated read', 'cross-origin login denial', 'wrong-store login denial', 'real Next BFF login and HttpOnly cookie', 'Next session read', 'profile BFF forwards session', 'cross-store session denial', 'bad-password no-cookie denial'];
  if (buyerSessionToken) checks.push(externalGatewayUrl
    ? 'real Identity authorize + code/PKCE redemption + ES256 session issuance + owned Gateway store link + canonical buyer session read + sibling-store/replay denial'
    : 'real Identity authorize + code/PKCE redemption + ES256 session issuance + controlled Gateway link contract + canonical buyer session read + sibling-store/replay denial');
  if (process.env.LETBUYY_SESSION_RUNTIME_BROWSER === '1') checks.push(process.env.LETBUYY_SESSION_RUNTIME_BUYER_CREDENTIAL_BROWSER === '1'
    ? 'Chromium Identity email/password login, consent, PKCE callback, host-only buyer cookie and sibling-store refusal; realm-explicit legacy/buyer logout isolation; legacy Account Settings link, verified-email callback, legacy-cookie retirement and sibling-store denial; wrong-password denial verified through the real login endpoint'
    : 'headless Chromium storefront-to-Identity sign-in consent, PKCE callback, host-only buyer cookie and sibling-store refusal');
  if (process.env.LETBUYY_SESSION_RUNTIME_BROWSER === '1' && RESET_TOKEN) checks.push(
    'Chromium password-reset redemption scrubs the one-time token, issues a store-customer session, reads the real Gateway profile and rejects replay',
    'Chromium same-origin legacy customer address form rejects cross-site writes and creates/edits a default address through the real Gateway',
  );
  if (gatewayPriceProduct) checks.push(
    'Chromium storefront country-origin filter and clear use the actual Gateway response',
    'Chromium signed-buyer support form records a complaint, displays its persisted copy and reference, loads the public conversation and sends a reply',
    'storefront list, product detail and selected-variant prices match the actual owned Gateway payload',
    'Importer disclosure renders on the real storefront product detail from the owned Gateway response',
    'Chromium product-detail wishlist mutation appears in the account wishlist through the actual owned Gateway and Postgres',
  );
  if (gatewayPriceProduct && TAB_SWITCH_EMAIL && TAB_SWITCH_PASSWORD) checks.push(
    'Chromium cross-tab canonical buyer account switch hides the prior wishlist during session revalidation and denies unlinked wishlist rows',
    'Chromium cross-tab buyer review write refuses a stale buyer-A draft under buyer-B cookie before revalidation; owned Postgres confirms no review is persisted',
    'Chromium cross-tab buyer profile write rejects a stale buyer-A draft under buyer-B cookie before revalidation; owned Postgres confirms neither buyer profile changes',
    'Chromium cross-tab buyer address write rejects a stale buyer-A draft under buyer-B cookie before revalidation; owned Postgres confirms no address row is written',
  );
  if (gatewayPriceProduct && TAB_SWITCH_EMAIL && TAB_SWITCH_PASSWORD && STALE_WISHLIST_PRODUCT_ID) checks.push(
    'Chromium cross-tab buyer wishlist mutation refuses a stale buyer-A action under buyer-B cookie before revalidation; owned Postgres confirms the buyer-A row remains unchanged',
  );
  if (gatewayPriceProduct && TAB_SWITCH_EMAIL && TAB_SWITCH_PASSWORD && BUYER_ORDER_ID && BUYER_ORDER_NUMBER) checks.push(
    'Chromium buyer-switch order list and detail hide buyer-A order data while revalidating and reload as buyer B',
  );
  if (gatewayPriceProduct && TAB_SWITCH_EMAIL && TAB_SWITCH_PASSWORD) checks.push(
    'Chromium buyer-switch support hides buyer-A tickets, messages and drafts during revalidation and ignores a delayed private response',
  );
  if (!externalGatewayUrl) checks.push('store-resolver outage fails closed');
  console.log(JSON.stringify({
    result: 'passed',
    checks,
    ...(externalGatewayUrl ? {} : { gatewayLoginCalls: loginCalls, gatewayProfileCalls: profileCalls }),
    nextRuntime: 'local Next.js dev server',
    ...(identityOrigin ? { identityRuntime: process.env.LETBUYY_SESSION_RUNTIME_BUYER_CREDENTIAL_BROWSER === '1'
      ? 'local Identity Next.js dev server; credential login, Gateway verification, OAuth/PKCE signing and browser consent are real and use a synthetic owned-database buyer'
      : 'local Identity Next.js dev server; OAuth endpoints, PKCE code redemption and signing route are real; initial buyer authentication is a test-seeded session' } : {}),
    ...(mockIdentityMode ? { gatewayOAuthLinkCalls: linkCalls } : {}),
    gateway: externalGatewayUrl
      ? 'actual owned Gateway worker reached through the local test adapter'
      : mockIdentityMode
        ? 'controlled local HTTP double for authorization-code storage, redemption and store linking; it does not prove Gateway database behavior'
        : 'controlled local HTTP double using shared Gateway auth-core session verification',
  }, null, 2));
} catch (error) {
  // Keep the concrete failure and the latest browser stages at the end of
  // stderr. The owned DB test retains a bounded output tail; printing them
  // before server logs caused the useful assertion or timeout to be dropped.
  console.error(appOutput);
  if (identityOutput) console.error(identityOutput);
  console.error(String(error));
  if (browserTrace.length) console.error(JSON.stringify({
    ...(mockIdentityMode ? { oauthTrace: oauthTrace.slice(-20) } : {}),
    browserTrace: browserTrace.slice(-35),
  }, null, 2));
  process.exitCode = 1;
} finally {
  const ownedRuntime = process.env.LETBUYY_OWNED_CLIENT_RUNTIME === '1';
  const signalChild = (child, signal) => {
    if (ownedRuntime) { if (child.exitCode === null && child.signalCode === null) child.kill(signal); }
    else { try { process.kill(-child.pid, signal); } catch { child.kill(signal); } }
  };
  signalChild(app, 'SIGTERM');
  if (identityApp) {
    signalChild(identityApp, 'SIGTERM');
  }
  const testChildren = [app, ...(identityApp ? [identityApp] : [])];
  const waitForExit = (child, timeoutMs) => new Promise(resolve => {
    if (closedChildren.has(child)) return resolve(true);
    const timer = setTimeout(() => {
      child.off('close', onExit);
      resolve(false);
    }, timeoutMs);
    const onExit = () => {
      clearTimeout(timer);
      resolve(true);
    };
    child.once('close', onExit);
  });
  const groupIsAlive = pid => {
    // These children inherit the verified supervisor's group in owned mode;
    // their PIDs are not process-group ownership proofs.
    if (ownedRuntime) return false;
    try { process.kill(-pid, 0); return true; }
    catch (error) { return error.code === 'EPERM'; }
  };
  const waitForGroupStop = async (child, timeoutMs) => {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (!groupIsAlive(child.pid)) return true;
      await delay(100);
    }
    return !groupIsAlive(child.pid);
  };
  const stopped = await Promise.all(testChildren.map(async child => {
    let exited = await waitForExit(child, 5000);
    if (!exited || groupIsAlive(child.pid)) {
      signalChild(child, 'SIGKILL');
      exited = exited || await waitForExit(child, 5000);
    }
    const groupStopped = await waitForGroupStop(child, 5000);
    return exited && groupStopped;
  }));
  if (stopped.every(Boolean)) {
    if (createdIdentityTailwindLink && identityTailwindLinkPath) {
      await rm(identityTailwindLinkPath, { force: true });
    }
    if (createdIdentityNodeModules && identityNodeModulesPath) {
      await rmdir(identityNodeModulesPath);
    }
    await Promise.all([
      rm(new URL(`../${runtimeDistDir}`, import.meta.url), { recursive: true, force: true }),
      ...(identityApp ? [rm(new URL(`../../../platform/identity/${runtimeDistDir}`, import.meta.url), { recursive: true, force: true })] : []),
    ]);
  } else {
    console.error(`Retained ${runtimeDistDir} because a test-owned Next process did not exit cleanly`);
  }
  if (gateway.listening) await new Promise(resolve => gateway.close(resolve));
}
