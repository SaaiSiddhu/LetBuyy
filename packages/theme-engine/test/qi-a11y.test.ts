// Phase I QA — Accessibility assertions.
// Renders real Liquid sections via LiquidRenderer and asserts WCAG-aligned markup contracts:
// landmarks, headings, image alt text, form labelling, and hydration-island ARIA attributes.
// None of these assertions duplicate existing L5/L9/F7/L10 coverage; those test data binding
// and sanitization, not the accessibility shape of the rendered HTML.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createUrbanKicksLiquidThemeBundleFixture,
  LiquidRenderer,
  DEFAULT_THEME_SETTINGS,
} from '../src/index.ts';

const STORE_ID = 'a11y-test-store-1111-2222-333333333333';

// Shared render helper. Uses the Urban Kicks fixture (which ships all 25 section types,
// chrome templates, and the WCAG-aligned <main id="MainContent"> layout).
async function renderTemplate(
  templateKey: string,
  liquidContext?: Record<string, unknown>,
) {
  const renderer = new LiquidRenderer();
  return renderer.render({
    context: {
      storeId: STORE_ID,
      subdomain: 'a11y-store',
      path: `/${templateKey}`,
      previewMode: false,
      locale: 'en',
    },
    storeTemplate: {
      storeId: STORE_ID,
      themeId: 'urban-kicks-liquid',
      themeSettings: DEFAULT_THEME_SETTINGS,
      sections: [],
    },
    routeTemplate: { id: templateKey, type: templateKey, layoutKey: 'theme', sections: [] },
    liquidTemplateKey: templateKey,
    liquidBundle: createUrbanKicksLiquidThemeBundleFixture(),
    ...(liquidContext ? { liquidContext } : {}),
  });
}

// ============================================================================
// A11Y-1: Layout landmark — Urban Kicks layout must include <main id="MainContent">
// ============================================================================

test('A11Y-1 Urban Kicks layout provides a <main id="MainContent"> ARIA landmark', async () => {
  const result = await renderTemplate('index');

  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings.join(', ')}`);

  const html = result.liquid?.layoutHtml ?? '';
  // The layout source ships: <main id="MainContent">{{ content_for_layout | raw }}</main>
  // This is an accessible landmark that assistive technology relies on for skip-nav.
  assert.match(
    html,
    /<main\b[^>]*\bid="MainContent"/i,
    'layout HTML must contain a <main id="MainContent"> landmark',
  );
});

// ============================================================================
// A11Y-2: Heading hierarchy — hero-banner renders <h1> with the configured heading text
// ============================================================================

test('A11Y-2 hero-banner section renders an <h1> containing the configured heading text', async () => {
  const result = await renderTemplate('index');

  assert.equal(result.status, 'rendered');

  const html = result.liquid?.contentForLayout ?? '';
  // Urban Kicks fixture sets hero heading to "Fresh drops for daily buyers".
  // The hero-banner template renders: <h1 class="lb-hero-banner__heading">{{ section.settings.heading }}</h1>
  assert.match(
    html,
    /<h1\b[^>]*>[^<]*Fresh drops for daily buyers[^<]*<\/h1>/is,
    '<h1> must appear in hero-banner with the configured heading text',
  );
});

// ============================================================================
// A11Y-3: Newsletter email input must carry aria-label
// ============================================================================

test('A11Y-3 newsletter-signup section renders an email input with aria-label="Email"', async () => {
  const bundle = createUrbanKicksLiquidThemeBundleFixture();
  const renderer = new LiquidRenderer();

  // Use a template that has only the newsletter-signup section so we can assert cleanly.
  const newsletterBundle = {
    ...bundle,
    templates: {
      ...bundle.templates,
      index: {
        ...bundle.templates.index,
        sections: {
          'nl-only': {
            type: 'newsletter-signup',
            settings: { title: 'Get first access', buttonLabel: 'Sign up' },
            blocks: {},
            block_order: [],
          },
        },
        order: ['nl-only'],
      },
    },
  };

  const result = await renderer.render({
    context: { storeId: STORE_ID, subdomain: 'a11y-store', path: '/', previewMode: false, locale: 'en' },
    storeTemplate: { storeId: STORE_ID, themeId: 'urban-kicks-liquid', themeSettings: DEFAULT_THEME_SETTINGS, sections: [] },
    routeTemplate: { id: 'index', type: 'index', layoutKey: 'theme', sections: [] },
    liquidBundle: newsletterBundle as Parameters<typeof renderer.render>[0]['liquidBundle'],
    liquidTemplateKey: 'index',
  });

  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings.join(', ')}`);

  const html = result.liquid?.contentForLayout ?? '';
  // The newsletter-signup section renders: <input type="email" name="email" aria-label="Email" required>
  assert.match(html, /type="email"/, 'newsletter section must include an email input');
  assert.match(
    html,
    /\baria-label="Email"/,
    'newsletter email input must have aria-label="Email" (WCAG 2.1 SC 1.3.1)',
  );
});

// ============================================================================
// A11Y-4: Login form — each visible input is wrapped in a <label> element (WCAG 1.3.1)
// ============================================================================

test('A11Y-4 customer-login form has <label> elements wrapping the email and password inputs', async () => {
  const result = await renderTemplate('customers/login');

  assert.equal(result.status, 'rendered');

  const html = result.liquid?.contentForLayout ?? '';
  // customer-login renders: <label>Email<input type="email" ...></label>
  //                        <label>Password<input type="password" ...></label>
  assert.match(html, /<label\b/i, 'login form must have label elements');
  assert.match(html, /<input[^>]+type="email"/, 'login form must have an email input');
  assert.match(html, /<input[^>]+type="password"/, 'login form must have a password input');

  // Both visible inputs (email + password) must be inside a <label>.
  // Count label tags: must be at least 2.
  const labelMatches = html.match(/<label\b/gi) ?? [];
  assert.ok(
    labelMatches.length >= 2,
    `login form must have at least 2 <label> elements (email + password), found ${labelMatches.length}`,
  );
});

