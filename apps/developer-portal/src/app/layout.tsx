import type { Metadata } from "next";
import localFont from "next/font/local";
import { DesignSystemRoot } from "@letbuyy/ui";
import { getDeveloperPortalUrl } from "@/lib/site-url";
import "./globals.css";

const siteUrl = getDeveloperPortalUrl();
const PLATFORM_ORIGIN = process.env.NEXT_PUBLIC_MARKETING_URL?.trim() || siteUrl;
const sharedOgImage = `${PLATFORM_ORIGIN}/og/letbuyy-default.png`;

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

const siteTitle = "LetBuyy Developers";
const siteDescription =
  "Developer documentation for LetBuyy APIs, OAuth, webhooks, app extensions, and JSON-contract themes.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "LetBuyy Developers",
  title: {
    default: siteTitle,
    template: "%s | LetBuyy Developers",
  },
  description: siteDescription,
  alternates: { canonical: "/" },
  robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-snippet": -1, "max-image-preview": "large" } },
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "LetBuyy Developers",
    locale: "en_IN",
    title: siteTitle,
    description: siteDescription,
    images: [{ url: sharedOgImage, width: 1200, height: 630, alt: "LetBuyy Developers" }],
  },
  twitter: { card: "summary_large_image", title: siteTitle, description: siteDescription, images: [sharedOgImage] },
};

const structuredData = [
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${PLATFORM_ORIGIN}/#organization`,
        name: "LetBuyy",
        url: PLATFORM_ORIGIN,
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        name: "LetBuyy Developers",
        url: siteUrl,
        inLanguage: "en-IN",
        publisher: { "@id": `${PLATFORM_ORIGIN}/#organization` },
      },
    ],
  },
];

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontVariables}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
        />
      </head>
      <body>
        <DesignSystemRoot surface="marketplace" density="compact" className="developer-shell">
          {children}
        </DesignSystemRoot>
      </body>
    </html>
  );
}
