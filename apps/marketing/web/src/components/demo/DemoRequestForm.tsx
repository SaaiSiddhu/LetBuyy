'use client'

import Copy from '@/components/i18n/Copy'

import { useCopy } from '@/components/i18n/useCopy'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Input, Textarea, Check, ChevronLeft, ChevronRight, Loader2 } from '@letbuyy/ui'
import {
    resolveLetbuyyApiBaseUrl,
    LETBUYY_PRODUCTION_API_BASE_URL,
} from '@letbuyy/api-client'
import TurnstileWidget, { type TurnstileHandle } from '@/components/security/TurnstileWidget'
import {
    BUSINESS_TYPES,
    CONTACT_LANGUAGES,
    CURRENT_CHANNELS,
    GMV_BANDS,
    GOALS,
    HEARD_ABOUT,
    HEARD_ABOUT_NEEDS_DETAIL,
    MONTHLY_ORDERS,
    PLANS,
    PRODUCT_CATEGORIES,
    SLOT_TIMES,
    istSlotToIso,
    nextBookableDays,
    type Choice,
} from '@/lib/demo/fields'

/**
 * Demo request form.
 *
 * Four steps rather than one long page. The full field set is ~18 questions;
 * presented as a single column it reads as work, and the drop-off is on the
 * fields we most want (business context, which sits below the fold). Splitting
 * it means each screen asks one kind of question, and only step 1 is required
 * to be useful — everything after it can be skipped.
 *
 * The submitted payload is validated again at the gateway. Client validation
 * here exists to give a fast, field-level answer, not as a security boundary.
 */

type Step = 0 | 1 | 2 | 3

const STEPS = [
    { title: 'About you', blurb: 'So we know who we are talking to.' },
    { title: 'Your business', blurb: 'Helps us tailor what we show you.' },
    { title: 'What you need', blurb: 'So the call is about your situation.' },
    { title: 'Pick a time', blurb: 'Thirty minutes, on a call or a screen share.' },
] as const

interface FormState {
    fullName: string
    email: string
    phone: string
    companyName: string
    websiteUrl: string
    preferredLanguage: string
    businessType: string
    currentChannel: string
    monthlyOrders: string
    monthlyGmvBand: string
    productCategories: string[]
    interestedPlan: string
    goals: string[]
    whyLetbuyy: string
    heardAboutUs: string
    heardAboutDetail: string
    slotDate: string
    slotTime: string
}

const INITIAL: FormState = {
    fullName: '',
    email: '',
    phone: '',
    companyName: '',
    websiteUrl: '',
    preferredLanguage: 'en',
    businessType: '',
    currentChannel: '',
    monthlyOrders: '',
    monthlyGmvBand: '',
    productCategories: [],
    interestedPlan: '',
    goals: [],
    whyLetbuyy: '',
    heardAboutUs: '',
    heardAboutDetail: '',
    slotDate: '',
    slotTime: '',
}

const EMAIL_SHAPE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
/* Indian mobile numbers, with or without +91 and common separators. Kept
   deliberately loose — rejecting a valid number is far worse than accepting a
   typo the team can correct on the call. */
