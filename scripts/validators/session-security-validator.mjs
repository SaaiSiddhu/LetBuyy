import {
  createReporter,
  readFile,
  readJson,
} from './governance-common.mjs';

const reporter = createReporter('Session security validator');

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
  'consumedInternalJtis',
  "status: 'replayed'",
  'verifyInternalIdentityPayload',
  'internalAppSigningPayload',
  'internalIdentitySigningPayload',
]) {
  reporter.assert(internalAuth.includes(fragment), `gateway internal auth missing: ${fragment}`);
}
reporter.assert(!internalAuth.includes('env.AUTH_SECRET'), 'gateway internal auth must not fall back to AUTH_SECRET');

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

const twoFactorRoute = readFile('services/api-gateway/src/routes/two-factor.ts');
reporter.assert(twoFactorRoute.includes('env.TOTP_ENCRYPTION_KEY'), 'TOTP encryption must use the dedicated TOTP key');
reporter.assert(!twoFactorRoute.includes('env.AUTH_SECRET || env.INTERNAL_API_SECRET'), 'TOTP encryption must not share auth/internal secrets');

// The allowlist/TOTP implementation moved to console-mfa.ts (SUSTAINED-E) so it can run under a
// plain `node --test` without server-only/Next.js imports; console-auth-server.ts re-exports it as
// a barrel. Check both: the real logic in console-mfa.ts, and that the barrel still re-exports it
// (a barrel regression would silently break every existing caller while this file kept passing).
const consoleMfa = readFile('apps/internal/console/src/lib/console-mfa.ts');
for (const fragment of [
  'PLATFORM_CONSOLE_TOTP_SECRETS',
  'getConsoleTotpSecretForPrincipal',
  'verifyConsoleTotp(code: string, email: string)',
  '!isProductionConsoleRuntime()',
  'MFA_MAX_ATTEMPTS',
  'timingSafeEqual',
]) {
  reporter.assert(consoleMfa.includes(fragment), `platform console per-principal TOTP missing: ${fragment}`);
}
const consoleAuth = readFile('apps/internal/console/src/lib/console-auth-server.ts');
for (const fragment of ['getConsoleTotpSecretForPrincipal', 'verifyConsoleTotp']) {
  reporter.assert(
    new RegExp(`^\\s*${fragment},?\\s*$`, 'm').test(consoleAuth),
    `console-auth-server.ts must still re-export ${fragment} from console-mfa.ts`,
  );
}
// SUSTAINED-E closed a real lockout+replay+timing-safety gap; pin that the regression tests proving
// it stay present, not only the source text that could superficially match without them.
const consoleMfaTest = readFile('apps/internal/console/src/lib/console-mfa.test.ts');
for (const fragment of [
  'REGRESSION CLOSED — replay',
  'REGRESSION CLOSED — lockout',
]) {
  reporter.assert(consoleMfaTest.includes(fragment), `console-mfa.test.ts missing its own regression test: ${fragment}`);
}

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
