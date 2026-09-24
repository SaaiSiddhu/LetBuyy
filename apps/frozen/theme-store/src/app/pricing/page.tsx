'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button, Check, X, Sparkles, ArrowRight, ChevronDown } from '@letbuyy/ui';
import { cn } from '@/lib/utils';

const PLANS = [
    {
        name: 'Free',
        priceLabel: 'Free',
        description: 'Get started with free themes',
        cta: 'Browse free themes',
        ctaLink: '/themes?pricing=free',
        highlight: false,
        features: [
            { text: 'All free themes', included: true },
            { text: 'Store preview before publish', included: true },
            { text: 'Draft install and rollback flow', included: true },
            { text: 'Basic customization', included: true },
            { text: 'Premium theme license', included: false },
            { text: 'Standalone artifact download', included: false },
        ],
    },
    {
        name: 'Premium theme',
        priceLabel: 'Per listing',
        description: 'One-time theme purchases',
        cta: 'Browse paid themes',
        ctaLink: '/themes?pricing=paid',
        highlight: true,
        badge: 'Live path',
        features: [
            { text: 'Provider-verified INR checkout', included: true },
            { text: 'Receipt and license issue', included: true },
            { text: 'Order history and license view', included: true },
            { text: 'Merchant editor access after install', included: true },
            { text: 'Standalone downloads when artifacts are available', included: true },
            { text: 'Subscription entitlement billing', included: false },
        ],
    },
    {
        name: 'Developer program',
        priceLabel: 'Apply',
        description: 'Submit and manage theme listings',
        cta: 'Open developer console',
        ctaLink: '/developer',
        highlight: false,
        features: [
            { text: 'Listing builder', included: true },
            { text: 'Review status and feedback', included: true },
            { text: 'License-tier metadata', included: true },
            { text: 'Analytics dashboard structure', included: true },
            { text: 'Payout activation after program approval', included: false },
            { text: 'External scanner activation after provider setup', included: false },
        ],
    },
];

const FAQS = [
    {
        q: 'What can I buy today?',
        a: 'The marketplace commerce path is per-theme one-time purchase in INR. Free themes can be installed without a purchase.',
    },
    {
        q: 'What\'s your refund policy?',
        a: 'Refund requests are recorded through the marketplace and require operator review before provider-side execution.',
    },
    {
        q: 'Do themes work on mobile?',
        a: 'Themes are designed for responsive LetBuyy storefront surfaces. Preview your selected store before publishing changes.',
    },
    {
        q: 'Can I use themes on multiple stores?',
        a: 'Theme install and license scope are recorded per purchase and store action. Use the receipt and license views for the current entitlement record.',
    },
    {
        q: 'Do I need coding knowledge?',
        a: 'Marketplace install does not require coding. Theme editing happens in the merchant editor after installation.',
    },
];

export default function PricingPage() {
    const [openFaq, setOpenFaq] = useState<number | null>(null);

    return (
        <div className="container-main py-16 md:py-24">
            {/* Header */}
            <div className="text-center mb-14 max-w-2xl mx-auto">
                <p className="text-xs font-semibold uppercase tracking-widest text-primary-light mb-3">Pricing</p>
                <h1 className="text-3xl md:text-5xl font-bold mb-4">
                    Theme Marketplace <span className="gradient-text">Pricing</span>
                </h1>
                <p className="text-text-body text-lg">
                    Buy individual themes, install free themes, and submit developer listings through the marketplace.
                </p>
            </div>

            {/* Pricing Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto mb-24">
                {PLANS.map(plan => (
                        <div
                            key={plan.name}
                            className={cn(
                                'glass-card p-7 flex flex-col relative',
                                plan.highlight && 'ring-2 ring-primary/50 shadow-lg shadow-primary/10',
                                !plan.highlight && 'hover:border-border-light'
                            )}
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
                                    {plan.priceLabel}
                                </span>
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
                ))}
            </div>

            {/* FAQ */}
            <div className="max-w-2xl mx-auto">
                <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
                <div className="space-y-3">
                    {FAQS.map((faq, i) => (
                        <div key={i} className="glass-card overflow-hidden">
                            <Button unstyled
                                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                                className="w-full flex items-center justify-between p-4 text-left"
                            >
                                <span className="text-sm font-medium text-text-heading">{faq.q}</span>
                                <ChevronDown className={cn(
                                    'w-4 h-4 text-text-subtle transition-transform flex-shrink-0 ml-4',
                                    openFaq === i && 'rotate-180'
                                )} />
                            </Button>
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
