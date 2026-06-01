import type { Metadata } from "next";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { DesignSystemRoot } from "@letbuyy/ui";

export const metadata: Metadata = {
  title: "LetBuyy Store",
  description: "Your online store powered by LetBuyy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <DesignSystemRoot surface="storefront">
          {children}
        </DesignSystemRoot>
        <SpeedInsights />
      </body>
    </html>
  );
}
