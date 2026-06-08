import type { Metadata } from "next";
import localFont from "next/font/local";
import { DesignSystemRoot } from "@letbuyy/ui";
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

function getAccountsMetadataBase(): URL {
  const accountsUrl = process.env.NEXT_PUBLIC_ACCOUNTS_URL?.trim() || getVercelDeploymentOrigin();
  if (!accountsUrl) {
    throw new Error("NEXT_PUBLIC_ACCOUNTS_URL is not configured; refusing to use a hardcoded accounts host");
  }
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

// Script to prevent theme flash - runs immediately before any rendering
const themeScript = `
  (function() {
    try {
      var theme = localStorage.getItem('letbuyy_theme');
      if (theme === 'dark') {
        document.documentElement.classList.add('dark');
        document.documentElement.style.colorScheme = 'dark';
      } else {
        document.documentElement.classList.remove('dark');
        document.documentElement.style.colorScheme = 'light';
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <head>
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeScript }} />
        <style suppressHydrationWarning dangerouslySetInnerHTML={{
          __html: `
          html { background: var(--lb-color-bg, white); }
          html.dark { background: var(--lb-color-bg, rgb(10 15 26)); }
        `}} />
      </head>
      <body className="antialiased">
        <DesignSystemRoot surface="identity">
          {children}
        </DesignSystemRoot>
      </body>
    </html>
  );
}
