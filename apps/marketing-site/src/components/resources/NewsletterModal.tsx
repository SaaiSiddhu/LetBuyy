'use client'

import { useCallback, useEffect, useId, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button, Input } from '@letbuyy/ui'
import { CATEGORIES } from '@/lib/resources/categories'

const OPEN_EVENT = 'letbuyy:newsletter-open'

/** Opens the newsletter dialog from anywhere, including server-rendered pages. */
export function openNewsletterModal(): void {
    window.dispatchEvent(new CustomEvent(OPEN_EVENT))
}

const FREQUENCIES = [
    { id: 'weekly', label: 'Weekly digest', hint: 'Every Tuesday morning' },
    { id: 'instant', label: 'As it publishes', hint: 'One email per new guide' },
]

/** Button that opens the dialog — use in place of a link to the old page. */
export function SubscribeButton({
    className,
    children,
}: {
    className?: string
    children: React.ReactNode
}) {
    return (
        <Button unstyled type="button" className={className} onClick={openNewsletterModal}>
            {children}
        </Button>
    )
}

export default function NewsletterModalHost() {
    const [open, setOpen] = useState(false)
    const [email, setEmail] = useState('')
    const [frequency, setFrequency] = useState('weekly')
    const [topics, setTopics] = useState<string[]>(CATEGORIES.map(c => c.slug))
    const [submitted, setSubmitted] = useState(false)
    const panelRef = useRef<HTMLDivElement>(null)
    const titleId = useId()

    const close = useCallback(() => setOpen(false), [])

    useEffect(() => {
        const onOpen = () => {
            setSubmitted(false)
            setOpen(true)
        }
        window.addEventListener(OPEN_EVENT, onOpen)
        return () => window.removeEventListener(OPEN_EVENT, onOpen)
    }, [])

    // Escape to dismiss, and hold the page still while the dialog is up.
    useEffect(() => {
        if (!open) return
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') close()
        }
        const previousOverflow = document.body.style.overflow
        document.body.style.overflow = 'hidden'
        window.addEventListener('keydown', onKey)
        panelRef.current?.focus()
        return () => {
            document.body.style.overflow = previousOverflow
            window.removeEventListener('keydown', onKey)
        }
    }, [open, close])

    const toggleTopic = (slug: string) =>
        setTopics(prev => (prev.includes(slug) ? prev.filter(s => s !== slug) : [...prev, slug]))

    const allSelected = topics.length === CATEGORIES.length

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    className="nl-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    onClick={close}
                >
                    <motion.div
                        ref={panelRef}
                        className="nl-panel"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby={titleId}
                        tabIndex={-1}
                        initial={{ opacity: 0, y: 18, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 12, scale: 0.985 }}
                        transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
                        onClick={e => e.stopPropagation()}
                    >
                        <Button unstyled type="button" className="nl-close" onClick={close} aria-label="Close">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                <path d="M18 6 6 18M6 6l12 12" />
                            </svg>
                        </Button>

                        {submitted ? (
                            <div className="nl-done">
                                <div className="nl-done-mark" aria-hidden="true">
                                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </div>
                                <h2 id={titleId} className="nl-title">You&apos;re in</h2>
                                <p className="nl-sub">
                                    The first digest lands in <strong>{email}</strong> on Tuesday.
                                </p>
                                <Button unstyled type="button" className="nl-submit" onClick={close}>
                                    Back to reading
                                </Button>
                            </div>
                        ) : (
                            <>
                                <p className="nl-eyebrow">Newsletter</p>
                                <h2 id={titleId} className="nl-title">Stay ahead in Indian commerce</h2>
                                <p className="nl-sub">
                                    Join 35,000+ merchants. Practical guides, no fluff.
                                </p>

                                <form
                                    className="nl-form"
                                    onSubmit={e => {
                                        e.preventDefault()
                                        setSubmitted(true)
                                    }}
                                >
                                    <label className="nl-label" htmlFor={`${titleId}-email`}>
                                        Email address
                                    </label>
                                    <Input
                                        unstyled
                                        id={`${titleId}-email`}
                                        type="email"
                                        required
                                        autoComplete="email"
                                        placeholder="you@store.com"
                                        className="nl-input"
                                        value={email}
                                        onChange={e => setEmail(e.target.value)}
                                    />

                                    <p className="nl-label nl-label-spaced">How often?</p>
                                    <div className="nl-segment" role="radiogroup" aria-label="Email frequency">
                                        {FREQUENCIES.map(f => (
                                            <Button
                                                unstyled
                                                key={f.id}
                                                type="button"
                                                role="radio"
                                                aria-checked={frequency === f.id}
                                                className={`nl-segment-option${frequency === f.id ? ' is-active' : ''}`}
                                                onClick={() => setFrequency(f.id)}
                                            >
                                                <span className="nl-segment-label">{f.label}</span>
                                                <span className="nl-segment-hint">{f.hint}</span>
                                            </Button>
                                        ))}
                                    </div>

                                    <div className="nl-topics-head">
                                        <p className="nl-label">Topics</p>
                                        <Button
                                            unstyled
                                            type="button"
                                            className="nl-select-all"
                                            onClick={() => setTopics(allSelected ? [] : CATEGORIES.map(c => c.slug))}
                                        >
                                            {allSelected ? 'Clear all' : 'Select all'}
                                        </Button>
                                    </div>
                                    <div className="nl-topics">
                                        {CATEGORIES.map(cat => {
                                            const on = topics.includes(cat.slug)
                                            return (
                                                <Button
                                                    unstyled
                                                    key={cat.slug}
                                                    type="button"
                                                    role="checkbox"
                                                    aria-checked={on}
                                                    className={`nl-topic${on ? ' is-on' : ''}`}
                                                    onClick={() => toggleTopic(cat.slug)}
                                                >
                                                    <span
                                                        className="nl-topic-box"
                                                        style={on ? { background: cat.color, borderColor: cat.color } : undefined}
                                                        aria-hidden="true"
                                                    >
                                                        {on && (
                                                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round">
                                                                <polyline points="20 6 9 17 4 12" />
                                                            </svg>
                                                        )}
                                                    </span>
                                                    {cat.label}
                                                </Button>
                                            )
                                        })}
                                    </div>

                                    <Button unstyled type="submit" className="nl-submit">
                                        Subscribe — it&apos;s free
                                    </Button>
                                    <p className="nl-fine">No spam. Unsubscribe anytime.</p>
                                </form>
                            </>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    )
}
