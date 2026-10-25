import { notFound } from 'next/navigation';
import { StoreService } from '@/lib/store-service';
import { ProductService } from '@/lib/product-service';
import { Metadata } from 'next';
import { CartProvider } from '@/context/cart-context';
import { CustomerAuthProvider } from '@/context/customer-auth-context';
import { WishlistProvider } from '@/context/wishlist-context';
import ComingSoonRouter from '@/components/coming-soon';
import StorefrontAccessGate from '@/components/StorefrontAccessGate';
import type { SiteType } from '@/components/coming-soon';
import type { ProductModel } from '@letbuyy/commerce-core';
import { resolveStorefrontTemplate } from '@/lib/theme-engine/template-resolver';
import { StorefrontSectionGroupRenderer } from '@/lib/theme-engine/composition-engine';
import type { SectionRenderData } from '@/lib/theme-engine/types';
import { resolveThemePreviewToken } from '@/lib/theme-preview-server';
import { buildStoreMetadata, isStorefrontIndexable } from '@/lib/seo';
// D7: wire experience font hrefs into the store layout head.
import { buildGoogleFontsHref, fontFamilyWithFallback } from '@letbuyy/theme-engine';
import './liquid-theme.css';

export const revalidate = 60;

// ============= THEME FONT MAPPING =============
// D7: extended with the four missing experience font families.
const FONT_MAP: Record<string, string> = Object.fromEntries(['Inter', 'Outfit', 'Poppins', 'Lora', 'Space Grotesk', 'Playfair Display', 'Nunito', 'Open Sans', 'DM Sans', 'Montserrat', 'Cormorant Garamond', 'Libre Baskerville', 'Source Sans Pro', 'Lato'].map(family => [family, fontFamilyWithFallback(family)]));

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
            title: `${store.name} — Not Open Yet`,
            description: `${store.name} is not open yet on LetBuyy.`,
            robots: { index: false, follow: false },
        };
    }

    return {
        ...buildStoreMetadata(store, {
            title: store.seoTitle || store.name,
            description: store.seoDescription || store.tagline || `Shop at ${store.name}`,
            path: '/',
            noIndex: !isStorefrontIndexable(store),
        }),
        icons: {
            icon: store.logoUrl || '/favicon.ico',
        },
    };
}

