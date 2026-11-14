'use client'

import { useCopy } from '@/components/i18n/useCopy'

import Image from 'next/image'
import { useState, useRef, type KeyboardEvent } from 'react'
import { Button, Check, ChevronLeft, ChevronRight } from '@letbuyy/ui'
import { journeyTabTarget } from '@/lib/journey-tab-navigation'

const STAGES = [
    {
        id: 'launch', number: '01', title: 'Launch Store', short: 'Launch', modules: 'Storefronts + Themes',
        headline: 'Make it yours. Then open the doors.',
        description: 'Turn your products into a storefront that feels like your business. Start with the essentials and publish when you are ready.',
        image: '/illustrations/journey/growth-commerce-v2.webp',
        tasks: [
            { title: 'Shape your storefront', text: 'Choose a theme, adjust your branding and preview it on different screens.' },
            { title: 'Prepare your catalogue', text: 'Add product photos, prices, sizes and available stock.' },
            { title: 'Make it easy to find', text: 'Use your LetBuyy address or connect an eligible custom domain.' },
        ],
    },
    {
        id: 'first-order', number: '02', title: 'First Order', short: 'Sell', modules: 'Orders + Payments',
        headline: 'Your first sale. A clear next step.',
        description: 'When a customer buys, bring the order, payment and delivery details together. Follow the work from purchase to a prepared parcel.',
        image: '/illustrations/journey/first-order-illustration-v2.webp',
        tasks: [
            { title: 'Review the purchase', text: 'See what was ordered, who bought it and where it needs to go.' },
            { title: 'Follow the payment', text: 'Check whether the order is paid, pending or cash on delivery.' },
            { title: 'Prepare the parcel', text: 'Pack the items, add shipment details and follow delivery progress.' },
        ],
    },
    {
        id: 'scale', number: '03', title: 'Scale Operations', short: 'Operate', modules: 'Inventory + Orders',
        headline: 'More orders. A more organised day.',
        description: 'Keep the stockroom and the order list working together. Know what is available, what needs attention and what is ready to leave.',
        image: '/illustrations/journey/scale-illustration-v2.webp',
        tasks: [
            { title: 'Know your stock', text: 'Review available quantities for each product and variant.' },
            { title: 'Plan a restock', text: 'Check stock history and prepare incoming inventory or purchase orders.' },
            { title: 'Keep fulfilment moving', text: 'Follow pending orders, shipment updates and returns in your workspace.' },
        ],
    },
    {
        id: 'brand', number: '04', title: 'Build Brand', short: 'Retain', modules: 'Customers + Analytics',
        headline: 'Give a first-time buyer a reason to return.',
        description: 'Get to know your customers and plan your next collection with better context. Build the relationship beyond one transaction.',
        image: '/illustrations/journey/brand-illustration-v2.webp',
        tasks: [
            { title: 'Understand your customers', text: 'Find customer profiles, purchase history and useful segments.' },
            { title: 'Share the next collection', text: 'Check the supported communication tools and customer consent before planning a campaign.' },
            { title: 'Learn from your sales', text: 'Review product performance and revenue before planning your next move.' },
        ],
    },
    {
        id: 'enterprise', number: '05', title: 'Enterprise', short: 'Expand', modules: 'B2B + AI + Analytics',
        headline: 'A wider business. A connected workspace.',
        description: 'As the business becomes more complex, bring wholesale work, AI assistance and reporting into the same operating picture.',
        image: '/illustrations/journey/enterprise-illustration-v2.webp',
        tasks: [
            { title: 'Organise wholesale work', text: 'Discuss business-buyer and bulk-order requirements with support before relying on their availability.' },
            { title: 'Work with AI assistance', text: 'Prepare supported content drafts and review suggestions before acting.' },
            { title: 'Keep the wider view', text: 'Use your commerce reports to understand the business across its activities.' },
        ],
    },
] as const

