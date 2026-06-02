import {
    BarChart3,
    CreditCard,
    Link2,
    MousePointerClick,
    Package,
    Smartphone,
    type LucideIcon,
} from '@letbuyy/ui'

export default function FeaturesSection() {
    const features: Array<{
        icon: LucideIcon
        title: string
        desc: string
        large?: boolean
    }> = [
        {
            icon: MousePointerClick,
            title: 'Drag & Drop Builder',
            desc: 'No coding required. Build beautiful pages with our intuitive editor.',
            large: true
        },
        {
            icon: Smartphone,
            title: 'Mobile-First Design',
            desc: 'Your site looks amazing on every device, automatically.'
        },
        {
            icon: CreditCard,
            title: 'Indian Payments',
            desc: 'Accept UPI, cards, wallets via Razorpay & Stripe.'
        },
        {
            icon: Package,
            title: 'Inventory Tracking',
            desc: 'Real-time stock monitoring with low-stock alerts.'
        },
        {
            icon: BarChart3,
            title: 'Analytics Dashboard',
            desc: 'Track sales, visitors, and conversions in real-time.'
        },
        {
            icon: Link2,
            title: 'Custom Domains',
            desc: 'Use your own domain or get a free *.letbuyy.store subdomain.'
        }
    ]

    return (
        <section id="features" className="features">
            <div className="container">
                <div className="section-header">
                    <p className="section-label" style={{ color: '#A78BFA' }}>Powerful Features</p>
                    <h2 className="section-title">Everything you need to succeed</h2>
                    <p className="section-subtitle">
                        From payments to analytics — we&apos;ve got all the tools you need.
                    </p>
                </div>

                <div className="features-grid">
                    {features.map((feature) => {
                        const Icon = feature.icon

                        return (
                            <div key={feature.title} className={`feature-card ${feature.large ? 'large' : ''}`}>
                                <div className="feature-icon">
                                    <Icon aria-hidden="true" />
                                </div>
                                <h3 className="feature-title">{feature.title}</h3>
                                <p className="feature-desc">{feature.desc}</p>
                            </div>
                        )
                    })}
                </div>
            </div>
        </section>
    )
}
