'use client'

import Link from '@/components/i18n/LocaleLink'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Button } from '@letbuyy/ui'
import { getAccountsUrl, getMarketingSiteUrl } from '@/lib/public-urls'
import { revealAccordionItem } from '@/lib/reveal-accordion-item'

interface JourneyStep {
    id: string
    number: string
    title: string
    description: string
    metric: string
    modules: string
}

const STEPS: JourneyStep[] = [
    {
        id: 'launch',
        number: '01',
        title: 'Launch Store',
        description: 'Create your storefront, connect products, and publish.',
        metric: 'Store live in minutes',
        modules: 'Storefronts + Themes',
    },
    {
        id: 'first-order',
        number: '02',
        title: 'First Order',
        description: 'Receive your first order and start selling.',
        metric: 'Order ORD-0001 completed',
        modules: 'Orders + Payments',
    },
    {
        id: 'scale',
        number: '03',
        title: 'Scale Operations',
        description: 'Manage inventory, fulfillment, and daily workflows.',
        metric: '100+ orders per day',
        modules: 'Inventory + Orders',
    },
    {
        id: 'brand',
        number: '04',
        title: 'Build Brand',
        description: 'Grow retention, loyalty, and customer relationships.',
        metric: 'Returning customers increasing',
        modules: 'Customers + Analytics',
    },
    {
        id: 'enterprise',
        number: '05',
        title: 'Enterprise',
        description: 'Operate multiple channels, B2B, and AI-driven workflows.',
        metric: 'Multi-channel commerce',
        modules: 'B2B + AI + Analytics',
    },
]

function LaunchPreview() {
    const CHECKS = [
        { label: 'Domain & SSL',  val: 'urbankicks.in',    sub: 'Cloudflare SSL · Auto-renews Dec 2025' },
        { label: 'Theme',         val: 'Minimalist Dark',  sub: 'v2.1.0 · Liquid + React hybrid' },
        { label: 'Catalogue',     val: '12 products',      sub: '3 collections · 0 out of stock' },
        { label: 'Payments',      val: 'Razorpay + COD',   sub: 'UPI · Cards · NetBanking · Wallets' },
        { label: 'GST / Tax',     val: 'GSTIN verified',   sub: 'Auto-computed on all orders' },
    ]

    // Sparkline for today's revenue trend
    const SPARK = [28, 42, 35, 58, 72, 65, 88, 95, 78, 142]
    const W = 56, H = 18
    const min = Math.min(...SPARK), max = Math.max(...SPARK)
    const range = max - min || 1
    const pts = SPARK.map((v, i) => `${(i / (SPARK.length - 1)) * W},${H - ((v - min) / range) * H}`)
    const sparkPath = `M ${pts.join(' L ')}`

    return (
        <div className="mgj-mock lp-card" aria-hidden="true">

            {/* ── Store identity header ── */}
            <div className="lp-header">
                <div className="lp-avatar">UK</div>
                <div className="lp-identity">
                    <div className="lp-name-row">
                        <span className="lp-store-name">Urban Kicks</span>
                        <span className="lp-live-badge">
                            <span className="lp-live-dot" />
                            Live
                        </span>
                    </div>
                    <span className="lp-domain">urbankicks.in</span>
                </div>
                <div className="lp-health-ring">
                    <svg viewBox="0 0 40 40" fill="none">
                        <circle cx="20" cy="20" r="16" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
                        <circle cx="20" cy="20" r="16"
                            stroke="rgb(52 211 153)"
                            strokeWidth="3"
                            strokeDasharray={`${0.98 * 100.53} 100.53`}
                            strokeLinecap="round"
                            transform="rotate(-90 20 20)"
                        />
                    </svg>
                    <span className="lp-health-num">98</span>
                </div>
            </div>

            {/* ── Today's metrics ── */}
            <div className="lp-metrics">
                <div className="lp-metric">
                    <div className="lp-metric-top">
                        <span className="lp-metric-num">142</span>
                        <span className="lp-trend-up">↑12%</span>
                    </div>
                    <span className="lp-metric-label">Today's visitors</span>
                </div>
                <div className="lp-metric-sep" />
                <div className="lp-metric">
                    <div className="lp-metric-top">
                        <span className="lp-metric-num">8</span>
                        <span className="lp-trend-up">+3</span>
                    </div>
                    <span className="lp-metric-label">Orders today</span>
                </div>
                <div className="lp-metric-sep" />
                <div className="lp-metric">
                    <div className="lp-metric-top">
                        <span className="lp-metric-num">₹22.8k</span>
                        <svg className="lp-sparkline" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="lp-spark-grad" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor="rgba(139,92,246,0.3)" />
                                    <stop offset="100%" stopColor="rgb(139,92,246)" />
                                </linearGradient>
                            </defs>
                            <path d={sparkPath} stroke="url(#lp-spark-grad)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <span className="lp-metric-label">Revenue today</span>
                </div>
            </div>

            {/* ── Setup checklist ── */}
            <div className="lp-checks">
                {CHECKS.map(c => (
                    <div key={c.label} className="lp-check-row">
                        <svg className="lp-check-svg" viewBox="0 0 16 16" fill="none">
                            <circle cx="8" cy="8" r="7" fill="rgba(16,185,129,0.14)" />
                            <path d="M5 8.2l1.8 1.8 4-4" stroke="rgb(52 211 153)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        <div className="lp-check-body">
                            <span className="lp-check-label">{c.label}</span>
                            <span className="lp-check-sub">{c.sub}</span>
                        </div>
                        <span className="lp-check-val">{c.val}</span>
                    </div>
                ))}
            </div>

            {/* ── Live footer ── */}
            <div className="lp-footer">
                <span className="lp-footer-pulse" />
                <div className="lp-footer-info">
                    <span className="lp-footer-primary">2 active sessions · Store is Live</span>
                    <span className="lp-footer-secondary">Last order 4 min ago · ₹2,840</span>
                </div>
                <span className="lp-uptime-badge">99.9%</span>
            </div>

        </div>
    )
}

