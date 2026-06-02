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

export const metadata: Metadata = {
  title: "LetBuyy Console — Platform Control",
  description: "Super Admin Console for LetBuyy Platform",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="antialiased">
        <DesignSystemRoot surface="operations">
          {children}
        </DesignSystemRoot>
      </body>
    </html>
  );
}
