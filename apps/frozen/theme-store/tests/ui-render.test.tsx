import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { LetbuyyThemeProvider, ThemeToggleButton } from '@letbuyy/ui';
import type { Theme } from '@letbuyy/theme-engine';
import AnonymousPreviewShell, { getAnonymousPreviewFrameSrc } from '../src/components/anonymous-preview-shell';
import DeveloperListingBuilderForm from '../src/components/developer-listing-builder-form';
import {
    ThemeChangelog,
    ThemeDetailSharePanel,
    ThemeLiveDemoEmbed,
    ThemeQualityFacts,
} from '../src/components/theme-detail-experience';
import ThemeCategoryLanding from '../src/components/theme-category-landing';
import ThemeCard from '../src/components/theme-card';
import ThemeShowcase from '../src/components/theme-showcase';
import PolicyDraftPage from '../src/components/policy-draft-page';
import { MARKETPLACE_GUIDES, MARKETPLACE_FAQS, findMarketplaceGuide } from '../src/lib/marketplace-content';
import { MARKETPLACE_POLICIES, policySectionId } from '../src/lib/marketplace-policies';
import { clearSavedThemeChoices, FAVORITES_KEY, COMPARE_KEY } from '../src/lib/browser-preferences';
import CatalogFilterPanel from '../src/components/catalog-filter-panel';
import ThemeDemo from '../src/components/theme-demo';
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

test('marketplace theme control keeps identical initial markup for server and saved browser preferences', () => {
    const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
    const renderControl = () => renderToStaticMarkup(
        <LetbuyyThemeProvider surface="marketplace">
            <ThemeToggleButton unstyled className="tm-icon-button" label="Toggle color theme" />
        </LetbuyyThemeProvider>,
    ).match(/<button\b[\s\S]*?<\/button>/)?.[0];

    try {
        Reflect.deleteProperty(globalThis, 'window');
        const serverMarkup = renderControl();
        assert.ok(serverMarkup);
        for (const preference of ['light', 'dark', 'system']) {
            for (const systemDark of [false, true]) {
                Object.defineProperty(globalThis, 'window', { configurable: true, value: {
                    localStorage: { getItem: () => preference },
                    matchMedia: () => ({ matches: systemDark }),
                    __letbuyyResolvedTheme: preference === 'system' ? (systemDark ? 'dark' : 'light') : preference,
                } });
                assert.equal(renderControl(), serverMarkup, `${preference}, system dark=${systemDark}`);
            }
        }
        assert.match(serverMarkup, /aria-label="Toggle color theme"/);
    } finally {
        if (originalWindow) Object.defineProperty(globalThis, 'window', originalWindow);
        else Reflect.deleteProperty(globalThis, 'window');
    }
});

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

test('theme card renders linked facets, relative update, compare, preview, and a quick-look trigger', () => {
    const html = renderToStaticMarkup(<ThemeCard theme={baseTheme} initialQuickLookOpen renderPreviewImages={false} />);

    assert.ok(html.includes(`href="${themeFacetHref('tag', 'minimal')}"`));
    assert.ok(html.includes(`href="${themeFacetHref('feature', 'Mobile cart')}"`));
    assert.match(html, /Updated (today|[0-9]+ days? ago|[0-9]+ months? ago|[0-9]+ years? ago)/);
    assert.ok(html.includes(`href="${themeCompareSingleHref(baseTheme.slug)}"`));
    assert.ok(html.includes(`href="${themeSandboxPreviewHref(baseTheme.slug, baseTheme.version).replaceAll('&', '&amp;')}"`));
    assert.match(html, /aria-haspopup="dialog"/);
    assert.match(html, /Quick look/);
    assert.match(html, /Compare Urban Kicks/);
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
    assert.match(demoHtml, /src="[^"]+\/theme-preview\/urban-kicks\?version=1\.2\.0&amp;embedded=1"/);
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
    assert.doesNotMatch(html, /devtoken|Token:/);
    assert.match(html, /data-testid="anonymous-preview-iframe"/);
    assert.match(html, /src="[^"]+\/theme-preview\/urban-kicks\?version=1\.2\.0&amp;embedded=1"/);
});