function FirstOrderPreview() {
    const STAGES = ['Placed', 'Confirmed', 'Shipped', 'Delivered']
    return (
        <div className="mgj-mock fo-card" aria-hidden="true">

            {/* ── Order identity header ── */}
            <div className="fo-header">
                <div className="fo-id-row">
                    <span className="fo-order-num">ORD-0001</span>
                    <span className="fo-paid-badge">
                        <svg viewBox="0 0 10 10" fill="none" className="fo-check-icon">
                            <circle cx="5" cy="5" r="4.5" fill="rgba(16,185,129,0.18)" />
                            <path d="M3 5.2l1.4 1.4 3-3" stroke="rgb(52 211 153)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                        Paid
                    </span>
                    <span className="fo-status-badge">Delivered</span>
                </div>
                <span className="fo-timestamp">Today, 4:32 PM · Razorpay UPI · INR</span>
            </div>

            {/* ── Fulfillment timeline ── */}
            <div className="fo-timeline">
                <div className="fo-tl-dots">
                    {STAGES.map((_, i) => (
                        <div key={i} className={`fo-tl-dot${i === STAGES.length - 1 ? ' fo-tl-dot-active' : ''}`} />
                    ))}
                </div>
                <div className="fo-tl-labels">
                    {STAGES.map(s => (
                        <span key={s} className="fo-tl-label">{s}</span>
                    ))}
                </div>
            </div>

            {/* ── Product row ── */}
            <div className="fo-product">
                <div className="fo-product-thumb">
                    <svg viewBox="0 0 28 28" fill="none">
                        <path d="M6 18l4-8 4 5 3-3 5 6" stroke="rgba(196,181,253,0.7)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                        <circle cx="9" cy="10" r="2" fill="rgba(196,181,253,0.4)" />
                    </svg>
                </div>
                <div className="fo-product-body">
                    <span className="fo-product-name">Classic Sneakers</span>
                    <span className="fo-product-meta">Size 9 · Black · SKU: UK-CLX-09B</span>
                </div>
                <div className="fo-product-right">
                    <span className="fo-product-qty">×1</span>
                    <span className="fo-product-price">₹2,840</span>
                </div>
            </div>

            {/* ── GST breakdown ── */}
            <div className="fo-breakdown">
                <div className="fo-br-row">
                    <span className="fo-br-label">Subtotal</span>
                    <span className="fo-br-val">₹2,584</span>
                </div>
                <div className="fo-br-row">
                    <span className="fo-br-label">CGST (9%)</span>
                    <span className="fo-br-val">₹128</span>
                </div>
                <div className="fo-br-row">
                    <span className="fo-br-label">SGST (9%)</span>
                    <span className="fo-br-val">₹128</span>
                </div>
                <div className="fo-br-row">
                    <span className="fo-br-label">Shipping</span>
                    <span className="fo-br-free">Free</span>
                </div>
                <div className="fo-br-total-row">
                    <span className="fo-br-total-label">Total</span>
                    <span className="fo-br-total-val">₹2,840</span>
                </div>
            </div>

            {/* ── Payment confirmation ── */}
            <div className="fo-payment">
                <span className="fo-method-pill">UPI</span>
                <span className="fo-payment-id">pay_NX7Kq2mRYPwBaL</span>
                <span className="fo-verified">
                    <svg viewBox="0 0 12 12" fill="none" className="fo-verified-icon">
                        <path d="M2.5 6l2.3 2.3 4.7-4.6" stroke="rgb(52 211 153)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    Verified
                </span>
            </div>

            {/* ── Customer + GST invoice footer ── */}
            <div className="fo-footer">
                <div className="fo-customer">
                    <div className="fo-cust-avatar">A</div>
                    <div className="fo-cust-info">
                        <span className="fo-cust-name">Arjun Mehta</span>
                        <span className="fo-cust-meta">Mumbai, MH · First-time buyer</span>
                    </div>
                    <span className="fo-first-badge">First</span>
                </div>
                <div className="fo-gst-row">
                    <svg className="fo-doc-icon" viewBox="0 0 14 16" fill="none">
                        <rect x="1" y="1" width="10" height="14" rx="1.5" stroke="rgba(139,92,246,0.55)" strokeWidth="1.2" />
                        <path d="M3.5 5.5h5M3.5 8h5M3.5 10.5h3" stroke="rgba(139,92,246,0.55)" strokeWidth="1.1" strokeLinecap="round" />
                    </svg>
                    <span className="fo-gst-label">GST Invoice INV-2024-0001</span>
                    <span className="fo-gst-ready">Ready</span>
                </div>
            </div>

        </div>
    )
}

