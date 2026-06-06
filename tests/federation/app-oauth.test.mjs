import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { readAppStoreRouteSource } from '../helpers/app-store-route-source.mjs';

const AUTH_CORE_SOURCE = readFileSync('packages/auth-core/src/index.ts', 'utf8');
const APP_ENGINE_SOURCE = readFileSync('packages/app-engine/src/index.ts', 'utf8');
const API_CLIENT_SOURCE = readFileSync('packages/typescript/api-client/src/index.ts', 'utf8');
const APP_STORE_ROUTE_SOURCE = readAppStoreRouteSource();
const SHARED_TYPES_SOURCE = readFileSync('packages/shared-types/src/index.ts', 'utf8');

test('app OAuth is owned by auth-core, app-engine, api-client, and the gateway route', () => {
  assert.match(AUTH_CORE_SOURCE, /createAppAuthorizationCode/);
  assert.match(AUTH_CORE_SOURCE, /verifyAppAuthorizationCode/);
  assert.match(AUTH_CORE_SOURCE, /type: 'app_authorization_code'/);

  assert.match(APP_ENGINE_SOURCE, /normalizeAppOAuthRedirectUri/);
  assert.match(APP_ENGINE_SOURCE, /buildAppOAuthRedirectUrl/);
  assert.match(APP_ENGINE_SOURCE, /appOAuthClientId/);

  assert.match(API_CLIENT_SOURCE, /oauthAuthorize/);
  assert.match(API_CLIENT_SOURCE, /oauthTokenExchange/);
  assert.match(API_CLIENT_SOURCE, /AppOAuthTokenResult/);

  assert.match(APP_STORE_ROUTE_SOURCE, /\/apps\/:id\/oauth\/authorize/);
  assert.match(APP_STORE_ROUTE_SOURCE, /\/oauth\/token/);
  assert.match(APP_STORE_ROUTE_SOURCE, /\/oauth\/token-exchange/);
  assert.match(APP_STORE_ROUTE_SOURCE, /Authorization code has already been redeemed or is not recognized/);
});

test('shared-types exposes the app OAuth response contract consumed by the client', () => {
  assert.match(SHARED_TYPES_SOURCE, /AppOAuthAuthorizationResultSchema/);
  assert.match(SHARED_TYPES_SOURCE, /AppOAuthTokenResultSchema/);
  assert.match(API_CLIENT_SOURCE, /requestData<AppOAuthAuthorizationResult>/);
  assert.match(API_CLIENT_SOURCE, /requestData<AppOAuthTokenResult>/);
});

test('OAuth federation does not add app-local API routes or Supabase ownership', () => {
  assert.doesNotMatch(API_CLIENT_SOURCE, /@supabase\//);
  assert.doesNotMatch(APP_ENGINE_SOURCE, /from 'apps\//);
  assert.doesNotMatch(AUTH_CORE_SOURCE, /from 'apps\//);
});
