import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import localFont from 'next/font/local';
import './globals.css';
import Navbar from '@/components/layout/navbar';
import Footer from '@/components/layout/footer';
import AuthProvider from '@/components/auth-provider';
import { LETBUYY_MERCHANT_SESSION_COOKIE, verifyLetbuyySessionCookieValue } from '@letbuyy/auth-core';
import { LetbuyyThemeProvider, ThemeScript, ToastProvider } from '@letbuyy/ui';
import { getThemeMarketplaceUrl } from '@/lib/site-url';
import { ThemeService } from '@/lib/theme-service';

const siteUrl = getThemeMarketplaceUrl();
const PLATFORM_ORIGIN = process.env.NEXT_PUBLIC_MARKETING_URL?.trim() || siteUrl;
const sharedOgImage = `${PLATFORM_ORIGIN}/og/letbuyy-default.png`;

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
    metadataBase: new URL(siteUrl),
    applicationName: 'LetBuyy Themes',
    title: {
        default: 'LetBuyy Themes — Beautiful Themes for Every Business',
        template: '%s | LetBuyy Themes',
    },
    description:
        'Discover governed LetBuyy themes for online stores, portfolios, resumes, blogs, and landing pages with store-scoped preview and install flows.',
    keywords: [
        'themes', 'templates', 'ecommerce', 'store themes', 'portfolio themes',
        'website templates', 'letbuyy', 'india',
    ],
    alternates: { canonical: '/' },
    openGraph: {
        type: 'website',
        url: siteUrl,
        locale: 'en_IN',
        siteName: 'LetBuyy Themes',
        title: 'LetBuyy Themes — Beautiful Themes for Every Business',
        description: 'Discover governed LetBuyy themes with store-scoped preview and install flows.',
        images: [{ url: sharedOgImage, width: 1200, height: 630, alt: 'LetBuyy Themes' }],
    },
    twitter: {
        card: 'summary_large_image',
        title: 'LetBuyy Themes',
        description: 'Beautiful themes for every business.',
        images: [sharedOgImage],
    },
    robots: {
        index: true,
        follow: true,
        googleBot: { index: true, follow: true, 'max-image-preview': 'large', 'max-snippet': -1 },
    },
};

const structuredData = [
    {
        '@context': 'https://schema.org',
        '@graph': [
            {
                '@type': 'Organization',
                '@id': `${PLATFORM_ORIGIN}/#organization`,
                name: 'LetBuyy',
                url: PLATFORM_ORIGIN,
            },
            {
                '@type': 'WebSite',
                '@id': `${siteUrl}/#website`,
                name: 'LetBuyy Themes',
                url: siteUrl,
                inLanguage: 'en-IN',
                publisher: { '@id': `${PLATFORM_ORIGIN}/#organization` },
            },
            {
                '@type': 'CollectionPage',
                name: 'LetBuyy Theme Marketplace',
                url: siteUrl,
                description: 'Professionally designed themes for stores, portfolios, blogs, and landing pages.',
                isPartOf: { '@id': `${siteUrl}/#website` },
            },
        ],
    },
];

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
    const initialUser = session.accepted ? await ThemeService.getSessionUser() : null;

    return (
        <html lang="en" className={fontVariables} suppressHydrationWarning>
            <head>
                <ThemeScript />
                <script
                    type="application/ld+json"
                    dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData).replace(/</g, '\\u003c') }}
                />
            </head>
            <body className="min-h-screen flex flex-col">
                <LetbuyyThemeProvider surface="marketplace" className="min-h-screen flex flex-col">
                    <AuthProvider initialAuthenticated={session.accepted} initialUser={initialUser}>
                        <ToastProvider>
                            <Navbar />
                            <main className="flex-grow pt-[72px]">
                                {children}
                            </main>
                            <Footer />
                        </ToastProvider>
                    </AuthProvider>
                </LetbuyyThemeProvider>
            </body>
        </html>
    );
}
