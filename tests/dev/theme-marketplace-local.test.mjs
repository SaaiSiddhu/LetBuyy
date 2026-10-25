import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtempSync, writeFileSync, chmodSync, symlinkSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PG_IMAGE, REST_IMAGE, PORTS, ORIGINS, labels, resourceNames, assertLabels, assertContainer, assertPrivateFile, sessionEnvironment } from '../../scripts/dev/theme-marketplace-local-support.mjs';

const c = { id: 'abc123def456', repoRoot: '/owned/checkout', internalSecret: 'synthetic-internal', checkoutSecret: 'synthetic-checkout' };
const names = resourceNames(c);
function container(role) {
  const pg = role === 'postgres';
  return { Config: { Image: pg ? PG_IMAGE : REST_IMAGE, Labels: labels(c, role) }, HostConfig: { Privileged: false, NetworkMode: names.network, PortBindings: { [pg ? '5432/tcp' : '3000/tcp']: [{ HostIp: '127.0.0.1', HostPort: String(pg ? PORTS.pg : PORTS.rest) }] } },
    NetworkSettings: { Networks: { [names.network]: {} } }, Mounts: pg ? [{ Type: 'volume', Name: names.volume, Destination: '/var/lib/postgresql/data' }] : [] };
}
test('only exact persistent resource ownership is accepted; executable and restored stacks are refused', () => {
  assertLabels({ Labels: labels(c, 'volume') }, c, 'volume');
  for (const label of ['com.letbuyy.local-id', 'com.letbuyy.local-checkout', 'com.letbuyy.local-role']) {
    const object = { Labels: { ...labels(c, 'volume'), [label]: 'foreign' } };
    assert.throws(() => assertLabels(object, c, 'volume'), /foreign/);
  }
  for (const forbidden of ['com.letbuyy.executable-fixture', 'com.supabase.project']) assert.throws(() => assertLabels({ Labels: { ...labels(c, 'volume'), [forbidden]: '1' } }, c, 'volume'), /never adopted/);
});
test('both real container shapes are accepted; images and privilege/network changes fail closed', () => {
  for (const role of ['postgres', 'postgrest']) {
    assertContainer(container(role), c, role, names);
    for (const mutate of [x => { x.Config.Image = 'foreign:latest'; }, x => { x.HostConfig.Privileged = true; }, x => { x.HostConfig.NetworkMode = 'host'; }, x => { x.NetworkSettings.Networks.foreign = {}; }]) {
      const object = container(role); mutate(object); assert.throws(() => assertContainer(object, c, role, names));
    }
  }
});
test('host mounts, foreign volumes and REST mounts cannot be used as marketplace storage', () => {
  for (const mutate of [x => { x.Mounts[0].Type = 'bind'; }, x => { x.Mounts[0].Name = 'restored-data'; }, x => { x.Mounts[0].Destination = '/elsewhere'; }]) {
    const object = container('postgres'); mutate(object); assert.throws(() => assertContainer(object, c, 'postgres', names), /mount/);
  }
  const rest = container('postgrest'); rest.Mounts.push({ Type: 'bind' }); assert.throws(() => assertContainer(rest, c, 'postgrest', names), /mount/);
});
test('database transports reject public binding, wrong ports and additional publications', () => {
  for (const mutate of [x => { x.HostConfig.PortBindings['5432/tcp'][0].HostIp = '0.0.0.0'; }, x => { x.HostConfig.PortBindings['5432/tcp'][0].HostPort = '5432'; }, x => { x.HostConfig.PortBindings['8080/tcp'] = [{ HostIp: '127.0.0.1', HostPort: '8080' }]; }]) {
    const object = container('postgres'); mutate(object); assert.throws(() => assertContainer(object, c, 'postgres', names), /loopback/);
  }
});
test('private state refuses symlinks and group/world-readable credentials', () => {
  const directory = mkdtempSync(join(tmpdir(), 'marketplace-local-guard-'));
  try {
    const path = join(directory, 'state.json'); writeFileSync(path, '{}', { mode: 0o600 }); assertPrivateFile(path);
    chmodSync(path, 0o644); assert.throws(() => assertPrivateFile(path), /0600/); chmodSync(path, 0o600);
    const alias = join(directory, 'alias.json'); symlinkSync(path, alias); assert.throws(() => assertPrivateFile(alias), /0600/);
  } finally { rmSync(directory, { recursive: true }); }
});
test('existing apps receive exact local SSO/demo origins, real auth guards and no provider credentials', () => {
  const env = sessionEnvironment(c);
  assert.equal(env.NEXT_PUBLIC_THEME_MARKETPLACE_URL, ORIGINS.marketplace);
  assert.equal(env.NEXT_PUBLIC_ACCOUNTS_URL, ORIGINS.identity);
  assert.equal(env.NEXT_PUBLIC_ADMIN_URL, ORIGINS.merchant);
  assert.equal(env.NEXT_PUBLIC_STOREFRONT_URL, ORIGINS.commerce);
  assert.equal(env.LETBUYY_ENABLE_DEV_AUTH_BYPASS, 'false');
  assert.equal(env.NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS, 'false');
  assert.equal(env.RESEND_API_KEY, ''); assert.equal(env.LETBUYY_EMAIL_API_KEY, '');
  assert.equal(env.SUPABASE_URL, undefined); assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, undefined);
});
