import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * App Service — Supabase-backed queries for the App Store
 * Replaces the mock data helpers in mock-data.ts
 */

export interface AppFilters {
    category?: string;
    sort?: 'popular' | 'rating' | 'recent' | 'name';
    pricingModel?: string;
    siteType?: string;
    limit?: number;
    offset?: number;
}

export interface AppSearchResult {
    apps: Record<string, unknown>[];
    total: number;
    limit: number;
    offset: number;
}

export const AppService = {
    /**
     * List published apps with filters, sorting, and pagination
     */
    async listApps(filters: AppFilters = {}): Promise<AppSearchResult> {
        const supabase = await createSupabaseServerClient();
        const {
            category,
            sort = 'popular',
            pricingModel,
            siteType,
            limit = 20,
            offset = 0,
        } = filters;

        let query = supabase
            .from('marketplace_apps')
            .select('*, app_categories!inner(name, slug, icon), app_developers!inner(company_name, slug, logo_url, verified)', { count: 'exact' })
            .eq('status', 'published');

        // Filter by category
        if (category) {
            query = query.eq('app_categories.slug', category);
        }

        // Filter by pricing model
        if (pricingModel) {
            query = query.eq('pricing_model', pricingModel);
        }

        // Filter by supported site type
        if (siteType) {
            query = query.contains('supported_site_types', [siteType]);
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
            case 'popular':
            default:
                query = query.order('install_count', { ascending: false });
        }

        // Paginate
        query = query.range(offset, offset + limit - 1);

        const { data, count, error } = await query;

        if (error) {
            console.error('[AppService] Error listing apps:', error.message);
            return { apps: [], total: 0, limit, offset };
        }

        return {
            apps: data || [],
            total: count || 0,
            limit,
            offset,
        };
    },

    /**
     * Full-text search across apps
     */
    async searchApps(query: string, category?: string, limit = 20): Promise<AppSearchResult> {
        const supabase = await createSupabaseServerClient();

        // Use ilike for search (Supabase full-text search requires setup)
        const searchPattern = `%${query}%`;

        let dbQuery = supabase
            .from('marketplace_apps')
            .select('*, app_categories(name, slug, icon), app_developers(company_name, slug, logo_url, verified)', { count: 'exact' })
            .eq('status', 'published')
            .or(`name.ilike.${searchPattern},tagline.ilike.${searchPattern},description.ilike.${searchPattern}`);

        if (category) {
            dbQuery = dbQuery.eq('category_id', category);
        }

        dbQuery = dbQuery.order('install_count', { ascending: false }).limit(limit);

        const { data, count, error } = await dbQuery;

        if (error) {
            console.error('[AppService] Error searching apps:', error.message);
            return { apps: [], total: 0, limit, offset: 0 };
        }

        return {
            apps: data || [],
            total: count || 0,
            limit,
            offset: 0,
        };
    },

    /**
     * Get a single app by slug
     */
    async getAppBySlug(slug: string): Promise<Record<string, unknown> | null> {
        const supabase = await createSupabaseServerClient();

        const { data, error } = await supabase
            .from('marketplace_apps')
            .select('*, app_categories(name, slug, icon), app_developers(company_name, slug, logo_url, verified, website_url, support_email), app_extensions(*)')
            .eq('slug', slug)
            .eq('status', 'published')
            .single();

        if (error) {
            console.error('[AppService] Error fetching app:', error.message);
            return null;
        }

        return data;
    },

    /**
     * Get reviews for an app
     */
    async getAppReviews(appId: string, limit = 10, offset = 0) {
        const supabase = await createSupabaseServerClient();

        const { data, count, error } = await supabase
            .from('app_reviews')
            .select('*', { count: 'exact' })
            .eq('app_id', appId)
            .eq('status', 'published')
            .order('created_at', { ascending: false })
            .range(offset, offset + limit - 1);

        if (error) {
            console.error('[AppService] Error fetching reviews:', error.message);
            return { reviews: [], total: 0 };
        }

        return { reviews: data || [], total: count || 0 };
    },

    /**
     * Get all app categories
     */
    async getCategories() {
        const supabase = await createSupabaseServerClient();

        const { data, error } = await supabase
            .from('app_categories')
            .select('*')
            .eq('is_active', true)
            .order('sort_order', { ascending: true });

        if (error) {
            console.error('[AppService] Error fetching categories:', error.message);
            return [];
        }

        return data || [];
    },

    /**
     * Install an app on a store
     */
    async installApp(appId: string, storeId: string, userId: string, scopes: string[] = []) {
        const supabase = await createSupabaseServerClient();

        const { data, error } = await supabase
            .from('app_installations')
            .upsert({
                app_id: appId,
                store_id: storeId,
                installed_by: userId,
                status: 'active',
                scopes_granted: scopes,
                installed_at: new Date().toISOString(),
            }, { onConflict: 'app_id,store_id' })
            .select()
            .single();

        if (error) {
            console.error('[AppService] Error installing app:', error.message);
            return { success: false, error: error.message };
        }

        return { success: true, installation: data };
    },

    /**
     * Uninstall an app from a store
     */
    async uninstallApp(appId: string, storeId: string) {
        const supabase = await createSupabaseServerClient();

        const { error } = await supabase
            .from('app_installations')
            .update({ status: 'uninstalled', uninstalled_at: new Date().toISOString() })
            .eq('app_id', appId)
            .eq('store_id', storeId);

        if (error) {
            console.error('[AppService] Error uninstalling app:', error.message);
            return { success: false, error: error.message };
        }

        return { success: true };
    },

    /**
     * Check if an app is installed on a store
     */
    async isInstalled(appId: string, storeId: string): Promise<boolean> {
        const supabase = await createSupabaseServerClient();

        const { data } = await supabase
            .from('app_installations')
            .select('id')
            .eq('app_id', appId)
            .eq('store_id', storeId)
            .eq('status', 'active')
            .single();

        return !!data;
    },

    /**
     * Get apps installed on a store
     */
    async getInstalledApps(storeId: string) {
        const supabase = await createSupabaseServerClient();

        const { data, error } = await supabase
            .from('app_installations')
            .select('*, marketplace_apps(*, app_categories(name, slug, icon), app_developers(company_name, logo_url))')
            .eq('store_id', storeId)
            .eq('status', 'active')
            .order('installed_at', { ascending: false });

        if (error) {
            console.error('[AppService] Error fetching installed apps:', error.message);
            return [];
        }

        return data || [];
    },
};
