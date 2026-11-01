import type { Metadata } from "next";
import localFont from "next/font/local";
import { LetbuyyThemeProvider, ThemeScript } from "@letbuyy/ui";
import "./globals.css";

const letbuyySans = localFont({
  src: "../../../../../packages/typescript/ui/assets/fonts/inter-variable.woff2",
  variable: "--font-letbuyy-sans",
  display: "swap",
  weight: "100 900",
});

const letbuyyMono = localFont({
  src: "../../../../../packages/typescript/ui/assets/fonts/geist-mono-latin.woff2",
  variable: "--font-letbuyy-mono",
  display: "swap",
  weight: "100 900",
});

const fontVariables = `${letbuyySans.variable} ${letbuyyMono.variable}`;

export const metadata: Metadata = {
  title: "LetBuyy Admin",
  description: "Manage your LetBuyy store",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={fontVariables} data-theme="light" suppressHydrationWarning>
      <head>
        <ThemeScript defaultTheme="light" />
      </head>
      <body className="antialiased">
        <LetbuyyThemeProvider surface="admin" defaultTheme="light">
          {children}
        </LetbuyyThemeProvider>
      </body>
    </html>
  );
}
