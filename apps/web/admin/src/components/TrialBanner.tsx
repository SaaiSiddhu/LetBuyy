'use client'

interface TrialBannerProps {
    trialEndsAt: string | null
    trialStatus: string | null
}

export default function TrialBanner({ trialEndsAt, trialStatus }: TrialBannerProps) {
    // Don't show banner for active (paid) stores or if no trial info
    if (!trialEndsAt || trialStatus === 'active_paid' || trialStatus === 'converted') return null

    const now = new Date()
    const trialEnd = new Date(trialEndsAt)
    const diffMs = trialEnd.getTime() - now.getTime()
    const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)))

    // Trial expired
    if (daysLeft === 0 || trialStatus === 'expired' || trialStatus === 'frozen') {
        return (
            <div className="admin-trial-banner admin-trial-banner--expired">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>warning</span>
                <span>
                    Your free trial has <strong>expired</strong>.
                    {' '}
                    <a href="/settings/billing" className="admin-trial-banner-link">
                        Activate now →
                    </a>
                </span>
            </div>
        )
    }

    // Grace period (1-3 days left)
    if (daysLeft <= 3) {
        return (
            <div className="admin-trial-banner admin-trial-banner--urgent">
                <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>schedule</span>
                <span>
                    <strong>{daysLeft} {daysLeft === 1 ? 'day' : 'days'}</strong> left in your free trial.
                    {' '}
                    <a href="/settings/billing" className="admin-trial-banner-link">
                        Activate now →
                    </a>
                </span>
            </div>
        )
    }

    // Normal trial period
    return (
        <div className="admin-trial-banner admin-trial-banner--info">
            <span className="material-symbols-outlined" style={{ fontSize: '18px' }}>info</span>
            <span>
                <strong>{daysLeft} days</strong> left in your free trial.
                {' '}
                <a href="/settings/billing" className="admin-trial-banner-link">
                    Choose a plan →
                </a>
            </span>
        </div>
    )
}