function ScalePreview() {
    const SKUs: { name: string; sku: string; avail: number; reserved: number; cap: number; status: 'ok' | 'low' | 'out' }[] = [
        { name: 'Classic Sneakers', sku: 'UK-CLX-09B', avail: 142, reserved: 18, cap: 200, status: 'ok' },
        { name: 'Everyday Hoodie', sku: 'EH-GRY-M',   avail: 28,  reserved: 6,  cap: 200, status: 'low' },
        { name: 'Sport Tee',       sku: 'ST-BLK-L',   avail: 315, reserved: 24, cap: 315, status: 'ok' },
        { name: 'Running Cap',     sku: 'RC-NVY-OS',  avail: 61,  reserved: 9,  cap: 200, status: 'ok' },
    ]
    const STATUS_COLOR = { ok: 'rgb(52 211 153)', low: 'rgb(245 158 11)', out: 'rgb(239 68 68)' }

    return (
        <div className="mgj-mock sc-card" aria-hidden="true">

            {/* ── Header ── */}
            <div className="sc-header">
                <div className="sc-header-left">
                    <span className="sc-title">Operations Center</span>
                    <span className="sc-subtitle">4 SKUs · 1 warehouse location</span>
                </div>
                <div className="sc-header-right">
                    <div className="sc-stat">
                        <span className="sc-stat-num">47</span>
                        <span className="sc-stat-label">Today's orders</span>
                    </div>
                    <div className="sc-stat-sep" />
                    <div className="sc-stat">
                        <span className="sc-stat-num sc-stat-warn">1</span>
                        <span className="sc-stat-label">Low stock</span>
                    </div>
                </div>
            </div>

            {/* ── Inventory levels ── */}
            <div className="sc-inv-list">
                {SKUs.map(r => (
                    <div key={r.sku} className="sc-inv-row">
                        <div className="sc-inv-info">
                            <span className="sc-inv-name">{r.name}</span>
                            <span className="sc-inv-sku">{r.sku}</span>
                        </div>
                        <div className="sc-inv-bar-wrap">
                            <div className="sc-inv-bar-track">
                                <div
                                    className="sc-inv-bar-fill"
                                    style={{
                                        width: `${(r.avail / r.cap) * 100}%`,
                                        background: STATUS_COLOR[r.status],
                                    }}
                                />
                                <div
                                    className="sc-inv-bar-reserved"
                                    style={{ width: `${(r.reserved / r.cap) * 100}%` }}
                                />
                            </div>
                        </div>
                        <div className="sc-inv-counts">
                            <span className="sc-inv-avail" style={{ color: STATUS_COLOR[r.status] }}>{r.avail}</span>
                            {r.status === 'low' && (
                                <span className="sc-low-badge">
                                    <svg viewBox="0 0 10 10" fill="none" className="sc-warn-icon">
                                        <path d="M5 1.5L9 8.5H1L5 1.5Z" stroke="rgb(245 158 11)" strokeWidth="1" fill="rgba(245,158,11,0.12)" strokeLinejoin="round"/>
                                        <path d="M5 4.5v2" stroke="rgb(245 158 11)" strokeWidth="1" strokeLinecap="round"/>
                                        <circle cx="5" cy="7.2" r="0.5" fill="rgb(245 158 11)"/>
                                    </svg>
                                    Restock
                                </span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Purchase order inbound ── */}
            <div className="sc-po-row">
                <div className="sc-po-icon">
                    <svg viewBox="0 0 16 16" fill="none">
                        <path d="M3 13V5l5-3 5 3v8" stroke="rgba(139,92,246,0.7)" strokeWidth="1.2" strokeLinejoin="round"/>
                        <rect x="5.5" y="8" width="5" height="5" rx="0.5" stroke="rgba(139,92,246,0.7)" strokeWidth="1.1"/>
                        <path d="M6.5 8V6.5a1.5 1.5 0 013 0V8" stroke="rgba(139,92,246,0.5)" strokeWidth="1" strokeLinecap="round"/>
                    </svg>
                </div>
                <div className="sc-po-body">
                    <span className="sc-po-label">PO-2024-007 · Inbound</span>
                    <span className="sc-po-detail">200 units · ETA 2 days · Shiprocket</span>
                </div>
                <span className="sc-po-badge">In Transit</span>
            </div>

            {/* ── Fulfillment pipeline ── */}
            <div className="sc-pipeline">
                <span className="sc-pipeline-title">FULFILLMENT PIPELINE</span>
                <div className="sc-pipeline-row">
                    {[
                        { label: 'Pending',   count: 12, color: 'rgb(245 158 11)', bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.25)' },
                        { label: 'Processing',count: 8,  color: 'rgb(99 102 241)', bg: 'rgba(99,102,241,0.1)',   border: 'rgba(99,102,241,0.25)' },
                        { label: 'Shipped',   count: 21, color: 'rgb(6 182 212)',  bg: 'rgba(6,182,212,0.1)',    border: 'rgba(6,182,212,0.25)'  },
                        { label: 'Delivered', count: 6,  color: 'rgb(52 211 153)', bg: 'rgba(52,211,153,0.1)',   border: 'rgba(52,211,153,0.25)' },
                    ].map(p => (
                        <div key={p.label} className="sc-pipe-item" style={{ background: p.bg, border: `1px solid ${p.border}` }}>
                            <span className="sc-pipe-count" style={{ color: p.color }}>{p.count}</span>
                            <span className="sc-pipe-label" style={{ color: p.color }}>{p.label}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Footer ── */}
            <div className="sc-footer">
                <span className="sc-footer-pulse" />
                <span className="sc-footer-text">Auto-reserve on checkout · Real-time sync</span>
                <span className="sc-footer-badge">Live</span>
            </div>

        </div>
    )
}

function BrandPreview() {
    const CUSTOMERS = [
        { name: 'Priya Rajan',  init: 'P', city: 'Mumbai',    seg: 'VIP',   ltv: '₹48,200', orders: 14, last: '2h ago',  accent: 'rgb(139 92 246)' },
        { name: 'Arjun Mehta',  init: 'A', city: 'Delhi',     seg: 'Loyal', ltv: '₹12,400', orders: 6,  last: '1d ago',  accent: 'rgb(99 102 241)' },
        { name: 'Meera Kumar',  init: 'M', city: 'Bangalore', seg: 'New',   ltv: '₹2,840',  orders: 1,  last: '3d ago',  accent: 'rgb(16 185 129)' },
        { name: 'Rahul Shah',   init: 'R', city: 'Pune',      seg: 'VIP',   ltv: '₹31,000', orders: 9,  last: '5d ago',  accent: 'rgb(139 92 246)' },
    ]
    const SEGS = [
        { label: 'VIP',     count: 47,  color: 'rgb(139 92 246)', pct: 4  },
        { label: 'Loyal',   count: 218, color: 'rgb(99 102 241)', pct: 18 },
        { label: 'Active',  count: 640, color: 'rgb(6 182 212)',  pct: 53 },
        { label: 'New',     count: 89,  color: 'rgb(52 211 153)', pct: 8  },
        { label: 'At-Risk', count: 210, color: 'rgb(245 158 11)', pct: 17 },
    ]
    // 8-month returning rate trend
    const SPARK = [42, 48, 52, 55, 58, 62, 68, 73]
    const SW = 72, SH = 20
    const sMin = 30, sMax = 80, sRange = sMax - sMin
    const pts = SPARK.map((v, i) => `${(i / (SPARK.length - 1)) * SW},${SH - ((v - sMin) / sRange) * SH}`)
    const sparkLine = `M ${pts.join(' L ')}`
    const sparkArea = `${sparkLine} L ${SW},${SH} L 0,${SH} Z`

    return (
        <div className="mgj-mock cb-card" aria-hidden="true">

            {/* ── Header ── */}
            <div className="cb-header">
                <div className="cb-header-left">
                    <span className="cb-title">Customer Intelligence</span>
                    <span className="cb-subtitle">1,204 customers · India</span>
                </div>
                <span className="cb-retention-badge">
                    <svg viewBox="0 0 10 10" fill="none" className="cb-ret-icon">
                        <path d="M2 7 C2 4 5 2 8 3" stroke="rgb(52 211 153)" strokeWidth="1.3" strokeLinecap="round" fill="none"/>
                        <path d="M6.5 2.5L8 3l-0.5 1.5" stroke="rgb(52 211 153)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    68% repeat rate
                </span>
            </div>

            {/* ── Segment bar ── */}
            <div className="cb-segments">
                <div className="cb-seg-bar">
                    {SEGS.map(s => (
                        <div key={s.label} className="cb-seg-fill" style={{ width: `${s.pct}%`, background: s.color }} />
                    ))}
                </div>
                <div className="cb-seg-legend">
                    {SEGS.map(s => (
                        <div key={s.label} className="cb-seg-item">
                            <span className="cb-seg-dot" style={{ background: s.color }} />
                            <span className="cb-seg-name">{s.label}</span>
                            <span className="cb-seg-count">{s.count}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Customer rows ── */}
            <div className="cb-cust-list">
                {CUSTOMERS.map(c => (
                    <div key={c.name} className="cb-cust-row">
                        <div className="cb-cust-avatar" style={{ background: c.accent }}>{c.init}</div>
                        <div className="cb-cust-info">
                            <span className="cb-cust-name">{c.name}</span>
                            <span className="cb-cust-city">{c.city}</span>
                        </div>
                        <span className="cb-seg-badge" style={{
                            color: c.accent,
                            background: `color-mix(in srgb, ${c.accent} 12%, transparent)`,
                            borderColor: `color-mix(in srgb, ${c.accent} 30%, transparent)`,
                        }}>{c.seg}</span>
                        <div className="cb-cust-right">
                            <span className="cb-cust-ltv">{c.ltv}</span>
                            <span className="cb-cust-meta">{c.orders} orders · {c.last}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── KPIs ── */}
            <div className="cb-kpis">
                <div className="cb-kpi">
                    <span className="cb-kpi-val">₹3,240</span>
                    <span className="cb-kpi-label">Avg order</span>
                </div>
                <div className="cb-kpi-sep" />
                <div className="cb-kpi">
                    <span className="cb-kpi-val">24%</span>
                    <span className="cb-kpi-label">New / month</span>
                </div>
                <div className="cb-kpi-sep" />
                <div className="cb-kpi">
                    <div className="cb-kpi-spark-row">
                        <span className="cb-kpi-val">₹2.4L</span>
                        <svg className="cb-sparkline" viewBox={`0 0 ${SW} ${SH}`} preserveAspectRatio="none">
                            <defs>
                                <linearGradient id="cb-area-grad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="rgba(139,92,246,0.28)" />
                                    <stop offset="100%" stopColor="rgba(139,92,246,0)" />
                                </linearGradient>
                            </defs>
                            <path d={sparkArea} fill="url(#cb-area-grad)" />
                            <path d={sparkLine} stroke="rgb(139 92 246)" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <span className="cb-kpi-label">30-day LTV</span>
                </div>
            </div>

            {/* ── Footer ── */}
            <div className="cb-footer">
                <span className="cb-footer-pulse" />
                <div className="cb-footer-info">
                    <span className="cb-footer-primary">89 new this month · 3 browsing now</span>
                    <span className="cb-footer-secondary">Mumbai · Delhi · Bangalore · Pune</span>
                </div>
            </div>

        </div>
    )
}

function EnterprisePreview() {
    const CHANNELS = [
        { label: 'Storefront', rev: '₹88.4L', pct: 48, color: 'rgb(139 92 246)' },
        { label: 'B2B',        rev: '₹58.9L', pct: 32, color: 'rgb(99 102 241)' },
        { label: 'Mobile',     rev: '₹25.8L', pct: 14, color: 'rgb(6 182 212)'  },
        { label: 'WhatsApp',   rev: '₹11.1L', pct: 6,  color: 'rgb(52 211 153)' },
    ]
    const AI_SIGNALS = [
        { label: 'Restock Classic Sneakers',    type: 'Inventory', conf: 94, action: 'Create PO →',      color: 'rgb(245 158 11)' },
        { label: 'Kiran Ent. renewal due',      type: 'B2B CRM',   conf: 91, action: 'Send proposal →',  color: 'rgb(99 102 241)' },
        { label: 'Sport Tee price sensitivity', type: 'Pricing',   conf: 87, action: 'Adjust price →',   color: 'rgb(139 92 246)' },
    ]
    const SYSTEMS = ['API', 'Payments', 'Storefront', 'Workers', 'Webhooks', 'RLS']

    return (
        <div className="mgj-mock ep-card" aria-hidden="true">

            {/* ── Header ── */}
            <div className="ep-header">
                <div className="ep-header-left">
                    <div className="ep-title-row">
                        <span className="ep-title">Commerce OS</span>
                        <span className="ep-tier-badge">Enterprise</span>
                    </div>
                    <span className="ep-subtitle">₹50L+ GMV scale tier · Bharat-first</span>
                </div>
                <div className="ep-header-right">
                    <span className="ep-gmv">₹1.84Cr</span>
                    <span className="ep-gmv-trend">↑ 23% this month</span>
                </div>
            </div>

            {/* ── Multi-channel revenue ── */}
            <div className="ep-channels">
                <div className="ep-ch-bar">
                    {CHANNELS.map(c => (
                        <div key={c.label} className="ep-ch-fill" style={{ width: `${c.pct}%`, background: c.color }} />
                    ))}
                </div>
                <div className="ep-ch-grid">
                    {CHANNELS.map(c => (
                        <div key={c.label} className="ep-ch-item">
                            <span className="ep-ch-dot" style={{ background: c.color }} />
                            <span className="ep-ch-label">{c.label}</span>
                            <span className="ep-ch-rev">{c.rev}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── AI Copilot signals ── */}
            <div className="ep-ai">
                <span className="ep-section-title">
                    <svg viewBox="0 0 10 10" fill="none" className="ep-ai-icon-hd">
                        <circle cx="5" cy="5" r="3.5" stroke="rgba(167,139,250,0.8)" strokeWidth="1"/>
                        <path d="M3.5 5c0-1 .7-1.5 1.5-1.5s1.5.5 1.5 1.5" stroke="rgba(167,139,250,0.8)" strokeWidth="1" strokeLinecap="round"/>
                        <circle cx="5" cy="6.5" r="0.6" fill="rgba(167,139,250,0.8)"/>
                    </svg>
                    AI COPILOT · 3 SIGNALS
                </span>
                {AI_SIGNALS.map(s => (
                    <div key={s.label} className="ep-ai-row">
                        <div className="ep-ai-dot" style={{ background: s.color }} />
                        <div className="ep-ai-body">
                            <span className="ep-ai-label">{s.label}</span>
                            <span className="ep-ai-type" style={{ color: s.color }}>{s.type}</span>
                        </div>
                        <div className="ep-ai-right">
                            <span className="ep-ai-conf">{s.conf}%</span>
                            <span className="ep-ai-action">{s.action}</span>
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Scale KPIs ── */}
            <div className="ep-kpis">
                <div className="ep-kpi">
                    <span className="ep-kpi-num">₹1.84Cr</span>
                    <span className="ep-kpi-label">Monthly GMV</span>
                </div>
                <div className="ep-kpi-sep" />
                <div className="ep-kpi">
                    <span className="ep-kpi-num">2,847</span>
                    <span className="ep-kpi-label">Orders / mo</span>
                </div>
                <div className="ep-kpi-sep" />
                <div className="ep-kpi">
                    <span className="ep-kpi-num">48</span>
                    <span className="ep-kpi-label">B2B buyers</span>
                </div>
            </div>

            {/* ── System health ── */}
            <div className="ep-systems">
                <div className="ep-sys-pills">
                    {SYSTEMS.map(s => (
                        <div key={s} className="ep-sys-pill">
                            <span className="ep-sys-dot" />
                            <span className="ep-sys-label">{s}</span>
                        </div>
                    ))}
                </div>
                <span className="ep-sys-status">All 22 systems operational</span>
            </div>

        </div>
    )
}

const PREVIEWS = [LaunchPreview, FirstOrderPreview, ScalePreview, BrandPreview, EnterprisePreview]

// ── Closing banner ──────────────────────────────────────────────────────────

function MerchantBanner() {
    const STATS = [
        { val: '0%',          label: 'Platform fees' },
        { val: '12+',         label: 'Commerce surfaces' },
        { val: 'India-first', label: 'UPI · COD · GST built in' },
        { val: '1',           label: 'Unified identity' },
    ]
    return (
        <div className="mgj-banner" aria-label="Get started with LetBuyy">
            <div className="mgj-banner-content">
                <p className="mgj-banner-eyebrow">Commerce OS — Ready when you are</p>
                <h3 className="mgj-banner-headline">
                    Every stage of growth<br />
                    <span className="mgj-banner-accent">is already built in.</span>
                </h3>
                <p className="mgj-banner-sub">
                    Launch free. Add modules as you grow. No migrations, no re-platforming, no surprises.
                    One platform from your first sale to your first crore.
                </p>
            </div>

            <div className="mgj-banner-actions">
                <Link href={getAccountsUrl('/signup')} className="mgj-banner-cta-primary">
                    Start free trial
                </Link>
                <Link href={getMarketingSiteUrl('/pricing')} className="mgj-banner-cta-secondary">
                    View pricing
                </Link>
            </div>

            <div className="mgj-banner-stats">
                {STATS.map((s, i) => (
                    <div key={s.label} className="mgj-banner-stat-group">
                        {i > 0 && <div className="mgj-banner-stat-sep" aria-hidden="true" />}
                        <div className="mgj-banner-stat">
                            <span className="mgj-banner-stat-val">{s.val}</span>
                            <span className="mgj-banner-stat-label">{s.label}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

export default function MerchantJourney() {
    const [active, setActive] = useState(0)
    const [previewKey, setPreviewKey] = useState(0)
    const [mobileOpen, setMobileOpen] = useState<number | null>(null)
    const stepRefs = useRef<(HTMLDivElement | null)[]>([])
    const isDesktopRef = useRef(false)

    const activate = useCallback((idx: number) => {
        setActive(prev => {
            if (prev !== idx) setPreviewKey(k => k + 1)
            return idx
        })
    }, [])

    useEffect(() => {
        const check = () => { isDesktopRef.current = window.innerWidth >= 960 }
        check()
        window.addEventListener('resize', check, { passive: true })
        return () => window.removeEventListener('resize', check)
    }, [])

    // Same reveal as the Commerce OS Capability Map accordion: bring the opened
    // step up with the previous and next rows still in view. Mobile only — at
    // >=960px the trigger is just a heading and the preview is pinned beside
    // the rail, so there is nothing to scroll to.
    useEffect(() => {
        if (mobileOpen === null || isDesktopRef.current) return
        const el = stepRefs.current[mobileOpen]
        if (!el) return
        const immediate = window.matchMedia('(prefers-reduced-motion: reduce)').matches
        return revealAccordionItem(el, immediate)
    }, [mobileOpen])

    useEffect(() => {
        // rAF loop — reads scrollY directly each frame so it works with Lenis
        // and any other smooth-scroll implementation without needing scroll events
        let raf = 0
        let lastBest = -1

        const tick = () => {
            if (isDesktopRef.current) {
                const triggerY = window.scrollY + window.innerHeight * 0.45
                let best = 0
                stepRefs.current.forEach((el, idx) => {
                    if (!el) return
                    const elTop = el.getBoundingClientRect().top + window.scrollY
                    if (elTop <= triggerY) best = idx
                })
                if (best !== lastBest) {
                    lastBest = best
                    activate(best)
                }
            }
            raf = requestAnimationFrame(tick)
        }

        raf = requestAnimationFrame(tick)
        return () => cancelAnimationFrame(raf)
    }, [activate])

    const ActivePreview = PREVIEWS[active]

    return (
        <section id="merchant-journey" className="mgj" aria-labelledby="mgj-heading">
            <div className="container">
                <div className="mgj-header">
                    <div className="mgj-kicker">MERCHANT GROWTH JOURNEY</div>
                    <h2 id="mgj-heading" className="mgj-headline">
                        From first sale to{' '}
                        <span className="mgj-headline-accent">enterprise scale.</span>
                    </h2>
                    <p className="section-subtitle mgj-subtitle">
                        Every stage of growth is already built into LetBuyy.
                        No migrations. No re-platforming.
                        Just one Commerce Operating System that grows with your business.
                    </p>
                </div>

                <div className="mgj-body">
                    {/* Left: timeline rail */}
                    <div className="mgj-rail" role="list">
                        {STEPS.map((step, idx) => {
                            const isActive = active === idx
                            const isCompleted = idx < active
                            const isMobileOpen = mobileOpen === idx
                            const P = PREVIEWS[idx]

                            return (
                                <div
                                    key={step.id}
                                    ref={el => { stepRefs.current[idx] = el }}
                                    className={[
                                        'mgj-step',
                                        isActive ? 'is-active' : '',
                                        isCompleted ? 'is-done' : '',
                                        isMobileOpen ? 'is-mobile-open' : '',
                                    ].filter(Boolean).join(' ')}
                                    role="listitem"
                                    aria-current={isActive ? 'step' : undefined}
                                    onMouseEnter={() => { if (isDesktopRef.current) activate(idx) }}
                                >
                                    <div className="mgj-track" aria-hidden="true">
                                        <div className="mgj-dot" />
                                        {idx < STEPS.length - 1 && <div className="mgj-line" />}
                                    </div>

                                    <div className="mgj-step-body">
                                        <Button
                                            unstyled
                                            className="mgj-trigger"
                                            aria-expanded={isMobileOpen}
                                            aria-controls={`mgj-mpanel-${step.id}`}
                                            onClick={() => {
                                                setMobileOpen(prev => prev === idx ? null : idx)
                                                activate(idx)
                                            }}
                                        >
                                            <span className="mgj-num">{step.number}</span>
                                            <span className="mgj-trigger-text">
                                                <span className="mgj-step-title">{step.title}</span>
                                                <span className="mgj-step-metric">{step.metric}</span>
                                            </span>
                                            <span className="mgj-chevron" aria-hidden="true" />
                                        </Button>

                                        <div className="mgj-step-detail">
                                            <p className="mgj-step-desc">{step.description}</p>
                                            <span className="mgj-modules">{step.modules}</span>
                                        </div>

                                        {/* Mobile accordion panel */}
                                        <div
                                            id={`mgj-mpanel-${step.id}`}
                                            className="mgj-mobile-panel"
                                            aria-hidden={!isMobileOpen}
                                        >
                                            <div className="mgj-mobile-panel-inner">
                                                <P />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Right: sticky preview (desktop only) */}
                    <div className="mgj-sticky" aria-live="polite" aria-label="Stage preview">
                        <div className="mgj-sticky-pin">
                            <div className="mgj-sticky-inner" key={previewKey}>
                                <ActivePreview />
                            </div>
                        </div>
                    </div>
                </div>

                <MerchantBanner />
            </div>
        </section>
    )
}
