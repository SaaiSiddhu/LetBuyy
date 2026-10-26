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
import ThemeCategoryLanding, { isThemeCategorySlug } from '../src/components/theme-category-landing';
import ThemeCard from '../src/components/theme-card';
import ThemeShowcase from '../src/components/theme-showcase';
import MarketplaceHero from '../src/components/marketplace-hero';
import MarketplaceThemeJourney from '../src/components/marketplace-theme-journey';
import MarketplaceContentPage, { ResourceGrid } from '../src/components/marketplace-content-page';
import MarketplacePageHeader from '../src/components/marketplace-page-header';
import MarketplaceArticleContents from '../src/components/marketplace-article-contents';
import Footer from '../src/components/layout/footer';
import ThemeStyleGallery from '../src/components/theme-style-gallery';
import ThemeDevicePreview from '../src/components/theme-device-preview';
import MarketplaceMobileMenu from '../src/components/marketplace-mobile-menu';
import CreatorGuidancePage from '../src/app/for-creators/page';
import MarketplaceContactForm, { prepareContactEmail } from '../src/components/marketplace-contact-form';
import ContactPage from '../src/app/contact/page';
import ThemeDetailHero from '../src/components/theme-detail-hero';
import MarketplaceArtwork, { artworkForHref } from '../src/components/marketplace-artwork';
import PolicyDraftPage from '../src/components/policy-draft-page';
import { MARKETPLACE_GUIDES, MARKETPLACE_FAQS, DISCOVERY_PATHS, findMarketplaceGuide } from '../src/lib/marketplace-content';
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

