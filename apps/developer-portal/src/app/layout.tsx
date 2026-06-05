import type { Metadata } from "next";
import localFont from "next/font/local";
import { DesignSystemRoot } from "@letbuyy/ui";
import "./globals.css";

const letbuyySans = localFont({
  src: "../../../../packages/typescript/ui/assets/fonts/geist-sans-latin.woff2",
  variable: "--font-letbuyy-sans",
  display: "swap",
  weight: "100 900"
});

const letbuyyDisplay = localFont({
  src: "../../../../packages/typescript/ui/assets/fonts/geist-sans-latin-ext.woff2",
  variable: "--font-letbuyy-display",
  display: "swap",
  weight: "100 900"
});

const letbuyyMono = localFont({
  src: "../../../../packages/typescript/ui/assets/fonts/geist-mono-latin.woff2",
  variable: "--font-letbuyy-mono",
  display: "swap",
  weight: "100 900"
});

const fontVariables = `${letbuyySans.variable} ${letbuyyDisplay.variable} ${letbuyyMono.variable}`;

export const metadata: Metadata = {
  title: "LetBuyy Developer Portal",
  description: "Source-backed LetBuyy developer docs for API routes, OAuth, app webhooks, theme bundles, app blocks, and dashboard shell.",
  metadataBase: new URL("https://developers.letbuyy.store"),
  keywords: [
    "LetBuyy developers",
    "LetBuyy API",
    "LetBuyy OAuth",
    "LetBuyy webhooks",
    "LetBuyy theme SDK",
    "LetBuyy app SDK"
  ]
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontVariables} suppressHydrationWarning>
      <body>
        <DesignSystemRoot surface="marketplace" className="developer-shell">
          {children}
        </DesignSystemRoot>
      </body>
    </html>
  );
}

