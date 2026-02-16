import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { verifySession } from '@/lib/auth/session';

/**
 * POST /api/developers/register — Register as an app developer
 * Creates a record in the `app_developers` table.
 */
export async function POST(request: NextRequest) {
    const session = await verifySession();
    if (!session) {
        return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    const { company_name, website_url, support_email, description, country } = body;

    if (!company_name || !support_email) {
        return NextResponse.json(
            { error: 'Company name and support email are required' },
            { status: 400 }
        );
    }

    const supabase = await createSupabaseServerClient();

    // Check if already registered
    const { data: existing } = await supabase
        .from('app_developers')
        .select('id')
        .eq('user_id', session.userId)
        .single();

    if (existing) {
        return NextResponse.json(
            { error: 'You are already registered as a developer' },
            { status: 409 }
        );
    }

    // Insert developer record
    const { data: developer, error } = await supabase
        .from('app_developers')
        .insert({
            user_id: session.userId,
            company_name,
            website_url: website_url || null,
            support_email,
            description: description || null,
            country: country || 'IN',
            status: 'pending', // Pending admin approval
            verified: false,
        })
        .select('id')
        .single();

    if (error) {
        console.error('[developer register] Error:', error.message);
        return NextResponse.json({ error: 'Failed to register' }, { status: 500 });
    }

    return NextResponse.json({
        success: true,
        developerId: developer.id,
        message: 'Developer registration submitted for review',
    });
}
