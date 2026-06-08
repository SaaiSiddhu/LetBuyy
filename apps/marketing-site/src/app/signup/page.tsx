'use client'

import { useEffect } from 'react'
import { getAccountsUrl } from '@/lib/public-urls'

export default function SignupPage() {
    useEffect(() => {
        // Landing app doesn't handle auth — redirect to accounts app
        window.location.href = getAccountsUrl('/signup')
    }, [])

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
            <div className="text-center">
                <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-blue-600" />
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Redirecting to sign up...
                </p>
            </div>
        </div>
    )
}
