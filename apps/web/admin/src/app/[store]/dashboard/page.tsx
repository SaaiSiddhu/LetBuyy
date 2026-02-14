'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useParams } from 'next/navigation'

/* ——————————————————————————————————————
   Types
   —————————————————————————————————————— */

type SiteType = 'store' | 'portfolio' | 'resume' | 'landing' | 'blog'

interface StoreDashboardStats {
    totalRevenue: number
    totalOrders: number
    totalProducts: number
    conversionRate: number
    recentOrders: Array<{
        id: string
        order_number: string
        total: number
        status: string
        created_at: string
    }>
}

interface PortfolioDashboardStats {
    totalProjects: number
    totalViews: number
    mostViewedProject: string | null
    skillEndorsements: number
}

interface ResumeDashboardStats {
    profileViews: number
    pdfDownloads: number
    atsScore: number
    recruiterVisits: number
}

interface LandingDashboardStats {
    totalVisits: number
    conversionRate: number
    formSubmissions: number
    bounceRate: number
}

interface BlogDashboardStats {
    totalPosts: number
    totalViews: number
    totalComments: number
    subscriberCount: number
}

/* ——————————————————————————————————————
   Component
   —————————————————————————————————————— */

export default function DashboardPage() {
    const { store } = useParams<{ store: string }>()
    const [siteType, setSiteType] = useState<SiteType>('store')
    const [loading, setLoading] = useState(true)
    const [storeId, setStoreId] = useState<string | null>(null)
    const supabase = createClient()

    // Load store info first to get the site_type
    useEffect(() => {
        async function loadStoreInfo() {
            const { data } = await supabase
                .from('stores')
                .select('id, site_type')
                .eq('store_name', store)
                .single()

            if (data) {
                setSiteType((data.site_type as SiteType) || 'store')
                setStoreId(data.id)
            }
            setLoading(false)
        }
        loadStoreInfo()
    }, [store, supabase])

    if (loading) return <DashboardSkeleton />

    return (
        <div className="p-8">
            <div className="mb-8">
                <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-50">Dashboard</h1>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                    Overview of <span className="font-medium">{store}</span>
                </p>
            </div>

            {siteType === 'store' && <StoreDashboard storeId={storeId} store={store} />}
            {siteType === 'portfolio' && <PortfolioDashboard storeId={storeId} store={store} />}
            {siteType === 'resume' && <ResumeDashboard storeId={storeId} store={store} />}
            {siteType === 'landing' && <LandingDashboard storeId={storeId} store={store} />}
            {siteType === 'blog' && <BlogDashboard storeId={storeId} store={store} />}
        </div>
    )
}

/* ——————————————————————————————————————
   Store Dashboard (E-commerce)
   —————————————————————————————————————— */

