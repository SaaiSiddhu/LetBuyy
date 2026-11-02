import assert from 'node:assert/strict';
import test, { after } from 'node:test';
import { randomUUID } from 'node:crypto';
import { closePooledSqlClients } from '@letbuyy/infrastructure/pooled-sql-adapter';
import { LiquidThemePackageBundleSchema } from '@letbuyy/theme-engine';
import { buildProposal, canonicalJson } from '../../../../../docs/implementation/niche-theme-programme/release-v210/generate-release';
import { Gateway, gatewayEnv, newIdentityKeys, signedIdentityHeaders } from './gateway-harness';
import { requireOwnedDatabase, startOwnedPooledSqlProxy, type OwnedPooledSqlProxy } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();
const proposal = buildProposal();
const quote = (value: string) => `'${value.replaceAll("'", "''")}'`;
const record = (value: unknown): Record<string, unknown> => {
  assert(value && typeof value === 'object' && !Array.isArray(value));
  return value as Record<string, unknown>;
};
let gateway: Gateway | undefined;
let proxy: OwnedPooledSqlProxy | undefined;
after(async () => { await gateway?.settle(); await closePooledSqlClients(); await proxy?.stop(); });

test('all nine 2.1.0 catalog themes install, save, publish and retain immutable buyer releases under owned tenancy', async () => {
  const ownerStore = newSyntheticTenant('niche-v210-owner');
  const otherStore = newSyntheticTenant('niche-v210-other');
  seedSyntheticTenant(owned.psql, ownerStore);
  seedSyntheticTenant(owned.psql, otherStore);
  const owner = randomUUID(), other = randomUUID();
  const email = `v210-${owner}@example.invalid`, otherEmail = `v210-${other}@example.invalid`;
  owned.psql(`INSERT INTO users_custom(id,email,email_verified) VALUES(${quote(owner)},${quote(email)},true),(${quote(other)},${quote(otherEmail)},true);
    UPDATE sites SET custom_user_id=${quote(owner)},theme_id='letbuyy-core' WHERE id=${quote(ownerStore.siteId)};
    UPDATE sites SET custom_user_id=${quote(other)},theme_id='letbuyy-core' WHERE id=${quote(otherStore.siteId)};
    INSERT INTO subscriptions(user_id,store_id,plan,status) VALUES(${quote(owner)},${quote(ownerStore.siteId)},'enterprise','active'),(${quote(other)},${quote(otherStore.siteId)},'enterprise','active');`);
  proxy = await startOwnedPooledSqlProxy(owned);
  gateway = new Gateway(gatewayEnv(owned, await newIdentityKeys(), proxy.env()));
  const request = async (path: string, method = 'GET', body?: unknown, foreign = false) => {
    const response = await gateway!.request(path, { method,
      headers: await signedIdentityHeaders(foreign ? other : owner, foreign ? otherEmail : email,
        foreign ? otherStore.siteId : ownerStore.siteId),
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    await gateway!.settle();
    return response;
  };
  const data = (response: Awaited<ReturnType<typeof request>>) => record(response.json?.data);
  const immutableCapture = owned.psql(`SELECT md5(coalesce(jsonb_agg(jsonb_build_object('slug',p.slug,'version',v.version,
    'package',v.package_manifest) ORDER BY p.slug,v.version)::text,'[]')) FROM theme_packages p
    JOIN theme_package_versions v ON v.theme_package_id=p.id WHERE p.slug LIKE 'letbuyy-%' AND v.version IN ('2.0.0','2.1.0');`);
  const releaseIds: string[] = [];
  for (const artifact of proposal.artifacts) {
    const selected = JSON.parse(owned.psql(`SELECT jsonb_build_object('package',p.id,'version',v.id)::text
      FROM theme_packages p JOIN theme_package_versions v ON v.theme_package_id=p.id
      WHERE p.slug=${quote(artifact.slug)} AND v.version='2.1.0' AND v.release_status='published' AND v.deleted_at IS NULL;`)) as { package: string; version: string };
    const base = `/v1/themes/${artifact.slug}`;
    const intent = { store_id: ownerStore.siteId, expected_version: '2.1.0', expected_package_id: selected.package,
      expected_package_version_id: selected.version };
    const denied = await request(base + '/install', 'POST', intent, true);
    assert.equal(denied.status, 403, `${artifact.slug}: ${denied.text}`);
    const installed = await request(base + '/install', 'POST', intent);
    assert.equal(installed.status, 201, `${artifact.slug}: ${installed.text}`);
    assert.equal(data(installed).installed_version, '2.1.0');
    assert.equal(data(installed).theme_package_version_id, selected.version);
    const editor = await request(base + `/editor?store_id=${ownerStore.siteId}`);
    assert.equal(editor.status, 200, `${artifact.slug}: ${editor.text}`);
    const initial = data(editor), config = record(initial.template_config);
    const bundle = LiquidThemePackageBundleSchema.parse(config.liquidBundle);
    assert.equal(bundle.package.version, '2.1.0');
    assert.equal(canonicalJson(bundle), canonicalJson(artifact.document.liquidBundle));
    const saved = await request(base + '/editor/draft', 'PUT', { store_id: ownerStore.siteId, template_key: 'index',
      template_config: config, base_version: initial.version, idempotency_key: randomUUID() });
    assert.equal(saved.status, 200, `${artifact.slug}: ${saved.text}`);
    const reloaded = await request(base + `/editor?store_id=${ownerStore.siteId}`);
    assert.equal(reloaded.status, 200, `${artifact.slug}: ${reloaded.text}`);
    assert.equal(canonicalJson(data(reloaded).template_config), canonicalJson(config));
    const published = await request(base + '/publish', 'POST', { store_id: ownerStore.siteId,
      base_version: data(saved).version, idempotency_key: randomUUID(), make_store_live: true });
    assert.equal(published.status, 200, `${artifact.slug}: ${published.text}`);
    const release = JSON.parse(owned.scriptLarge(`SELECT jsonb_build_object('id',r.id,'version_id',r.theme_package_version_id,
      'snapshot',r.template_snapshot)::text FROM sites s JOIN theme_releases r ON r.id=s.current_theme_release_id
      WHERE s.id=${quote(ownerStore.siteId)};`)) as { id: string; version_id: string; snapshot: { liquidBundle: unknown } };
    assert.equal(release.version_id, selected.version);
    assert.equal(canonicalJson(release.snapshot.liquidBundle), canonicalJson(bundle));
    releaseIds.push(release.id);
  }
  assert.equal(new Set(releaseIds).size, 9, 'each publication creates its own immutable release');
  assert.equal(owned.psql(`SELECT count(*) FROM theme_releases WHERE store_id=${quote(ownerStore.siteId)};`), '9');
  assert.equal(owned.psql(`SELECT count(*) FROM theme_releases WHERE store_id=${quote(otherStore.siteId)};`), '0');
  assert.equal(owned.psql(`SELECT md5(coalesce(jsonb_agg(jsonb_build_object('slug',p.slug,'version',v.version,
    'package',v.package_manifest) ORDER BY p.slug,v.version)::text,'[]')) FROM theme_packages p
    JOIN theme_package_versions v ON v.theme_package_id=p.id WHERE p.slug LIKE 'letbuyy-%' AND v.version IN ('2.0.0','2.1.0');`), immutableCapture);
  console.info('NICHE428_EDITOR', JSON.stringify({ runId: owned.runId, installed: 9, saved: 9,
    published: releaseIds.length, foreignInstallsDenied: 9, immutableCapturePreserved: true }));
});
