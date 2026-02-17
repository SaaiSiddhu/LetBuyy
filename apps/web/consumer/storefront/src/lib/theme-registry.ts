/**
 * Theme Registry
 * 
 * Central registry for all installed themes in the storefront.
 * Maps theme slugs to their module paths and capabilities.
 * 
 * When adding a new theme:
 * 1. Create the theme folder under `consumer-storefront/stores/{slug}/`
 * 2. Add preview/ and dynamic/ modules
 * 3. Register it here with its capabilities
 */

export interface ThemeRegistryEntry {
    /** Theme slug (matches folder name and DB themeId) */
    slug: string;
    /** Human-readable name */
    name: string;
    /** Theme description */
    description: string;
    /** Whether preview mode is available */
    hasPreview: boolean;
    /** Whether dynamic (real data) mode is available */
    hasDynamic: boolean;
    /** Supported site types */
    siteTypes: ('store' | 'portfolio' | 'resume' | 'landing' | 'blog')[];
    /** Whether the theme is currently active/available */
    isActive: boolean;
}

/**
 * All registered themes
 */
export const THEME_REGISTRY: Record<string, ThemeRegistryEntry> = {
    'urban-kicks': {
        slug: 'urban-kicks',
        name: 'Urban Kicks',
        description: 'A modern sneaker & streetwear storefront theme with premium aesthetics',
        hasPreview: true,
        hasDynamic: true,
        siteTypes: ['store'],
        isActive: true,
    },
    // Future themes will be registered here:
    // 'minimal-elegance': { ... },
    // 'tech-vault': { ... },
};

/**
 * Get a theme entry by slug
 */
export function getTheme(slug: string): ThemeRegistryEntry | undefined {
    return THEME_REGISTRY[slug];
}

/**
 * Get all active themes
 */
export function getActiveThemes(): ThemeRegistryEntry[] {
    return Object.values(THEME_REGISTRY).filter(t => t.isActive);
}

/**
 * Get themes that support a specific site type
 */
export function getThemesForSiteType(siteType: string): ThemeRegistryEntry[] {
    return getActiveThemes().filter(t => t.siteTypes.includes(siteType as any));
}

/**
 * Check if a theme slug is valid and active
 */
export function isValidTheme(slug: string): boolean {
    const theme = THEME_REGISTRY[slug];
    return !!theme && theme.isActive;
}

/**
 * Get the preview base path for a theme
 */
export function getPreviewPath(slug: string): string {
    return `/theme-preview/${slug}`;
}

/**
 * Get the store path for a subdomain
 */
export function getStorePath(subdomain: string): string {
    return `/store/${subdomain}`;
}
