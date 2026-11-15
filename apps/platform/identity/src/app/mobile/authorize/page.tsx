'use client'

import { useEffect, useRef, useState } from 'react'
import { getAuthHeaders } from '@/lib/csrf-client'
import { BrandLogo } from '@/components/BrandLogo'

export default function MobileAuthorizePage() {
    const started = useRef(false), [error, setError] = useState(false)
    useEffect(() => {
        if (started.current) return
        started.current = true
        const fragment = new URLSearchParams(window.location.hash.slice(1))
        window.history.replaceState(null, '', '/mobile/authorize')
        void (async () => {
            try {
                if ([...fragment.keys()].some(key => !['request', 'launch'].includes(key)) || ['request', 'launch'].some(key => fragment.getAll(key).length !== 1)) throw new Error('Invalid request')
                const response = await fetch('/api/auth/mobile/bind', { method: 'POST', headers: await getAuthHeaders(), body: JSON.stringify({ requestId: fragment.get('request'), launchProof: fragment.get('launch') }), signal: AbortSignal.timeout(20000) })
                if (!response.ok) throw new Error('Invalid request')
                window.location.replace('/mobile')
            } catch { setError(true) }
        })()
    }, [])
    return <main className="auth-container"><div className="auth-card"><BrandLogo />
        <h1 className="auth-title">{error ? 'Start again from the app' : 'Opening secure sign-in…'}</h1>
        <p role={error ? 'alert' : 'status'}>{error ? 'This request expired or could not be opened. Return to LetBuyy and try again.' : 'Connecting your LetBuyy app to Accounts.'}</p>
    </div></main>
}
