import Link from 'next/link'
import Image from 'next/image'

export default function Navbar() {
    return (
        <nav className="navbar">
            <div className="container navbar-content">
                {/* Logo */}
                <Link href="/" className="navbar-logo">
                    <Image src="/icons/app_icon.png" alt="LetBuyy" width={36} height={36} />
                    <span>LetBuyy</span>
                </Link>

                {/* Navigation Links */}
                <div className="navbar-links">
                    <Link href="#features" className="navbar-link">Features</Link>
                    <Link href="#pricing" className="navbar-link">Pricing</Link>
                    <Link href="#testimonials" className="navbar-link">Testimonials</Link>
                </div>

                {/* CTA Buttons */}
                <div className="navbar-actions">
                    <Link href="https://accounts.staging.letbuyy.store/lookup" className="btn btn-outline">
                        Log in
                    </Link>
                    <Link href="https://accounts.staging.letbuyy.store/signup" className="btn btn-primary">
                        Start free trial
                    </Link>
                </div>
            </div>
        </nav>
    )
}
