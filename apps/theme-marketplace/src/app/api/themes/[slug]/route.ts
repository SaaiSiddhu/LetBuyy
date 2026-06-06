import { NextRequest, NextResponse } from 'next/server';
import { LetbuyyApiError } from '@letbuyy/api-client';
import { ThemeService } from '@/lib/theme-service';
import { logger } from '@/lib/logger';

interface Props {
    params: Promise<{ slug: string }>;
}

type ThemeActionBody = Record<string, unknown> & { action?: unknown };

function stringBodyField(body: ThemeActionBody, key: string): string | undefined {
    const value = body[key];
    return typeof value === 'string' && value.trim() ? value : undefined;
}

function themeErrorResponse(error: unknown, fallbackCode: string, fallbackMessage: string) {
    if (error instanceof LetbuyyApiError) {
        return NextResponse.json(
            { success: false, error: { code: error.code, message: error.message } },
            { status: error.status },
        );
    }

    if (error instanceof Error && error.message === 'Authentication required') {
        return NextResponse.json(
            { success: false, error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' } },
            { status: 401 },
        );
    }

    logger.error('theme marketplace API action failed', { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
        { success: false, error: { code: fallbackCode, message: fallbackMessage } },
        { status: 500 },
    );
}

/**
 * GET /api/themes/[slug]
 * Returns a single theme by slug.
 */
export async function GET(req: NextRequest, { params }: Props) {
    try {
        const { slug } = await params;
        const theme = await ThemeService.getThemeBySlug(slug);

        if (!theme) {
            return NextResponse.json(
                { error: 'Theme not found', theme: null },
                { status: 404 }
            );
        }

        return NextResponse.json({ theme });
    } catch (error) {
        logger.error('failed to fetch theme', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json(
            { error: 'Failed to fetch theme', theme: null },
            { status: 500 }
        );
    }
}

/**
 * POST /api/themes/[slug]
 * Proxies checkout actions to the gateway-owned theme purchase API.
 */
export async function POST(req: NextRequest, { params }: Props) {
    try {
        const { slug } = await params;
        const body = await req.json().catch(() => ({})) as ThemeActionBody;

        if (body.action === 'purchase') {
            const result = await ThemeService.createThemePurchase(slug, {
                currency: 'INR',
                idempotency_key: stringBodyField(body, 'idempotency_key'),
            });
            return NextResponse.json({ success: true, data: result }, { status: result.payment_required === false ? 200 : 201 });
        }

        if (body.action === 'verify_purchase') {
            const result = await ThemeService.verifyThemePurchase(slug, body.provider_proof || body);
            return NextResponse.json({ success: true, data: result });
        }

        return NextResponse.json(
            { success: false, error: { code: 'UNSUPPORTED_THEME_ACTION', message: 'Unsupported theme action.' } },
            { status: 400 },
        );
    } catch (error) {
        return themeErrorResponse(error, 'THEME_CHECKOUT_FAILED', 'Theme checkout could not be completed.');
    }
}
