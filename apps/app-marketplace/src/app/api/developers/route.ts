import { NextRequest, NextResponse } from 'next/server';
import { appMarketplaceErrorResponse, createAppMarketplaceApiClient } from '@/lib/api/client';

/**
 * GET /api/developers — Get developer profile for current user
 * POST /api/developers — Register as a developer
 * Both require authentication (enforced by middleware)
 */
export async function GET() {
    try {
        const api = await createAppMarketplaceApiClient({ requireSession: true });
        const data = await api.appStore.developer();
        return NextResponse.json({ data });
    } catch (error) {
        console.error('[API /developers GET] Error:', error);
        return appMarketplaceErrorResponse(error, 'Failed to fetch developer profile');
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { company_name, website, contact_email, bio } = body;

        if (!company_name || !contact_email) {
            return NextResponse.json(
                { error: 'Company name and contact email are required' },
                { status: 400 }
            );
        }

        const api = await createAppMarketplaceApiClient({ requireSession: true });
        const data = await api.appStore.registerDeveloper({
            company_name,
            website_url: website,
            support_email: contact_email,
            description: bio,
        });

        return NextResponse.json({ data }, { status: 201 });
    } catch {
        return NextResponse.json(
            { error: 'Invalid request body' },
            { status: 400 }
        );
    }
}
