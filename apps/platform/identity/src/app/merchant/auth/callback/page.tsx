'use client'
import { useEffect } from 'react'
export default function MerchantAppCallbackPage() {
    useEffect(() => { window.history.replaceState(null, '', '/merchant/auth/callback') }, [])
    return <main className="auth-container"><div className="auth-card"><h1>Return to the LetBuyy app</h1><p>The app could not open this link. Return to LetBuyy and restart sign-in. Your account and saved work are preserved.</p></div></main>
}
