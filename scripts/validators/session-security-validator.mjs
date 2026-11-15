import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import {
  createReporter,
  readFile,
  readJson,
} from './governance-common.mjs';

const reporter = createReporter('Session security validator');

// Inspect executable function/route bodies and real import bindings. Comments,
// disconnected helpers and a matching name elsewhere are not guard evidence.
const parsed = new Map();
const printer = ts.createPrinter({ removeComments: true });
const compact = text => text.replace(/\s+/g, '');
function tree(file) {
  if (!parsed.has(file)) {
    const source = ts.createSourceFile(file, readFile(file), ts.ScriptTarget.Latest, true);
    reporter.assert(source.parseDiagnostics.length === 0, `${file} must parse for session guard inspection`);
    parsed.set(file, source);
  }
  return parsed.get(file);
}
function printed(file, node) {
  if (!node) return '';
  // A permissive early return followed by the old, now-dead guard body must
  // not pass. This is a bounded structural check, not a control-flow proof.
  const transformed = ts.transform(node, [context => {
    function visit(current) {
      if (ts.isBlock(current)) {
        const statements = [];
        for (const statement of current.statements) {
          statements.push(ts.visitNode(statement, visit));
          if (ts.isReturnStatement(statement) || ts.isThrowStatement(statement)) break;
        }
        return ts.factory.updateBlock(current, statements);
      }
      return ts.visitEachChild(current, visit, context);
    }
    return current => ts.visitNode(current, visit);
  }]);
  try {
    return compact(printer.printNode(ts.EmitHint.Unspecified, transformed.transformed[0], tree(file)));
  } finally {
    transformed.dispose();
  }
}
function functionBody(file, name) {
  return printed(file, tree(file).statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name)?.body);
}
function routeBody(file, method, route, receiver = 'router') {
  const call = tree(file).statements.filter(ts.isExpressionStatement).map(n => n.expression).find(n => ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
    && n.expression.expression.getText(tree(file)) === receiver && n.expression.name.text === method
    && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text === route);
  return call ? printed(file, call.arguments.find(n => ts.isArrowFunction(n) || ts.isFunctionExpression(n))?.body) : '';
}
function requires(source, fragments, message) {
  reporter.assert(Boolean(source) && fragments.every(f => source.includes(compact(f))), message);
}
function imported(file, names, from) {
  return tree(file).statements.some(n => ts.isImportDeclaration(n) && n.moduleSpecifier.text === from
    && n.importClause?.namedBindings && ts.isNamedImports(n.importClause.namedBindings)
    && names.every(name => n.importClause.namedBindings.elements.some(e => !e.propertyName && e.name.text === name)));
}
function mount(file, receiver, method, route, handler) {
  return tree(file).statements.filter(ts.isExpressionStatement).map(n => n.expression).find(n => ts.isCallExpression(n) && ts.isPropertyAccessExpression(n.expression)
    && n.expression.expression.getText(tree(file)) === receiver && n.expression.name.text === method
    && ts.isStringLiteral(n.arguments[0]) && n.arguments[0].text === route
    && (handler === undefined || n.arguments[1]?.getText(tree(file)) === handler))?.getStart(tree(file)) ?? -1;
}

