import { BRAND_ASSETS } from '@/lib/brand-assets'
import type { Metadata } from "next";
import localFont from "next/font/local";
import { headers } from "next/headers";
import { getLocale, LOCALES } from "@/lib/i18n/locales";
import { localePath } from "@/lib/i18n/routing";
import "./globals.css";
import "./locale-typography.css";
import { getMarketingSiteUrl, getSupportEmail } from "@/lib/public-urls";
import { getPlatformNavigationLinks } from "@/lib/platform-links";
import { BRAND, buildBrandSameAs } from "@letbuyy/shared-types/brand";
import { LetbuyyThemeProvider, ThemeScript } from "@letbuyy/ui";
import MarketingMotionProvider from '@/components/MarketingMotionProvider';

const letbuyySans = localFont({
  src: "../../public/fonts/Inter-Marketing-400-900.woff2",
  variable: "--font-letbuyy-sans",
  display: "swap",
  weight: "400 900",
  // Resolve the observed native Tamil faces directly, retaining their existing
  // weight mapping. Platforms without those local faces keep the usual stack.
  fallback: ["LetBuyy Tamil Fallback"],
  // Match the subset's actual cmap so Indic text uses its existing fallback
  // immediately instead of waiting for an inapplicable Latin font swap.
  declarations: [{
    prop: "unicode-range",
    value: "U+0, U+20-7E, U+A0-AC, U+AE-FF, U+3B8, U+2013-2014, U+2018-2019, U+201C-201D, U+2022, U+2026, U+2039-203A, U+20B9, U+2190-2193, U+2212, U+2318, U+2713",
  }],
});

const letbuyyMono = localFont({
  src: "../../../../../packages/typescript/ui/assets/fonts/geist-mono-latin.woff2",
  variable: "--font-letbuyy-mono",
  display: "swap",
  weight: "100 900",
  preload: false,
});

const fontVariables = `${letbuyySans.variable} ${letbuyyMono.variable}`;

const siteUrl = getMarketingSiteUrl();
const supportEmail = getSupportEmail();
const siteTitle = "LetBuyy - India-first commerce operating system";
const siteDescription =
  "Launch stores, blogs, and landing pages with one merchant workspace for themes, products, checkout readiness, and operations.";
const socialImage = BRAND_ASSETS.social;
const logoImage = BRAND_ASSETS.raster;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "LetBuyy",
  title: {
    default: siteTitle,
    template: "%s | LetBuyy",
  },
  description: siteDescription,
  keywords: [
    "LetBuyy",
    "online store builder India",
    "commerce platform",
    "blog builder",
    "landing page builder",
    "GST-ready commerce",
    "COD ecommerce",
  ],
  authors: [{ name: "LetBuyy" }],
  creator: "LetBuyy",
  publisher: "LetBuyy",
  category: "commerce platform",
  alternates: {
    canonical: "/",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: { url: BRAND_ASSETS.mark, type: "image/svg+xml" },
    shortcut: BRAND_ASSETS.mark,
    apple: { url: BRAND_ASSETS.apple, sizes: "180x180", type: "image/png" },
  },
  openGraph: {
    type: "website",
    url: "/",
    siteName: "LetBuyy",
    locale: "en_IN",
    title: siteTitle,
    description: siteDescription,
    images: [
      {
        url: socialImage,
        width: 1200,
        height: 630,
        alt: "LetBuyy — India-first commerce operating system",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: [socialImage],
  },
};

const orgId = `${siteUrl}/#organization`;
const websiteId = `${siteUrl}/#website`;
const platformNavigationLinks = getPlatformNavigationLinks();
const brandSameAs = buildBrandSameAs();

const organizationNode = {
  "@type": "Organization",
  "@id": orgId,
  name: BRAND.name,
  legalName: BRAND.legalName,
  // Alternate SPELLINGS of our own name only — never a competitor's, which would
  // tell Google the two are the same entity (the opposite of disambiguation).
  alternateName: [...BRAND.alternateName],
  url: siteUrl,
  logo: {
    "@type": "ImageObject",
    url: `${siteUrl}${logoImage}`,
    width: 512,
    height: 512,
  },
  image: `${siteUrl}${socialImage}`,
  description: siteDescription,
  slogan: BRAND.tagline,
  email: supportEmail,
  foundingLocation: { "@type": "Country", name: "India" },
  areaServed: { "@type": "Country", name: "India" },
  knowsLanguage: ["en", "hi", "ta"],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: supportEmail,
    areaServed: "IN",
    availableLanguage: ["en", "hi", "ta"],
  },
  ...(BRAND.founder.name
    ? { founder: { "@type": "Person", name: BRAND.founder.name, jobTitle: BRAND.founder.jobTitle } }
    : {}),
  ...(BRAND.foundingDate ? { foundingDate: BRAND.foundingDate } : {}),
  ...(brandSameAs.length ? { sameAs: brandSameAs } : {}),
};

// Public navigation describes final marketing URLs, not account-app containment.
function navigationFor(segment: string) {
  const locale = getLocale(segment);
  const links = [
    ...platformNavigationLinks.filter(link => link.href.startsWith('/')),
    { label: 'Resources', href: '/resources', description: 'Commerce guides for Indian merchants.' },
    { label: 'Support', href: '/support', description: 'Guides and contact options.' },
    { label: 'Contact', href: '/contact', description: 'Contact the LetBuyy team.' },
    { label: 'Legal', href: '/legal', description: 'Public policies and grievance information.' },
  ];
  return links.map(link => ({ ...link, href: `${siteUrl}${localePath(locale, link.href)}` }));
}

const softwareNode = {
  "@type": "SoftwareApplication",
  name: "LetBuyy",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: siteUrl,
  description: siteDescription,
  publisher: { "@id": orgId },

};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Middleware replaces this header from the actual path, never from caller input.
  // headers() intentionally makes document rendering request-aware for SSR language.
  const locale = getLocale((await headers()).get('x-letbuyy-locale') ?? 'in');
  const links = navigationFor(locale.segment);
  const websiteNode = {
    '@type': 'WebSite', '@id': websiteId, name: 'LetBuyy', url: siteUrl,
    inLanguage: LOCALES.map(entry => entry.hreflang), publisher: { '@id': orgId },
    hasPart: links.map(link => ({ '@type': 'WebPage', name: link.label, url: link.href, description: link.description })),
  };
  const navigationNodes = links.map(link => ({
    '@type': 'SiteNavigationElement', name: link.label, url: link.href,
    description: link.description, isPartOf: { '@id': websiteId },
  }));
  const structuredData = { '@context': 'https://schema.org', '@graph': [organizationNode, websiteNode, softwareNode, ...navigationNodes] };
  return (
    <html lang={locale.language.bcp47} dir={locale.language.dir} className={fontVariables} suppressHydrationWarning>
      <head>
        <ThemeScript />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
      </head>
      <body className="antialiased">
        <LetbuyyThemeProvider surface="storefront" className="marketing-site">
          <MarketingMotionProvider>{children}</MarketingMotionProvider>
        </LetbuyyThemeProvider>
      </body>
    </html>
  );
}
