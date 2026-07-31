/**
 * LCIS Browser Intelligence Engine — ThemeAgent
 * Validates theme rendering, layout, navigation, product pages, images, and fonts.
 * Playwright is a hidden internal primitive — never exposed to callers.
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TIMEOUT = parseInt(process.env.BROWSER_INTELLIGENCE_TIMEOUT ?? '30000', 10);
const HEADLESS = (process.env.PLAYWRIGHT_HEADLESS ?? 'true') !== 'false';

async function getChromium() {
  try {
    const pw = await import('playwright');
    return pw.chromium;
  } catch {
    try {
      const pw = await import('@playwright/test');
      return pw.chromium;
    } catch {
      return null;
    }
  }
}

async function withPage(viewportWidth, viewportHeight, fn) {
  const chromium = await getChromium();
  if (!chromium) return { status: 'NOT AVAILABLE', reason: 'playwright not installed' };
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: { width: viewportWidth, height: viewportHeight },
    ignoreHTTPSErrors: false,
  });
  const page = await context.newPage();
  page.setDefaultTimeout(TIMEOUT);
  try {
    return await fn(page);
  } finally {
    await browser.close();
  }
}

const BREAKPOINTS = [
  { name: 'mobile', width: 360, height: 640 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'desktop', width: 1280, height: 800 },
];

// ---------------------------------------------------------------------------
class ThemeAgent {
  // ---- validateRendering ---------------------------------------------------
  async validateRendering(storeUrl) {
    return withPage(1280, 800, async (page) => {
      const consoleErrors = [];
      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(m.text());
      });

      const start = Date.now();
      const response = await page.goto(storeUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      // Wait for paint to settle
      await page.waitForTimeout(2000);

      const httpStatus = response?.status() ?? null;
      const bodyVisible = await page.locator('body').isVisible();

      return {
        check: 'rendering',
        pass: consoleErrors.length === 0 && httpStatus === 200 && bodyVisible,
        httpStatus,
        consoleErrors,
        bodyVisible,
        duration: Date.now() - start,
      };
    });
  }

  // ---- validateMobileLayout ------------------------------------------------
  async validateMobileLayout(storeUrl) {
    const results = {};
    for (const bp of BREAKPOINTS) {
      const result = await withPage(bp.width, bp.height, async (page) => {
        const start = Date.now();
        const response = await page.goto(storeUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
        await page.waitForTimeout(1000);

        // Check horizontal overflow (indicates layout break)
        const hasHorizOverflow = await page.evaluate(() => {
          return document.body.scrollWidth > window.innerWidth;
        });

        const httpStatus = response?.status() ?? null;
        return {
          width: bp.width,
          pass: httpStatus === 200 && !hasHorizOverflow,
          httpStatus,
          hasHorizOverflow,
          duration: Date.now() - start,
        };
      });
      results[bp.name] = result;
    }

    const allPass = Object.values(results).every((r) => r.pass === true);
    return {
      check: 'mobileLayout',
      pass: allPass,
      breakpoints: results,
    };
  }

  // ---- validateNavigation --------------------------------------------------
  async validateNavigation(storeUrl) {
    return withPage(1280, 800, async (page) => {
      const start = Date.now();
      await page.goto(storeUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      await page.waitForTimeout(1000);

      // Look for common navigation landmarks
      const navExists = await page.locator('nav, [role="navigation"], header').count();
      const linksInNav = navExists > 0
        ? await page.locator('nav a, header a').count()
        : 0;

      // Check that clicking a nav link doesn't produce a 404
      let navLinkWorking = null;
      if (linksInNav > 0) {
        const firstHref = await page.locator('nav a, header a').first().getAttribute('href');
        if (firstHref && firstHref.startsWith('/') && firstHref.length > 1) {
          const targetUrl = new URL(firstHref, storeUrl).toString();
          const navResponse = await page.goto(targetUrl, {
            waitUntil: 'domcontentloaded',
            timeout: TIMEOUT,
          });
          navLinkWorking = navResponse?.status() !== 404;
        }
      }

      return {
        check: 'navigation',
        pass: navExists > 0 && linksInNav > 0 && navLinkWorking !== false,
        navExists: navExists > 0,
        linksInNav,
        navLinkWorking,
        duration: Date.now() - start,
      };
    });
  }

  // ---- validateProductPage -------------------------------------------------
  async validateProductPage(storeUrl, productPath = '/products') {
    return withPage(1280, 800, async (page) => {
      const start = Date.now();
      const url = new URL(productPath, storeUrl).toString();
      const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      await page.waitForTimeout(1500);

      const httpStatus = response?.status() ?? null;
      const hasProductTitle = (await page.locator('h1').count()) > 0;
      const hasPriceElement = (await page.locator('[class*="price"], [data-price], .price, .product-price').count()) > 0;
      const hasAddToCart = (await page.locator('button[type="submit"], [data-add-to-cart], .add-to-cart, button:has-text("Add")').count()) > 0;

      return {
        check: 'productPage',
        url,
        pass: httpStatus === 200 && hasProductTitle,
        httpStatus,
        hasProductTitle,
        hasPriceElement,
        hasAddToCart,
        duration: Date.now() - start,
      };
    });
  }

  // ---- validateImages ------------------------------------------------------
  async validateImages(storeUrl) {
    return withPage(1280, 800, async (page) => {
      const start = Date.now();
      await page.goto(storeUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      await page.waitForTimeout(2000);

      // Evaluate image loading status in-browser
      const imageResults = await page.evaluate(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        return imgs.map((img) => ({
          src: img.src,
          naturalWidth: img.naturalWidth,
          complete: img.complete,
          broken: img.complete && img.naturalWidth === 0 && img.src.length > 0,
        }));
      });

      const total = imageResults.length;
      const broken = imageResults.filter((i) => i.broken);

      return {
        check: 'images',
        pass: broken.length === 0,
        total,
        broken: broken.length,
        brokenUrls: broken.map((i) => i.src),
        duration: Date.now() - start,
      };
    });
  }

  // ---- validateFonts -------------------------------------------------------
  async validateFonts(storeUrl) {
    return withPage(1280, 800, async (page) => {
      const start = Date.now();
      await page.goto(storeUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      await page.waitForTimeout(2000);

      const fontData = await page.evaluate(() => {
        // Check document.fonts API (FontFaceSet)
        const fonts = [];
        if (document.fonts && document.fonts.size > 0) {
          document.fonts.forEach((f) => {
            fonts.push({ family: f.family, status: f.status });
          });
        }
        // Fallback: read computed font families from common elements
        const bodyFont = getComputedStyle(document.body).fontFamily;
        const h1El = document.querySelector('h1');
        const h1Font = h1El ? getComputedStyle(h1El).fontFamily : null;
        return { fonts, bodyFont, h1Font };
      });

      const failedFonts = fontData.fonts.filter((f) => f.status === 'error');

      return {
        check: 'fonts',
        pass: failedFonts.length === 0,
        fontsLoaded: fontData.fonts.filter((f) => f.status === 'loaded').length,
        fontsFailed: failedFonts.length,
        failedFontFamilies: failedFonts.map((f) => f.family),
        bodyFont: fontData.bodyFont,
        h1Font: fontData.h1Font,
        duration: Date.now() - start,
      };
    });
  }

  // ---- runFull -------------------------------------------------------------
  async runFull(storeUrl) {
    const start = Date.now();
    const [renderCheck, mobileCheck, navCheck, productCheck, imageCheck, fontCheck] =
      await Promise.allSettled([
        this.validateRendering(storeUrl),
        this.validateMobileLayout(storeUrl),
        this.validateNavigation(storeUrl),
        this.validateProductPage(storeUrl),
        this.validateImages(storeUrl),
        this.validateFonts(storeUrl),
      ]);

    const settle = (r) => (r.status === 'fulfilled' ? r.value : { pass: false, error: r.reason?.message });

    const checks = {
      renderCheck: settle(renderCheck),
      mobileCheck: settle(mobileCheck),
      navCheck: settle(navCheck),
      productCheck: settle(productCheck),
      imageCheck: settle(imageCheck),
      fontCheck: settle(fontCheck),
    };

    const failedChecks = Object.entries(checks)
      .filter(([, v]) => !v.pass)
      .map(([k]) => k);

    const overallStatus =
      failedChecks.length === 0 ? 'PASS' : failedChecks.length <= 2 ? 'DEGRADED' : 'FAIL';

    // Attempt to read themeId from page meta or data attribute
    let themeId = 'unknown';

    /** @type {ThemeValidationReport} */
    const report = {
      themeId,
      storeUrl,
      ...checks,
      overallStatus,
      failedChecks,
      evidence: [],
      duration: Date.now() - start,
      timestamp: new Date().toISOString(),
    };

    return report;
  }
}

export default new ThemeAgent();
