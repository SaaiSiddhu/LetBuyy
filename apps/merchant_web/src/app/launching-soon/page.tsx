import type { Metadata } from 'next'
import { MaterialIcon } from '@letbuyy/ui'

export const metadata: Metadata = {
    title: 'Store Not Open Yet — LetBuyy',
    description: 'This store is not open to shoppers yet.',
}

/**
 * /launching-soon
 * Publicly visible gated page for stores still in draft mode.
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
                    Store Not Open Yet
                </h1>

                <p className="launching-soon-copy">
                    This store is currently being set up and is not open to shoppers yet.
                </p>

                <div className="launching-soon-powered">
                    Powered by <span>LetBuyy</span>
                </div>
            </div>
        </main>
    )
}