export default function MerchantJourney() {
    const { t } = useCopy()
    const [active, setActive] = useState(0)
    const tablist = useRef<HTMLDivElement>(null)

    function selectStage(index: number, focusTab = false) {
        setActive(index)
        if (focusTab) tablist.current?.querySelectorAll<HTMLButtonElement>('[role="tab"]')[index]?.focus({ preventScroll: true })
    }

    function navigateTabs(event: KeyboardEvent<HTMLButtonElement>, index: number) {
        const next = journeyTabTarget(event.key, index, STAGES.length)
        if (next === null) return
        event.preventDefault()
        selectStage(next, true)
    }

    return (
        <section id="merchant-journey" className="mgj mgj-explorer" aria-labelledby="mgj-heading">
            <div className="container">
                <header className="mgj-explorer-header">
                    <p className="section-label">{t("Merchant Growth Journey")}</p>
                    <h2 id="mgj-heading">{t("From opening day to your next big move.")}</h2>
                    <p>{t("Explore five moments in a growing business—and the LetBuyy tools you can use at each one.")}</p>
                </header>

                <div className="mgj-explorer-workspace">
                    <div ref={tablist} className="mgj-stage-tabs" role="tablist" aria-label={t("Choose a business growth stage")}>
                        {STAGES.map((stage, index) => (
                            <Button
                                unstyled
                                type="button"
                                key={stage.id}
                                role="tab"
                                id={`journey-tab-${stage.id}`}
                                aria-controls={`journey-panel-${stage.id}`}
                                aria-selected={active === index}
                                tabIndex={active === index ? 0 : -1}
                                className="mgj-stage-tab"
                                onClick={() => selectStage(index)}
                                onKeyDown={event => navigateTabs(event, index)}
                            >
                                <span className="mgj-stage-number">{stage.number}</span>{' '}
                                <span className="mgj-stage-name">{t((stage.title) ?? '')}</span>
                                <span className="mgj-stage-short">{t((stage.short) ?? '')}</span>
                            </Button>
                        ))}
                    </div>

                    <div className="mgj-chapters">
                        {STAGES.map((stage, index) => (
                            <div
                                key={stage.id}
                                id={`journey-panel-${stage.id}`}
                                role="tabpanel"
                                aria-labelledby={`journey-tab-${stage.id}`}
                                tabIndex={active === index ? 0 : -1}
                                aria-hidden={active !== index}
                                inert={active !== index}
                                className="mgj-chapter"
                            >
                                <div className="mgj-chapter-intro">
                                    <div className="mgj-chapter-copy">
                                        <p className="mgj-chapter-tools">{t((stage.modules) ?? '')}</p>
                                        <h3>{t((stage.headline) ?? '')}</h3>
                                        <p className="mgj-chapter-description">{t((stage.description) ?? '')}</p>
                                    </div>
                                    <figure className="mgj-chapter-art" aria-hidden="true">
                                        <Image src={stage.image} alt="" width={640} height={640} sizes="(max-width: 767px) 72px, 300px" loading="lazy" unoptimized />
                                    </figure>
                                </div>
                                <ol className="mgj-chapter-tasks" aria-label={t("What you can do: {label}", { label: t(stage.title) })}>
                                    {stage.tasks.map(task => (
                                        <li key={task.title}>
                                            <Check width={18} height={18} strokeWidth={1.7} aria-hidden="true" />
                                            <div><h4>{t((task.title) ?? '')}</h4><p>{t((task.text) ?? '')}</p></div>
                                        </li>
                                    ))}
                                </ol>
                            </div>
                        ))}
                    </div>

                    <nav className="mgj-chapter-nav" aria-label={t("Move through the business stages")}>
                        <Button unstyled type="button" className="mgj-chapter-nav-button" disabled={active === 0} onClick={() => selectStage(active - 1, true)}>
                            <ChevronLeft width={18} height={18} aria-hidden="true" /><span>{t("Previous")}</span>
                        </Button>
                        <span className="mgj-chapter-position" aria-live="polite" aria-atomic="true">{STAGES[active].number} / 05</span>
                        <Button unstyled type="button" className="mgj-chapter-nav-button" disabled={active === STAGES.length - 1} onClick={() => selectStage(active + 1, true)}>
                            <span>{t("Next stage")}</span><ChevronRight width={18} height={18} aria-hidden="true" />
                        </Button>
                    </nav>
                </div>
                <p className="mgj-explorer-note">{t("Tools depend on your plan and setup. Payments, shipping and live email delivery require the relevant provider connections.")}</p>
            </div>
        </section>
    )
}
