import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const authRouteSource = readFileSync('services/api-gateway/src/routes/auth.ts', 'utf8');
const intentMigrationSource = readFileSync('database/supabase/migrations/078_password_set_intents.sql', 'utf8');
const verifyOtpRouteSource = readFileSync('apps/platform/identity/src/app/api/auth/verify-otp/route.ts', 'utf8');
const setPasswordRouteSource = readFileSync('apps/platform/identity/src/app/api/auth/set-password/route.ts', 'utf8');
const cookieSource = readFileSync('apps/platform/identity/src/lib/auth/cookies.ts', 'utf8');
const authCoreSource = readFileSync('packages/auth-core/src/index.ts', 'utf8');

test('password-set intents are persisted server-side with lifecycle controls', () => {
  assert.match(intentMigrationSource, /CREATE TABLE IF NOT EXISTS public\.auth_password_set_intents/);
  assert.match(intentMigrationSource, /user_id uuid NOT NULL REFERENCES public\.users_custom\(id\)/);
  assert.match(intentMigrationSource, /expires_at timestamp with time zone NOT NULL/);
  assert.match(intentMigrationSource, /used_at timestamp with time zone/);
  assert.match(intentMigrationSource, /deleted_at timestamp with time zone/);
  assert.match(intentMigrationSource, /EXECUTE FUNCTION public\.update_updated_at\(\)/);
  assert.match(intentMigrationSource, /ENABLE ROW LEVEL SECURITY/);
  assert.match(intentMigrationSource, /Service role manages auth password set intents/);
});

test('gateway creates and consumes password-set intents behind internal auth', () => {
  for (const marker of [
    "auth.post('/custom/password-set-intents/create'",
    "auth.post('/custom/password-set-intents/consume'",
  ]) {
    const index = authRouteSource.indexOf(marker);
    assert.notEqual(index, -1, `${marker} exists`);
    assert.match(authRouteSource.slice(index, index + 260), /requireAccountsInternal/);
  }

  assert.match(authRouteSource, /PASSWORD_SET_INTENT_TTL_SECONDS = 15 \* 60/);
  assert.match(authRouteSource, /\.update\(\{ used_at: now \}\)[\s\S]{0,300}\.is\('used_at', null\)/);
  assert.match(authRouteSource, /\.gt\('expires_at', now\)/);
  assert.match(authRouteSource, /Password set intent is invalid or expired/);
});

test('identity set-password requires an OTP-created intent cookie and ignores body identity', () => {
  assert.match(verifyOtpRouteSource, /createPasswordSetIntent\(result\.user_id,\s*result\.email\)/);
  assert.match(verifyOtpRouteSource, /setPasswordSetIntentCookie\(intent\.id\)/);
  assert.match(cookieSource, /COOKIE_NAMES = resolveLetbuyyPlatformCookieNames\(process\.env\.NEXT_PUBLIC_ENV\)/);
  assert.match(authCoreSource, /passwordSetIntent: `lb_password_set_intent\$\{suffix\}`/);
  assert.match(cookieSource, /httpOnly: true/);
  assert.match(cookieSource, /sameSite: 'strict'/);

  assert.match(setPasswordRouteSource, /getPasswordSetIntentCookie\(\)/);
  assert.match(setPasswordRouteSource, /consumePasswordSetIntent\(intentId\)/);
  assert.match(setPasswordRouteSource, /user_id: intent\.user_id/);
  assert.match(setPasswordRouteSource, /email: intent\.email/);
  assert.match(setPasswordRouteSource, /createSession\(intent\.user_id,\s*device\.deviceId\)/);
  assert.doesNotMatch(setPasswordRouteSource, /const \{ password,\s*userId,\s*email \} = await request\.json\(\)/);
});
