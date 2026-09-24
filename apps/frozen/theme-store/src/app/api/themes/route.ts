import { NextRequest, NextResponse } from 'next/server';
import { LETBUYY_MERCHANT_SESSION_COOKIE, verifyLetbuyySessionCookieValue } from '@letbuyy/auth-core';
import type { ThemeSearchFilters } from '@letbuyy/theme-engine';
import { ThemeService } from '@/lib/theme-service';
import { logger } from '@/lib/logger';

const SORT_VALUES = ['popular', 'trending', 'rating', 'recent', 'new', 'name', 'price_low', 'price_high'] as const;
type ThemeSort = NonNullable<ThemeSearchFilters['sort']>;
const MAX_UPLOAD_BYTES = 512 * 1024;
const UPLOAD_WINDOW_MS = 60_000;
const MAX_UPLOADS_PER_WINDOW = 5;
const uploadAttempts = new Map<string, { count: number; resetAt: number }>();

function parseSort(value: string | null): ThemeSort {
    return SORT_VALUES.includes(value as ThemeSort) ? value as ThemeSort : 'popular';
}

function parseNonNegativeInt(value: string | null, fallback: number, max: number): number {
    const parsed = Number.parseInt(value || '', 10);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return Math.min(parsed, max);
}

function getRequestIp(req: NextRequest): string {
    return req.headers.get('cf-connecting-ip')
        || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || 'unknown';
}

function uploadRateLimited(ip: string, now = Date.now()): boolean {
    const current = uploadAttempts.get(ip);
    if (!current || current.resetAt <= now) {
        uploadAttempts.set(ip, { count: 1, resetAt: now + UPLOAD_WINDOW_MS });
        return false;
    }

    current.count += 1;
    return current.count > MAX_UPLOADS_PER_WINDOW;
}

/**
 * GET /api/themes
 * Returns a paginated, filterable list of themes.
 *
 * Query params: category, pricingType, search, sort, limit, offset
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = req.nextUrl;

        const filters = {
            category: searchParams.get('category') || undefined,
            pricingType: searchParams.get('pricingType') || undefined,
            siteType: searchParams.get('site_type') || undefined,
            industry: searchParams.get('industry') || undefined,
            layout: searchParams.get('layout') || undefined,
            tag: searchParams.get('tag') || undefined,
            feature: searchParams.get('feature') || undefined,
            priceMin: searchParams.has('price_min') ? Number(searchParams.get('price_min')) : undefined,
            priceMax: searchParams.has('price_max') ? Number(searchParams.get('price_max')) : undefined,
            search: searchParams.get('search') || undefined,
            sort: parseSort(searchParams.get('sort')),
            limit: parseNonNegativeInt(searchParams.get('limit'), 30, 100),
            offset: parseNonNegativeInt(searchParams.get('offset'), 0, 10_000),
        };

        const result = await ThemeService.listThemes(filters);

        if (!result.ok) {
            return NextResponse.json(
                { error: { code: 'MARKETPLACE_UNAVAILABLE', message: result.error.message }, themes: [], total: 0 },
                { status: 503 }
            );
        }

        return NextResponse.json(result.value);
    } catch (error) {
        logger.error('failed to list themes', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json(
            { error: { code: 'THEME_LIST_FAILED', message: 'Failed to fetch themes' }, themes: [], total: 0 },
            { status: 500 }
        );
    }
}

export async function POST(req: NextRequest) {
    try {
        const session = verifyLetbuyySessionCookieValue(
            'merchant',
            req.cookies.get(LETBUYY_MERCHANT_SESSION_COOKIE)?.value,
        );
        if (!session.accepted) {
            return NextResponse.json(
                { error: { code: 'AUTHENTICATION_REQUIRED', message: 'Authentication required' } },
                { status: 401 },
            );
        }

        const ip = getRequestIp(req);
        if (uploadRateLimited(ip)) {
            return NextResponse.json(
                { error: { code: 'RATE_LIMITED', message: 'Too many theme package upload attempts. Try again shortly.' } },
                { status: 429 },
            );
        }

        const contentType = req.headers.get('content-type') || '';
        if (!contentType.includes('application/json')) {
            return NextResponse.json(
                { error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Theme package uploads must be JSON.' } },
                { status: 415 },
            );
        }

        const contentLength = Number(req.headers.get('content-length') || '0');
        if (contentLength > MAX_UPLOAD_BYTES) {
            return NextResponse.json(
                { error: { code: 'PAYLOAD_TOO_LARGE', message: 'Theme package upload is too large for direct JSON submission.' } },
                { status: 413 },
            );
        }

        const body = await req.json() as Record<string, unknown>;
        const bundle = body.bundle;

        if (!bundle || typeof bundle !== 'object' || Array.isArray(bundle)) {
            return NextResponse.json(
                { error: { code: 'INVALID_THEME_BUNDLE', message: 'Theme package bundle is required.' } },
                { status: 400 }
            );
        }

        const result = await ThemeService.uploadThemePackage(bundle as Record<string, unknown>);
        return NextResponse.json(result, { status: 201 });
    } catch (error) {
        logger.error('theme upload failed', { error: error instanceof Error ? error.message : String(error) });
        return NextResponse.json(
            { error: { code: 'THEME_UPLOAD_FAILED', message: error instanceof Error ? error.message : 'Failed to upload theme package' } },
            { status: 500 }
        );
    }
}
