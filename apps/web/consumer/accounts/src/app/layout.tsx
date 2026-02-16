import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LetBuyy - Create Your Online Store",
  description: "Build beautiful online stores, portfolios, resumes, and landing pages with LetBuyy Store Builder",
  icons: {
    icon: "/icons/app_icon.png",
    apple: "/icons/app_icon.png",
  },
  openGraph: {
    title: "LetBuyy - Create Your Online Store",
    description: "Build beautiful online stores, portfolios, resumes, and landing pages",
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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script suppressHydrationWarning dangerouslySetInnerHTML={{ __html: themeScript }} />
        <style suppressHydrationWarning dangerouslySetInnerHTML={{
          __html: `
          html { background: #FFFFFF; }
          html.dark { background: #0A0F1A; }
        `}} />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@24,400,0,0"
          rel="stylesheet"
        />
      </head>
      <body className={`${inter.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
