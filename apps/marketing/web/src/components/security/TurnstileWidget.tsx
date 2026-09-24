'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'

/**
 * Cloudflare Turnstile, invisible mode.
 *
 * Ported from apps/customer_web rather than imported: the two are
 * separate Next applications and cross-app component imports are a boundary
 * violation here. Behaviour is deliberately identical, including the dev
 * bypass, so the two properties cannot drift into different bot-protection
 * semantics.
 *
 * Invisible rather than managed: this guards a marketing lead form, and a
 * checkbox in front of a form someone is already reluctant to fill in costs
 * more conversions than it saves. Cloudflare still challenges suspicious
 * traffic interactively when it decides to.
 */

declare global {
    interface Window {
        turnstile?: {
            render: (container: string | HTMLElement, options: Record<string, unknown>) => string
            reset: (widgetId: string) => void
            remove: (widgetId: string) => void
        }
        onMarketingTurnstileLoad?: () => void
    }
}

export interface TurnstileHandle {
    /** Re-arm after a submission — a token is single-use. */
    reset: () => void
}

interface TurnstileWidgetProps {
    onVerify: (token: string) => void
    onExpire?: () => void
}

/**
 * The gateway honours 'dev-bypass-token' only when ITS runtime is local or
 * development, so emitting it here can never weaken production: the server
 * rejects it regardless of what the client sends.
 */
function canUseDevBypass(): boolean {
    return process.env.NODE_ENV === 'development'
}

const TurnstileWidget = forwardRef<TurnstileHandle, TurnstileWidgetProps>(
    function TurnstileWidget({ onVerify, onExpire }, ref) {
        const containerRef = useRef<HTMLDivElement>(null)
        const widgetIdRef = useRef<string | null>(null)
        const scriptLoaded = useRef(false)
        const onVerifyRef = useRef(onVerify)
        const onExpireRef = useRef(onExpire)

        /* Callbacks are held in refs so renderWidget can stay dependency-free.
           Turnstile's own callbacks outlive a React render, and closing over a
           stale onVerify would silently drop the token. */
        useEffect(() => {
            onVerifyRef.current = onVerify
            onExpireRef.current = onExpire
        }, [onVerify, onExpire])

        const renderWidget = useCallback(() => {
            if (!containerRef.current || !window.turnstile) return

            if (widgetIdRef.current) {
                try {
                    window.turnstile.remove(widgetIdRef.current)
                } catch {
                    // Stale handle after a route transition; nothing to clean.
                }
                widgetIdRef.current = null
            }

            const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
            if (!siteKey) {
                /* No key configured. In development hand back the sentinel so
                   the form is testable; in production hand back nothing, so the
                   submission fails closed rather than sending an unverifiable
                   request. */
                onVerifyRef.current(canUseDevBypass() ? 'dev-bypass-token' : '')
                return
            }

            widgetIdRef.current = window.turnstile.render(containerRef.current, {
                sitekey: siteKey,
                size: 'invisible',
                callback: (token: string) => onVerifyRef.current(token),
                'expired-callback': () => {
                    onVerifyRef.current('')
                    onExpireRef.current?.()
                    if (widgetIdRef.current && window.turnstile) {
                        try {
                            window.turnstile.reset(widgetIdRef.current)
                        } catch {
                            widgetIdRef.current = null
                        }
                    }
                },
                'error-callback': () => onVerifyRef.current(''),
            })
        }, [])

        useImperativeHandle(
            ref,
            () => ({
                reset: () => {
                    if (widgetIdRef.current && window.turnstile) {
                        try {
                            window.turnstile.reset(widgetIdRef.current)
                            return
                        } catch {
                            // Fall through to a full re-render.
                        }
                    }
                    renderWidget()
                },
            }),
            [renderWidget],
        )

        useEffect(() => {
            const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
            if (!siteKey) {
                onVerifyRef.current(canUseDevBypass() ? 'dev-bypass-token' : '')
                return
            }

            if (!scriptLoaded.current && !document.querySelector('script[src*="turnstile"]')) {
                scriptLoaded.current = true
                window.onMarketingTurnstileLoad = renderWidget

                const script = document.createElement('script')
                script.src =
                    'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onMarketingTurnstileLoad'
                script.async = true
                document.head.appendChild(script)
            } else if (window.turnstile) {
                renderWidget()
            }

            return () => {
                if (widgetIdRef.current) {
                    try {
                        window.turnstile?.remove(widgetIdRef.current)
                    } catch {
                        // Cleanup race during navigation; safe to ignore.
                    }
                }
            }
        }, [renderWidget])

        return <div ref={containerRef} aria-hidden="true" style={{ display: 'none' }} />
    },
)

export default TurnstileWidget
