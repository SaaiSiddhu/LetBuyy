'use client'

import { useCopy } from '@/components/i18n/useCopy'

import Copy from '@/components/i18n/Copy'

import { useState, useRef } from 'react'
import { motion, AnimatePresence, useInView, useReducedMotion } from 'framer-motion'
import MarketingIllustration from './MarketingIllustration'
import { Button, Check, Minus, Plus } from '@letbuyy/ui'

const TRUST_ITEMS = [
  'No transaction commissions',
  'Indian payment ecosystem',
  'Custom domains supported',
  'Migration assistance available',
  'AI-native commerce platform',
]

const METRICS = [
  { val: 'Own PSP', label: 'Online payments' },
  { val: 'India', label: 'Launch focus' },
  { val: '100%', label: 'Data ownership' },
  { val: '0%',   label: 'Commission' },
]

const FAQS: { q: string; a: string[] }[] = [
  {
    q: 'What is LetBuyy?',
    a: [
      'LetBuyy is an AI-native Commerce Operating System that helps businesses manage storefronts, products, inventory, orders, payments, customers, analytics, and operations from one platform.',
      'Unlike traditional store builders, LetBuyy is designed to run the entire commerce business, not just the online store.',
    ],
  },
  {
    q: 'How is LetBuyy different from Shopify?',
    a: [
      'Shopify primarily focuses on storefront creation and app integrations.',
      'LetBuyy combines storefronts, inventory, orders, payments, customer management, analytics, automation, AI assistance, and business operations into a single unified platform.',
      'Instead of connecting multiple tools, merchants manage everything from one operating system.',
    ],
  },
  {
    q: 'Can I use my own custom domain?',
    a: [
      'Yes.',
      'You can connect your own custom domain such as yourstore.com or use a free LetBuyy subdomain while getting started.',
      'Custom domains are available on eligible plans and can be connected in just a few steps.',
    ],
  },
  {
    q: 'Which payment methods does LetBuyy support?',
    a: [
      'A merchant can enable cash on delivery. Online methods such as UPI, cards, net banking, and wallets depend on the merchant connecting their own Razorpay account and the methods Razorpay approves for that account.',
      'GST-registered merchants can issue invoices from recorded order tax facts. Private business document upload is available after secure storage is configured; live KYC and payout eligibility also require provider approval.',
    ],
  },
  {
    q: 'Can I migrate from Shopify, WooCommerce, or another platform?',
    a: [
      'Yes.',
      'You can import products, collections, customers, and other business data into LetBuyy.',
      'Migration tools are designed to help merchants move without rebuilding their entire business from scratch.',
    ],
  },
  {
    q: 'Is LetBuyy suitable for growing businesses?',
    a: [
      'Absolutely.',
      "Whether you're launching your first store or managing multiple brands, LetBuyy scales with your business through advanced inventory management, automation, analytics, multi-store operations, and AI-powered commerce tools.",
    ],
  },
  {
    q: 'Do you charge transaction commissions?',
    a: [
      'No.',
      'LetBuyy charges a transparent subscription fee.',
      'Your revenue belongs to your business, not your platform provider.',
      'We believe merchants should keep what they earn instead of paying a percentage on every sale.',
    ],
  },
  {
    q: 'What happens after my free trial ends?',
    a: [
      'After your trial, you can choose the plan that best fits your business.',
      'If you joined through a Founder Pricing program, your discounted rate remains locked for life as long as your subscription remains active without interruption.',
      'If the subscription lapses or is cancelled, standard pricing will apply when reactivating.',
    ],
  },
  {
    q: 'Who owns my store data?',
    a: [
      'You do.',
      'Your products, customers, orders, content, and business data remain yours at all times.',
      'LetBuyy provides the infrastructure and tools to operate your commerce business, but you retain ownership and control of your data.',
      'Business data can be exported whenever needed.',
    ],
  },
]

