'use client';

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from 'react';

declare global {
    interface Window {
        turnstile?: {
            render: (container: string | HTMLElement, options: Record<string, unknown>) => string;
            reset: (widgetId: string) => void;
            remove: (widgetId: string) => void;
        };
        onStorefrontTurnstileLoad?: () => void;
    }
}

export interface TurnstileHandle {
    reset: () => void;
}

interface TurnstileWidgetProps {
    onVerify: (token: string) => void;
    onExpire?: () => void;
}

function canUseClientDevAuthBypass() {
    return process.env.NODE_ENV === 'development'
        && process.env.NEXT_PUBLIC_LETBUYY_ENABLE_DEV_AUTH_BYPASS === 'true';
}

const TurnstileWidget = forwardRef<TurnstileHandle, TurnstileWidgetProps>(
    function TurnstileWidget({ onVerify, onExpire }, ref) {
        const containerRef = useRef<HTMLDivElement>(null);
        const widgetIdRef = useRef<string | null>(null);
        const scriptLoaded = useRef(false);
        const onVerifyRef = useRef(onVerify);
        const onExpireRef = useRef(onExpire);

        useEffect(() => {
            onVerifyRef.current = onVerify;
            onExpireRef.current = onExpire;
        }, [onVerify, onExpire]);

        const renderWidget = useCallback(() => {
            if (!containerRef.current || !window.turnstile) return;

            if (widgetIdRef.current) {
                try {
                    window.turnstile.remove(widgetIdRef.current);
                } catch {
                    // Ignore stale widget handles after a route transition.
                }
                widgetIdRef.current = null;
            }

            const useDevBypass = canUseClientDevAuthBypass();
            const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
            if (useDevBypass || !siteKey) {
                onVerifyRef.current(useDevBypass ? 'dev-bypass-token' : '');
                return;
            }

            widgetIdRef.current = window.turnstile.render(containerRef.current, {
                sitekey: siteKey,
                size: 'flexible',
                callback: (token: string) => onVerifyRef.current(token),
                'expired-callback': () => {
                    onVerifyRef.current('');
                    onExpireRef.current?.();
                    if (widgetIdRef.current && window.turnstile) {
                        try {
                            window.turnstile.reset(widgetIdRef.current);
                        } catch {
                            widgetIdRef.current = null;
                        }
                    }
                },
                'error-callback': () => onVerifyRef.current(''),
            });
        }, []);

        useImperativeHandle(ref, () => ({
            reset: () => {
                if (widgetIdRef.current && window.turnstile) {
                    try {
                        window.turnstile.reset(widgetIdRef.current);
                        return;
                    } catch {
                        // Re-render below.
                    }
                }
                renderWidget();
            },
        }), [renderWidget]);

        useEffect(() => {
            const useDevBypass = canUseClientDevAuthBypass();
            const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
            if (useDevBypass || !siteKey) {
                onVerifyRef.current(useDevBypass ? 'dev-bypass-token' : '');
                return;
            }

            if (!scriptLoaded.current && !document.querySelector('script[src*="turnstile"]')) {
                scriptLoaded.current = true;
                window.onStorefrontTurnstileLoad = renderWidget;

                const script = document.createElement('script');
                script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onStorefrontTurnstileLoad';
                script.async = true;
                document.head.appendChild(script);
            } else if (window.turnstile) {
                renderWidget();
            }

            return () => {
                if (widgetIdRef.current) {
                    try {
                        window.turnstile?.remove(widgetIdRef.current);
                    } catch {
                        // Ignore cleanup races during navigation.
                    }
                }
            };
        }, [renderWidget]);

        return <div ref={containerRef} className="w-full" />;
    },
);

export default TurnstileWidget;
