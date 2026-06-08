import { NextRequest, NextResponse } from 'next/server';
import { appMarketplaceErrorResponse, createAppMarketplaceApiClient } from '@/lib/api/client';

/**
 * POST /api/developers/register — Register as an app developer
 * Creates a record in the `app_developers` table.
 */
export async function POST(request: NextRequest) {
    const body = await request.json();
    const { company_name, website_url, support_email, description, country, tax_id, agreed_tos, agreed_privacy } = body;

    if (!company_name || !support_email) {
        return NextResponse.json(
            { error: 'Company name and support email are required' },
            { status: 400 }
        );
    }

    try {
        const api = await createAppMarketplaceApiClient({ requireSession: true });
        const data = await api.appStore.registerDeveloper({
            company_name,
            website_url: website_url || null,
            support_email,
            description: description || null,
            country: country || 'IN',
            tax_id: tax_id || null,
            agreed_tos: agreed_tos === true,
            agreed_privacy: agreed_privacy === true,
        });
        return NextResponse.json({ data }, { status: 201 });
    } catch (error) {
        return appMarketplaceErrorResponse(error, 'Developer registration failed');
    }
}