export default async function StoreLayout({ children, params }: Props) {
    const { subdomain } = await params;
    const previewToken = await resolveThemePreviewToken(subdomain);
    const previewStore = previewToken
        ? await StoreService.getPreviewStoreBySubdomain(subdomain, previewToken)
        : null;
    const store = previewStore || await StoreService.getStoreBySubdomainAnyStatus(subdomain);
    const isEditorPreview = Boolean(previewToken);

    if (!store) {
        return notFound();
    }

    // Show the gated storefront page for draft/suspended stores
    if (!previewStore && store.status !== 'published') {
        if (store.siteType === 'store') return <StorefrontAccessGate storeName={store.name} message={store.tagline} />;
        return (
            <ComingSoonRouter
                siteType={(store.siteType as SiteType) || 'store'}
                storeName={store.name}
                tagline={store.tagline}
                logoUrl={store.logoUrl}
            />
        );
    }

    const renderPlan = resolveStorefrontTemplate(store, {
        type: 'index',
        path: `/store/${subdomain}`,
        subdomain,
    });
    // Liquid owns its GET search form and body data plan. Only the frozen React
    // chrome consumes this optional catalog; do not preload it for hidden chrome.
    const isStoreSite = store.siteType === 'store';
    let products: ProductModel[] = [];
    if (isStoreSite && renderPlan.rendererEngine !== 'liquid') {
        try {
            if (store.selectedProductIds && store.selectedProductIds.length > 0) {
                products = await ProductService.getProductsByIds(store.selectedProductIds, subdomain);
            } else {
                products = await ProductService.getProductsByStoreSubdomain(subdomain);
            }
        } catch (e) {
            console.error('Error fetching products for search:', e);
        }
    }

    // Extract Theme Settings from templateConfig
    const ts = store.templateConfig.themeSettings;
    const sectionGroupData = new Map<string, SectionRenderData>();
    for (const section of [...renderPlan.sectionGroups.header, ...renderPlan.sectionGroups.footer]) {
        sectionGroupData.set(section.id, { products });
    }

    // F5 — Chrome-Fallback Seam Fix.
    //
    // Problem (pre-fix): layout set liquidPage=true whenever renderPlan.rendererEngine==='liquid',
    // suppressing React chrome BEFORE the render ran. If the render then failed (renderLiquidPlan
    // returned null), StorefrontCompositionEngine fell back to React sections — but the React
    // header/footer was already gone, producing a chrome-less page.
    //
    // Fix: liquidPage remains plan-level (efficient, no extra render in layout). The seam is closed
    // by passing renderReactChromeOnFallback={true} to StorefrontCompositionEngine (via the children
    // chain) — but layout cannot pass props to `children` in the App Router RSC model.
    //
    // Therefore the fix moves the chrome responsibility: when liquidPage=true (plan says liquid) and
    // the render falls back to React, StorefrontCompositionEngine renders chrome sections from
    // plan.sectionGroups.header and plan.sectionGroups.footer around the React body. layout.tsx
    // passes sectionGroupData to children via the existing plan (already accessible in composition-
    // engine via plan.sectionGroups). The store and plan are passed to StorefrontCompositionEngine
    // so it can render the chrome sections on its own when falling back.
    //
    // This is correct: StorefrontCompositionEngine already has store + plan (with sectionGroups)
    // + sectionData. It already imports StorefrontSectionGroupRenderer. No architectural change needed.
    // See the composition-engine changes: when liquidHtml===null and plan.rendererEngine==='liquid',
    // the fallback renders <header sections><body sections><footer sections> rather than just body.
    const liquidPage = renderPlan.rendererEngine === 'liquid';
    const isDark = Boolean(ts.isDark);
    const fontCss = FONT_MAP[ts.fontFamily] || FONT_MAP['Inter'];
    const headingFontCss = FONT_MAP[ts.headingFontFamily] || fontCss;

    // D7: build Google Fonts href for the active experience fonts.
    // buildGoogleFontsHref returns null when all fonts are system fonts (already loaded locally).
    // preconnect links are emitted only when the href is non-null to avoid unnecessary DNS lookups.
    const googleFontsHref = buildGoogleFontsHref(
        // Pass both font families; buildGoogleFontsHref deduplicates and filters to known Google Fonts only.
        [ts.fontFamily, ts.headingFontFamily].filter((f): f is string => typeof f === 'string' && f.length > 0),
    );
    const backgroundColor = ts.backgroundColor || (isDark ? ts.primaryColor : 'rgb(255 255 255)');
    const textColor = ts.textColor || (isDark ? 'rgb(255 255 255)' : 'rgb(26 26 46)');
    const surfaceColor = ts.surfaceColor || (isDark ? 'rgb(30 41 59)' : 'rgb(249 250 251)');

    return (
        <>
            {/* D7: Google Fonts preconnect + stylesheet — only emitted when the active theme uses a
                Google Font (buildGoogleFontsHref returns null for local/system fonts). display=swap
                is baked into the href by buildGoogleFontsHref to avoid invisible text during load. */}
            {googleFontsHref && (
                <>
                    <link rel="preconnect" href="https://fonts.googleapis.com" />
                    <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
                    <link rel="stylesheet" href={googleFontsHref} />
                </>
            )}
            {/* Theme Variables - Dynamic based on store theme */}
            <style>{`
        :root {
          --primary: ${ts.primaryColor};
          --secondary: ${ts.secondaryColor};
          --accent: ${ts.accentColor || ts.primaryColor};
          --background: ${backgroundColor};
          --text: ${textColor};
          --foreground: ${textColor};
          --radius: ${ts.borderRadius}px;
          --font-main: ${fontCss}, system-ui, sans-serif;
          --font-heading: ${headingFontCss}, system-ui, sans-serif;
          --enable-animations: ${ts.enableAnimations ? 1 : 0};
          --enable-shadows: ${ts.enableShadows ? 1 : 0};
          --is-dark: ${isDark ? 1 : 0};
          --text-secondary: ${isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)'};
          --text-muted: ${isDark ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.4)'};
          --text-hint: ${isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'};
          --text-inverse: ${isDark ? 'rgb(0 0 0)' : 'rgb(255 255 255)'};
          --border-color: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'};
          --surface: ${surfaceColor};
          --surface-hover: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)'};
          --card-bg: ${isDark ? surfaceColor : 'rgb(255 255 255)'};
          --card-bg-secondary: ${isDark ? 'rgba(255,255,255,0.08)' : surfaceColor};
          --card-text: ${isDark ? 'rgb(248 250 252)' : 'rgb(17 24 39)'};
          --card-text-muted: ${isDark ? 'rgb(148 163 184)' : 'rgb(107 114 128)'};
          --card-border: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgb(229 231 235)'};
          --header-bg-scrolled: ${isDark ? surfaceColor : 'rgb(255 255 255)'};
          --header-shadow: ${isDark ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.05)'};
          --footer-bg: ${isDark ? backgroundColor : 'rgb(15 23 42)'};
          --footer-text: ${isDark ? textColor : 'rgb(255 255 255)'};
          --footer-text-muted: ${isDark ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.6)'};
          --input-bg: ${isDark ? 'rgba(255,255,255,0.05)' : 'rgb(249 250 251)'};
          --input-border: ${isDark ? 'rgba(255,255,255,0.1)' : 'rgb(229 231 235)'};
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
            color: rgb(255 255 255);
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
                                {liquidPage ? children : (
                                    <>
                                        <StorefrontSectionGroupRenderer
                                            store={store}
                                            plan={renderPlan}
                                            groupKey="header"
                                            sectionData={sectionGroupData}
                                            editorMode={isEditorPreview}
                                        />
                                        <main className="flex-grow">
                                            {children}
                                        </main>
                                        <StorefrontSectionGroupRenderer
                                            store={store}
                                            plan={renderPlan}
                                            groupKey="footer"
                                            sectionData={sectionGroupData}
                                            editorMode={isEditorPreview}
                                        />
                                    </>
                                )}
                            </div>
                        </WishlistProvider>
                    </CartProvider>
                </CustomerAuthProvider>
            ) : (
                <div className={`min-h-screen flex flex-col ${isDark ? 'dark' : ''}`} style={{ backgroundColor: 'var(--background)' }}>
                    {liquidPage ? children : (
                        <>
                            <StorefrontSectionGroupRenderer
                                store={store}
                                plan={renderPlan}
                                groupKey="header"
                                sectionData={sectionGroupData}
                                editorMode={isEditorPreview}
                            />
                            <main className="flex-grow">
                                {children}
                            </main>
                            <StorefrontSectionGroupRenderer
                                store={store}
                                plan={renderPlan}
                                groupKey="footer"
                                sectionData={sectionGroupData}
                                editorMode={isEditorPreview}
                            />
                        </>
                    )}
                </div>
            )}
        </>
    );
}
