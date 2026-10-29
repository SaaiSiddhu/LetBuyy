'use client';

import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Button } from './button';
import { mountTurnstile, type TurnstileController, type TurnstileStatus } from './turnstile-client';

export interface TurnstileHandle { reset(): void; }
export interface TurnstileWidgetProps {
    siteKey: string;
    action?: string;
    onVerify(token: string): void;
    onExpire?(): void;
    /** Only the host's explicit local-development flag may set this. Servers still verify. */
    developmentBypass?: boolean;
}

export const TurnstileWidget = forwardRef<TurnstileHandle, TurnstileWidgetProps>(function TurnstileWidget(
    { siteKey, action, onVerify, onExpire, developmentBypass = false }, ref,
) {
    const container = useRef<HTMLDivElement>(null);
    const controller = useRef<TurnstileController | null>(null);
    const callbacks = useRef({ onVerify, onExpire });
    const [status, setStatus] = useState<TurnstileStatus>('checking');
    useEffect(() => { callbacks.current = { onVerify, onExpire }; }, [onVerify, onExpire]);
    useImperativeHandle(ref, () => ({ reset: () => {
        callbacks.current.onVerify('');
        if (developmentBypass) callbacks.current.onVerify('dev-bypass-token');
        else controller.current?.reset();
    } }), [developmentBypass]);
    useEffect(() => {
        if (developmentBypass) {
            callbacks.current.onVerify('dev-bypass-token');
            setStatus('verified');
            return () => callbacks.current.onVerify('');
        }
        if (!container.current) return;
        const mounted = mountTurnstile(container.current, {
            siteKey, action,
            onToken: (token) => callbacks.current.onVerify(token),
            onExpire: () => callbacks.current.onExpire?.(),
            onStatus: setStatus,
        });
        controller.current = mounted;
        return () => { controller.current = null; mounted.destroy(); };
    }, [siteKey, action, developmentBypass]);
    return <div data-lb-security-verification="" className="w-full">
        <div ref={container} />
        <div role="status" aria-live="polite" className="text-sm">
            {status === 'checking' && 'Checking security…'}
            {status === 'interactive' && 'Complete the security check to continue.'}
            {status === 'unavailable' && 'Security verification is temporarily unavailable. Please try again later.'}
            {status === 'retry' && <>
                <p>Security verification could not finish. Check your connection and try again.</p>
                <Button type="button" variant="secondary" onClick={() => controller.current?.reset()}>Retry verification</Button>
            </>}
        </div>
    </div>;
});
