import type { Metadata } from "next";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import localFont from "next/font/local";
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

export const metadata: Metadata = {
  title: "LetBuyy Store",
  description: "Your online store powered by LetBuyy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="antialiased">
        <DesignSystemRoot surface="storefront">
          {children}
        </DesignSystemRoot>
        <SpeedInsights />
      </body>
    </html>
  );
}
