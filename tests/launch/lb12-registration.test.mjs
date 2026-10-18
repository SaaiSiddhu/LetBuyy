// LB-12 acceptance follows the canonical buyer registration owner (D-ONE-BUYER,
// ART-05). Retired store-local credential creation must not be restored to make
// historical source pins green. Runtime and owned/browser proof remain separate.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyAppApiRoute, listAppApiRoutes } from '../../scripts/validators/app-api-route-inventory.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const read = p => readFileSync(resolve(ROOT,p),'utf8');
const gateway = read('services/api-gateway/src/routes/storefront/customer-registration.ts');
const buyer = read('services/api-gateway/src/routes/storefront/buyer-account-routes.ts');
const identity = read('apps/platform/identity/src/app/api/buyer/register/route.ts');
const issuer = read('apps/platform/identity/src/lib/auth/identity-issued-session.ts');
const proxy = read('apps/commerce/web/src/app/api/customer/register/route.ts');
const sheet = read('apps/commerce/web/src/components/account/account-bottom-sheet.tsx');
const authContext = read('apps/commerce/web/src/context/customer-auth-context.tsx');
const credentials = read('apps/platform/identity/src/app/buyer/authorize/authorize-client.tsx');
const register = buyer.slice(buyer.indexOf("router.post('/buyer/register'"),buyer.indexOf("router.post('/buyer/verify-credentials'"));

test('LB-12: legacy Gateway registration refuses credential creation with canonical-account guidance', () => {
  assert.match(gateway,/router\.post\('\/customer\/register'/);
  assert.match(gateway,/CANONICAL_BUYER_ACCOUNT_REQUIRED/);
  assert.match(gateway,/, 410\)/);
  assert.doesNotMatch(gateway,/bcrypt|insertBuyer|issueCustomerSession|CUSTOMER_SESSION_SECRET/);
});

test('LB-12: canonical registration retains rate, CSRF, human proof and existing-account takeover denials', () => {
  const order=['checkRateLimit(\'buyer-register\'', 'validateCsrf(request)', 'verifyTurnstileToken(', "identityApiRequest('/storefront/buyer/register'"];
  for(let i=0;i<order.length;i++) {
    assert.ok(identity.indexOf(order[i])>=0,order[i]);
    if(i)assert.ok(identity.indexOf(order[i-1])<identity.indexOf(order[i]),'guards precede the canonical account mutation');
  }
  assert.match(register,/requireIdentityInternal\(c\)/);
  assert.ok(register.indexOf('requireIdentityInternal(c)')<register.indexOf('c.req.json()'));
  assert.match(register,/if \(existing\)[\s\S]*ACCOUNT_EXISTS/);
  assert.ok(register.indexOf('ACCOUNT_EXISTS')<register.indexOf('bcrypt.hash('));
  assert.match(register,/bcrypt\.hash\(body\.password, BCRYPT_COST\)/);
  assert.match(register,/body\.password\.length < MIN_PASSWORD \|\| body\.password\.length > MAX_PASSWORD/);
  assert.match(buyer,/const MIN_PASSWORD = 8/);
  assert.match(buyer,/const MAX_PASSWORD = 128/);
  assert.match(buyer,/const BCRYPT_COST = 10/);
});

test('LB-12: Identity alone issues the buyer session after canonical account creation', () => {
  assert.match(identity,/const issueSession = await prepareIdentityIssuedBuyerSession\(\)/);
  assert.ok(identity.indexOf('prepareIdentityIssuedBuyerSession()') < identity.indexOf("identityApiRequest('/storefront/buyer/register'"),
    'signing readiness must be established before account creation');
  assert.match(identity,/const token = await issueSession\(\{[\s\S]*buyerAccountId: buyer.id,[\s\S]*sessionEpoch: buyerSessionEpoch\(buyer.session_epoch\)/);
  assert.match(identity,/setBuyerSessionCookie\(token\)/);
  assert.match(issuer,/\.setAudience\(BUYER_SESSION_AUDIENCE\)/);
  assert.match(register,/publicBuyerAccount\(created\)/);
  assert.doesNotMatch(register+gateway+proxy,/issueCustomerSession|createSession\(|new SignJWT|CUSTOMER_SESSION_SECRET/);
});

test('LB-12: stale storefront registration bridges forms safely and refuses JSON credential creation', () => {
  assert.match(proxy,/refererUrl\.origin === new URL\(request\.url\)\.origin/);
  assert.match(proxy,/new URL\('\/api\/buyer-auth\/start', request\.url\)/);
  assert.match(proxy,/searchParams\.set\('screen', 'register'\)/);
  assert.match(proxy,/NextResponse\.redirect\(redirectTo, 303\)/);
  assert.match(proxy,/CANONICAL_BUYER_ACCOUNT_REQUIRED/);
  assert.match(proxy,/status: 410/);
  assert.doesNotMatch(proxy,/registerCustomer|createSession\(|request\.json\(/);
});

test('LB-12: the compatibility register route remains inventoried as gateway-proxy', () => {
  const route='apps/commerce/web/src/app/api/customer/register/route.ts';
  assert.ok(listAppApiRoutes().includes(route));
  assert.equal(classifyAppApiRoute(route),'gateway-proxy');
});

test('LB-12 UI: storefront account entry offers canonical Identity instead of store-local registration', () => {
  assert.match(sheet,/\/api\/buyer-auth\/start\?return_to=/);
  assert.match(sheet,/Continue with LetBuyy/);
  assert.doesNotMatch(sheet,/const handleRegister|await register\(|setState\('register'\)/);
});

test('LB-12 UI: transitional email entry makes an explicit login choice without account enumeration', () => {
  const entry=sheet.slice(sheet.indexOf('const handleEmailSubmit'),sheet.indexOf('const handleLogin'));
  assert.match(entry,/setState\('password_login'\)/);
  assert.doesNotMatch(entry,/checkEmail\(|hasPassword|setState\('not_found'\)/);
});

test('LB-12 UI: canonical credential form sends registration to Identity with human proof and CSRF headers', () => {
  assert.match(credentials,/mode === 'sign-in' \? '\/api\/buyer\/login' : '\/api\/buyer\/register'/);
  assert.match(credentials,/headers: getAuthHeaders\(\)/);
  assert.match(credentials,/JSON\.stringify\(\{ email: email\.trim\(\), password, turnstileToken:/);
  assert.doesNotMatch(credentials,/\/api\/customer\/register/);
});

test('LB-12 UI: Identity registration enforces its minimum and preserves actionable duplicate-account feedback', () => {
  assert.match(credentials,/minLength=\{mode === 'register' \? 8 : undefined\}/);
  assert.match(credentials,/mode === 'register' && res\.status === 409/);
  assert.match(credentials,/reset your password/);
});

test('LB-12 UI: canonical form has Turnstile, guarded submit and password cleanup', () => {
  assert.match(credentials,/onSubmit=\{submitCredentials\}/);
  assert.match(credentials,/<TurnstileWidget/);
  assert.match(credentials,/turnstileEnabled && !turnstileToken/);
  assert.match(credentials,/setPassword\(''\)/);
});

test('LB-12 UI: legacy context cannot resurrect a local register transport', () => {
  assert.doesNotMatch(authContext,/const register =|\/api\/customer\/register/);
  const start=read('apps/commerce/web/src/app/api/buyer-auth/start/route.ts');
  assert.match(start,/createPkcePair\(\)/);
  assert.match(start,/safeReturnTo\(/);
  assert.match(start,/searchParams\.get\('screen'\) === 'register'/);
});