// Forward migrations may supersede an earlier definition. Check the effective
// overload, not a historical safe body that a later migration has replaced.
function latestSql(name, parameter, present = true) {
  const directory = 'database/supabase/migrations';
  const files = fs.readdirSync(path.resolve(directory)).filter(f => /^\d+.*\.sql$/.test(f))
    .sort((a, b) => Number(a.match(/^\d+/)[0]) - Number(b.match(/^\d+/)[0]) || a.localeCompare(b));
  const pattern = new RegExp(`CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+public\\.${name}\\s*\\(([\\s\\S]*?)\\)\\s*RETURNS\\b[\\s\\S]*?\\bAS\\s*(\\$(?:[A-Za-z_][A-Za-z0-9_]*)?\\$)([\\s\\S]*?)\\2\\s*;`, 'gi');
  let latest = '';
  for (const file of files) {
    const source = readFile(`${directory}/${file}`).replace(/--[^\n]*|\/\*[\s\S]*?\*\//g, '');
    for (const match of source.matchAll(pattern)) {
      if (parameter === undefined || match[1].toLowerCase().includes(parameter) === present) {
        latest = match[0];
      }
    }
  }
  return compact(latest.toLowerCase());
}

function assertIncludes(file, fragment, message) {
  reporter.assert(readFile(file).includes(fragment), message || `${file} must include ${fragment}`);
}

function assertNotIncludes(file, fragment, message) {
  reporter.assert(!readFile(file).includes(fragment), message || `${file} must not include ${fragment}`);
}

const authCore = readFile('packages/auth-core/src/index.ts');
for (const fragment of [
  "LETBUYY_INTERNAL_API_SECRET?: string | null",
  "return env.INTERNAL_API_SECRET || env.LETBUYY_INTERNAL_API_SECRET || undefined",
  'INTERNAL_SESSION_HEADER_PREFIX}-JTI',
  'export function internalAppSigningPayload',
  'export function internalIdentitySigningPayload',
  'export function isSafeLetbuyyInternalJti',
]) {
  reporter.assert(authCore.includes(fragment), `auth-core internal signing contract missing: ${fragment}`);
}
reporter.assert(!authCore.includes('env.AUTH_SECRET'), 'auth-core internal auth must not fall back to AUTH_SECRET');

const internalAuth = readFile('services/api-gateway/src/lib/internal-auth.ts');
for (const fragment of [
  'INTERNAL_API_SECRET_PREVIOUS',
  'LETBUYY_INTERNAL_API_SECRET_PREVIOUS',
  'verifyInternalIdentityPayload',
  'internalAppSigningPayload',
  'internalIdentitySigningPayload',
]) {
  reporter.assert(internalAuth.includes(fragment), `gateway internal auth missing: ${fragment}`);
}
reporter.assert(!internalAuth.includes('env.AUTH_SECRET'), 'gateway internal auth must not fall back to AUTH_SECRET');

const internalAuthFile = 'services/api-gateway/src/lib/internal-auth.ts';
requires(functionBody(internalAuthFile, 'getInternalAuthSecrets'), [
  'getLetbuyyInternalAuthSecret(env)', 'env.INTERNAL_API_SECRET_PREVIOUS',
  'env.LETBUYY_INTERNAL_API_SECRET_PREVIOUS', 'env.WORKER_INTERNAL_API_SECRET',
], 'internal signature verification must retain dedicated current and previous keys');
requires(functionBody(internalAuthFile, 'consumeInternalJti'), [
  "if (!isSafeLetbuyyInternalJti(input.jti) || !input.signature) return 'replayed'",
  'return claimInternalAuthReplayJti(input.env,', 'kind: input.kind', 'jti: input.jti',
], 'internal JTI consumption must use the durable claim owner after validating proof shape');
reporter.assert(imported(internalAuthFile, ['claimInternalAuthReplayJti'], './supabase'), 'internal JTI helper must import its canonical durable claim');
requires(functionBody(internalAuthFile, 'verifyInternalSessionHeaders'), [
  'await verifyLetbuyyInternalSessionHeaders(', 'if (verification.accepted)',
  'const claim = await consumeInternalJti(', "if (claim !== 'claimed')", 'accepted: false',
  "status: claim === 'replayed' ? 'replayed' as const : 'misconfigured' as const", 'return verification',
], 'internal session signatures must reject replay and unavailable durable claims');
requires(functionBody(internalAuthFile, 'verifyInternalAppRequest'), [
  'app !== expectedApp || !isFreshInternalTimestamp(timestamp) || !isSafeLetbuyyInternalJti(jti)',
  'internalAppSigningPayload(app, String(timestamp), jti)', 'getSecretsForCaller(c.env, callerId)',
  'if (await verifyLetbuyySignedPayload(secret, signingPayload, signature))',
  "return await consumeInternalJti({ env: c.env, kind: `app:${app}`, jti, signature }) === 'claimed'", 'return false',
], 'internal app requests must verify signed fresh caller proof and consume its durable JTI');
requires(functionBody(internalAuthFile, 'verifyInternalIdentityPayload'), [
  '!isFreshInternalTimestamp(input.timestamp) || !isSafeLetbuyyInternalJti(input.jti)',
  'internalIdentitySigningPayload(', 'await verifySignedPayload(env, payload, input.signature)',
  "return signed && await consumeInternalJti({ env, kind: 'identity', jti: input.jti, signature: input.signature }) === 'claimed'",
], 'internal identity assertions must compose signature verification and durable JTI consumption');
requires(functionBody('services/api-gateway/src/lib/supabase.ts', 'claimInternalAuthReplayJti'), [
  ".rpc('consume_internal_auth_replay_jti',", 'p_auth_kind: input.kind', 'p_jti: input.jti',
  "if (error) return 'unavailable'", "if (data === true) return 'claimed'",
  "if (data === false) return 'replayed'", "return 'unavailable'", "catch { return 'unavailable'",
], 'durable internal replay RPC must fail closed on errors and non-boolean replies');
requires(latestSql('consume_internal_auth_replay_jti'), [
  'INSERT INTO public.internal_auth_replay_claims', 'ON CONFLICT (auth_kind, jti) DO UPDATE',
  'WHERE current_claim.expires_at <= v_now', 'v_claimed := v_rows = 1', 'RETURN v_claimed',
  'p_ttl_seconds > 600',
].map(s => s.toLowerCase()), 'effective internal replay SQL must atomically refuse duplicate active JTIs');
const replayMigration = readFile('database/supabase/migrations/307_internal_auth_replay_claims.sql');
requires(compact(replayMigration.toLowerCase()), [
  'primary key (auth_kind, jti)', 'enable row level security',
  'revoke all on table public.internal_auth_replay_claims from public, anon, authenticated, app_tenant, service_role',
  'revoke all on function public.consume_internal_auth_replay_jti(text, text, integer) from public, anon, authenticated, app_tenant',
  'grant execute on function public.consume_internal_auth_replay_jti(text, text, integer) to service_role',
], 'internal replay claims must retain unique keys and service-only RPC privileges');

const internalSecret = readFile('services/api-gateway/src/lib/internal-secret.ts');
for (const fragment of [
  'INTERNAL_API_SECRET_PREVIOUS',
  'LETBUYY_INTERNAL_API_SECRET',
  'LETBUYY_INTERNAL_API_SECRET_PREVIOUS',
  'WORKER_INTERNAL_API_SECRET',
]) {
  reporter.assert(internalSecret.includes(fragment), `direct internal secret dual-accept missing: ${fragment}`);
}
reporter.assert(!internalSecret.includes('AUTH_SECRET'), 'direct internal secret helper must not use AUTH_SECRET');

const appStoreShared = readFile('services/api-gateway/src/routes/app-store/shared.ts');
reporter.assert(appStoreShared.includes('LETBUYY_INTERNAL_API_SECRET'), 'app-store shared platform token must use the dedicated internal secret');
reporter.assert(!appStoreShared.includes('AUTH_SECRET'), 'app-store shared platform token must not use AUTH_SECRET');

for (const file of [
  'apps/platform/identity/src/lib/api/client.ts',
  'apps/commerce/web/src/lib/api/client.ts',
]) {
  assertIncludes(file, 'createLetbuyyInternalAppHeaders', `${file} must use shared JTI app header signer`);
  assertNotIncludes(file, 'hmacSha256Hex', `${file} must not hand-roll internal app signatures`);
  assertNotIncludes(file, 'AUTH_SECRET', `${file} must not pass AUTH_SECRET into internal auth`);
}

for (const file of [
  'apps/merchant/web/src/lib/api/client.ts',
  'apps/frozen/app-store/src/lib/api/client.ts',
  'apps/frozen/theme-store/src/lib/api/client.ts',
  'apps/frozen/operations-portal/src/lib/api/client.ts',
]) {
  assertIncludes(file, 'LETBUYY_INTERNAL_API_SECRET', `${file} must prefer the dedicated internal secret`);
  assertNotIncludes(file, 'AUTH_SECRET', `${file} must not pass AUTH_SECRET into internal auth`);
}

const perimeter = readFile('services/api-gateway/src/middleware/internal-perimeter.ts');
for (const fragment of [
  'INTERNAL_GATEWAY_IP_ALLOWLIST',
  'INTERNAL_PERIMETER_UNCONFIGURED',
  'INTERNAL_CREDENTIAL_REQUIRED',
  'X-LetBuyy-Internal-JTI',
]) {
  reporter.assert(perimeter.includes(fragment), `internal perimeter missing: ${fragment}`);
}
const gatewayIndex = readFile('services/api-gateway/src/index.ts');
reporter.assert(gatewayIndex.includes("api.use('/internal/*', internalPerimeter)"), 'gateway must mount the internal perimeter before internal routes');
const gatewayFile = 'services/api-gateway/src/index.ts';
const perimeterPosition = mount(gatewayFile, 'api', 'use', '/internal/*', 'internalPerimeter');
for (const [route, handler, from] of [
  ['/internal/identity/operator', 'internalOperatorIdentityRouter', './routes/internal-operator-identity'],
  ['/internal/console', 'internalConsoleRouter', './routes/internal-console'],
]) {
  const position = mount(gatewayFile, 'api', 'route', route, handler);
  reporter.assert(perimeterPosition >= 0 && position > perimeterPosition
    && tree(gatewayFile).statements.some(n => ts.isImportDeclaration(n)
      && n.moduleSpecifier.text === from && n.importClause?.name?.text === handler),
  `gateway must mount ${route} from its canonical router after the internal perimeter`);
}
reporter.assert(imported(gatewayFile, ['internalPerimeter'], './middleware/internal-perimeter'), 'gateway perimeter mount must resolve to its actual middleware');
requires(printed('services/api-gateway/src/middleware/internal-perimeter.ts', tree('services/api-gateway/src/middleware/internal-perimeter.ts')), [
  'if (production && entries.length === 0)', 'if (entries.length > 0 && !ipAllowed(sourceIp(c), entries))',
  'if (!hasInternalCredential(c))',
], 'internal perimeter must fail closed for production configuration, source and credential');

const sessionMigration = readFile('database/supabase/migrations/161_foundation_session_security.sql');
for (const fragment of [
  'CREATE OR REPLACE FUNCTION public.validate_and_rotate_merchant_session',
  'FOR UPDATE',
  'reuse_detected',
  'idle_timeout',
  'revoked_at',
  'session_token_rotation_events',
]) {
  reporter.assert(sessionMigration.includes(fragment), `session migration missing: ${fragment}`);
}
const sessionRollback = readFile('database/supabase/rollback/161_foundation_session_security.rollback.sql');
for (const fragment of [
  'DROP FUNCTION IF EXISTS public.validate_and_rotate_merchant_session',
  'DROP TABLE IF EXISTS public.session_token_rotation_events',
  'DROP COLUMN IF EXISTS revoked_at',
  'DROP COLUMN IF EXISTS last_rotated_at',
]) {
  reporter.assert(sessionRollback.includes(fragment), `session rollback missing: ${fragment}`);
}

const authRoute = readFile('services/api-gateway/src/routes/auth.ts');
for (const fragment of [
  'validateMerchantSessionToken',
  'rotated_session_token',
  'enforceMerchantMfaIfEnrolled',
  'MFA_REQUIRED',
  'TOTP_ENCRYPTION_KEY',
  'mfa_code',
]) {
  reporter.assert(authRoute.includes(fragment), `merchant auth route missing: ${fragment}`);
}
requires(routeBody('services/api-gateway/src/routes/auth.ts', 'post', '/custom/users/authenticate', 'auth'), [
  'const mfaResponse = await enforceMerchantMfaIfEnrolled(', 'rawBody.mfa_code ?? rawBody.totp_code',
  'if (mfaResponse) return mfaResponse',
], 'merchant password authentication must execute and enforce enrolled MFA before success');
requires(functionBody('services/api-gateway/src/routes/auth.ts', 'enforceMerchantMfaIfEnrolled'), [
  'await readActiveMerchantMfaFactor(db, userId)',
  'await decryptTextAesGcm(encryptionSecret, factor.secret_ciphertext)',
  'await matchingTotpCounter({ secret: totpSecret, code })',
  "await db.rpc('consume_merchant_login_factor',", 'p_user_id: userId', 'p_factor_id: factor.id',
  'p_counter: counter', 'p_recovery_hash:', 'if (consumeError)', 'const accepted = consumed === true', 'if (!accepted)',
], 'merchant enrolled MFA must verify the actual actor factor and durably consume the accepted counter or recovery code');
requires(latestSql('consume_merchant_login_factor'), [
  'FOR UPDATE', "status='active'", 'custom_user_id=p_user_id',
  'p_counter<=coalesce(f.login_last_counter,-1)', 'array_remove(recovery_code_hashes,p_recovery_hash)',
].map(s => s.toLowerCase()), 'merchant MFA consumption must bind the active actor factor, lock it and reject replay');
requires(functionBody('services/api-gateway/src/routes/auth.ts','readActiveMerchantMfaFactor'),[
  ".from('merchant_2fa_factors')", ".select('id, secret_ciphertext')", ".eq('custom_user_id', userId)",
  ".eq('factor_type', 'totp')", ".eq('status', 'active')", ".is('deleted_at', null)", '.limit(1)',
], 'merchant factor lookup must scope the active nondeleted TOTP factor to the actual actor');
requires(routeBody('services/api-gateway/src/routes/auth.ts','post','/custom/users/by-email','auth'),[
  'await readActiveMerchantMfaFactor(db, user.id)',
  'if (factorError || !Array.isArray(factors)) return c.json(dbErrorBody(), 503)',
  'mfa_required: factors.length > 0',
], 'Accounts admission must use the canonical factor lookup and fail closed on unavailable or malformed factor reads');
requires(functionBody('services/api-gateway/src/lib/merchant-session.ts', 'validateMerchantSessionToken'), [
  "await db.rpc('validate_and_rotate_merchant_session',", 'p_rotate: options.rotate === true',
  "accepted: row?.accepted === true && row?.status === 'accepted'", 'if (error)', 'accepted: false',
], 'merchant session validation must execute the rotation owner and fail closed');
requires(latestSql('validate_and_rotate_merchant_session'), [
  'FOR UPDATE', 'IF v_session.revoked_at IS NOT NULL', 'IF v_session.expires_at <= v_now',
  "RETURN QUERY SELECT false, 'reuse_detected'", "RETURN QUERY SELECT false, 'idle_timeout'",
  'INSERT INTO public.session_token_rotation_events', 'SET token = v_new_token',
].map(s => s.toLowerCase()), 'effective merchant session SQL must retain rotation, revocation, idle expiry and reuse rejection');

const twoFactorRoute = readFile('services/api-gateway/src/routes/two-factor.ts');
reporter.assert(twoFactorRoute.includes('env.TOTP_ENCRYPTION_KEY'), 'TOTP encryption must use the dedicated TOTP key');
reporter.assert(!twoFactorRoute.includes('env.AUTH_SECRET || env.INTERNAL_API_SECRET'), 'TOTP encryption must not share auth/internal secrets');
for (const [file, name] of [
  ['services/api-gateway/src/routes/two-factor.ts', 'configuredSecret'],
  ['services/api-gateway/src/routes/auth.ts', 'configuredTotpEncryptionSecret'],
]) {
  const body = functionBody(file, name);
  requires(body, ['const secret = env.TOTP_ENCRYPTION_KEY', 'if (!secret', 'return null', 'return secret'], 'merchant TOTP encryption must fail closed without its dedicated key');
  reporter.assert(!/AUTH_SECRET|INTERNAL_API_SECRET/.test(body), 'merchant TOTP encryption must prohibit auth/internal secret fallback');
}

// Identity is the sole asymmetric human issuer. Console's old local verifier
// and in-memory attempts/replay cache are no longer authorization or exports.
// Trace Console -> mounted Identity handler -> private Gateway -> effective SQL.
const consoleAuthFile = 'apps/internal/console/src/lib/console-auth-server.ts';
requires(functionBody(consoleAuthFile, 'setConsoleMfaCookie'), [
  "requestConsoleIdentity({ operation: 'mfa', current_token: token, code: input.code })",
  'if (!result.ok || !result.token)', 'persistConsoleIdentityCookie(result.token)',
], 'Console MFA must obtain Identity proof before persisting its session cookie');
reporter.assert(imported(consoleAuthFile, ['requestConsoleIdentity'], './console-identity-client')
  && imported(consoleAuthFile, ['readCurrentConsoleSession'], './console-live-session'),
'Console auth must import canonical Identity transport and live session verification');
requires(functionBody(consoleAuthFile, 'persistConsoleIdentityCookie'), [
  'await readCurrentConsoleSession(value)', 'if (!session || !isConsoleEmailAllowed(session.email)) return false',
], 'Console cookie persistence must require a live verified allowlisted Identity session');
const consoleClientFile = 'apps/internal/console/src/lib/console-identity-client.ts';
requires(functionBody(consoleClientFile, 'requestConsoleIdentity'), [
  'await createConsoleIdentityProof(body, process.env.PLATFORM_CONSOLE_API_TOKEN',
  "new URL('/api/operator/console', url)", "method: 'POST'", "redirect: 'error'", 'ok: response.ok && result.ok',
], 'Console must call the canonical Identity endpoint with a body-bound transport proof');
const identityRouteFile = 'apps/platform/identity/src/app/api/operator/console/route.ts';
reporter.assert(imported(identityRouteFile, ['executeOperatorConsole'], '@/lib/auth/operator-identity')
  && printed(identityRouteFile, tree(identityRouteFile)).includes('exportconstPOST=executeOperatorConsole;'),
'Identity POST must export the canonical operator handler');
const issuerFile = 'apps/platform/identity/src/lib/auth/operator-identity.ts';
reporter.assert(imported(issuerFile, ['getConsoleFactorFingerprint', 'matchConsoleTotpCounter'], './operator-factor')
  && imported(issuerFile, ['verifyIdentityPlatformSession', 'verifyConsoleIdentityProof'], '@letbuyy/auth-core/platform-identity'),
'Identity operator handler must import its configured factor and public proof verifiers');
requires(functionBody(issuerFile, 'executeOperatorConsole'), [
  'await verifyConsoleIdentityProof(', 'if (!jti) denied()',
  "await gateway('/internal/identity/operator/bridge-claim', { jti })",
  'await verifyIdentityPlatformSession(c.current_token, config)', '!current || !allowed(current.email)',
  "'/internal/identity/operator/current', undefined, c.current_token",
  'live.actor_id !== current.userId || live.email !== current.email',
  'matchConsoleTotpCounter(c.code, current.email)', 'getConsoleFactorFingerprint(current.email)',
  "'/internal/identity/operator/mfa'", 'counter: match.ok ? match.counter : null',
  'factor_fingerprint: fingerprint', 'token, c.current_token',
  'if (!result.verified) return Response.json({ ok: false',
], 'Identity operator MFA must verify transport, current live actor and configured factor before releasing durable elevation');
const factorFile = 'apps/platform/identity/src/lib/auth/operator-factor.ts';
requires(functionBody(factorFile, 'parsePerPrincipalTotpSecrets'), ['process.env.PLATFORM_CONSOLE_TOTP_SECRETS', 'normalizeConsoleEmail(email)'],
'Identity factors must be configured per normalized principal');
requires(functionBody(factorFile, 'getConsoleTotpSecretForPrincipal'), [
  'secrets[normalizeConsoleEmail(email)]', 'if (perPrincipal) return perPrincipal',
  'if (!isProductionConsoleRuntime())', 'process.env.PLATFORM_CONSOLE_TOTP_SECRET', 'return null',
], 'Identity production factor lookup must prohibit global-secret fallback');
requires(functionBody(factorFile, 'canUseConsoleDevMfaBypass'), [
  "return !isProductionConsoleRuntime() && process.env.NODE_ENV === 'development' && process.env.LETBUYY_ENABLE_DEV_AUTH_BYPASS === 'true'",
], 'Identity developer MFA bypass must be explicitly enabled and nonproduction');
requires(functionBody(factorFile, 'isProductionConsoleRuntime'), [
  "process.env.NODE_ENV === 'production'", "process.env.APP_ENV === 'production'", "process.env.VERCEL_ENV === 'production'",
], 'Identity factor fallbacks must recognize every production runtime flag');
requires(functionBody(factorFile, 'constantTimeEquals'), ['left.length === right.length && timingSafeEqual(left, right)'],
'Identity TOTP comparisons must remain timing safe');
requires(functionBody(factorFile, 'matchConsoleTotpCounter'), [
  'canUseConsoleDevMfaBypass() && devCode && constantTimeEquals(value, devCode)',
  'getConsoleTotpSecretForPrincipal(email)', "if (!secret) return { ok: false, reason: 'unavailable' }",
  'constantTimeEquals(hotp(bytes, candidate), value)',
], 'Identity TOTP matching must require the configured account factor');

const operatorGatewayFile = 'services/api-gateway/src/routes/internal-operator-identity.ts';
reporter.assert(mount(operatorGatewayFile, 'router', 'use', '*') >= 0
  && mount(operatorGatewayFile, 'router', 'use', '*') < mount(operatorGatewayFile, 'router', 'post', '/mfa'),
'operator Gateway Identity transport guard must be mounted before MFA');
requires(routeBody(operatorGatewayFile, 'use', '*'), [
  "if (!await verifyInternalAppRequest(c, 'accounts')) throw new AppError", 'await next()',
], 'operator Gateway router must enforce signed Identity transport before dispatch');
requires(routeBody(operatorGatewayFile, 'post', '/mfa'), ['.strict().safeParse(', 'await completeConsoleMfa(c, body.data.counter, body.data.factor_fingerprint)'],
'operator MFA route must call the canonical durable adapter');
reporter.assert(imported(operatorGatewayFile, ['verifyInternalAppRequest'], '../lib/internal-auth')
  && imported(operatorGatewayFile, ['completeConsoleMfa'], '../execution/console-mfa-execution.adapter'),
'operator Gateway must import the actual transport guard and durable MFA adapter');
const consoleRouterFile = 'services/api-gateway/src/routes/internal-console.ts';
requires(routeBody(consoleRouterFile, 'use', '*'), [
  'const expectedToken = c.env.PLATFORM_CONSOLE_API_TOKEN', 'if (!expectedToken)',
  'if (!token || !timingSafeEqualText(token, expectedToken))', 'await next()',
], 'Console compatibility router must retain its fail-closed service transport gate');
reporter.assert(mount(consoleRouterFile, 'router', 'use', '*') >= 0
  && mount(consoleRouterFile, 'router', 'use', '*') < mount(consoleRouterFile, 'router', 'route', '/sessions', 'internalConsoleSessionsRouter'),
'Console service transport gate must precede session dispatch');
reporter.assert(mount(consoleRouterFile, 'router', 'route', '/sessions', 'internalConsoleSessionsRouter') >= 0
  && tree(consoleRouterFile).statements.some(n => ts.isImportDeclaration(n)
    && n.moduleSpecifier.text === './internal-console/sessions' && n.importClause?.name?.text === 'internalConsoleSessionsRouter'),
'Console must mount the canonical session router');
const sessionsFile = 'services/api-gateway/src/routes/internal-console/sessions.ts';
requires(routeBody(sessionsFile, 'post', '/mfa'), [
  "if (!await verifyInternalAppRequest(c, 'accounts')) throw new AppError", '.strict().safeParse(',
  'await completeConsoleMfa(c, parsed.data.counter, parsed.data.factor_fingerprint)',
], 'compatibility Console MFA route must retain Identity transport and canonical durable authorization');
requires(functionBody('services/api-gateway/src/execution/console-mfa-execution.adapter.ts', 'completeConsoleMfa'), [
  "await readConsoleCredential(c, 'X-Platform-Console-Previous-Session')", '!target.payload.mfaVerified',
  'target.payload.userId !== previous.payload.userId', 'target.payload.email !== previous.payload.email',
  ".rpc('complete_console_mfa_v1',", 'consoleRegistrationArguments(target, previous)',
  'p_counter: counter', 'p_factor_fingerprint: factorFingerprint', 'if (error) throw', 'if (!parsed.success) throw',
], 'Console MFA adapter must bind verified predecessor and target to strict fail-closed durable authorization');
requires(functionBody('services/api-gateway/src/identity-foundation/console-session-repository.ts', 'readConsoleCredential'), [
  'await verifyIdentityPlatformSession(token,', 'publicJwks: c.env.LETBUYY_IDENTITY_PUBLIC_JWKS',
  'if (!token || !payload', 'throw new AppError', 'digest: await sha256Hex(token)',
], 'Gateway Console credential must require public-key Identity verification without bearer/secret fallback');
for (const file of ['services/api-gateway/src/identity-foundation/console-session-repository.ts',
  'apps/internal/console/src/lib/console-session.ts']) {
  reporter.assert(imported(file, ['verifyIdentityPlatformSession'], '@letbuyy/auth-core/platform-identity'),
    `${file} public verification must resolve to the canonical Identity verifier`);
}
requires(functionBody('apps/internal/console/src/lib/console-session.ts', 'readConsoleSession'), [
  'return verifyIdentityPlatformSession(cookieValue,', 'publicJwks: process.env.LETBUYY_IDENTITY_PUBLIC_JWKS',
], 'Console session reader must remain verify-only with public Identity keys');
requires(functionBody('apps/internal/console/src/lib/console-live-session.ts', 'readCurrentConsoleSession'), [
  'await readConsoleSession(cookieValue)', "'/internal/console/sessions/current'",
  'live.session_id !== session.sessionId', 'live.actor_id !== session.userId', 'live.mfa_verified !== session.mfaVerified', 'return null',
], 'Console must revalidate live session, actor and MFA state');
const publicVerifierFile = 'packages/auth-core/src/platform-identity.ts';
reporter.assert(imported(publicVerifierFile, ['jwtVerify', 'createLocalJWKSet'], 'jose'),
'platform signature verification must resolve to jose public verification');
requires(functionBody(publicVerifierFile, 'verified'), [
  'await jwtVerify(token, publicKeys(config.publicJwks),', "algorithms: ['ES256', 'EdDSA']", "typ: 'JWT'",
  'issuer, audience: magic ? PLATFORM_MAGIC_AUDIENCE : PLATFORM_SESSION_AUDIENCE',
  "requiredClaims: ['sub', 'jti', 'iat', 'exp']", "p.realm !== 'platform'", 'p.token_use !==',
  'p.exp! <= p.iat!', 'p.exp! - p.iat! >', 'catch { return null',
], 'platform public verifier must pin signature algorithms, issuer/audience, realm, token use and lifetime');
requires(functionBody(publicVerifierFile, 'publicKeys'), ['privateFields.some(field => field in key)', 'throw new Error', 'return createLocalJWKSet(parsed)'],
'platform verifier must reject private or symmetric key material');
for (const file of ['apps/internal/console/src/lib/console-session.ts',
  'services/api-gateway/src/identity-foundation/console-session-repository.ts', publicVerifierFile]) {
  reporter.assert(!/AUTH_SECRET|PLATFORM_CONSOLE_SESSION_SECRET|SignJWT|verifyLetbuyyPlatformSessionToken/.test(printed(file, tree(file))),
    `${file} must not accept legacy secret/bearer or local signing fallbacks`);
}

const consoleSql = latestSql('complete_console_mfa_v1', 'p_factor_fingerprint');
requires(consoleSql, [
  "pg_advisory_xact_lock(hashtextextended('letbuyy:console-actor:'||p_actor_id::text,0))",
  'FOR UPDATE OF p', 'public.console_session_state_v1(p_previous_session_id,p_previous_cookie_sha256)',
  "v_state->>'actor_id' IS DISTINCT FROM p_actor_id::text",
  "IF v_locked>clock_timestamp() THEN RETURN jsonb_build_object('accepted',true,'verified',false,'reason','locked')",
  'IF p_counter IS NULL OR p_counter<v_current-1 OR p_counter>v_current+1 OR p_counter<=v_last THEN',
  "v_failures:=least(v_failures+1,5);IF v_failures=5 THEN v_locked:=clock_timestamp()+interval '5 minutes'",
  "'{console_mfa_guard}'", "'failures',v_failures,'last_counter',v_last,'locked_until',v_locked",
  'public.transition_console_session_v1(', "'last_counter',p_counter", "'console_mfa_previous_digest',p_previous_cookie_sha256",
  "'console_factor_fingerprint' IS DISTINCT FROM p_factor_fingerprint", "'reset_required'", "'platform_console_mfa.verified'",
].map(s => s.toLowerCase()), 'effective Console MFA SQL must enforce actor-serialized durable replay, five-attempt lockout, factor binding and session rotation');
requires(latestSql('complete_console_mfa_v1', 'p_factor_fingerprint', false), [
  "select jsonb_build_object('accepted',false,'code','console_factor_proof_required')",
], 'legacy Console MFA overload must refuse elevation without configured-factor proof');

// Pin executable regression assertions at their current durable owner, without
// requiring historical test titles or mistaking a pure factor match for auth.
const durableTestsFile = 'services/api-gateway/src/__tests__/owned-db/console-mfa-state.postgres.test.ts';
requires(printed(durableTestsFile, tree(durableTestsFile)), [
  'Promise.all([a.call(), b.call(new Gateway(f.env))])',
  'replies.filter(r => r.json?.data.verified === true).length, 1',
  'assert.equal(JSON.parse(state(actor.id)).failures, 5)',
  "assert.equal(locked.json?.data.reason, 'locked')",
], 'durable Console MFA regression tests must assert cross-worker replay and actor lockout');

const oidcDisabled = readFile('apps/platform/identity/src/lib/identity-foundation/oidc-disabled.ts');
reporter.assert(!oidcDisabled.includes('mock: true'), 'OIDC disabled scaffold must not emit mock:true runtime payloads');
reporter.assert(oidcDisabled.includes('implemented: false'), 'OIDC disabled scaffold must be honest-disabled');
reporter.assert(!oidcDisabled.includes('DISABLED_JWKS'), 'OIDC scaffold must not publish hard-coded disabled JWKS');
reporter.assert(!/disabled-[xy]-coordinate/.test(oidcDisabled), 'OIDC scaffold must not publish fake JWKS coordinates');
reporter.assert(oidcDisabled.includes('configuredIdentityPublicJwks'), 'OIDC JWKS route must read configured public JWKS');
reporter.assert(oidcDisabled.includes('IDENTITY_JWKS_NOT_CONFIGURED'), 'OIDC JWKS route must fail closed when public JWKS is absent');

const allowlist = readJson('config/governance/anti-fabrication-allowlist.json');
reporter.assert((allowlist.entries || []).length === 0, 'Wave 4 anti-fabrication allowlist entries must be burned down');

const skipped = readFile('SKIPPED_HUMAN_DECISIONS.md');
for (const skipId of ['SKIP-W4-LIVE-SECRET-ROTATION', 'SKIP-W4-MTLS-CF-ACCESS']) {
  reporter.assert(skipped.includes(skipId), `SKIPPED_HUMAN_DECISIONS.md missing ${skipId}`);
}

for (const file of [
  'config/env/templates/worker.env.example',
  'config/env/templates/next-app.env.example',
  'config/env/staging.env.example',
  'config/env/production.env.example',
]) {
  const source = readFile(file);
  reporter.assert(source.includes('LETBUYY_INTERNAL_API_SECRET'), `${file} missing dedicated internal secret`);
  reporter.assert(source.includes('LETBUYY_INTERNAL_API_SECRET_PREVIOUS'), `${file} missing previous dedicated internal secret`);
}

reporter.finish('internal secret isolation, replay JTI, session rotation, MFA, perimeter, and skips checked');
