'use client'

import { useId, useState } from 'react'
import { Button, Input } from '@letbuyy/ui'
import { openNewsletterModal } from './NewsletterModal'

/**
 * Inline capture for the resources newsletter band. Subscribing is a single
 * action here; refining topics is an optional second step that hands off to
 * the full dialog.
 */
export default function NewsletterInline() {
    const [email, setEmail] = useState('')
    const [done, setDone] = useState(false)
    const fieldId = useId()

    if (done) {
        return (
            <div className="nlx-done" role="status">
                <span className="nlx-done-mark" aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                </span>
                <span className="nlx-done-text">
                    Subscribed — first digest lands Tuesday.
                </span>
                <Button unstyled type="button" className="nlx-link" onClick={openNewsletterModal}>
                    Choose your topics
                </Button>
            </div>
        )
    }

    return (
        <form
            className="nlx-form"
            onSubmit={e => {
                e.preventDefault()
                setDone(true)
            }}
        >
            <label className="nlx-sr" htmlFor={fieldId}>
                Email address
            </label>

            {/* Input and action share one shell so it reads as a single control */}
            <div className="nlx-field">
                <svg className="nlx-field-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                    <polyline points="22,6 12,13 2,6" />
                </svg>

                <Input
                    unstyled
                    id={fieldId}
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="you@store.com"
                    className="nlx-input"
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                />

                <Button unstyled type="submit" className="nlx-submit">
                    Subscribe
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                    </svg>
                </Button>
            </div>

            <p className="nlx-fine">
                No spam · Unsubscribe anytime ·{' '}
                <Button unstyled type="button" className="nlx-link" onClick={openNewsletterModal}>
                    Choose your topics
                </Button>
            </p>
        </form>
    )
}
