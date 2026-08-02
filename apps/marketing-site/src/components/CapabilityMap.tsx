'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import {
    BarChart3,
    ChevronDown,
    CreditCard,
    MaterialIcon,
    Package,
    ShoppingBag,
    Store,
    Truck,
    Users,
    type LucideIcon,
} from '@letbuyy/ui'
import { revealAccordionItem } from '@/lib/reveal-accordion-item'

type CapabilityId = 'storefronts' | 'orders' | 'inventory' | 'payments' | 'customers' | 'analytics' | 'ai' | 'b2b'

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
        accentColor: 'rgb(20 184 166)',
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
        accentColor: 'rgb(59 130 246)',
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
        accentColor: 'rgb(245 158 11)',
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
        accentColor: 'rgb(16 185 129)',
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
        accentColor: 'rgb(236 72 153)',
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
        accentColor: 'rgb(139 92 246)',
    },
    {
        id: 'ai',
        label: 'AI Copilot',
        tagline: 'Commerce intelligence, automated',
        description: 'Get AI-powered insights across every module. Restock signals, pricing nudges, product copy — the copilot connects to your live data, not generic templates.',
        features: ['Cross-module insights', 'Product copy generation', 'Demand prediction'],
        connections: ['storefronts', 'inventory', 'customers', 'analytics'],
        badge: 'Beta',
        materialName: 'assistant',
        accentColor: 'rgb(167 139 250)',
    },
    {
        id: 'b2b',
        label: 'B2B Commerce',
        tagline: 'Wholesale, bulk, enterprise',
        description: 'Run wholesale workflows with tiered pricing, bulk orders, custom invoices, and dedicated B2B account management — on the same platform as your D2C.',
        features: ['Tiered pricing & bulk orders', 'Custom B2B invoices', 'Account management'],
        connections: ['inventory', 'payments', 'customers'],
        badge: 'Enterprise',
        icon: Truck,
        accentColor: 'rgb(6 182 212)',
    },
]

// ── Visual mocks ───────────────────────────────────────────────────────────────

