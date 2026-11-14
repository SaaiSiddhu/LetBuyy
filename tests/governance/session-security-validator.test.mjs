import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test, { after } from 'node:test';
import ts from 'typescript';

const root = process.cwd();
const validator = path.join(root, 'scripts/validators/session-security-validator.mjs');
const source = fs.readFileSync(validator, 'utf8');
// Run the real CLI against disk snapshots. There is no production override,
// exemption flag or rewritten validator in this test harness.
const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'letbuyy-session-guard-'));
after(() => fs.rmSync(fixture, { recursive: true, force: true }));
const files = new Set([...source.matchAll(/['"]((?:apps|services|packages|config|database)\/[^'"\n]+|SKIPPED_HUMAN_DECISIONS\.md)['"]/g)]
  .map(m => m[1]).filter(file => fs.existsSync(path.join(root, file)) && fs.statSync(path.join(root, file)).isFile()));
for (const file of fs.readdirSync(path.join(root, 'database/supabase/migrations'))) {
  if (/^\d+.*\.sql$/.test(file)) files.add('database/supabase/migrations/' + file);
}
for (const file of files) {
  fs.mkdirSync(path.dirname(path.join(fixture, file)), { recursive: true });
  fs.copyFileSync(path.join(root, file), path.join(fixture, file));
}
const run = cwd => spawnSync(process.execPath, [validator], {
  cwd, encoding: 'utf8', timeout: 20_000,
});
const output = result => result.stdout + result.stderr;
const read = file => fs.readFileSync(path.join(fixture, file), 'utf8');
function replace(text, before, next) {
  assert.equal(text.split(before).length - 1, 1, 'mutation must identify one actual source operation: ' + before);
  return text.replace(before, next);
}
const comment = text => '/* removed executable guard: ' + text.replaceAll('*/', '* /') + ' */';
function stripFunction(text, name, replacement = 'return true;') {
  const tree = ts.createSourceFile('mutation.ts', text, ts.ScriptTarget.Latest, true);
  const declaration = tree.statements.find(n => ts.isFunctionDeclaration(n) && n.name?.text === name);
  assert.ok(declaration?.body, 'actual function exists: ' + name);
  const body = declaration.body;
  return text.slice(0, body.getStart(tree)) + '{' + comment(body.getText(tree)) + replacement + '}' + text.slice(body.end);
}
function rejects(name, file, mutation, diagnostic) {
  test(name, () => {
    const target = path.join(fixture, file), existed = fs.existsSync(target);
    const original = existed ? read(file) : '';
    const changed = mutation(original);
    assert.notEqual(changed, original, 'negative control must change executable source');
    fs.writeFileSync(target, changed);
    try {
      const result = run(fixture);
      assert.equal(result.error, undefined, result.error?.message);
      assert.equal(result.status, 1, output(result));
      assert.match(output(result), diagnostic);
      assert.doesNotMatch(output(result), /must parse for session guard inspection|SyntaxError|TypeError/);
    } finally {
      if (existed) fs.writeFileSync(target, original);
      else fs.unlinkSync(target);
    }
  });
}
test('current canonical source and its isolated snapshot both pass the actual validator', () => {
  for (const cwd of [root, fixture]) {
    const result = run(cwd);
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, 0, output(result));
  }
});

const internal = 'services/api-gateway/src/lib/internal-auth.ts';
rejects('removing durable consumption cannot hide behind its old body in comments', internal,
  s => stripFunction(s, 'consumeInternalJti'), /durable claim owner/);
rejects('previous-key acceptance must remain executable', internal,
  s => replace(s, 'env.INTERNAL_API_SECRET_PREVIOUS,', comment('env.INTERNAL_API_SECRET_PREVIOUS,') + 'env.WRONG_KEY,'), /current and previous keys/);
rejects('session replay rejection cannot be replaced by a permissive branch', internal,
  s => replace(s, "if (claim !== 'claimed')", "if (false /* claim !== 'claimed' */)"), /reject replay and unavailable/);
rejects('app signature verification is mandatory', internal,
  s => replace(s, 'if (await verifyLetbuyySignedPayload(secret, signingPayload, signature))',
    'if (true ' + comment('await verifyLetbuyySignedPayload(secret, signingPayload, signature)') + ')'), /verify signed fresh caller proof/);
rejects('app durable replay claim is mandatory', internal,
  s => replace(s, "return await consumeInternalJti({ env: c.env, kind: `app:${app}`, jti, signature }) === 'claimed';", 'return true;'), /consume its durable JTI/);
rejects('identity signature and replay must be composed', internal,
  s => replace(s, "return signed && await consumeInternalJti({ env, kind: 'identity', jti: input.jti, signature: input.signature }) === 'claimed';", 'return signed;'), /signature verification and durable JTI/);
