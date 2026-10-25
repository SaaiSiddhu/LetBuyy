#!/usr/bin/env node
// On-demand development for the existing apps. No test-runner lifecycle is changed.
import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { generateKeyPairSync, randomBytes } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync, chmodSync, openSync, closeSync, renameSync, unlinkSync, realpathSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOL, DATABASE, PG_IMAGE, REST_IMAGE, PORTS, ORIGINS, SOURCE_EPOCH, DUMP_SHA, sha, labels, assertLabels, assertContainer, assertPrivateFile, loadConfig, resourceNames, sessionEnvironment } from './theme-marketplace-local-support.mjs';

const repoRoot = realpathSync(resolve(dirname(fileURLToPath(import.meta.url)), '../..'));
const directory = join(repoRoot, '.local/theme-marketplace');
const configPath = join(directory, 'config.json'), processPath = join(directory, 'process.json');
const command = process.argv[2] ?? 'status';
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
const privateWrite = (path, value) => { const temporary = `${path}.${process.pid}.tmp`; writeFileSync(temporary, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' }); renameSync(temporary, path); };
function run(binary, args, options = {}) {
  const result = spawnSync(binary, args, { encoding: 'utf8', timeout: 60_000, maxBuffer: 32 * 1024 * 1024, ...options });
  // Docker arguments/environment/SQL can contain local secrets. Never echo them on failure.
  if (result.status !== 0 && !options.allowFailure) {
    writeFileSync(join(directory, 'tool-errors.log'), `${new Date().toISOString()} ${binary} ${args[0]}: ${result.stderr ?? result.error?.message ?? ''}\n`, { flag: 'a', mode: 0o600 });
    throw Error(`${binary} operation failed; inspect private local logs (exit ${result.status ?? 'unavailable'})`);
  }
  return result;
}
const docker = (args, options) => run('docker', args, options);
function inspect(kind, name) { const r = docker([kind, 'inspect', name], { allowFailure: true }); return r.status === 0 ? JSON.parse(r.stdout)[0] : undefined; }
const labelArgs = (c, role) => Object.entries(labels(c, role)).flatMap(([key, value]) => ['--label', `${key}=${value}`]);
function osEnvironment() { return Object.fromEntries(['PATH', 'HOME', 'TMPDIR', 'TMP', 'TEMP', 'LANG', 'LC_ALL'].filter(key => process.env[key]).map(key => [key, process.env[key]])); }
function processIdentity(pid) {
  const r = run('ps', ['-p', String(pid), '-o', 'lstart=', '-o', 'command='], { allowFailure: true });
  return r.status === 0 ? r.stdout.trim() : null;
}
function live(record) { return record && processIdentity(record.pid) === record.identity; }
function state() { if (!existsSync(processPath)) return null; assertPrivateFile(processPath); return JSON.parse(readFileSync(processPath, 'utf8')); }
function readConfig() { return loadConfig(configPath, repoRoot); }
function initialize() {
  mkdirSync(directory, { recursive: true, mode: 0o700 }); chmodSync(directory, 0o700);
  if (existsSync(configPath)) return readConfig();
  const dump = join(directory, 'preserved-555-acl.dump'), accountPath = join(directory, 'preserved-555-state.json');
  assertPrivateFile(dump); assertPrivateFile(accountPath);
  if (sha(readFileSync(dump)) !== DUMP_SHA) throw Error('Preserved database archive does not match its verified export');
  const account = JSON.parse(readFileSync(accountPath, 'utf8'));
  if (account.runId !== '555b91e19691' || account.site.siteId !== 'cf45b15f-5910-430d-b140-56af04983e5a') throw Error('Preserved source account refused');
  const sourceRoot = join(directory, 'source'), receipt = JSON.parse(readFileSync(join(sourceRoot, 'marketplace-source-receipt.json'), 'utf8'));
  if (receipt.sourceEpochSha256 !== SOURCE_EPOCH || receipt.maxMigration !== 392) throw Error('Admitted source epoch required');
  for (const row of receipt.files) { if (row.path.startsWith('/') || row.path.split('/').includes('..') || sha(readFileSync(join(sourceRoot, row.path))) !== row.sha256) throw Error('Admitted source changed before local initialization'); }
  const { privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
  const secret = () => randomBytes(32).toString('hex');
  const physicalPath = join(directory, 'preserved-555-physical.tar'), physicalReceiptPath = join(directory, 'preserved-555-physical-receipt.json');
  assertPrivateFile(physicalPath); assertPrivateFile(physicalReceiptPath);
  const physicalReceipt = JSON.parse(readFileSync(physicalReceiptPath, 'utf8'));
  if (physicalReceipt.sourceRun !== account.runId || !physicalReceipt.roleAllowlistVerified || !physicalReceipt.syntheticOwnerPositiveControl || sha(readFileSync(physicalPath)) !== physicalReceipt.sha256) throw Error('Physical source snapshot proof differs');
  privateWrite(configPath, { version: 1, id: randomBytes(6).toString('hex'), repoRoot, sourceRoot, sourceEpoch: SOURCE_EPOCH, dumpSha: DUMP_SHA,
    physicalSha: physicalReceipt.sha256,
    createdAt: new Date().toISOString(), sourceRun: account.runId, siteId: account.site.siteId, subdomain: account.site.subdomain, email: account.email, password: account.password,
    internalSecret: secret(), restSecret: secret(), dbPassword: secret(), cookieSecret: secret(), checkoutSecret: secret(), privateJwk: { ...privateKey.export({ format: 'jwk' }), alg: 'ES256', kid: 'marketplace-local' } });
  if (!existsSync(join(directory, 'account.txt'))) writeFileSync(join(directory, 'account.txt'), `Local synthetic Theme Marketplace account\nSign in: ${ORIGINS.identity}/login\nEmail: ${account.email}\nPassword: ${account.password}\n`, { mode: 0o600, flag: 'wx' });
  return readConfig();
}
function verifiedContainer(c, role) {
  const names = resourceNames(c), object = inspect('container', role === 'postgres' ? names.pg : names.rest);
  if (object) assertContainer(object, c, role, names);
  return object;
}
function sql(c, statement) {
  const object = verifiedContainer(c, 'postgres'); if (!object?.State.Running) throw Error('Owned local Postgres is unavailable');
  return docker(['exec', '-i', resourceNames(c).pg, 'psql', '-U', 'postgres', '-d', DATABASE, '-v', 'ON_ERROR_STOP=1', '-qAt'], { input: statement }).stdout.trim();
}
async function prepareDatabase(c) {
  const names = resourceNames(c);
  for (const image of [PG_IMAGE, REST_IMAGE]) if (docker(['image', 'inspect', image], { allowFailure: true }).status !== 0) throw Error(`Required local image is missing: ${image}. No image was pulled.`);
  for (const [kind, name, role] of [['network', names.network, 'network'], ['volume', names.volume, 'volume']]) {
    const object = inspect(kind, name);
    if (object) assertLabels(object, c, role);
    else docker([kind, 'create', ...labelArgs(c, role), name]);
  }
  let pg = verifiedContainer(c, 'postgres');
  if (!pg) {
    const physicalPath = join(directory, 'preserved-555-physical.tar'); assertPrivateFile(physicalPath);
    if (sha(readFileSync(physicalPath)) !== c.physicalSha) throw Error('Physical archive changed; volume initialization refused');
    const fd = openSync(physicalPath, 'r');
    try { docker(['run', '--rm', '-i', '--pull', 'never', '--name', `${names.pg}-initialize`, ...labelArgs(c, 'initialize'), '--network', 'none', '--memory', '256m', '--cpus', '1', '--pids-limit', '64',
      '--mount', `type=volume,source=${names.volume},target=/var/lib/postgresql/data`, PG_IMAGE, 'sh', '-ec',
      'test -z "$(ls -A /var/lib/postgresql/data)"; tar -xf - -C /var/lib/postgresql/data; chown -R postgres:postgres /var/lib/postgresql/data; chmod 700 /var/lib/postgresql/data'],
      { stdio: [fd, 'pipe', 'pipe'], timeout: 180_000 }); } finally { closeSync(fd); }
    docker(['run', '-d', '--pull', 'never', '--name', names.pg, ...labelArgs(c, 'postgres'), '--network', names.network, '--network-alias', 'pg',
      '--memory', '768m', '--memory-swap', '768m', '--cpus', '1.5', '--pids-limit', '128', '--mount', `type=volume,source=${names.volume},target=/var/lib/postgresql/data`,
      '-p', `127.0.0.1:${PORTS.pg}:5432`, '-e', 'POSTGRES_PASSWORD', PG_IMAGE, '-c', 'jit=off'], { env: { ...osEnvironment(), POSTGRES_PASSWORD: c.dbPassword } });
  } else if (!pg.State.Running) docker(['start', names.pg]);
  const deadline = Date.now() + 60_000;
  while (docker(['exec', names.pg, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres', '-q'], { allowFailure: true }).status !== 0) { if (Date.now() > deadline) throw Error('Local Postgres readiness timed out'); await delay(250); }
  // The image's temporary initialization server has no TCP listener. The probe above waits for its final server.
  const markerExists = sql(c, "SELECT to_regclass('letbuyy_local.marketplace_owner') IS NOT NULL;") === 't';
  if (!markerExists) {
    // This exact physical snapshot retains OIDs pinned by custody guards. Logical
    // restore is intentionally refused by those guards; they are never disabled.
    if (sql(c, "SELECT count(*) FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role','app_tenant','authenticator') AND NOT rolsuper AND NOT rolcreaterole AND NOT rolcreatedb AND NOT rolreplication AND rolbypassrls=(rolname='service_role') AND rolcanlogin=(rolname='authenticator') AND rolinherit=(rolname<>'authenticator');") !== '5') throw Error('Local role profiles differ; restore refused');
    if (sql(c, `SELECT count(*) FROM sites s JOIN users_custom u ON u.id=s.custom_user_id WHERE s.id='${c.siteId}' AND s.subdomain='${c.subdomain}' AND u.email='${c.email}';`) !== '1') throw Error('Physical snapshot owner/store differs');
    sql(c, `ALTER ROLE authenticator PASSWORD '${c.dbPassword}'; CREATE SCHEMA letbuyy_local; CREATE TABLE letbuyy_local.marketplace_owner(id text PRIMARY KEY, source_epoch text NOT NULL, source_run text NOT NULL); INSERT INTO letbuyy_local.marketplace_owner VALUES('${c.id}','${c.sourceEpoch}','${c.sourceRun}'); REVOKE ALL ON SCHEMA letbuyy_local FROM PUBLIC;`);
  }
  if (sql(c, 'SELECT id FROM letbuyy_local.marketplace_owner;') !== c.id) throw Error('Persistent local database marker differs');
  if (sql(c, `SELECT count(*) FROM sites s JOIN users_custom u ON u.id=s.custom_user_id WHERE s.id='${c.siteId}' AND s.subdomain='${c.subdomain}' AND u.email='${c.email}';`) !== '1') throw Error('Persistent synthetic owner/store binding differs');
  if (sql(c, "SELECT count(*) FROM pg_roles WHERE rolname='authenticator' AND rolcanlogin AND NOT rolinherit AND NOT rolsuper AND NOT rolbypassrls AND NOT rolcreaterole AND NOT rolcreatedb;") !== '1') throw Error('Canonical transport authority differs');
  const rest = verifiedContainer(c, 'postgrest');
  if (!rest) docker(['run', '-d', '--pull', 'never', '--name', names.rest, ...labelArgs(c, 'postgrest'), '--network', names.network, '--memory', '256m', '--memory-swap', '256m', '--cpus', '1', '--pids-limit', '128', '--read-only',
    '-p', `127.0.0.1:${PORTS.rest}:3000`, '-e', 'PGRST_DB_URI', '-e', 'PGRST_JWT_SECRET', '-e', 'PGRST_DB_SCHEMAS=public', '-e', 'PGRST_DB_ANON_ROLE=anon', '-e', 'PGRST_DB_EXTRA_SEARCH_PATH=public,extensions', '-e', 'PGRST_DB_POOL=4', '-e', 'PGRST_DB_MAX_ROWS=1000', '-e', 'PGRST_LOG_LEVEL=error', REST_IMAGE],
    { env: { ...osEnvironment(), PGRST_DB_URI: `postgres://authenticator:${c.dbPassword}@pg:5432/${DATABASE}`, PGRST_JWT_SECRET: c.restSecret } });
  else if (!rest.State.Running) docker(['start', names.rest]);
}
async function portFree(port) {
  const server = createServer();
  await new Promise((resolve, reject) => { server.once('error', () => reject(Error(`Port ${port} is occupied; no process was stopped`))); server.listen(port, '127.0.0.1', resolve); });
  await new Promise(resolve => server.close(resolve));
}
async function waitHttp(url, child, predicate = r => r.ok) {
  const deadline = Date.now() + 600_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw Error('Local app exited during startup; inspect private logs');
    try { const r = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(5000) }); if (predicate(r)) { await r.body?.cancel(); return; } await r.body?.cancel(); } catch { /* bounded cold compilation */ }
    await delay(500);
  }
  throw Error('Local app readiness timed out; inspect private logs');
}
async function stopChildren(records) {
  for (const record of records.slice().reverse()) if (live(record)) { try { process.kill(-record.pid, 'SIGTERM'); } catch {} }
  const deadline = Date.now() + 15_000;
  while (records.some(live) && Date.now() < deadline) await delay(100);
  for (const record of records) if (live(record)) { try { process.kill(-record.pid, 'SIGKILL'); } catch {} }
}
function stopContainers(c) {
  for (const role of ['postgrest', 'postgres']) { const object = verifiedContainer(c, role); if (object?.State.Running) docker(['stop', '--time', '10', role === 'postgres' ? resourceNames(c).pg : resourceNames(c).rest]); }
}
async function serve() {
  const c = readConfig();
  if (process.argv[3] !== c.id) throw Error('Local supervisor binding refused');
  const previous = state(); if (previous && live(previous.supervisor)) throw Error('An owned supervisor is already running');
  const metadata = { id: c.id, supervisor: { pid: process.pid, identity: processIdentity(process.pid) }, children: [], status: 'starting', startedAt: new Date().toISOString(), sourceEpoch: c.sourceEpoch, origins: ORIGINS, expiresAt: null };
  const children = [], save = () => privateWrite(processPath, metadata);
  save();
  let stopping = false;
  async function shutdown() { if (stopping) return; stopping = true; metadata.status = 'stopping'; save(); await stopChildren(metadata.children); stopContainers(c); metadata.status = 'stopped'; metadata.stoppedAt = new Date().toISOString(); save(); process.exit(0); }
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => shutdown().catch(() => process.exit(1)));
  function launch(role, binary, args, cwd, extra = {}) {
    const fd = openSync(join(directory, `${role}.log`), 'a', 0o600);
    const child = spawn(binary, args, { cwd, env: { ...osEnvironment(), ...sessionEnvironment(c), ...extra }, detached: true, stdio: ['ignore', fd, fd] }); closeSync(fd);
    children.push(child);
    const record = { role, pid: child.pid, identity: processIdentity(child.pid) }; if (!record.identity) throw Error('Local child identity could not be recorded');
    metadata.children.push(record); save();
    child.on('error', () => shutdown().catch(() => process.exit(1)));
    child.on('exit', () => { if (!stopping && metadata.status === 'ready') shutdown().catch(() => process.exit(1)); });
    return child;
  }
  try {
    for (const port of [PORTS.marketplace, PORTS.api, PORTS.identity, PORTS.merchant, PORTS.commerce]) await portFree(port);
    await prepareDatabase(c);
    const worker = launch('api', process.execPath, ['--import', join(c.sourceRoot, 'node_modules/tsx/dist/loader.mjs'), join(repoRoot, 'scripts/dev/theme-marketplace-worker.mjs')], repoRoot, { LETBUYY_MARKETPLACE_CONFIG: configPath });
    await waitHttp(ORIGINS.api + '/__local_health', worker);
    for (const [role, path, health, extra] of [
      ['identity', 'apps/platform/identity', ORIGINS.identity + '/login', { COOKIE_DOMAIN: 'letbuyy-local.localhost', ACCOUNTS_COOKIE_SECRET: c.cookieSecret, LETBUYY_IDENTITY_PRIVATE_JWK: JSON.stringify(c.privateJwk), NEXT_PUBLIC_TURNSTILE_SITE_KEY: '1x00000000000000000000AA', TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA' }],
      ['merchant', 'apps/merchant/web', ORIGINS.merchant, {}],
      ['commerce', 'apps/commerce/web', ORIGINS.commerce + '/api/buyer-auth/session', {}],
      ['marketplace', 'apps/frozen/theme-store', ORIGINS.marketplace + '/themes', { LETBUYY_API_URL: ORIGINS.api }],
    ]) {
      const cwd = join(c.sourceRoot, path);
      // Only caches in this tool's private source copy can be moved. Preserve old caches for diagnosis.
      if (existsSync(join(cwd, '.next'))) renameSync(join(cwd, '.next'), join(directory, `cache-${role}-${Date.now()}`));
      const child = launch(role, process.execPath, [join(cwd, 'node_modules/next/dist/bin/next'), 'dev', '--webpack', '--hostname', '127.0.0.1', '--port', String(PORTS[role])], cwd, extra);
      await waitHttp(health, child, role === 'merchant' ? r => r.status === 200 || r.status === 307 : role === 'commerce' ? r => r.status === 200 || r.status === 401 : r => r.ok);
      console.log(`[theme-marketplace] ${role} ready`);
    }
    metadata.status = 'ready'; save(); console.log(`[theme-marketplace] Ready: ${ORIGINS.marketplace}/themes (no timed shutdown)`);
    await new Promise(() => {});
  } catch (error) { metadata.failure = error.message; save(); await shutdown(); }
}
async function start() {
  const c = initialize(), current = state();
  if (current?.id === c.id && live(current.supervisor)) { console.log(`${current.status}: ${ORIGINS.marketplace}/themes`); return; }
  if (current?.children?.some(live)) throw Error('Owned children survived their supervisor; run stop before start');
  const lockPath = join(directory, 'start.lock');
  const lock = openSync(lockPath, 'wx', 0o600); closeSync(lock);
  try {
    const fd = openSync(join(directory, 'supervisor.log'), 'a', 0o600);
    const child = spawn(process.execPath, [fileURLToPath(import.meta.url), 'serve', c.id], { cwd: repoRoot, env: osEnvironment(), detached: true, stdio: ['ignore', fd, fd] }); closeSync(fd); child.unref();
    const deadline = Date.now() + 900_000;
    while (Date.now() < deadline) {
      const s = state();
      if (s?.supervisor.pid === child.pid && s.status === 'ready' && live(s.supervisor)) { console.log(`Theme Marketplace: ${ORIGINS.marketplace}/themes\nNo timed shutdown. Data is preserved by stop/start.`); return; }
      if (s?.supervisor.pid === child.pid && s.status === 'stopped') throw Error(s.failure || 'Local startup stopped');
      if (!processIdentity(child.pid)) throw Error('Local supervisor exited; inspect .local/theme-marketplace/supervisor.log');
      await delay(500);
    }
    throw Error('Startup is still pending; run status and inspect private logs');
  } finally { unlinkSync(lockPath); }
}
async function stop() {
  const c = readConfig(), current = state();
  if (current && current.id !== c.id) throw Error('Supervisor resource binding differs');
  if (current && live(current.supervisor)) {
    if (!current.supervisor.identity.includes(fileURLToPath(import.meta.url)) || !current.supervisor.identity.endsWith(`serve ${c.id}`)) throw Error('Supervisor command identity refused');
    process.kill(current.supervisor.pid, 'SIGTERM');
    const deadline = Date.now() + 45_000;
    while (live(current.supervisor) && Date.now() < deadline) await delay(200);
    if (live(current.supervisor)) throw Error('Owned supervisor did not stop; data and process metadata preserved');
  } else { await stopChildren(current?.children ?? []); stopContainers(c); }
  console.log('Theme Marketplace stopped. Database, account and theme library preserved.');
}
async function status() {
  if (!existsSync(configPath)) { console.log('Not configured. Run start to initialize from the private verified local archive.'); return; }
  const c = readConfig(), current = state(); let healthy = false;
  try { const r = await fetch(ORIGINS.api + '/__local_health', { signal: AbortSignal.timeout(2000) }); const body = await r.json(); healthy = r.ok && body.id === c.id && body.sourceEpoch === c.sourceEpoch; } catch {}
  console.log(JSON.stringify({ status: current && live(current.supervisor) ? current.status : 'stopped', url: ORIGINS.marketplace + '/themes', apiHealthy: healthy, expiresAt: null, persistentData: true, dataDirectory: directory }, null, 2));
}
try {
  if (command === 'start') await start(); else if (command === 'stop') await stop(); else if (command === 'restart') { await stop(); await start(); } else if (command === 'status') await status(); else if (command === 'serve') await serve(); else if (command === 'account') {
    const c = readConfig(), path = join(directory, 'account.txt');
    if (!existsSync(path)) writeFileSync(path, `Local synthetic Theme Marketplace account\nSign in: ${ORIGINS.identity}/login\nEmail: ${c.email}\nPassword: ${c.password}\n`, { mode: 0o600, flag: 'wx' });
    assertPrivateFile(path); console.log(`Local synthetic sign-in details: ${path}`);
  } else throw Error('Usage: node scripts/dev/theme-marketplace-local.mjs start|stop|restart|status|account');
} catch (error) { console.error(`[theme-marketplace] ${error.message}`); process.exitCode = 1; }
