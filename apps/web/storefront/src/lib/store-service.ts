import { getDb, db } from './supabase';
import { StoreModel, DEFAULT_THEME_SETTINGS, ThemeSettings, SectionModel, SectionType, BlockModel, SiteType, PaymentGateway } from '@/types/store';

export const StoreService = {
    async getStoreBySubdomain(subdomain: string): Promise<StoreModel | null> {
        // Mock Data for "demo" and "localhost" (Always return this for testing)
        if (subdomain === 'demo' || subdomain === 'localhost') {
            console.log('[StoreService] Serving Mock Data for Demo');
            return getMockStore(subdomain);
        }

        try {
            console.log(`[StoreService] Fetching store for subdomain: ${subdomain}`);

            const { data, error } = await db
                .from('stores')
                .select('*')
                .eq('subdomain', subdomain)
                .eq('status', 'published')
                .limit(1)
                .single();

            if (error || !data) {
                console.warn(`[StoreService] No published store found for subdomain: ${subdomain}`, error?.message);
                return null;
            }

            return mapSupabaseToStore(data);

        } catch (error) {
            console.error('[StoreService] Error fetching store:', error);
            return null;
        }
    },

    async getStoreById(storeId: string): Promise<StoreModel | null> {
        try {
            const { data, error } = await db
                .from('stores')
                .select('*')
                .eq('id', storeId)
                .single();

            if (error || !data) return null;
            return mapSupabaseToStore(data);
        } catch (error) {
            console.error('[StoreService] Error fetching store by ID:', error);
            return null;
        }
    }
};

// ============= HELPER FUNCTIONS =============

function mapSupabaseToStore(data: Record<string, unknown>): StoreModel {
    const templateConfig = (data.template_config as Record<string, unknown>) || {};
    const themeSettings: ThemeSettings = {
        ...DEFAULT_THEME_SETTINGS,
        ...((templateConfig.themeSettings as Record<string, unknown>) || {}),
        primaryColor: (templateConfig.themeSettings as Record<string, unknown>)?.primaryColor as string || DEFAULT_THEME_SETTINGS.primaryColor,
        secondaryColor: (templateConfig.themeSettings as Record<string, unknown>)?.secondaryColor as string || DEFAULT_THEME_SETTINGS.secondaryColor,
        accentColor: (templateConfig.themeSettings as Record<string, unknown>)?.accentColor as string || DEFAULT_THEME_SETTINGS.accentColor,
        fontFamily: (templateConfig.themeSettings as Record<string, unknown>)?.fontFamily as string || DEFAULT_THEME_SETTINGS.fontFamily,
        borderRadius: (templateConfig.themeSettings as Record<string, unknown>)?.borderRadius as number ?? DEFAULT_THEME_SETTINGS.borderRadius,
    };

    const sections: SectionModel[] = ((templateConfig.sections as Array<Record<string, unknown>>) || []).map((s) => ({
        id: (s.id as string) || '',
        type: normalizeSectionType(s.type as string) as SectionType,
        order: (s.order as number) || 0,
        settings: (s.settings as Record<string, unknown>) || {},
        blocks: ((s.blocks as unknown) as BlockModel[]) || [],
        isVisible: s.isVisible !== false,
    }));

    // Parse payment gateways from store settings
    const paymentSettings = (data.payment_settings as Record<string, unknown>) || {};
    const gateways: PaymentGateway[] = (paymentSettings.gateways as PaymentGateway[]) || ['razorpay'];

    return {
        id: data.id as string,
        sellerId: data.user_id as string || '',
        name: (data.name as string) || 'Untitled Store',
        tagline: (data.tagline as string) || '',
        subdomain: data.subdomain as string,
        storeUrl: data.custom_domain as string,
        logoUrl: data.logo_url as string,
        bannerUrl: undefined,
        themeId: (data.theme_id as string) || (templateConfig.themeId as string) || 'modern',
        siteType: ((data.site_type as string) || 'store') as SiteType,
        selectedProductIds: [],
        status: ((data.status as string) || 'draft') as 'draft' | 'published' | 'suspended',
        plan: 'free',
        seoTitle: undefined,
        seoDescription: undefined,
        codEnabled: (data.cod_enabled as boolean) ?? true,
        onlinePaymentEnabled: (data.online_payment_enabled as boolean) ?? true,
        paymentGateways: gateways,
        createdAt: data.created_at as string,
        updatedAt: data.updated_at as string,
        publishedAt: data.published_at as string,
        templateConfig: {
            storeId: data.id as string,
            themeId: (data.theme_id as string) || (templateConfig.themeId as string) || 'modern',
            themeSettings,
            sections,
        },
    };
}