rejects('dedicated internal auth cannot fall back to AUTH_SECRET', 'packages/auth-core/src/index.ts',
  s => replace(s, 'return env.INTERNAL_API_SECRET || env.LETBUYY_INTERNAL_API_SECRET || undefined',
    'return env.INTERNAL_API_SECRET || env.LETBUYY_INTERNAL_API_SECRET || env.AUTH_SECRET || undefined'), /must not fall back to AUTH_SECRET/);
rejects('replay RPC errors must remain unavailable', 'services/api-gateway/src/lib/supabase.ts',
  s => replace(s, "if (error) return 'unavailable';", "if (error) return 'claimed';"), /fail closed on errors/);
rejects('non-boolean replay RPC response cannot become a claim', 'services/api-gateway/src/lib/supabase.ts',
  s => replace(s, "if (data === true) return 'claimed';", "if (data) return 'claimed';"), /non-boolean replies/);
rejects('early permissive replay claim cannot hide behind now-unreachable guards', 'services/api-gateway/src/lib/supabase.ts',
  s => replace(s, "    try {\n        const { data, error } = await getSupabaseAdminFromEnv(env).rpc('consume_internal_auth_replay_jti'",
    "    return 'claimed';\n    try {\n        const { data, error } = await getSupabaseAdminFromEnv(env).rpc('consume_internal_auth_replay_jti'"), /fail closed on errors/);
rejects('atomic JTI conflict cannot renew an unexpired claim', 'database/supabase/migrations/307_internal_auth_replay_claims.sql',
  s => replace(s, 'WHERE current_claim.expires_at <= v_now;', ';'), /atomically refuse duplicate active JTIs/);
rejects('ordinary roles cannot receive replay-claim authority', 'database/supabase/migrations/307_internal_auth_replay_claims.sql',
  s => replace(s, 'TO service_role;', 'TO authenticated;'), /service-only RPC privileges/);
rejects('a later permissive replay function cannot hide behind migration307', 'database/supabase/migrations/999_unsafe_session_guard.sql',
  () => 'CREATE OR REPLACE FUNCTION public.consume_internal_auth_replay_jti(p_auth_kind text,p_jti text,p_ttl_seconds integer) RETURNS boolean LANGUAGE sql AS $$ SELECT true; $$;', /atomically refuse duplicate active JTIs/);

const gateway = 'services/api-gateway/src/index.ts';
const perimeter = "api.use('/internal/*', internalPerimeter);";
rejects('commenting out the perimeter mount must fail', gateway,
  s => replace(s, perimeter, comment(perimeter)), /mount.*after the internal perimeter/);
rejects('a perimeter mounted after the operator router must fail', gateway,
  s => replace(replace(s, perimeter, ''), "api.route('/internal/identity/operator', internalOperatorIdentityRouter);",
    "api.route('/internal/identity/operator', internalOperatorIdentityRouter);\n" + perimeter), /mount.*after the internal perimeter/);
rejects('a disconnected helper containing the old mount is not a live mount', gateway,
  s => replace(s, perimeter, 'function unusedPerimeter() { ' + perimeter + ' }'), /mount.*after the internal perimeter/);
rejects('operator router mount is mandatory', gateway,
  s => replace(s, "api.route('/internal/identity/operator', internalOperatorIdentityRouter);", ''), /mount.*identity\/operator/);
rejects('a router name cannot resolve to another implementation', gateway,
  s => replace(s, "import internalOperatorIdentityRouter from './routes/internal-operator-identity';",
    "import internalOperatorIdentityRouter from './routes/unbound';"), /mount.*identity\/operator/);
rejects('production perimeter configuration must fail closed', 'services/api-gateway/src/middleware/internal-perimeter.ts',
  s => replace(s, 'if (production && entries.length === 0)', 'if (false)'), /perimeter must fail closed/);

const auth = 'services/api-gateway/src/routes/auth.ts';
rejects('enrolled MFA helper existence does not replace its authentication call', auth,
  s => replace(s, 'if (mfaResponse) return mfaResponse;', comment('if (mfaResponse) return mfaResponse;')), /execute and enforce enrolled MFA/);
rejects('enrolled factor must be verified rather than assumed', auth,
  s => replace(s, 'await verifyTotpCode({ secret: totpSecret, code })', 'true'), /verify the actual actor factor/);
for (const file of [auth, 'services/api-gateway/src/routes/two-factor.ts']) {
  rejects('TOTP encryption rejects fallback in ' + file, file,
    s => replace(s, 'const secret = env.TOTP_ENCRYPTION_KEY;', 'const secret = env.TOTP_ENCRYPTION_KEY || env.AUTH_SECRET;'), /TOTP encryption must prohibit/);
}
rejects('merchant session RPC cannot be bypassed', 'services/api-gateway/src/lib/merchant-session.ts',
  s => stripFunction(s, 'validateMerchantSessionToken'), /execute the rotation owner/);
