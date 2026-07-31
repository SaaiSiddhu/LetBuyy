import Link from 'next/link'
import { MaterialIcon } from '@letbuyy/ui'

interface LayoutProps {
    children: React.ReactNode
    params: Promise<{ store: string }>
}

export default async function CheckoutLayout({ children, params }: LayoutProps) {
    const { store } = await params

    return (
        <div className="select-plan-layout">
            <header className="select-plan-header">
                <Link
                    href={`/${store}/access_account/checkout/select-plan`}
                    className="select-plan-header-link"
                >
                    <MaterialIcon name="arrow_back" size={20} />
                    Select Plan
                </Link>
                <Link
                    href={`/${store}/dashboard`}
                    className="select-plan-home-link"
                    aria-label="Back to dashboard"
                >
                    <MaterialIcon name="home" size={20} />
                </Link>
            </header>

            <main>
                {children}
            </main>
        </div>
    )
}