test('anonymous demo ignores arbitrary frame URLs and never turns the token into authority', () => {
    const target = getAnonymousPreviewFrameSrc('private-token', { ...baseTheme, demo_url: 'https://untrusted.invalid/collect', preview_url: 'javascript:alert(1)' });
    assert.ok(target?.endsWith('/theme-preview/urban-kicks?version=1.2.0&embedded=1'));
    assert.doesNotMatch(target!, /untrusted|private-token|javascript/);
    assert.equal(getAnonymousPreviewFrameSrc('private-token'), null);
    assert.equal(getAnonymousPreviewFrameSrc('private-token', { ...baseTheme, slug: '../private' }), null);
    for (const version of ['', ' leading', 'invalid\nversion', 'x'.repeat(41)]) assert.equal(getAnonymousPreviewFrameSrc('', { ...baseTheme, version }), null);
    const unavailable = renderToStaticMarkup(<AnonymousPreviewShell token="private-token" />);
    assert.match(unavailable, /Demo unavailable/);
    assert.doesNotMatch(unavailable, /private-token|<iframe/);
});

test('detail embed uses the configured exact package preview and rejects an unverified version', () => {
    const html = renderToStaticMarkup(<ThemeLiveDemoEmbed theme={{ ...baseTheme, demo_url: 'https://untrusted.invalid/collect' }} />);
    assert.match(html, /theme-preview\/urban-kicks\?version=1\.2\.0/);
    assert.doesNotMatch(html, /untrusted|allow-popups/);
    const invalid = renderToStaticMarkup(<ThemeLiveDemoEmbed theme={{ ...baseTheme, version: '' }} />);
    assert.match(invalid, /Demo unavailable/); assert.doesNotMatch(invalid, /<iframe/);
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
    assert.match(catalog, /<CatalogFilterPanel/);
    const filters = readAppFile('src/components/catalog-filter-panel.tsx');
    assert.match(filters, /data-testid="mobile-theme-filter-sheet"/);
    assert.match(filters, /<Drawer title="Filter and sort themes"/);
    assert.doesNotMatch(catalog, /Open developer console/);
    assert.doesNotMatch(catalog, /Build and submit themes/);
});

