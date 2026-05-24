import { NextRequest, NextResponse } from 'next/server';
import { appStoreWorkerFetch, proxyWorkerJson } from '@/lib/api/worker-client';

/**
 * POST /api/developers/register — Register as an app developer
 * Creates a record in the `app_developers` table.
 */
export async function POST(request: NextRequest) {
    const body = await request.json();
    const { company_name, website_url, support_email, description, country } = body;

    if (!company_name || !support_email) {
        return NextResponse.json(
            { error: 'Company name and support email are required' },
            { status: 400 }
        );
    }

    const response = await appStoreWorkerFetch('/app-store/developers/register', {
        method: 'POST',
        requireSession: true,
        body: JSON.stringify({
            company_name,
            website_url: website_url || null,
            support_email,
            description: description || null,
            country: country || 'IN',
        }),
    });
    return proxyWorkerJson(response);
}
