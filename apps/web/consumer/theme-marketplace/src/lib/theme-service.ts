import { db } from '@/lib/supabase/server';

/**
 * Theme Service — Supabase-backed queries for the Theme Marketplace
 * Replaces the mock data helpers in theme-data.ts
 */

export interface ThemeFilters {
    category?: string;
    pricingType?: string;
    siteType?: string;
    industry?: string;
    search?: string;
    sort?: 'popular' | 'rating' | 'recent' | 'name' | 'price_low' | 'price_high';
    limit?: number;
    offset?: number;
}

export interface ThemeSearchResult {
    themes: Record<string, unknown>[];
    total: number;
    limit: number;
    offset: number;
}

export const ThemeService = {
    /**
     * List themes with filters, sorting, and pagination
     */
    async listThemes(filters: ThemeFilters = {}): Promise<ThemeSearchResult> {
        if (!db) {
            console.error('[ThemeService] Database not configured');
            return { themes: [], total: 0, limit: 20, offset: 0 };
        }

        const {
            category,
            pricingType,
            siteType,
            industry,
            search,
            sort = 'popular',
            limit = 20,
            offset = 0,
        } = filters;

        let query = db
            .from('themes')
            .select('*', { count: 'exact' })
            .eq('is_active', true);

        // Filters
        if (category) {
            query = query.eq('category', category);
        }
        if (pricingType) {
            query = query.eq('letbuyy_pricing_type', pricingType);
        }
        if (siteType) {
            query = query.contains('supported_site_types', [siteType]);
        }
        if (industry) {
            query = query.contains('industry', [industry]);
        }
        if (search) {
            const pattern = `%${search}%`;
            query = query.or(`name.ilike.${pattern},description.ilike.${pattern},tags.cs.{${search}}`);
        }

        // Sort
        switch (sort) {
            case 'rating':
                query = query.order('rating_avg', { ascending: false });
                break;
            case 'recent':
                query = query.order('created_at', { ascending: false });
                break;
            case 'name':
                query = query.order('name', { ascending: true });
                break;
            case 'price_low':
                query = query.order('letbuyy_price_inr', { ascending: true });
                break;
            case 'price_high':
                query = query.order('letbuyy_price_inr', { ascending: false });
                break;
            case 'popular':
            default:
                query = query.order('install_count', { ascending: false });
        }

        query = query.range(offset, offset + limit - 1);

        const { data, count, error } = await query;

        if (error) {
            console.error('[ThemeService] Error listing themes:', error.message);
            return { themes: [], total: 0, limit, offset };
        }

        return {
            themes: data || [],
            total: count || 0,
            limit,
            offset,
        };
    },

    /**
     * Get a single theme by slug
     */
    async getThemeBySlug(slug: string): Promise<Record<string, unknown> | null> {
        if (!db) return null;

        const { data, error } = await db
            .from('themes')
            .select('*')
            .eq('slug', slug)
            .eq('is_active', true)
            .single();

        if (error) {
            console.error('[ThemeService] Error fetching theme:', error.message);
            return null;
        }

        return data;
    },

    /**
     * Get reviews for a theme
     */
    async getThemeReviews(themeId: string, limit = 10, offset = 0) {
        if (!db) return { reviews: [], total: 0 };

        const { data, count, error } = await db
            .from('theme_reviews')
            .select('*', { count: 'exact' })
            .eq('theme_id', themeId)
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            console.error('[ThemeService] Error fetching reviews:', error.message);
            return { reviews: [], total: 0 };
        }

        return { reviews: data || [], total: count || 0 };
    },

    /**
     * Purchase a theme
     */
    async purchaseTheme(
        userId: string,
        themeId: string,
        priceUsd: number,
        priceInr: number,
        paymentId?: string,
        paymentMethod?: string
    ) {
        if (!db) return { success: false, error: 'Database not configured' };

        const { data, error } = await db
            .from('theme_purchases')
            .insert({
                user_id: userId,
                theme_id: themeId,
                price_paid_usd: priceUsd,
                price_paid_inr: priceInr,
                payment_id: paymentId,
                payment_method: paymentMethod,
                status: 'completed',
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return { success: false, error: 'Theme already purchased' };
            }
            console.error('[ThemeService] Error purchasing theme:', error.message);
            return { success: false, error: error.message };
        }

        return { success: true, purchase: data };
    },

    /**
     * Check if user owns a theme
     */
    async hasUserPurchased(userId: string, themeId: string): Promise<boolean> {
        if (!db) return false;

        const { data } = await db
            .from('theme_purchases')
            .select('id')
            .eq('user_id', userId)
            .eq('theme_id', themeId)
            .eq('status', 'completed')
            .single();

        return !!data;
    },

    /**
     * Get themes purchased by a user
     */
    async getUserPurchases(userId: string) {
        if (!db) return [];

        const { data, error } = await db
            .from('theme_purchases')
            .select('*, themes(*)')
            .eq('user_id', userId)
            .eq('status', 'completed')
            .order('purchased_at', { ascending: false });

        if (error) {
            console.error('[ThemeService] Error fetching purchases:', error.message);
            return [];
        }

        return data || [];
    },

    /**
     * Get unique categories from active themes
     */
    async getCategories(): Promise<string[]> {
        if (!db) return [];

        const { data, error } = await db
            .from('themes')
            .select('category')
            .eq('is_active', true)
            .not('category', 'is', null);

        if (error) {
            console.error('[ThemeService] Error fetching categories:', error.message);
            return [];
        }

        // Deduplicate
        const categories: string[] = [...new Set((data || []).map((d: { category: string }) => d.category))] as string[];
        return categories.sort();
    },

    /**
     * Get unique industries from active themes
     */
    async getIndustries(): Promise<string[]> {
        if (!db) return [];

        const { data, error } = await db
            .from('themes')
            .select('industry')
            .eq('is_active', true)
            .not('industry', 'is', null);

        if (error) {
            console.error('[ThemeService] Error fetching industries:', error.message);
            return [];
        }

        // Flatten and deduplicate
        const industries: string[] = [...new Set((data || []).flatMap((d: { industry: string[] }) => d.industry || []))] as string[];
        return industries.sort();
    },
};
