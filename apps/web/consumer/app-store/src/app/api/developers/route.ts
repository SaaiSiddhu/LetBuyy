import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

/**
 * GET /api/developers — Get developer profile for current user
 * POST /api/developers — Register as a developer
 * Both require authentication (enforced by middleware)
 */
export async function GET() {
    try {
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        // Look up user in users_custom
        const { data: customUser } = await supabase
            .from('users_custom')
            .select('id')
            .eq('auth_id', user.id)
            .single();

        if (!customUser) {
            return NextResponse.json(
                { developer: null, message: 'User profile not found' },
                { status: 404 }
            );
        }

        const { data: developer, error } = await supabase
            .from('app_developers')
            .select('*')
            .eq('user_id', customUser.id)
            .single();

        if (error || !developer) {
            return NextResponse.json({
                developer: null,
                message: 'Developer profile not found. Register first.',
            });
        }

        return NextResponse.json({ developer });
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
        const supabase = await createSupabaseServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json(
                { error: 'Authentication required' },
                { status: 401 }
            );
        }

        const body = await request.json();
        const { company_name, website, contact_email, bio } = body;

        if (!company_name || !contact_email) {
            return NextResponse.json(
                { error: 'Company name and contact email are required' },
                { status: 400 }
            );
        }

        // Look up user in users_custom
        const { data: customUser } = await supabase
            .from('users_custom')
            .select('id')
            .eq('auth_id', user.id)
            .single();

        if (!customUser) {
            return NextResponse.json(
                { error: 'User profile not found' },
                { status: 404 }
            );
        }

        // Create slug from company name
        const slug = company_name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');

        const { data: developer, error } = await supabase
            .from('app_developers')
            .insert({
                user_id: customUser.id,
                company_name,
                slug,
                website_url: website,
                support_email: contact_email,
                description: bio,
                status: 'pending',
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                return NextResponse.json(
                    { error: 'Developer profile already exists for this account' },
                    { status: 409 }
                );
            }
            console.error('[API /developers POST] Error:', error.message);
            return NextResponse.json(
                { error: 'Failed to create developer profile' },
                { status: 500 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Developer profile created successfully. Pending verification.',
            developer,
        });
    } catch {
        return NextResponse.json(
            { error: 'Invalid request body' },
            { status: 400 }
        );
    }
}
