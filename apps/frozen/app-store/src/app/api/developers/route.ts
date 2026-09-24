import { NextRequest, NextResponse } from 'next/server';
import { appMarketplaceErrorResponse, createAppMarketplaceApiClient } from '@/lib/api/client';
import { logger } from '@/lib/logger';

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
        logger.error('failed to fetch developer profile', { error: error instanceof Error ? error.message : String(error) });
        return appMarketplaceErrorResponse(error, 'Failed to fetch developer profile');
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => null);
        if (!body || typeof body !== 'object') {
            return NextResponse.json(
                { error: { code: 'VALIDATION', message: 'Invalid request body' } },
                { status: 400 },
            );
        }
        if (body?.action === 'collaborator_code') {
            const api = await createAppMarketplaceApiClient({ requireSession: true });
            const data = await api.appStore.collaboratorCode();
            return NextResponse.json({ data });
        }

        if (body?.action === 'redeem_collaborator_code') {
            if (typeof body.request_code !== 'string' || typeof body.site_id !== 'string') {
                return NextResponse.json(
                    { error: { code: 'VALIDATION', message: 'request_code and site_id are required' } },
                    { status: 400 },
                );
            }
            const api = await createAppMarketplaceApiClient({ requireSession: true });
            const data = await api.appStore.redeemCollaboratorCode({
                request_code: body.request_code,
                site_id: body.site_id,
            });
            return NextResponse.json({ data });
        }

        if (body?.action === 'partner_analytics') {
            const api = await createAppMarketplaceApiClient({ requireSession: true });
            const days = Number(body.days || 30);
            const data = await api.appStore.partnerAnalytics({
                days: Number.isFinite(days) ? Math.max(1, Math.min(90, Math.round(days))) : 30,
            });
            return NextResponse.json({ data });
        }

        if (body?.action === 'partner_tiers') {
            const api = await createAppMarketplaceApiClient({ requireSession: true });
            const data = await api.appStore.partnerTiers();
            return NextResponse.json({ data });
        }

        if (body?.action === 'sandbox_stores') {
            const api = await createAppMarketplaceApiClient({ requireSession: true });
            const data = await api.appStore.sandboxStores();
            return NextResponse.json({ data });
        }

        if (body?.action === 'request_sandbox_store') {
            const api = await createAppMarketplaceApiClient({ requireSession: true });
            const data = await api.appStore.requestSandboxStore({
                name: typeof body.name === 'string' ? body.name : undefined,
                provisioning_mode: body.provisioning_mode === 'test_store' || body.provisioning_mode === 'manual'
                    ? body.provisioning_mode
                    : 'sandbox',
            });
            return NextResponse.json({ data }, { status: 201 });
        }

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
    } catch (error) {
        logger.error('developer request failed', { error: error instanceof Error ? error.message : String(error) });
        return appMarketplaceErrorResponse(error, 'Developer request failed');
    }
}
