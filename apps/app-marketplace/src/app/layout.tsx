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
    title: "LetBuyy App Store — Apps & Integrations",
    description: "Browse thousands of apps and integrations to grow your LetBuyy store. Find tools for marketing, shipping, payments, SEO, and more.",
    keywords: ["letbuyy", "app store", "ecommerce apps", "shopify alternatives", "india"],
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" className={fontVariables} suppressHydrationWarning>
            <head>
                {/* Theme flash prevention — synced with accounts app */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
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
                } catch(e) {}
              })();
            `,
                    }}
                />
                <style suppressHydrationWarning dangerouslySetInnerHTML={{
                    __html: `html { background: #FFFFFF; } html.dark { background: #0A0F1A; }`
                }} />
            </head>
            <body className="antialiased">
                <DesignSystemRoot surface="marketplace" className="appstore-shell">
                    {children}
                </DesignSystemRoot>
            </body>
        </html>
    );
}
