'use client'

import { ArrowUpRight, Clock3 } from 'lucide-react'
import { MerchantNavigationLink } from './MerchantNavigationLink'

interface TrialBannerProps {
    storeSlug: string
    trialEndsAt: string | null
    trialStatus: string | null
}

export function getTrialDaysLeft(trialEndsAt: string | null, trialStatus: string | null): number | null {
    if (!trialEndsAt || trialStatus !== 'active') return null
    const remaining = new Date(trialEndsAt).getTime() - Date.now()
    if (!Number.isFinite(remaining) || remaining <= 0) return null
    return Math.ceil(remaining / 86_400_000)
}

export default function TrialBanner({ storeSlug, trialEndsAt, trialStatus }: TrialBannerProps) {
    const daysLeft = getTrialDaysLeft(trialEndsAt, trialStatus)
    if (daysLeft === null || !trialEndsAt) return null
    const endDate = new Intl.DateTimeFormat('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata',
    }).format(new Date(trialEndsAt))

    return (
        <aside className="admin-trial-toast" aria-label="Trial status">
            <span className="admin-trial-toast-icon"><Clock3 size={18} aria-hidden="true" /></span>
            <div className="admin-trial-toast-content">
                <span className="admin-trial-toast-eyebrow">Your trial</span>
                <strong>{daysLeft} day{daysLeft === 1 ? '' : 's'} remaining</strong>
                <span>Ends {endDate}. Review plans when you’re ready.</span>
            </div>
            <MerchantNavigationLink
                href={`/${encodeURIComponent(storeSlug)}/access_account/checkout/select-plan`}
                className="admin-trial-toast-btn"
            >
                View plans <ArrowUpRight size={15} aria-hidden="true" />
            </MerchantNavigationLink>
        </aside>
    )
}
