import type { Metadata } from "next";
import localFont from "next/font/local";
import { LetbuyyThemeProvider, ThemeScript } from "@letbuyy/ui";
import "./globals.css";

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
const DEFAULT_PLATFORM_ROOT_DOMAIN = "letbuyy.com";

function normalizeOrigin(rawValue: string | undefined): string | null {
  const value = rawValue?.trim();
  if (!value) return null;

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  try {
    return new URL(withProtocol).origin;
  } catch {
    return null;
  }
}

function getVercelDeploymentOrigin(): string | null {
  const vercelEnv = process.env.VERCEL_ENV?.trim();
  const productionOrigin = normalizeOrigin(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  const branchOrigin = normalizeOrigin(process.env.VERCEL_BRANCH_URL);
  const deploymentOrigin = normalizeOrigin(process.env.VERCEL_URL);

  if (vercelEnv === "production") {
    return productionOrigin ?? deploymentOrigin ?? branchOrigin;
  }

  return branchOrigin ?? deploymentOrigin ?? productionOrigin;
}

function getConfiguredPlatformRootDomain(): string {
  return (
    process.env.NEXT_PUBLIC_PLATFORM_ROOT_DOMAIN?.trim()
    || process.env.PLATFORM_ROOT_DOMAIN?.trim()
    || DEFAULT_PLATFORM_ROOT_DOMAIN
  );
}

function getAccountsMetadataBase(): URL {
  const accountsUrl = (
    process.env.NEXT_PUBLIC_ACCOUNTS_URL?.trim()
    || getVercelDeploymentOrigin()
    || `https://accounts.${getConfiguredPlatformRootDomain()}`
  );
  return new URL(accountsUrl);
}

export const metadata: Metadata = {
  metadataBase: getAccountsMetadataBase(),
  title: "LetBuyy - Create Your Online Store",
  description: "Build beautiful online stores, blogs, and landing pages with LetBuyy Store Builder",
  // Authentication surfaces must never be indexed (login, signup, OTP, OAuth,
  // password, onboarding). They carry no SEO value and can leak query params.
  robots: { index: false, follow: false },
  icons: {
    icon: "/icons/app_icon.png",
    apple: "/icons/app_icon.png",
  },
  openGraph: {
    title: "LetBuyy - Create Your Online Store",
    description: "Build beautiful online stores, blogs, and landing pages",
    images: ["/icons/app_icon.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        <ThemeScript forcedTheme="light" />
        <style suppressHydrationWarning dangerouslySetInnerHTML={{
          __html: `html { background: var(--lb-color-bg, white); }`
        }} />
      </head>
      <body className="antialiased">
        {/* surface="admin" + forcedTheme="light": the accounts/auth flow is the
            merchant identity surface, so it must carry the exact same ink
            primary/secondary brand as apps/merchant_web rather than
            the shared default violet "identity" surface used to fall back to. */}
        <LetbuyyThemeProvider surface="admin" forcedTheme="light">
          {children}
        </LetbuyyThemeProvider>
      </body>
    </html>
  );
}
