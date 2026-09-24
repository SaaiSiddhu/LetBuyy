import { NextRequest, NextResponse } from 'next/server';
import { appMarketplaceErrorResponse, createAppMarketplaceApiClient } from '@/lib/api/client';

export async function GET() {
    try {
        const api = await createAppMarketplaceApiClient({ requireSession: true });
        const data = await api.appStore.developerApps();
        return NextResponse.json({ data });
    } catch (error) {
        return appMarketplaceErrorResponse(error, 'Failed to fetch developer apps');
    }
}

/**
 * POST /api/developers/apps — Submit a new app for review
 * Creates a record in `marketplace_apps` in draft status.
 */
export async function POST(request: NextRequest) {
    const contentType = request.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
        try {
            const formData = await request.formData();
            const file = formData.get('file');
            if (!file || typeof file === 'string') {
                return NextResponse.json({ error: { code: 'VALIDATION', message: 'file is required' } }, { status: 400 });
            }
            const mediaFile = file as File;
            const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml']);
            if (!allowedTypes.has(mediaFile.type)) {
                return NextResponse.json({ error: { code: 'VALIDATION', message: 'Only PNG, JPG, WebP, or SVG app media is supported' } }, { status: 400 });
            }
            if (mediaFile.size > 10 * 1024 * 1024) {
                return NextResponse.json({ error: { code: 'VALIDATION', message: 'App media must be 10MB or smaller' } }, { status: 400 });
            }
            const api = await createAppMarketplaceApiClient({ requireSession: true });
            const data = await api.upload.file(formData);
            return NextResponse.json({ data }, { status: 201 });
        } catch (error) {
            return appMarketplaceErrorResponse(error, 'Media upload failed');
        }
    }

    const body = await request.json();
    if (body?.action === 'validate_manifest') {
        try {
            const manifest = body.manifest && typeof body.manifest === 'object' ? body.manifest : {};
            const api = await createAppMarketplaceApiClient({ requireSession: true });
            const data = await api.appStore.validateDeveloperAppManifest({ manifest });
            return NextResponse.json({ data });
        } catch (error) {
            return appMarketplaceErrorResponse(error, 'Manifest validation failed');
        }
    }

    if (body?.action === 'rotate_api_key') {
        try {
            if (typeof body.app_id !== 'string') {
                return NextResponse.json({ error: { code: 'INVALID_APP_ID', message: 'app_id is required' } }, { status: 400 });
            }
            const api = await createAppMarketplaceApiClient({ requireSession: true });
            const data = await api.appStore.rotateDeveloperAppKey(body.app_id);
            return NextResponse.json({ data });
        } catch (error) {
            return appMarketplaceErrorResponse(error, 'API key rotation failed');
        }
    }

    if (body?.action === 'list_pricing_plans') {
        try {
            if (typeof body.app_id !== 'string') {
                return NextResponse.json({ error: { code: 'INVALID_APP_ID', message: 'app_id is required' } }, { status: 400 });
            }
            const api = await createAppMarketplaceApiClient({ requireSession: true });
            const data = await api.appStore.developerAppPricingPlans(body.app_id);
            return NextResponse.json({ data });
        } catch (error) {
            return appMarketplaceErrorResponse(error, 'Pricing plans could not be loaded');
        }
    }

    if (body?.action === 'create_pricing_plan') {
        try {
            if (typeof body.app_id !== 'string') {
                return NextResponse.json({ error: { code: 'INVALID_APP_ID', message: 'app_id is required' } }, { status: 400 });
            }
            const api = await createAppMarketplaceApiClient({ requireSession: true });
            const data = await api.appStore.createDeveloperAppPricingPlan(body.app_id, body.plan);
            return NextResponse.json({ data }, { status: 201 });
        } catch (error) {
            return appMarketplaceErrorResponse(error, 'Pricing plan could not be created');
        }
    }

    if (body?.action === 'update_pricing_plan') {
        try {
            if (typeof body.app_id !== 'string' || typeof body.plan_id !== 'string') {
                return NextResponse.json({ error: { code: 'INVALID_PLAN_ID', message: 'app_id and plan_id are required' } }, { status: 400 });
            }
            const api = await createAppMarketplaceApiClient({ requireSession: true });
            const data = await api.appStore.updateDeveloperAppPricingPlan(body.app_id, body.plan_id, body.plan);
            return NextResponse.json({ data });
        } catch (error) {
            return appMarketplaceErrorResponse(error, 'Pricing plan could not be updated');
        }
    }

    if (body?.action === 'archive_pricing_plan') {
        try {
            if (typeof body.app_id !== 'string' || typeof body.plan_id !== 'string') {
                return NextResponse.json({ error: { code: 'INVALID_PLAN_ID', message: 'app_id and plan_id are required' } }, { status: 400 });
            }
            const api = await createAppMarketplaceApiClient({ requireSession: true });
            const data = await api.appStore.archiveDeveloperAppPricingPlan(body.app_id, body.plan_id);
            return NextResponse.json({ data });
        } catch (error) {
            return appMarketplaceErrorResponse(error, 'Pricing plan could not be archived');
        }
    }

    if (body?.action === 'list_usage') {
        try {
            if (typeof body.app_id !== 'string') {
                return NextResponse.json({ error: { code: 'INVALID_APP_ID', message: 'app_id is required' } }, { status: 400 });
            }
            const limit = Number(body.limit || 25);
            const api = await createAppMarketplaceApiClient({ requireSession: true });
            const data = await api.appStore.developerAppUsage(body.app_id, {
                limit: Number.isFinite(limit) ? Math.max(1, Math.min(100, Math.round(limit))) : 25,
                meter_name: typeof body.meter_name === 'string' ? body.meter_name : undefined,
            });
            return NextResponse.json({ data });
        } catch (error) {
            return appMarketplaceErrorResponse(error, 'Usage meters could not be loaded');
        }
    }

    if (body?.action === 'list_api_usage') {
        try {
            if (typeof body.app_id !== 'string') {
                return NextResponse.json({ error: { code: 'INVALID_APP_ID', message: 'app_id is required' } }, { status: 400 });
            }
            const days = Number(body.days || 30);
            const api = await createAppMarketplaceApiClient({ requireSession: true });
            const data = await api.appStore.developerAppApiUsage(body.app_id, {
                days: Number.isFinite(days) ? Math.max(1, Math.min(90, Math.round(days))) : 30,
            });
            return NextResponse.json({ data });
        } catch (error) {
            return appMarketplaceErrorResponse(error, 'API usage metrics could not be loaded');
        }
    }

    if (body?.action === 'list_webhooks') {
        try {
            if (typeof body.app_id !== 'string') {
                return NextResponse.json({ error: { code: 'INVALID_APP_ID', message: 'app_id is required' } }, { status: 400 });
            }
            const api = await createAppMarketplaceApiClient({ requireSession: true });
            const data = await api.appStore.developerAppWebhooks(body.app_id);
            return NextResponse.json({ data });
        } catch (error) {
            return appMarketplaceErrorResponse(error, 'Webhook endpoints could not be loaded');
        }
    }

    if (body?.action === 'create_webhook') {
        try {
            if (typeof body.app_id !== 'string') {
                return NextResponse.json({ error: { code: 'INVALID_APP_ID', message: 'app_id is required' } }, { status: 400 });
            }
            const api = await createAppMarketplaceApiClient({ requireSession: true });
            const data = await api.appStore.createDeveloperAppWebhook(body.app_id, body.webhook || {});
            return NextResponse.json({ data }, { status: 201 });
        } catch (error) {
            return appMarketplaceErrorResponse(error, 'Webhook endpoint could not be created');
        }
    }

    if (body?.action === 'update_webhook') {
        try {
            if (typeof body.app_id !== 'string' || typeof body.webhook_id !== 'string') {
                return NextResponse.json({ error: { code: 'INVALID_WEBHOOK_ID', message: 'app_id and webhook_id are required' } }, { status: 400 });
            }
            const api = await createAppMarketplaceApiClient({ requireSession: true });
            const data = await api.appStore.updateDeveloperAppWebhook(body.app_id, body.webhook_id, body.webhook || {});
            return NextResponse.json({ data });
        } catch (error) {
            return appMarketplaceErrorResponse(error, 'Webhook endpoint could not be updated');
        }
    }

    if (body?.action === 'archive_webhook') {
        try {
            if (typeof body.app_id !== 'string' || typeof body.webhook_id !== 'string') {
                return NextResponse.json({ error: { code: 'INVALID_WEBHOOK_ID', message: 'app_id and webhook_id are required' } }, { status: 400 });
            }
            const api = await createAppMarketplaceApiClient({ requireSession: true });
            const data = await api.appStore.archiveDeveloperAppWebhook(body.app_id, body.webhook_id);
            return NextResponse.json({ data });
        } catch (error) {
            return appMarketplaceErrorResponse(error, 'Webhook endpoint could not be archived');
        }
    }

    if (body?.action === 'list_versions') {
        try {
            if (typeof body.app_id !== 'string') {
                return NextResponse.json({ error: { code: 'INVALID_APP_ID', message: 'app_id is required' } }, { status: 400 });
            }
            const api = await createAppMarketplaceApiClient({ requireSession: true });
            const data = await api.appStore.developerAppVersions(body.app_id);
            return NextResponse.json({ data });
        } catch (error) {
            return appMarketplaceErrorResponse(error, 'App versions could not be loaded');
        }
    }

    if (body?.action === 'update_app') {
        try {
            if (typeof body.app_id !== 'string') {
                return NextResponse.json({ error: { code: 'INVALID_APP_ID', message: 'app_id is required' } }, { status: 400 });
            }
            const api = await createAppMarketplaceApiClient({ requireSession: true });
            const data = await api.appStore.updateDeveloperApp(body.app_id, body.app || {});
            return NextResponse.json({ data });
        } catch (error) {
            return appMarketplaceErrorResponse(error, 'App update could not be submitted');
        }
    }

    if (body?.action === 'create_version') {
        try {
            if (typeof body.app_id !== 'string') {
                return NextResponse.json({ error: { code: 'INVALID_APP_ID', message: 'app_id is required' } }, { status: 400 });
            }
            const api = await createAppMarketplaceApiClient({ requireSession: true });
            const data = await api.appStore.createDeveloperAppVersion(body.app_id, body.version || {});
            return NextResponse.json({ data }, { status: 201 });
        } catch (error) {
            return appMarketplaceErrorResponse(error, 'App version could not be submitted');
        }
    }

    const {
        name,
        slug,
        tagline,
        description,
        category_id,
        app_url,
        privacy_url,
        pricing_model,
        price_monthly,
        price_yearly,
        trial_days,
        manifest,
        oauth_redirect_uris,
        type,
        save_as_draft,
    } = body;

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
            price_yearly,
            trial_days,
            manifest: manifest && typeof manifest === 'object' ? manifest : undefined,
            oauth_redirect_uris: Array.isArray(oauth_redirect_uris) ? oauth_redirect_uris : undefined,
            type: typeof type === 'string' ? type : undefined,
            save_as_draft,
        });
        return NextResponse.json({ data }, { status: 201 });
    } catch (error) {
        return appMarketplaceErrorResponse(error, 'App submission failed');
    }
}
