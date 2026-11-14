import Copy from '@/components/i18n/Copy'
import Link from '@/components/i18n/LocaleLink'
import Image from 'next/image'
import { getAccountsUrl } from '@/lib/public-urls'
import styles from './final-cta.module.css'

/** Acquisition links stay visible in SSR and without a client-only motion reveal. */
export default function FinalCTA() {
    return (
        <section className="final-cta">
            <div className="final-cta-bg" />
            <div className="container">
                <div className="final-cta-content">
                    <div className={styles.illustration} aria-hidden="true"><Image src="/illustrations/storefront-launch-cta-v1.webp" alt="" width={1536} height={1024} sizes="(max-width: 640px) 90vw, 600px" loading="lazy" unoptimized /></div>
                    <h2 className="final-cta-title"><Copy text="Start building with LetBuyy today." /></h2>
                    <p className="final-cta-subtitle"><Copy text="Launch your store, blog, or landing page in minutes." /></p>
                    <div className="final-cta-actions">
                        <div><Link href={getAccountsUrl('/signup')} className="btn btn-primary btn-large"><Copy text="Get started" /></Link></div>
                        <div><Link href="/demo" className="btn btn-outline btn-large"><Copy text="Request Demo" /></Link></div>
                    </div>
                    <p className="final-cta-note"><Copy text="Review plans and trial terms before subscribing." /></p>
                </div>
            </div>
        </section>
    )
}
