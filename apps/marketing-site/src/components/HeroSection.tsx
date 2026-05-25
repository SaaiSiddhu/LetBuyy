import Link from 'next/link'

export default function HeroSection() {
    return (
        <section className="hero">
            <div className="container hero-content">
                {/* Badge */}
                <div className="hero-badge">
                    ✨ 14-day free trial • No credit card required
                </div>

                {/* Title */}
                <h1 className="hero-title">
                    Create your store<br />
                    <span>in minutes</span>
                </h1>

                {/* Subtitle */}
                <p className="hero-subtitle">
                    Build beautiful online stores, portfolios, resumes, and landing pages.
                    Everything you need to grow your business online.
                </p>

                {/* CTA Buttons */}
                <div className="hero-cta">
                    <Link href="http://localhost:3001/signup" className="btn btn-primary btn-large">
                        Start your free trial
                    </Link>
                    <Link href="#features" className="btn btn-outline btn-large">
                        See how it works
                    </Link>
                </div>

                {/* Note */}
                <p className="hero-note">
                    Starts at just ₹199/month after trial
                </p>
            </div>
        </section>
    )
}
