export default function TestimonialsSection() {
    const testimonials = [
        {
            quote: "LetBuyy helped me launch my clothing store in just 2 days. The payments integration with Razorpay was seamless!",
            name: "Priya Sharma",
            role: "Fashion Store Owner, Mumbai",
            initial: "P"
        },
        {
            quote: "Our launch campaign went live with a clean landing page and lead capture in one afternoon.",
            name: "Arjun Mehta",
            role: "Growth Consultant, Bangalore",
            initial: "A"
        },
        {
            quote: "We publish buying guides and product updates without splitting tools between the blog and store.",
            name: "Sneha Iyer",
            role: "Homeware Founder, Chennai",
            initial: "S"
        }
    ]

    return (
        <section id="testimonials" className="testimonials">
            <div className="container">
                <div className="section-header">
                    <p className="section-label">Testimonials</p>
                    <h2 className="section-title">Loved by entrepreneurs across India</h2>
                </div>

                <div className="testimonials-grid">
                    {testimonials.map((t, i) => (
                        <div key={i} className="testimonial-card">
                            <p className="testimonial-quote">&ldquo;{t.quote}&rdquo;</p>
                            <div className="testimonial-author">
                                <div className="testimonial-avatar">{t.initial}</div>
                                <div>
                                    <p className="testimonial-name">{t.name}</p>
                                    <p className="testimonial-role">{t.role}</p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    )
}
