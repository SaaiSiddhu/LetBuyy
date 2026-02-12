'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface LoginPageProps {
    params: Promise<{ store: string }>;
}

export default function LoginPage({ params }: LoginPageProps) {
    const [store, setStore] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const supabase = createClient()

    // Resolve params
    useState(() => {
        params.then((p) => setStore(p.store))
    })

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        const { data, error } = await supabase.auth.signInWithPassword({ email, password })

        if (error) {
            setError(error.message)
            setLoading(false)
            return
        }

        // Verify user owns this store
        if (data.user) {
            const { data: storeData } = await supabase
                .from('stores')
                .select('id')
                .eq('user_id', data.user.id)
                .eq('store_name', store)
                .single()

            if (!storeData) {
                setError('You do not have access to this store')
                await supabase.auth.signOut()
                setLoading(false)
                return
            }
        }

        // Redirect to dashboard
        window.location.href = `/${store}/dashboard`
    }

    const handleOAuthLogin = async (provider: 'google' | 'apple') => {
        setLoading(true)
        const accountsUrl = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.letbuyy.store'
        const { error } = await supabase.auth.signInWithOAuth({
            provider,
            options: { redirectTo: `${accountsUrl}/auth/callback` },
        })
        if (error) {
            setError(error.message)
            setLoading(false)
        }
    }

    return (
        <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
            <div className="w-full max-w-md space-y-6 rounded-xl border border-zinc-200 bg-white p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="text-center">
                    <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">
                        Welcome back
                    </h1>
                    <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                        Sign in to manage <span className="font-medium">{store}</span>
                    </p>
                </div>

                {/* Error */}
                {error && (
                    <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">
                        {error}
                    </div>
                )}

                {/* Form */}
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label htmlFor="email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Email
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            placeholder="you@example.com"
                            className="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                    </div>
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                            Password
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            placeholder="••••••••"
                            className="mt-1 w-full rounded-lg border border-zinc-300 px-4 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? 'Signing in...' : 'Sign in'}
                    </button>
                </form>

                {/* Divider */}
                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <div className="w-full border-t border-zinc-200 dark:border-zinc-700" />
                    </div>
                    <div className="relative flex justify-center text-sm">
                        <span className="bg-white px-2 text-zinc-500 dark:bg-zinc-900 dark:text-zinc-400">or</span>
                    </div>
                </div>

                {/* OAuth */}
                <div className="flex gap-3 justify-center">
                    <button
                        onClick={() => handleOAuthLogin('apple')}
                        disabled={loading}
                        className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-300 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
                        </svg>
                    </button>
                    <button
                        onClick={() => handleOAuthLogin('google')}
                        disabled={loading}
                        className="flex h-11 w-11 items-center justify-center rounded-lg border border-zinc-300 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
                    >
                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                            <path fill="#EA4335" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                            <path fill="#4285F4" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                        </svg>
                    </button>
                </div>

                {/* Footer links */}
                <div className="text-center text-sm">
                    <a
                        href={`${process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.letbuyy.store'}/forgot-password`}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                        Forgot password?
                    </a>
                    <span className="mx-2 text-zinc-400">•</span>
                    <a
                        href={process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.letbuyy.store'}
                        className="text-blue-600 hover:underline dark:text-blue-400"
                    >
                        Create account
                    </a>
                </div>
            </div>
        </div>
    )
}
