import { NextRequest, NextResponse } from 'next/server';
import { ThemeService } from '@/lib/theme-service';

interface Props {
    params: Promise<{ slug: string }>;
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
        console.error('[API] /api/themes/[slug] error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch theme', theme: null },
            { status: 500 }
        );
    }
}
