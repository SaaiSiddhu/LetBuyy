'use client'

import Copy from '@/components/i18n/Copy'
import { useCopy } from '@/components/i18n/useCopy'
import { formatResponseTime } from '@/lib/i18n/response-time'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Button, Checkbox, Input, Select, Textarea } from '@letbuyy/ui'
import { LETBUYY_PRODUCTION_API_BASE_URL, resolveLetbuyyApiBaseUrl } from '@letbuyy/api-client'
import {
    CONTACT_BUSINESS_TYPES,
    CONTACT_CHANNELS,
    CONTACT_CURRENT_CHANNELS,
    CONTACT_GMV_BANDS,
    CONTACT_HEARD_ABOUT,
    CONTACT_LANGUAGES,
    CONTACT_LIMITS,
    CONTACT_ORDER_BANDS,
    CONTACT_RELATIONSHIPS,
    CONTACT_TIMELINES,
    CONTACT_TIME_WINDOWS,
    CONTACT_TOPICS,
    CONTACT_URGENCIES,
    INDIA_STATES,
    getContactTopic,
    resolveContactResponseHours,
    type ContactRequestReceipt,
} from '@letbuyy/shared-types'
import LocaleLink from '@/components/i18n/LocaleLink'
import TurnstileWidget, { type TurnstileHandle } from './TurnstileWidget'

/**
 * The public contact form.
 *
 * Four steps rather than one long page, for a reason that is not decoration:
 * the form asks for a lot, and everything past step two is CONDITIONAL on the
 * topic. Someone reporting a down store is never shown a budget question, and
 * someone asking about pricing is never shown an order reference. A single
 * scroll would either ask everyone everything or hide fields mid-page while
 * they read.
 *
 * The catalog driving every dropdown, and the response promise shown on the
 * last step, come from @letbuyy/shared-types — the same module the gateway
 * validates against. There is no second copy of the topic list to drift.
 */

type FormValues = {
    relationship: string
    full_name: string
    email: string
    phone_country_code: string
    phone: string
    company_name: string
    website_url: string
    store_subdomain: string
    gstin: string
    city: string
    state: string

    business_type: string
    current_channel: string
    monthly_orders: string
    monthly_gmv_band: string
    interested_plan: string
    timeline: string

    topic: string
    subject_id: string
    subject_text: string
    message: string
    urgency: string
    order_reference: string

    preferred_channel: string
    preferred_language: string
    preferred_time_window: string

    heard_about_us: string
    consent_privacy: boolean
    consent_marketing: boolean
}

const INITIAL: FormValues = {
    relationship: 'prospect',
    full_name: '',
    email: '',
    phone_country_code: '+91',
    phone: '',
    company_name: '',
    website_url: '',
    store_subdomain: '',
    gstin: '',
    city: '',
    state: '',

    business_type: '',
    current_channel: '',
    monthly_orders: '',
    monthly_gmv_band: '',
    interested_plan: '',
    timeline: '',

    topic: '',
    subject_id: '',
    subject_text: '',
    message: '',
    urgency: 'normal',
    order_reference: '',

    preferred_channel: 'email',
    preferred_language: 'en',
    preferred_time_window: 'any',

    heard_about_us: '',
    consent_privacy: false,
    consent_marketing: false,
}

const STEPS = [
    { id: 1, label: 'About you', hint: 'Who we are talking to' },
    { id: 2, label: 'Your enquiry', hint: 'What you need from us' },
    { id: 3, label: 'Context', hint: 'Helps us answer properly' },
    { id: 4, label: 'Send', hint: 'How to reach you back' },
] as const

/* India first, then the codes our merchants actually sell into. A full ITU list
   is 240 entries of noise for a market that is 99% one code. */
const DIAL_CODES = ['+91', '+1', '+44', '+61', '+65', '+971', '+60', '+49', '+33'] as const

const PLAN_OPTIONS = ['Launch', 'Growth', 'Scale', 'Commerce OS', 'Not sure yet'] as const

/**
 * The form posts the gateway directly rather than through a Next route.
 *
 * App-local API routes are frozen — backend behaviour belongs in
 * services/api-gateway — and the gateway endpoint is mounted before the auth
 * middleware precisely so a browser can reach it. Calling it straight also
 * means Cloudflare sets `cf-connecting-ip` from the real client, which is what
 * the rate limit and the stored ip_hash depend on; a proxy hop would hand the
 * gateway this server's address instead.
 */
function gatewayBaseUrl(): string {
    return resolveLetbuyyApiBaseUrl([process.env.NEXT_PUBLIC_API_URL], {
        fallback: LETBUYY_PRODUCTION_API_BASE_URL,
    })
}

function toOptions(values: readonly string[], t: (text: string) => string) {
    return values.map((value) => ({ value, label: t(value) }))
}

function idOptions(values: readonly { id: string; label: string }[], t: (text: string) => string) {
    return values.map((entry) => ({ value: entry.id, label: t(entry.label) }))
}

/**
 * Where focus goes when a field fails validation, and in what order.
 *
 * The order is the visual one, so "first error" means the first one a sighted
 * user would reach too. `topic` points at the first topic card because the
 * control is a grid of buttons rather than a single input.
 */
const FIELD_CONTROL_IDS: Record<string, string> = {
    full_name: 'ctc-name',
    email: 'ctc-email',
    phone: 'ctc-phone',
    website_url: 'ctc-website',
    topic: 'ctc-topic-first',
    subject_id: 'ctc-subject',
    subject_text: 'ctc-subject-text',
    message: 'ctc-message',
    consent_privacy: 'ctc-consent-privacy',
}

