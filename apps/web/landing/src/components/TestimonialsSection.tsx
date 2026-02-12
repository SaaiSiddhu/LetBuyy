export default function TestimonialsSection() {
    const testimonials = [
        {
            quote: "LetBuyy helped me launch my clothing store in just 2 days. The payments integration with Razorpay was seamless!",
            name: "Priya Sharma",
            role: "Fashion Store Owner, Mumbai",
            initial: "P"
        },
        {
            quote: "As a freelance designer, I needed a portfolio that stands out. LetBuyy's templates are beautiful and easy to customize.",
            name: "Arjun Mehta",
            role: "UI/UX Designer, Bangalore",
            initial: "A"
        },
        {
            quote: "The resume builder helped me land my dream job. The PDF export feature is exactly what I needed.",
            name: "Sneha Iyer",
            role: "Software Engineer, Chennai",
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
