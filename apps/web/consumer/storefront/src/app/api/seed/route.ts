import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { urbanKicks } from '@/lib/themes/store/urban-kicks';

/**
 * GET /api/seed — Seeds the Urban Kicks demo store
 * Uses the theme entry's demoConfig for full-fidelity seeding.
 */
export async function GET() {
    try {
        const demo = urbanKicks.demoConfig;

        const demoStore = {
            name: demo.name,
            store_name: 'urban-kicks-demo',
            subdomain: demo.subdomain,
            tagline: demo.tagline,
            site_type: demo.siteType,
            status: demo.status,
            theme_id: demo.themeId,
            selected_product_ids: demo.selectedProductIds,
            payment_gateways: demo.paymentGateways,
            template_config: {
                themeId: demo.templateConfig.themeId,
                themeSettings: demo.templateConfig.themeSettings,
                sections: demo.templateConfig.sections,
            },
        };

        const { data, error } = await db
            .from('stores')
            .upsert(demoStore, { onConflict: 'subdomain' })
            .select()
            .single();

        if (error) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Urban Kicks demo store seeded successfully',
            store: data,
            theme: {
                name: urbanKicks.name,
                slug: urbanKicks.slug,
                themeId: urbanKicks.themeId,
                preset: 'minimal_modern',
                colors: demo.templateConfig.themeSettings,
            },
        });
    } catch (error) {
        console.error('Seed error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to seed Urban Kicks demo' },
            { status: 500 }
        );
    }
}
