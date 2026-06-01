'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { SubscriptionPlanView } from '@/lib/billing/plan-ui'

/* ——————————————————————————————————————
   Select Plan Client – Shopify-level
   Premium inline-styled plan picker
   —————————————————————————————————————— */

interface SelectPlanClientProps {
    plans: SubscriptionPlanView[]
    currentPlan: string | null
    storeName: string
    storeSlug: string
    storeId: string
    siteType: string
    trialStatus: string | null
    trialEndsAt: string | null
}

/* — Formatters — */
function formatINR(paise: number): string {
    const rupees = paise / 100
    if (rupees >= 1000) {
        return `₹${(rupees / 1000).toFixed(rupees % 1000 === 0 ? 0 : 1)}k`
    }
    return `₹${rupees.toLocaleString('en-IN')}`
}

export default function SelectPlanClient({
    plans,
    currentPlan,
    storeName,
    storeSlug,
    siteType,
    trialStatus,
    trialEndsAt,
}: SelectPlanClientProps) {
    const router = useRouter()
    const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'yearly'>('monthly')
    const [showCompare, setShowCompare] = useState(false)
    const [renderTime] = useState(() => Date.now())
    const [renderDate] = useState(() => new Date())

    const trialDaysLeft = trialEndsAt
        ? Math.max(0, Math.ceil((new Date(trialEndsAt).getTime() - renderTime) / (1000 * 60 * 60 * 24)))
        : 0
    const isTrialExpired = trialStatus === 'expired' || (trialEndsAt && new Date(trialEndsAt) < renderDate)

    const handleSelectPlan = (planSlug: string) => {
        const plan = plans.find(p => p.slug === planSlug)
        if (plan?.requires_contact) {
            window.open('mailto:sales@letbuyy.com?subject=Enterprise Plan Inquiry', '_blank')
            return
        }
        router.push(`/${storeSlug}/settings/subscribe/checkout?plan=${planSlug}&bp=${billingPeriod.toUpperCase()}&site_type=${siteType}`)
    }

    // Compare features
    const compareFeatures = plans.find(p => p.compare_features?.length > 0)?.compare_features || []
    const planSlugs = plans.map(p => p.slug)
    const gridColumns = 'repeat(auto-fit, minmax(240px, 1fr))'
    const compareGridColumns = `1.5fr repeat(${Math.max(plans.length, 1)}, minmax(120px, 1fr))`

    return (
        <div style={{
            maxWidth: 1100,
            margin: '0 auto',
            padding: '40px 24px 80px',
        }}>
            {/* Hero */}
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
                <div style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    color: 'var(--text-secondary, #94A3B8)',
                    marginBottom: 16,
                }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>storefront</span>
                    <span>{storeName}</span>
                    <span className="material-symbols-outlined" style={{ fontSize: 14, opacity: 0.5 }}>chevron_right</span>
                    <span>Select a plan</span>
                </div>

                <h1 style={{
                    fontSize: 32,
                    fontWeight: 700,
                    color: 'var(--text-primary, #F1F5F9)',
                    margin: '0 0 16px',
                    letterSpacing: '-0.5px',
                    lineHeight: 1.25,
                }}>
                    {isTrialExpired
                        ? 'Your trial has ended — pick a plan to continue'
                        : trialDaysLeft > 0
                            ? `${trialDaysLeft} day${trialDaysLeft !== 1 ? 's' : ''} left in your trial — choose a plan`
                            : 'Everything you need to run your business'}
                </h1>

                {/* Value highlights row */}
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 24,
                    flexWrap: 'wrap',
                    marginBottom: 32,
                }}>
                    {[
                        { icon: 'language', text: 'Custom domain' },
                        { icon: 'auto_awesome', text: 'AI built-in' },
                        { icon: 'monitoring', text: '24/7 monitoring' },
                        { icon: 'currency_rupee', text: 'Indian INR pricing' },
                    ].map((h, i) => (
                        <div key={i} style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 13,
                            color: 'var(--text-secondary, #94A3B8)',
                        }}>
                            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--primary, #8B5CF6)' }}>{h.icon}</span>
                            <span>{h.text}</span>
                        </div>
                    ))}
                </div>

                {/* Billing toggle pill */}
                <div style={{
                    display: 'inline-flex',
                    background: 'var(--bg-tertiary, #1E293B)',
                    borderRadius: 12,
                    padding: 4,
                    border: '1px solid var(--border, #334155)',
                }}>
                    {(['monthly', 'yearly'] as const).map(bp => (
                        <button
                            key={bp}
                            onClick={() => setBillingPeriod(bp)}
                            style={{
                                padding: '10px 24px',
                                borderRadius: 8,
                                border: 'none',
                                cursor: 'pointer',
                                fontSize: 14,
                                fontWeight: 600,
                                fontFamily: 'inherit',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 8,
                                transition: 'all 0.2s',
                                background: billingPeriod === bp ? 'var(--bg-secondary, #0F172A)' : 'transparent',
                                color: billingPeriod === bp ? 'var(--text-primary, #F1F5F9)' : 'var(--text-secondary, #94A3B8)',
                                boxShadow: billingPeriod === bp ? '0 1px 3px rgba(0,0,0,0.3)' : 'none',
                            }}
                        >
                            {bp === 'monthly' ? 'Monthly' : 'Annual'}
                            {bp === 'yearly' && (
                                <span style={{
                                    fontSize: 11,
                                    fontWeight: 700,
                                    padding: '2px 8px',
                                    borderRadius: 20,
                                    background: 'rgba(34, 197, 94, 0.15)',
                                    color: '#22C55E',
                                }}>Save 20%</span>
                            )}
                        </button>
                    ))}
                </div>
            </div>

            {/* Plan cards grid */}
            {plans.length > 0 ? (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: gridColumns,
                    gap: 20,
                    marginTop: 0,
                    marginBottom: 56,
                    marginLeft: plans.length <= 2 ? 'auto' : 0,
                    marginRight: plans.length <= 2 ? 'auto' : 0,
                    maxWidth: plans.length <= 2 ? 720 : undefined,
                }}>
                    {plans.map(plan => {
                        const price = billingPeriod === 'monthly' ? plan.price_monthly_inr : plan.price_yearly_inr
                        const hasPromo = plan.promo_price_inr > 0 && plan.promo_months > 0
                        const isCurrent = currentPlan === plan.slug
                        const isPopular = plan.is_popular
                        const isFree = plan.price_monthly_inr === 0 && plan.price_yearly_inr === 0 && !plan.requires_contact

                        return (
                            <div
                                key={plan.id}
                                style={{
                                    position: 'relative',
                                    background: isPopular
                                        ? 'linear-gradient(135deg, rgba(139, 92, 246, 0.08) 0%, rgba(59, 130, 246, 0.06) 100%)'
                                        : 'var(--bg-secondary, #0F172A)',
                                    border: isPopular
                                        ? '2px solid var(--primary, #8B5CF6)'
                                        : '1px solid var(--border, #334155)',
                                    borderRadius: 16,
                                    padding: '32px 28px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    transition: 'transform 0.2s, box-shadow 0.2s',
                                }}
                                onMouseEnter={e => {
                                    e.currentTarget.style.transform = 'translateY(-4px)'
                                    e.currentTarget.style.boxShadow = '0 12px 40px rgba(0,0,0,0.25)'
                                }}
                                onMouseLeave={e => {
                                    e.currentTarget.style.transform = 'translateY(0)'
                                    e.currentTarget.style.boxShadow = 'none'
                                }}
                            >
                                {/* Popular badge */}
                                {isPopular && (
                                    <div style={{
                                        position: 'absolute',
                                        top: -12,
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        background: 'var(--primary, #8B5CF6)',
                                        color: '#fff',
                                        fontSize: 11,
                                        fontWeight: 700,
                                        padding: '4px 16px',
                                        borderRadius: 20,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                    }}>
                                        Most Popular
                                    </div>
                                )}

                                {/* Plan name & tagline */}
                                <div style={{ marginBottom: 20 }}>
                                    <h3 style={{
                                        fontSize: 20,
                                        fontWeight: 700,
                                        color: 'var(--text-primary, #F1F5F9)',
                                        margin: '0 0 4px',
                                    }}>{plan.name}</h3>
                                    <p style={{
                                        fontSize: 13,
                                        color: 'var(--text-secondary, #94A3B8)',
                                        margin: 0,
                                        lineHeight: 1.5,
                                    }}>{plan.tagline}</p>
                                </div>

                                {/* Price */}
                                <div style={{ marginBottom: 24 }}>
                                    {hasPromo && (
                                        <div style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            marginBottom: 4,
                                        }}>
                                            <span style={{
                                                fontSize: 12,
                                                fontWeight: 600,
                                                padding: '2px 8px',
                                                borderRadius: 6,
                                                background: 'rgba(139, 92, 246, 0.15)',
                                                color: 'var(--primary-light, #A78BFA)',
                                            }}>
                                                First {plan.promo_months} months
                                            </span>
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                                        {hasPromo ? (
                                            <>
                                                <span style={{
                                                    fontSize: 40,
                                                    fontWeight: 800,
                                                    color: 'var(--text-primary, #F1F5F9)',
                                                    letterSpacing: '-1px',
                                                    lineHeight: 1,
                                                }}>{formatINR(plan.promo_price_inr)}</span>
                                                <span style={{
                                                    fontSize: 14,
                                                    color: 'var(--text-hint, #64748B)',
                                                    textDecoration: 'line-through',
                                                }}>{formatINR(price)}</span>
                                            </>
                                        ) : plan.requires_contact ? (
                                            <span style={{
                                                fontSize: 32,
                                                fontWeight: 800,
                                                color: 'var(--text-primary, #F1F5F9)',
                                                letterSpacing: '-1px',
                                                lineHeight: 1,
                                            }}>Custom</span>
                                        ) : (
                                            <span style={{
                                                fontSize: 40,
                                                fontWeight: 800,
                                                color: 'var(--text-primary, #F1F5F9)',
                                                letterSpacing: '-1px',
                                                lineHeight: 1,
                                            }}>{formatINR(price)}</span>
                                        )}
                                        {!plan.requires_contact && !isFree && (
                                            <span style={{
                                                fontSize: 14,
                                                color: 'var(--text-hint, #64748B)',
                                            }}>/month</span>
                                        )}
                                    </div>

                                    {plan.gmv_percentage > 0 && (
                                        <p style={{
                                            fontSize: 12,
                                            color: 'var(--text-hint, #64748B)',
                                            margin: '4px 0 0',
                                        }}>
                                            + {plan.gmv_percentage}% transaction fee
                                        </p>
                                    )}
                                </div>

                                {/* CTA */}
                                <button
                                    onClick={() => handleSelectPlan(plan.slug)}
                                    disabled={isCurrent}
                                    style={{
                                        width: '100%',
                                        padding: '12px 0',
                                        borderRadius: 10,
                                        border: 'none',
                                        cursor: isCurrent ? 'default' : 'pointer',
                                        fontSize: 14,
                                        fontWeight: 700,
                                        fontFamily: 'inherit',
                                        marginBottom: 24,
                                        transition: 'all 0.2s',
                                        background: isCurrent
                                            ? 'var(--bg-tertiary, #1E293B)'
                                            : isPopular
                                                ? 'var(--primary, #8B5CF6)'
                                                : plan.requires_contact
                                                    ? 'transparent'
                                                    : 'var(--bg-tertiary, #1E293B)',
                                        color: isCurrent
                                            ? 'var(--text-hint, #64748B)'
                                            : isPopular
                                                ? '#fff'
                                                : 'var(--text-primary, #F1F5F9)',
                                    }}
                                >
                                    {isCurrent ? 'Current plan' : plan.requires_contact ? 'Contact sales' : isFree ? 'Start free' : 'Start free trial'}
                                </button>

                                {/* Features */}
                                <div style={{ flex: 1 }}>
                                    <p style={{
                                        fontSize: 11,
                                        fontWeight: 600,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                        color: 'var(--text-hint, #64748B)',
                                        margin: '0 0 12px',
                                    }}>What&apos;s included</p>
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                        {(plan.features || []).map((f, i) => (
                                            <li key={i} style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: 8,
                                                fontSize: 13,
                                                color: 'var(--text-secondary, #94A3B8)',
                                            }}>
                                                <span className="material-symbols-outlined" style={{
                                                    fontSize: 16,
                                                    color: 'var(--primary-light, #A78BFA)',
                                                    flexShrink: 0,
                                                }}>{f.icon}</span>
                                                {f.label}
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        )
                    })}
                </div>
            ) : (
                /* Empty state */
                <div style={{
                    textAlign: 'center',
                    padding: '60px 20px',
                    background: 'var(--bg-secondary, #0F172A)',
                    borderRadius: 16,
                    border: '1px solid var(--border, #334155)',
                    marginBottom: 48,
                }}>
                    <span className="material-symbols-outlined" style={{
                        fontSize: 48,
                        color: 'var(--text-hint, #64748B)',
                        marginBottom: 16,
                        display: 'block',
                    }}>credit_card</span>
                    <p style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: 'var(--text-primary, #F1F5F9)',
                        margin: '0 0 8px',
                    }}>Plans are loading…</p>
                    <p style={{
                        fontSize: 13,
                        color: 'var(--text-secondary, #94A3B8)',
                        margin: 0,
                    }}>The plans database hasn&apos;t been set up yet. Contact support if this persists.</p>
                </div>
            )}

            {/* Compare plans toggle */}
            {compareFeatures.length > 0 && (
                <>
                    <div style={{ textAlign: 'center', marginBottom: 40 }}>
                        <button
                            onClick={() => setShowCompare(!showCompare)}
                            style={{
                                background: 'none',
                                border: '1px solid var(--border, #334155)',
                                borderRadius: 10,
                                padding: '10px 24px',
                                cursor: 'pointer',
                                fontSize: 14,
                                fontWeight: 600,
                                fontFamily: 'inherit',
                                color: 'var(--text-primary, #F1F5F9)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 8,
                                transition: 'all 0.2s',
                            }}
                        >
                            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
                                {showCompare ? 'expand_less' : 'compare'}
                            </span>
                            {showCompare ? 'Hide comparison' : 'Compare all features'}
                        </button>
                    </div>

                    {/* Comparison table */}
                    {showCompare && (
                        <div style={{
                            marginBottom: 56,
                            border: '1px solid var(--border, #334155)',
                            background: 'var(--bg-secondary, #0F172A)',
                        }}>
                            {/* Sticky main header — sticks below 56px page header */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: compareGridColumns,
                                background: '#1E293B',
                                borderBottom: '2px solid var(--border, #334155)',
                                position: 'sticky',
                                top: 57,
                                zIndex: 20,
                            }}>
                                <div style={{ padding: '16px 24px', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary, #94A3B8)' }}>
                                    Feature
                                </div>
                                {plans.map(p => (
                                    <div key={p.slug} style={{
                                        padding: '16px 20px',
                                        textAlign: 'center',
                                        fontSize: 14,
                                        fontWeight: 700,
                                        color: p.is_popular ? 'var(--primary, #8B5CF6)' : 'var(--text-primary, #F1F5F9)',
                                    }}>
                                        {p.name}
                                    </div>
                                ))}
                            </div>

                            {/* Table body — categories with sticky sub-headers */}
                            {compareFeatures.map((cat, ci) => (
                                <div key={ci}>
                                    {/* Sticky category sub-header — stacks below main header (57 + ~52 = 109) */}
                                    <div style={{
                                        display: 'grid',
                                        gridTemplateColumns: '1fr',
                                        padding: '10px 24px',
                                        background: '#0F172A',
                                        borderBottom: '1px solid var(--border, #334155)',
                                        borderTop: ci > 0 ? '1px solid var(--border, #334155)' : 'none',
                                        fontSize: 12,
                                        fontWeight: 700,
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px',
                                        color: 'var(--primary-light, #A78BFA)',
                                        position: 'sticky',
                                        top: 109,
                                        zIndex: 15,
                                    }}>
                                        {cat.category}
                                    </div>

                                    {/* Feature rows */}
                                    {cat.items.map((item, ii) => (
                                        <div key={ii} style={{
                                            display: 'grid',
                                            gridTemplateColumns: compareGridColumns,
                                            borderBottom: '1px solid var(--border, #334155)',
                                        }}>
                                            <div style={{
                                                padding: '14px 24px',
                                                fontSize: 13,
                                                color: 'var(--text-primary, #F1F5F9)',
                                            }}>
                                                {item.label}
                                                {item.description && (
                                                    <div style={{ fontSize: 11, color: 'var(--text-hint, #64748B)', marginTop: 2 }}>
                                                        {item.description}
                                                    </div>
                                                )}
                                            </div>
                                            {planSlugs.map(slug => {
                                                const val = (item as unknown as Record<string, unknown>)[slug] ?? false
                                                return (
                                                    <div key={slug} style={{
                                                        padding: '14px 20px',
                                                        textAlign: 'center',
                                                        fontSize: 13,
                                                        color: val === false ? 'var(--text-hint, #64748B)' : 'var(--text-primary, #F1F5F9)',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                    }}>
                                                        {val === true ? (
                                                            <span className="material-symbols-outlined" style={{ fontSize: 18, color: '#22C55E' }}>check_circle</span>
                                                        ) : val === false ? (
                                                            <span className="material-symbols-outlined" style={{ fontSize: 18, opacity: 0.3 }}>remove</span>
                                                        ) : (
                                                            <span>{String(val)}</span>
                                                        )}
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Footer */}
            <div style={{
                textAlign: 'center',
                borderTop: '1px solid var(--border, #334155)',
                paddingTop: 32,
            }}>
                <p style={{ fontSize: 14, color: 'var(--text-secondary, #94A3B8)', margin: '0 0 8px' }}>
                    Need help choosing?{' '}
                    <a href="mailto:support@letbuyy.com" style={{ color: 'var(--primary, #8B5CF6)', fontWeight: 600, textDecoration: 'none' }}>
                        Contact our team
                    </a>
                </p>
                <p style={{ fontSize: 13, color: 'var(--text-hint, #64748B)', margin: 0 }}>
                    All plans include a 7-day free trial. Cancel anytime.
                </p>
            </div>
        </div>
    )
}
