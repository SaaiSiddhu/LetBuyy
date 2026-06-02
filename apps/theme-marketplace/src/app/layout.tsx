import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import localFont from 'next/font/local';
import './globals.css';
import Navbar from '@/components/layout/navbar';
import Footer from '@/components/layout/footer';
import ThemeProvider from '@/components/theme-provider';
import AuthProvider from '@/components/auth-provider';
import { LETBUYY_MERCHANT_SESSION_COOKIE, verifyLetbuyySessionCookieValue } from '@letbuyy/auth-core';
import { DesignSystemRoot } from '@letbuyy/ui';

const letbuyySans = localFont({
    src: '../../../../packages/typescript/ui/assets/fonts/geist-sans-latin.woff2',
    variable: '--font-letbuyy-sans',
    display: 'swap',
    weight: '100 900',
});

const letbuyyDisplay = localFont({
    src: '../../../../packages/typescript/ui/assets/fonts/geist-sans-latin-ext.woff2',
    variable: '--font-letbuyy-display',
    display: 'swap',
    weight: '100 900',
});

const letbuyyMono = localFont({
    src: '../../../../packages/typescript/ui/assets/fonts/geist-mono-latin.woff2',
    variable: '--font-letbuyy-mono',
    display: 'swap',
    weight: '100 900',
});

const fontVariables = `${letbuyySans.variable} ${letbuyyDisplay.variable} ${letbuyyMono.variable}`;

export const metadata: Metadata = {
    title: {
        default: 'LetBuyy Themes — Beautiful Themes for Every Business',
        template: '%s | LetBuyy Themes',
    },
    description:
        'Discover 50+ professionally designed themes for online stores, portfolios, resumes, and landing pages. Install in one click, customize everything.',
    keywords: [
        'themes', 'templates', 'ecommerce', 'store themes', 'portfolio themes',
        'next.js themes', 'react themes', 'website templates', 'letbuyy',
    ],
    openGraph: {
        type: 'website',
        locale: 'en_US',
        siteName: 'LetBuyy Themes',
        title: 'LetBuyy Themes — Beautiful Themes for Every Business',
        description: 'Discover 50+ professionally designed themes. Install in one click.',
    },
    twitter: {
        card: 'summary_large_image',
        title: 'LetBuyy Themes',
        description: 'Beautiful themes for every business.',
    },
    robots: {
        index: true,
        follow: true,
    },
};

export default async function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const cookieStore = await cookies();
    const session = verifyLetbuyySessionCookieValue(
        'merchant',
        cookieStore.get(LETBUYY_MERCHANT_SESSION_COOKIE)?.value,
    );

    return (
        <html lang="en" className={fontVariables} suppressHydrationWarning>
            <head>
                {/* Inline script to prevent flash of wrong theme */}
                <script
                    dangerouslySetInnerHTML={{
                        __html: `
                            (function() {
                                try {
                                    var stored = localStorage.getItem('theme-marketplace-theme');
                                    var theme = stored || 'system';
                                    var resolved = theme;
                                    if (theme === 'system') {
                                        resolved = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
                                    }
                                    document.documentElement.classList.add(resolved);
                                } catch(e) {}
                            })();
                        `,
                    }}
                />
            </head>
            <body className="min-h-screen flex flex-col">
                <DesignSystemRoot surface="marketplace" className="min-h-screen flex flex-col">
                    <ThemeProvider>
                        <AuthProvider initialAuthenticated={session.accepted}>
                            <Navbar />
                            <main className="flex-grow pt-[72px]">
                                {children}
                            </main>
                            <Footer />
                        </AuthProvider>
                    </ThemeProvider>
                </DesignSystemRoot>
            </body>
        </html>
    );
}