function StoreDashboard({ storeId, store }: { storeId: string | null; store: string }) {
    const [stats, setStats] = useState<StoreDashboardStats>({
        totalRevenue: 0,
        totalOrders: 0,
        totalProducts: 0,
        conversionRate: 0,
        recentOrders: [],
    })
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        if (!storeId) return
        async function loadStats() {
            const [productsResult, ordersResult, recentOrdersResult] = await Promise.all([
                supabase
                    .from('products')
                    .select('id', { count: 'exact', head: true })
                    .eq('store_id', storeId),
                supabase
                    .from('orders')
                    .select('id, total', { count: 'exact' })
                    .eq('store_id', storeId),
                supabase
                    .from('orders')
                    .select('id, order_number, total, status, created_at')
                    .eq('store_id', storeId)
                    .order('created_at', { ascending: false })
                    .limit(5),
            ])

            const totalRevenue = (ordersResult.data || []).reduce(
                (sum, o) => sum + (Number(o.total) || 0), 0
            )

            setStats({
                totalRevenue,
                totalOrders: ordersResult.count || 0,
                totalProducts: productsResult.count || 0,
                conversionRate: 0,
                recentOrders: recentOrdersResult.data || [],
            })
            setLoading(false)
        }
        loadStats()
    }, [storeId, supabase])

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amount)

    if (loading) return <DashboardSkeleton />

    return (
        <>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                <StatCard title="Total Revenue" value={formatCurrency(stats.totalRevenue)} icon="payments" color="emerald" />
                <StatCard title="Orders" value={String(stats.totalOrders)} icon="shopping_cart" color="blue" />
                <StatCard title="Products" value={String(stats.totalProducts)} icon="inventory_2" color="purple" />
                <StatCard title="Conversion Rate" value={stats.conversionRate > 0 ? `${stats.conversionRate.toFixed(1)}%` : '—'} icon="trending_up" color="amber" />
            </div>

            <div className="mt-8">
                <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">Recent Orders</h2>
                {stats.recentOrders.length === 0 ? (
                    <EmptyState message="No orders yet" icon="shopping_cart" />
                ) : (
                    <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                                    <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Order</th>
                                    <th className="px-4 py-3 text-left font-medium text-zinc-600 dark:text-zinc-400">Status</th>
                                    <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">Total</th>
                                    <th className="px-4 py-3 text-right font-medium text-zinc-600 dark:text-zinc-400">Date</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.recentOrders.map((order) => (
                                    <tr key={order.id} className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
                                        <td className="px-4 py-3 font-medium text-zinc-900 dark:text-zinc-100">
                                            {order.order_number}
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge status={order.status} />
                                        </td>
                                        <td className="px-4 py-3 text-right text-zinc-700 dark:text-zinc-300">
                                            {formatCurrency(Number(order.total))}
                                        </td>
                                        <td className="px-4 py-3 text-right text-zinc-500">
                                            {new Date(order.created_at).toLocaleDateString()}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    )
}

/* ——————————————————————————————————————
   Portfolio Dashboard
   —————————————————————————————————————— */

function PortfolioDashboard({ storeId, store }: { storeId: string | null; store: string }) {
    const [stats, setStats] = useState<PortfolioDashboardStats>({
        totalProjects: 0,
        totalViews: 0,
        mostViewedProject: null,
        skillEndorsements: 0,
    })
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        if (!storeId) return
        async function loadStats() {
            // Count projects (from portfolio_projects table if it exists, else placeholder)
            const { count: projectCount } = await supabase
                .from('portfolio_projects')
                .select('id', { count: 'exact', head: true })
                .eq('store_id', storeId)

            setStats({
                totalProjects: projectCount || 0,
                totalViews: 0, // Will be populated once analytics table is wired
                mostViewedProject: null,
                skillEndorsements: 0,
            })
            setLoading(false)
        }
        loadStats()
    }, [storeId, supabase])

    if (loading) return <DashboardSkeleton />

    return (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Projects" value={String(stats.totalProjects)} icon="work" color="blue" />
            <StatCard title="Portfolio Views" value={String(stats.totalViews)} icon="visibility" color="purple" />
            <StatCard title="Most Viewed" value={stats.mostViewedProject || '—'} icon="star" color="amber" />
            <StatCard title="Skill Endorsements" value={String(stats.skillEndorsements)} icon="thumb_up" color="emerald" />
        </div>
    )
}

/* ——————————————————————————————————————
   Resume Dashboard
   —————————————————————————————————————— */

function ResumeDashboard({ storeId, store }: { storeId: string | null; store: string }) {
    const [stats, setStats] = useState<ResumeDashboardStats>({
        profileViews: 0,
        pdfDownloads: 0,
        atsScore: 0,
        recruiterVisits: 0,
    })
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        if (!storeId) return
        async function loadStats() {
            // Fetch analytics data (will work once tables exist)
            const { data: analyticsData } = await supabase
                .from('resume_analytics')
                .select('profile_views, pdf_downloads, ats_score, recruiter_visits')
                .eq('store_id', storeId)
                .single()

            if (analyticsData) {
                setStats({
                    profileViews: analyticsData.profile_views || 0,
                    pdfDownloads: analyticsData.pdf_downloads || 0,
                    atsScore: analyticsData.ats_score || 0,
                    recruiterVisits: analyticsData.recruiter_visits || 0,
                })
            }
            setLoading(false)
        }
        loadStats()
    }, [storeId, supabase])

    if (loading) return <DashboardSkeleton />

    return (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Profile Views" value={String(stats.profileViews)} icon="visibility" color="blue" />
            <StatCard title="PDF Downloads" value={String(stats.pdfDownloads)} icon="picture_as_pdf" color="emerald" />
            <StatCard title="ATS Score" value={stats.atsScore > 0 ? `${stats.atsScore}/100` : '—'} icon="analytics" color="purple" />
            <StatCard title="Recruiter Visits" value={String(stats.recruiterVisits)} icon="person_search" color="amber" />
        </div>
    )
}

/* ——————————————————————————————————————
   Landing Page Dashboard
   —————————————————————————————————————— */