const PHONE_SHAPE = /^(\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/

export default function DemoRequestForm({ locale }: { locale: string }) {
    const { t, locale: selectedLocale } = useCopy()
    const [step, setStep] = useState<Step>(0)
    const [form, setForm] = useState<FormState>(() => ({ ...INITIAL, preferredLanguage: selectedLocale.language.code }))
    const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({})
    const [submitting, setSubmitting] = useState(false)
    const [submitted, setSubmitted] = useState<{ id: string } | null>(null)
    const [submitError, setSubmitError] = useState<string | null>(null)
    const headingRef = useRef<HTMLHeadingElement>(null)
    /* Held in state, not read from the DOM at submit time: the managed widget
       delivers its token by callback, so there is no input to read until it
       fires. */
    const [turnstileToken, setTurnstileToken] = useState('')
    const turnstileRef = useRef<TurnstileHandle>(null)

    /* Days are computed once on mount, not per render: nextBookableDays() reads
       the clock, and recomputing on every keystroke would let the list shift
       under the user mid-selection. */
    const days = useMemo(() => nextBookableDays(10), [])

    /* Moving between steps replaces the visible content entirely. Without
       moving focus, a screen reader stays on the button that is no longer
       there and announces nothing. */
    useEffect(() => {
        if (step > 0 || submitted) headingRef.current?.focus()
    }, [step, submitted])

    function update<K extends keyof FormState>(key: K, value: FormState[K]) {
        setForm(prev => ({ ...prev, [key]: value }))
        setErrors(prev => (prev[key] ? { ...prev, [key]: undefined } : prev))
    }

    function toggleIn(key: 'productCategories' | 'goals', value: string) {
        setForm(prev => {
            const list = prev[key]
            return {
                ...prev,
                [key]: list.includes(value) ? list.filter(v => v !== value) : [...list, value],
            }
        })
    }

    /** Only step 0 blocks progress — the rest is optional by design. */
    function validateStepZero(): boolean {
        const next: Partial<Record<keyof FormState, string>> = {}
        if (!form.fullName.trim()) next.fullName = 'Please tell us your name'
        if (!form.email.trim()) next.email = 'We need an email to send the confirmation'
        else if (!EMAIL_SHAPE.test(form.email.trim())) next.email = 'That does not look like an email address'
        if (!form.phone.trim()) next.phone = 'We need a number to call you on'
        else if (!PHONE_SHAPE.test(form.phone.trim())) next.phone = 'Please check this number'
        setErrors(next)
        return Object.keys(next).length === 0
    }

    function goNext() {
        if (step === 0 && !validateStepZero()) return
        setStep(prev => Math.min(3, prev + 1) as Step)
    }

    async function submit() {
        if (!validateStepZero()) {
            setStep(0)
            return
        }
        setSubmitting(true)
        setSubmitError(null)

        const preferredAt =
            form.slotDate && form.slotTime ? istSlotToIso(form.slotDate, form.slotTime) : null

        try {
            /* Straight to the gateway, not through an app-local API route.
               `no-new-next-api-route` freezes those, and the direct call is the
               better shape anyway: the gateway sees the real client IP, which
               is what Turnstile needs to verify against. CORS for this origin
               is already configured gateway-side. */
            const response = await fetch(`${gatewayBaseUrl()}/demo-requests`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({
                    full_name: form.fullName,
                    email: form.email,
                    phone: form.phone,
                    company_name: form.companyName || null,
                    website_url: form.websiteUrl || null,
                    business_type: form.businessType || null,
                    current_channel: form.currentChannel || null,
                    monthly_orders: form.monthlyOrders || null,
                    monthly_gmv_band: form.monthlyGmvBand || null,
                    product_categories: form.productCategories,
                    interested_plan: form.interestedPlan || null,
                    goals: form.goals,
                    why_letbuyy: form.whyLetbuyy || null,
                    heard_about_us: form.heardAboutUs || null,
                    heard_about_detail: form.heardAboutDetail || null,
                    preferred_at: preferredAt,
                    /* The submitter's real zone, not a hardcoded IST. Slots are
                       offered in IST but a prospect abroad needs their own zone
                       recorded so the confirmation reads correctly. */
                    preferred_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    preferred_language: form.preferredLanguage,
                    locale,
                    source_path: window.location.pathname,
                    turnstile_token: turnstileToken,
                }),
            })

            const payload = (await response.json()) as {
                data?: { id: string }
                error?: { message?: string }
            }

            if (!response.ok || !payload.data) {
                setSubmitError(payload.error?.message ?? 'Something went wrong. Please try again.')
                return
            }
            setSubmitted({ id: payload.data.id })
        } catch {
            setSubmitError('Could not reach us just now. Please try again in a moment.')
        } finally {
            setSubmitting(false)
            /* Tokens are single-use. Without re-arming, a retry after any
               failure would send a spent token and be rejected for the wrong
               reason. */
            turnstileRef.current?.reset()
        }
    }

    if (submitted) {
        return (
            <section className="drf-done" aria-live="polite">
                <span className="drf-done-mark" aria-hidden="true">
                    <Check width={26} height={26} />
                </span>
                <h2 className="drf-done-title" tabIndex={-1} ref={headingRef}>
                    <Copy text={"Your demo request is in."} /></h2>
                <p className="drf-done-body">
                    <Copy text={"We have emailed a confirmation to"} />{' '}<strong>{form.email}</strong><Copy text={". A member of the team will confirm your slot within one working day."} /></p>
                <p className="drf-done-ref">
                    <Copy text={"Reference"} />{' '}<code>{submitted.id}</code>
                </p>
            </section>
        )
    }

    return (
        <div className="drf">
            <ol className="drf-steps" aria-label={t("Progress")}>
                {STEPS.map((entry, index) => (
                    <li
                        key={entry.title}
                        className={`drf-step${index === step ? ' is-current' : ''}${index < step ? ' is-done' : ''}`}
                        aria-current={index === step ? 'step' : undefined}
                    >
                        <span className="drf-step-dot" aria-hidden="true">
                            {index < step ? <Check width={12} height={12} /> : index + 1}
                        </span>
                        <span className="drf-step-label"><Copy text={entry.title} /></span>
                    </li>
                ))}
            </ol>

            <div className="drf-panel">
                <header className="drf-panel-head">
                    <h2 className="drf-panel-title" tabIndex={-1} ref={headingRef}>
                        <Copy text={STEPS[step].title} />
                    </h2>
                    <p className="drf-panel-blurb"><Copy text={STEPS[step].blurb} /></p>
                </header>

                {step === 0 && (
                    <div className="drf-grid">
                        <Field label="Full name" required error={errors.fullName}>
                            <Input
                                unstyled
                                className="drf-input"
                                value={form.fullName}
                                autoComplete="name"
                                onChange={e => update('fullName', e.target.value)}
                            />
                        </Field>
                        <Field label="Work email" required error={errors.email}>
                            <Input
                                unstyled
                                className="drf-input"
                                type="email"
                                inputMode="email"
                                value={form.email}
                                autoComplete="email"
                                onChange={e => update('email', e.target.value)}
                            />
                        </Field>
                        <Field label="Phone" required error={errors.phone} hint="We call from an Indian number">
                            <Input
                                unstyled
                                className="drf-input"
                                type="tel"
                                inputMode="tel"
                                value={form.phone}
                                autoComplete="tel"
                                onChange={e => update('phone', e.target.value)}
                            />
                        </Field>
                        <Field label="Business name">
                            <Input
                                unstyled
                                className="drf-input"
                                value={form.companyName}
                                autoComplete="organization"
                                onChange={e => update('companyName', e.target.value)}
                            />
                        </Field>
                        <Field label="Current website or social page" wide>
                            <Input
                                unstyled
                                className="drf-input"
                                value={form.websiteUrl}
                                placeholder="instagram.com/yourshop"
                                onChange={e => update('websiteUrl', e.target.value)}
                            />
                        </Field>
                        <Field label="Which language should we call you in?" wide>
                            <ChoiceRow
                                options={CONTACT_LANGUAGES}
                                value={form.preferredLanguage}
                                onSelect={v => update('preferredLanguage', v)}
                            />
                        </Field>
                    </div>
                )}

                {step === 1 && (
                    <div className="drf-stack">
                        <Field label="What kind of business is it?" wide>
                            <ChoiceRow
                                options={BUSINESS_TYPES}
                                value={form.businessType}
                                onSelect={v => update('businessType', v)}
                            />
                        </Field>
                        <Field label="How are you selling today?" wide>
                            <ChoiceRow
                                options={CURRENT_CHANNELS}
                                value={form.currentChannel}
                                onSelect={v => update('currentChannel', v)}
                            />
                        </Field>
                        <div className="drf-grid">
                            <Field label="Orders a month">
                                <ChoiceRow
                                    options={MONTHLY_ORDERS}
                                    value={form.monthlyOrders}
                                    onSelect={v => update('monthlyOrders', v)}
                                    compact
                                />
                            </Field>
                            <Field label="Monthly sales">
                                <ChoiceRow
                                    options={GMV_BANDS}
                                    value={form.monthlyGmvBand}
                                    onSelect={v => update('monthlyGmvBand', v)}
                                    compact
                                />
                            </Field>
                        </div>
                        <Field label="What do you sell?" hint="Pick any that apply" wide>
                            <ChoiceRow
                                options={PRODUCT_CATEGORIES}
                                values={form.productCategories}
                                onSelect={v => toggleIn('productCategories', v)}
                                multi
                            />
                        </Field>
                    </div>
                )}

                {step === 2 && (
                    <div className="drf-stack">
                        <Field label="Which plan are you looking at?" wide>
                            <ChoiceRow
                                options={PLANS}
                                value={form.interestedPlan}
                                onSelect={v => update('interestedPlan', v)}
                            />
                        </Field>
                        <Field label="What are you hoping to fix?" hint="Pick any that apply" wide>
                            <ChoiceRow
                                options={GOALS}
                                values={form.goals}
                                onSelect={v => toggleIn('goals', v)}
                                multi
                            />
                        </Field>
                        <Field label="Why LetBuyy, and what would make this a win for you?" wide>
                            <Textarea
                                unstyled
                                className="drf-textarea"
                                rows={4}
                                value={form.whyLetbuyy}
                                maxLength={2000}
                                onChange={e => update('whyLetbuyy', e.target.value)}
                                placeholder={t("Even one line helps us prepare.")}
                            />
                        </Field>
                        <Field label="How did you hear about us?" wide>
                            <ChoiceRow
                                options={HEARD_ABOUT}
                                value={form.heardAboutUs}
                                onSelect={v => update('heardAboutUs', v)}
                            />
                        </Field>
                        {HEARD_ABOUT_NEEDS_DETAIL.has(form.heardAboutUs) && (
                            <Field label="Where exactly?" wide>
                                <Input
                                    unstyled
                                    className="drf-input"
                                    value={form.heardAboutDetail}
                                    onChange={e => update('heardAboutDetail', e.target.value)}
                                    placeholder={t("A name or a link is plenty")}
                                />
                            </Field>
                        )}
                    </div>
                )}

                {step === 3 && (
                    <div className="drf-stack">
                        <Field label="Which day suits you?" hint="Weekdays, Indian Standard Time" wide>
                            <div className="drf-days">
                                {days.map(day => (
                                    <Button
                                        unstyled
                                        key={day.date}
                                        type="button"
                                        className={`drf-day${form.slotDate === day.date ? ' is-active' : ''}`}
                                        aria-pressed={form.slotDate === day.date}
                                        onClick={() => update('slotDate', day.date)}
                                    >
                                        <span className="drf-day-weekday">{new Date(day.date+'T12:00:00+05:30').toLocaleDateString(selectedLocale.hreflang, { weekday: 'short' })}</span>
                                        <span className="drf-day-date">{new Date(day.date+'T12:00:00+05:30').toLocaleDateString(selectedLocale.hreflang, { day: 'numeric', month: 'short' })}</span>
                                    </Button>
                                ))}
                            </div>
                        </Field>

                        {form.slotDate && (
                            <Field label="And a time?" wide>
                                <div className="drf-times">
                                    {SLOT_TIMES.map(time => (
                                        <Button
                                            unstyled
                                            key={time}
                                            type="button"
                                            className={`drf-time${form.slotTime === time ? ' is-active' : ''}`}
                                            aria-pressed={form.slotTime === time}
                                            onClick={() => update('slotTime', time)}
                                        >
                                            {time}
                                        </Button>
                                    ))}
                                </div>
                            </Field>
                        )}

                        <p className="drf-slot-note">
                            <Copy text={"No time that works? Submit anyway — we will email you options."} /></p>
                    </div>
                )}

                {step === 3 && <TurnstileWidget ref={turnstileRef} onVerify={setTurnstileToken} />}

                {submitError && (
                    <p className="drf-error" role="alert">
                        <Copy text={submitError} />
                    </p>
                )}

                <div className="drf-actions">
                    {step > 0 ? (
                        <Button
                            unstyled
                            type="button"
                            className="drf-back"
                            onClick={() => setStep(prev => Math.max(0, prev - 1) as Step)}
                        >
                            <ChevronLeft width={16} height={16} aria-hidden="true" />
                            <Copy text={"Back"} /></Button>
                    ) : (
                        <span />
                    )}

                    {step < 3 ? (
                        <Button unstyled type="button" className="drf-next" onClick={goNext}>
                            <Copy text={"Continue"} /><ChevronRight width={16} height={16} aria-hidden="true" />
                        </Button>
                    ) : (
                        <Button
                            unstyled
                            type="button"
                            className="drf-next"
                            onClick={submit}
                            disabled={submitting || !turnstileToken}
                        >
                            {submitting ? (
                                <>
                                    <Loader2 width={16} height={16} className="drf-spin" aria-hidden="true" />
                                    <Copy text={"Sending"} /></>
                            ) : (
                                <Copy text="Request my demo" />
                            )}
                        </Button>
                    )}
                </div>
            </div>
        </div>
    )
}