rejects('later merchant session redefinition cannot bypass rotation checks', 'database/supabase/migrations/999_unsafe_session_guard.sql',
  () => "CREATE OR REPLACE FUNCTION public.validate_and_rotate_merchant_session(p_token text,p_rotate boolean,p_idle_timeout_seconds integer,p_rotation_interval_seconds integer) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb; $$;", /effective merchant session SQL/);

const consoleAuth = 'apps/internal/console/src/lib/console-auth-server.ts';
rejects('Console cannot locally mint elevated MFA cookies', consoleAuth,
  s => stripFunction(s, 'setConsoleMfaCookie'), /obtain Identity proof/);
rejects('a successful transport reply cannot skip live cookie validation', consoleAuth,
  s => stripFunction(s, 'persistConsoleIdentityCookie'), /live verified allowlisted Identity session/);
rejects('an early successful cookie return cannot hide behind an unreachable live verifier', consoleAuth,
  s => replace(s, 'export async function persistConsoleIdentityCookie(value:string) {', 'export async function persistConsoleIdentityCookie(value:string) { return true;'), /live verified allowlisted Identity session/);
rejects('Console transport must keep the actual Identity endpoint', 'apps/internal/console/src/lib/console-identity-client.ts',
  s => replace(s, "'/api/operator/console'", "'/api/unbound'"), /canonical Identity endpoint/);
rejects('Identity route must export its real handler', 'apps/platform/identity/src/app/api/operator/console/route.ts',
  s => replace(s, 'export const POST=executeOperatorConsole;', 'export const POST=async()=>Response.json({ok:true});'), /POST must export/);
const issuer = 'apps/platform/identity/src/lib/auth/operator-identity.ts';
rejects('Identity proof verification cannot be stripped', issuer,
  s => replace(s, 'if(!jti)denied();', comment('if(!jti)denied();')), /verify transport, current live actor/);
rejects('MFA result must be durable before releasing proposed elevation', issuer,
  s => replace(s, 'if(!result.verified)return', 'if(false)return'), /before releasing durable elevation/);
rejects('configured factor import must resolve to Identity owner', issuer,
  s => replace(s, "from './operator-factor'", "from './unbound-factor'"), /import its configured factor/);
const factor = 'apps/platform/identity/src/lib/auth/operator-factor.ts';
rejects('production cannot use the global factor fallback', factor,
  s => replace(s, 'if (!isProductionConsoleRuntime())', 'if (true)'), /prohibit global-secret fallback/);
rejects('developer code cannot authorize production', factor,
  s => replace(s, 'return !isProductionConsoleRuntime()\n        &&', 'return'), /explicitly enabled and nonproduction/);
rejects('per-account matcher must perform timing-safe HOTP comparison', factor,
  s => replace(s, 'if(constantTimeEquals(hotp(bytes,candidate),value))', 'if(true)'), /require the configured account factor/);

const operator = 'services/api-gateway/src/routes/internal-operator-identity.ts';
rejects('private Gateway must enforce actual signed Identity transport', operator,
  s => replace(s, "if(!await verifyInternalAppRequest(c,'accounts'))", 'if(false)'), /enforce signed Identity transport/);
rejects('private Gateway MFA must call durable adapter', operator,
  s => replace(s, 'await completeConsoleMfa(c,body.data.counter,body.data.factor_fingerprint)', '({verified:true})'), /call the canonical durable adapter/);
rejects('Console compatibility MFA endpoint cannot bypass Identity transport', 'services/api-gateway/src/routes/internal-console/sessions.ts',
  s => replace(s, "if(!await verifyInternalAppRequest(c,'accounts'))", 'if(false)'), /compatibility Console MFA route/);
rejects('Console compatibility session router must stay mounted', 'services/api-gateway/src/routes/internal-console.ts',
  s => replace(s, "router.route('/sessions', internalConsoleSessionsRouter);", ''), /mount the canonical session router/);
rejects('Console bridge cannot be disconnected from its router', 'services/api-gateway/src/routes/internal-console.ts',
  s => replace(s, "router.use('*', consoleBridge);", "router.use('*', async (c,next)=>{await next();});"), /mount its actual service transport guard/);
rejects('Console bridge import must resolve to its checked implementation', 'services/api-gateway/src/routes/internal-console.ts',
  s => replace(s, "from '../identity-foundation/console-bridge'", "from '../identity-foundation/unbound'"), /mount its actual service transport guard/);
rejects('Console bridge must reject an unconfigured transport', 'services/api-gateway/src/identity-foundation/console-bridge.ts',
  s => replace(s, 'if (!expected) return c.json(', 'if (false) return c.json('), /fail-closed service transport gate/);
