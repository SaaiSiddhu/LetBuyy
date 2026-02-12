'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, X, Sparkles, ArrowRight, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

const PLANS = [
    {
        name: 'Free',
        monthlyPrice: 0,
        yearlyPrice: 0,
        description: 'Get started with free themes',
        cta: 'Get Started',
        ctaLink: '/themes?pricing=free',
        highlight: false,
        features: [
            { text: 'All free themes', included: true },
            { text: 'Community support', included: true },
            { text: '1 store', included: true },
            { text: 'Basic customization', included: true },
            { text: 'Premium themes', included: false },
            { text: 'Multi-platform export', included: false },
            { text: 'Priority support', included: false },
            { text: 'White-label', included: false },
        ],
    },
    {
        name: 'Pro',
        monthlyPrice: 29,
        yearlyPrice: 279,
        description: 'For growing businesses',
        cta: 'Subscribe',
        ctaLink: '/checkout?plan=pro',
        highlight: true,
        badge: 'Most Popular',
        features: [
            { text: 'Everything in Free', included: true },
            { text: 'Unlimited premium themes', included: true },
            { text: 'Up to 5 stores', included: true },
            { text: 'Full customizer', included: true },
            { text: 'Priority support', included: true },
            { text: 'WP + Shopify export', included: true },
            { text: 'White-label', included: false },
            { text: 'Unlimited stores', included: false },
        ],
    },
    {
        name: 'Unlimited',
        monthlyPrice: 99,
        yearlyPrice: 949,
        description: 'For agencies & power users',
        cta: 'Contact Us',
        ctaLink: '#',
        highlight: false,
        features: [
            { text: 'Everything in Pro', included: true },
            { text: 'Unlimited stores', included: true },
            { text: 'Multi-platform export', included: true },
            { text: 'Dedicated support', included: true },
            { text: 'White-label themes', included: true },
            { text: 'Custom integrations', included: true },
            { text: 'Early access to new themes', included: true },
            { text: 'SLA guarantee', included: true },
        ],
    },
];

const FAQS = [
    {
        q: 'Can I switch plans anytime?',
        a: 'Yes! You can upgrade or downgrade your plan at any time. If you upgrade, you\'ll be prorated for the remainder of your billing cycle.',
    },
    {
        q: 'What\'s your refund policy?',
        a: 'We offer a 30-day money-back guarantee on all paid plans and theme purchases. No questions asked.',
    },
    {
        q: 'Do themes work on mobile?',
        a: 'Absolutely. Every theme is fully responsive and tested on all major mobile devices, tablets, and desktop browsers.',
    },
    {
        q: 'Can I use themes on multiple stores?',
        a: 'Free plan allows 1 store. Pro supports up to 5, and Unlimited supports unlimited stores. Standalone downloads include a license for the specified number of sites.',
    },
    {
        q: 'Do I need coding knowledge?',
        a: 'No! Our visual customizer lets you change colors, fonts, layouts, and content without writing any code. Developers can also access the full source code.',
    },
];

export default function PricingPage() {
    const [isYearly, setIsYearly] = useState(false);
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    return (
        <div className="container-main py-16 md:py-24">
            {/* Header */}
            <div className="text-center mb-14 max-w-2xl mx-auto">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary-light mb-3">Pricing</p>
                <h1 className="text-3xl md:text-5xl font-bold mb-4">
                    Choose Your <span className="gradient-text">Perfect Plan</span>
                </h1>
                <p className="text-text-body text-lg">
                    Get access to premium themes, full customization, and priority support.
                </p>
            </div>

            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-4 mb-12">
                <span className={cn('text-sm font-medium', !isYearly ? 'text-text-heading' : 'text-text-muted')}>Monthly</span>
                <button
                    onClick={() => setIsYearly(!isYearly)}
                    className={cn(
                        'relative w-14 h-7 rounded-full transition-colors',
                        isYearly ? 'bg-primary' : 'bg-surface'
                    )}
                >
                    <div className={cn(
                        'absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-sm transition-transform',
                        isYearly ? 'translate-x-7' : 'translate-x-0.5'
                    )} />
                </button>
                <span className={cn('text-sm font-medium', isYearly ? 'text-text-heading' : 'text-text-muted')}>
                    Annual
                    <span className="ml-1.5 px-2 py-0.5 rounded-full bg-success/15 text-success text-[10px] font-bold">
                        Save 20%
                    </span>
                </span>
            </div>

            {/* Pricing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-24">
                {PLANS.map(plan => {
                    const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
                    const period = isYearly ? '/yr' : '/mo';

                    return (
                        <div
                            key={plan.name}
                            className={cn(
                                'glass-card p-7 flex flex-col relative',
                                plan.highlight && 'ring-2 ring-primary/50 shadow-lg shadow-primary/10',
                                !plan.highlight && 'hover:border-border-light'
                            )}
                            style={{ transform: 'none' }}
                        >
                            {plan.badge && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <span className="px-3 py-1 rounded-full bg-primary text-white text-[10px] font-bold flex items-center gap-1">
                                        <Sparkles className="w-3 h-3" />
                                        {plan.badge}
                                    </span>
                                </div>
                            )}

                            <h3 className="text-lg font-bold text-text-heading mb-1">{plan.name}</h3>
                            <p className="text-xs text-text-muted mb-5">{plan.description}</p>

                            <div className="mb-6">
                                <span className="text-4xl font-extrabold text-text-heading">
                                    {price === 0 ? 'Free' : `$${price}`}
                                </span>
                                {price > 0 && <span className="text-sm text-text-muted">{period}</span>}
                            </div>

                            <Link
                                href={plan.ctaLink}
                                className={cn(
                                    'w-full text-center py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 mb-6 transition-all',
                                    plan.highlight
                                        ? 'btn-primary'
                                        : 'btn-secondary'
                                )}
                            >
                                {plan.cta}
                                <ArrowRight className="w-4 h-4" />
                            </Link>

                            <div className="space-y-3 flex-grow">
                                {plan.features.map(f => (
                                    <div key={f.text} className="flex items-center gap-2.5">
                                        {f.included ? (
                                            <div className="w-4 h-4 rounded-full bg-success/20 flex items-center justify-center flex-shrink-0">
                                                <Check className="w-2.5 h-2.5 text-success" />
                                            </div>
                                        ) : (
                                            <div className="w-4 h-4 rounded-full bg-surface flex items-center justify-center flex-shrink-0">
                                                <X className="w-2.5 h-2.5 text-text-subtle" />
                                            </div>
                                        )}
                                        <span className={cn('text-sm', f.included ? 'text-text-body' : 'text-text-subtle')}>
                                            {f.text}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* FAQ */}
            <div className="max-w-2xl mx-auto">
                <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
                <div className="space-y-3">
                    {FAQS.map((faq, i) => (
                        <div key={i} className="glass-card overflow-hidden" style={{ transform: 'none' }}>
                            <button
                                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                className="w-full flex items-center justify-between p-4 text-left"
                            >
                                <span className="text-sm font-medium text-text-heading">{faq.q}</span>
                                <ChevronDown className={cn(
                                    'w-4 h-4 text-text-subtle transition-transform flex-shrink-0 ml-4',
                                    openFaq === i && 'rotate-180'
                                )} />
                            </button>
                            {openFaq === i && (
                                <div className="px-4 pb-4">
                                    <p className="text-sm text-text-muted leading-relaxed">{faq.a}</p>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