export default function FAQ() {
    const { t } = useCopy()
  const [openItems, setOpenItems] = useState<Set<number>>(() => new Set([0]))
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { once: true, margin: '-60px' })
  const isReduced = useReducedMotion()

  const dur = (n: number) => isReduced ? 0 : n

  function toggleItem(index: number) {
    setOpenItems(previous => {
      const next = new Set(previous)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  return (
    <section className="faq" id="faq" aria-labelledby="faq-heading">
      <div className="container">

        {/* Section header */}
        <motion.div
          className="faq-header"
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: dur(0.6) }}
        >
          <p className="section-label"><Copy text={"Frequently Asked Questions"} /></p>
          <h2 id="faq-heading" className="section-title">
            <Copy text={"Everything you need to know before launching"} /></h2>
          <p className="section-subtitle" style={{ maxWidth: 640, margin: '16px auto 0' }}>
            <Copy text={"Answers to the most common questions about pricing, migration, payments, data ownership, and how LetBuyy compares to traditional commerce platforms."} /></p>
        </motion.div>

        {/* Two-column body */}
        <div ref={ref} className="faq-inner">

          {/* Left — trust panel */}
          <motion.aside
            className="faq-trust"
            aria-labelledby="faq-trust-heading"
            initial={{ opacity: 0, x: -16 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: dur(0.5), delay: dur(0.1) }}
          >
            <div className="faq-trust-card" id="faq-benefits">
              <div className="faq-trust-content">
                <div className="faq-trust-header">
                  <MarketingIllustration artwork="support" className="marketing-illustration--faq" sizes="128px" />
                  <h3 className="faq-trust-title" id="faq-trust-heading"><Copy text={"Built for modern commerce"} /></h3>
                </div>

                <ul className="faq-trust-list">
                  {TRUST_ITEMS.map(item => (
                    <li key={item} className="faq-trust-item">
                      <span className="faq-trust-check" aria-hidden="true"><Check width={16} height={16} strokeWidth={1.8} /></span>
                      <Copy text={item} />
                    </li>
                  ))}
                </ul>
              </div>

              <dl className="faq-metrics" aria-label={t("Platform highlights")}>
                {METRICS.map(m => (
                  <div key={m.label} className="faq-metric">
                    <dt className="faq-metric-lbl"><Copy text={m.label} /></dt>
                    <dd className="faq-metric-val">{m.val}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </motion.aside>

          {/* Right — accordion */}
          <motion.div
            className="faq-accordion"
            initial={{ opacity: 0, x: 16 }}
            animate={inView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: dur(0.5), delay: dur(0.18) }}
          >
            {FAQS.map((faq, i) => {
              const isOpen = openItems.has(i)
              return (
                <div
                  key={i}
                  className={`faq-item${isOpen ? ' faq-item-open' : ''}`}
                >
                  <h3 className="faq-question-heading">
                    <Button
                      unstyled
                      type="button"
                      className="faq-question"
                      aria-expanded={isOpen}
                      aria-controls={`faq-answer-${i}`}
                      id={`faq-btn-${i}`}
                      onClick={() => toggleItem(i)}
                    >
                      <span className="faq-q-text"><Copy text={faq.q} /></span>
                      <span className="faq-toggle-icon" aria-hidden="true">
                        {isOpen ? <Minus width={20} height={20} strokeWidth={1.5} /> : <Plus width={20} height={20} strokeWidth={1.5} />}
                      </span>
                    </Button>
                  </h3>

                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        id={`faq-answer-${i}`}
                        className="faq-answer"
                        role="region"
                        aria-labelledby={`faq-btn-${i}`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: dur(0.22), ease: [0.4, 0, 0.2, 1] }}
                      >
                        <div className="faq-answer-inner">
                          {faq.a.map((para, pi) => (
                            <p key={pi}><Copy text={para} /></p>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </motion.div>
        </div>
      </div>
    </section>
  )
}
