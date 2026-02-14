'use client'

import { usePathname } from 'next/navigation'

interface HeaderBarProps {
    store: string
    userName: string | null
}

export default function HeaderBar({ store, userName }: HeaderBarProps) {
    const pathname = usePathname()

    // Build breadcrumbs from current path
    const segments = pathname
        ?.replace(`/${store}/`, '')
        .split('/')
        .filter(Boolean) || ['dashboard']

    const breadcrumbLabels: Record<string, string> = {
        dashboard: 'Dashboard',
        products: 'Products',
        orders: 'Orders',
        customers: 'Customers',
        coupons: 'Coupons',
        analytics: 'Analytics',
        pages: 'Pages',
        settings: 'Settings',
        appearance: 'Appearance',
        ai: 'AI Studio',
        projects: 'Projects',
        gallery: 'Gallery',
        skills: 'Skills',
        education: 'Education',
        testimonials: 'Testimonials',
        contact: 'Contact Form',
        experience: 'Experience',
        certifications: 'Certifications',
        export: 'PDF Export',
        'ats-score': 'ATS Score',
        leads: 'Leads',
        posts: 'Posts',
        categories: 'Categories',
        comments: 'Comments',
    }

    const userInitial = userName
        ? userName.charAt(0).toUpperCase()
        : '?'

    return (
        <header className="admin-header">
            {/* Breadcrumbs */}
            <div className="admin-header-left">
                <nav className="admin-breadcrumb">
                    <span>{store}</span>
                    {segments.map((seg, i) => (
                        <span key={seg} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span className="admin-breadcrumb-separator">/</span>
                            <span className={i === segments.length - 1 ? 'admin-breadcrumb-current' : ''}>
                                {breadcrumbLabels[seg] || seg}
                            </span>
                        </span>
                    ))}
                </nav>
            </div>

            {/* Right side: search, notifications, avatar */}
            <div className="admin-header-right">
                {/* Search (Cmd+K trigger) */}
                <button className="admin-header-search" title="Search (⌘K)">
                    <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>search</span>
                    <span>Search...</span>
                    <kbd>⌘K</kbd>
                </button>

                {/* Notifications */}
                <button className="admin-header-btn" title="Notifications">
                    <span className="material-symbols-outlined" style={{ fontSize: '20px' }}>notifications</span>
                </button>

                {/* User avatar */}
                <div className="admin-header-avatar" title={userName || 'User'}>
                    {userInitial}
                </div>
            </div>
        </header>
    )
}
