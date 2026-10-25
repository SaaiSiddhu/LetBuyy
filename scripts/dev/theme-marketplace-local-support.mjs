import { createHash } from 'node:crypto';
import { readFileSync, lstatSync, realpathSync } from 'node:fs';

export const TOOL = 'theme-marketplace';
export const DATABASE = 'letbuyy_exec_threadline_lifecycle_postgres';
export const PG_IMAGE = 'postgres:16-alpine';
export const REST_IMAGE = 'public.ecr.aws/supabase/postgrest:v16.2';
export const PORTS = Object.freeze({ marketplace: 9015, api: 9020, identity: 9021, merchant: 9022, commerce: 9023, pg: 9034, rest: 9035 });
export const ORIGINS = Object.freeze({ marketplace: 'http://themes.letbuyy-local.localhost:9015', api: 'http://127.0.0.1:9020', identity: 'http://accounts.letbuyy-local.localhost:9021', merchant: 'http://admin.letbuyy-local.localhost:9022', commerce: 'http://localhost:9023' });
export const SOURCE_EPOCH = '8c89302c8b1991d8bde035d9debe099f8460d24255a794c51a4157daec4f2082';
export const DUMP_SHA = 'cd334b97740deb335709da05f17c16d2bf197b4f710c43e25f3aa32a6c8bf2bd';
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export function labels(config, role) {
  return { 'com.letbuyy.local-tool': TOOL, 'com.letbuyy.local-id': config.id, 'com.letbuyy.local-checkout': config.repoRoot, 'com.letbuyy.local-role': role };
}
export function assertLabels(object, config, role) {
  const actual = object.Config?.Labels ?? object.Labels ?? {};
  for (const [key, value] of Object.entries(labels(config, role))) if (actual[key] !== value) throw Error(`Refusing foreign ${role} resource`);
  if (actual['com.letbuyy.executable-fixture'] || actual['com.supabase.project']) throw Error('Test/restored resources are never adopted');
}
export function assertPrivateFile(path) {
  const st = lstatSync(path);
  if (!st.isFile() || st.isSymbolicLink() || (st.mode & 0o077) !== 0 || st.uid !== process.getuid?.()) throw Error('Private local file must be owned, regular and mode 0600');
}
export function loadConfig(path, repoRoot) {
  assertPrivateFile(path);
  const c = JSON.parse(readFileSync(path, 'utf8'));
  if (c.version !== 1 || !/^[a-f0-9]{12}$/.test(c.id) || c.repoRoot !== realpathSync(repoRoot) || c.sourceRoot !== `${c.repoRoot}/.local/theme-marketplace/source` || realpathSync(c.sourceRoot) !== c.sourceRoot || c.sourceEpoch !== SOURCE_EPOCH || c.dumpSha !== DUMP_SHA) throw Error('Local configuration binding refused');
  if (!/^[a-f0-9]{64}$/.test(c.physicalSha ?? '')) throw Error('Verified physical database snapshot is required');
  if (c.siteId !== 'cf45b15f-5910-430d-b140-56af04983e5a' || !/^syn-[a-z0-9-]+$/.test(c.subdomain) || !/^syn-threadline-[a-f0-9-]+@example\.invalid$/.test(c.email)) throw Error('Preserved synthetic account binding refused');
  for (const key of ['internalSecret', 'restSecret', 'dbPassword', 'cookieSecret', 'checkoutSecret']) if (!/^[a-f0-9]{64}$/.test(c[key])) throw Error('Local secret shape refused');
  if (c.privateJwk.kty !== 'EC' || c.privateJwk.crv !== 'P-256' || c.privateJwk.alg !== 'ES256' || !c.privateJwk.d || c.privateJwk.kid !== 'marketplace-local') throw Error('Local issuer key refused');
  return c;
}
export function resourceNames(c) {
  const prefix = `letbuyy-local-marketplace-${c.id}`;
  return { pg: `${prefix}-pg`, rest: `${prefix}-rest`, network: `${prefix}-network`, volume: `${prefix}-data` };
}
export function assertContainer(object, c, role, names) {
  assertLabels(object, c, role);
  const pg = role === 'postgres';
  if (object.Config.Image !== (pg ? PG_IMAGE : REST_IMAGE) || object.HostConfig.Privileged || object.HostConfig.NetworkMode !== names.network || Object.keys(object.NetworkSettings.Networks).length !== 1) throw Error('Local container image/network/privilege refused');
  const mounts = object.Mounts ?? [];
  if (pg ? mounts.length !== 1 || mounts[0].Type !== 'volume' || mounts[0].Name !== names.volume || mounts[0].Destination !== '/var/lib/postgresql/data' : mounts.length !== 0) throw Error('Local container mount refused');
  const bindings = object.HostConfig.PortBindings;
  const expected = pg ? '5432/tcp' : '3000/tcp', port = pg ? PORTS.pg : PORTS.rest;
  if (Object.keys(bindings ?? {}).length !== 1 || bindings[expected]?.length !== 1 || bindings[expected][0].HostIp !== '127.0.0.1' || bindings[expected][0].HostPort !== String(port)) throw Error('Local ports must bind exactly to loopback');
}
export function sessionEnvironment(c) {
  return { NODE_ENV: 'development', NEXT_TELEMETRY_DISABLED: '1', INTERNAL_API_SECRET: c.internalSecret, LETBUYY_INTERNAL_API_SECRET: c.internalSecret,
    LETBUYY_API_URL: ORIGINS.api + '/v1', LETBUYY_API_BASE_URL: ORIGINS.api + '/v1', NEXT_PUBLIC_API_URL: ORIGINS.api + '/v1', NEXT_PUBLIC_API_BASE_URL: ORIGINS.api + '/v1',
    NEXT_PUBLIC_THEME_MARKETPLACE_URL: ORIGINS.marketplace, NEXT_PUBLIC_ACCOUNTS_URL: ORIGINS.identity, NEXT_PUBLIC_ADMIN_URL: ORIGINS.merchant,
    NEXT_PUBLIC_STOREFRONT_URL: ORIGINS.commerce, NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN: 'localhost', NEXT_PUBLIC_STORE_ROOT_DOMAIN: 'localhost',
    LETBUYY_IDENTITY_ISSUER: ORIGINS.identity, LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'false', NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS: 'false',
    CHECKOUT_ORIGIN: 'https://checkout.localhost:9024', CHECKOUT_SIGNING_SECRET: c.checkoutSecret,
    RESEND_API_KEY: '', LETBUYY_EMAIL_API_KEY: '' };
}
