import { NextRequest, NextResponse } from 'next/server';
import { appStoreWorkerFetch, proxyWorkerJson } from '@/lib/api/worker-client';

/**
 * GET /api/developers — Get developer profile for current user
 * POST /api/developers — Register as a developer
 * Both require authentication (enforced by middleware)
 */
export async function GET() {
    try {
        const response = await appStoreWorkerFetch('/app-store/developers/me', {
            method: 'GET',
            requireSession: true,
        });
        return proxyWorkerJson(response);
    } catch (error) {
        console.error('[API /developers GET] Error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch developer profile' },
            { status: 500 }
        );
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

        const response = await appStoreWorkerFetch('/app-store/developers/register', {
            method: 'POST',
            requireSession: true,
            body: JSON.stringify({
                company_name,
                website_url: website,
                support_email: contact_email,
                description: bio,
            }),
        });

        return proxyWorkerJson(response);
    } catch {
        return NextResponse.json(
            { error: 'Invalid request body' },
            { status: 400 }
        );
    }
}
