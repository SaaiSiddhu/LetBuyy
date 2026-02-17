/**
 * Urban Kicks — Dynamic Module
 * 
 * This module provides theme-specific configurations and component overrides
 * for the Urban Kicks theme when rendering with REAL store data.
 * 
 * Architecture:
 * - The shared `store/[subdomain]` layout handles providers, data fetching, and DynamicHeader/Footer
 * - This module provides theme-specific customizations, CSS tokens, and component overrides
 * - Route wrappers in `src/app/` import from here to compose the final pages
 * 
 * The dynamic module re-exports shared components with theme-aware defaults,
 * allowing the Urban Kicks theme to customize rendering without duplicating logic.
 */

import { ThemeSettings, THEME_PRESETS } from '@/types/store';

// ============= THEME CONFIGURATION =============

/**
 * Urban Kicks theme identifier — matches the `themeId` in the database
 */
export const THEME_ID = 'urban_kicks' as const;

/**
 * Urban Kicks theme preset — colors, typography, and design tokens
 * Used by the layout to generate CSS custom properties
 */
export const THEME_PRESET = THEME_PRESETS[THEME_ID] || {};

/**
 * Default theme settings for Urban Kicks
 * Applied when store's templateConfig doesn't have full settings
 */
export const DEFAULT_THEME_SETTINGS: ThemeSettings = {
    primaryColor: '#000000',
    secondaryColor: '#ffffff',
    accentColor: '#000000',
    backgroundColor: '#ffffff',
    textColor: '#1A1A2E',
    fontFamily: 'Inter',
    headingFontFamily: 'Inter',
    borderRadius: 16,
    enableAnimations: true,
    enableShadows: true,
};

// ============= FONT MAPPING =============

export const FONT_MAP: Record<string, string> = {
    'Inter': 'var(--font-inter)',
    'Outfit': 'var(--font-outfit)',
    'Poppins': 'var(--font-poppins)',
    'Lora': 'var(--font-lora)',
    'Space Grotesk': 'var(--font-space-grotesk)',
    'Playfair Display': 'var(--font-playfair)',
    'Nunito': 'var(--font-nunito)',
    'Open Sans': 'var(--font-open-sans)',
    'DM Sans': 'var(--font-dm-sans)',
    'Montserrat': 'var(--font-montserrat)',
};

// ============= DARK THEME DETECTION =============

export const DARK_THEMES = ['tech_elite', 'midnight_purple', 'luxury_premium'];

export function isDarkTheme(themeId: string): boolean {
    const preset = THEME_PRESETS[themeId];
    return preset?.isDark ?? DARK_THEMES.includes(themeId);
}

// ============= CSS GENERATION =============

/**
 * Generate the full CSS custom properties block for the Urban Kicks theme.
 * Used by the store layout to inject theme variables into the page.
 */
export function generateThemeCSS(ts: ThemeSettings, themeId: string): string {
    const isDark = isDarkTheme(themeId);
    const preset = THEME_PRESETS[themeId] || {};
    const fontCss = FONT_MAP[ts.fontFamily] || FONT_MAP['Inter'];
    const headingFontCss = FONT_MAP[ts.headingFontFamily] || fontCss;
    const backgroundColor = preset.backgroundColor || ts.backgroundColor || (isDark ? ts.primaryColor : '#FFFFFF');
    const textColor = preset.textColor || ts.textColor || (isDark ? '#FFFFFF' : '#1A1A2E');
    const surfaceColor = preset.surfaceColor || (isDark ? '#1e293b' : '#f9fafb');

    return `
        :root {
            --primary: ${ts.primaryColor};
            --secondary: ${ts.secondaryColor};
            --accent: ${ts.accentColor || ts.primaryColor};
            --background: ${backgroundColor};
            --text: ${textColor};
            --radius: ${ts.borderRadius}px;
            --font-main: ${fontCss}, system-ui, sans-serif;
            --font-heading: ${headingFontCss}, system-ui, sans-serif;
            --enable-animations: ${ts.enableAnimations ? 1 : 0};
            --enable-shadows: ${ts.enableShadows ? 1 : 0};
            --is-dark: ${isDark ? 1 : 0};
            --text-secondary: ${isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'};
            --text-muted: ${isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'};
            --text-hint: ${isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'};
            --text-inverse: ${isDark ? '#000000' : '#FFFFFF'};
            --border-color: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
            --surface: ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'};
            --surface-hover: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'};
            --card-bg: ${isDark ? surfaceColor : '#ffffff'};
            --card-bg-secondary: ${isDark ? 'rgba(255,255,255,0.08)' : surfaceColor};
            --card-text: ${isDark ? '#f8fafc' : '#111827'};
            --card-text-muted: ${isDark ? '#94a3b8' : '#6b7280'};
            --card-border: ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'};
            --header-bg-scrolled: ${isDark ? surfaceColor : '#ffffff'};
            --header-shadow: ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)'};
            --footer-bg: ${isDark ? backgroundColor : '#0f172a'};
            --footer-text: ${isDark ? textColor : '#ffffff'};
            --footer-text-muted: ${isDark ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.6)'};
            --input-bg: ${isDark ? 'rgba(255,255,255,0.05)' : '#f9fafb'};
            --input-border: ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'};
            --input-text: ${textColor};
            --input-placeholder: ${isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'};
        }
        body {
            font-family: var(--font-main);
            color: var(--text);
            background-color: var(--background);
            -webkit-font-smoothing: antialiased;
        }
        h1, h2, h3, h4, h5, h6 {
            font-family: var(--font-heading);
            font-weight: 600;
            letter-spacing: -0.02em;
        }
        .font-display { font-family: var(--font-heading) !important; }
        .glass {
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            background: ${isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.7)'};
            border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)'};
        }
        .shadow-soft {
            box-shadow: 0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04);
        }
        ${isDark ? `
        .card, .product-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); }
        .product-card:hover { background: rgba(255,255,255,0.1); }
        input, textarea, select { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #FFFFFF; }
        input::placeholder, textarea::placeholder { color: rgba(255,255,255,0.5); }
        ` : ''}
    `;
}

// ============= NAV CONFIGURATION =============

/**
 * Default navigation links for Urban Kicks theme.
 * These are used when the store doesn't define custom nav items.
 */
export function getNavLinks(subdomain: string) {
    const base = `/store/${subdomain}`;
    return [
        { label: 'Home', href: base },
        { label: 'Shop', href: `${base}/shop` },
        { label: 'New Arrivals', href: `${base}/shop?sort=newest` },
        { label: 'Track Order', href: `${base}/orders` },
    ];
}

// ============= RE-EXPORTS =============
// Re-export shared components that the route wrappers use

export { default as EnhancedShopGrid } from '@/app/store/[subdomain]/shop/enhanced-shop-grid';
