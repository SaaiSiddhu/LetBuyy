import assert from 'node:assert/strict';
import test from 'node:test';
import { expect } from '@playwright/test';
import { requireOwnedDatabase } from '../../services/api-gateway/src/__tests__/owned-db/owned-db-support';
import { withConsoleBrowser } from '../../services/api-gateway/src/__tests__/owned-db/console-browser-fixture';
import { newSyntheticTenant, seedSyntheticTenant } from '../../services/api-gateway/src/__tests__/owned-db/synthetic-tenant';
import { tapRest, restJson } from '../../services/api-gateway/src/__tests__/owned-db/gateway-harness';

const owned = requireOwnedDatabase();

test('normal Console login creates and releases one exact Mumbai hold through the web UI',
    { timeout: 300_000 }, async () => {
        const site = newSyntheticTenant('console-kyc-hold');
        seedSyntheticTenant(owned.psql, site);
        const receiptId = crypto.randomUUID();
        const objectKey = `kyc/${site.siteId}/business_pan/${receiptId}`;
        owned.psql(`INSERT INTO kyc_private_object_cleanup_jobs
          (id,site_id,object_key,purpose,storage_provider,document_type,object_version_id,
           deletion_requested_at,next_attempt_at)
          VALUES ('${receiptId}','${site.siteId}','${objectKey}',
           'replaced_object','aws_s3_mumbai','business_pan','synthetic-version',
           now(),now()+interval '1 day');`);
        await withConsoleBrowser(owned, async ({ origin, actors: [operator], login, calls }) => {
            const reason = 'Review synthetic legal preservation evidence';
            const path = `/merchants/${site.siteId}/kyc?reason=${encodeURIComponent(reason)}`;
            await fetch(origin + path, { redirect: 'manual', signal: AbortSignal.timeout(60_000) });
            await fetch(origin + '/api/kyc-holds/action', {
                method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
                body: '{}', signal: AbortSignal.timeout(60_000),
            });
            const { page } = await login(operator);
            await page.emulateMedia({ colorScheme: 'light' });
            await page.goto(origin + path);
            await expect(page.getByRole('heading', { name: 'Preserve an exact receipt' })).toBeVisible();
            await expect(page.getByRole('heading', { name: 'Legal holds' })).toBeVisible();
            await expect(page.getByText(receiptId, { exact: true }).first()).toBeVisible();
            assert.ok(!(await page.locator('body').innerText()).includes(objectKey), 'the private S3 key must not render');
            let readFaults = 0;
            const readOutage = tapRest(owned.restUrl, async (call, forward) => {
                if (call.resource === 'kyc_india_legal_holds' && call.method === 'GET') {
                    readFaults++;
                    return restJson(503, { message: 'synthetic-private-hold-read-fault' });
                }
                return forward();
            });
            try {
                await page.reload();
                await expect(page.getByText('Legal holds unavailable')).toBeVisible();
                await expect(page.getByRole('heading', { name: 'Preserve an exact receipt' })).toHaveCount(0);
                assert.ok(readFaults > 0);
                assert.ok(!(await page.locator('body').innerText()).includes('synthetic-private-hold-read-fault'));
            } finally { readOutage.restore(); }
            await page.getByRole('link', { name: 'Retry legal-hold review' }).click();
            await expect(page.getByRole('heading', { name: 'Preserve an exact receipt' })).toBeVisible();
            await page.getByLabel('Mumbai receipt').selectOption(receiptId);
            await page.getByLabel('Authority reference').fill('SYN-COURT-ORDER-UI-001');
            await page.getByLabel('Reason and exact scope').fill('Preserve one synthetic PAN receipt for a court order');
            const indiaLocal = (days: number) => new Date(Date.now() + days * 86_400_000 + 330 * 60_000)
                .toISOString().slice(0, 16);
            await page.getByLabel('Review by (IST, within 30 days)').fill(indiaLocal(1));
            await page.getByLabel('Authority expiry (IST, within 365 days)').fill(indiaLocal(2));
            let lostCreateReplies = 0;
            const lostReply = tapRest(owned.restUrl, async (call, forward) => {
                if (call.resource === 'rpc/create_kyc_india_legal_hold_v1' && lostCreateReplies === 0) {
                    const committed = await forward();
                    assert.equal(committed.status, 200, 'the database mutation must commit before the reply is lost');
                    lostCreateReplies++;
                    return restJson(503, { message: 'synthetic-hold-reply-lost' });
                }
                return forward();
            });
            try {
                await page.getByRole('button', { name: 'Record exact hold' }).click();
                await expect(page.getByText('The approval operation could not be saved. Retry the same request.')).toBeVisible();
                assert.equal(lostCreateReplies, 1);
                assert.equal(owned.psql(`SELECT count(*) FROM kyc_india_legal_holds
                  WHERE site_id='${site.siteId}' AND receipt_id='${receiptId}';`), '1');
            } finally { lostReply.restore(); }
            await page.getByRole('button', { name: 'Record exact hold' }).click();
            await expect(page.getByText('This exact hold was already recorded.')).toBeVisible();
            assert.equal(owned.psql(`SELECT count(*) FROM kyc_india_legal_holds
              WHERE site_id='${site.siteId}' AND receipt_id='${receiptId}' AND released_at IS NULL;`), '1');
            assert.equal(owned.psql(`SELECT count(*) FROM audit_logs a
              JOIN kyc_india_legal_holds h ON h.id=a.resource_id
              WHERE a.action='kyc.legal_hold.created' AND h.receipt_id='${receiptId}'
                AND a.actor_id='${operator.id}';`), '1');
            assert.ok(calls.some(call => call.path ===
                `/v1/internal/console/kyc/sites/${site.siteId}/receipts/${receiptId}/holds` && call.status === 503));
            assert.ok(calls.some(call => call.path ===
                `/v1/internal/console/kyc/sites/${site.siteId}/receipts/${receiptId}/holds` && call.status === 200));
            await page.setViewportSize({ width: 390, height: 844 });
            await page.emulateMedia({ colorScheme: 'dark' });
            await expect(page.getByRole('button', { name: 'Release exact hold' })).toBeVisible();
            await page.getByLabel('Release reason').fill('Synthetic court order was withdrawn');
            await page.getByRole('button', { name: 'Release exact hold' }).click();
            await expect(page.getByText('The release was recorded and audited. Cleanup may resume.')).toBeVisible();
            assert.equal(owned.psql(`SELECT count(*) FROM kyc_india_legal_holds
              WHERE site_id='${site.siteId}' AND receipt_id='${receiptId}' AND released_at IS NOT NULL;`), '1');
            assert.equal(owned.psql(`SELECT count(*) FROM audit_logs a
              JOIN kyc_india_legal_holds h ON h.id=a.resource_id
              WHERE a.action='kyc.legal_hold.released' AND h.receipt_id='${receiptId}'
                AND a.actor_id='${operator.id}';`), '1');
            assert.ok(calls.some(call => call.path.match(new RegExp(
                `^/v1/internal/console/kyc/sites/${site.siteId}/receipts/${receiptId}/holds/[a-f0-9-]+/release$`))
                && call.status === 200));
            assert.ok(!(await page.locator('body').innerText()).includes(objectKey));
        }, { makerRole: 'super' });
    });
