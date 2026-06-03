'use client'

import { useState } from 'react'
import { MaterialIcon } from '@letbuyy/ui'

interface TrialBannerProps {
    trialEndsAt: string | null
    trialStatus: string | null
}

export default function TrialBanner({ trialEndsAt, trialStatus }: TrialBannerProps) {
    const [collapsed, setCollapsed] = useState(false)
    const [dismissed, setDismissed] = useState(false)

    // Don't show if no trial or explicitly dismissed
    if (!trialEndsAt || trialStatus === 'expired' || trialStatus === 'active_paid' || dismissed) {
        return null
    }

    // Calculate remaining days
    const trialEnd = new Date(trialEndsAt)
    const now = new Date()
    const diffMs = trialEnd.getTime() - now.getTime()
    const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))

    if (daysLeft <= 0) return null

    return (
        <div className="admin-trial-toast">
            <div className="admin-trial-toast-header">
                <button
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
                </button>
                <button
                    type="button"
                    className="admin-trial-toast-dismiss"
                    onClick={() => setDismissed(true)}
                    aria-label="Dismiss trial banner"
                >
                    <MaterialIcon name="close" size={18} />
                </button>
            </div>

            {!collapsed && (
                <div className="admin-trial-toast-body" id="admin-trial-toast-body">
                    <p>
                        Extend your trial or pick a plan to keep your store running.
                        Your trial includes <strong>all features</strong>.
                    </p>
                    <ul>
                        <li>Unlimited products</li>
                        <li>Custom domain</li>
                        <li>Priority support</li>
                    </ul>
                    <a
                        href="#"
                        className="admin-trial-toast-btn"
                        onClick={(e) => e.preventDefault()}
                    >
                        Select a plan
                    </a>
                </div>
            )}
        </div>
    )
}
