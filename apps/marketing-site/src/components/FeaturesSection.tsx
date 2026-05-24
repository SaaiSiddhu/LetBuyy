export default function FeaturesSection() {
    const features = [
        {
            icon: '🎯',
            title: 'Drag & Drop Builder',
            desc: 'No coding required. Build beautiful pages with our intuitive editor.',
            large: true
        },
        {
            icon: '📱',
            title: 'Mobile-First Design',
            desc: 'Your site looks amazing on every device, automatically.'
        },
        {
            icon: '💳',
            title: 'Indian Payments',
            desc: 'Accept UPI, cards, wallets via Razorpay & Stripe.'
        },
        {
            icon: '📦',
            title: 'Inventory Tracking',
            desc: 'Real-time stock monitoring with low-stock alerts.'
        },
        {
            icon: '📊',
            title: 'Analytics Dashboard',
            desc: 'Track sales, visitors, and conversions in real-time.'
        },
        {
            icon: '🔗',
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
                    {features.map((feature, index) => (
                        <div key={index} className={`feature-card ${feature.large ? 'large' : ''}`}>
                            <div className="feature-icon">{feature.icon}</div>
                            <h3 className="feature-title">{feature.title}</h3>
                            <p className="feature-desc">{feature.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
