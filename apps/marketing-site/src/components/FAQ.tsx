'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronDown } from '@letbuyy/ui'

const faqs = [
    {
        question: 'Is LetBuyy free to use?',
        answer: 'Yes! LetBuyy offers a free forever plan that lets you create and publish your site with essential features. You can upgrade anytime to unlock premium features like custom domains, advanced analytics, and more.',
    },
    {
        question: 'Can I use a custom domain?',
        answer: 'Absolutely! You can connect your own domain to your LetBuyy site. Free plans get a yoursite.letbuyy.store subdomain, while paid plans support custom domains like yourbrand.com.',
    },
    {
        question: 'Is LetBuyy good for building resumes?',
        answer: 'Yes! LetBuyy includes professional resume templates that are ATS-friendly. You can export your resume as a PDF, share it online, and even track who views it.',
    },
    {
        question: 'Do you take transaction fees?',
        answer: 'LetBuyy does not charge any transaction fees on your sales. You only pay the standard payment gateway fees (Stripe, Razorpay, PayPal) for processing payments.',
    },
    {
        question: 'Can I sell digital products?',
        answer: 'Yes! You can sell both physical and digital products. Digital products are delivered automatically via secure download links after purchase.',
    },
    {
        question: 'How do I get support?',
        answer: 'We offer 24/7 support via chat and email. Business and Enterprise plans get priority support with dedicated account managers.',
    },
]

export default function FAQ() {
    const [openIndex, setOpenIndex] = useState<number | null>(null)

    return (
        <section className="faq">
            <div className="container">
                <motion.div
                    className="faq-header"
                    initial={{ opacity: 0, y: 30 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6 }}
                >
                    <span className="section-label">FAQ</span>
                    <h2 className="section-title">Frequently asked questions</h2>
                    <p className="section-subtitle">
                        Everything you need to know about LetBuyy.
                    </p>
                </motion.div>

                <div className="faq-list">
                    {faqs.map((faq, index) => (
                        <motion.div
                            key={index}
                            className={`faq-item ${openIndex === index ? 'open' : ''}`}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            viewport={{ once: true }}
                            transition={{ duration: 0.4, delay: index * 0.05 }}
                        >
                            <button
                                className="faq-question"
                                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                            >
                                <span>{faq.question}</span>
                                <ChevronDown className="faq-icon" width={20} height={20} aria-hidden="true" />
                            </button>
                            <AnimatePresence>
                                {openIndex === index && (
                                    <motion.div
                                        className="faq-answer"
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.3 }}
                                    >
                                        <p>{faq.answer}</p>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    )
}
