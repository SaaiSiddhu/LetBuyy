'use client'

import { useState } from 'react'

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
            <div
                className="admin-trial-toast-header"
                onClick={() => setCollapsed(!collapsed)}
            >
                <span className="admin-trial-toast-title">
                    🎉 {daysLeft} day{daysLeft !== 1 ? 's' : ''} left in your trial
                </span>
                <span className="material-symbols-outlined" style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <span
                        className={`admin-trial-toast-chevron ${collapsed ? 'collapsed' : ''}`}
                        style={{ fontSize: '20px', color: 'var(--text-hint)' }}
                    >
                        expand_less
                    </span>
                    <span
                        onClick={(e) => {
                            e.stopPropagation()
                            setDismissed(true)
                        }}
                        style={{ fontSize: '18px', color: 'var(--text-hint)', cursor: 'pointer' }}
                        title="Dismiss"
                    >
                        close
                    </span>
                </span>
            </div>

            {!collapsed && (
                <div className="admin-trial-toast-body">
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
