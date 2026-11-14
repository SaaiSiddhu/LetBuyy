import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { withConsoleBrowser } from './console-browser-fixture';
import { requireOwnedDatabase } from './owned-db-support';
import { newSyntheticTenant, seedSyntheticTenant } from './synthetic-tenant';
import { restJson, tapRest } from './gateway-harness';

const owned = requireOwnedDatabase();
type Contrast = { selector: string; text: string; ratio: number };
async function settleVisuals(page: Page) {
    // Wait for finite colour transitions; an in-between theme frame is not
    // the rendered target palette. Infinite activity indicators are excluded.
    await page.evaluate(`Promise.all(document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).map(a => a.finished.catch(() => undefined)))`);
}
async function textContrast(page: Page): Promise<Contrast[]> {
    await settleVisuals(page);
    // Measure actual composed browser colors; canvas resolves CSS color-mix.
    // Fixed selectors and visible synthetic UI only, never account/profile data.
    return page.evaluate(`(() => {
      const canvas=document.createElement('canvas');canvas.width=canvas.height=1;
      const ctx=canvas.getContext('2d');
      const rgba=color=>{ctx.clearRect(0,0,1,1);ctx.fillStyle=color;ctx.fillRect(0,0,1,1);return [...ctx.getImageData(0,0,1,1).data];};
      const blend=(fg,bg)=>{const a=fg[3]/255;return [0,1,2].map(i=>fg[i]*a+bg[i]*(1-a));};
      const luminance=rgb=>rgb.map(v=>{v/=255;return v<=0.04045?v/12.92:Math.pow((v+0.055)/1.055,2.4);}).reduce((a,v,i)=>a+v*[0.2126,0.7152,0.0722][i],0);
      const results=[];
      for(const selector of ['#console-main h1','#console-main h3','#console-main h3 + p','.console-workspace > header > p:last-child','.console-status-pill','.console-metric > p:first-child','.console-metric > p:last-child','.console-check-copy > p','.console-error-panel h2','.console-sidebar nav a','.console-sidebar nav button','.console-sidebar .console-brand strong','.console-sidebar .console-brand strong span','.console-sidebar .console-brand small','.console-sidebar-footer','.console-mobile-modal h2','.console-mobile-modal .console-brand strong','.console-mobile-modal .console-brand small','.console-mobile-group','.console-mobile-modal nav a','.console-mobile-modal nav button','.console-mobile-modal .console-search-trigger','.console-overview-link','.console-filterbar button[type="submit"]']) {
        for(const el of document.querySelectorAll(selector)) {
          if(!el.getClientRects().length || getComputedStyle(el).visibility==='hidden')continue;
          const layers=[];let parent=el;
          while(parent){layers.unshift(rgba(getComputedStyle(parent).backgroundColor));parent=parent.parentElement;}
          let bg=[255,255,255];for(const layer of layers)bg=blend(layer,bg);
          const fg=blend(rgba(getComputedStyle(el).color),bg),a=luminance(fg),b=luminance(bg);
          results.push({selector,text:el.textContent.trim().slice(0,64),ratio:(Math.max(a,b)+0.05)/(Math.min(a,b)+0.05)});
        }
      }
      return results;
    })()`);
}

