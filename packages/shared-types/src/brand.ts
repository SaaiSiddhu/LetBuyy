/**
 * Canonical LetBuyy brand + entity identity.
 *
 * This is the SINGLE SOURCE OF TRUTH for everything that teaches search engines
 * and knowledge graphs that "LetBuyy" is a distinct company (not a typo of any
 * other brand). It feeds:
 *   - Organization / WebSite / SoftwareApplication structured data
 *   - Wikidata + Crunchbase entity parity (the `sameAs` reconciliation loop)
 *   - Open Graph / Twitter card defaults
 *
 * GOVERNANCE: `@letbuyy/shared-types` owns SEO + cross-runtime brand contracts.
 * Keep this file dependency-free (pure constants) so it is safe to import from
 * both server and client components.
 *
 * Values marked `HUMAN-REQUIRED: SKIP-BRAND-LEGAL-FACTS` must be confirmed by a
 * human before public launch. Empty
 * strings are intentionally filtered out of emitted structured data, so it is
 * safe to ship this file with human-required values unfilled — nothing
 * fabricated will be published. See
 * docs/seo/LETBUYY_ENTITY_AND_SEO_MASTER_PLAYBOOK.md ("Entity Data Sheet") for
 * the exact values to drop in.
 */

/**
 * Active fallback for platform SEO defaults. Runtime apps should pass their
 * configured platform origin from env when emitting public URLs.
 */
export const DEFAULT_PLATFORM_DOMAIN = 'letbuyy.com';
export const DEFAULT_STOREFRONT_DOMAIN = 'letbuyy.store';
export const DEFAULT_PLATFORM_ORIGIN = `https://${DEFAULT_PLATFORM_DOMAIN}` as const;

/**
 * Domains we still answer on during a platform apex migration. Host parsing must
 * accept these; canonical URLs should use the runtime-configured platform origin.
 */
export const LEGACY_PLATFORM_DOMAINS = ['letbuyy.com'] as const;

/** All fallback platform apex domains, primary first. */
export const PLATFORM_DOMAINS = [DEFAULT_PLATFORM_DOMAIN, ...LEGACY_PLATFORM_DOMAINS] as const;

/**
 * Env var names that may override the platform apex domain at runtime. The
 * `letbuyy.com` is the canonical fallback. One of these keys may temporarily
 * point at a transition realm when DNS or session cutover is staged. First
 * non-empty value wins.
 */
export const PLATFORM_DOMAIN_ENV_KEYS = ['LETBUYY_PLATFORM_DOMAIN', 'NEXT_PUBLIC_PLATFORM_DOMAIN'] as const;

/**
 * Safe cross-runtime env read. Workers and Next expose env differently and some
 * build targets (e.g. the Cloudflare Worker program, which compiles this file
 * with workers-types only) lack Node's `process` typings, so we reach env via
 * `globalThis` instead of a bare `process` reference. Returns `undefined` when
 * no host env is present — every resolver below then falls back to the
 * canonical `letbuyy.com` default.
 */
function readPlatformDomainEnv(key: (typeof PLATFORM_DOMAIN_ENV_KEYS)[number]): string | undefined {
  const globalProcess = (globalThis as unknown as {
    process?: { env?: Record<string, string | undefined> };
  }).process;
  const value = globalProcess?.env?.[key];
  return value && value.trim() ? value.trim() : undefined;
}

function normalizePlatformDomain(value: string): string {
  return value
    .toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^\.+|\.+$/g, '');
}

/**
 * Active platform apex domain. Returns the env override (any of
 * `PLATFORM_DOMAIN_ENV_KEYS`) when configured, otherwise the
 * `DEFAULT_PLATFORM_DOMAIN` (`letbuyy.com`) fallback.
 */
export function resolvePlatformDomain(): string {
  for (const key of PLATFORM_DOMAIN_ENV_KEYS) {
    const override = readPlatformDomainEnv(key);
    if (override) {
      const normalized = normalizePlatformDomain(override);
      if (normalized) return normalized;
    }
  }
  return DEFAULT_PLATFORM_DOMAIN;
}

/** Active platform origin (`https://<domain>`), env-overridable. */
export function resolvePlatformOrigin(): string {
  return `https://${resolvePlatformDomain()}`;
}

/** Brand support email, tracking the active (env-overridable) platform domain. */
export function resolveBrandContactEmail(): string {
  return `support@${resolvePlatformDomain()}`;
}

/**
 * Alternate SPELLINGS of *our own* name only — used for `alternateName`.
 * NEVER list a competitor's name (e.g. a similarly spelled brand) here: doing so
 * tells Google the two are the same entity, which is the opposite of what we want.
 */
export const BRAND_ALTERNATE_NAMES = ['Let Buyy', 'Letbuyy', 'LetBuyy Commerce'] as const;

/**
 * Public profile + reference URLs. Each closes part of the entity loop. Fill these
 * in as you create them (Step 1 + Step 3 of the playbook). Empty entries are
 * filtered out of `sameAs`, so partial completion is safe.
 */
