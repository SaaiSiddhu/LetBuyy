'use client'

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react'

/**
 * Invisible Turnstile for the contact form.
 *
 * The marketing site cannot import the identity-platform widget — the two apps
 * are separate deployments and the boundary rules forbid reaching across — so
 * this mirrors that implementation for the one case this app needs.
 *
 * FAILING OPEN IS THE POINT. When no site key is configured (local dev, a
 * preview deployment) it hands back an empty token immediately rather than
 * blocking the form. The gateway is what actually decides: it verifies the
 * token server-side and rejects an empty one in any environment where
 * TURNSTILE_SECRET_KEY is set. A missing key here degrades the UX, never the
 * security.
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
    reset: () => void
}

interface TurnstileWidgetProps {
    onVerify: (token: string) => void
    onExpire?: () => void
}

const TurnstileWidget = forwardRef<TurnstileHandle, TurnstileWidgetProps>(
    function TurnstileWidget({ onVerify, onExpire }, ref) {
        const containerRef = useRef<HTMLDivElement>(null)
        const widgetIdRef = useRef<string | null>(null)
        const scriptLoaded = useRef(false)
        const onVerifyRef = useRef(onVerify)
        const onExpireRef = useRef(onExpire)

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
                    // Stale handle after a route transition — nothing to clean up.
                }
                widgetIdRef.current = null
            }

            const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
            if (!siteKey) {
                onVerifyRef.current('')
                return
            }

            widgetIdRef.current = window.turnstile.render(containerRef.current, {
                sitekey: siteKey,
                // Invisible is the configured widget type, not a supported size value.
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
            if (!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
                onVerifyRef.current('')
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
                        // Cleanup race during navigation — safe to ignore.
                    }
                }
            }
        }, [renderWidget])

        return <div ref={containerRef} className="ctc-turnstile" aria-hidden="true" />
    },
)

export default TurnstileWidget
