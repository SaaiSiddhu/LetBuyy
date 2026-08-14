'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button, Input } from '@letbuyy/ui'
import { LETBUYY_PRODUCTION_API_BASE_URL, resolveLetbuyyApiBaseUrl } from '@letbuyy/api-client'

/**
 * Two-factor ticket lookup.
 *
 * A ticket reference is sequential and therefore guessable by design — it has
 * to be, because people read them out on phone calls. The email address is the
 * second factor, and the gateway answers identically for "no such reference"
 * and "wrong email" so this box cannot be used to discover which references
 * exist.
 *
 * It opens automatically when the confirmation email links back with
 * `?ticket=`, which is the only reason that link is worth sending.
 */

interface TicketStatus {
    ticket_ref: string
    status: string
    subject_line: string
    team: string
    response_hours: number
    submitted_at: string
    first_response_due_at: string | null
    responded_at: string | null
    resolved_at: string | null
}

const STATUS_COPY: Record<string, { label: string; note: string }> = {
    new: { label: 'Received', note: 'In the queue and assigned to a team.' },
    triaged: { label: 'Triaged', note: 'Read and routed to the person who will answer.' },
    in_progress: { label: 'Being worked on', note: 'Someone is actively on this.' },
    waiting_on_customer: { label: 'Waiting on you', note: 'We replied and need something back.' },
    resolved: { label: 'Resolved', note: 'Answered. Reply to the email if it is not sorted.' },
    closed: { label: 'Closed', note: 'This ticket is finished.' },
    spam: { label: 'Closed', note: 'This ticket is finished.' },
import { formatIndiaDateWithTime } from '@letbuyy/ui/formatting'

function gatewayBaseUrl(): string {
    return resolveLetbuyyApiBaseUrl([process.env.NEXT_PUBLIC_API_URL], {
        fallback: LETBUYY_PRODUCTION_API_BASE_URL,
    })
}

export default function TicketLookup() {
    const [open, setOpen] = useState(false)
    const [ticketRef, setTicketRef] = useState('')
    const [email, setEmail] = useState('')
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [status, setStatus] = useState<TicketStatus | null>(null)

    /* Read the query param in an effect rather than during render: the page is
       statically prerendered per locale, so the URL is not known at build time
       and touching it in render would be a hydration mismatch. */
    useEffect(() => {
        const param = new URLSearchParams(window.location.search).get('ticket')
        if (param) {
            setTicketRef(param.trim().toUpperCase().slice(0, 32))
            setOpen(true)
        }
    }, [])

    const lookup = useCallback(async () => {
        if (!ticketRef.trim() || !email.trim()) {
            setError('Enter both your ticket reference and the email you used.')
            return
        }
        setLoading(true)
        setError(null)
        setStatus(null)

        try {
            /* POST, not GET: the email address is personal data and must not
               end up in a URL, a proxy log or a Referer header. */
            const response = await fetch(`${gatewayBaseUrl()}/contact-requests/status`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ ticket_ref: ticketRef.trim(), email: email.trim() }),
            })
            const body = (await response.json()) as {
                success?: boolean
                data?: TicketStatus
                error?: { message?: string }
            }

            if (!response.ok || !body.success || !body.data) {
                setError(body.error?.message || 'No ticket matches that reference and email.')
                return
            }
            setStatus(body.data)
        } catch {
            setError('We could not reach our servers. Please try again in a moment.')
        } finally {
            setLoading(false)
        }
    }, [email, ticketRef])

    const copy = status ? (STATUS_COPY[status.status] ?? STATUS_COPY.new) : null

    return (
        <div className={`ctc-lookup${open ? ' is-open' : ''}`}>
            <Button
                unstyled
                type="button"
                className="ctc-lookup-toggle"
                aria-expanded={open}
                onClick={() => setOpen((current) => !current)}
            >
                <span>Already have a ticket reference?</span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="m6 9 6 6 6-6" />
                </svg>
            </Button>

            {open && (
                <div className="ctc-lookup-body">
                    <div className="ctc-lookup-fields">
                        <div className="ctc-field">
                            <label className="ctc-label" htmlFor="ctc-lookup-ref">
                                Ticket reference
                            </label>
                            <Input
                                unstyled
                                id="ctc-lookup-ref"
                                className="ctc-input ctc-mono"
                                value={ticketRef}
                                maxLength={32}
                                placeholder="LB-2608-000142"
                                onChange={(e) => setTicketRef(e.target.value.toUpperCase())}
                            />
                        </div>
                        <div className="ctc-field">
                            <label className="ctc-label" htmlFor="ctc-lookup-email">
                                Email you used
                            </label>
                            <Input
                                unstyled
                                id="ctc-lookup-email"
                                type="email"
                                inputMode="email"
                                className="ctc-input"
                                value={email}
                                maxLength={254}
                                placeholder="you@yourbrand.in"
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <Button
                            unstyled
                            type="button"
                            className="ctc-btn ctc-btn-primary ctc-lookup-go"
                            onClick={lookup}
                            disabled={loading}
                        >
                            {loading ? 'Checking…' : 'Check status'}
                        </Button>
                    </div>

                    {error && (
                        <p className="ctc-alert" role="alert">
                            {error}
                        </p>
                    )}

                    {status && copy && (
                        <div className="ctc-lookup-result">
                            <div className="ctc-lookup-head">
                                <span className="ctc-lookup-ref">{status.ticket_ref}</span>
                                <span className={`ctc-lookup-badge is-${status.status}`}>
                                    {copy.label}
                                </span>
                            </div>
                            <p className="ctc-lookup-subject">{status.subject_line}</p>
                            <p className="ctc-lookup-note">{copy.note}</p>
                            <dl className="ctc-lookup-facts">
                                <div>
                                    <dt>Submitted</dt>
                                    <dd>{status.submitted_at ? formatIndiaDateWithTime(status.submitted_at) : '—'}</dd>
                                </div>
                                <div>
                                    <dt>Reply due</dt>
                                    <dd>{status.first_response_due_at ? formatIndiaDateWithTime(status.first_response_due_at) : '—'}</dd>
                                </div>
                                <div>
                                    <dt>First replied</dt>
                                    <dd>{status.responded_at ? formatIndiaDateWithTime(status.responded_at) : '—'}</dd>
                                </div>
                            </dl>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