function StorefrontsMock() {
    const products = [
        { name: 'Air Classic',    price: '₹2,999' },
        { name: 'Street Hoodie',  price: '₹1,799' },
        { name: 'Sport Tee',      price: '₹699'   },
        { name: 'Running Cap',    price: '₹449'   },
        { name: 'Crew Socks',     price: '₹249'   },
        { name: 'Slim Jogger',    price: '₹1,299' },
    ]
    return (
        <div className="cmap-mock cmap-mock-storefronts" aria-hidden="true">
            <div className="cmap-sf-browser">
                {/* Browser chrome */}
                <div className="cmap-sf-bar">
                    <div className="cmap-mock-dot" style={{ background: 'rgb(255 95 87)' }} />
                    <div className="cmap-mock-dot" style={{ background: 'rgb(255 189 46)' }} />
                    <div className="cmap-mock-dot" style={{ background: 'rgb(40 201 64)' }} />
                    <span className="cmap-sf-url">urban-kicks.letbuyy.com</span>
                    <span className="cmap-sf-live">Live</span>
                </div>

                {/* Storefront content */}
                <div className="cmap-sf-content">
                    {/* Navbar */}
                    <nav className="cmap-sf-nav">
                        <div className="cmap-sf-nav-brand">
                            <span className="cmap-sf-nav-logo" />
                            <span className="cmap-sf-nav-name">Urban Kicks</span>
                        </div>
                        <div className="cmap-sf-nav-links">
                            <span>Shop</span>
                            <span>Collections</span>
                            <span>Sale</span>
                        </div>
                        <div className="cmap-sf-nav-actions">
                            <svg className="cmap-sf-nav-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                                <line x1="3" y1="6" x2="21" y2="6"/>
                                <path d="M16 10a4 4 0 0 1-8 0"/>
                            </svg>
                            <svg className="cmap-sf-nav-icon cmap-sf-nav-hamburger" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="3" y1="6" x2="21" y2="6"/>
                                <line x1="3" y1="12" x2="21" y2="12"/>
                                <line x1="3" y1="18" x2="21" y2="18"/>
                            </svg>
                        </div>
                    </nav>

                    {/* Hero */}
                    <div className="cmap-sf-hero">
                        <div className="cmap-sf-hero-content">
                            <span className="cmap-sf-hero-tag">New Drop</span>
                            <h3 className="cmap-sf-hero-title">Step Into<br />Your Style</h3>
                            <p className="cmap-sf-hero-sub">Latest sneakers &amp; streetwear, all sizes</p>
                            <button className="cmap-sf-hero-cta" type="button">
                                Shop Now
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M5 12h14M12 5l7 7-7 7"/>
                                </svg>
                            </button>
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
                        {products.map(p => (
                            <div key={p.name} className="cmap-sf-product-card">
                                <div className="cmap-sf-product-img" />
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
                    0ms edge latency
                </span>
                <span className="cmap-mock-perf-divider" />
                <span className="cmap-mock-perf-item">Custom domain connected</span>
                <span className="cmap-mock-perf-divider" />
                <span className="cmap-mock-perf-item">SSL active</span>
            </div>
        </div>
    )
}

function OrdersMock() {
    const orders = [
        { id: '#4821', product: 'Air Classic',   qty: 1, amount: '₹2,840', status: 'Delivered',  badge: 'success', img: 0 },
        { id: '#4820', product: 'Street Hoodie', qty: 2, amount: '₹3,598', status: 'Shipped',    badge: 'info',    img: 1 },
        { id: '#4819', product: 'Sport Tee',     qty: 3, amount: '₹5,499', status: 'Confirmed',  badge: 'primary', img: 2 },
        { id: '#4818', product: 'Running Cap',   qty: 1, amount: '₹890',   status: 'Placed',     badge: 'muted',   img: 3 },
        { id: '#4817', product: 'Slim Jogger',   qty: 1, amount: '₹1,299', status: 'Processing', badge: 'warning', img: 4 },
    ]
    return (
        <div className="cmap-mock cmap-mock-orders" aria-hidden="true">
            <div className="cmap-order-header">
                <span className="cmap-order-title">Orders</span>
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
                    <div className={`cmap-order-thumb cmap-order-thumb-${o.img}`} />
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
                <span className="cmap-inv-title">Inventory</span>
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
                    <div className={`cmap-inv-thumb cmap-inv-thumb-${item.img}`} />
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
                        <button type="button" className="cmap-inv-btn" aria-label="Decrease stock">−</button>
                        <button type="button" className="cmap-inv-btn" aria-label="Increase stock">+</button>
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
                        <span>{m.label}</span>
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
                <span className="cmap-cust-title">Customers</span>
                <span className="cmap-cust-count">142 total</span>
            </div>
            <div className="cmap-cust-thead">
                <span />
                <span>Customer</span>
                <span>Orders</span>
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
                <MaterialIcon name="assistant" size={15} />
                <span>AI Copilot</span>
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
                    <span className="cmap-b2b-order-id">#B-0024</span>
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
                    <div className={`cmap-b2b-thumb cmap-b2b-thumb-${item.img}`} />
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
        case 'storefronts': return <StorefrontsMock />
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
    return (
        <div className="cmap-connected">
            <span className="cmap-connected-label">Connected modules</span>
            <div className="cmap-connected-chips">
                {connections.map(id => {
                    const cap = CAPABILITIES.find(c => c.id === id)!
                    const Icon = cap.icon
                    return (
                        <button
                            key={id}
                            type="button"
                            className="cmap-connected-chip"
                            style={{ '--cmap-accent': cap.accentColor } as CmapVars}
                            onClick={() => onNavigate(id)}
                            aria-label={`Explore ${cap.label}`}
                        >
                            <span style={{ color: cap.accentColor }} aria-hidden="true">
                                {cap.materialName
                                    ? <MaterialIcon name={cap.materialName} size={12} />
                                    : Icon ? <Icon width={12} height={12} strokeWidth={2} /> : null
                                }
                            </span>
                            {cap.label}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}

function CapabilityContent({
    cap,
    onNavigate,
}: {
    cap: Capability
    onNavigate: (id: CapabilityId) => void
}) {
    return (
        <div className="cmap-panel-body">
            <div className="cmap-panel-info">
                <p className="cmap-panel-desc">{cap.description}</p>
                <ul className="cmap-panel-features" aria-label={`${cap.label} features`}>
                    {cap.features.map(f => <li key={f}>{f}</li>)}
                </ul>
            </div>
            <div
                className="cmap-panel-visual"
                style={{ '--cmap-accent': cap.accentColor } as CmapVars}
                aria-label={`${cap.label} dashboard preview`}
            >
                <CapabilityMock id={cap.id} />
            </div>
        </div>
    )
}

function PanelHeader({ cap }: { cap: Capability }) {
    const Icon = cap.icon
    return (
        <div className="cmap-panel-header" style={{ '--cmap-accent': cap.accentColor } as CmapVars}>
            <span className="cmap-panel-icon" aria-hidden="true" style={{ color: cap.accentColor }}>
                {cap.materialName
                    ? <MaterialIcon name={cap.materialName} size={20} />
                    : Icon ? <Icon width={20} height={20} strokeWidth={1.5} /> : null
                }
            </span>
            <div className="cmap-panel-header-meta">
                <span className="cmap-panel-module-name">{cap.label}</span>
                <span className="cmap-panel-tagline-text">{cap.tagline}</span>
            </div>
            <span className={`cmap-panel-badge cmap-panel-badge-${cap.badge.toLowerCase()}`}>
                {cap.badge}
            </span>
        </div>
    )
}

function NavItem({
    cap,
    isActive,
    onClick,
}: {
    cap: Capability
    isActive: boolean
    onClick: (id: CapabilityId) => void
}) {
    const Icon = cap.icon
    return (
        <button
            type="button"
            className={`cmap-nav-item${isActive ? ' is-active' : ''}`}
            style={isActive ? { '--cmap-accent': cap.accentColor } as CmapVars : undefined}
            onClick={() => onClick(cap.id)}
            aria-pressed={isActive}
        >
            <span className="cmap-nav-icon" style={{ color: cap.accentColor }} aria-hidden="true">
                {cap.materialName
                    ? <MaterialIcon name={cap.materialName} size={16} />
                    : Icon ? <Icon width={16} height={16} strokeWidth={1.8} /> : null
                }
            </span>
            <span className="cmap-nav-text">
                <span className="cmap-nav-label">{cap.label}</span>
                <span className="cmap-nav-tagline">{cap.tagline}</span>
            </span>
            <span className={`cmap-nav-badge cmap-nav-badge-${cap.badge.toLowerCase()}`} aria-hidden="true">
                {cap.badge}
            </span>
        </button>
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
    const Icon = cap.icon
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
        return revealAccordionItem(item, isReduced)
    }, [isOpen, isReduced])

    return (
        <div
            ref={itemRef}
            className={`cmap-accordion-item${isOpen ? ' is-open' : ''}`}
        >
            <button
                type="button"
                className="cmap-accordion-trigger"
                onClick={onToggle}
                aria-expanded={isOpen}
                style={isOpen ? { '--cmap-accent': cap.accentColor } as CmapVars : undefined}
            >
                <span className="cmap-acc-icon" style={{ color: cap.accentColor }} aria-hidden="true">
                    {cap.materialName
                        ? <MaterialIcon name={cap.materialName} size={16} />
                        : Icon ? <Icon width={16} height={16} strokeWidth={1.8} /> : null
                    }
                </span>
                <span className="cmap-acc-info">
                    <span className="cmap-acc-label">{cap.label}</span>
                    <span className="cmap-acc-tagline">{cap.tagline}</span>
                </span>
                <span className={`cmap-acc-badge cmap-acc-badge-${cap.badge.toLowerCase()}`} aria-hidden="true">
                    {cap.badge}
                </span>
                <motion.span
                    className="cmap-acc-chevron"
                    aria-hidden="true"
                    animate={isReduced ? {} : { rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.2 }}
                >
                    <ChevronDown width={16} height={16} />
                </motion.span>
            </button>
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
    const reduced = useReducedMotion()
    const W = 680, H = 570
    const CX = 340, CY = 285
    const R = 175
    const NODE_R = 30

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
            <svg viewBox={`0 0 ${W} ${H}`} className="cmap-graph-svg" aria-hidden="true">
                <defs>
                    <radialGradient id="cmap-hub-grad" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="rgb(40 32 60)" />
                        <stop offset="100%" stopColor="rgb(12 10 20)" />
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
                    fill="none" stroke="rgba(55,49,72,0.45)"
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
                    fill="none" stroke="rgba(139,92,246,0.16)" strokeWidth="1"
                />
                <circle cx={CX} cy={CY} r={57}
                    fill="url(#cmap-hub-grad)" stroke="rgb(139 92 246)" strokeWidth="1.5"
                />
                <text x={CX} y={CY - 7} textAnchor="middle"
                    fill="rgb(228 224 242)" fontSize="10" fontWeight="700" letterSpacing="0.13em">
                    COMMERCE
                </text>
                <text x={CX} y={CY + 9} textAnchor="middle"
                    fill="rgb(228 224 242)" fontSize="10" fontWeight="700" letterSpacing="0.13em">
                    OS
                </text>

                {/* Clickable nodes */}
                {CAPABILITIES.map(cap => {
                    const [nx, ny] = npos(cap.id)
                    const [lx, ly] = lpos(cap.id)
                    const isActive = cap.id === activeId
                    const isConn = !isActive && connSet.has(cap.id)
                    const op = isActive ? 1 : isConn ? 0.65 : 0.3
                    const Icon = cap.icon

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
                            aria-label={cap.label}
                        >
                            {isActive && (
                                <circle cx={nx} cy={ny} r={44}
                                    fill={`color-mix(in srgb, ${cap.accentColor} 10%, transparent)`}
                                    stroke={cap.accentColor}
                                    strokeWidth="1" opacity="0.35"
                                />
                            )}
                            <circle cx={nx} cy={ny} r={NODE_R}
                                fill={`color-mix(in srgb, ${cap.accentColor} ${isActive ? 17 : 9}%, rgb(12 10 20))`}
                                stroke={cap.accentColor}
                                strokeWidth={isActive ? 2 : 1.2}
                            />
                            <foreignObject x={nx - 9} y={ny - 9} width="18" height="18">
                                <div style={{
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    width: '18px', height: '18px', color: cap.accentColor,
                                }}>
                                    {cap.materialName
                                        ? <MaterialIcon name={cap.materialName} size={13} />
                                        : Icon
                                            ? <Icon width={13} height={13} strokeWidth={1.8} />
                                            : null
                                    }
                                </div>
                            </foreignObject>
                            <text
                                x={lx} y={ly}
                                textAnchor={anchor(cap.id)}
                                dominantBaseline={domBaseline(cap.id)}
                                fill={isActive ? cap.accentColor : 'rgb(118 110 138)'}
                                fontSize="11.5"
                                fontWeight={isActive ? '600' : '500'}
                                opacity={isActive ? 1 : isConn ? 0.7 : 0.5}
                            >
                                {SHORT[cap.id]}
                            </text>
                        </g>
                    )
                })}
            </svg>
        </div>
    )
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function CapabilityMap() {
    const [activeId, setActiveId] = useState<CapabilityId>('storefronts')
    const isReduced = useReducedMotion()
    const active = CAPABILITIES.find(c => c.id === activeId)!

    const panelAnim = isReduced
        ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 }, transition: { duration: 0 } }
        : {
            initial: { opacity: 0, y: 8 },
            animate: { opacity: 1, y: 0 },
            exit:    { opacity: 0, y: 8 },
            transition: { duration: 0.18, ease: [0.16, 1, 0.3, 1] as const },
          }

    return (
        <section className="cmap" id="capabilities">

            {/* ── TOP-CENTER: section header ── */}
            <div className="container">
                <motion.div
                    className="cmap-section-header"
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    <span className="cmap-kicker">COMMERCE OS CAPABILITY MAP</span>
                    <h2 className="cmap-headline">
                        Everything your business needs.{' '}
                        <span className="cmap-headline-accent">One operating system.</span>
                    </h2>
                    <p className="cmap-lead">
                        Run storefronts, orders, inventory, payments, analytics, AI, B2B and operations from one unified platform.
                    </p>
                </motion.div>
            </div>

            {/* ── GRAPH: hub-spoke visualization (desktop only) ── */}
            <div className="container cmap-graph-container">
                <CommerceOSGraph activeId={activeId} onSelect={setActiveId} />
            </div>

            {/* ── TWO-COLUMN: sticky nav left + panel right ── */}
            <div className="container cmap-body">

                <aside className="cmap-left">
                    <motion.nav
                        className="cmap-nav"
                        aria-label="Capability navigation"
                        initial={{ opacity: 0 }}
                        whileInView={{ opacity: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.5, delay: 0.15 }}
                    >
                        {CAPABILITIES.map(cap => (
                            <NavItem
                                key={cap.id}
                                cap={cap}
                                isActive={cap.id === activeId}
                                onClick={setActiveId}
                            />
                        ))}
                    </motion.nav>
                </aside>

                <div className="cmap-right">

                    {/* Desktop: animated capability panel */}
                    <div className="cmap-desktop-panel" aria-live="polite" aria-atomic="true">
                        <AnimatePresence mode="wait">
                            <motion.div key={activeId} className="cmap-panel" {...panelAnim}>
                                <PanelHeader cap={active} />
                                <CapabilityContent cap={active} onNavigate={setActiveId} />
                            </motion.div>
                        </AnimatePresence>
                    </div>

                    {/* Mobile: accordion — one open at a time */}
                    <div className="cmap-mobile-accordion">
                        {CAPABILITIES.map(cap => (
                            <AccordionItem
                                key={cap.id}
                                cap={cap}
                                isOpen={cap.id === activeId}
                                onToggle={() => setActiveId(cap.id)}
                                onNavigate={setActiveId}
                                isReduced={!!isReduced}
                            />
                        ))}
                    </div>

                </div>

            </div>
        </section>
    )
}