/** Gateway origin, from the public env the browser can see. */
function gatewayBaseUrl(): string {
    return resolveLetbuyyApiBaseUrl([process.env.NEXT_PUBLIC_API_URL], {
        fallback: LETBUYY_PRODUCTION_API_BASE_URL,
    })
}

function Field({
    label,
    hint,
    error,
    required,
    wide,
    children,
}: {
    label: string
    hint?: string
    error?: string
    required?: boolean
    wide?: boolean
    children: React.ReactNode
}) {
    return (
        <label className={`drf-field${wide ? ' is-wide' : ''}${error ? ' has-error' : ''}`}>
            <span className="drf-label">
                <Copy text={label} />
                {required && <span className="drf-required" aria-hidden="true">*</span>}
            </span>
            {children}
            {hint && !error && <span className="drf-hint"><Copy text={hint} /></span>}
            {error && <span className="drf-field-error"><Copy text={error} /></span>}
        </label>
    )
}

function ChoiceRow({
    options,
    value,
    values,
    onSelect,
    multi,
    compact,
}: {
    options: Choice[]
    value?: string
    values?: string[]
    onSelect: (value: string) => void
    multi?: boolean
    compact?: boolean
}) {
    return (
        <div className={`drf-choices${compact ? ' is-compact' : ''}`} role={multi ? 'group' : 'radiogroup'}>
            {options.map(option => {
                const active = multi ? Boolean(values?.includes(option.value)) : value === option.value
                return (
                    <Button
                        unstyled
                        key={option.value}
                        type="button"
                        className={`drf-choice${active ? ' is-active' : ''}`}
                        role={multi ? 'checkbox' : 'radio'}
                        aria-checked={active}
                        onClick={() => onSelect(option.value)}
                    >
                        <span className="drf-choice-label"><Copy text={option.label} /></span>
                        {option.hint && <span className="drf-choice-hint"><Copy text={option.hint} /></span>}
                    </Button>
                )
            })}
        </div>
    )
}
