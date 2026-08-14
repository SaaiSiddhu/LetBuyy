import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { Theme } from '@letbuyy/theme-engine';
import AnonymousPreviewShell from '../src/components/anonymous-preview-shell';
import DeveloperListingBuilderForm from '../src/components/developer-listing-builder-form';
import {
    ThemeChangelog,
    ThemeDetailSharePanel,
    ThemeLiveDemoEmbed,
    ThemeQualityFacts,
} from '../src/components/theme-detail-experience';
import ThemeCategoryLanding from '../src/components/theme-category-landing';
import ThemeCard from '../src/components/theme-card';
import { buildThemeShareUrl } from '../src/components/theme-share-button';
import {
    formatRelativeUpdatedAt,
    getThemeFreshnessBadge,
    isCommandSearchShortcut,
    themeCompareSingleHref,
    themeFacetHref,
    themeSandboxPreviewHref,
} from '../src/lib/utils';

Reflect.set(globalThis, 'React', React);

const appRoot = join(process.cwd());
const testControls = {
    Input: ({ unstyled: _unstyled, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { unstyled?: boolean }) => {
        void _unstyled;
        return React.createElement('input', props);
    },
    Button: ({ unstyled: _unstyled, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement> & { unstyled?: boolean }) => {
        void _unstyled;
        return React.createElement('button', props);
    },
};

const baseTheme: Theme = {
    id: 'theme-urban-kicks',
    slug: 'urban-kicks',
    name: 'Urban Kicks',
    description: 'A retail storefront theme for sneaker drops.',
    long_description: 'A retail storefront theme for sneaker drops and editorial product storytelling.',
    category: 'store',
    industry: ['fashion', 'retail'],
    theme_preset_id: 'urban-kicks-default',
    version: '1.2.0',
    is_active: true,
    letbuyy_pricing_type: 'one_time',
    letbuyy_price_usd: 0,
    letbuyy_price_inr: 4999,
    wordpress_price_usd: 0,
    shopify_price_usd: 0,
    html_price_usd: 0,
    react_price_usd: 0,
    thumbnail_url: '/previews/store.png',
    preview_url: '/previews/store.png',
    screenshots: ['/previews/store.png'],
    demo_url: '/preview/urban-kicks?theme=urban-kicks',
    customizable_sections: {},
    color_presets: [{ name: 'Drop', colors: { primary: 'var(--lb-color-text)', accent: 'var(--lb-color-warning)' } }],
    font_options: ['Inter'],
    author_id: 'author-1',
    author_name: 'LetBuyy Samples',
    tags: ['minimal', 'streetwear', 'conversion'],
    features: ['Mobile cart', 'Product stories'],
    supported_platforms: ['letbuyy', 'html', 'react'],
    rating: 4.7,
    review_count: 3,
    install_count: 14,
    download_count: 2,
    purchase_count: 5,
    published_at: '2026-06-01T00:00:00.000Z',
    created_at: '2026-06-01T00:00:00.000Z',
    updated_at: '2026-06-06T00:00:00.000Z',
    performance_report: {
        measured_at: '2026-06-06T00:00:00.000Z',
        source: 'lhci-local',
        lighthouse_performance: 91,
        status: 'measured',
    },
    accessibility_report: {
        measured_at: '2026-06-06T00:00:00.000Z',
        source: 'axe-local',
        lighthouse_accessibility: 96,
        status: 'measured',
    },
    compatibility: {
        browsers: ['latest-chrome', 'latest-safari'],
        locales: ['en-IN'],
        platforms: ['letbuyy', 'react'],
        minimum_viewport: '360px',
    },
    changelog: [
        {
            version: '1.2.0',
            released_at: '2026-06-06T00:00:00.000Z',
            changes: ['Improved product media', 'Added mobile drawer polish'],
        },
    ],
};

function readAppFile(pathFromAppRoot: string) {
    return readFileSync(join(appRoot, pathFromAppRoot), 'utf8');
}

test('theme card renders linked facets, freshness, relative update, compare, preview, and quick-look dialog', () => {
    const html = renderToStaticMarkup(<ThemeCard theme={baseTheme} initialQuickLookOpen renderPreviewImages={false} />);

    assert.ok(html.includes(`href="${themeFacetHref('tag', 'minimal')}"`));
    assert.ok(html.includes(`href="${themeFacetHref('feature', 'Mobile cart')}"`));
    assert.match(html, /New|Updated/);
    assert.match(html, /Updated (today|[0-9]+ days? ago|[0-9]+ months? ago|[0-9]+ years? ago)/);
    assert.ok(html.includes(`href="${themeCompareSingleHref(baseTheme.slug)}"`));
    assert.ok(html.includes(`href="${themeSandboxPreviewHref(baseTheme.slug)}"`));
    assert.match(html, /role="dialog"/);
    assert.match(html, /Compare this theme/);
});

test('theme card freshness helpers suppress stale badges and keep relative update honest', () => {
    const now = new Date('2026-06-08T00:00:00.000Z');

    assert.equal(getThemeFreshnessBadge(baseTheme, now), 'New');
    assert.equal(getThemeFreshnessBadge({
        published_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-20T00:00:00.000Z',
    }, now), null);
    assert.equal(formatRelativeUpdatedAt('2026-06-07T00:00:00.000Z', now), 'Updated 1 day ago');
});

test('detail page enrichment components render demo iframe, measured scores, compatibility, changelog, and share control', () => {
    const demoHtml = renderToStaticMarkup(<ThemeLiveDemoEmbed theme={baseTheme} />);
    const qualityHtml = renderToStaticMarkup(<ThemeQualityFacts theme={baseTheme} />);
    const changelogHtml = renderToStaticMarkup(<ThemeChangelog theme={baseTheme} />);
    const shareHtml = renderToStaticMarkup(<ThemeDetailSharePanel theme={baseTheme} />);

    assert.match(demoHtml, /data-testid="theme-live-demo-iframe"/);
    assert.match(demoHtml, /src="\/preview\/urban-kicks\?theme=urban-kicks"/);
    assert.match(qualityHtml, /data-testid="theme-performance-score"[^>]*>91</);
    assert.match(qualityHtml, /data-testid="theme-accessibility-score"[^>]*>96</);
    assert.match(qualityHtml, /latest-chrome, latest-safari/);
    assert.match(qualityHtml, /360px/);
    assert.match(changelogHtml, /v1.2.0/);
    assert.match(changelogHtml, /Improved product media/);
    assert.match(shareHtml, /Copy link/);
    assert.equal(buildThemeShareUrl(baseTheme.slug), '/themes/urban-kicks');
});

test('anonymous preview shell renders without a store-owned preview session', () => {
    const html = renderToStaticMarkup(<AnonymousPreviewShell token="devtoken" theme={baseTheme} />);

    assert.match(html, /Anonymous sandbox/);
    assert.match(html, /Sandbox store preview/);
    assert.match(html, /Token: devtoken/);
    assert.match(html, /data-testid="anonymous-preview-iframe"/);
    assert.match(html, /src="\/preview\/urban-kicks\?theme=urban-kicks"/);
});

test('developer listing builder renders the distinct create-listing form fields', () => {
    const html = renderToStaticMarkup(<DeveloperListingBuilderForm controls={testControls} />);

    assert.match(html, /data-testid="developer-listing-builder-form"/);
    for (const field of ['name="name"', 'name="slug"', 'name="short_description"', 'name="zip_url"', 'name="screenshots"', 'name="asset_urls"', 'name="pricing_type"', 'name="license_standard"', 'name="license_extended"', 'name="agreement_accepted"']) {
        assert.match(html, new RegExp(field));
    }
    assert.match(html, /Submit for review now/);
});

test('category landing component renders category copy and a filtered theme grid', () => {
    const html = renderToStaticMarkup(<ThemeCategoryLanding category="store" themes={[baseTheme]} total={1} renderCardImages={false} />);

    assert.match(html, /Store Themes/);
    assert.match(html, /Retail-ready storefront themes/);
    assert.match(html, /Urban Kicks/);
    assert.match(html, /1 theme available/);
});

test('command search shortcut and route source expose the expected UI hooks', () => {
    assert.equal(isCommandSearchShortcut({ key: 'k', metaKey: true, ctrlKey: false }), true);
    assert.equal(isCommandSearchShortcut({ key: 'K', metaKey: false, ctrlKey: true }), true);
    assert.equal(isCommandSearchShortcut({ key: 'j', metaKey: true, ctrlKey: false }), false);

    const catalog = readAppFile('src/app/themes/page.tsx');
    assert.match(catalog, /data-testid="mobile-theme-filter-sheet"/);
    assert.match(catalog, /lg:hidden/);
    assert.match(catalog, /hidden flex-col gap-\[var\(--lb-density-section-gap\)\] lg:flex/);
    assert.doesNotMatch(catalog, /Open developer console/);
    assert.doesNotMatch(catalog, /Build and submit themes/);
});

test('home and sitemap source expose responsive bento, category landing links, and ultra-wide layout', () => {
    const home = readAppFile('src/app/page.tsx');
    const sitemap = readAppFile('src/app/sitemap.ts');
    const globals = readAppFile('src/app/globals.css');

    assert.match(home, /grid grid-cols-1 gap-\[10px\] sm:grid-cols-2/);
    assert.match(home, /href=\{`\/themes\/category\/\$\{cat\.slug\}`\}/);
    assert.match(sitemap, /\/themes\/category\/\$\{category\}/);
    assert.match(globals, /@media \(min-width: 1536px\)/);
});

test('legacy app chrome aliases now resolve through shared lb design tokens and raw img elements are gone', () => {
    const globals = readAppFile('src/app/globals.css');
    const rawImageFiles = [
        'src/app/page.tsx',
        'src/app/dashboard/page.tsx',
        'src/components/layout/navbar.tsx',
    ];

    assert.match(globals, /\.glass-card[\s\S]*--lb-component-card-bg/);
    assert.match(globals, /\.btn-primary[\s\S]*--lb-component-button-primary-bg/);
    assert.match(globals, /\.btn-secondary[\s\S]*--lb-component-button-secondary-bg/);

    for (const file of rawImageFiles) {
        assert.doesNotMatch(readAppFile(file), /<img\b/);
    }
});