test('detail page enrichment retains optional demo destination, measured facts, changelog, and share control', () => {
    const demoHtml = renderToStaticMarkup(<ThemeLiveDemoEmbed theme={baseTheme} />);
    const qualityHtml = renderToStaticMarkup(<ThemeQualityFacts theme={baseTheme} />);
    const changelogHtml = renderToStaticMarkup(<ThemeChangelog theme={baseTheme} />);
    const shareHtml = renderToStaticMarkup(<ThemeDetailSharePanel theme={baseTheme} />);

    assert.doesNotMatch(demoHtml, /<iframe/);
    assert.match(demoHtml, /Load interactive preview/);
    assert.match(demoHtml, /href="[^"]+\/theme-preview\/urban-kicks\?version=1\.2\.0&amp;embedded=1"/);
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

    assert.match(html, /Available designs/);
    assert.match(html, /Follow the shopping journey/);
    assert.match(html, /Urban Kicks/);
    assert.match(html, /1 published theme/);
    assert.match(html, /category-selection-checks/);
    assert.match(html, /Find a collection/);
    assert.match(html, /Understand the product/);
    assert.match(html, /Follow the mobile journey/);
    assert.match(html, /href="\/guides\/choose-the-right-theme"/);
    assert.match(html, /catalog-device-phone/);
    assert.doesNotMatch(html, /class="marketplace-checklist"/);
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
    assert.match(readAppFile('src/components/marketplace-hero.tsx'), /href=\{`\/themes\?category=\$\{category\.slug\}`\}/);
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
    assert.doesNotMatch(html, /marketplace-showcase-label|>Pause<|>Play<|>Motion reduced</);
    assert.match(html, /lucide-pause/);
    assert.doesNotMatch(html, /<iframe|href="\/themes\//);
    const home = readAppFile('src/app/page.tsx');
    assert.match(home, /<MarketplaceHero \/>/);
    const hero = renderToStaticMarkup(<MarketplaceHero />);
    assert.match(hero, /class="marketplace-hero-stage"/);
    assert.match(hero, /marketplace-hero-copy/);
    assert.doesNotMatch(hero, /marketplace-hero-panel/);
    assert.match(hero, /aria-labelledby="marketplace-hero-heading"/);
    assert.match(hero, /action="\/themes" method="get"/);
    assert.match(hero, /<input(?=[^>]*id="home-theme-search")(?=[^>]*name="q")[^>]*>/);
    assert.match(hero, /Search themes, styles, or features/);
    assert.match(hero, /Start with a free theme/);
    assert.match(hero, /href="\/themes\?pricing=free"/);
    assert.match(hero, /aria-label="Browse theme categories"/);
    assert.match(hero, /aria-label="Pause theme animation"/);
    assert.doesNotMatch(hero, /marketplace-home-preview|Illustrative sample layout/);
});

test('illustrated theme journey offers real guide destinations without exposing mock editor controls', () => {
    const html = renderToStaticMarkup(<MarketplaceThemeJourney />);
    assert.match(html, /<section[^>]+aria-labelledby="how-it-works"/);
    assert.match(html, /<ol class="journey-steps">/);
    assert.equal((html.match(/class="journey-art journey-art-[^"]+" aria-hidden="true"/g) || []).length, 3);
    const guideLinks = [...html.matchAll(/href="\/guides\/([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(guideLinks, ['choose-the-right-theme', 'install-and-publish', 'before-you-publish']);
    for (const slug of guideLinks) assert.ok(findMarketplaceGuide(slug), slug);
    assert.doesNotMatch(html, /<button|<input|<iframe/);
    assert.doesNotMatch(readAppFile('src/app/page.tsx'), /marketplace-benefits/);
});

test('editorial resource cards keep destinations and use specific named actions', () => {
    const items = [
        { title: 'Explore collections', description: 'Find a starting point.', href: '/collections' },
        { title: 'Theme pricing', description: 'Understand your purchase.', href: '/pricing' },
        { title: 'Your library', description: 'Return to saved themes.', href: '/dashboard' },
    ];
    const html = renderToStaticMarkup(<ResourceGrid items={items} />);
    assert.doesNotMatch(html, /Read more/);
    for (const item of items) assert.match(html, new RegExp(`href="${item.href}"`));
    assert.match(html, /aria-label="Explore collections: Explore collections"/);
    assert.match(html, /aria-label="Understand pricing: Theme pricing"/);
    assert.match(html, /aria-label="Open your library: Your library"/);
    for (const kind of ['discover', 'legal', 'library']) assert.ok(html.includes(`marketplace-artwork-${kind}`));
    assert.equal((html.match(/data-illustration="website-design"/g) || []).length, 3);
});

test('article and catalog header compositions retain a single page title and real actions', () => {
    const article = renderToStaticMarkup(<MarketplaceContentPage title="Privacy information" intro="Review the document." artwork="legal"><p>Document body</p></MarketplaceContentPage>);
    assert.equal((article.match(/<h1\b/g) || []).length, 1);
    assert.match(article, /Document body/);
    assert.match(article, /marketplace-artwork-legal/);
    const header = renderToStaticMarkup(<MarketplacePageHeader title="Theme collection" artwork="discover" primaryAction={{ label: 'Browse themes', href: '/themes' }} />);
    assert.equal((header.match(/<h1\b/g) || []).length, 1);
    assert.match(header, /href="\/themes"/);
    assert.match(header, /marketplace-artwork-discover/);
    assert.equal(artworkForHref('/guides/install-and-publish'), 'create');
    assert.equal(artworkForHref('/guides/before-you-publish'), 'library');
    assert.equal(artworkForHref('/legal/privacy'), 'legal');
    assert.equal(artworkForHref('/contact'), 'support');
});


test('website illustrations depict photographic storefronts and editor layouts without fake controls or 3D artwork', () => {
    for (const kind of ['discover', 'create', 'learn', 'support', 'legal', 'library'] as const) {
        const html = renderToStaticMarkup(<MarketplaceArtwork kind={kind} />);
        assert.match(html, /aria-hidden="true" data-illustration="website-design"/);
        assert.match(html, /Illustrative sample layout/);
        assert.doesNotMatch(html, /<button|<input|<a\b|\/illustrations\//);
        if (kind !== 'support') assert.match(html, /%2Fshowcase%2F|\/showcase\//);
        if (kind === 'create') assert.match(html, /Theme editor/);
        if (kind === 'library') assert.match(html, /theme-scene-phone/);
    }
});

test('article contents retain anchor destinations in compact native mobile and desktop navigation', () => {
    const guide = MARKETPLACE_GUIDES[0];
    const html = renderToStaticMarkup(<MarketplaceArticleContents items={guide.sections} label="In this guide" backHref="/guides" backLabel="All theme guides" />);
    assert.match(html, /<details class="marketplace-contents-mobile">/);
    assert.doesNotMatch(html, /<details[^>]*\bopen/);
    assert.match(html, /<summary>/);
    for (const section of guide.sections) assert.equal(html.split(`href="#${section.id}"`).length - 1, 2);
    assert.match(html, /href="\/guides"/);
    assert.match(html, new RegExp(`${guide.sections.length} sections`));
});

test('compact footer preserves legal/privacy access and four collapsed mobile link groups', () => {
    const html = renderToStaticMarkup(<Footer />);
    assert.equal((html.match(/<details>/g) || []).length, 4);
    assert.doesNotMatch(html, /<details[^>]*\bopen/);
    for (const path of ['/legal/terms', '/legal/privacy', '/legal/license', '/legal/refund', '/support', '/dashboard', '/for-creators']) assert.ok(html.includes(`href="${path}"`), path);
    assert.match(html, /Privacy choices/);
    assert.match(html, /mailto:/);
});

test('theme spotlight retains the actual theme and its preview/quick-look actions', () => {
    const html = renderToStaticMarkup(<ThemeCard theme={baseTheme} featured renderPreviewImages={false} />);
    assert.match(html, /marketplace-theme-spotlight/);
    assert.match(html, /marketplace-card-content/);
    assert.match(html, /Urban Kicks/);
    assert.match(html, /Open Urban Kicks theme details/);
    assert.match(html, /Quick look/);
    assert.match(html, /Preview/);
});

test('style gallery distinguishes one published preset from illustrative studies and keeps selection local', () => {
    const html = renderToStaticMarkup(<ThemeStyleGallery theme={{ ...baseTheme, slug: 'letbuyy-core', name: 'LetBuyy Core', theme_preset_id: 'letbuyy-core-default' }} />);
    assert.equal((html.match(/type="radio"/g) || []).length, 4);
    assert.equal((html.match(/data-selected="true"/g) || []).length, 1);
    assert.match(html, /1 published preset/);
    assert.match(html, /3 style studies/);
    assert.match(html, /theme-style-device-top/);
    assert.match(html, /theme-style-screen/);
    assert.match(html, /aria-label="Next style"/);
    const previous = (html.match(/<button\b[^>]*>/g) || []).find(button => button.includes('aria-label="Previous style"'));
    assert.ok(previous && /\bdisabled/.test(previous));
    assert.doesNotMatch(html, /theme-style-selected|theme-style-selection-detail/);
    assert.match(html, /Style studies are visual inspiration/);
    assert.match(html, /href="\/themes\/letbuyy-core"/);
    assert.doesNotMatch(html, /Use this preset|Install this style|ready-made designs/);
});

test('catalog device carousel uses actual media, deduplicates screenshots and exposes frame controls', () => {
    const html = renderToStaticMarkup(<ThemeDevicePreview theme={{...baseTheme, screenshots:[baseTheme.thumbnail_url, '/previews/another-screen.png']}} />);
    assert.match(html, /Urban Kicks screenshot carousel/);
    assert.equal((html.match(/aria-roledescription="slide"/g) || []).length, 3);
    assert.match(html, /catalog-device-phone/);
    assert.match(html, /catalog-device-desktop/);
    assert.match(html, /aria-label="Screenshot frame"/);
    assert.match(html, /Listing images in device frames/);
    assert.match(html, /Previous Urban Kicks screenshot/);
    assert.match(html, /Next Urban Kicks screenshot/);
    assert.doesNotMatch(html, /<iframe/);
    const empty = renderToStaticMarkup(<ThemeDevicePreview theme={{name:'Empty media', thumbnail_url:'', screenshots:[]}} />);
    assert.equal((empty.match(/Screenshot unavailable/g) || []).length, 2);
    assert.doesNotMatch(empty, /<img/);
});

test('catalog card keeps real detail/preview and shortlist actions within its device presentation', () => {
    const html = renderToStaticMarkup(<ThemeCard theme={baseTheme} devicePreview renderPreviewImages={false} />);
    assert.match(html, /marketplace-catalog-card/);
    assert.match(html, /catalog-device-phone/);
    assert.match(html, /catalog-device-desktop/);
    assert.match(html, /href="\/themes\/urban-kicks"/);
    assert.match(html, /Explore theme/);
    assert.match(html, /Quick look/);
    assert.match(html, /Save|Saved/);
    assert.match(html, /Compare/);
    assert.match(html, /Version/);
});

test('compact mobile menu keeps destinations inside native expandable groups', () => {
    const html = renderToStaticMarkup(<MarketplaceMobileMenu pathname="/guides" onNavigate={()=>undefined} groups={[
        {key:'browse',label:'Browse themes',links:[{label:'All themes',href:'/themes'},{label:'Online stores',href:'/themes?category=store'}]},
        {key:'learn',label:'Learn',links:[{label:'Theme guides',href:'/guides'},{label:'Legal and privacy',href:'/legal'}]},
        {key:'library',label:'My themes',links:[{label:'Downloads',href:'/dashboard/downloads'}]},
    ]} />);
    assert.equal((html.match(/<details>/g)||[]).length, 3);
    assert.doesNotMatch(html, /<details[^>]*\bopen/);
    for(const href of ['/themes','/themes?category=store','/guides','/legal','/dashboard/downloads','/support','/contact'])assert.ok(html.includes(`href="${href}"`),href);
    const activeLink = (html.match(/<a\b[^>]*>/g) || []).find(link=>link.includes('href="/guides"'));
    assert.ok(activeLink?.includes('aria-current="page"'));
});

test('creator handbook preserves preparation, approval boundaries and real workspace destinations', () => {
    const html = renderToStaticMarkup(<CreatorGuidancePage />);
    assert.equal((html.match(/<h1\b/g)||[]).length, 1);
    assert.match(html, /Prepare your theme for review/);
    assert.match(html, /id="creator-checklist"/);
    assert.match(html, /href="#creator-checklist"/);
    for(const title of ['Package essentials','Screenshots &amp; presentation','Quality &amp; usability','Rights &amp; ongoing support'])assert.ok(html.includes(title),title);
    for(const href of ['/developer','/developer/listings/new','/docs/api','/legal/creator-agreement','/contact'])assert.ok(html.includes(`href="${href}"`),href);
    assert.match(html, /payout arrangements require separate approval/);
    assert.match(html, /submitted record is not automatically a published theme/);
    assert.match(html, /aria-label="Preparation guidance"/);
});

test('contact email preparation validates fields and safely encodes a reviewable draft', () => {
    const fields = {name:'Sam',email:'sam@example.test',topic:'installation',theme:'Core & Everyday',reference:'ref-123',message:'My theme is not appearing in the library after adding it.'};
    const result = prepareContactEmail(fields,'support@example.test');
    assert.ok(result.ok);
    const url = new URL(result.draft.url);
    assert.equal(url.protocol,'mailto:');
    assert.equal(url.pathname,'support@example.test');
    assert.equal(url.searchParams.size,2);
    assert.match(url.searchParams.get('subject')!,/Core & Everyday/);
    assert.match(url.searchParams.get('body')!,/Reply email: sam@example.test/);
    assert.match(url.searchParams.get('body')!,/ref-123/);
    const invalid = prepareContactEmail({...fields,name:'',email:'bad',topic:'invented',message:'short'},'support@example.test');
    assert.equal(invalid.ok,false);
    if(!invalid.ok)for(const key of ['name','email','topic','message'])assert.ok(key in invalid.errors);
    assert.equal(prepareContactEmail({...fields,reference:'ref\nBcc: other@example.test'},'support@example.test').ok,false);
    assert.equal(prepareContactEmail(fields,'support@example.test?bcc=other@example.test').ok,false);
});

test('contact form offers labelled fields and truthful email preparation without a backend submission', () => {
    const html = renderToStaticMarkup(<MarketplaceContactForm recipient="support@example.test"/>);
    for(const name of ['name','email','topic','theme','reference','message'])assert.ok(html.includes(`name="${name}"`));
    assert.match(html,/Prepare email/);
    assert.match(html,/review and send it in your email app/);
    assert.match(html,/href="\/legal\/privacy"/);
    assert.match(html,/<fieldset disabled=""/);
    assert.match(html,/<noscript>/);
    assert.doesNotMatch(html,/Message sent|request received|method="post"/);
    const page = renderToStaticMarkup(<ContactPage/>);
    assert.equal((page.match(/<h1\b/g)||[]).length,1);
    for(const href of ['/support','/faq','/legal','/legal/grievance'])assert.ok(page.includes(`href="${href}"`));
});

test('theme detail introduction uses listing media and clear library/preview/compare actions', () => {
    const html = renderToStaticMarkup(<ThemeDetailHero theme={baseTheme} addHref="/install?theme=urban-kicks&amp;version=1.2.0" addLabel="Add to library"/>);
    assert.equal((html.match(/<h1\b/g)||[]).length,1);
    assert.match(html,/catalog-device-phone/);
    assert.match(html,/catalog-device-desktop/);
    assert.match(html,/href="#demo"/);
    assert.match(html,/Add to library/);
    assert.match(html,/Compare/);
    assert.match(html,/Version/);
    assert.doesNotMatch(html,/Illustrative sample layout|theme-scene/);
    const unavailable = renderToStaticMarkup(<ThemeDemo src={null} name="Theme" defer/>);
    assert.match(unavailable,/Demo unavailable/);
    assert.match(unavailable,/Ask about this theme/);
    assert.doesNotMatch(unavailable,/<iframe|Desktop preview|Maximize demo/);
});

test('appearance toggle is composed once in the page footer and absent from header and drawer', () => {
    const navbar = readAppFile('src/components/layout/navbar.tsx');
    const layout = readAppFile('src/app/layout.tsx');
    assert.doesNotMatch(navbar, /<ThemeToggleButton/);
    assert.equal((layout.match(/<ThemeToggleButton\b/g)||[]).length, 1);
    assert.match(layout, /<Footer appearanceControl=\{<ThemeToggleButton/);
    const html = renderToStaticMarkup(<LetbuyyThemeProvider surface="marketplace"><Footer appearanceControl={<ThemeToggleButton label="Switch light or dark appearance" />} /></LetbuyyThemeProvider>);
    assert.equal((html.match(/aria-label="Switch light or dark appearance"/g)||[]).length, 1);
    assert.match(html, /marketplace-footer-appearance/);
    assert.match(html, /marketplace-footer-legal/);
    assert.match(html, /marketplace-footer-preferences/);
    assert.ok(html.indexOf('marketplace-footer-legal') < html.indexOf('marketplace-footer-copyright'));
});

test('store-only marketplace does not advertise undeveloped website categories', () => {
    assert.equal(isThemeCategorySlug('store'), true);
    const hero = renderToStaticMarkup(<MarketplaceHero />);
    const navbar = readAppFile('src/components/layout/navbar.tsx');
    const catalog = readAppFile('src/app/themes/page.tsx');
    const options = catalog.slice(catalog.indexOf('const CATEGORY_OPTIONS'), catalog.indexOf('const PRICING_OPTIONS'));
    const sitemap = readAppFile('src/app/sitemap.ts');
    for (const category of ['portfolio', 'resume', 'landing', 'saas']) {
        assert.equal(isThemeCategorySlug(category), false, category);
        assert.ok(!hero.includes(`category=${category}`));
        assert.ok(!navbar.includes(`category=${category}`));
        assert.ok(!options.includes(`value: '${category}'`));
        assert.ok(!DISCOVERY_PATHS.some(item => item.href.includes(`/category/${category}`)));
    }
    assert.match(sitemap, /CATEGORY_ROUTES: ThemeCategory\[\] = \['store'\]/);
    const answer = MARKETPLACE_FAQS.find(item => item.id === 'which-website-types')?.answer;
    assert.match(answer ?? '', /currently offers themes for the LetBuyy store builder/);
    assert.doesNotMatch(answer ?? '', /portfolio|resume|landing.page|SaaS/i);
});
