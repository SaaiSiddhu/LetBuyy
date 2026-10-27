'use client'

import { useEffect, useRef, useCallback, useImperativeHandle, forwardRef } from 'react'

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

export interface TurnstileHandle {
    reset: () => void
}

interface TurnstileWidgetProps {
    onVerify: (token: string) => void
    onExpire?: () => void
}

function canUseClientDevAuthBypass() {
    return process.env.NODE_ENV === 'development'
        && process.env.NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS === 'true'
}

/**
 * Managed Cloudflare Turnstile widget.
 *
 * Use the ref handle to call .reset() after a failed login attempt
 * or when the token expires.
 */
const TurnstileWidget = forwardRef<TurnstileHandle, TurnstileWidgetProps>(
    function TurnstileWidget({ onVerify, onExpire }, ref) {
        const containerRef = useRef<HTMLDivElement>(null)
        const widgetIdRef = useRef<string | null>(null)
        const scriptLoaded = useRef(false)
        // Use refs to avoid re-render dependency issues
        const onVerifyRef = useRef(onVerify)
        const onExpireRef = useRef(onExpire)

        useEffect(() => {
            onVerifyRef.current = onVerify
            onExpireRef.current = onExpire
        }, [onVerify, onExpire])

        const renderWidget = useCallback(() => {
            if (!containerRef.current || !window.turnstile) return

            // Remove existing widget if any
            if (widgetIdRef.current) {
                try {
                    window.turnstile.remove(widgetIdRef.current)
                } catch { /* ignore */ }
                widgetIdRef.current = null
            }

            const useDevBypass = canUseClientDevAuthBypass()
            const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
            if (useDevBypass || !siteKey) {
                onVerifyRef.current(useDevBypass ? 'dev-bypass-token' : '')
                return
            }

            widgetIdRef.current = window.turnstile.render(containerRef.current, {
                sitekey: siteKey,
                size: 'flexible',
                theme: 'auto',
                appearance: 'always',
                callback: (token: string) => onVerifyRef.current(token),
                'expired-callback': () => {
                    // Token expired — clear it and reset widget for a fresh token
                    onVerifyRef.current('')
                    onExpireRef.current?.()
                    // Auto-reset to get a new token
                    if (widgetIdRef.current && window.turnstile) {
                        try {
                            window.turnstile.reset(widgetIdRef.current)
                        } catch { /* ignore */ }
                    }
                },
                'error-callback': () => {
                    onVerifyRef.current('')
                },
            })
        }, []) // No dependencies — uses refs for callbacks

        // Expose reset method to parent via ref
        useImperativeHandle(ref, () => ({
            reset: () => {
                if (widgetIdRef.current && window.turnstile) {
                    try {
                        window.turnstile.reset(widgetIdRef.current)
                    } catch {
                        // If reset fails, re-render the widget entirely
                        renderWidget()
                    }
                } else {
                    renderWidget()
                }
            },
        }), [renderWidget])

        useEffect(() => {
            const useDevBypass = canUseClientDevAuthBypass()
            const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY
            if (useDevBypass || !siteKey) {
                onVerifyRef.current(useDevBypass ? 'dev-bypass-token' : '')
                return
            }

            let active=true
            let readyTimer: ReturnType<typeof setInterval> | undefined
            let attempts=0
            const whenReady=()=>{
                if(!active || !containerRef.current || widgetIdRef.current || !window.turnstile)return
                renderWidget()
                if(readyTimer)clearInterval(readyTimer)
            }
            // Load Turnstile script if not already loaded
            if (!scriptLoaded.current && !document.querySelector('script[src*="turnstile"]')) {
                scriptLoaded.current = true
                window.onTurnstileLoad = whenReady

                const script = document.createElement('script')
                script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onTurnstileLoad'
                script.async = true
                document.head.appendChild(script)
            }
            whenReady()
            if(!widgetIdRef.current)readyTimer=setInterval(()=>{
                whenReady()
                if(++attempts>=100 && readyTimer)clearInterval(readyTimer)
            },100)

            return () => {
                active=false
                if(readyTimer)clearInterval(readyTimer)
                if (widgetIdRef.current) {
                    try {
                        window.turnstile?.remove(widgetIdRef.current)
                    } catch { /* ignore */ }
                    widgetIdRef.current=null
                }
            }
        }, [renderWidget])

        return <div ref={containerRef} className="auth-turnstile" />
    }
)

export default TurnstileWidget