test('home and sitemap expose catalog navigation and responsive theme grids', () => {
    const home = readAppFile('src/app/page.tsx');
    const sitemap = readAppFile('src/app/sitemap.ts');
    const globals = readAppFile('src/app/globals.css');

    assert.match(home, /marketplace-theme-grid/);
    assert.match(home, /href=\{`\/themes\?category=\$\{category\.slug\}`\}/);
    assert.match(sitemap, /\/themes\/category\/\$\{category\}/);
    assert.match(globals, /@import "\.\/marketplace\.css"/);
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

test('non-renderable catalog records show an unavailable demo instead of a broken frame', () => {
    assert.equal(getAnonymousPreviewFrameSrc('', { ...baseTheme, demoAvailable: false }), null);
    const html = renderToStaticMarkup(<ThemeLiveDemoEmbed theme={baseTheme} available={false} />);
    assert.match(html, /Demo unavailable/);
    assert.doesNotMatch(html, /<iframe/);
});

test('catalog filter form preserves every supported field and an explicit zero price', () => {
    const html = renderToStaticMarkup(<CatalogFilterPanel
        values={{query:'minimal',category:'store',pricing:'one_time',sort:'recent',industry:'fashion',layout:'grid',tag:'minimal',feature:'Mobile cart',priceMin:0,priceMax:4999}}
        industries={['fashion']} categories={[{value:'store',label:'Online stores'}]}
        pricing={[{value:'paid',label:'Paid'}]} layouts={['grid']}
        sorting={[{value:'recent',label:'Newest'}]} activeCount={8}
    />);
    for (const field of ['q','sort','category','pricing','industry','layout','price_min','price_max','feature','tag']) {
        assert.match(html, new RegExp(`name="${field}"`));
    }
    assert.match(html, /name="price_min"[^>]*value="0"/);
    assert.match(html, /name="price_max"[^>]*value="4999"/);
    assert.match(html, /value="paid" selected=""/);
    assert.match(html, /Filter and sort/);
    assert.match(html, /action="\/themes" method="get"/);
});

test('demo controls expose device state and keep embedded preview authority constrained', () => {
    const html = renderToStaticMarkup(<ThemeDemo src="http://localhost:9000/theme-preview/example?version=2.0.0&embedded=1" name="Example" />);
    assert.match(html, /aria-label="Desktop preview"[^>]*aria-pressed="true"/);
    assert.match(html, /aria-label="Mobile preview"[^>]*aria-pressed="false"/);
    assert.match(html, /sandbox="allow-same-origin allow-scripts allow-forms"/);
    assert.match(html, /referrerPolicy="no-referrer"/i);
    assert.doesNotMatch(html, /allow-popups|allow-top-navigation/);
});

test('privacy action clears only browser shortlist keys and propagates storage failure', () => {
    const values = new Map([[FAVORITES_KEY,'["example"]'],[COMPARE_KEY,'["example"]'],['letbuyy-theme','dark'],['lb_session','untouched']]);
    clearSavedThemeChoices({ removeItem: key => { values.delete(key); } });
    assert.equal(values.has(FAVORITES_KEY), false);
    assert.equal(values.has(COMPARE_KEY), false);
    assert.equal(values.get('letbuyy-theme'), 'dark');
    assert.equal(values.get('lb_session'), 'untouched');
    assert.throws(() => clearSavedThemeChoices({ removeItem: () => { throw new Error('blocked'); } }), /blocked/);
});

test('legal documents render review status, all paragraphs, and valid contents anchors', () => {
    for (const document of MARKETPLACE_POLICIES) {
        const html = renderToStaticMarkup(<PolicyDraftPage document={document} />);
        assert.match(html, /Review copy/);
        assert.match(html, /Not effective terms/);
        assert.match(html, /marketplace-review-2026-10-26/);
        const ids = document.sections.map(section => policySectionId(section.title));
        assert.equal(new Set(ids).size, ids.length, document.slug);
        for (const id of ids) {
            assert.ok(html.includes(`href="#${id}"`), `${document.slug}: missing contents link`);
            assert.ok(html.includes(`id="${id}"`), `${document.slug}: missing section`);
        }
    }
});

test('learning content links resolve to published routes or a known guide/document', () => {
    const guideSlugs = new Set(MARKETPLACE_GUIDES.map(guide=>guide.slug));
    const policySlugs = new Set(MARKETPLACE_POLICIES.map(policy=>policy.slug));
    assert.equal(findMarketplaceGuide('not-a-guide'), undefined);
    for (const guide of MARKETPLACE_GUIDES) {
        assert.equal(new Set(guide.sections.map(section=>section.id)).size,guide.sections.length);
        for (const related of guide.related) assert.ok(guideSlugs.has(related),related);
    }
    for (const faq of MARKETPLACE_FAQS) {
        if (faq.href.startsWith('/guides/')) assert.ok(guideSlugs.has(faq.href.slice('/guides/'.length)),faq.href);
        if (faq.href.startsWith('/legal/')) assert.ok(policySlugs.has(faq.href.slice('/legal/'.length)),faq.href);
    }
});

test('homepage lookbook renders opposite rows, noninteractive duplicate artwork and an accessible pause control', () => {
    const html = renderToStaticMarkup(<ThemeShowcase />);
    assert.match(html, /aria-label="Animated sample theme lookbook"/);
    assert.match(html, /data-direction="left"/);
    assert.match(html, /data-direction="right"/);
    assert.equal((html.match(/class="marketplace-showcase-group"[^>]*aria-hidden="true"/g) || []).length, 2);
    assert.match(html, /aria-label="Pause theme animation"[^>]*aria-pressed="false"/);
    assert.match(html, /Sample design inspiration/);
    assert.doesNotMatch(html, /<iframe|href="\/themes\//);
    const home = readAppFile('src/app/page.tsx');
    assert.ok(home.indexOf('<ThemeShowcase />') < home.indexOf('<section className="marketplace-hero">'));
    assert.match(home, /Search themes, styles, or features/);
    assert.match(home, /Start with a free theme/);
});
