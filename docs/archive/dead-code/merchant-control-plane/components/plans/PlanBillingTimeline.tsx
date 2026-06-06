'use client'

/* ——————————————————————————————————————
   Plan Billing Timeline
   Checkout sidebar component showing:
   • Today → Free (Trial)
   • Date → ₹79/mo (Promo period)
   • Date → ₹999/mo (Regular pricing)
   —————————————————————————————————————— */

interface TimelineEntry {
    date: string
    label: string
    amount: string
    description?: string
    isActive?: boolean
}

interface PlanBillingTimelineProps {
    entries: TimelineEntry[]
    totalLabel: string
    totalAmount: string
    totalSubtext?: string
}

export default function PlanBillingTimeline({
    entries,
    totalLabel,
    totalAmount,
    totalSubtext,
}: PlanBillingTimelineProps) {
    return (
        <div className="billing-timeline">
            {/* Timeline entries */}
            <div className="billing-timeline__entries">
                {entries.map((entry, i) => (
                    <div
                        key={i}
                        className={`billing-timeline__entry ${entry.isActive ? 'billing-timeline__entry--active' : ''}`}
                    >
                        <div className="billing-timeline__dot-col">
                            <div className={`billing-timeline__dot ${entry.isActive ? 'billing-timeline__dot--active' : ''}`} />
                            {i < entries.length - 1 && (
                                <div className="billing-timeline__line" />
                            )}
                        </div>
                        <div className="billing-timeline__content">
                            <div className="billing-timeline__row">
                                <span className="billing-timeline__date">{entry.date}</span>
                                <span className="billing-timeline__amount">{entry.amount}</span>
                            </div>
                            <span className="billing-timeline__label">{entry.label}</span>
                            {entry.description && (
                                <span className="billing-timeline__desc">{entry.description}</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Total */}
            <div className="billing-timeline__total">
                <div className="billing-timeline__total-row">
                    <span className="billing-timeline__total-label">{totalLabel}</span>
                    <span className="billing-timeline__total-amount">{totalAmount}</span>
                </div>
                {totalSubtext && (
                    <span className="billing-timeline__total-subtext">{totalSubtext}</span>
                )}
            </div>
        </div>
    )
}
