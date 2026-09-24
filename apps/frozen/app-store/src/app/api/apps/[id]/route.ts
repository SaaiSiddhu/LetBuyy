import { NextRequest, NextResponse } from 'next/server';
import { AppService } from '@/lib/app-service';
import { appMarketplaceErrorResponse, createAppMarketplaceApiClient } from '@/lib/api/client';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/apps/[id] — Get app details by id or slug
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;

    const app = await AppService.getAppBySlug(id);

    if (!app) {
        return NextResponse.json(
            { error: 'App not found' },
            { status: 404 }
        );
    }

    const { reviews } = await AppService.getAppReviews(app.id as string);

    return NextResponse.json({
        app,
        reviews,
    });
}

export async function POST(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;

    try {
        const body = await request.json().catch(() => ({}));
        if (body?.action === 'demo_session') {
            const api = await createAppMarketplaceApiClient({ requireSession: true });
            const data = await api.appStore.createDemoSession(id);
            return NextResponse.json({ data }, { status: 201 });
        }

        if (body?.action === 'generate_review_summary') {
            const accepted = await AppService.generateReviewSummary(id);
            if (!accepted) {
                return NextResponse.json(
                    { error: { code: 'MARKETPLACE_UNAVAILABLE', message: 'Could not request review summary generation' } },
                    { status: 503 }
                );
            }
            return NextResponse.json({ accepted: true }, { status: 202 });
        }

        if (body?.action === 'upsert_award') {
            if (typeof body.award_key !== 'string' || typeof body.label !== 'string') {
                return NextResponse.json(
                    { error: { code: 'VALIDATION', message: 'Award key and label are required' } },
                    { status: 400 }
                );
            }
            const award = await AppService.upsertAward(id, {
                award_key: body.award_key,
                label: body.label,
                year: typeof body.year === 'number' || typeof body.year === 'string' ? body.year : undefined,
                blurb: typeof body.blurb === 'string' ? body.blurb : null,
                status: body.status === 'draft' || body.status === 'published' || body.status === 'archived' ? body.status : 'published',
                metadata: body.metadata && typeof body.metadata === 'object' && !Array.isArray(body.metadata)
                    ? body.metadata as Record<string, unknown>
                    : {},
            });
            if (!award) {
                return NextResponse.json(
                    { error: { code: 'MARKETPLACE_UNAVAILABLE', message: 'Could not write app award' } },
                    { status: 503 }
                );
            }
            return NextResponse.json({ award }, { status: 200 });
        }

        if (body?.action === 'archive_award') {
            if (typeof body.award_key !== 'string') {
                return NextResponse.json(
                    { error: { code: 'VALIDATION', message: 'Award key is required' } },
                    { status: 400 }
                );
            }
            const archived = await AppService.archiveAward(
                id,
                body.award_key,
                typeof body.year === 'number' || typeof body.year === 'string' ? body.year : undefined
            );
            if (!archived) {
                return NextResponse.json(
                    { error: { code: 'MARKETPLACE_UNAVAILABLE', message: 'Could not archive app award' } },
                    { status: 503 }
                );
            }
            return NextResponse.json({ archived: true }, { status: 200 });
        }

        if (body?.action !== 'report_listing') {
            return NextResponse.json(
                { error: { code: 'VALIDATION', message: 'Unsupported app action' } },
                { status: 400 }
            );
        }

        const api = await createAppMarketplaceApiClient({ requireSession: true });
        const data = await api.appStore.reportListing(id, {
            reason_code: typeof body.reason_code === 'string' ? body.reason_code : 'merchant_report',
            reason_text: typeof body.reason_text === 'string' ? body.reason_text : null,
            site_id: typeof body.site_id === 'string' ? body.site_id : null,
            metadata: {},
        });

        return NextResponse.json({ data }, { status: 201 });
    } catch (error) {
        return appMarketplaceErrorResponse(error, 'Invalid request body');
    }
}
