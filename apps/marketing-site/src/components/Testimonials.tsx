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
        quote: "Our launch campaign went live with a clean landing page and lead capture in one afternoon.",
        name: "Arjun Mehta",
        role: "Growth Consultant, Bangalore",
        initial: "A",
    },
    {
        quote: "We publish buying guides and product updates without splitting tools between the blog and store.",
        name: "Sneha Iyer",
        role: "Homeware Founder, Chennai",
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
