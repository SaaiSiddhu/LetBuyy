'use client'

import { useCopy } from '@/components/i18n/useCopy'

import Copy from '@/components/i18n/Copy'

import { useState, useRef, useEffect, forwardRef, type PointerEvent, type KeyboardEvent } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence, useInView, useReducedMotion, useIsPresent } from 'framer-motion'
import {
    BarChart3,
    Bot,
    Button,
    ChevronDown,
    CreditCard,
    Sparkles,
    Package,
    ShoppingBag,
    Store,
    Truck,
    Users,
    type LucideIcon,
} from '@letbuyy/ui'
import { fitCapabilityPreview } from '@/lib/capability-preview-layout'
import { revealAccordionItem } from '@/lib/reveal-accordion-item'
import CapabilityArtwork from './CapabilityArtwork'
import { TOUR_STEP_MS, TOUR_READING_PAUSE_MS, nextCapability, previousCapability, capabilitySwipeDirection, capabilityTourIsDue, type CapabilityId } from '@/lib/capability-tour'

interface Capability {
    id: CapabilityId
    label: string
    tagline: string
    description: string
    features: string[]
    connections: CapabilityId[]
    badge: string
    icon?: LucideIcon
    materialName?: string
    accentColor: string
}

interface CmapVars extends React.CSSProperties {
    '--cmap-accent'?: string
}

const CAPABILITIES: Capability[] = [
    {
        id: 'storefronts',
        label: 'Storefronts',
        tagline: 'Your brand, live everywhere',
        description: 'Launch a fully branded storefront with custom domains, themes, and responsive product pages — all synced to your inventory and orders in real time.',
        features: ['Custom domains & SSL', 'Mobile-first themes', 'SEO-ready pages'],
        connections: ['orders', 'inventory', 'analytics', 'ai'],
        badge: 'Live',
        icon: Store,
        accentColor: 'var(--lb-primitive-color-teal-500)',
    },
    {
        id: 'orders',
        label: 'Orders',
        tagline: 'End-to-end order lifecycle',
        description: 'Track every order from placed to delivered. Fulfill, manage returns, notify customers, and reconcile payments — all in one unified inbox.',
        features: ['Real-time order status', 'Returns & refunds', 'Fulfillment + shipping'],
        connections: ['storefronts', 'inventory', 'payments', 'customers'],
        badge: 'Live',
        icon: ShoppingBag,
        accentColor: 'var(--lb-primitive-color-blue-500)',
    },
    {
        id: 'inventory',
        label: 'Inventory',
        tagline: 'Stock intelligence, zero surprises',
        description: 'Monitor stock levels across your storefront and B2B channels. Get low-stock alerts, manage variants, and trigger purchase orders automatically.',
        features: ['Variants & SKUs', 'Low-stock alerts', 'Purchase orders'],
        connections: ['orders', 'storefronts', 'b2b', 'ai'],
        badge: 'Live',
        icon: Package,
        accentColor: 'var(--lb-primitive-color-amber-500)',
    },
    {
        id: 'payments',
        label: 'Payments',
        tagline: 'India-first, zero friction',
        description: 'UPI, COD, and cards — all ready out of the box. GST invoices auto-generated, Razorpay verified server-side, every rupee in your ledger.',
        features: ['UPI + COD + Cards', 'Auto GST invoices', 'Razorpay integrated'],
        connections: ['orders', 'customers', 'analytics'],
        badge: 'Live',
        icon: CreditCard,
        accentColor: 'var(--lb-primitive-color-emerald-500)',
    },
    {
        id: 'customers',
        label: 'Customers',
        tagline: 'Profiles, loyalty, insights',
        description: 'Build rich customer profiles with full purchase history, reviews, and behavioral segments. Run retention campaigns directly from the platform.',
        features: ['Customer profiles', 'Purchase history & reviews', 'Segments & retention'],
        connections: ['orders', 'payments', 'analytics', 'ai'],
        badge: 'Live',
        icon: Users,
        accentColor: 'var(--lb-primitive-color-pink-500)',
    },
    {
        id: 'analytics',
        label: 'Analytics',
        tagline: 'Revenue intelligence, always on',
        description: 'Monitor revenue, conversion, and product performance. Get daily snapshots and live dashboards powered by your real commerce data.',
        features: ['Revenue & conversion', 'Product performance', 'Customer trends'],
        connections: ['storefronts', 'orders', 'payments', 'customers'],
        badge: 'Live',
        icon: BarChart3,
        accentColor: 'var(--lb-primitive-color-purple-500)',
    },
    {
        id: 'ai',
        label: 'AI Operator & Automation',
        tagline: 'Autonomous commerce operations',
        description: 'AI-driven operations: auto-generate product descriptions, forecast demand, detect fraudulent orders, and optimize dynamic pricing.',
        features: [
            'Generative AI for SEO-optimized product copy and imagery',
            'Demand forecasting engine based on historical sales and seasonality',
            'Fraud and RTO (Return to Origin) prediction score on every order',
            'AI customer support agent for order tracking and FAQs',
            'Dynamic discount recommendation based on inventory velocity',
        ],
        connections: ['inventory', 'orders', 'customers', 'storefronts'],
        accentColor: 'var(--lb-primitive-color-purple-400)',
        badge: 'Intelligence',
        icon: Bot,
    },
    {
        id: 'b2b',
        label: 'B2B & Wholesale',
        tagline: 'Bulk ordering, tiered pricing, and credit terms',
        description: 'Wholesale commerce built into your store: tiered price lists, minimum order quantities, net payment terms, and custom buyer catalogs.',
        features: [
            'Custom price lists per customer group or corporate account',
            'Net-30 / Net-60 credit terms with automated invoicing',
            'Tiered volume discounts and minimum order value gates',
            'Quick-order forms and CSV bulk reorder capability',
            'Dedicated B2B buyer portal with approval workflows',
        ],
        connections: ['inventory', 'payments', 'customers', 'orders'],
        accentColor: 'var(--lb-color-primary)',
        badge: 'B2B',
        icon: Truck,
    },
]

