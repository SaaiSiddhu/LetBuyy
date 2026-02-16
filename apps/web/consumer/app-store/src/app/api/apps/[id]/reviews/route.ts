import { NextRequest, NextResponse } from 'next/server';
import { AppService } from '@/lib/app-service';
import { createSupabaseServerClient } from '@/lib/supabase/server';

interface RouteParams {
    params: Promise<{ id: string }>;
}

/**
 * GET /api/apps/[id]/reviews — Get reviews for an app
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;

    const { reviews, total } = await AppService.getAppReviews(id);

    return NextResponse.json({ reviews, total });
}

/**
 * POST /api/apps/[id]/reviews — Submit a review (auth required)
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
    const { id } = await params;

    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { rating, title, body: reviewBody } = body;

        if (!rating || rating < 1 || rating > 5) {
            return NextResponse.json(
                { error: 'Rating must be between 1 and 5' },
                { status: 400 }
            );
        }

        // Look up user display name
        const { data: userCustom } = await supabase
            .from('users_custom')
            .select('name')
            .eq('id', user.id)
            .single();

        // Insert review into app_reviews
        const { data: review, error } = await supabase
            .from('app_reviews')
            .insert({
                app_id: id,
                user_id: user.id,
                user_name: userCustom?.name || user.email?.split('@')[0] || 'Anonymous',
                rating,
                title: title || '',
                body: reviewBody || '',
                status: 'published',
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return NextResponse.json(
                    { error: 'You have already reviewed this app' },
                    { status: 409 }
                );
            }
            console.error('[Reviews API] Insert error:', error.message);
            return NextResponse.json(
                { error: 'Failed to submit review' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            review,
        });
    } catch {
        return NextResponse.json(
            { error: 'Invalid request body' },
            { status: 400 }
        );
    }
}
