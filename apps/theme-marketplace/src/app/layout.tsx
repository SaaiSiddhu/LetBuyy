import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Navbar from '@/components/layout/navbar';
import Footer from '@/components/layout/footer';
import ThemeProvider from '@/components/theme-provider';
import AuthProvider from '@/components/auth-provider';

const inter = Inter({
    subsets: ['latin'],
    variable: '--font-inter',
    display: 'swap',
});

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

export default function RootLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    return (
        <html lang="en" className={`${inter.variable}`} suppressHydrationWarning>
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
                <ThemeProvider>
                    <AuthProvider>
                        <Navbar />
                        <main className="flex-grow pt-[72px]">
                            {children}
                        </main>
                        <Footer />
                    </AuthProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
