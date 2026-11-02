'use client'
import { Button, Input } from '@letbuyy/ui'

const messages = {
    en: { heading: 'Verify your sign-in', code: 'Authenticator code', recovery: 'Recovery code', useRecovery: 'Use a recovery code', useAuthenticator: 'Use authenticator instead', detail: 'Enter a current authenticator code or one unused recovery code.' },
    hi: { heading: 'साइन-इन सत्यापित करें', code: 'प्रमाणक कोड', recovery: 'रिकवरी कोड', useRecovery: 'रिकवरी कोड का उपयोग करें', useAuthenticator: 'प्रमाणक का उपयोग करें', detail: 'वर्तमान प्रमाणक कोड या एक अप्रयुक्त रिकवरी कोड दर्ज करें।' },
    ta: { heading: 'உள்நுழைவைச் சரிபார்க்கவும்', code: 'அங்கீகாரக் குறியீடு', recovery: 'மீட்புக் குறியீடு', useRecovery: 'மீட்புக் குறியீட்டைப் பயன்படுத்தவும்', useAuthenticator: 'அங்கீகாரியைப் பயன்படுத்தவும்', detail: 'தற்போதைய அங்கீகாரக் குறியீடு அல்லது பயன்படுத்தாத மீட்புக் குறியீட்டை உள்ளிடவும்.' },
}
export function MfaLoginFields({ lang, code, onCode, recovery, onRecovery, useRecovery, onMode }: { lang: 'en' | 'hi' | 'ta'; code: string; onCode: (value: string) => void; recovery: string; onRecovery: (value: string) => void; useRecovery: boolean; onMode: () => void }) {
    const t = messages[lang]
    return <fieldset className="auth-field"><legend>{t.heading}</legend><p>{t.detail}</p>
        <label htmlFor="mfa-code">{useRecovery ? t.recovery : t.code}</label>
        <Input unstyled id="mfa-code" autoComplete="one-time-code" inputMode={useRecovery ? 'text' : 'numeric'} maxLength={useRecovery ? 40 : 6} value={useRecovery ? recovery : code} onChange={event => useRecovery ? onRecovery(event.target.value) : onCode(event.target.value)} required autoFocus />
        <Button unstyled type="button" onClick={onMode}>{useRecovery ? t.useAuthenticator : t.useRecovery}</Button>
    </fieldset>
}
