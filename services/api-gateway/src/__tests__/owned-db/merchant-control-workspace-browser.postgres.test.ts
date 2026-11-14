import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { expect } from '@playwright/test';
import { withConsoleBrowser } from './console-browser-fixture';
import { requireOwnedDatabase } from './owned-db-support';
import {
    newSyntheticTenant,
    seedSyntheticTenant,
    seedSyntheticOrder,
} from './synthetic-tenant';
import { tapRest, restJson } from './gateway-harness';
const owned = requireOwnedDatabase();
test(
    'normal MFA operator navigates merchant products, filters, order snapshots and SaaS source failure',
    { timeout: 360000 },
    async () => {
        const site = newSyntheticTenant('control-browser');
        seedSyntheticTenant(owned.psql, site);
        const order = seedSyntheticOrder(owned.psql, site);
        const foreign = newSyntheticTenant('control-foreign');
        seedSyntheticTenant(owned.psql, foreign);
        const other = seedSyntheticOrder(owned.psql, foreign);
        owned.psql(`DO $$BEGIN FOR n IN 1..26 LOOP INSERT INTO products(store_id,name,price,sku,status,is_active)
        VALUES('${site.siteId}','Synthetic control product '||n,100+n,'SYN-CONTROL-'||n,CASE WHEN n=26 THEN 'archived' ELSE 'active' END,n<>26);END LOOP;END$$;`);
        await withConsoleBrowser(
            owned,
            async (f) => {
                const { context, page } = await f.login(f.actors[1]);
                await page.goto(f.origin + '/merchants/' + site.siteId);
                await page
                    .getByRole('link', {
                        name: 'Open merchant operations: catalog, orders and SaaS limits',
                        exact: true,
                    })
                    .click();
                await expect(
                    page.getByRole('heading', {
                        name: 'SaaS access and limits',
                        exact: true,
                    }),
                ).toBeVisible();
                await expect(page.locator('#console-main [role=alert]')).toHaveCount(0);
                await expect(page.locator('tbody tr')).toHaveCount(25);
                await page
                    .getByRole('link', { name: 'Next', exact: true })
                    .click();
                await expect(page).toHaveURL(/page=2/);
                await expect(page.locator('tbody tr')).toHaveCount(2);
                await page
                    .getByLabel('Product name', { exact: true })
                    .fill('control product 26');
                await page
                    .getByLabel('Status', { exact: true })
                    .selectOption('archived');
                await page
                    .getByRole('button', { name: 'Apply filters', exact: true })
                    .click();
                await expect(page.locator('tbody tr')).toHaveCount(1);
                await expect(
                    page.getByText('Synthetic control product 26', {
                        exact: true,
                    }),
                ).toBeVisible();
                await page
                    .getByRole('link', { name: 'Orders', exact: true })
                    .click();
                await page.getByLabel('Status', { exact: true }).selectOption('pending_cod');
                await page.getByRole('button', { name: 'Apply filters', exact: true }).click();
                await expect(page.locator('tbody tr')).toHaveCount(1);
                const number = owned.psql(
                    `SELECT order_number FROM orders WHERE id='${order.orderId}';`,
                );
                await page
                    .getByRole('link', { name: number, exact: true })
                    .click();
                await expect(
                    page.getByRole('heading', {
                        name: 'Order ' + number,
                        exact: true,
                    }),
                ).toBeVisible();
                await expect(
                    page.getByText('Synthetic Seed Product', { exact: true }),
                ).toBeVisible();
                assert.doesNotMatch(
                    await page.locator('#console-main').innerText(),
                    /syn-seed-buyer|9000000099/,
                );
                await page.goto(
                    f.origin +
                        `/merchants/${site.siteId}/operations?view=orders&order=${other.orderId}`,
                );
                await expect(
                    page.getByRole('heading', {
                        name: 'Order snapshot unavailable',
                        exact: true,
                    }),
                ).toBeVisible();
                await expect(
                    page.getByText('Synthetic Seed Product', { exact: true }),
                ).toHaveCount(0);
                const tap = tapRest(owned.restUrl, async (call, forward) =>
                    call.resource === 'rpc/resolve_site_entitlements'
                        ? restJson(503, { message: 'synthetic SaaS outage' })
                        : forward(),
                );
                try {
                    await page.goto(
                        f.origin + `/merchants/${site.siteId}/operations`,
                    );
                    await expect(
                        page.getByText(
                            'Effective SaaS permissions are unavailable. No plan grant is inferred.',
                            { exact: true },
                        ),
                    ).toBeVisible();
                    await expect(page.locator('tbody tr')).toHaveCount(25);
                } finally {
                    tap.restore();
                }
                await page.reload();
                await expect(page.locator('#console-main [role=alert]')).toHaveCount(0);
                const dir =
                    process.env.LETBUYY_MERCHANT_OPERATIONS_ARTIFACT_DIR;
                if (dir) {
                    await mkdir(dir, { recursive: true });
                    await page.screenshot({
                        path: join(dir, 'merchant-operations-desktop.png'),
                        fullPage: true,
                    });
                }
                await page.setViewportSize({ width: 390, height: 844 });
                assert.equal(
                    await page.evaluate(
                        'document.documentElement.scrollWidth>window.innerWidth',
                    ),
                    false,
                );
                if (dir)
                    await page.screenshot({
                        path: join(dir, 'merchant-operations-390px.png'),
                        fullPage: true,
                    });
                await context.close();
            },
            { makerRole: 'super' },
        );
    },
);
