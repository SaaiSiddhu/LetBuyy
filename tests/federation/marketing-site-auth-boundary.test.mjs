import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

const appRoot = 'apps/marketing-site';
const sourceRoot = join(appRoot, 'src');
const skippedDirs = new Set(['.next', '.turbo', 'coverage', 'dist', 'node_modules']);

function read(path) {
  return readFileSync(path, 'utf8');
}

function sourceFiles(dir) {
  return readdirSync(dir).flatMap((entry) => {
    if (skippedDirs.has(entry)) return [];

    const path = join(dir, entry);
    const stats = statSync(path);

    if (stats.isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx|js|jsx|mjs|cjs)$/.test(entry) ? [path] : [];
  });
}

test('marketing site has no local auth API or credential handling surface', () => {
  assert.equal(existsSync(join(appRoot, 'src/app/api/auth')), false);
  assert.equal(existsSync(join(appRoot, 'src/app/login')), false);
  assert.equal(existsSync(join(appRoot, 'src/app/register')), false);

  const offenders = [];
  for (const file of sourceFiles(sourceRoot)) {
    const source = read(file);
    if (/type=["']password["']|createSession|setSessionCookie|verifyOtp|password_hash|signInWithOAuth|@supabase\//i.test(source)) {
      offenders.push(file);
    }
  }

  assert.deepEqual(offenders, []);
});

test('marketing signup route is a redirect shim to the identity platform', () => {
  const signupPage = read(join(appRoot, 'src/app/signup/page.tsx'));
  const createPage = read(join(appRoot, 'src/app/create/page.tsx'));
  const publicUrls = read(join(appRoot, 'src/lib/public-urls.ts'));
  const packageJson = JSON.parse(read(join(appRoot, 'package.json')));

  assert.match(publicUrls, /NEXT_PUBLIC_ACCOUNTS_URL/);
  assert.match(signupPage, /getAccountsUrl\('\/signup'\)/);
  assert.match(signupPage, /window\.location\.href = getAccountsUrl\('\/signup'\)/);
  assert.doesNotMatch(signupPage, /<form|type=["']password["']|POST\(/i);
  assert.match(createPage, /getAccountsUrl\('\/signup'\)/);
  assert.match(createPage, /window\.location\.href = `\$\{getAccountsUrl\('\/signup'\)\}\?\$\{params\.toString\(\)\}`/);
  assert.equal(packageJson.dependencies['@letbuyy/auth-core'], undefined);
  assert.equal(packageJson.dependencies['jose'], undefined);
});

test('marketing site exposes crawlable platform app navigation and sitemaps', () => {
  const header = read(join(appRoot, 'src/components/Header.tsx'));
  const footer = read(join(appRoot, 'src/components/Footer.tsx'));
  const layout = read(join(appRoot, 'src/app/layout.tsx'));
  const robots = read(join(appRoot, 'src/app/robots.ts'));
  const sitemap = read(join(appRoot, 'src/app/sitemap.ts'));
  const sitemapPage = read(join(appRoot, 'src/app/sitemap/page.tsx'));
  const directory = read(join(appRoot, 'src/components/PlatformDirectory.tsx'));
  const platformLinks = read(join(appRoot, 'src/lib/platform-links.ts'));
  const publicUrls = read(join(appRoot, 'src/lib/public-urls.ts'));

  for (const marker of [
    'NEXT_PUBLIC_THEME_MARKETPLACE_URL',
    'NEXT_PUBLIC_APP_MARKETPLACE_URL',
    'NEXT_PUBLIC_DEVELOPER_PORTAL_URL',
  ]) {
    assert.match(publicUrls, new RegExp(marker));
  }

  assert.match(platformLinks, /getThemeMarketplaceUrl\('\/sitemap\.xml'\)/);
  assert.match(platformLinks, /getAppMarketplaceUrl\('\/sitemap\.xml'\)/);
  assert.match(platformLinks, /getDeveloperPortalUrl\('\/sitemap\.xml'\)/);
  assert.match(robots, /getPlatformSitemapUrls/);
  assert.match(sitemap, /\/sitemap/);
  assert.match(layout, /SiteNavigationElement/);
  assert.match(header, /label: 'Themes'/);
  assert.match(header, /label: 'Apps'/);
  assert.match(header, /label: 'Developers'/);
  assert.match(footer, /getPlatformNavigationLinks/);
  assert.match(directory, /platform-directory/);
  assert.match(sitemapPage, /XML sitemaps/);
});

test('marketplace robots and sitemaps derive canonical URLs from the request host', () => {
  for (const app of ['app-marketplace', 'theme-marketplace']) {
    const root = join('apps', app, 'src');
    const requestOrigin = read(join(root, 'lib/platform-request-origin.ts'));
    const robots = read(join(root, 'app/robots.ts'));
    const sitemap = read(join(root, 'app/sitemap.ts'));

    assert.match(requestOrigin, /from 'next\/headers'/);
    assert.match(requestOrigin, /x-forwarded-host/);
    assert.match(requestOrigin, /letbuyy\.com/);
    assert.match(robots, /getPlatformRequestOrigin/);
    assert.match(robots, /appendOriginPath\(origin, '\/sitemap\.xml'\)/);
    assert.match(sitemap, /getPlatformRequestOrigin/);
    assert.match(sitemap, /appendOriginPath\(origin, path\)/);
  }
});
