'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'

export default function SettingsPage() {
    const { store } = useParams<{ store: string }>()
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [storeData, setStoreData] = useState({
        id: '',
        store_name: '',
        display_name: '',
        description: '',
        subdomain: '',
        custom_domain: '',
        currency: 'INR',
        site_type: 'store',
    })
    const [success, setSuccess] = useState(false)
    const supabase = createClient()

    useEffect(() => {
        async function load() {
            const { data: { user } } = await supabase.auth.getUser()
            if (!user) return

            const { data } = await supabase
                .from('stores')
                .select('*')
                .eq('store_name', store)
                .eq('user_id', user.id)
                .single()

            if (data) {
                setStoreData({
                    id: data.id,
                    store_name: data.store_name || '',
                    display_name: data.display_name || data.store_name || '',
                    description: data.description || '',
                    subdomain: data.subdomain || data.store_name || '',
                    custom_domain: data.custom_domain || '',
                    currency: data.currency || 'INR',
                    site_type: data.site_type || 'store',
                })
            }
            setLoading(false)
        }
        load()
    }, [store, supabase])

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault()
        setSaving(true)
        setSuccess(false)

        await supabase.from('stores').update({
            display_name: storeData.display_name,
            description: storeData.description,
            custom_domain: storeData.custom_domain || null,
            currency: storeData.currency,
        }).eq('id', storeData.id)

        setSaving(false)
        setSuccess(true)
        setTimeout(() => setSuccess(false), 3000)
    }

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete "${storeData.display_name}"? This cannot be undone.`)) return
        if (!confirm('This will permanently delete all products, orders, and pages. Proceed?')) return

        await supabase.from('stores').delete().eq('id', storeData.id)
        const accountsUrl = process.env.NEXT_PUBLIC_ACCOUNTS_URL || 'https://accounts.letbuyy.store'
        window.location.href = accountsUrl
    }

    if (loading) {
        return (
            <div className="p-8">
                <div className="animate-pulse space-y-6">
                    <div className="h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-32 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Settings</h1>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">Configure {store}</p>
            </div>

            {success && (
                <div className="mb-4 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                    Settings saved successfully.
                </div>
            )}

            <form onSubmit={handleSave} className="space-y-6">
                {/* General */}
                <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">General</h2>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Display Name</label>
                            <input
                                value={storeData.display_name}
                                onChange={(e) => setStoreData(s => ({ ...s, display_name: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Currency</label>
                            <select
                                value={storeData.currency}
                                onChange={(e) => setStoreData(s => ({ ...s, currency: e.target.value }))}
                                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            >
                                <option value="INR">₹ INR</option>
                                <option value="USD">$ USD</option>
                                <option value="EUR">€ EUR</option>
                                <option value="GBP">£ GBP</option>
                            </select>
                        </div>
                        <div className="sm:col-span-2">
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Description</label>
                            <textarea
                                value={storeData.description}
                                onChange={(e) => setStoreData(s => ({ ...s, description: e.target.value }))}
                                rows={3}
                                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            />
                        </div>
                    </div>
                </section>

                {/* Domain */}
                <section className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
                    <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">Domain</h2>
                    <div className="mt-4 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Subdomain</label>
                            <div className="mt-1 flex items-center gap-1">
                                <code className="rounded bg-zinc-100 px-2 py-1.5 text-sm dark:bg-zinc-800">{storeData.subdomain}.letbuyy.store</code>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Custom Domain</label>
                            <input
                                value={storeData.custom_domain}
                                onChange={(e) => setStoreData(s => ({ ...s, custom_domain: e.target.value }))}
                                placeholder="e.g. shop.yourdomain.com"
                                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                            />
                            <p className="mt-1 text-xs text-zinc-500">Point a CNAME record to stores.letbuyy.store</p>
                        </div>
                    </div>
                </section>

                {/* Save Button */}
                <button
                    type="submit"
                    disabled={saving}
                    className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </form>

            {/* Danger Zone */}
            <section className="mt-8 rounded-xl border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/20">
                <h2 className="text-lg font-semibold text-red-900 dark:text-red-400">Danger Zone</h2>
                <p className="mt-1 text-sm text-red-700 dark:text-red-400/80">
                    Permanently delete this store and all associated data.
                </p>
                <button
                    onClick={handleDelete}
                    className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 transition-colors hover:bg-red-100 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
                >
                    Delete Store
                </button>
            </section>
        </div>
    )
}
