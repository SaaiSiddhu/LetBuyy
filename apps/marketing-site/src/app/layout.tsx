import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { getAccountsUrl, getMarketingSiteUrl, getSupportEmail } from "@/lib/public-urls";
import { getPlatformNavigationLinks } from "@/lib/platform-links";
import { BRAND, buildBrandSameAs } from "@letbuyy/shared-types";
import { LetbuyyThemeProvider, ThemeScript } from "@letbuyy/ui";

const letbuyySans = localFont({
  src: "../../../../packages/typescript/ui/assets/fonts/geist-sans-latin.woff2",
  variable: "--font-letbuyy-sans",
  display: "swap",
  weight: "100 900",
});

const letbuyyDisplay = localFont({
  src: "../../../../packages/typescript/ui/assets/fonts/geist-sans-latin-ext.woff2",
  variable: "--font-letbuyy-display",
  display: "swap",
  weight: "100 900",
});

const letbuyyMono = localFont({
  src: "../../../../packages/typescript/ui/assets/fonts/geist-mono-latin.woff2",
  variable: "--font-letbuyy-mono",
  display: "swap",
  weight: "100 900",
});

const fontVariables = `${letbuyySans.variable} ${letbuyyDisplay.variable} ${letbuyyMono.variable}`;

const siteUrl = getMarketingSiteUrl();
const supportEmail = getSupportEmail();
const siteTitle = "LetBuyy - India-first commerce operating system";
const siteDescription =
  "Launch stores, blogs, and landing pages with one merchant workspace for themes, products, checkout readiness, and operations.";
const socialImage = "/og/letbuyy-default.png";
const logoImage = "/icons/letbuyy-logo-512.png";

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
    "theme marketplace",
    "app marketplace",
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
    icon: "/icons/letbuyy-mark.svg",
    shortcut: "/icons/letbuyy-mark.svg",
    apple: "/icons/letbuyy-mark.svg",
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
  knowsLanguage: ["en", "hi"],
  contactPoint: {
    "@type": "ContactPoint",
    contactType: "customer support",
    email: supportEmail,
    areaServed: "IN",
    availableLanguage: ["en", "hi"],
  },
  ...(BRAND.founder.name
    ? { founder: { "@type": "Person", name: BRAND.founder.name, jobTitle: BRAND.founder.jobTitle } }
    : {}),
  ...(BRAND.foundingDate ? { foundingDate: BRAND.foundingDate } : {}),
  ...(brandSameAs.length ? { sameAs: brandSameAs } : {}),
};

/* Marketing-site destinations that are not part of the cross-property nav but
   are primary entry points for someone searching the brand. Account links point
   straight at the accounts app rather than at our own /signup, which only
   redirects there. */
const siteEntryLinks = [
  {
    label: "Resources",
    href: `${siteUrl}/resources`,
    description: "Guides on selling online in India — payments, GST, shipping, and growth.",
  },
  {
    label: "Contact",
    href: `${siteUrl}/contact`,
    description: "Reach LetBuyy support, sales, and developer help.",
  },
  {
    label: "Legal",
    href: `${siteUrl}/legal`,
    description: "Terms, privacy, refunds, shipping, payouts, and grievance redressal.",
  },
  {
    label: "Sign up",
    href: getAccountsUrl("/signup"),
    description: "Create a LetBuyy merchant account and open a store.",
  },
];

/* Every destination worth surfacing under the brand result, in the order we
   would rank them ourselves. Google chooses sitelinks algorithmically — this
   only describes the site's own hierarchy, it does not select them. */
const siteNavigationLinks = [
  ...platformNavigationLinks.filter((link) => link.label !== "LetBuyy"),
  ...siteEntryLinks,
];

const websiteNode = {
  "@type": "WebSite",
  "@id": websiteId,
  name: "LetBuyy",
  url: siteUrl,
  inLanguage: "en-IN",
  publisher: { "@id": orgId },
  hasPart: siteNavigationLinks.map((link) => ({
    "@type": "WebPage",
    name: link.label,
    url: link.href,
    description: link.description,
  })),
};

const navigationNodes = siteNavigationLinks.map((link) => ({
  "@type": "SiteNavigationElement",
  name: link.label,
  url: link.href,
  description: link.description,
  isPartOf: { "@id": websiteId },
}));

const softwareNode = {
  "@type": "SoftwareApplication",
  name: "LetBuyy",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: siteUrl,
  description: siteDescription,
  publisher: { "@id": orgId },
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "INR",
    description: "Free launch tier available with 0% transaction and platform fees.",
  },
};

// Emitted as a top-level JSON-LD object (not wrapped in an array): multiple
// entities belong under "@graph". Consumers commonly read `parsed["@context"]`
// directly, which is undefined on a top-level array.
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [organizationNode, websiteNode, softwareNode, ...navigationNodes],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
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
        <LetbuyyThemeProvider surface="storefront">
          {children}
        </LetbuyyThemeProvider>
      </body>
    </html>
  );
}
