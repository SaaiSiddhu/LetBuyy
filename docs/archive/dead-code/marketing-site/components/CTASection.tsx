import Link from 'next/link'
import { getAccountsUrl } from '@/lib/public-urls'

export default function CTASection() {
    return (
        <section className="cta">
            <div className="container">
                <h2 className="cta-title">Ready to grow your business?</h2>
                <p className="cta-subtitle">
                    Join 100+ entrepreneurs who&apos;ve built their online presence with LetBuyy.
                </p>
                <Link href={getAccountsUrl('/signup')} className="btn btn-secondary btn-large">
                    Start your 14-day free trial
                </Link>
            </div>
        </section>
    )
}
