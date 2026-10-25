import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmThemeInstallReceipt, confirmThemeInstallLibraryReadback, ThemeInstallReceiptSchema } from '../src/theme-install-receipt';
const instance = '7b669c70-f000-4000-8000-000000000001', packageId = '7b669c70-f000-4000-8000-000000000002', versionId = '7b669c70-f000-4000-8000-000000000003';
const receipt = { theme_instance_id: instance, theme_package_id: packageId, theme_package_version_id: versionId, installed_version: '2.0.0', already_installed: false,
    theme: { id: packageId, slug: 'letbuyy-sense', name: 'Threadline', version: '2.0.0' }, installation: { id: instance }, request_metadata: { preserved: true } };
test('actual identity and optional metadata survive first-install and replay receipts', () => {
    for (const already_installed of [false, true]) {
        const wire = { ...receipt, already_installed, release: { id: versionId } };
        assert.deepEqual(confirmThemeInstallReceipt(wire).receipt, wire);
    }
    assert.ok(ThemeInstallReceiptSchema.safeParse({ ...receipt, installation: null }).success, 'existing instance receipts may have no legacy installation row');
});
test('missing, malformed and internally inconsistent identities are never installation success', () => {
    for (const field of ['theme_instance_id', 'theme_package_id', 'theme_package_version_id', 'installed_version', 'already_installed', 'theme']) {
        assert.throws(() => confirmThemeInstallReceipt({ ...receipt, [field]: undefined }));
    }
    for (const wire of [null, {}, { ...receipt, theme_instance_id: 'slug-only' }, { ...receipt, theme: { ...receipt.theme, version: '1.0.0' } },
        { ...receipt, installed_version: ' leading' }, { ...receipt, installation: 'not-json-metadata' }]) assert.throws(() => confirmThemeInstallReceipt(wire));
});
test('each selected expectation is checked independently and UUID casing does not change identity', () => {
    assert.equal(confirmThemeInstallReceipt(receipt, { slug: 'letbuyy-sense', version: '2.0.0', packageId: packageId.toUpperCase(), packageVersionId: versionId }).instanceId, instance);
    for (const expected of [{ slug: 'letbuyy-forge' }, { version: '1.0.0' }, { packageId: instance }, { packageVersionId: packageId }]) assert.throws(() => confirmThemeInstallReceipt(receipt, expected));
});
test('only the exact nonarchived instance/version from an owned library confirms Add', () => {
    const row = { instance_id: instance, slug: 'letbuyy-sense', theme_package_version_id: versionId, instance_status: 'installed', name: 'Threadline' };
    for (const input of [{ themes: [row] }, { data: { themes: [row] } }, { data: [row] }]) assert.deepEqual(confirmThemeInstallLibraryReadback(input, receipt), row);
    for (const rows of [[], [{ ...row, instance_id: packageId }], [{ ...row, slug: 'letbuyy-forge' }], [{ ...row, theme_package_version_id: packageId }], [{ ...row, instance_status: 'archived' }], [{ ...row, instance_status: 'error' }]]) {
        assert.throws(() => confirmThemeInstallLibraryReadback({ themes: rows }, receipt));
    }
});
