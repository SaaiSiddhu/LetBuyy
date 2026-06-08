import type { Metadata } from "next";
import localFont from "next/font/local";
import { LetbuyyThemeProvider, ThemeScript } from "@letbuyy/ui";
import { getAppMarketplaceUrl } from "@/lib/site-url";
import "./globals.css";

const siteUrl = getAppMarketplaceUrl();
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

const siteTitle = "LetBuyy App Store — Apps & Integrations";
const siteDescription =
    "Browse apps and integrations to grow your LetBuyy store. Find tools for marketing, shipping, payments, SEO, and more.";

export const metadata: Metadata = {
    metadataBase: new URL(siteUrl),
    applicationName: "LetBuyy App Store",
    title: {
        default: siteTitle,
        template: "%s | LetBuyy App Store",
    },
    description: siteDescription,
    keywords: ["letbuyy", "app store", "ecommerce apps", "integrations", "india"],
    alternates: { canonical: "/" },
    robots: { index: true, follow: true, googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 } },
    openGraph: {
        type: "website",
        url: siteUrl,
        siteName: "LetBuyy App Store",
        locale: "en_IN",
        title: siteTitle,
        description: siteDescription,
        images: [{ url: sharedOgImage, width: 1200, height: 630, alt: "LetBuyy App Store" }],
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
                name: "LetBuyy App Store",
                url: siteUrl,
                inLanguage: "en-IN",
                publisher: { "@id": `${PLATFORM_ORIGIN}/#organization` },
            },
            {
                "@type": "CollectionPage",
                name: "LetBuyy App Store",
                url: siteUrl,
                description: siteDescription,
                isPartOf: { "@id": `${siteUrl}/#website` },
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
        <html lang="en" className={fontVariables} suppressHydrationWarning>
            <head>
                <ThemeScript />
                <style suppressHydrationWarning dangerouslySetInnerHTML={{
                    __html: `html { background: var(--lb-color-bg, white); } html.dark { background: var(--lb-color-bg, rgb(10 15 26)); }`
                }} />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, "\\u003c") }}
                />
            </head>
            <body className="antialiased">
                <LetbuyyThemeProvider surface="marketplace" className="appstore-shell">
                    {children}
                </LetbuyyThemeProvider>
            </body>
        </html>
    );
}
