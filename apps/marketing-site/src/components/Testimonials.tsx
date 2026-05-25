'use client'

import { motion } from 'framer-motion'

const testimonials = [
    {
        quote: "LetBuyy helped me launch my clothing store in just 2 days. The Razorpay integration was seamless. My sales doubled in the first month!",
        name: "Priya Sharma",
        role: "Fashion Store Owner, Mumbai",
        initial: "P",
    },
    {
        quote: "As a freelance designer, I needed a portfolio that stands out. LetBuyy's templates are beautiful and I got 3 new clients after launching.",
        name: "Arjun Mehta",
        role: "UI/UX Designer, Bangalore",
        initial: "A",
    },
    {
        quote: "The resume builder is incredible. I created a stunning CV in 15 minutes and landed interviews at top tech companies. The PDF export is perfect.",
        name: "Sneha Iyer",
        role: "Software Engineer, Chennai",
        initial: "S",
    },
]

const cardVariants = {
    hidden: { opacity: 0, y: 30 },
    visible: (i: number) => ({
        opacity: 1,
        y: 0,
        transition: {
            duration: 0.5,
            delay: i * 0.15,
            ease: [0.16, 1, 0.3, 1] as const,
        },
    }),
}

export default function Testimonials() {
    return (
        <section id="testimonials" className="testimonials">
            <div className="container">
                <motion.div
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    <p className="section-label">Testimonials</p>
                    <h2 className="section-title">Loved by entrepreneurs across India</h2>
                </motion.div>

                <div className="testimonials-grid">
                    {testimonials.map((t, i) => (
                        <motion.div
                            key={i}
                            className="testimonial-card"
                            custom={i}
                            variants={cardVariants}
                            initial="hidden"
                            whileInView="visible"
                            viewport={{ once: true }}
                            whileHover={{ y: -6 }}
                        >
                            <p className="testimonial-quote">&ldquo;{t.quote}&rdquo;</p>
                            <div className="testimonial-author">
                                <div className="testimonial-avatar">{t.initial}</div>
                                <div>
                                    <p className="testimonial-name">{t.name}</p>
                                    <p className="testimonial-role">{t.role}</p>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
