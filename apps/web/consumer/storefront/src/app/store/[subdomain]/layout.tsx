import { notFound } from 'next/navigation';
import { StoreService } from '@/lib/store-service';
import { ProductService } from '@/lib/product-service';
import { Metadata } from 'next';
import { CartProvider } from '@/context/cart-context';
import { CustomerAuthProvider } from '@/context/customer-auth-context';
import { WishlistProvider } from '@/context/wishlist-context';
import CartIcon from '@/components/cart-icon';
import Link from 'next/link';
import DynamicHeader from '@/components/layout/dynamic-header';
import DynamicFooter from '@/components/layout/dynamic-footer';
import ComingSoonRouter from '../../../../consumer-storefront/coming-soon';
import type { SiteType } from '../../../../consumer-storefront/coming-soon';
import { HeaderSettings, FooterSettings, ProductModel, THEME_PRESETS } from '@/types/store';

// ============= THEME FONT MAPPING =============
// Maps theme font names to CSS variables
const FONT_MAP: Record<string, string> = {
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

// Dark themes that need inverted text/bg colors (derived from THEME_PRESETS)
const DARK_THEMES = ['tech_elite', 'midnight_purple', 'luxury_premium'];

type Props = {
    children: React.ReactNode;
    params: Promise<{ subdomain: string }>;
};

export async function generateMetadata({ params }: { params: Promise<{ subdomain: string }> }): Promise<Metadata> {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomainAnyStatus(subdomain);

    if (!store) return { title: 'Store Not Found' };

    if (store.status !== 'published') {
        return {
            title: `${store.name} — Coming Soon`,
            description: `${store.name} is launching soon on LetBuyy!`,
        };
    }

    return {
        title: store.seoTitle || store.name,
        description: store.seoDescription || `Shop at ${store.name}`,
        icons: {
            icon: store.logoUrl || '/favicon.ico',
        }
    };
}

export default async function StoreLayout({ children, params }: Props) {
    const { subdomain } = await params;
    const store = await StoreService.getStoreBySubdomainAnyStatus(subdomain);

    if (!store) {
        return notFound();
    }

    // Show Coming Soon page for draft/suspended stores
    if (store.status !== 'published') {
        return (
            <ComingSoonRouter
                siteType={(store.siteType as SiteType) || 'store'}
                storeName={store.name}
                tagline={store.tagline}
                logoUrl={store.logoUrl}
            />
        );
    }

    // Fetch products for search — only for store-type sites
    const isStoreSite = store.siteType === 'store';
    let products: ProductModel[] = [];
    if (isStoreSite) {
        try {
            if (store.selectedProductIds && store.selectedProductIds.length > 0) {
                products = await ProductService.getProductsByIds(store.selectedProductIds);
            } else if (store.sellerId) {
                products = await ProductService.getProductsBySellerId(store.sellerId);
            }
        } catch (e) {
            console.error('Error fetching products for search:', e);
        }
    }

    // Extract Theme Settings from templateConfig
    const ts = store.templateConfig.themeSettings;
    const themeId = store.themeId || store.templateConfig.themeId || 'minimal_modern';

    // Get theme preset for accurate colors
    const themePreset = THEME_PRESETS[themeId] || {};

    // Determine if this is a dark theme (from preset or fallback array)
    const isDark = themePreset.isDark ?? DARK_THEMES.includes(themeId);

    // Get the appropriate font CSS variable
    const fontCss = FONT_MAP[ts.fontFamily] || FONT_MAP['Inter'];
    const headingFontCss = FONT_MAP[ts.headingFontFamily] || fontCss;

    // Use theme preset colors with fallbacks
    const backgroundColor = themePreset.backgroundColor || ts.backgroundColor || (isDark ? ts.primaryColor : '#FFFFFF');
    const textColor = themePreset.textColor || ts.textColor || (isDark ? '#FFFFFF' : '#1A1A2E');
    const surfaceColor = themePreset.surfaceColor || (isDark ? '#1e293b' : '#f9fafb');

    return (
        <>
            {/* Theme Variables - Dynamic based on store theme */}
            <style>{`
        :root {
          /* ===== BRAND COLORS (from selected theme) ===== */
          --primary: ${ts.primaryColor};
          --secondary: ${ts.secondaryColor};
          --accent: ${ts.accentColor || ts.primaryColor};
          --background: ${backgroundColor};
          --text: ${textColor};
          --radius: ${ts.borderRadius}px;
          
          /* ===== DYNAMIC TYPOGRAPHY (from selected theme) ===== */
          --font-main: ${fontCss}, system-ui, sans-serif;
          --font-heading: ${headingFontCss}, system-ui, sans-serif;
          
          /* ===== DESIGN TOKENS ===== */
          --enable-animations: ${ts.enableAnimations ? 1 : 0};
          --enable-shadows: ${ts.enableShadows ? 1 : 0};
          
          /* ===== DARK THEME FLAG ===== */
          --is-dark: ${isDark ? 1 : 0};
          
          /* ===== SEMANTIC TEXT COLORS (theme-aware) ===== */
          --text-secondary: ${isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'};
          --text-muted: ${isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'};
          --text-hint: ${isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'};
          --text-inverse: ${isDark ? '#000000' : '#FFFFFF'};
          
          /* ===== SEMANTIC BORDERS & SURFACES ===== */
          --border-color: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
          --surface: ${isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)'};
          --surface-hover: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'};
          
          /* ===== CARD BACKGROUNDS (solid, for cards/dialogs) ===== */
          --card-bg: ${isDark ? surfaceColor : '#ffffff'};
          --card-bg-secondary: ${isDark ? 'rgba(255,255,255,0.08)' : surfaceColor};
          --card-text: ${isDark ? '#f8fafc' : '#111827'};
          --card-text-muted: ${isDark ? '#94a3b8' : '#6b7280'};
          --card-border: ${isDark ? 'rgba(255,255,255,0.1)' : '#e5e7eb'};
          
          /* ===== HEADER SPECIFIC ===== */
          --header-bg-scrolled: ${isDark ? surfaceColor : '#ffffff'};
          --header-shadow: ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)'};
          
          /* ===== FOOTER SPECIFIC ===== */
          --footer-bg: ${isDark ? backgroundColor : '#0f172a'};
          --footer-text: ${isDark ? textColor : '#ffffff'};
          --footer-text-muted: ${isDark ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.6)'};
          
          /* ===== INPUT/FORM ELEMENTS ===== */
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
        
        .font-display {
            font-family: var(--font-heading) !important;
        }

        /* ===== GLASS EFFECT ===== */
        .glass {
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            background: ${isDark ? 'rgba(0, 0, 0, 0.5)' : 'rgba(255, 255, 255, 0.7)'};
            border: 1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(255, 255, 255, 0.2)'};
        }
        
        /* ===== SUBTLE SHADOWS ===== */
        .shadow-soft {
            box-shadow: 0 2px 15px -3px rgba(0, 0, 0, 0.07), 0 10px 20px -2px rgba(0, 0, 0, 0.04);
        }
        
        /* ===== DARK THEME SPECIFIC STYLES ===== */
        ${isDark ? `
        .card, .product-card {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
        }
        
        .product-card:hover {
            background: rgba(255, 255, 255, 0.1);
        }
        
        input, textarea, select {
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid rgba(255, 255, 255, 0.1);
            color: #FFFFFF;
        }
        
        input::placeholder, textarea::placeholder {
            color: rgba(255, 255, 255, 0.5);
        }
        ` : ''}
      `}</style>

            {isStoreSite ? (
                <CustomerAuthProvider storeId={store.id}>
                    <CartProvider>
                        <WishlistProvider storeId={store.id}>
                            <div className={`min-h-screen flex flex-col ${isDark ? 'dark' : ''}`} style={{ backgroundColor: 'var(--background)' }}>
                                {/* Dynamic Header - reads settings from store */}
                                <DynamicHeader
                                    store={store}
                                    settings={store.templateConfig.sections?.find(s => s.type === 'header')?.settings as HeaderSettings}
                                    products={products}
                                />

                                {/* Main Content */}
                                <main className="flex-grow">
                                    {children}
                                </main>

                                {/* Dynamic Footer - reads settings from store */}
                                <DynamicFooter
                                    store={store}
                                    settings={store.templateConfig.sections?.find(s => s.type === 'footer')?.settings as FooterSettings}
                                />
                            </div>
                        </WishlistProvider>
                    </CartProvider>
                </CustomerAuthProvider>
            ) : (
                <div className={`min-h-screen flex flex-col ${isDark ? 'dark' : ''}`} style={{ backgroundColor: 'var(--background)' }}>
                    {/* Dynamic Header - reads settings from store */}
                    <DynamicHeader
                        store={store}
                        settings={store.templateConfig.sections?.find(s => s.type === 'header')?.settings as HeaderSettings}
                        products={[]}
                    />

                    {/* Main Content */}
                    <main className="flex-grow">
                        {children}
                    </main>

                    {/* Dynamic Footer - reads settings from store */}
                    <DynamicFooter
                        store={store}
                        settings={store.templateConfig.sections?.find(s => s.type === 'footer')?.settings as FooterSettings}
                    />
                </div>
            )}
        </>
    );
}
