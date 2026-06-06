import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const packageRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const update = process.argv.includes('--update');
const staticDir = join(packageRoot, '.tmp-storybook-visual');
const baselineDir = join(packageRoot, 'storybook-screenshots', 'baseline');
const themes = ['light', 'dark'];
const densities = ['compact', 'comfortable', 'spacious'];

function runBuild() {
    rmSync(staticDir, { recursive: true, force: true });
    const result = spawnSync('pnpm', ['exec', 'storybook', 'build', '--output-dir', staticDir], {
        cwd: packageRoot,
        env: process.env,
        stdio: 'inherit',
    });

    if (result.status !== 0) {
        throw new Error(`Storybook build failed with status ${result.status ?? 'unknown'}`);
    }
}

function getStoryIds() {
    const indexPath = join(staticDir, 'index.json');
    if (!existsSync(indexPath)) {
        throw new Error(`Storybook index not found at ${indexPath}`);
    }

    const index = JSON.parse(readFileSync(indexPath, 'utf8'));
    return Object.values(index.entries ?? {})
        .filter((entry) => entry.type === 'story')
        .map((entry) => entry.id)
        .sort();
}

function assertSameBuffer(expected, actual, label) {
    if (!expected.equals(actual)) {
        throw new Error(`Visual regression mismatch for ${label}. Run pnpm --filter @letbuyy/ui test:visual:update to refresh the baseline after reviewing the diff.`);
    }
}

async function runVisualRegression() {
    runBuild();
    const storyIds = getStoryIds();
    if (storyIds.length === 0) {
        throw new Error('No Storybook stories found for visual regression');
    }

    mkdirSync(baselineDir, { recursive: true });
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(15000);
    const iframeUrl = pathToFileURL(join(staticDir, 'iframe.html')).toString();
    const missing = [];
    let checked = 0;

    try {
        for (const storyId of storyIds) {
            for (const theme of themes) {
                for (const density of densities) {
                    const label = `${storyId}--${theme}--${density}`;
                    const baselinePath = join(baselineDir, `${label}.png`);
                    const url = `${iframeUrl}?id=${encodeURIComponent(storyId)}&viewMode=story&globals=letbuyyTheme:${theme};letbuyyDensity:${density}`;

                    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
                    await page.waitForLoadState('networkidle', { timeout: 2000 }).catch(() => undefined);
                    await page.waitForTimeout(250);
                    const screenshot = await page.screenshot({ fullPage: true });

                    if (update) {
                        await page.screenshot({ path: baselinePath, fullPage: true });
                    } else if (!existsSync(baselinePath)) {
                        missing.push(label);
                    } else {
                        assertSameBuffer(readFileSync(baselinePath), screenshot, label);
                    }
                    checked += 1;
                    if (checked % 25 === 0) {
                        console.log(`${update ? 'Updated' : 'Checked'} ${checked} visual baseline(s)...`);
                    }
                }
            }
        }
    } finally {
        await browser.close();
        rmSync(staticDir, { recursive: true, force: true });
    }

    if (missing.length > 0) {
        throw new Error(`Missing ${missing.length} visual baseline(s). Run pnpm --filter @letbuyy/ui test:visual:update. First missing: ${missing[0]}`);
    }

    console.log(`${update ? 'Updated' : 'Checked'} ${checked} Storybook visual baseline(s) across ${themes.length} themes and ${densities.length} densities.`);
}

runVisualRegression().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
});
