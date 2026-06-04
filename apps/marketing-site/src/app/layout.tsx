import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeProvider";

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

const siteUrl = "https://letbuyy.com";
const siteTitle = "LetBuyy - India-first commerce operating system";
const siteDescription =
  "Launch stores, portfolios, resumes, blogs, and landing pages with one merchant workspace for themes, products, checkout readiness, and operations.";
const socialImage = "/icons/landscape_logo.png";

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
    "portfolio builder",
    "resume website builder",
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
    icon: "/favicon.ico",
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
        width: 320,
        height: 80,
        alt: "LetBuyy commerce operating system",
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

const structuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "LetBuyy",
    url: siteUrl,
    logo: `${siteUrl}${socialImage}`,
    sameAs: ["https://letbuyy.store"],
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "LetBuyy",
    url: siteUrl,
  },
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "LetBuyy",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: siteUrl,
    description: siteDescription,
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
      description: "Free launch tier available; paid plan pricing requires human approval.",
    },
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
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
