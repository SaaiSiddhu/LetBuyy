import type { Metadata } from "next";
import { DesignSystemRoot } from "@letbuyy/ui";
import "./globals.css";

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
    <html lang="en">
      <body className="antialiased">
        <DesignSystemRoot surface="operations">
          {children}
        </DesignSystemRoot>
      </body>
    </html>
  );
}
