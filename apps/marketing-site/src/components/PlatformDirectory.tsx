import Link from 'next/link'
import { getPlatformNavigationLinks } from '@/lib/platform-links'

export default function PlatformDirectory() {
    const links = getPlatformNavigationLinks()

    return (
        <section id="platform-directory" className="platform-directory" aria-labelledby="platform-directory-title">
            <div className="container">
                <div className="platform-directory-header">
                    <p className="section-eyebrow">Platform directory</p>
                    <h2 id="platform-directory-title" className="section-title">
                        LetBuyy apps, docs, and marketplaces.
                    </h2>
                    <p className="section-subtitle">
                        A crawlable map of the public LetBuyy surfaces Google should understand as one platform.
                    </p>
                </div>

                <div className="platform-directory-grid">
                    {links.map((link) => (
                        <Link key={link.label} href={link.href} className="platform-directory-card">
                            <span className="platform-directory-card-label">{link.label}</span>
                            <span className="platform-directory-card-copy">{link.description}</span>
                        </Link>
                    ))}
                </div>
            </div>
        </section>
    )
}
