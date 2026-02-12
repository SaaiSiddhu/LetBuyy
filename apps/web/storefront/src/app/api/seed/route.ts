import { NextResponse } from 'next/server';
import { db } from '@/lib/supabase';
import { DEFAULT_THEME_SETTINGS } from '@/types/store';

export async function GET() {
    try {
        const demoStore = {
            name: 'Urban Kicks Demo',
            store_name: 'urban-kicks-demo',
            subdomain: 'demo',
            site_type: 'store',
            status: 'published',
            theme_id: 'modern',
            theme_settings: {
                ...DEFAULT_THEME_SETTINGS,
                primaryColor: '#EC4899',
                secondaryColor: '#8B5CF6',
            },
            template_config: {
                themeId: 'modern',
                themeSettings: {
                    ...DEFAULT_THEME_SETTINGS,
                    primaryColor: '#EC4899',
                    secondaryColor: '#8B5CF6',
                },
                sections: [
                    {
                        id: 'hero-1',
                        type: 'heroBanner',
                        isVisible: true,
                        order: 0,
                        settings: {
                            heading: 'Summer Collection',
                            subheading: 'Up to 50% Off',
                            ctaText: 'Shop Now',
                            image: 'https://images.unsplash.com/photo-1552346154-21d32810aba3?q=80&w=2000',
                            overlay: 0.4,
                        }
                    },
                    {
                        id: 'grid-1',
                        type: 'productGrid',
                        isVisible: true,
                        order: 1,
                        settings: {
                            title: 'Featured Products',
                            columns: 4,
                        }
                    }
                ]
            }
        };

        const { data, error } = await db
            .from('stores')
            .upsert(demoStore, { onConflict: 'subdomain' })
            .select()
            .single();

        if (error) {
            return NextResponse.json({ success: false, error: error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, message: 'Demo store seeded', store: data });
    } catch (error) {
        console.error('Seed error:', error);
        return NextResponse.json({ success: false, error: 'Failed to seed' }, { status: 500 });
    }
}