function LandingDashboard({ storeId, store }: { storeId: string | null; store: string }) {
    const [stats, setStats] = useState<LandingDashboardStats>({
        totalVisits: 0,
        conversionRate: 0,
        formSubmissions: 0,
        bounceRate: 0,
    })
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        if (!storeId) return
        async function loadStats() {
            const { data: analyticsData } = await supabase
                .from('landing_analytics')
                .select('total_visits, conversion_rate, form_submissions, bounce_rate')
                .eq('store_id', storeId)
                .single()

            if (analyticsData) {
                setStats({
                    totalVisits: analyticsData.total_visits || 0,
                    conversionRate: analyticsData.conversion_rate || 0,
                    formSubmissions: analyticsData.form_submissions || 0,
                    bounceRate: analyticsData.bounce_rate || 0,
                })
            }
            setLoading(false)
        }
        loadStats()
    }, [storeId, supabase])

    if (loading) return <DashboardSkeleton />

    return (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Visits" value={String(stats.totalVisits)} icon="group" color="blue" />
            <StatCard title="Conversion Rate" value={stats.conversionRate > 0 ? `${stats.conversionRate.toFixed(1)}%` : '—'} icon="trending_up" color="emerald" />
            <StatCard title="Form Submissions" value={String(stats.formSubmissions)} icon="mail" color="purple" />
            <StatCard title="Bounce Rate" value={stats.bounceRate > 0 ? `${stats.bounceRate.toFixed(1)}%` : '—'} icon="exit_to_app" color="amber" />
        </div>
    )
}

/* ——————————————————————————————————————
   Blog Dashboard
   —————————————————————————————————————— */

function BlogDashboard({ storeId, store }: { storeId: string | null; store: string }) {
    const [stats, setStats] = useState<BlogDashboardStats>({
        totalPosts: 0,
        totalViews: 0,
        totalComments: 0,
        subscriberCount: 0,
    })
    const [loading, setLoading] = useState(true)
    const supabase = createClient()

    useEffect(() => {
        if (!storeId) return
        async function loadStats() {
            const { count: postCount } = await supabase
                .from('blog_posts')
                .select('id', { count: 'exact', head: true })
                .eq('store_id', storeId)

            const { count: commentCount } = await supabase
                .from('blog_comments')
                .select('id', { count: 'exact', head: true })
                .eq('store_id', storeId)

            setStats({
                totalPosts: postCount || 0,
                totalViews: 0,
                totalComments: commentCount || 0,
                subscriberCount: 0,
            })
            setLoading(false)
        }
        loadStats()
    }, [storeId, supabase])

    if (loading) return <DashboardSkeleton />

    return (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title="Total Posts" value={String(stats.totalPosts)} icon="edit_note" color="blue" />
            <StatCard title="Total Views" value={String(stats.totalViews)} icon="visibility" color="purple" />
            <StatCard title="Comments" value={String(stats.totalComments)} icon="comment" color="emerald" />
            <StatCard title="Subscribers" value={String(stats.subscriberCount)} icon="group_add" color="amber" />
        </div>
    )
}

/* ——————————————————————————————————————
   Shared Components
   —————————————————————————————————————— */

const colorMap: Record<string, { bg: string; text: string; iconText: string }> = {
    emerald: {
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
        text: 'text-emerald-600 dark:text-emerald-400',
        iconText: 'text-emerald-500',
    },
    blue: {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        text: 'text-blue-600 dark:text-blue-400',
        iconText: 'text-blue-500',
    },
    purple: {
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        text: 'text-purple-600 dark:text-purple-400',
        iconText: 'text-purple-500',
    },
    amber: {
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        text: 'text-amber-600 dark:text-amber-400',
        iconText: 'text-amber-500',
    },
}

function StatCard({ title, value, icon, color = 'blue' }: { title: string; value: string; icon: string; color?: string }) {
    const c = colorMap[color] || colorMap.blue
    return (
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex items-center gap-3 mb-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${c.bg}`}>
                    <span className={`material-symbols-outlined ${c.iconText}`} style={{ fontSize: '20px' }}>{icon}</span>
                </div>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400">{title}</p>
            </div>
            <p className="text-3xl font-bold text-zinc-900 dark:text-zinc-50">{value}</p>
        </div>
    )
}

function EmptyState({ message, icon }: { message: string; icon: string }) {
    return (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
            <span className="material-symbols-outlined text-zinc-300 dark:text-zinc-600 mb-2" style={{ fontSize: '48px' }}>{icon}</span>
            <p className="text-zinc-500 mt-2">{message}</p>
        </div>
    )
}

function StatusBadge({ status }: { status: string }) {
    const colors: Record<string, string> = {
        pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
        confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
        shipped: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
        delivered: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
        cancelled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    }
    return (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${colors[status] || colors.pending}`}>
            {status}
        </span>
    )
}

function DashboardSkeleton() {
    return (
        <div className="p-8">
            <div className="animate-pulse space-y-6">
                <div className="h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-800" />
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-28 rounded-xl bg-zinc-200 dark:bg-zinc-800" />
                    ))}
                </div>
            </div>
        </div>
    )
}
