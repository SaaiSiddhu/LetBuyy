import { NextRequest, NextResponse } from 'next/server';
import { appMarketplaceErrorResponse, createAppMarketplaceApiClient } from '@/lib/api/client';

/**
 * POST /api/developers/apps — Submit a new app for review
 * Creates a record in `marketplace_apps` in draft status.
 */
export async function POST(request: NextRequest) {
    const body = await request.json();
    const { name, slug, tagline, description, category_id, app_url, privacy_url, pricing_model, price_monthly, save_as_draft } = body;

    if (!name || !tagline || !description || !category_id || !app_url || !privacy_url) {
        return NextResponse.json(
            { error: 'Name, tagline, description, category, app URL, and privacy URL are required' },
            { status: 400 }
        );
    }

    try {
        const api = await createAppMarketplaceApiClient({ requireSession: true });
        const data = await api.appStore.submitDeveloperApp({
            name,
            slug: slug || name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
            tagline,
            description,
            category_id: category_id || null,
            app_url,
            privacy_policy_url: privacy_url,
            pricing_model: pricing_model || 'free',
            price_monthly,
            save_as_draft,
        });
        return NextResponse.json({ data }, { status: 201 });
    } catch (error) {
        return appMarketplaceErrorResponse(error, 'App submission failed');
    }
}
