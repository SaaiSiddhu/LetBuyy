/**
 * LCIS Browser Intelligence Engine — SEOValidator
 * Pure synchronous HTML-string SEO analysis. No browser, no network calls.
 * Parses HTML using regex patterns to evaluate key on-page SEO signals.
 */

// ---------------------------------------------------------------------------
// Regex helpers
// ---------------------------------------------------------------------------
const R = {
  title: /<title[^>]*>([\s\S]*?)<\/title>/i,
  metaDesc: /<meta\s+[^>]*name\s*=\s*["']description["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>/i,
  metaDescAlt: /<meta\s+[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']description["'][^>]*>/i,
  ogTitle: /<meta\s+[^>]*property\s*=\s*["']og:title["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>/i,
  ogTitleAlt: /<meta\s+[^>]*content\s*=\s*["']([^"']*)["'][^>]*property\s*=\s*["']og:title["'][^>]*>/i,
  ogDesc: /<meta\s+[^>]*property\s*=\s*["']og:description["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>/i,
  ogDescAlt: /<meta\s+[^>]*content\s*=\s*["']([^"']*)["'][^>]*property\s*=\s*["']og:description["'][^>]*>/i,
  ogImage: /<meta\s+[^>]*property\s*=\s*["']og:image["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>/i,
  ogImageAlt: /<meta\s+[^>]*content\s*=\s*["']([^"']*)["'][^>]*property\s*=\s*["']og:image["'][^>]*>/i,
  canonical: /<link\s+[^>]*rel\s*=\s*["']canonical["'][^>]*href\s*=\s*["']([^"']*)["'][^>]*>/i,
  canonicalAlt: /<link\s+[^>]*href\s*=\s*["']([^"']*)["'][^>]*rel\s*=\s*["']canonical["'][^>]*>/i,
  robotsMeta: /<meta\s+[^>]*name\s*=\s*["']robots["'][^>]*content\s*=\s*["']([^"']*)["'][^>]*>/i,
  robotsMetaAlt: /<meta\s+[^>]*content\s*=\s*["']([^"']*)["'][^>]*name\s*=\s*["']robots["'][^>]*>/i,
  jsonLd: /<script\s+[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
};

// Patterns that indicate a generic/placeholder title
const GENERIC_TITLE_PATTERNS = [
  /^home$/i,
  /^welcome$/i,
  /^untitled/i,
  /^page$/i,
  /^my store$/i,
  /^new store$/i,
];

function extractFirst(html, ...patterns) {
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

// ---------------------------------------------------------------------------
class SEOValidator {
  // ---- validate ------------------------------------------------------------
  /**
   * Full SEO validation of an HTML string.
   * @param {string} html - Raw HTML source
   * @param {string} url - Canonical URL of the page
   * @returns {{ checks: object, score: number, issues: string[] }}
   */
  validate(html, url) {
    const title = this.checkTitle(html);
    const metaDescription = this.checkMetaDescription(html);
    const ogTags = this.checkOgTags(html);
    const canonical = this.checkCanonical(html, url);
    const robots = this.checkRobots(html);
    const structuredData = this.checkStructuredData(html);

    const checks = { title, metaDescription, ogTags, canonical, robots, structuredData };

    // Scoring: each check is worth up to its weight
    const weights = {
      title: 20,
      metaDescription: 15,
      ogTags: 15,
      canonical: 15,
      robots: 15,
      structuredData: 20,
    };

    let score = 0;
    const issues = [];

    for (const [key, weight] of Object.entries(weights)) {
      const check = checks[key];
      if (check.pass) {
        score += weight;
      } else {
        issues.push(...(check.issues ?? [`${key}: failed`]));
      }
      // Partial credit for degraded checks
      if (check.degraded) {
        score += Math.floor(weight * 0.5);
      }
    }

    score = Math.min(score, 100);

    return { checks, score, issues };
  }

  // ---- checkTitle ----------------------------------------------------------
  /**
   * Title tag: exists, 50-60 chars, not generic.
   */
  checkTitle(html) {
    const value = extractFirst(html, R.title);
    const issues = [];

    if (!value) {
      return { pass: false, issues: ['Missing <title> tag'], value: null };
    }

    const len = value.length;
    if (len < 10) issues.push(`Title too short (${len} chars; minimum 10)`);
    if (len < 50) issues.push(`Title below optimal length (${len} chars; target 50–60)`);
    if (len > 60) issues.push(`Title too long (${len} chars; maximum 60)`);

    const isGeneric = GENERIC_TITLE_PATTERNS.some((p) => p.test(value));
    if (isGeneric) issues.push(`Title appears generic: "${value}"`);

    const pass = issues.length === 0;
    const degraded = !pass && len >= 10 && !isGeneric;

    return { pass, degraded, value, length: len, issues };
  }

  // ---- checkMetaDescription ------------------------------------------------
  /**
   * Meta description: exists, 120-160 chars.
   */
  checkMetaDescription(html) {
    const value = extractFirst(html, R.metaDesc, R.metaDescAlt);
    const issues = [];

    if (!value) {
      return { pass: false, issues: ['Missing meta description tag'], value: null };
    }

    const len = value.length;
    if (len < 50) issues.push(`Meta description too short (${len} chars; minimum 50)`);
    if (len < 120) issues.push(`Meta description below optimal (${len} chars; target 120–160)`);
    if (len > 160) issues.push(`Meta description too long (${len} chars; maximum 160)`);

    const pass = issues.length === 0;
    const degraded = !pass && len >= 50 && len <= 200;

    return { pass, degraded, value, length: len, issues };
  }

  // ---- checkOgTags ---------------------------------------------------------
  /**
   * Open Graph tags: og:title, og:description, og:image all present.
   */
  checkOgTags(html) {
    const ogTitle = extractFirst(html, R.ogTitle, R.ogTitleAlt);
    const ogDescription = extractFirst(html, R.ogDesc, R.ogDescAlt);
    const ogImage = extractFirst(html, R.ogImage, R.ogImageAlt);

    const issues = [];
    if (!ogTitle) issues.push('Missing og:title');
    if (!ogDescription) issues.push('Missing og:description');
    if (!ogImage) issues.push('Missing og:image');

    const pass = issues.length === 0;
    const degraded = !pass && (ogTitle || ogDescription) && !pass;

    return {
      pass,
      degraded,
      ogTitle,
      ogDescription,
      ogImage,
      issues,
    };
  }

  // ---- checkCanonical ------------------------------------------------------
  /**
   * Canonical tag: present, matches the provided URL (ignoring trailing slash).
   */
  checkCanonical(html, url) {
    const value = extractFirst(html, R.canonical, R.canonicalAlt);
    const issues = [];

    if (!value) {
      return { pass: false, issues: ['Missing canonical <link> tag'], value: null };
    }

    // Normalize for comparison
    const normalize = (u) => u.replace(/\/$/, '').toLowerCase();
    const canonMatches = url ? normalize(value) === normalize(url) : true;

    if (!canonMatches) {
      issues.push(`Canonical URL mismatch: tag="${value}" vs page="${url}"`);
    }

    const pass = issues.length === 0;
    return { pass, value, canonMatches, issues };
  }

  // ---- checkRobots ---------------------------------------------------------
  /**
   * Robots meta: no noindex directive present.
   */
  checkRobots(html) {
    const value = extractFirst(html, R.robotsMeta, R.robotsMetaAlt);

    if (!value) {
      // No robots meta at all = fine (defaults to index,follow)
      return { pass: true, value: null, noindex: false, issues: [] };
    }

    const noindex = /noindex/i.test(value);
    const nofollow = /nofollow/i.test(value);
    const issues = [];

    if (noindex) issues.push(`robots meta contains "noindex": page will not be indexed`);

    return { pass: !noindex, value, noindex, nofollow, issues };
  }

  // ---- checkStructuredData -------------------------------------------------
  /**
   * JSON-LD structured data: at least one valid block present.
   */
  checkStructuredData(html) {
    const blocks = [];
    let match;

    // Reset lastIndex for global regex
    R.jsonLd.lastIndex = 0;
    while ((match = R.jsonLd.exec(html)) !== null) {
      try {
        const parsed = JSON.parse(match[1].trim());
        blocks.push(parsed);
      } catch {
        // Malformed JSON-LD — skip
      }
    }

    const issues = [];
    if (blocks.length === 0) {
      issues.push('No valid JSON-LD structured data found');
    }

    const types = blocks.map((b) => b['@type']).filter(Boolean);

    return {
      pass: blocks.length > 0,
      count: blocks.length,
      types,
      issues,
    };
  }
}

export default new SEOValidator();
