import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { verifySession } from '@/lib/auth/session';

/**
 * POST /api/developers/apps — Submit a new app for review
 * Creates a record in `marketplace_apps` in draft status.
 */
export async function POST(request: NextRequest) {
    const session = await verifySession();
    if (!session) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const supabase = await createSupabaseServerClient();

    // Verify user is a registered developer
    const { data: developer } = await supabase
        .from('app_developers')
        .select('id, status')
        .eq('user_id', session.userId)
        .single();

    if (!developer) {
        return NextResponse.json(
            { error: 'You must register as a developer first' },
            { status: 403 }
        );
    }

    const body = await request.json();
    const { name, slug, tagline, description, category_id, app_url, privacy_url, pricing_model, price_monthly, save_as_draft } = body;

    if (!name || !tagline || !description || !category_id || !app_url || !privacy_url) {
        return NextResponse.json(
            { error: 'Name, tagline, description, category, app URL, and privacy URL are required' },
            { status: 400 }
        );
    }

    // Check slug uniqueness
    if (slug) {
        const { data: existingSlug } = await supabase
            .from('marketplace_apps')
            .select('id')
            .eq('slug', slug)
            .single();

        if (existingSlug) {
            return NextResponse.json(
                { error: 'This app slug is already taken. Please choose a different name.' },
                { status: 409 }
            );
        }
    }

    // Determine price in paisa (INR cents)
    const priceInr = price_monthly ? Math.round(parseFloat(price_monthly) * 100) : null;

    const { data: app, error } = await supabase
        .from('marketplace_apps')
        .insert({
            developer_id: developer.id,
            name,
            slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            tagline,
            description,
            category_id: category_id || null,
            app_url,
            privacy_policy_url: privacy_url,
            pricing_model: pricing_model || 'free',
            price_inr: priceInr,
            status: save_as_draft ? 'draft' : 'in_review',
            install_count: 0,
            rating_avg: 0,
            review_count: 0,
        })
        .select('id, name, status')
        .single();

    if (error) {
        console.error('[app submit] Error:', error.message);
        return NextResponse.json({ error: 'Failed to submit app' }, { status: 500 });
    }

    return NextResponse.json({
        success: true,
        app: {
            id: app.id,
            name: app.name,
            status: app.status,
        },
        message: save_as_draft
            ? 'App saved as draft'
            : 'App submitted for review. We will review it within 2 business days.',
    });
}
