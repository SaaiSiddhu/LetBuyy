import assert from 'node:assert/strict';
import test from 'node:test';
import { expect } from '@playwright/test';
import { requireOwnedDatabase } from './owned-db-support';
import { withConsoleBrowser } from './console-browser-fixture';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';

const owned = requireOwnedDatabase();

test('signed-in Console reviewer sees redacted KYC evidence and downloads only after a clean scan', async () => {
    const tenant = newSyntheticTenant('kyc-review-ui');
    seedSyntheticTenant(owned.psql, tenant);
    const documentId = crypto.randomUUID();
    const privateKey = `kyc/${tenant.siteId}/business_pan/${crypto.randomUUID()}`;
    owned.psql(`INSERT INTO merchant_kyc_documents(id,site_id,document_type,status,provider,provider_mode,
        document_number_last4,metadata) VALUES ('${documentId}','${tenant.siteId}','business_pan','submitted',
        'letbuyy_sandbox_kyc','sandbox','1234',
        '{"private_object_key":"${privateKey}","sha256":"private-digest","content_type":"application/pdf","malware_scan_status":"pending"}'::jsonb);`);
    const bucket = { get: async (key: string) => {
        assert.equal(key, privateKey);
        return { body: new Blob(['%PDF-1.7\nsynthetic-clean-file']).stream() };
    } } as unknown as R2Bucket;
    await withConsoleBrowser(owned, async ({ origin, actors: [reviewer], login, calls }) => {
        const { page } = await login(reviewer!);
        await page.goto(`${origin}/merchants/${tenant.siteId}`);
        await page.getByRole('link', { name: 'Review KYC evidence' }).click();
        await expect(page.getByRole('heading', { name: 'KYC evidence review' })).toBeVisible();
        await page.getByLabel('Reason', { exact: true }).fill('Reviewing submitted PAN evidence');
        await page.getByRole('button', { name: 'Review documents' }).click();
        await expect(page.getByText('business pan')).toBeVisible();
        await expect(page.getByText('no scan result')).toBeVisible();
        await expect(page.getByRole('link', { name: 'Download evidence' })).toHaveCount(0);
        assert.ok(!await page.locator('body').innerText().then(text => text.includes(privateKey) || text.includes('private-digest')));

        // A synthetic trusted scanner verdict in the owned database; no real
        // malware scanner or production review approval is implied.
        owned.psql(`UPDATE merchant_kyc_documents SET metadata=jsonb_set(metadata,'{malware_scan_status}','"clean"'::jsonb)
            WHERE id='${documentId}';`);
        await page.reload();
        await expect(page.getByText('scan clean')).toBeVisible();
        const downloadStarted = page.waitForEvent('download');
        await page.getByRole('link', { name: 'Download evidence' }).click();
        const download = await downloadStarted;
        assert.equal(download.suggestedFilename(), 'kyc-evidence.pdf');
        assert.ok(calls.some(call => call.path === `/v1/internal/console/kyc/sites/${tenant.siteId}/documents/${documentId}/file` && call.status === 200));
        assert.equal(owned.psql(`SELECT count(*) FROM audit_logs WHERE action='kyc.evidence.download'
            AND resource_id='${documentId}' AND metadata->>'reason'='Reviewing submitted PAN evidence';`), '1');
    }, { makerRole: 'super', kycPrivateBucket: bucket });
});