rejects('Console bridge must verify the actual transport token', 'services/api-gateway/src/identity-foundation/console-bridge.ts',
  s => replace(s, 'if (!token || !timingSafeEqualText(token, expected))', 'if (false)'), /fail-closed service transport gate/);
rejects('MFA durable adapter cannot assume success', 'services/api-gateway/src/execution/console-mfa-execution.adapter.ts',
  s => stripFunction(s, 'completeConsoleMfa'), /bind verified predecessor and target/);
rejects('Gateway cannot replace public verification with bearer authority', 'services/api-gateway/src/identity-foundation/console-session-repository.ts',
  s => stripFunction(s, 'readConsoleCredential', "return {payload:{userId:c.req.header('Authorization')},digest:''};"), /public-key Identity verification/);
rejects('Console live session verification cannot be stripped', 'apps/internal/console/src/lib/console-live-session.ts',
  s => stripFunction(s, 'readCurrentConsoleSession'), /revalidate live session/);
rejects('Console verify-only reader prohibits legacy secret fallback', 'apps/internal/console/src/lib/console-session.ts',
  s => replace(s, 'return verifyIdentityPlatformSession(', "if(process.env.PLATFORM_CONSOLE_SESSION_SECRET)return {mfaVerified:true} as never; return verifyIdentityPlatformSession("), /must not accept legacy secret\/bearer/);
rejects('public signature verification is mandatory', 'packages/auth-core/src/platform-identity.ts',
  s => stripFunction(s, 'verified'), /pin signature algorithms/);
rejects('an early verified payload cannot hide behind unreachable signature checks', 'packages/auth-core/src/platform-identity.ts',
  s => replace(s, '    if (!token || token.length > 4096', '    return {sub:"unverified"};\n    if (!token || token.length > 4096'), /pin signature algorithms/);
rejects('signature verifier import cannot resolve to a permissive helper', 'packages/auth-core/src/platform-identity.ts',
  s => replace(s, "from 'jose'", "from './unbound'"), /resolve to jose public verification/);
rejects('public signature algorithm pins cannot include HS256', 'packages/auth-core/src/platform-identity.ts',
  s => replace(s, "algorithms: ['ES256', 'EdDSA']", "algorithms: ['ES256', 'EdDSA', 'HS256']"), /pin signature algorithms/);
rejects('public verifiers must reject symmetric/private key material', 'packages/auth-core/src/platform-identity.ts',
  s => stripFunction(s, 'publicKeys'), /reject private or symmetric key/);

const sql = 'database/supabase/migrations/329_approved_operator_mfa_reset.sql';
rejects('effective actor replay lock cannot be removed', sql,
  s => replace(s, "PERFORM pg_advisory_xact_lock(hashtextextended('letbuyy:console-actor:'||p_actor_id::text,0));\n -- Exact committed-response retry", '\n -- Exact committed-response retry'), /actor-serialized durable replay/);
rejects('effective consumed TOTP counter cannot be replayed', sql,
  s => replace(s, ' OR p_counter<=v_last', ''), /actor-serialized durable replay/);
rejects('effective actor lockout must charge and cap failures', sql,
  s => replace(s, 'v_failures:=least(v_failures+1,5);', 'v_failures:=0;'), /five-attempt lockout/);
rejects('effective actor lockout must reject even valid codes while locked', sql,
  s => replace(s, 'IF v_locked>clock_timestamp() THEN', 'IF false THEN'), /five-attempt lockout/);
rejects('later permissive configured MFA overload cannot hide behind migration329', 'database/supabase/migrations/999_unsafe_session_guard.sql',
  () => "CREATE OR REPLACE FUNCTION public.complete_console_mfa_v1(p_session_id uuid,p_cookie_sha256 text,p_email text,p_actor_id uuid,p_issued_at timestamptz,p_expires_at timestamptz,p_mfa_verified_at timestamptz,p_previous_session_id uuid,p_previous_cookie_sha256 text,p_counter bigint,p_factor_fingerprint text) RETURNS jsonb LANGUAGE sql AS $$ SELECT '{\"verified\":true}'::jsonb; $$;", /effective Console MFA SQL/);
rejects('legacy MFA overload cannot elevate without configured proof', sql,
  s => replace(s, "SELECT jsonb_build_object('accepted',false,'code','CONSOLE_FACTOR_PROOF_REQUIRED');", "SELECT jsonb_build_object('accepted',true,'verified',true);"), /legacy Console MFA overload must refuse/);
rejects('durable replay regression must retain its actual assertion', 'services/api-gateway/src/__tests__/owned-db/console-mfa-state.postgres.test.ts',
  s => replace(s, 'assert.equal(replies.filter(r=>r.json?.data.verified===true).length,1);', ''), /regression tests must assert cross-worker replay/);
