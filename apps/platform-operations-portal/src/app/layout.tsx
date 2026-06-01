import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { DesignSystemRoot } from "@letbuyy/ui";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LetBuyy Team Portal",
  description: "Employee portal for LetBuyy platform operations",
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.variable} antialiased`}>
        <DesignSystemRoot surface="operations">
          {children}
        </DesignSystemRoot>
      </body>
    </html>
  );
}
