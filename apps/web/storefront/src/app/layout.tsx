import type { Metadata } from "next";
import {
  Inter,
  Outfit,
  Poppins,
  Lora,
  Space_Grotesk,
  Playfair_Display,
  Nunito,
  Open_Sans,
  DM_Sans,
  Montserrat
} from "next/font/google";
import "./globals.css";
import { SpeedInsights } from "@vercel/speed-insights/next";

// ============= THEME FONTS =============
// All 10 theme fonts loaded for dynamic theme support

// Minimal Modern & Default
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Fresh Mint
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

// Vibrant Bold
const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

// Natural Organic
const lora = Lora({
  variable: "--font-lora",
  subsets: ["latin"],
});

// Tech Elite
const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
});

// Luxury Premium
const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

// Sunset Gradient
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin"],
});

// Ocean Breeze
const openSans = Open_Sans({
  variable: "--font-open-sans",
  subsets: ["latin"],
});

// Midnight Purple
const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

// Royal Rose
const montserrat = Montserrat({
  variable: "--font-montserrat",
  subsets: ["latin"],
});

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
      <body
        className={`
          ${inter.variable} 
          ${outfit.variable} 
          ${poppins.variable} 
          ${lora.variable} 
          ${spaceGrotesk.variable} 
          ${playfairDisplay.variable}
          ${nunito.variable} 
          ${openSans.variable} 
          ${dmSans.variable} 
          ${montserrat.variable}
          antialiased
        `}
      >
        {children}
        <SpeedInsights />
      </body>
    </html>
  );
}
