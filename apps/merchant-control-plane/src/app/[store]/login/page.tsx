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
        // min-h-full, not min-h-screen: this renders inside the shell's scrollport,
        // which is already the viewport minus the header — a full viewport height
        // here would force a permanent scrollbar on a page that is one spinner.
        <div className="flex min-h-full items-center justify-center bg-[var(--lb-color-bg)]">
            <div className="text-center">
                <div className="mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[var(--lb-color-border)] border-t-[var(--lb-color-primary)] mx-auto" />
                <p className="text-sm text-[color:var(--lb-color-text-subdued)]">Redirecting to login...</p>
            </div>
        </div>
    )
}
