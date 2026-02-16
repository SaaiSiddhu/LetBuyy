'use client';

import { useState } from 'react';

interface EmailSignupProps {
    /** Placeholder text */
    placeholder?: string;
    /** Button text */
    buttonText?: string;
    /** Button background color */
    buttonColor?: string;
    /** Button text color */
    buttonTextColor?: string;
    /** Dark mode flag for input styling */
    isDark?: boolean;
    /** Callback on submit */
    onSubmit?: (email: string) => void;
}

export default function EmailSignup({
    placeholder = 'Enter your email',
    buttonText = 'Notify Me',
    buttonColor = '#6366f1',
    buttonTextColor = '#ffffff',
    isDark = true,
    onSubmit,
}: EmailSignupProps) {
    const [email, setEmail] = useState('');
    const [submitted, setSubmitted] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !email.includes('@')) return;
        onSubmit?.(email);
        setSubmitted(true);
        setTimeout(() => setSubmitted(false), 3000);
        setEmail('');
    };

    if (submitted) {
        return (
            <div className="cs-email-form" style={{ justifyContent: 'center' }}>
                <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.875rem 1.5rem',
                    borderRadius: 14,
                    background: isDark ? 'rgba(34,197,94,0.12)' : 'rgba(34,197,94,0.08)',
                    border: `1px solid rgba(34,197,94,0.25)`,
                    color: isDark ? '#86efac' : '#16a34a',
                    fontSize: '0.9rem',
                    fontWeight: 500,
                }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                    </svg>
                    You&apos;ll be the first to know!
                </div>
            </div>
        );
    }

    return (
        <form className="cs-email-form" onSubmit={handleSubmit}>
            <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder={placeholder}
                className="cs-email-input"
                style={{
                    borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
                    background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                    color: 'inherit',
                }}
                required
            />
            <button
                type="submit"
                className="cs-email-btn"
                style={{ background: buttonColor, color: buttonTextColor }}
            >
                {buttonText}
            </button>
        </form>
    );
}