const FIELD_ORDER: Array<keyof FormValues> = [
    'full_name',
    'email',
    'phone',
    'website_url',
    'topic',
    'subject_id',
    'subject_text',
    'message',
    'consent_privacy',
]

const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
/* Six digits is the shortest real national number; the cap matches the schema.
   Deliberately permissive about spaces, dashes and brackets — rejecting a
   number because someone typed it the way it is printed on their card is a
   self-inflicted lost lead. */
const PHONE_SHAPE = /^[\d\s()+-]{6,24}$/

export default function ContactForm() {
    const { t, locale } = useCopy()
    const [step, setStep] = useState(1)
    const [values, setValues] = useState<FormValues>(() => ({ ...INITIAL, preferred_language: locale.language.code }))
    const [errors, setErrors] = useState<Partial<Record<keyof FormValues, string>>>({})
    const [submitting, setSubmitting] = useState(false)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const [receipt, setReceipt] = useState<ContactRequestReceipt | null>(null)
    const [copied, setCopied] = useState(false)
    const [turnstileToken, setTurnstileToken] = useState('')

    const turnstileRef = useRef<TurnstileHandle>(null)
    /* One token for the life of this form. A retry after a network blip MUST
       reuse it — that is what makes the gateway return the first ticket instead
       of opening a second one. Generated in an effect rather than during
       render, so the component stays pure. */
    const clientTokenRef = useRef<string>('')
    const headingRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!clientTokenRef.current) {
            clientTokenRef.current =
                typeof crypto !== 'undefined' && 'randomUUID' in crypto
                    ? crypto.randomUUID()
                    : `lb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`
        }
    }, [])

    const topic = useMemo(() => getContactTopic(values.topic), [values.topic])
    const reveals = useMemo(() => new Set(topic?.reveals ?? []), [topic])
    const isMerchant = values.relationship === 'merchant'
    const responseHours = useMemo(
        () => resolveContactResponseHours(values.topic, values.urgency),
        [values.topic, values.urgency],
    )

    const set = useCallback(<K extends keyof FormValues>(key: K, value: FormValues[K]) => {
        setValues((current) => ({ ...current, [key]: value }))
        setErrors((current) => (current[key] ? { ...current, [key]: undefined } : current))
    }, [])

    /* Changing the topic invalidates the subject beneath it — leaving a stale
       id would post a subject that does not belong to the chosen topic, which
       the gateway rejects and the person cannot see. */
    const chooseTopic = useCallback((topicId: string) => {
        setValues((current) => ({
            ...current,
            topic: topicId,
            subject_id: '',
            subject_text: '',
        }))
        setErrors((current) => ({ ...current, topic: undefined, subject_id: undefined }))
    }, [])

    /** Returns the errors it found, or null when the step is clean. */
    const validateStep = useCallback(
        (target: number): Partial<Record<keyof FormValues, string>> | null => {
            const next: Partial<Record<keyof FormValues, string>> = {}

            if (target === 1) {
                if (values.full_name.trim().length < 2) next.full_name = 'Please tell us your name'
                if (!EMAIL_SHAPE.test(values.email.trim())) {
                    next.email = 'That email address does not look right'
                }
                if (!PHONE_SHAPE.test(values.phone.trim())) {
                    next.phone = 'Add a number we can reach you on'
                }
                if (values.website_url.trim() && !/^https?:\/\/|^[\w-]+\./.test(values.website_url.trim())) {
                    next.website_url = 'Use a full address, like letbuyy.com'
                }
            }

            if (target === 2) {
                if (!values.topic) next.topic = 'Choose what your message is about'
                if (!values.subject_id) next.subject_id = 'Choose a subject'
                if (values.subject_id === 'other' && !values.subject_text.trim()) {
                    next.subject_text = 'Add a short subject line'
                }
                if (values.message.trim().length < CONTACT_LIMITS.messageMin) {
                    next.message = t('A little more detail helps — at least {count} characters', { count: CONTACT_LIMITS.messageMin })
                }
            }

            if (target === 4 && !values.consent_privacy) {
                next.consent_privacy = 'Please accept the privacy notice so we can reply'
            }

            setErrors(next)
            return Object.keys(next).length ? next : null
        },
        [values, t],
    )

    const goTo = useCallback(
        (target: number) => {
            setStep(target)
            setSubmitError(null)
            /* Move focus to the new step's heading. Without this a keyboard or
               screen-reader user lands back at the top of the document on every
               step change and has to re-navigate the whole page. */
            window.setTimeout(() => headingRef.current?.focus(), 0)
        },
        [],
    )

    /**
     * Move focus to the first thing that is now wrong.
     *
     * Without this a failed Continue is completely silent to a screen reader:
     * the button keeps focus, the step does not change, and the new error text
     * sits above with nothing pointing at it. Focusing the control makes its
     * aria-describedby error the next thing announced, which is what turns a
     * dead end into a correctable one.
     */
    const focusFirstError = useCallback(
        (failed: Partial<Record<keyof FormValues, string>>) => {
            const target = FIELD_ORDER.find((field) => failed[field])
            const controlId = target ? FIELD_CONTROL_IDS[target] : undefined
            if (!controlId) return

            /* setTimeout, not requestAnimationFrame: rAF does not fire while the
               document is hidden, so a background tab — or a browser that
               throttles it — would silently skip the focus move and leave the
               error unannounced. A zero timeout still lands after React has
               flushed the error state, which is all this needs. */
            window.setTimeout(() => {
                const element = document.getElementById(controlId)
                if (!element) return
                element.focus({ preventScroll: true })
                element.scrollIntoView({ block: 'center', behavior: 'smooth' })
            }, 0)
        },
        [],
    )

    const next = useCallback(() => {
        const failed = validateStep(step)
        if (failed) {
            focusFirstError(failed)
            return
        }
        goTo(Math.min(STEPS.length, step + 1))
    }, [focusFirstError, goTo, step, validateStep])

    const back = useCallback(() => goTo(Math.max(1, step - 1)), [goTo, step])

    const submit = useCallback(async () => {
        // Re-run every gate, not just the last step: someone can reach step 4
        // and then edit a previous one via the rail.
        for (const target of [1, 2, 4]) {
            const failed = validateStep(target)
            if (failed) {
                goTo(target)
                focusFirstError(failed)
                return
            }
        }

        setSubmitting(true)
        setSubmitError(null)

        const payload = {
            ...values,
            phone: values.phone.trim(),
            email: values.email.trim().toLowerCase(),
            // Empty strings are "not answered", and the schema wants them gone.
            ...Object.fromEntries(
                (
                    [
                        'company_name',
                        'website_url',
                        'store_subdomain',
                        'gstin',
                        'city',
                        'state',
                        'business_type',
                        'current_channel',
                        'monthly_orders',
                        'monthly_gmv_band',
                        'interested_plan',
                        'timeline',
                        'subject_text',
                        'order_reference',
                        'heard_about_us',
                    ] as const
                ).map((key) => [key, values[key].trim() || undefined]),
            ),
            client_token: clientTokenRef.current,
            turnstile_token: turnstileToken,
            locale: document.documentElement.lang || 'en',
            source_path: window.location.pathname,
            referrer: document.referrer || undefined,
            utm: Object.fromEntries(
                Array.from(new URLSearchParams(window.location.search).entries())
                    .filter(([key]) => key.startsWith('utm_') || key === 'gclid' || key === 'ref')
                    .slice(0, 12)
                    .map(([key, value]) => [key, value.slice(0, 200)]),
            ),
        }

        try {
            const response = await fetch(`${gatewayBaseUrl()}/contact-requests`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(payload),
            })
            const body = (await response.json()) as {
                success?: boolean
                data?: ContactRequestReceipt
                error?: { message?: string }
            }

            if (!response.ok || !body.success || !body.data) {
                setSubmitError(body.error?.message || 'We could not send that. Please try again.')
                // A used token cannot be replayed, so a retry needs a fresh one.
                turnstileRef.current?.reset()
                return
            }

            setReceipt(body.data)
            window.setTimeout(() => headingRef.current?.focus(), 0)
        } catch {
            setSubmitError('We could not reach our servers. Please try again in a moment.')
            turnstileRef.current?.reset()
        } finally {
            setSubmitting(false)
        }
    }, [focusFirstError, goTo, turnstileToken, validateStep, values])

    const copyTicket = useCallback(async () => {
        if (!receipt) return
        try {
            await navigator.clipboard.writeText(receipt.ticket_ref)
            setCopied(true)
            window.setTimeout(() => setCopied(false), 2200)
        } catch {
            // Clipboard is permission-gated; the reference is on screen anyway.
        }
    }, [receipt])

    /* ─── Success ─────────────────────────────────────────────────────────── */

    if (receipt) {
        /* Shared with the acknowledgement email, so the screen and the inbox
           cannot phrase the same promise two different ways. */
        const phrase = formatResponseTime(receipt.response_hours, locale.language.code)

        return (
            <div className="ctc-panel ctc-success" ref={headingRef} tabIndex={-1}>
                <span className="ctc-success-mark" aria-hidden="true">
                    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 6 9 17l-5-5" />
                    </svg>
                </span>

                <h2 className="ctc-success-title">
                    {t(receipt.duplicate ? 'You already sent this one' : 'Message received')}
                </h2>
                <p className="ctc-success-note">
                    {receipt.duplicate
                        ? t('We had this message already, so nothing was sent twice. Here is the ticket it went to.')
                        : t('A person from our team will reply {time}. A copy of everything is on its way to your inbox.', { time: phrase })}
                </p>

                <div className="ctc-ticket">
                    <span className="ctc-ticket-label"><Copy text={"Your ticket reference"} /></span>
                    <span className="ctc-ticket-ref">{receipt.ticket_ref}</span>
                    <Button
                        unstyled
                        type="button"
                        onClick={copyTicket}
                        className="ctc-ticket-copy"
                        aria-label={`Copy ticket reference ${receipt.ticket_ref}`}
                    >
                        {t(copied ? 'Copied' : 'Copy')}
                    </Button>
                </div>

                <dl className="ctc-success-facts">
                    <div>
                        <dt><Copy text={"Subject"} /></dt>
                        <dd>{receipt.subject_line}</dd>
                    </div>
                    <div>
                        <dt><Copy text={"First reply"} /></dt>
                        <dd>{phrase}</dd>
                    </div>
                </dl>

                <p className="ctc-success-fine">
                    <Copy text={"Keep the reference handy. Replying to the confirmation email adds to the same ticket — no need to fill this in again."} /></p>
            </div>
        )
    }

    /* ─── Form ────────────────────────────────────────────────────────────── */

    const subjectOptions = topic ? topic.subjects.map((s) => ({ value: s.id, label: t(s.label) })) : []
    const messageLeft = CONTACT_LIMITS.message - values.message.length

    return (
        <div className="ctc-panel">
            {/* Progress rail. Completed steps are navigable so nobody has to
                click Back four times to fix a typo in their name. */}
            <ol className="ctc-rail" aria-label={t("Form progress")}>
                {STEPS.map((entry) => {
                    const state = entry.id === step ? 'current' : entry.id < step ? 'done' : 'todo'
                    return (
                        <li key={entry.id} className={`ctc-rail-item is-${state}`}>
                            <Button
                                unstyled
                                type="button"
                                className="ctc-rail-btn"
                                disabled={entry.id > step}
                                onClick={() => entry.id < step && goTo(entry.id)}
                                aria-current={entry.id === step ? 'step' : undefined}
                            >
                                <span className="ctc-rail-dot" aria-hidden="true">
                                    {entry.id < step ? (
                                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M20 6 9 17l-5-5" />
                                        </svg>
                                    ) : (
                                        entry.id
                                    )}
                                </span>
                                <span className="ctc-rail-text">
                                    <span className="ctc-rail-label">{t(entry.label)}</span>
                                    <span className="ctc-rail-hint">{t(entry.hint)}</span>
                                </span>
                            </Button>
                        </li>
                    )
                })}
            </ol>

            <div className="ctc-step" ref={headingRef} tabIndex={-1}>
                {/* ── Step 1 ─────────────────────────────────────────────── */}
                {step === 1 && (
                    <>
                        <h2 className="ctc-step-title"><Copy text={"Who are we talking to?"} /></h2>
                        <p className="ctc-step-sub">
                            <Copy text={"We answer in English, Hindi and Tamil. Nothing here is shared outside LetBuyy."} /></p>

                        <fieldset className="ctc-field ctc-fieldset">
                            <legend className="ctc-label"><Copy text={"Which best describes you?"} /></legend>
                            <div className="ctc-chips">
                                {CONTACT_RELATIONSHIPS.map((entry) => (
                                    <Button
                                        unstyled
                                        key={entry.id}
                                        type="button"
                                        className={`ctc-chip${values.relationship === entry.id ? ' is-on' : ''}`}
                                        aria-pressed={values.relationship === entry.id}
                                        onClick={() => set('relationship', entry.id)}
                                    >
                                        {t(entry.label)}
                                    </Button>
                                ))}
                            </div>
                        </fieldset>

                        <div className="ctc-grid-2">
                            <div className="ctc-field">
                                <label className="ctc-label" htmlFor="ctc-name">
                                    <Copy text={"Full name"} />{' '}<span className="ctc-req">*</span>
                                </label>
                                <Input
                                    unstyled
                                    id="ctc-name"
                                    className={`ctc-input${errors.full_name ? ' is-bad' : ''}`}
                                    value={values.full_name}
                                    maxLength={CONTACT_LIMITS.name}
                                    autoComplete="name"
                                    placeholder="Priya Raman"
                                    onChange={(e) => set('full_name', e.target.value)}
                                    aria-invalid={Boolean(errors.full_name)}
                                    aria-describedby={errors.full_name ? 'ctc-name-err' : undefined}
                                />
                                {errors.full_name && (
                                    <p className="ctc-err" id="ctc-name-err">{t(errors.full_name ?? '')}</p>
                                )}
                            </div>

                            <div className="ctc-field">
                                <label className="ctc-label" htmlFor="ctc-email">
                                    <Copy text={"Email"} />{' '}<span className="ctc-req">*</span>
                                </label>
                                <Input
                                    unstyled
                                    id="ctc-email"
                                    type="email"
                                    inputMode="email"
                                    className={`ctc-input${errors.email ? ' is-bad' : ''}`}
                                    value={values.email}
                                    maxLength={CONTACT_LIMITS.email}
                                    autoComplete="email"
                                    placeholder="you@yourbrand.in"
                                    onChange={(e) => set('email', e.target.value)}
                                    aria-invalid={Boolean(errors.email)}
                                    aria-describedby={errors.email ? 'ctc-email-err' : 'ctc-email-help'}
                                />
                                {errors.email ? (
                                    <p className="ctc-err" id="ctc-email-err">{t(errors.email ?? '')}</p>
                                ) : (
                                    <p className="ctc-help" id="ctc-email-help">
                                        <Copy text={"Your ticket confirmation goes here."} /></p>
                                )}
                            </div>
                        </div>

                        <div className="ctc-field">
                            <label className="ctc-label" htmlFor="ctc-phone">
                                <Copy text={"Phone"} />{' '}<span className="ctc-req">*</span>
                            </label>
                            <div className={`ctc-phone${errors.phone ? ' is-bad' : ''}`}>
                                <Select
                                    unstyled
                                    aria-label={t("Country dialling code")}
                                    className="ctc-phone-code"
                                    value={values.phone_country_code}
                                    options={toOptions(DIAL_CODES, t)}
                                    onChange={(e) => set('phone_country_code', e.target.value)}
                                />
                                <Input
                                    unstyled
                                    id="ctc-phone"
                                    type="tel"
                                    inputMode="tel"
                                    className="ctc-phone-number"
                                    value={values.phone}
                                    maxLength={CONTACT_LIMITS.phone}
                                    autoComplete="tel-national"
                                    placeholder="98765 43210"
                                    onChange={(e) => set('phone', e.target.value)}
                                    aria-invalid={Boolean(errors.phone)}
                                    aria-describedby={errors.phone ? 'ctc-phone-err' : undefined}
                                />
                            </div>
                            {errors.phone && (
                                <p className="ctc-err" id="ctc-phone-err">{t(errors.phone ?? '')}</p>
                            )}
                        </div>

                        <div className="ctc-grid-2">
                            <div className="ctc-field">
                                <label className="ctc-label" htmlFor="ctc-company">
                                    <Copy text={"Business or brand name"} /></label>
                                <Input
                                    unstyled
                                    id="ctc-company"
                                    className="ctc-input"
                                    value={values.company_name}
                                    maxLength={CONTACT_LIMITS.company}
                                    autoComplete="organization"
                                    placeholder={t("Optional")}
                                    onChange={(e) => set('company_name', e.target.value)}
                                />
                            </div>
                            <div className="ctc-field">
                                <label className="ctc-label" htmlFor="ctc-website">
                                    <Copy text={"Website or social page"} /></label>
                                <Input
                                    unstyled
                                    id="ctc-website"
                                    className={`ctc-input${errors.website_url ? ' is-bad' : ''}`}
                                    value={values.website_url}
                                    maxLength={CONTACT_LIMITS.url}
                                    autoComplete="url"
                                    placeholder="instagram.com/yourbrand"
                                    onChange={(e) => set('website_url', e.target.value)}
                                    aria-invalid={Boolean(errors.website_url)}
                                    aria-describedby={errors.website_url ? 'ctc-website-err' : undefined}
                                />
                                {errors.website_url && (
                                    <p className="ctc-err" id="ctc-website-err">{t(errors.website_url ?? '')}</p>
                                )}
                            </div>
                        </div>

                        {isMerchant && (
                            <div className="ctc-field">
                                <label className="ctc-label" htmlFor="ctc-store">
                                    <Copy text={"Your LetBuyy store address"} /></label>
                                <div className="ctc-suffixed">
                                    <Input
                                        unstyled
                                        id="ctc-store"
                                        className="ctc-suffixed-input"
                                        value={values.store_subdomain}
                                        maxLength={CONTACT_LIMITS.shortChoice}
                                        placeholder="yourstore"
                                        onChange={(e) =>
                                            set(
                                                'store_subdomain',
                                                e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                                            )
                                        }
                                    />
                                    <span className="ctc-suffix">.letbuyy.com</span>
                                </div>
                                <p className="ctc-help">
                                    <Copy text={"Lets us find your store before we reply, so the first answer is a real one."} /></p>
                            </div>
                        )}
                    </>
                )}

                {/* ── Step 2 ─────────────────────────────────────────────── */}
                {step === 2 && (
                    <>
                        <h2 className="ctc-step-title"><Copy text={"What can we help with?"} /></h2>
                        <p className="ctc-step-sub">
                            <Copy text={"Pick the closest topic. It decides which team sees this and how fast we come back."} /></p>

                        <fieldset className="ctc-field ctc-fieldset">
                            <legend className="ctc-label">
                                <Copy text={"Topic"} />{' '}<span className="ctc-req">*</span>
                            </legend>
                            <div
                                className="ctc-topics"
                                role="group"
                                aria-describedby={errors.topic ? 'ctc-topic-err' : undefined}
                            >
                                {CONTACT_TOPICS.map((entry, index) => (
                                    <Button
                                        unstyled
                                        key={entry.id}
                                        /* Focus target when the topic step fails
                                           validation — the control is a grid of
                                           buttons, so the first one stands in. */
                                        id={index === 0 ? 'ctc-topic-first' : undefined}
                                        type="button"
                                        className={`ctc-topic${values.topic === entry.id ? ' is-on' : ''}`}
                                        aria-pressed={values.topic === entry.id}
                                        onClick={() => chooseTopic(entry.id)}
                                    >
                                        <span className="ctc-topic-name">{t(entry.label)}</span>
                                        <span className="ctc-topic-note">{t(entry.description)}</span>
                                        <span className="ctc-topic-sla">
                                            <Copy text={"Replies in"} />{' '}{entry.responseHours}h
                                        </span>
                                    </Button>
                                ))}
                            </div>
                            {errors.topic && (
                                <p className="ctc-err" id="ctc-topic-err">{t(errors.topic ?? '')}</p>
                            )}
                        </fieldset>

                        {topic && (
                            <>
                                <div className="ctc-field">
                                    <label className="ctc-label" htmlFor="ctc-subject">
                                        <Copy text={"Subject"} />{' '}<span className="ctc-req">*</span>
                                    </label>
                                    <Select
                                        unstyled
                                        id="ctc-subject"
                                        className={`ctc-select${errors.subject_id ? ' is-bad' : ''}`}
                                        value={values.subject_id}
                                        placeholder={t("Choose the closest match")}
                                        options={subjectOptions}
                                        onChange={(e) => set('subject_id', e.target.value)}
                                        aria-invalid={Boolean(errors.subject_id)}
                                        aria-describedby={errors.subject_id ? 'ctc-subject-err' : undefined}
                                    />
                                    {errors.subject_id && (
                                        <p className="ctc-err" id="ctc-subject-err">{t(errors.subject_id ?? '')}</p>
                                    )}
                                </div>

                                <div className="ctc-field">
                                    <label className="ctc-label" htmlFor="ctc-subject-text">
                                        <Copy text={"Your own subject line"} />{' '}
                                        {values.subject_id === 'other' ? (
                                            <span className="ctc-req">*</span>
                                        ) : (
                                            <span className="ctc-optional"><Copy text={"optional"} /></span>
                                        )}
                                    </label>
                                    <Input
                                        unstyled
                                        id="ctc-subject-text"
                                        className={`ctc-input${errors.subject_text ? ' is-bad' : ''}`}
                                        value={values.subject_text}
                                        maxLength={CONTACT_LIMITS.subjectText}
                                        placeholder={t("Payout for 12 March has not landed")}
                                        onChange={(e) => set('subject_text', e.target.value)}
                                        aria-invalid={Boolean(errors.subject_text)}
                                        aria-describedby={
                                            errors.subject_text ? 'ctc-subject-text-err' : undefined
                                        }
                                    />
                                    {errors.subject_text ? (
                                        <p className="ctc-err" id="ctc-subject-text-err">
                                            {t(errors.subject_text ?? '')}
                                        </p>
                                    ) : (
                                        <p className="ctc-help">
                                            <Copy text={"This becomes the subject of your ticket email."} /></p>
                                    )}
                                </div>

                                <fieldset className="ctc-field ctc-fieldset">
                                    <legend className="ctc-label"><Copy text={"How urgent is it?"} /></legend>
                                    <div className="ctc-chips">
                                        {CONTACT_URGENCIES.map((level) => (
                                            <Button
                                                unstyled
                                                key={level.id}
                                                type="button"
                                                className={`ctc-chip${values.urgency === level.id ? ' is-on' : ''}${level.id === 'critical' ? ' is-alarm' : ''}`}
                                                aria-pressed={values.urgency === level.id}
                                                onClick={() => set('urgency', level.id)}
                                                title={t(level.description)}
                                            >
                                                {t(level.label)}
                                            </Button>
                                        ))}
                                    </div>
                                </fieldset>

                                <div className="ctc-field">
                                    <label className="ctc-label" htmlFor="ctc-message">
                                        <Copy text={"Tell us what is happening"} />{' '}<span className="ctc-req">*</span>
                                    </label>
                                    <Textarea
                                        unstyled
                                        id="ctc-message"
                                        rows={7}
                                        className={`ctc-textarea${errors.message ? ' is-bad' : ''}`}
                                        value={values.message}
                                        maxLength={CONTACT_LIMITS.message}
                                        placeholder={t("The more specific, the better. Dates, order numbers, what you expected and what happened instead.")}
                                        onChange={(e) => set('message', e.target.value)}
                                        aria-invalid={Boolean(errors.message)}
                                        aria-describedby={errors.message ? 'ctc-message-err' : undefined}
                                    />
                                    <div className="ctc-counter-row">
                                        {errors.message ? (
                                            <p className="ctc-err" id="ctc-message-err">{t(errors.message ?? '')}</p>
                                        ) : (
                                            <p className="ctc-help">
                                                <Copy text={"Please do not include passwords, OTPs or card numbers."} /></p>
                                        )}
                                        <span
                                            className={`ctc-counter${messageLeft < 200 ? ' is-low' : ''}`}
                                        >
                                            {messageLeft}
                                        </span>
                                    </div>
                                </div>

                                {reveals.has('order') && (
                                    <div className="ctc-field">
                                        <label className="ctc-label" htmlFor="ctc-ref">
                                            <Copy text={"Order, payment or payout reference"} /></label>
                                        <Input
                                            unstyled
                                            id="ctc-ref"
                                            className="ctc-input"
                                            value={values.order_reference}
                                            maxLength={CONTACT_LIMITS.reference}
                                            placeholder="Order 1042 or pay_MkT91xYz"
                                            onChange={(e) => set('order_reference', e.target.value)}
                                        />
                                        <p className="ctc-help">
                                            <Copy text={"With a reference we can look it up before replying."} /></p>
                                    </div>
                                )}
                            </>
                        )}
                    </>
                )}

                {/* ── Step 3 ─────────────────────────────────────────────── */}
                {step === 3 && (
                    <>
                        <h2 className="ctc-step-title"><Copy text={"A little context"} /></h2>
                        <p className="ctc-step-sub">
                            <Copy text={"All optional — but it is the difference between a generic reply and a useful one."} /></p>

                        <div className="ctc-grid-2">
                            <div className="ctc-field">
                                <label className="ctc-label" htmlFor="ctc-city"><Copy text={"City"} /></label>
                                <Input
                                    unstyled
                                    id="ctc-city"
                                    className="ctc-input"
                                    value={values.city}
                                    maxLength={CONTACT_LIMITS.city}
                                    autoComplete="address-level2"
                                    placeholder="Coimbatore"
                                    onChange={(e) => set('city', e.target.value)}
                                />
                            </div>
                            <div className="ctc-field">
                                <label className="ctc-label" htmlFor="ctc-state"><Copy text={"State"} /></label>
                                <Select
                                    unstyled
                                    id="ctc-state"
                                    className="ctc-select"
                                    value={values.state}
                                    placeholder={t("Select a state")}
                                    options={toOptions(INDIA_STATES, t)}
                                    onChange={(e) => set('state', e.target.value)}
                                />
                            </div>
                        </div>

                        {reveals.has('business') && (
                            <div className="ctc-grid-2">
                                <div className="ctc-field">
                                    <label className="ctc-label" htmlFor="ctc-category">
                                        <Copy text={"What do you sell?"} /></label>
                                    <Select
                                        unstyled
                                        id="ctc-category"
                                        className="ctc-select"
                                        value={values.business_type}
                                        placeholder={t("Choose a category")}
                                        options={toOptions(CONTACT_BUSINESS_TYPES, t)}
                                        onChange={(e) => set('business_type', e.target.value)}
                                    />
                                </div>
                                <div className="ctc-field">
                                    <label className="ctc-label" htmlFor="ctc-gstin">GSTIN</label>
                                    <Input
                                        unstyled
                                        id="ctc-gstin"
                                        className="ctc-input ctc-mono"
                                        value={values.gstin}
                                        maxLength={CONTACT_LIMITS.gstin}
                                        placeholder="33ABCDE1234F1Z5"
                                        onChange={(e) => set('gstin', e.target.value.toUpperCase())}
                                    />
                                </div>
                            </div>
                        )}

                        {reveals.has('commerce') && (
                            <>
                                <div className="ctc-field">
                                    <label className="ctc-label" htmlFor="ctc-channel">
                                        <Copy text={"Where do you sell today?"} /></label>
                                    <Select
                                        unstyled
                                        id="ctc-channel"
                                        className="ctc-select"
                                        value={values.current_channel}
                                        placeholder={t("Choose one")}
                                        options={toOptions(CONTACT_CURRENT_CHANNELS, t)}
                                        onChange={(e) => set('current_channel', e.target.value)}
                                    />
                                </div>
                                <div className="ctc-grid-2">
                                    <div className="ctc-field">
                                        <label className="ctc-label" htmlFor="ctc-orders">
                                            <Copy text={"Orders a month"} /></label>
                                        <Select
                                            unstyled
                                            id="ctc-orders"
                                            className="ctc-select"
                                            value={values.monthly_orders}
                                            placeholder={t("Choose a range")}
                                            options={toOptions(CONTACT_ORDER_BANDS, t)}
                                            onChange={(e) => set('monthly_orders', e.target.value)}
                                        />
                                    </div>
                                    <div className="ctc-field">
                                        <label className="ctc-label" htmlFor="ctc-gmv">
                                            <Copy text={"Monthly sales"} /></label>
                                        <Select
                                            unstyled
                                            id="ctc-gmv"
                                            className="ctc-select"
                                            value={values.monthly_gmv_band}
                                            placeholder={t("Choose a range")}
                                            options={toOptions(CONTACT_GMV_BANDS, t)}
                                            onChange={(e) => set('monthly_gmv_band', e.target.value)}
                                        />
                                    </div>
                                </div>
                            </>
                        )}

                        {reveals.has('plan') && (
                            <div className="ctc-grid-2">
                                <div className="ctc-field">
                                    <label className="ctc-label" htmlFor="ctc-plan">
                                        <Copy text={"Plan you are looking at"} /></label>
                                    <Select
                                        unstyled
                                        id="ctc-plan"
                                        className="ctc-select"
                                        value={values.interested_plan}
                                        placeholder={t("Choose a plan")}
                                        options={toOptions(PLAN_OPTIONS, t)}
                                        onChange={(e) => set('interested_plan', e.target.value)}
                                    />
                                </div>
                                <div className="ctc-field">
                                    <label className="ctc-label" htmlFor="ctc-timeline">
                                        <Copy text={"When do you want to go live?"} /></label>
                                    <Select
                                        unstyled
                                        id="ctc-timeline"
                                        className="ctc-select"
                                        value={values.timeline}
                                        placeholder={t("Choose a timeline")}
                                        options={idOptions(CONTACT_TIMELINES, t)}
                                        onChange={(e) => set('timeline', e.target.value)}
                                    />
                                </div>
                            </div>
                        )}

                        {reveals.has('technical') && !isMerchant && (
                            <div className="ctc-field">
                                <label className="ctc-label" htmlFor="ctc-store-2">
                                    <Copy text={"Store address, if this is about one"} /></label>
                                <div className="ctc-suffixed">
                                    <Input
                                        unstyled
                                        id="ctc-store-2"
                                        className="ctc-suffixed-input"
                                        value={values.store_subdomain}
                                        maxLength={CONTACT_LIMITS.shortChoice}
                                        placeholder="yourstore"
                                        onChange={(e) =>
                                            set(
                                                'store_subdomain',
                                                e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''),
                                            )
                                        }
                                    />
                                    <span className="ctc-suffix">.letbuyy.com</span>
                                </div>
                            </div>
                        )}

                        <div className="ctc-field">
                            <label className="ctc-label" htmlFor="ctc-heard">
                                <Copy text={"How did you hear about LetBuyy?"} /></label>
                            <Select
                                unstyled
                                id="ctc-heard"
                                className="ctc-select"
                                value={values.heard_about_us}
                                placeholder={t("Choose one")}
                                options={toOptions(CONTACT_HEARD_ABOUT, t)}
                                onChange={(e) => set('heard_about_us', e.target.value)}
                            />
                        </div>
                    </>
                )}

                {/* ── Step 4 ─────────────────────────────────────────────── */}
                {step === 4 && (
                    <>
                        <h2 className="ctc-step-title"><Copy text={"How should we reach you?"} /></h2>
                        <p className="ctc-step-sub">
                            <Copy text={"One last thing, then it is with the"} />{' '}
                            {t(topic?.label ?? 'Our team')} <Copy text={"team."} /></p>

                        <fieldset className="ctc-field ctc-fieldset">
                            <legend className="ctc-label"><Copy text={"Reply by"} /></legend>
                            <div className="ctc-chips">
                                {CONTACT_CHANNELS.map((channel) => (
                                    <Button
                                        unstyled
                                        key={channel.id}
                                        type="button"
                                        className={`ctc-chip${values.preferred_channel === channel.id ? ' is-on' : ''}`}
                                        aria-pressed={values.preferred_channel === channel.id}
                                        onClick={() => set('preferred_channel', channel.id)}
                                    >
                                        {t(channel.label)}
                                    </Button>
                                ))}
                            </div>
                        </fieldset>

                        <div className="ctc-grid-2">
                            <div className="ctc-field">
                                <label className="ctc-label" htmlFor="ctc-language">
                                    <Copy text={"Answer me in"} /></label>
                                <Select
                                    unstyled
                                    id="ctc-language"
                                    className="ctc-select"
                                    value={values.preferred_language}
                                    options={idOptions(CONTACT_LANGUAGES, t)}
                                    onChange={(e) => set('preferred_language', e.target.value)}
                                />
                            </div>
                            <div className="ctc-field">
                                <label className="ctc-label" htmlFor="ctc-window">
                                    <Copy text={"Best time to reach you"} /></label>
                                <Select
                                    unstyled
                                    id="ctc-window"
                                    className="ctc-select"
                                    value={values.preferred_time_window}
                                    options={idOptions(CONTACT_TIME_WINDOWS, t)}
                                    onChange={(e) => set('preferred_time_window', e.target.value)}
                                />
                            </div>
                        </div>

                        <div className="ctc-summary">
                            <span className="ctc-summary-label"><Copy text={"Going to"} /></span>
                            <p className="ctc-summary-line">
                                {/* Same phrasing helper as the success screen and the
                                    acknowledgement email — "48 working hours" here and
                                    "within 6 working days" in the inbox are the same
                                    promise described two ways, which reads as a change
                                    of terms rather than a formatting choice. */}
                                <strong>{t(topic?.label ?? 'Our team')}</strong> <Copy text={"· first reply"} />{' '}
                                <strong>{formatResponseTime(responseHours, locale.language.code)}</strong>
                            </p>
                        </div>

                        <div className={`ctc-consent${errors.consent_privacy ? ' is-bad' : ''}`}>
                            <label className="ctc-check" htmlFor="ctc-consent-privacy">
                                <Checkbox
                                    unstyled
                                    id="ctc-consent-privacy"
                                    label=""
                                    className="ctc-check-box"
                                    checked={values.consent_privacy}
                                    onCheckedChange={(checked) => set('consent_privacy', checked)}
                                    aria-invalid={Boolean(errors.consent_privacy)}
                                    aria-describedby={
                                        errors.consent_privacy ? 'ctc-consent-err' : undefined
                                    }
                                />
                                <span className="ctc-check-text">
                                    <Copy text={"I agree that LetBuyy may use these details to answer my enquiry, as described in the"} />{' '}
                                    {/* LocaleLink, not a raw anchor: a hardcoded /in/
                                        would throw a Tamil or Hindi reader back into
                                        English at the exact moment they are asked to
                                        consent to something. */}
                                    <LocaleLink href="/legal/privacy" target="_blank" rel="noopener noreferrer">
                                        <Copy text={"privacy notice"} /></LocaleLink>
                                    . <span className="ctc-req">*</span>
                                </span>
                            </label>
                            {errors.consent_privacy && (
                                <p className="ctc-err" id="ctc-consent-err">{t(errors.consent_privacy ?? '')}</p>
                            )}

                            <label className="ctc-check" htmlFor="ctc-consent-marketing">
                                <Checkbox
                                    unstyled
                                    id="ctc-consent-marketing"
                                    label=""
                                    className="ctc-check-box"
                                    checked={values.consent_marketing}
                                    onCheckedChange={(checked) => set('consent_marketing', checked)}
                                />
                                <span className="ctc-check-text">
                                    <Copy text={"Send me occasional product news for Indian sellers. Unsubscribe any time."} /></span>
                            </label>
                        </div>

                        <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} />

                        {submitError && (
                            <p className="ctc-alert" role="alert">
                                {t(submitError)}
                            </p>
                        )}
                    </>
                )}
            </div>

            {/* Navigation */}
            <div className="ctc-actions">
                {step > 1 ? (
                    <Button unstyled type="button" className="ctc-btn ctc-btn-ghost" onClick={back}>
                        <Copy text={"Back"} /></Button>
                ) : (
                    <span className="ctc-actions-spacer" />
                )}

                {step < STEPS.length ? (
                    <Button unstyled type="button" className="ctc-btn ctc-btn-primary" onClick={next}>
                        <Copy text={"Continue"} /><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M5 12h14M12 5l7 7-7 7" />
                        </svg>
                    </Button>
                ) : (
                    <Button
                        unstyled
                        type="button"
                        className="ctc-btn ctc-btn-primary"
                        onClick={submit}
                        disabled={submitting}
                    >
                        {t(submitting ? 'Sending…' : 'Send message')}
                        {!submitting && (
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                <path d="M5 12h14M12 5l7 7-7 7" />
                            </svg>
                        )}
                    </Button>
                )}
            </div>

            <p className="ctc-legal">
                <Copy text={"Protected by Cloudflare Turnstile. We never ask for passwords, OTPs or card details over email."} /></p>
        </div>
    )
}
