'use client'

import { useEffect, useRef, useCallback } from 'react'

declare global {
    interface Window {
        turnstile: {
            render: (container: string | HTMLElement, options: Record<string, unknown>) => string
            reset: (widgetId: string) => void
            remove: (widgetId: string) => void
        }
        onTurnstileLoad: () => void
    }
}

interface TurnstileWidgetProps {
    onVerify: (token: string) => void
    onExpire?: () => void
}

/**
 * Invisible Cloudflare Turnstile widget.
 * Runs silently in the background — no UI, no checkboxes, no puzzles.
 * Automatically bypasses on localhost (Turnstile requires HTTPS).
 */
export default function TurnstileWidget({ onVerify, onExpire }: TurnstileWidgetProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    const widgetIdRef = useRef<string | null>(null)
    const scriptLoaded = useRef(false)

    const renderWidget = useCallback(() => {
        if (!containerRef.current || !window.turnstile) return

        // Remove existing widget if any
        if (widgetIdRef.current) {
            try {
                window.turnstile.remove(widgetIdRef.current)
            } catch { /* ignore */ }
        }

        const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
        if (!siteKey) {
            onVerify('dev-bypass-token')
            return
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
            sitekey: siteKey,
            size: 'invisible',
            callback: onVerify,
            'expired-callback': onExpire,
            'error-callback': () => {
                // On error (e.g. localhost protocol mismatch), auto-bypass in dev
                if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
                    onVerify('dev-bypass-token')
                }
            },
        })
    }, [onVerify, onExpire])

    useEffect(() => {
        // Turnstile cannot work on localhost (HTTP vs HTTPS protocol mismatch)
        // Skip entirely and auto-pass
        if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
            onVerify('dev-bypass-token')
            return
        }

        const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
        if (!siteKey) {
            onVerify('dev-bypass-token')
            return
        }

        // Load Turnstile script if not already loaded
        if (!scriptLoaded.current && !document.querySelector('script[src*="turnstile"]')) {
            scriptLoaded.current = true
            window.onTurnstileLoad = renderWidget

            const script = document.createElement('script')
            script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad'
            script.async = true
            document.head.appendChild(script)
        } else if (window.turnstile) {
            renderWidget()
        }

        return () => {
            if (widgetIdRef.current) {
                try {
                    window.turnstile?.remove(widgetIdRef.current)
                } catch { /* ignore */ }
            }
        }
    }, [renderWidget, onVerify])

    return <div ref={containerRef} />
}
