import Link from 'next/link'
import { MaterialIcon } from '@letbuyy/ui'

/* ——————————————————————————————————————
   Full-Screen Layout for Plan Selection
   No settings sidebar — clean checkout flow
   —————————————————————————————————————— */

interface LayoutProps {
    children: React.ReactNode
    params: Promise<{ store: string }>
}

export default async function SelectPlanLayout({ children, params }: LayoutProps) {
    const { store } = await params

    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg, #0B0F19)',
        }}>
            {/* Minimal header */}
            <header style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                height: 56,
                padding: '0 24px',
                background: 'var(--bg, #0B0F19)',
                borderBottom: '1px solid var(--border, #1E293B)',
                position: 'sticky',
                top: 0,
                zIndex: 50,
            }}>
                <Link
                    href={`/${store}/settings`}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 14,
                        fontWeight: 600,
                        color: 'var(--text-primary, #F1F5F9)',
                        textDecoration: 'none',
                    }}
                >
                    <MaterialIcon name="arrow_back" style={{ fontSize: 20 }} />
                    Settings
                </Link>
                <Link
                    href={`/${store}/dashboard`}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        color: 'var(--text-secondary, #94A3B8)',
                        textDecoration: 'none',
                    }}
                >
                    <MaterialIcon name="home" style={{ fontSize: 20 }} />
                </Link>
            </header>

            {/* Main content */}
            <main>
                {children}
            </main>
        </div>
    )
}
