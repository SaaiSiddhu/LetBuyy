import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
    const { searchParams, origin } = new URL(request.url)
    const code = searchParams.get('code')
    const next = searchParams.get('next') ?? '/'

    if (code) {
        const supabase = await createClient()
        const { data, error } = await supabase.auth.exchangeCodeForSession(code)

        if (!error && data.user) {
            // Get or create store name for the user
            const { data: store } = await supabase
                .from('stores')
                .select('store_name')
                .eq('user_id', data.user.id)
                .limit(1)
                .single()

            if (store?.store_name) {
                // User has a store, redirect to admin
                const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.letbuyy.store'
                return NextResponse.redirect(`${adminUrl}/${store.store_name}`)
            } else {
                // New user, redirect to onboarding
                return NextResponse.redirect(`${origin}/onboarding`)
            }
        }
    }

    // Auth error, redirect to login
    return NextResponse.redirect(`${origin}/lookup?error=auth_failed`)
}