test('Console shades, readable states, keyboard recovery and responsive merchant workspace', { timeout: 600000 }, async () => {
    const tenant = newSyntheticTenant('ui-refinement');
    seedSyntheticTenant(owned.psql, tenant);
    owned.psql(`DO $$BEGIN FOR n IN 1..27 LOOP INSERT INTO products(store_id,name,price,sku,status,is_active)VALUES('${tenant.siteId}','Synthetic UI product '||n,100+n,'SYN-UI-'||n,'active',true);END LOOP;END$$;`);
    const samples: Record<string, Contrast[]> = {};
    await withConsoleBrowser(owned, async f => {
        const { context, page } = await f.login(f.actors[1]);
        const dir = process.env.LETBUYY_CONSOLE_UI_ARTIFACT_DIR;
        // The main region owns scrolling; capture the actual viewport rather
        // than asking Chromium to expand the fixed-height application shell.
        const capture = async (name: string) => { if (dir) { await mkdir(dir, { recursive: true }); await settleVisuals(page); await page.screenshot({ path: join(dir, name + '.png'), animations: 'disabled' }); } };
        await page.setViewportSize({ width: 1440, height: 1000 });
        await page.goto(f.origin + '/dashboard');
        await expect(page.locator('#console-main h1')).toBeVisible();
        samples.overviewLight = await textContrast(page);
        await capture('overview-light');
        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByRole('button', { name: 'Open navigation', exact: true }).click();
        await expect(page.getByRole('dialog', { name: 'Navigation', exact: true })).toBeVisible();
        samples.mobileLight = await textContrast(page); await capture('navigation-light-390px');
        await page.keyboard.press('Escape');
        await page.setViewportSize({ width: 1440, height: 1000 });
        const finder = page.getByRole('button', { name: 'Find a workspace', exact: true });
        await finder.focus(); await page.keyboard.press('Control+k');
        const search = page.getByRole('dialog', { name: 'Find a workspace', exact: true });
        await expect(search.getByRole('searchbox')).toBeFocused();
        await search.getByRole('searchbox').fill('support');
        await expect(search.getByRole('link')).toHaveCount(1);
        await page.keyboard.press('Escape'); await expect(search).toHaveCount(0); await expect(finder).toBeFocused();
        const account = page.locator('details.console-account');
        await account.locator('summary').click(); await expect(account).toHaveAttribute('open', '');
        await page.keyboard.press('Escape'); await expect(account).not.toHaveAttribute('open', ''); await expect(account.locator('summary')).toBeFocused();
        await account.locator('summary').click(); await page.locator('#console-main h1').click(); await expect(account).not.toHaveAttribute('open', '');
        await page.getByRole('button', { name: 'Change console theme', exact: true }).click();
        await expect(page.locator('.console-design-root')).toHaveAttribute('data-letbuyy-theme', 'dark');
        samples.overviewDark = await textContrast(page);
        await capture('overview-dark');
        await page.goto(f.origin + '/audit-logs?q=synthetic-no-matching-audit-record');
        const emptyHeading = page.getByRole('heading', { name: 'No audit logs matched', exact: true });
        await expect(emptyHeading).toBeVisible(); await emptyHeading.scrollIntoViewIfNeeded();
        samples.emptyDark = await textContrast(page); await capture('audit-empty-dark');
        await page.getByRole('button', { name: 'Change console theme', exact: true }).click();
        await expect(page.locator('.console-design-root')).toHaveAttribute('data-letbuyy-theme', 'light');
        await emptyHeading.scrollIntoViewIfNeeded(); samples.emptyLight = await textContrast(page); await capture('audit-empty-light');
        await page.getByRole('button', { name: 'Change console theme', exact: true }).click();
        await expect(page.locator('.console-design-root')).toHaveAttribute('data-letbuyy-theme', 'dark');
        await page.goto(f.origin + '/revenue');
        await expect(page.getByRole('table')).toBeVisible();
        await settleVisuals(page);
        assert.equal(await page.evaluate(`(() => {
            const el = document.querySelector('#console-main table');
            const wrapper = el.parentElement.parentElement;
            return getComputedStyle(wrapper).backgroundColor === getComputedStyle(wrapper.closest('section')).backgroundColor;
        })()`), true, 'shared table uses the same current surface as its panel');
        await page.getByRole('table').scrollIntoViewIfNeeded();
        await capture('revenue-table-dark');
        await page.getByRole('button', { name: 'Change console theme', exact: true }).click();
        await expect(page.locator('.console-design-root')).toHaveAttribute('data-letbuyy-theme', 'light');
        await page.goto(`${f.origin}/merchants/${tenant.siteId}/operations`);
        await expect(page.getByRole('list', { name: 'Setup steps requiring attention' })).toBeVisible();
        const completed = page.getByText(/^Completed checks \(/);
        await completed.click(); await expect(page.getByRole('list', { name: 'Completed setup checks' })).toBeVisible();
        samples.light = await textContrast(page);
        await capture('merchant-workspace-light');
        await page.getByRole('table').scrollIntoViewIfNeeded();
        await expect(page.locator('tbody tr')).toHaveCount(25);
        await page.getByRole('link', { name: 'Next', exact: true }).click();
        await expect(page).toHaveURL(/page=2/);
        await page.waitForLoadState('networkidle');
        await expect(page.locator('tbody tr')).toHaveCount(2);
        await page.getByRole('table').scrollIntoViewIfNeeded();
        await capture('merchant-catalog-light');
        await page.getByRole('button', { name: 'Change console theme', exact: true }).click();
        await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
        await expect(page.locator('.console-design-root')).toHaveAttribute('data-letbuyy-theme', 'dark');
        await completed.click();
        await page.locator('#console-main h1').scrollIntoViewIfNeeded();
        samples.dark = await textContrast(page); await capture('merchant-workspace-dark');
        for (const width of [390, 320]) {
            await page.setViewportSize({ width, height: 844 });
            assert.equal(await page.evaluate('document.documentElement.scrollWidth > innerWidth'), false, `${width}px document overflow`);
            await capture(`merchant-workspace-dark-${width}px`);
            const openNav = page.getByRole('button', { name: 'Open navigation', exact: true });
            await openNav.click();
            const nav = page.getByRole('dialog', { name: 'Navigation', exact: true });
            await expect(nav).toBeVisible(); samples[`mobileDark${width}`] = await textContrast(page); await capture(`navigation-dark-${width}px`); await page.keyboard.press('Escape'); await expect(nav).toHaveCount(0); await expect(openNav).toBeFocused();
        }
        await page.setViewportSize({ width: 1440, height: 1000 });
        owned.psql(`UPDATE sites SET status='suspended',published=false WHERE id='${tenant.siteId}';`);
        await page.reload();
        await expect(page.locator('.console-design-root')).toHaveAttribute('data-letbuyy-theme', 'dark');
        await expect(page.locator('.console-status-pill').filter({ hasText: 'Restricted' }).first()).toBeVisible();
        samples.restrictedDark = await textContrast(page);
        const tap = tapRest(owned.restUrl, async (call, forward) => call.resource === 'products' ? restJson(503, { message: 'synthetic visual outage' }) : forward());
        try {
            await page.reload();
            await expect(page.locator('.console-design-root')).toHaveAttribute('data-letbuyy-theme', 'dark');
            await expect(page.getByRole('heading', { name: 'Commerce records unavailable', exact: true })).toBeVisible();
            samples.outageDark = await textContrast(page);
            await page.getByRole('heading', { name: 'Commerce records unavailable', exact: true }).scrollIntoViewIfNeeded();
            await capture('merchant-workspace-outage-dark');
        } finally { tap.restore(); }
        if (dir) await writeFile(join(dir, 'measured-text-contrast.json'), JSON.stringify(samples, null, 2) + '\n');
        for (const [mode, values] of Object.entries(samples)) {
            assert.ok(values.length >= 5, mode + ' has actual visible text samples');
            for (const sample of values) assert.ok(sample.ratio >= 4.5, `${mode} ${sample.selector} ${sample.text}: contrast ${sample.ratio.toFixed(2)}`);
        }
        await context.close();
        console.info('OWNED_CONSOLE_UI ' + JSON.stringify({ lightDark: true, viewports: [1440,390,320], keyboardDialogs: true, accountEscapeOutside: true, pagination: true, unavailableState: true, minTextContrast: Math.min(...Object.values(samples).flat().map(v => v.ratio)) }));
    });
});
