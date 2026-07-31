/**
 * LCIS Browser Intelligence Engine — StoreAgent
 * Validates homepage health, SEO signals, page speed, SSL, and custom domains.
 * Playwright is a hidden internal primitive — never exposed to callers.
 */

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

async function withPage(fn, opts = {}) {
  const chromium = await getChromium();
  if (!chromium) return { status: 'NOT AVAILABLE', reason: 'playwright not installed' };
  const browser = await chromium.launch({ headless: HEADLESS });
  const context = await browser.newContext({
    viewport: opts.viewport ?? { width: 1280, height: 800 },
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

// ---------------------------------------------------------------------------
class StoreAgent {
  // ---- validateHomepage ----------------------------------------------------
  async validateHomepage(storeUrl) {
    return withPage(async (page) => {
      const start = Date.now();
      const response = await page.goto(storeUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });
      await page.waitForTimeout(1000);

      const httpStatus = response?.status() ?? null;
      const title = await page.title();
      const metaDesc = await page.$eval(
        'meta[name="description"]',
        (el) => el.getAttribute('content'),
      ).catch(() => null);

      const h1Count = await page.locator('h1').count();
      const h1Text = h1Count > 0 ? await page.locator('h1').first().textContent() : null;

      // Hero section heuristic: look for prominent banner/hero elements
      const heroExists = (await page.locator(
        'section[class*="hero"], [class*="hero"], [class*="banner"], [class*="jumbotron"]'
      ).count()) > 0;

      // CTA: primary action buttons
      const ctaExists = (await page.locator(
        'a[class*="cta"], button[class*="cta"], a:has-text("Shop"), a:has-text("Buy"), a:has-text("Explore"), button:has-text("Shop")'
      ).count()) > 0;

      const checks = {
        httpOk: { pass: httpStatus === 200, value: httpStatus },
        hasTitle: { pass: title.length > 0, value: title },
        hasMeta: { pass: !!metaDesc && metaDesc.length > 0, value: metaDesc },
        hasH1: { pass: h1Count > 0, value: h1Text },
        hasHero: { pass: heroExists, value: heroExists },
        hasCTA: { pass: ctaExists, value: ctaExists },
      };

      const failed = Object.entries(checks).filter(([, v]) => !v.pass).map(([k]) => k);
      return {
        check: 'homepage',
        pass: failed.length === 0,
        checks,
        failedChecks: failed,
        duration: Date.now() - start,
      };
    });
  }

  // ---- validateSEO ---------------------------------------------------------
  async validateSEO(storeUrl) {
    return withPage(async (page) => {
      const start = Date.now();
      await page.goto(storeUrl, { waitUntil: 'domcontentloaded', timeout: TIMEOUT });

      const html = await page.content();

      const { default: SEOValidator } = await import('../validators/SEOValidator.mjs');
      const seoResult = SEOValidator.validate(html, storeUrl);

      return {
        check: 'seo',
        pass: seoResult.score >= 60,
        score: seoResult.score,
        issues: seoResult.issues,
        checks: seoResult.checks,
        duration: Date.now() - start,
      };
    });
  }

  // ---- validatePageSpeed ---------------------------------------------------
  async validatePageSpeed(storeUrl) {
    return withPage(async (page) => {
      const start = Date.now();

      // Capture TTFB via response timing
      let ttfb = null;
      page.on('response', (res) => {
        if (res.url() === storeUrl || res.url() === storeUrl + '/') {
          const timing = res.request().timing();
          if (timing) {
            ttfb = timing.responseStart - timing.requestStart;
          }
        }
      });

      const navStart = Date.now();
      const response = await page.goto(storeUrl, { waitUntil: 'networkidle', timeout: TIMEOUT });
      const loadTime = Date.now() - navStart;

      // Web Vitals via Performance API
      const perfMetrics = await page.evaluate(() => {
        const nav = performance.getEntriesByType('navigation')[0];
        if (!nav) return null;
        return {
          domContentLoaded: nav.domContentLoadedEventEnd - nav.startTime,
          loadEvent: nav.loadEventEnd - nav.startTime,
          transferSize: nav.transferSize,
          ttfb: nav.responseStart - nav.requestStart,
        };
      }).catch(() => null);

      const effectiveTtfb = perfMetrics?.ttfb ?? ttfb ?? null;
      const effectiveLoad = perfMetrics?.loadEvent ?? loadTime;

      return {
        check: 'pageSpeed',
        pass: effectiveLoad < 3000,
        loadTimeMs: effectiveLoad,
        ttfbMs: effectiveTtfb,
        meetsTarget: effectiveLoad < 3000,
        httpStatus: response?.status() ?? null,
        perfMetrics,
        duration: Date.now() - start,
      };
    });
  }

  // ---- validateSSL ---------------------------------------------------------
  async validateSSL(storeUrl) {
    const start = Date.now();
    const isHttps = storeUrl.startsWith('https://');

    if (!isHttps) {
      return {
        check: 'ssl',
        pass: false,
        isHttps: false,
        reason: 'URL uses HTTP, not HTTPS',
        duration: Date.now() - start,
      };
    }

    return withPage(async (page) => {
      let sslError = null;
      page.on('requestfailed', (req) => {
        const failure = req.failure()?.errorText ?? '';
        if (failure.toLowerCase().includes('ssl') || failure.toLowerCase().includes('cert')) {
          sslError = failure;
        }
      });

      try {
        const response = await page.goto(storeUrl, {
          waitUntil: 'domcontentloaded',
          timeout: TIMEOUT,
        });
        return {
          check: 'ssl',
          pass: !sslError && response?.status() !== null,
          isHttps: true,
          sslError,
          httpStatus: response?.status() ?? null,
          duration: Date.now() - start,
        };
      } catch (err) {
        return {
          check: 'ssl',
          pass: false,
          isHttps: true,
          sslError: err.message,
          duration: Date.now() - start,
        };
      }
    });
  }

  // ---- validateCustomDomain ------------------------------------------------
  async validateCustomDomain(storeUrl) {
    return withPage(async (page) => {
      const start = Date.now();

      let redirectChain = [];
      page.on('response', (res) => {
        const status = res.status();
        if (status >= 300 && status < 400) {
          redirectChain.push({ from: res.url(), status });
        }
      });

      const response = await page.goto(storeUrl, {
        waitUntil: 'domcontentloaded',
        timeout: TIMEOUT,
      });

      const finalUrl = page.url();
      const resolvedDomain = new URL(finalUrl).hostname;
      const requestedDomain = new URL(storeUrl).hostname;

      // Custom domain is "working" if the final URL is on the expected domain
      // and no redirect loops occurred
      const domainMatches = resolvedDomain === requestedDomain;
      const httpStatus = response?.status() ?? null;

      return {
        check: 'customDomain',
        pass: domainMatches && httpStatus === 200,
        requestedDomain,
        resolvedDomain,
        domainMatches,
        httpStatus,
        redirectCount: redirectChain.length,
        finalUrl,
        duration: Date.now() - start,
      };
    });
  }

  // ---- runFull -------------------------------------------------------------
  async runFull(storeUrl) {
    const start = Date.now();

    const [homepageResult, seoResult, speedResult, sslResult, domainResult] =
      await Promise.allSettled([
        this.validateHomepage(storeUrl),
        this.validateSEO(storeUrl),
        this.validatePageSpeed(storeUrl),
        this.validateSSL(storeUrl),
        this.validateCustomDomain(storeUrl),
      ]);

    const settle = (r) =>
      r.status === 'fulfilled' ? r.value : { pass: false, error: r.reason?.message };

    const checks = {
      homepage: settle(homepageResult),
      seo: settle(seoResult),
      pageSpeed: settle(speedResult),
      ssl: settle(sslResult),
      customDomain: settle(domainResult),
    };

    const failedChecks = Object.entries(checks)
      .filter(([, v]) => !v.pass)
      .map(([k]) => k);

    const overallStatus =
      failedChecks.length === 0 ? 'PASS' : failedChecks.length <= 2 ? 'DEGRADED' : 'FAIL';

    /** @type {StoreHealthReport} */
    return {
      storeUrl,
      ...checks,
      overallStatus,
      failedChecks,
      duration: Date.now() - start,
      timestamp: new Date().toISOString(),
    };
  }
}

export default new StoreAgent();
