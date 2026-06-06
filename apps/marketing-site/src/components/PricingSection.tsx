import Link from 'next/link'
import { getAccountsUrl } from '@/lib/public-urls'

export default function PricingSection() {
    const plans = [
        {
            name: 'Free Trial',
            price: '₹0',
            period: '/14 days',
            note: 'Try everything free',
            features: [
                '1 site',
                '10 products',
                'Basic analytics',
                'Email support',
                'letbuyy.store subdomain'
            ],
            cta: 'Start free trial',
            popular: false
        },
        {
            name: 'Starter',
            price: '₹199',
            period: '/month',
            note: 'Then ₹999/month',
            features: [
                '3 sites',
                '100 products',
                'Advanced analytics',
                'Custom domain',
                'Priority support',
                'PDF export (resume)'
            ],
            cta: 'Get started',
            popular: true
        },
        {
            name: 'Business',
            price: '₹1,999',
            period: '/month',
            note: 'For growing businesses',
            features: [
                '10 sites',
                '1000 products',
                'Multi-location inventory',
                'Advanced shipping',
                'API access',
                '0% transaction fees'
            ],
            cta: 'Contact sales',
            popular: false
        }
    ]

    return (
        <section id="pricing" className="pricing">
            <div className="container">
                <div className="section-header">
                    <p className="section-label">Simple Pricing</p>
                    <h2 className="section-title">Start free, scale as you grow</h2>
                    <p className="section-subtitle">
                        No hidden fees. Cancel anytime.
                    </p>
                </div>

                <div className="pricing-grid">
                    {plans.map((plan) => (
                        <div key={plan.name} className={`pricing-card ${plan.popular ? 'popular' : ''}`}>
                            {plan.popular && <span className="pricing-badge">Most Popular</span>}
                            <h3 className="pricing-name">{plan.name}</h3>
                            <div className="pricing-price">
                                {plan.price}<span>{plan.period}</span>
                            </div>
                            <p className="pricing-note">{plan.note}</p>
                            <ul className="pricing-features">
                                {plan.features.map((feature, i) => (
                                    <li key={i}>{feature}</li>
                                ))}
                            </ul>
                            <Link
                                href={getAccountsUrl('/signup')}
                                className={`btn ${plan.popular ? 'btn-primary' : 'btn-outline'}`}
                                style={{ width: '100%' }}
                            >
                                {plan.cta}
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
