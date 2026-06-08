import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const packageRoot = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const update = process.argv.includes('--update');
const staticDir = join(packageRoot, '.tmp-storybook-visual');
const baselineDir = join(packageRoot, 'storybook-screenshots', 'baseline');
const themes = ['light', 'dark'];
const densities = ['compact', 'comfortable', 'spacious'];
const mimeTypes = new Map([
    ['.css', 'text/css; charset=utf-8'],
    ['.html', 'text/html; charset=utf-8'],
    ['.js', 'text/javascript; charset=utf-8'],
    ['.json', 'application/json; charset=utf-8'],
    ['.png', 'image/png'],
    ['.svg', 'image/svg+xml'],
    ['.woff', 'font/woff'],
    ['.woff2', 'font/woff2'],
]);

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

async function assertSameScreenshot(page, expected, actual, label) {
    if (!expected.equals(actual)) {
        const result = await page.evaluate(async ({ expectedUrl, actualUrl }) => {
            const loadImage = (src) => new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = reject;
                image.src = src;
            });
            const [expectedImage, actualImage] = await Promise.all([loadImage(expectedUrl), loadImage(actualUrl)]);
            if (expectedImage.width !== actualImage.width || expectedImage.height !== actualImage.height) {
                return {
                    widthMismatch: true,
                    expectedSize: `${expectedImage.width}x${expectedImage.height}`,
                    actualSize: `${actualImage.width}x${actualImage.height}`,
                    diffPixels: Number.POSITIVE_INFINITY,
                    totalPixels: Math.max(expectedImage.width * expectedImage.height, actualImage.width * actualImage.height),
                };
            }

            const canvas = document.createElement('canvas');
            canvas.width = expectedImage.width;
            canvas.height = expectedImage.height;
            const context = canvas.getContext('2d');
            if (!context) {
                throw new Error('Unable to create canvas context for screenshot comparison');
            }
            context.drawImage(expectedImage, 0, 0);
            const expectedPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(actualImage, 0, 0);
            const actualPixels = context.getImageData(0, 0, canvas.width, canvas.height).data;

            let diffPixels = 0;
            for (let index = 0; index < expectedPixels.length; index += 4) {
                const delta = Math.max(
                    Math.abs(expectedPixels[index] - actualPixels[index]),
                    Math.abs(expectedPixels[index + 1] - actualPixels[index + 1]),
                    Math.abs(expectedPixels[index + 2] - actualPixels[index + 2]),
                    Math.abs(expectedPixels[index + 3] - actualPixels[index + 3]),
                );
                if (delta > 1) diffPixels += 1;
            }

            return {
                widthMismatch: false,
                expectedSize: `${expectedImage.width}x${expectedImage.height}`,
                actualSize: `${actualImage.width}x${actualImage.height}`,
                diffPixels,
                totalPixels: canvas.width * canvas.height,
            };
        }, {
            expectedUrl: `data:image/png;base64,${expected.toString('base64')}`,
            actualUrl: `data:image/png;base64,${actual.toString('base64')}`,
        });

        const diffRatio = result.diffPixels / result.totalPixels;
        if (result.widthMismatch || result.diffPixels > 25 || diffRatio > 0.00005) {
            throw new Error(`Visual regression mismatch for ${label} (${result.diffPixels}/${result.totalPixels} pixels, expected ${result.expectedSize}, actual ${result.actualSize}). Run pnpm --filter @letbuyy/ui test:visual:update to refresh the baseline after reviewing the diff.`);
        }
    }
}

function serveStatic(rootDir) {
    const root = resolve(rootDir);
    const server = createServer((request, response) => {
        const url = new URL(request.url ?? '/', 'http://127.0.0.1');
        const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
        const filePath = resolve(root, `.${pathname}`);

        if (relative(root, filePath).startsWith('..')) {
            response.writeHead(403);
            response.end('Forbidden');
            return;
        }

        if (!existsSync(filePath)) {
            response.writeHead(404);
            response.end('Not found');
            return;
        }

        response.writeHead(200, {
            'Content-Type': mimeTypes.get(extname(filePath)) ?? 'application/octet-stream',
        });
        response.end(readFileSync(filePath));
    });

    return new Promise((resolveServer) => {
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (!address || typeof address === 'string') {
                throw new Error('Unable to start Storybook static server for visual regression');
            }
            resolveServer({
                server,
                origin: `http://127.0.0.1:${address.port}`,
            });
        });
    });
}

function closeServer(server) {
    return new Promise((resolveClose) => {
        server.close(() => resolveClose());
    });
}

async function runVisualRegression() {
    runBuild();
    const storyIds = getStoryIds();
    if (storyIds.length === 0) {
        throw new Error('No Storybook stories found for visual regression');
    }

    mkdirSync(baselineDir, { recursive: true });
    const browser = await chromium.launch();
    const { server, origin } = await serveStatic(staticDir);
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1 });
    page.setDefaultTimeout(15000);
    page.setDefaultNavigationTimeout(15000);
    const iframeUrl = `${origin}/iframe.html`;
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
                    await page.evaluate(() => document.fonts?.ready).catch(() => undefined);
                    await page.waitForTimeout(250);
                    const storybookError = await page.locator('.sb-errordisplay, .sb-error-boundary').first().isVisible().catch(() => false);
                    if (storybookError) {
                        const errorText = await page.locator('.sb-errordisplay, .sb-error-boundary').first().innerText().catch(() => 'Storybook error page rendered');
                        throw new Error(`Storybook rendered an error page for ${label}: ${errorText.split('\n').slice(0, 3).join(' ')}`);
                    }
                    const screenshot = await page.screenshot({ animations: 'disabled', fullPage: true });

                    if (update) {
                        await page.screenshot({ animations: 'disabled', path: baselinePath, fullPage: true });
                    } else if (!existsSync(baselinePath)) {
                        missing.push(label);
                    } else {
                        await assertSameScreenshot(page, readFileSync(baselinePath), screenshot, label);
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
        await closeServer(server);
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
