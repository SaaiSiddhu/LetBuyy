import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(req: NextRequest) {
    const query = req.nextUrl.searchParams.get('q')?.trim().toLowerCase();

    // Validation
    if (!query || query.length < 3) {
        return NextResponse.json({
            status: 'invalid',
            message: 'Store name must be at least 3 characters',
        });
    }

    if (!/^[a-zA-Z0-9-]+$/.test(query)) {
        return NextResponse.json({
            status: 'invalid',
            message: 'Store name can only contain letters, numbers, and hyphens',
        });
    }

    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );

        // 1. Try exact subdomain match first
        const { data: exactMatch, error: exactError } = await supabase
            .from('sites')
            .select('store_name, name, status, site_type')
            .eq('store_name', query)
            .not('status', 'eq', 'suspended')
            .limit(1);

        console.log('[store-lookup] Query:', query, 'Exact match:', exactMatch, 'Error:', exactError);

        if (exactMatch && exactMatch.length > 0) {
            const site = exactMatch[0];
            return NextResponse.json({
                status: 'found',
                store: {
                    name: site.name || site.store_name,
                    subdomain: site.store_name,
                    status: site.status,
                    siteType: site.site_type,
                },
            });
        }

        // 2. Fuzzy name search fallback
        const { data: fuzzyMatch } = await supabase
            .from('sites')
            .select('store_name, name, status, site_type')
            .ilike('name', `%${query}%`)
            .not('status', 'eq', 'suspended')
            .order('created_at', { ascending: false })
            .limit(1);

        if (fuzzyMatch && fuzzyMatch.length > 0) {
            const site = fuzzyMatch[0];
            return NextResponse.json({
                status: 'found',
                store: {
                    name: site.name || site.store_name,
                    subdomain: site.store_name,
                    status: site.status,
                    siteType: site.site_type,
                },
            });
        }

        return NextResponse.json({ status: 'not_found' });
    } catch (err) {
        console.error('[store-lookup] Error:', err);
        return NextResponse.json({ status: 'not_found' });
    }
}
