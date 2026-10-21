'use client'

import { useState } from 'react'
import { Button, MaterialIcon } from '@letbuyy/ui'
import { MerchantNavigationLink } from './MerchantNavigationLink'

interface TrialBannerProps {
    storeSlug: string
    trialEndsAt: string | null
    trialStatus: string | null
}

export default function TrialBanner({ storeSlug, trialEndsAt, trialStatus }: TrialBannerProps) {
    const [collapsed, setCollapsed] = useState(false)
    const [dismissed, setDismissed] = useState(false)

    // Don't show if no trial or explicitly dismissed
    if (!trialEndsAt || trialStatus !== 'active' || dismissed) {
        return null
    }

    // Calculate remaining days
    const trialEnd = new Date(trialEndsAt)
    const now = new Date()
    const diffMs = trialEnd.getTime() - now.getTime()
    const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))

    if (!Number.isFinite(daysLeft) || daysLeft <= 0) return null

    return (
        <div className="admin-trial-toast">
            <div className="admin-trial-toast-header">
                <Button unstyled
                    type="button"
                    className="admin-trial-toast-toggle"
                    onClick={() => setCollapsed(!collapsed)}
                    aria-expanded={!collapsed}
                    aria-controls="admin-trial-toast-body"
                >
                    <span className="admin-trial-toast-title">
                        <MaterialIcon name="sparkles" className="admin-trial-toast-title-icon" size={16} />
                        {daysLeft} day{daysLeft !== 1 ? 's' : ''} left in your trial
                    </span>
                    <MaterialIcon
                        name="expand_less"
                        className={`admin-trial-toast-chevron ${collapsed ? 'collapsed' : ''}`}
                        size={20}
                    />
                </Button>
                <Button unstyled
                    type="button"
                    className="admin-trial-toast-dismiss"
                    onClick={() => setDismissed(true)}
                    aria-label="Dismiss trial banner"
                >
                    <MaterialIcon name="close" size={18} />
                </Button>
            </div>

            {!collapsed && (
                <div className="admin-trial-toast-body" id="admin-trial-toast-body">
                    <p>
                        Choose a plan before your current trial ends to keep your store running.
                    </p>
                    <MerchantNavigationLink
                        href={`/${encodeURIComponent(storeSlug)}/access_account/checkout/select-plan`}
                        className="admin-trial-toast-btn"
                    >
                        Select a plan
                    </MerchantNavigationLink>
                </div>
            )}
        </div>
    )
}
