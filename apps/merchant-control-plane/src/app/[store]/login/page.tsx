'use client'

import { useEffect } from 'react'
import { useParams } from 'next/navigation'

/**
 * Admin login page — redirects to the accounts app.
 * Authentication is handled centrally by the accounts app (accounts.letbuyy.com)
 * which sets the `lb_session` cookie. The admin app's [store]/layout.tsx validates
 * this session server-side. There should be no separate login flow in the admin app.
 */
export default function LoginPage() {
    const { store } = useParams<{ store: string }>()

    useEffect(() => {
        const accountsUrl = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.letbuyy.com'
        const adminUrl = process.env.NEXT_PUBLIC_ADMIN_URL || 'https://admin.letbuyy.com'
        const returnTo = `${adminUrl}/${store}/dashboard`
        window.location.href = `${accountsUrl}/lookup?return_to=${encodeURIComponent(returnTo)}`
    }, [store])

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50">
            <div className="text-center">
                <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-[var(--lb-color-primary,var(--primary,var(--lb-color-brand-purple)))] mx-auto" />
                <p className="text-sm text-zinc-600">Redirecting to login...</p>
            </div>
        </div>
    )
}
