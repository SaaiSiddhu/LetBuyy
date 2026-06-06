import Link from 'next/link'
import BrandLogo from './BrandLogo'
import { getAccountsUrl } from '@/lib/public-urls'

export default function Navbar() {
    return (
        <nav className="navbar">
            <div className="container navbar-content">
                {/* Logo */}
                <Link href="/" className="navbar-logo">
                    <BrandLogo className="navbar-brand-logo" width={176} height={57} />
                </Link>

                {/* Navigation Links */}
                <div className="navbar-links">
                    <Link href="#features" className="navbar-link">Features</Link>
                    <Link href="#pricing" className="navbar-link">Pricing</Link>
                    <Link href="#testimonials" className="navbar-link">Testimonials</Link>
                </div>

                {/* CTA Buttons */}
                <div className="navbar-actions">
                    <Link href={getAccountsUrl('/lookup')} className="btn btn-outline">
                        Log in
                    </Link>
                    <Link href={getAccountsUrl('/signup')} className="btn btn-primary">
                        Start free trial
                    </Link>
                </div>
            </div>
        </nav>
    )
}
