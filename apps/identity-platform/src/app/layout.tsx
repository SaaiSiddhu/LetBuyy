import type { Metadata } from "next";
import { DesignSystemRoot } from "@letbuyy/ui";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_ACCOUNTS_URL || "https://accounts.letbuyy.store"),
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
      </head>
      <body className="antialiased">
        <DesignSystemRoot surface="identity">
          {children}
        </DesignSystemRoot>
      </body>
    </html>
  );
}
