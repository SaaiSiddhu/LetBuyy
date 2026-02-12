// ============================================================
// THEME MARKETPLACE — Types
// ============================================================

import { SiteType, StoreModel } from '@/types/store';

export type ThemePricing = 'free' | 'premium' | 'custom';

export interface ThemeEntry {
    slug: string;            // URL-safe: "urban-kicks"
    name: string;            // Display: "Urban Kicks"
    description: string;     // Short tagline
    longDescription: string; // Blog-style detail (markdown-safe)
    siteType: SiteType;      // 'store' | 'portfolio' | 'resume' | 'landing'
    themeId: string;         // Maps to THEME_PRESETS key
    pricing: ThemePricing;
    price?: number;          // If premium, price in USD
    tags: string[];          // e.g. ['streetwear', 'fashion']
    features: string[];      // e.g. ['Cart', 'Wishlist']
    thumbnailUrl: string;    // Preview image
    screenshots: string[];   // Gallery images for detail page
    author: string;
    version: string;
    rating: number;          // 1-5
    reviewCount: number;
    demoConfig: StoreModel;  // Full mock config for live demo
}