export const BRAND_PROFILES = {
  /** Step 1 — paste the Wikidata item URL once it exists (https://www.wikidata.org/wiki/Q…). */
  wikidata: '', // HUMAN-REQUIRED: SKIP-BRAND-LEGAL-FACTS
  /** Step 1 — Crunchbase organization URL (https://www.crunchbase.com/organization/letbuyy). */
  crunchbase: '', // HUMAN-REQUIRED: SKIP-BRAND-LEGAL-FACTS
  linkedin: '', // HUMAN-REQUIRED: SKIP-BRAND-LEGAL-FACTS e.g. https://www.linkedin.com/company/letbuyy
  /* Confirmed accounts. Share-tracking parameters (?igsh=, ?si=) are stripped
     deliberately: those tokens belong to whoever copied the link, and leaving
     them in would attribute every visitor from the site to that one share. The
     bare profile URL resolves identically and is what `sameAs` should carry. */
  instagram: 'https://www.instagram.com/letbuyyhq',
  x: 'https://x.com/letbuyyhq',
  youtube: 'https://youtube.com/@letbuyyhq',
  /* A /share/ permalink rather than a vanity URL — that is what the page
     currently issues. Replace with https://www.facebook.com/<name> once a
     username is claimed; a canonical profile URL is a stronger `sameAs`
     signal than a redirect. */
  facebook: 'https://www.facebook.com/share/14tEGNoJSXR/',
  github: '', // HUMAN-REQUIRED: SKIP-BRAND-LEGAL-FACTS e.g. https://github.com/letbuyy
  producthunt: '', // HUMAN-REQUIRED: SKIP-BRAND-LEGAL-FACTS Step 4 launch URL
} as const;

/** Founder identity. Fixes the "wrong CEO" hallucination by stating it explicitly. */
export const BRAND_FOUNDER = {
  /** HUMAN-REQUIRED: SKIP-BRAND-LEGAL-FACTS — legal name to associate publicly with LetBuyy. */
  name: '',
  jobTitle: 'Founder & CEO',
} as const;

export const BRAND = {
  name: 'LetBuyy',
  /** HUMAN-REQUIRED: SKIP-BRAND-LEGAL-FACTS — registered legal entity name if different. */
  legalName: 'LetBuyy',
  alternateName: BRAND_ALTERNATE_NAMES,
  tagline: 'India-first commerce operating system',
  description:
    'LetBuyy is an India-first commerce operating system. Merchants, creators, and small businesses launch online stores, blogs, portfolios, and landing pages with one workspace for themes, products, an app marketplace, and checkout — GST-ready and COD-friendly.',
  /** Short knowledge-panel-style description, < 160 chars. */
  shortDescription:
    'India-first commerce operating system for stores, blogs, portfolios, and landing pages.',
  url: DEFAULT_PLATFORM_ORIGIN,
  /** Raster logo (Google Knowledge Graph prefers PNG/JPG, min 112x112; 512 recommended). */
  logo: `${DEFAULT_PLATFORM_ORIGIN}/icons/letbuyy-logo-512.png`,
  /** Default social share image. */
  ogImage: `${DEFAULT_PLATFORM_ORIGIN}/og/letbuyy-default.png`,
  /** HUMAN-REQUIRED: SKIP-BRAND-LEGAL-FACTS — public founding year (YYYY) or full date (YYYY-MM-DD). Left blank = omitted. */
  foundingDate: '',
  founder: BRAND_FOUNDER,
  country: 'IN',
  locale: 'en_IN',
  contactEmail: resolveBrandContactEmail(),
  twitterHandle: '@letbuyy',
  industry: 'E-commerce / SaaS',
  profiles: BRAND_PROFILES,
} as const;

/**
 * Builds the deduped, empty-filtered `sameAs` array for Organization structured
 * data. This is the reconciliation loop: it should point at every place the
 * "LetBuyy" entity is independently described (Wikidata, Crunchbase, socials).
 */
export function buildBrandSameAs(extra: readonly string[] = []): string[] {
  const candidates = [
    ...Object.values(BRAND_PROFILES),
    ...extra,
  ];
  return Array.from(
    new Set(candidates.map((value) => value.trim()).filter((value) => value.length > 0)),
  );
}

/** Convenience: the platform-level Organization JSON-LD node, ready to embed. */
export function buildPlatformOrganizationJsonLd(platformOrigin: string = DEFAULT_PLATFORM_ORIGIN) {
  const sameAs = buildBrandSameAs();
  const origin = platformOrigin.replace(/\/+$/, '');
  const node: Record<string, unknown> = {
    '@type': 'Organization',
    '@id': `${origin}/#organization`,
    name: BRAND.name,
    legalName: BRAND.legalName,
    alternateName: [...BRAND.alternateName],
    url: origin,
    logo: {
      '@type': 'ImageObject',
      url: `${origin}/icons/letbuyy-logo-512.png`,
      width: 512,
      height: 512,
    },
    description: BRAND.description,
    slogan: BRAND.tagline,
    email: BRAND.contactEmail,
    foundingLocation: {
      '@type': 'Country',
      name: 'India',
    },
    areaServed: { '@type': 'Country', name: 'India' },
    knowsLanguage: ['en', 'hi'],
  };

  if (BRAND.foundingDate) node.foundingDate = BRAND.foundingDate;
  if (BRAND.founder.name) {
    node.founder = {
      '@type': 'Person',
      name: BRAND.founder.name,
      jobTitle: BRAND.founder.jobTitle,
    };
  }
  if (sameAs.length > 0) node.sameAs = sameAs;
  node.contactPoint = {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: BRAND.contactEmail,
    areaServed: 'IN',
    availableLanguage: ['en', 'hi'],
  };

  return node;
}