// Normalize section type names (handle legacy 'hero' -> 'heroBanner', 'product_grid' -> 'productGrid')
function normalizeSectionType(type: string): string {
    const typeMap: Record<string, string> = {
        'hero': 'heroBanner',
        'product_grid': 'productGrid',
        'featured_collection': 'featuredProducts',
        'portfolio_grid': 'portfolioGrid',
        'skills_section': 'skillsSection',
        'experience_timeline': 'experienceTimeline',
        'contact_form': 'contactForm',
        'cta_section': 'ctaSection',
        'services_grid': 'servicesGrid',
    };
    return typeMap[type] || type;
}

// ============= MOCK DATA =============

function getMockStore(subdomain: string): StoreModel {
    return {
        id: 'mock-store',
        sellerId: 'mock-owner',
        name: 'Urban Kicks',
        tagline: 'Premium Streetwear & Sneakers',
        subdomain: subdomain,
        themeId: 'minimal_modern',
        siteType: 'store',
        selectedProductIds: ['1', '2', '3', '4'],
        status: 'published',
        paymentGateways: ['razorpay'],
        createdAt: new Date().toISOString(),
        templateConfig: {
            themeId: 'minimal_modern',
            themeSettings: {
                primaryColor: '#000000',
                secondaryColor: '#FFFFFF',
                accentColor: '#E5E5E5',
                backgroundColor: '#FFFFFF',
                textColor: '#1A1A2E',
                fontFamily: 'Inter',
                headingFontFamily: 'Inter',
                borderRadius: 12,
                enableAnimations: true,
                enableShadows: true,
            },
            sections: [
                {
                    id: 'hero-1',
                    type: 'heroBanner',
                    isVisible: true,
                    order: 0,
                    settings: {
                        heading: 'Streetwear 2026',
                        subheading: 'The future of fashion is here.',
                        ctaText: 'Shop New Arrivals',
                        ctaLink: '#products',
                        image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?q=80&w=2000',
                        overlay: 0.4,
                        height: 'full',
                        textAlign: 'center',
                    }
                },
                {
                    id: 'grid-1',
                    type: 'productGrid',
                    isVisible: true,
                    order: 1,
                    settings: {
                        title: 'Trending Drops',
                        subtitle: 'Hottest picks this season',
                        columns: 4,
                        showPrice: true,
                        showRating: true,
                        showAddToCart: true,
                    }
                },
                {
                    id: 'testimonials-1',
                    type: 'testimonials',
                    isVisible: true,
                    order: 2,
                    settings: {
                        title: 'What Our Customers Say',
                        layout: 'carousel',
                    },
                    blocks: [
                        { id: 't1', type: 'testimonialCard', order: 0, settings: { name: 'Priya S.', text: 'Amazing quality! Best sneakers I\'ve ever owned.', rating: 5 }, isVisible: true },
                        { id: 't2', type: 'testimonialCard', order: 1, settings: { name: 'Rahul K.', text: 'Fast delivery and excellent packaging. Highly recommend!', rating: 5 }, isVisible: true },
                        { id: 't3', type: 'testimonialCard', order: 2, settings: { name: 'Ananya M.', text: 'Love the designs! Will definitely order again.', rating: 4 }, isVisible: true },
                    ]
                }
            ]
        }
    };
}
