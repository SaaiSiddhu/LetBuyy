import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";
import { getMarketingSiteUrl, getSupportEmail } from "@/lib/public-urls";
import { DesignSystemRoot } from "@letbuyy/ui";

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

// ── Entity identity ─────────────────────────────────────────────────────────
// Single place to wire LetBuyy's authoritative external profiles. Fill each in as
// you create it (Steps 1, 3 & 4 of docs/seo/LETBUYY_ENTITY_AND_SEO_MASTER_PLAYBOOK.md
// → "Entity Data Sheet"). Empty entries are filtered out, so it is safe to ship
// with these blank — nothing fabricated is published.
const BRAND_SAME_AS = [
  "", // https://www.wikidata.org/wiki/Q……               (Step 1 — Wikidata)
  "", // https://www.crunchbase.com/organization/letbuyy   (Step 1 — Crunchbase)
  "", // https://www.linkedin.com/company/letbuyy
  "", // https://www.instagram.com/letbuyy
  "", // https://x.com/letbuyy
  "", // https://www.youtube.com/@letbuyy
].filter(Boolean);
const FOUNDER_NAME = ""; // TODO — legal name to publish (fixes the "wrong CEO" hallucination)
const FOUNDING_YEAR = ""; // TODO — e.g. "2025"

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

const organizationNode = {
  "@type": "Organization",
  "@id": orgId,
  name: "LetBuyy",
  legalName: "LetBuyy",
  // Alternate SPELLINGS of our own name only — never a competitor's, which would
  // tell Google the two are the same entity (the opposite of disambiguation).
  alternateName: ["Let Buyy", "Letbuyy", "LetBuyy Commerce"],
  url: siteUrl,
  logo: {
    "@type": "ImageObject",
    url: `${siteUrl}${logoImage}`,
    width: 512,
    height: 512,
  },
  image: `${siteUrl}${socialImage}`,
  description: siteDescription,
  slogan: "India-first commerce operating system",
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
  ...(FOUNDER_NAME
    ? { founder: { "@type": "Person", name: FOUNDER_NAME, jobTitle: "Founder & CEO" } }
    : {}),
  ...(FOUNDING_YEAR ? { foundingDate: FOUNDING_YEAR } : {}),
  ...(BRAND_SAME_AS.length ? { sameAs: BRAND_SAME_AS } : {}),
};

const websiteNode = {
  "@type": "WebSite",
  "@id": websiteId,
  name: "LetBuyy",
  url: siteUrl,
  inLanguage: "en-IN",
  publisher: { "@id": orgId },
};

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
    description: "Free launch tier available; paid plan pricing requires human approval.",
  },
};

const structuredData = [
  {
    "@context": "https://schema.org",
    "@graph": [organizationNode, websiteNode, softwareNode],
  },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        {/* Prevent flash of wrong theme */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const stored = localStorage.getItem('theme');
                const theme = stored || 'system';
                const resolved = theme === 'system' 
                  ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
                  : theme;
                document.documentElement.setAttribute('data-theme', resolved);
              })();
            `,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(structuredData).replace(/</g, "\\u003c"),
          }}
        />
      </head>
      <body className="antialiased">
        <DesignSystemRoot surface="storefront" theme="auto">
          <ThemeProvider>
            {children}
          </ThemeProvider>
        </DesignSystemRoot>
      </body>
    </html>
  );
}