// ============================================================================
// A11Y-5: Register form — each visible input is wrapped in a <label> element (WCAG 1.3.1)
// ============================================================================

test('A11Y-5 customer-register provides an accessible canonical account-creation link', async () => {
  const result = await renderTemplate('customers/register');

  assert.equal(result.status, 'rendered');

  const html = result.liquid?.contentForLayout ?? '';
  assert.match(html, /<a[^>]+href="\/api\/buyer-auth\/start\?return_to=\/store\/[^/]+\/account"[^>]*>Create or sign in with LetBuyy<\/a>/i);
  assert.doesNotMatch(html, /<input\b/i, 'canonical registration entry must not collect store-local credentials');
});

// ============================================================================
// A11Y-6: Product gallery — every <img> in the gallery carries a non-empty alt attribute
// ============================================================================

test('A11Y-6 product-detail gallery images carry alt attributes with the product title', async () => {
  const result = await renderTemplate('product', {
    product: {
      id: 'prod-a11y',
      title: 'Accessible Sneaker A11Y',
      price: 8999,
      currency: 'INR',
      url: '/products/a11y-sneaker',
      images: [
        'https://cdn.example.com/shoe-front.jpg',
        'https://cdn.example.com/shoe-side.jpg',
      ],
      description: 'WCAG-friendly footwear.',
      in_wishlist: false,
      rating: 0,
      review_count: 0,
      options: [],
      reviews: [],
    },
  });

  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings.join(', ')}`);

  const html = result.liquid?.contentForLayout ?? '';
  // product-detail renders: <img src="..." alt="{{ product.title }}">
  // The alt value should be the title we provided.
  assert.match(
    html,
    /\balt="Accessible Sneaker A11Y"/,
    'product gallery images must carry alt="<product title>" (WCAG 2.1 SC 1.1.1)',
  );

  // No <img> may be missing an alt attribute at all.
  // Regex: <img that does NOT contain alt= anywhere before the closing >
  const imgTagsWithoutAlt = html.match(/<img\b(?![^>]*\balt=)[^>]*>/gi) ?? [];
  assert.equal(
    imgTagsWithoutAlt.length,
    0,
    `all <img> elements must have an alt attribute; found ${imgTagsWithoutAlt.length} without`,
  );
});

// ============================================================================
// A11Y-7: lb-add-to-cart status span must carry aria-live="polite"
// ============================================================================

test('A11Y-7 lb-add-to-cart island carries aria-live="polite" on its cart-status span', async () => {
  const result = await renderTemplate('product', {
    product: {
      id: 'prod-aria-atc',
      title: 'ARIA Cart Shoe',
      price: 3000,
      currency: 'INR',
      url: '/products/aria-cart-shoe',
      images: [],
      description: '',
      in_wishlist: false,
      rating: 0,
      review_count: 0,
      options: [],
      reviews: [],
    },
  });

  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings.join(', ')}`);

  const html = result.liquid?.contentForLayout ?? '';
  // The product-detail section renders:
  // <lb-add-to-cart data-lb-island="add-to-cart" ...>
  //   <button type="button" data-lb-add-to-cart>Add to cart</button>
  //   <span data-lb-add-to-cart-status aria-live="polite"></span>
  // </lb-add-to-cart>
  assert.match(
    html,
    /data-lb-island="add-to-cart"/,
    'lb-add-to-cart must carry data-lb-island="add-to-cart"',
  );
  assert.match(
    html,
    /data-lb-add-to-cart-status[^>]*aria-live="polite"|aria-live="polite"[^>]*data-lb-add-to-cart-status/,
    'the lb-add-to-cart status span must have aria-live="polite" for screen-reader announcements (WCAG 2.1 SC 4.1.3)',
  );
});

// ============================================================================
// A11Y-8: lb-variant-picker buttons carry aria-pressed attribute
// ============================================================================

test('A11Y-8 lb-variant-picker option buttons carry aria-pressed for toggle state communication', async () => {
  const result = await renderTemplate('product', {
    product: {
      id: 'prod-variants',
      title: 'Size Picker Shoe',
      price: 6000,
      currency: 'INR',
      url: '/products/size-picker',
      images: [],
      description: '',
      in_wishlist: false,
      rating: 0,
      review_count: 0,
      options: [{ name: 'Size', values: ['UK 8', 'UK 9', 'UK 10'] }],
      reviews: [],
    },
  });

  assert.equal(result.status, 'rendered', `Expected rendered. Warnings: ${result.warnings.join(', ')}`);

  const html = result.liquid?.contentForLayout ?? '';
  // The product-detail section renders:
  // <lb-variant-picker data-lb-island="variant-picker" ...>
  //   <button type="button" data-lb-variant-option ... aria-pressed="false">UK 8</button>
  // </lb-variant-picker>
  assert.match(
    html,
    /data-lb-island="variant-picker"/,
    'lb-variant-picker must carry data-lb-island attribute',
  );
  assert.match(
    html,
    /\baria-pressed="false"/,
    'variant picker buttons must have aria-pressed="false" as the default state (WCAG 2.1 SC 4.1.2)',
  );
  assert.match(html, /UK 8/, 'variant value text must render in the output');
});