function StorefrontMock() {
    const products = [
        { name: 'Air Classic 90', price: '₹2,840' },
        { name: 'Street Runner',  price: '₹3,598' },
        { name: 'Court Legacy',   price: '₹1,999' },
        { name: 'Retro High',     price: '₹4,180' },
    ]
    return (
        <div className="cmap-mock cmap-mock-storefront cmap-sf-browser" aria-hidden="true">
            {/* Browser chrome */}
            <div className="cmap-sf-bar">
                <div className="cmap-sf-dots">
                    <span className="cmap-mock-dot" />
                    <span className="cmap-mock-dot" />
                    <span className="cmap-mock-dot" />
                </div>
                <div className="cmap-sf-url">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                    </svg>
                    <span>urbankicks.store</span>
                </div>
                <span className="cmap-sf-live">PREVIEW</span>
            </div>

            {/* Storefront content */}
            <div className="cmap-sf-content">
                <div className="cmap-sf-page">
                    {/* Header */}
                    <header className="cmap-sf-nav">
                        <span className="cmap-sf-nav-name">Urban Kicks</span>
                        <div className="cmap-sf-nav-links">
                            <span className="cmap-sf-link-active"><Copy text={"Home"} /></span>
                            <span>Shop</span>
                            <span>Drops</span>
                        </div>
                        <div className="cmap-sf-nav-actions">
                            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>
                            </svg>
                            <span className="cmap-sf-cart-badge">2</span>
                        </div>
                    </header>

                    {/* Hero */}
                    <div className="cmap-sf-hero">
                        <div className="cmap-sf-hero-content">
                            <span className="cmap-sf-hero-tag">New Drop</span>
                            <h3 className="cmap-sf-hero-title">Step Into<br />Your Style</h3>
                            <p className="cmap-sf-hero-sub">Latest sneakers &amp; streetwear, all sizes</p>
                            <span className="cmap-sf-hero-cta">
                                Shop Now
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M5 12h14M12 5l7 7-7 7"/>
                                </svg>
                            </span>
                        </div>
                        <div className="cmap-sf-hero-art">
                            <span className="cmap-sf-art-word">URBAN</span>
                            <Image src="/illustrations/storefront/urban-kicks-hero-v1.webp" alt="" width={1000} height={667} sizes="(max-width: 640px) 50vw, 360px" loading="lazy" unoptimized />
                            <span className="cmap-sf-art-caption">The everyday collection · 01</span>
                        </div>
                    </div>

                    {/* Collections */}
                    <div className="cmap-sf-collections">
                        <span className="cmap-sf-section-label">Shop by Collection</span>
                        <div className="cmap-sf-collections-row">
                            {['All', 'Sneakers', 'Hoodies', 'Tees', 'Caps', 'Sale'].map((c, i) => (
                                <div key={c} className={`cmap-sf-chip${i === 0 ? ' cmap-sf-chip-active' : ''}`}>{c}</div>
                            ))}
                        </div>
                    </div>

                    {/* Product grid */}
                    <div className="cmap-sf-products">
                        {products.map((p, index) => (
                            <div key={p.name} className="cmap-sf-product-card">
                                <div className="cmap-sf-product-img">
                                    <Image className={`cmap-sf-product-art cmap-sf-product-art--${index}`} src="/illustrations/storefront/urban-kicks-products-v1.webp" alt="" width={1000} height={1000} sizes="(max-width: 640px) 60vw, 320px" loading="lazy" unoptimized />
                                </div>
                                <div className="cmap-sf-product-info">
                                    <span className="cmap-sf-product-name">{p.name}</span>
                                    <span className="cmap-sf-product-price">{p.price}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Footer */}
                    <footer className="cmap-sf-footer">
                        <span className="cmap-sf-footer-brand">Urban Kicks</span>
                        <span className="cmap-sf-footer-sep" />
                        <span className="cmap-sf-footer-link">Privacy</span>
                        <span className="cmap-sf-footer-sep" />
                        <span className="cmap-sf-footer-link">Shipping</span>
                        <span className="cmap-sf-footer-sep" />
                        <span className="cmap-sf-footer-link">Returns</span>
                    </footer>
                </div>
            </div>

            {/* Perf strip */}
            <div className="cmap-mock-perf-strip">
                <span className="cmap-mock-perf-item">
                    <span className="cmap-mock-perf-dot" />
                    Illustrative storefront
                </span>
                <span className="cmap-mock-perf-divider" />
                <span className="cmap-mock-perf-item">Custom domain connected</span>
                <span className="cmap-mock-perf-divider" />
                <span className="cmap-mock-perf-item">SSL active</span>
            </div>
        </div>
    )
}

/** Shared catalog cutouts keep the same sample products recognizable across previews. */
function CatalogThumbnail({ index }: { index: number }) {
    const products = ['sneaker', 'hoodie', 'tee', 'cap', 'jogger'] as const
    return (
        <span className="cmap-catalog-thumb">
            <Image src={`/illustrations/capabilities/product-${products[index]}-v1.webp`} alt="" width={160} height={192} sizes="32px" loading="lazy" unoptimized />
        </span>
    )
}

function OrdersMock() {
    const orders = [
        { id: 'ORD-4821', product: 'Air Classic',   qty: 1, amount: '₹2,840', status: 'Delivered',  badge: 'success', img: 0 },
        { id: 'ORD-4820', product: 'Street Hoodie', qty: 2, amount: '₹3,598', status: 'Shipped',    badge: 'info',    img: 1 },
        { id: 'ORD-4819', product: 'Sport Tee',     qty: 3, amount: '₹5,499', status: 'Confirmed',  badge: 'primary', img: 2 },
        { id: 'ORD-4818', product: 'Running Cap',   qty: 1, amount: '₹890',   status: 'Placed',     badge: 'muted',   img: 3 },
        { id: 'ORD-4817', product: 'Slim Jogger',   qty: 1, amount: '₹1,299', status: 'Processing', badge: 'warning', img: 4 },
    ]
    return (
        <div className="cmap-mock cmap-mock-orders" aria-hidden="true">
            <div className="cmap-order-header">
                <span className="cmap-order-title"><Copy text={"Orders"} /></span>
                <span className="cmap-order-count">24 today</span>
            </div>
            <div className="cmap-order-thead">
                <span />
                <span>Order ID</span>
                <span>Product</span>
                <span>Qty</span>
                <span>Amount</span>
                <span>Status</span>
            </div>
            {orders.map(o => (
                <div key={o.id} className="cmap-order-row">
                    <div className="cmap-order-thumb"><CatalogThumbnail index={o.img} /></div>
                    <span className="cmap-order-id">{o.id}</span>
                    <span className="cmap-order-product">{o.product}</span>
                    <span className="cmap-order-qty">×{o.qty}</span>
                    <span className="cmap-order-amount">{o.amount}</span>
                    <span className={`cmap-order-badge cmap-order-badge-${o.badge}`}>{o.status}</span>
                </div>
            ))}
        </div>
    )
}

function InventoryMock() {
    const { t } = useCopy()
    const items = [
        { name: 'Air Classic',     sku: 'SKU-001', stock: 42, max: 50, warn: false, status: 'In Stock',  badge: 'success', img: 0 },
        { name: 'Everyday Hoodie', sku: 'SKU-002', stock: 7,  max: 50, warn: true,  status: 'Low Stock', badge: 'warning', img: 1 },
        { name: 'Sport Tee',       sku: 'SKU-003', stock: 21, max: 50, warn: false, status: 'In Stock',  badge: 'success', img: 2 },
        { name: 'Running Cap',     sku: 'SKU-004', stock: 3,  max: 50, warn: true,  status: 'Critical',  badge: 'danger',  img: 3 },
        { name: 'Slim Jogger',     sku: 'SKU-005', stock: 28, max: 50, warn: false, status: 'In Stock',  badge: 'success', img: 4 },
    ]
    return (
        <div className="cmap-mock cmap-mock-inventory" aria-hidden="true">
            <div className="cmap-inv-header">
                <span className="cmap-inv-title"><Copy text={"Inventory"} /></span>
                <span className="cmap-inv-alert">3 low</span>
            </div>
            <div className="cmap-inv-thead">
                <span />
                <span>Product</span>
                <span>Stock</span>
                <span>Qty</span>
                <span>Status</span>
                <span>Adj.</span>
            </div>
            {items.map(item => (
                <div key={item.name} className="cmap-inv-row">
                    <div className="cmap-inv-thumb"><CatalogThumbnail index={item.img} /></div>
                    <div className="cmap-inv-meta">
                        <span className="cmap-inv-name">{item.name}</span>
                        <span className="cmap-inv-sku">{item.sku}</span>
                    </div>
                    <div className="cmap-inv-bar-wrap">
                        <div className="cmap-inv-bar">
                            <div
                                className={`cmap-inv-fill${item.warn ? ' cmap-inv-fill-warn' : ''}`}
                                style={{ width: `${Math.round((item.stock / item.max) * 100)}%` }}
                            />
                        </div>
                    </div>
                    <span className={`cmap-inv-qty${item.warn ? ' cmap-inv-qty-warn' : ''}`}>{item.stock}</span>
                    <span className={`cmap-inv-badge cmap-inv-badge-${item.badge}`}>{item.status}</span>
                    <div className="cmap-inv-actions">
                        <Button unstyled type="button" className="cmap-inv-btn" aria-label={t("Decrease stock")}>−</Button>
                        <Button unstyled type="button" className="cmap-inv-btn" aria-label={t("Increase stock")}>+</Button>
                    </div>
                </div>
            ))}
        </div>
    )
}

function PaymentsMock() {
    return (
        <div className="cmap-mock cmap-mock-payments" aria-hidden="true">
            <div className="cmap-mock-pay-kpis">
                <div className="cmap-mock-pay-kpi cmap-mock-pay-kpi-main">
                    <span>Today&apos;s Revenue</span>
                    <strong>&#x20B9;84,200</strong>
                    <em>+12% vs yesterday</em>
                </div>
                <div className="cmap-mock-pay-kpi">
                    <span>Success Rate</span>
                    <strong>99.2%</strong>
                </div>
                <div className="cmap-mock-pay-kpi">
                    <span>Transactions</span>
                    <strong>47</strong>
                </div>
            </div>
            <div className="cmap-mock-pay-methods">
                {[
                    { label: 'UPI',   pct: 68 },
                    { label: 'Cards', pct: 22 },
                    { label: 'COD',   pct: 10 },
                ].map(m => (
                    <div key={m.label} className="cmap-mock-pay-method">
                        <span><Copy text={m.label} /></span>
                        <div className="cmap-mock-pay-bar">
                            <div className="cmap-mock-pay-fill" style={{ width: `${m.pct}%` }} />
                        </div>
                        <span>{m.pct}%</span>
                    </div>
                ))}
            </div>
        </div>
    )
}

function CustomersMock() {
    const customers = [
        { initials: 'PR', name: 'Priya R.',  since: '2h ago',  orders: 4, ltv: '₹11,280', tier: 'VIP',     badge: 'vip',     color: 0 },
        { initials: 'AS', name: 'Arjun S.',  since: '1d ago',  orders: 2, ltv: '₹4,599',  tier: 'Regular', badge: 'regular', color: 1 },
        { initials: 'MK', name: 'Meera K.',  since: '4h ago',  orders: 7, ltv: '₹28,420', tier: 'VIP',     badge: 'vip',     color: 2 },
        { initials: 'RV', name: 'Rahul V.',  since: '3d ago',  orders: 1, ltv: '₹1,299',  tier: 'New',     badge: 'new',     color: 3 },
        { initials: 'SP', name: 'Sneha P.',  since: '30m ago', orders: 5, ltv: '₹15,890', tier: 'VIP',     badge: 'vip',     color: 4 },
    ]
    return (
        <div className="cmap-mock cmap-mock-customers" aria-hidden="true">
            <div className="cmap-cust-header">
                <span className="cmap-cust-title"><Copy text={"Customers"} /></span>
                <span className="cmap-cust-count">142 total</span>
            </div>
            <div className="cmap-cust-thead">
                <span />
                <span>Customer</span>
                <span><Copy text={"Orders"} /></span>
                <span>Lifetime</span>
                <span>Tier</span>
            </div>
            {customers.map(c => (
                <div key={c.initials} className="cmap-cust-row">
                    <div className={`cmap-cust-avatar cmap-cust-avatar-${c.color}`}>{c.initials}</div>
                    <div className="cmap-cust-meta">
                        <span className="cmap-cust-name">{c.name}</span>
                        <span className="cmap-cust-since">Active {c.since}</span>
                    </div>
                    <span className="cmap-cust-orders">{c.orders}</span>
                    <span className="cmap-cust-ltv">{c.ltv}</span>
                    <span className={`cmap-cust-badge cmap-cust-badge-${c.badge}`}>{c.tier}</span>
                </div>
            ))}
        </div>
    )
}

function AnalyticsMock() {
    const bars = [38, 55, 42, 70, 60, 85, 72]
    return (
        <div className="cmap-mock cmap-mock-analytics" aria-hidden="true">
            <div className="cmap-mock-analytics-kpis">
                {[
                    { value: '₹4.2L',  label: 'Revenue',    trend: '+24%' },
                    { value: '248',    label: 'Orders',     trend: '+18%' },
                    { value: '3.9%',   label: 'Conversion', trend: '+0.4%' },
                    { value: '₹1,820', label: 'AOV',        trend: '+8%' },
                ].map(kpi => (
                    <div key={kpi.label} className="cmap-mock-analytics-kpi">
                        <strong>{kpi.value}</strong>
                        <span>{kpi.label}</span>
                        <em className="cmap-mock-analytics-trend">{kpi.trend}</em>
                    </div>
                ))}
            </div>
            <div className="cmap-mock-analytics-chart">
                <div className="cmap-mock-chart-bars">
                    {bars.map((h, i) => (
                        <div key={i} className="cmap-mock-bar" style={{ height: `${h}%` }} />
                    ))}
                </div>
                <span className="cmap-mock-chart-label">Last 7 days</span>
            </div>
        </div>
    )
}

function AIMock() {
    return (
        <div className="cmap-mock cmap-mock-ai" aria-hidden="true">
            <div className="cmap-mock-ai-header">
                <Sparkles width={15} height={15} aria-hidden="true" />
                <span><Copy text={"AI Copilot"} /></span>
            </div>
            {[
                { type: 'alert', text: 'Restock "Everyday Hoodie" — 7 units left, 12 orders expected this week.' },
                { type: 'nudge', text: 'Offer 5% discount on orders > ₹2,000 to boost AOV by ~18%.' },
                { type: 'copy',  text: 'Updated "Classic Sneakers" description using top-converting phrases.' },
            ].map((insight, i) => (
                <div key={i} className={`cmap-mock-ai-card cmap-mock-ai-card-${insight.type}`}>
                    {insight.text}
                </div>
            ))}
        </div>
    )
}

function B2BMock() {
    const items = [
        { product: 'Classic Sneakers', sku: 'SKU-001', unit: '₹2,250', qty: 50,  sub: '₹1,12,500', disc: '10%', img: 0 },
        { product: 'Everyday Hoodie',  sku: 'SKU-002', unit: '₹1,299', qty: 30,  sub: '₹38,970',   disc: '—',   img: 1 },
        { product: 'Sport Tee',        sku: 'SKU-003', unit: '₹449',   qty: 100, sub: '₹44,900',   disc: '15%', img: 2 },
        { product: 'Running Cap',      sku: 'SKU-004', unit: '₹890',   qty: 20,  sub: '₹17,800',   disc: '5%',  img: 3 },
    ]
    return (
        <div className="cmap-mock cmap-mock-b2b" aria-hidden="true">
            <div className="cmap-b2b-header">
                <div className="cmap-b2b-header-left">
                    <span className="cmap-b2b-order-id">ORD-B0024</span>
                    <span className="cmap-b2b-account">Kiran Enterprises</span>
                </div>
                <div className="cmap-b2b-header-right">
                    <span className="cmap-b2b-tag-wholesale">Wholesale</span>
                    <span className="cmap-b2b-tag-status">In Progress</span>
                </div>
            </div>
            <div className="cmap-b2b-thead">
                <span />
                <span>Product</span>
                <span>Unit</span>
                <span>Qty</span>
                <span>Subtotal</span>
                <span>Disc.</span>
            </div>
            {items.map(item => (
                <div key={item.product} className="cmap-b2b-row">
                    <div className="cmap-b2b-thumb"><CatalogThumbnail index={item.img} /></div>
                    <div className="cmap-b2b-meta">
                        <span className="cmap-b2b-name">{item.product}</span>
                        <span className="cmap-b2b-sku">{item.sku}</span>
                    </div>
                    <span className="cmap-b2b-unit">{item.unit}</span>
                    <span className="cmap-b2b-qty">×{item.qty}</span>
                    <span className="cmap-b2b-sub">{item.sub}</span>
                    <span className={`cmap-b2b-disc${item.disc === '—' ? ' cmap-b2b-disc-none' : ''}`}>{item.disc}</span>
                </div>
            ))}
            <div className="cmap-b2b-total">
                <div className="cmap-b2b-total-left">
                    <span className="cmap-b2b-total-label">Net Total</span>
                    <span className="cmap-b2b-total-items">4 products · ×200 units</span>
                </div>
                <div className="cmap-b2b-total-right">
                    <span className="cmap-b2b-total-amount">&#x20B9;2,14,170</span>
                    <span className="cmap-b2b-total-saved">Saved ₹32,330</span>
                </div>
            </div>
        </div>
    )
}

function CapabilityMock({ id }: { id: CapabilityId }) {
    switch (id) {
        case 'storefronts': return <StorefrontMock />
        case 'orders':      return <OrdersMock />
        case 'inventory':   return <InventoryMock />
        case 'payments':    return <PaymentsMock />
        case 'customers':   return <CustomersMock />
        case 'analytics':   return <AnalyticsMock />
        case 'ai':          return <AIMock />
        case 'b2b':         return <B2BMock />
    }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function ConnectedModules({
    connections,
    onNavigate,
}: {
    connections: CapabilityId[]
    onNavigate: (id: CapabilityId) => void
}) {
    const { t } = useCopy()
    return (
        <div className="cmap-connected">
            <span className="cmap-connected-label">Connected modules</span>
            <div className="cmap-connected-chips">
                {connections.map(id => {
                    const cap = CAPABILITIES.find(c => c.id === id)!
                    const Icon = cap.icon
                    return (
                        <Button
                            unstyled
                            key={id}
                            type="button"
                            className="cmap-connected-chip"
                            style={{ '--cmap-accent': cap.accentColor } as CmapVars}
                            onClick={() => onNavigate(id)}
                            aria-label={t("Explore {label}", { label: t(cap.label) })}
                        >
                            <span style={{ color: cap.accentColor }} aria-hidden="true">
                                {cap.materialName
                                    ? <Sparkles width={12} height={12} aria-hidden="true" />
                                    : Icon ? <Icon width={12} height={12} strokeWidth={2} /> : null
                                }
                            </span>
                            <Copy text={cap.label} />
                        </Button>
                    )
                })}
            </div>
        </div>
    )
}

function CapabilityInfo({ cap, artwork = true }: { cap: Capability; artwork?: boolean }) {
    const { t } = useCopy()
    return (
        <div className={`cmap-panel-info${cap.id !== 'storefronts' ? ' cmap-panel-info--illustrated' : ''}`}>
            <div className="cmap-panel-copy">
                <p className="cmap-panel-desc"><Copy text={cap.description} /></p>
                <ul className="cmap-panel-features" aria-label={t("{label} features", { label: t(cap.label) })}>
                    {cap.features.map(f => <li key={f}><Copy text={f} /></li>)}
                </ul>
            </div>
            {cap.id !== 'storefronts' && (
                <div className={`cmap-capability-scene cmap-capability-scene--${cap.id}`} aria-hidden="true">
                    {artwork && <Image
                        src={`/illustrations/capabilities/${cap.id}-scene-v1.webp`}
                        alt=""
                        width={640}
                        height={600}
                        sizes="(max-width: 767px) 112px, 150px"
                        loading="lazy"
                        unoptimized
                    />}
                </div>
            )}
        </div>
    )
}

/** The mock is decorative; fit it as a complete snapshot instead of adding nested scroll areas. */
function FittedCapabilityPreview({ id }: { id: CapabilityId }) {
    const frame = useRef<HTMLDivElement>(null)
    const source = useRef<HTMLDivElement>(null)
    const [scale, setScale] = useState(0)

    useEffect(() => {
        const viewport = frame.current
        const content = source.current
        if (!viewport || !content) return
        const update = () => setScale(fitCapabilityPreview(viewport.clientWidth, viewport.clientHeight, content.offsetWidth, content.offsetHeight))
        const observer = new ResizeObserver(update)
        observer.observe(viewport)
        observer.observe(content)
        update()
        return () => observer.disconnect()
    }, [id])

    return (
        <div className="cmap-preview-frame" ref={frame} aria-hidden="true" inert>
            <div className={`cmap-preview-source${id === 'storefronts' ? ' cmap-preview-source--storefront' : ''}`} ref={source} style={{ transform: `translate(-50%, -50%) scale(${scale})` }}>
                <CapabilityMock id={id} />
            </div>
        </div>
    )
}

function CapabilityContent({ cap, fitted = false, scrollable = false }: {
    cap: Capability
    onNavigate: (id: CapabilityId) => void
    fitted?: boolean
    scrollable?: boolean
}) {
    const { t } = useCopy()
    return (
        <div className="cmap-panel-body" tabIndex={scrollable ? 0 : undefined} role={scrollable ? 'region' : undefined} aria-label={scrollable ? t("{label} details", { label: t(cap.label) }) : undefined}>
            <CapabilityInfo cap={cap} />
            <div className="cmap-panel-visual" style={{ '--cmap-accent': cap.accentColor } as CmapVars}>
                {fitted ? <FittedCapabilityPreview id={cap.id} /> : <CapabilityMock id={cap.id} />}
            </div>
        </div>
    )
}

function PanelHeader({ cap, artwork = true }: { cap: Capability; artwork?: boolean }) {
    return (
        <div className="cmap-panel-header" style={{ '--cmap-accent': cap.accentColor } as CmapVars}>
            <span className="cmap-panel-icon" aria-hidden="true" style={{ color: cap.accentColor }}>
                {artwork && <CapabilityArtwork module={cap.id} />}
            </span>
            <div className="cmap-panel-header-meta">
                <span className="cmap-panel-module-name"><Copy text={cap.label} /></span>
                <span className="cmap-panel-tagline-text"><Copy text={cap.tagline} /></span>
            </div>
            <span className={`cmap-panel-badge cmap-panel-badge-${cap.badge.toLowerCase()}`}>
                <Copy text={cap.badge} />
            </span>
        </div>
    )
}

function AccordionItem({
    cap,
    isOpen,
    onToggle,
    onNavigate,
    isReduced,
}: {
    cap: Capability
    isOpen: boolean
    onToggle: () => void
    onNavigate: (id: CapabilityId) => void
    isReduced: boolean
}) {
    const itemRef = useRef<HTMLDivElement>(null)
    // 'storefronts' is open on first render, so without this guard the effect
    // scrolls the page down to this section on every load/refresh. Only scroll
    // when the user actually opens an item.
    const hasMounted = useRef(false)

    useEffect(() => {
        if (!hasMounted.current) {
            hasMounted.current = true
            return
        }
        if (!isOpen) return
        const item = itemRef.current
        if (!item) return

        /* Both layouts stay mounted at every width — CSS hides one. Above
           960px the accordion is display:none while the side-by-side panel is
           shown, so selecting a capability there was still firing this effect
           and scrolling the page to an invisible element.

           getClientRects() is empty for anything in a display:none subtree, so
           this tracks the CSS without duplicating its breakpoint. */
        if (item.getClientRects().length === 0) return

        return revealAccordionItem(item, isReduced)
    }, [isOpen, isReduced])

    return (
        <div
            ref={itemRef}
            className={`cmap-accordion-item${isOpen ? ' is-open' : ''}`}
        >
            <Button
                unstyled
                type="button"
                className="cmap-accordion-trigger"
                onClick={onToggle}
                aria-expanded={isOpen}
                style={isOpen ? { '--cmap-accent': cap.accentColor } as CmapVars : undefined}
            >
                <span className="cmap-acc-icon" style={{ color: cap.accentColor }} aria-hidden="true">
                    <CapabilityArtwork module={cap.id} />
                </span>
                <span className="cmap-acc-info">
                    <span className="cmap-acc-label"><Copy text={cap.label} /></span>
                    <span className="cmap-acc-tagline"><Copy text={cap.tagline} /></span>
                </span>
                <span className={`cmap-acc-badge cmap-acc-badge-${cap.badge.toLowerCase()}`} aria-hidden="true">
                    <Copy text={cap.badge} />
                </span>
                <motion.span
                    className="cmap-acc-chevron"
                    aria-hidden="true"
                    animate={isReduced ? {} : { rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <ChevronDown width={16} height={16} />
                </motion.span>
            </Button>
            <AnimatePresence initial={false}>
                {isOpen && (
                    <motion.div
                        initial={isReduced ? { opacity: 1, height: 'auto' } : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={isReduced ? { opacity: 1, height: 'auto' } : { opacity: 0, height: 0 }}
                        transition={
                            isReduced
                                ? { duration: 0 }
                                : { duration: 0.26, ease: [0.16, 1, 0.3, 1] as const }
                        }
                        style={{ overflow: 'hidden' }}
                    >
                        <div className="cmap-accordion-body">
                            <CapabilityContent cap={cap} onNavigate={onNavigate} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

// ── Commerce OS Graph visualization ───────────────────────────────────────────

function CommerceOSGraph({
    activeId,
    onSelect,
}: {
    activeId: CapabilityId
    onSelect: (id: CapabilityId) => void
}) {
    const { t } = useCopy()
    const reduced = useReducedMotion()
    const CX = 340, CY = 285
    const R = 175
    const NODE_R = 36

    const ANGLES: Record<CapabilityId, number> = {
        storefronts: -90,
        orders:      -45,
        payments:     0,
        analytics:   45,
        inventory:   90,
        customers:   135,
        ai:          180,
        b2b:        -135,
    }

    const SHORT: Record<CapabilityId, string> = {
        storefronts: 'Storefront',
        orders:      'Orders',
        payments:    'Payments',
        analytics:   'Analytics',
        inventory:   'Inventory',
        customers:   'Customers',
        ai:          'AI',
        b2b:         'B2B',
    }

    function npos(id: CapabilityId): [number, number] {
        const a = (ANGLES[id] * Math.PI) / 180
        return [CX + R * Math.cos(a), CY + R * Math.sin(a)]
    }

    function lpos(id: CapabilityId): [number, number] {
        const a = (ANGLES[id] * Math.PI) / 180
        const d = NODE_R + 20
        return [CX + (R + d) * Math.cos(a), CY + (R + d) * Math.sin(a)]
    }

    function anchor(id: CapabilityId): 'start' | 'middle' | 'end' {
        const c = Math.cos((ANGLES[id] * Math.PI) / 180)
        if (c > 0.35) return 'start'
        if (c < -0.35) return 'end'
        return 'middle'
    }

    function domBaseline(id: CapabilityId): 'auto' | 'central' | 'hanging' {
        const s = Math.sin((ANGLES[id] * Math.PI) / 180)
        if (s < -0.35) return 'auto'
        if (s > 0.35) return 'hanging'
        return 'central'
    }

    const activeCap = CAPABILITIES.find(c => c.id === activeId)!
    const connSet = new Set(activeCap.connections)

    return (
        <div className="cmap-graph-wrap">
            <svg viewBox="40 20 610 530" className="cmap-graph-svg" role="group" aria-label={t("Commerce OS module map")}>
                <defs>
                    <radialGradient id="cmap-hub-grad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="var(--lb-color-surface-raised)" />
                        <stop offset="100%" stopColor="var(--lb-color-surface-subdued)" />
                    </radialGradient>
                    <filter id="cmap-ball-glow" x="-80%" y="-80%" width="260%" height="260%">
                        <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="blur" />
                        <feMerge>
                            <feMergeNode in="blur" />
                            <feMergeNode in="SourceGraphic" />
                        </feMerge>
                    </filter>
                </defs>

                {/* Orbit ring */}
                <circle cx={CX} cy={CY} r={R}
                    fill="none" stroke="color-mix(in srgb, var(--lb-color-surface-subdued) 45%, transparent)"
                    strokeWidth="1" strokeDasharray="2 9"
                />

                {/* Connection lines + animated moving ball on active line only */}
                {CAPABILITIES.map(cap => {
                    const [nx, ny] = npos(cap.id)
                    const isActive = cap.id === activeId
                    const isConn = !isActive && connSet.has(cap.id)
                    const pathD = `M ${CX},${CY} L ${nx},${ny}`

                    return (
                        <g key={`line-${cap.id}`}>
                            <path
                                d={pathD}
                                stroke={cap.accentColor}
                                strokeWidth={isActive ? 2.5 : 1}
                                strokeDasharray={isActive ? '9 5' : '5 7'}
                                opacity={isActive ? 0.9 : isConn ? 0.28 : 0.1}
                                fill="none"
                                strokeLinecap="round"
                            />
                            {isActive && !reduced && (
                                <circle r="4.5" fill={cap.accentColor} opacity="0.9" filter="url(#cmap-ball-glow)">
                                    <animateMotion path={pathD} dur="2s" repeatCount="indefinite" />
                                </circle>
                            )}
                        </g>
                    )
                })}

                {/* Center hub */}
                <circle cx={CX} cy={CY} r={68}
                    fill="none" stroke="color-mix(in srgb, var(--lb-primitive-color-purple-500) 16%, transparent)" strokeWidth="1"
                />
                <circle cx={CX} cy={CY} r={57}
                    fill="url(#cmap-hub-grad)" stroke="var(--lb-primitive-color-purple-500)" strokeWidth="1.5"
                />
                <text x={CX} y={CY - 7} textAnchor="middle"
                    fill="var(--lb-color-text)" fontSize="10" fontWeight="700" letterSpacing="0.13em">
                    COMMERCE
                </text>
                <text x={CX} y={CY + 9} textAnchor="middle"
                    fill="var(--lb-color-text)" fontSize="10" fontWeight="700" letterSpacing="0.13em">
                    OS
                </text>

                {/* Clickable nodes */}
                {CAPABILITIES.map(cap => {
                    const [nx, ny] = npos(cap.id)
                    const [lx, ly] = lpos(cap.id)
                    const isActive = cap.id === activeId
                    const isConn = !isActive && connSet.has(cap.id)
                    const op = isActive ? 1 : isConn ? 0.85 : 0.7

                    return (
                        <g
                            key={`node-${cap.id}`}
                            className={`cmap-graph-node-g${isActive ? ' is-active' : ''}`}
                            style={{ opacity: op, cursor: 'pointer' }}
                            onClick={() => onSelect(cap.id)}
                            onKeyDown={e => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault()
                                    onSelect(cap.id)
                                }
                            }}
                            tabIndex={0}
                            role="button"
                            aria-pressed={isActive}
                            aria-label={t(cap.label)}
                        >
                            <circle cx={nx} cy={ny} r={42} fill="transparent" />
                            {isActive && (
                                <circle cx={nx} cy={ny} r={44}
                                    fill={`color-mix(in srgb, ${cap.accentColor} 10%, transparent)`}
                                    stroke={cap.accentColor}
                                    strokeWidth="1" opacity="0.35"
                                />
                            )}
                            <circle className="cmap-node-disc" cx={nx} cy={ny} r={NODE_R}
                                fill={`color-mix(in srgb, ${cap.accentColor} ${isActive ? 17 : 9}%, var(--lb-color-surface-subdued))`}
                                stroke={cap.accentColor}
                                strokeWidth={isActive ? 2 : 1.2}
                            />
                            <foreignObject x={nx - 30} y={ny - 30} width="60" height="60" pointerEvents="none">
                                <div className="cmap-node-artwork" aria-hidden="true" style={{ color: cap.accentColor }}>
                                    <CapabilityArtwork module={cap.id} />
                                </div>
                            </foreignObject>
                            <text
                                x={lx} y={ly}
                                textAnchor={anchor(cap.id)}
                                dominantBaseline={domBaseline(cap.id)}
                                fill={isActive ? cap.accentColor : 'var(--text-secondary)'}
                                fontSize="16"
                                fontWeight={isActive ? '600' : '500'}
                                opacity={isActive ? 1 : isConn ? 0.95 : 0.85}
                            >
                                <Copy text={SHORT[cap.id]} />
                            </text>
                        </g>
                    )
                })}
            </svg>
        </div>
    )
}

const SLIDE_VARIANTS = {
    enter: (step: number) => ({ opacity: 0, x: step > 0 ? '100%' : '-100%' }),
    center: { opacity: 1, x: 0 },
    exit: (step: number) => ({ opacity: 0, x: step > 0 ? '-100%' : '100%' }),
}

// Exiting previews are inert while the next card slides in, so duplicate controls cannot take focus.
const CapabilitySlide = forwardRef<HTMLDivElement, {
    cap: Capability
    direction: -1 | 1
    reduced: boolean
    onNavigate: (id: CapabilityId) => void
}>(function CapabilitySlide({ cap, direction, reduced, onNavigate }, ref) {
    const present = useIsPresent()
    return (
        <motion.div
            ref={ref}
            className="cmap-panel"
            custom={direction}
            variants={SLIDE_VARIANTS}
            initial={reduced ? false : 'enter'}
            animate="center"
            exit={reduced ? undefined : 'exit'}
            transition={{ duration: reduced ? 0 : 0.24, ease: [0.16, 1, 0.3, 1] }}
            inert={!present}
            aria-hidden={!present}
        >
            <PanelHeader cap={cap} />
            <CapabilityContent cap={cap} onNavigate={onNavigate} fitted />
        </motion.div>
    )
})

// ── Main component ─────────────────────────────────────────────────────────────

export default function CapabilityMap() {
    const { t } = useCopy()
    const [activeId, setActiveId] = useState<CapabilityId>('storefronts')
    const [playing, setPlaying] = useState(true)
    const [direction, setDirection] = useState<-1 | 1>(1)
    const touchRef = useRef({ down: false, pausedUntil: 0 })
    const nextAdvanceAt = useRef(0)
    const swipeRef = useRef<{ id: number; x: number; y: number; vertical: boolean } | null>(null)
    const suppressClickUntil = useRef(0)
    const bodyRef = useRef<HTMLDivElement>(null)
    const inView = useInView(bodyRef, { amount: 0.25 })
    const isReduced = useReducedMotion()
    const active = CAPABILITIES.find(c => c.id === activeId)!

    function pauseForReading() {
        const until = performance.now() + TOUR_READING_PAUSE_MS
        touchRef.current.pausedUntil = until
        nextAdvanceAt.current = until
    }

    function selectCapability(id: CapabilityId) {
        pauseForReading()
        setDirection(1)
        setActiveId(id)
    }

    function moveCard(step: -1 | 1) {
        pauseForReading()
        setDirection(step)
        setActiveId(step === 1 ? nextCapability : previousCapability)
    }

    function beginSwipe(event: PointerEvent<HTMLDivElement>) {
        if (!event.isPrimary || event.button !== 0) return
        const target = event.target as Element
        if (target.closest('button, a, input, textarea, select, [role="button"], [data-no-swipe]')) return
        swipeRef.current = { id: event.pointerId, x: event.clientX, y: event.clientY, vertical: false }
    }

    function trackSwipe(event: PointerEvent<HTMLDivElement>) {
        const start = swipeRef.current
        if (!start || start.id !== event.pointerId || start.vertical) return
        const dx = event.clientX - start.x
        const dy = event.clientY - start.y
        if (Math.abs(dy) > 8 && Math.abs(dy) > Math.abs(dx)) {
            start.vertical = true
        } else if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy) * 1.4) {
            event.currentTarget.setPointerCapture(event.pointerId)
        }
    }

    function finishSwipe(event: PointerEvent<HTMLDivElement>) {
        const start = swipeRef.current
        swipeRef.current = null
        if (!start || start.id !== event.pointerId || start.vertical) return
        const step = capabilitySwipeDirection(event.clientX - start.x, event.clientY - start.y, event.currentTarget.clientWidth)
        if (step) {
            suppressClickUntil.current = performance.now() + 400
            moveCard(step)
        }
    }

    function carouselKeys(event: KeyboardEvent<HTMLDivElement>) {
        const target = event.target as Element
        if (target.closest('button, a, input, textarea, select, [role="button"]')) return
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
        event.preventDefault()
        // Keep keyboard focus on the stable carousel when its current panel unmounts.
        event.currentTarget.focus({ preventScroll: true })
        moveCard(event.key === 'ArrowRight' ? 1 : -1)
    }

    useEffect(() => {
        // Release even when the finger/mouse finishes outside the card or a native scroll cancels it.
        const release = (event: globalThis.PointerEvent) => {
            if (!event.isPrimary || !touchRef.current.down) return
            touchRef.current.down = false
            const until = performance.now() + TOUR_READING_PAUSE_MS
            touchRef.current.pausedUntil = until
            nextAdvanceAt.current = until
        }
        window.addEventListener('pointerup', release)
        window.addEventListener('pointercancel', release)
        return () => {
            window.removeEventListener('pointerup', release)
            window.removeEventListener('pointercancel', release)
        }
    }, [])

    useEffect(() => {
        if (!playing || isReduced || !inView) return
        nextAdvanceAt.current = performance.now() + TOUR_STEP_MS
        const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)')
        const timer = window.setInterval(() => {
            const now = performance.now()
            const body = bodyRef.current
            if (!body || document.hidden || (finePointer.matches && body.matches(':hover')) || body.querySelector(':focus-visible')) {
                nextAdvanceAt.current = now + TOUR_STEP_MS
                return
            }
            const touch = touchRef.current
            if (!capabilityTourIsDue(now, nextAdvanceAt.current, touch.down, touch.pausedUntil)) return
            setDirection(1)
            setActiveId(nextCapability)
            nextAdvanceAt.current = now + TOUR_STEP_MS
        }, 150)
        return () => window.clearInterval(timer)
    }, [playing, isReduced, inView])


    return (
        <section className="cmap cmap-viewport" id="capabilities">

            {/* ── TOP-CENTER: section header ── */}
            <div className="container">
                <motion.div
                    className="cmap-section-header"
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    <p className="section-label"><Copy text={"Commerce OS Capability Map"} /></p>
                    <h2 className="cmap-headline">
                        <Copy text={"Everything your business needs."} />{' '}
                        <span className="cmap-headline-accent"><Copy text={"One operating system."} /></span>
                    </h2>
                    <p className="cmap-lead">
                        <Copy text={"Run storefronts, orders, inventory, payments, analytics, AI, B2B and operations from one unified platform."} /></p>
                </motion.div>
            </div>

            {/* Desktop: illustrated graph beside the synchronized preview. */}
            <div
                className="container cmap-body"
                ref={bodyRef}
                onPointerDownCapture={event => { if (event.isPrimary && event.button === 0) touchRef.current.down = true }}
            >

                <aside className="cmap-left">
                    <div className="cmap-graph-container">
                        <CommerceOSGraph activeId={activeId} onSelect={selectCapability} />
                        {!isReduced && (
                            <Button unstyled type="button" className="cmap-motion-control" onClick={() => setPlaying(value => !value)}>
                                <Copy text={playing ? "Pause automatic module tour" : "Continue automatic module tour"} />
                            </Button>
                        )}
                    </div>
                </aside>

                <div className="cmap-right">

                    {/* Desktop: animated capability panel */}
                    <div
                        className="cmap-desktop-panel cmap-carousel"
                        role="region"
                        aria-roledescription="carousel"
                        aria-label={t("Commerce capability cards")}
                        aria-describedby="cmap-carousel-help"
                        aria-live={playing ? 'off' : 'polite'}
                        aria-atomic="true"
                        tabIndex={0}
                        onPointerDown={beginSwipe}
                        onPointerMove={trackSwipe}
                        onPointerUp={finishSwipe}
                        onPointerCancel={() => { swipeRef.current = null }}
                        onKeyDown={carouselKeys}
                        onClickCapture={event => {
                            if (performance.now() < suppressClickUntil.current) {
                                event.preventDefault()
                                event.stopPropagation()
                            }
                        }}
                    >
                        <span id="cmap-carousel-help" className="cmap-carousel-help"><Copy text={"Swipe left or right, use the arrow keys, or choose a module in the map. Touch pauses automatic switching."} /></span>
                        <div className="cmap-card-probes" aria-hidden="true" inert>
                            {CAPABILITIES.map(cap => (
                                <div key={cap.id} className="cmap-size-probe">
                                    <PanelHeader cap={cap} artwork={false} />
                                    <CapabilityInfo cap={cap} artwork={false} />
                                </div>
                            ))}
                            <div className="cmap-preview-spacer" />
                        </div>
                        <AnimatePresence initial={false} custom={direction} mode="popLayout">
                            <CapabilitySlide key={activeId} cap={active} direction={direction} reduced={!!isReduced} onNavigate={selectCapability} />
                        </AnimatePresence>
                    </div>

                    {/* Mobile: accordion — one open at a time */}
                    <div className="cmap-mobile-accordion">
                        {CAPABILITIES.map(cap => (
                            <AccordionItem
                                key={cap.id}
                                cap={cap}
                                isOpen={cap.id === activeId}
                                onToggle={() => selectCapability(cap.id)}
                                onNavigate={selectCapability}
                                isReduced={!!isReduced}
                            />
                        ))}
                    </div>

                </div>

            </div>
        </section>
    )
}
