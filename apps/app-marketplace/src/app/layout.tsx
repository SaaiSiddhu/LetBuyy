import type { Metadata } from "next";
import { DesignSystemRoot } from "@letbuyy/ui";
import "./globals.css";

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
        <html lang="en" suppressHydrationWarning>
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
