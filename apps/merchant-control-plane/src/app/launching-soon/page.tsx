import type { Metadata } from 'next'
import { MaterialIcon } from '@letbuyy/ui'

export const metadata: Metadata = {
    title: 'Launching Soon — LetBuyy',
    description: 'This store is being set up. Check back soon!',
}

/**
 * /launching-soon
 * Publicly visible placeholder for stores still in draft mode.
 * Shown when a user visits a subdomain whose store.status === 'draft'.
 *
 * The storefront middleware should redirect here when the store isn't published.
 */

export default function LaunchingSoonPage() {
    return (
        <main className="launching-soon-page">
            <div className="launching-soon-content">
                <div className="launching-soon-mark" aria-hidden="true">
                    <MaterialIcon name="rocket_launch" size={40} />
                </div>

                <h1 className="launching-soon-title">
                    Launching Soon
                </h1>

                <p className="launching-soon-copy">
                    This store is currently being set up. Check back soon for something amazing.
                </p>

                <div className="launching-soon-powered">
                    Powered by <span>LetBuyy</span>
                </div>
            </div>
        </main>
    )
}
